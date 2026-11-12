import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { splitPDF } from '@/lib/pdf-processor';
import { parsePageRanges } from '@/lib/utils';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { inspectPdf } from '@/lib/pdf-validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const requestId = `split-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Rate limiting: 20 splits per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  if (!rateLimit.allowed) {
    console.warn(`[${requestId}] Rate limit exceeded for IP: ${getClientIP(request)}`);
    return NextResponse.json(
      {
        error: 'Too many split requests. Please wait a few minutes before trying again.',
        requestId,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const ranges = formData.get('ranges') as string;
    // mode: 'single' (default) combines the selected pages into one PDF;
    // 'separate' produces one PDF per range and returns them as a ZIP.
    const mode = (formData.get('mode') as string) === 'separate' ? 'separate' : 'single';

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided. Please select a PDF file to split.',
          requestId,
        },
        { status: 400 }
      );
    }
    
    if (!ranges) {
      return NextResponse.json(
        {
          error: 'Page ranges are required. Please specify which pages to extract (e.g., "1-5" or "1,3,5").',
          requestId,
        },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    console.log(`[${requestId}] Splitting PDF: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB, ranges: ${ranges}, mode: ${mode}`);

    // Shared front door: a file that starts with %PDF- but is broken after that
    // used to reach getPageCount() unguarded and come back as a 500 carrying the
    // raw pdf-lib message.
    const inspection = await inspectPdf(Buffer.from(buffer));
    if (!inspection.ok) {
      const { errorCode, message, detail } = inspection.rejection;
      console.warn(`[${requestId}] Rejected: ${errorCode}`, detail ?? {});
      return NextResponse.json({ error: message, errorCode, requestId }, { status: 400 });
    }

    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const pageCount = inspection.value.pageCount;
    const pageIndices = parsePageRanges(ranges, pageCount);

    if (pageIndices.length === 0) {
      return NextResponse.json(
        {
          error: `Invalid page ranges. The PDF has ${pageCount} page${pageCount !== 1 ? 's' : ''}. Please specify valid page numbers (e.g., "1-5" or "1,3,5").`,
          requestId,
          pageCount,
        },
        { status: 400 }
      );
    }
    
    if (mode === 'separate') {
      // One PDF per range token (e.g. "1-5, 8, 12-15" -> 3 files), packaged as a ZIP
      const tokens = ranges.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
      const zip = new JSZip();
      const pad = Math.max(3, String(pageCount).length);
      const usedNames = new Set<string>();
      let totalPagesExtracted = 0;

      for (const token of tokens) {
        const indices = parsePageRanges(token, pageCount);
        if (indices.length === 0) continue;

        const pdfBytes = await splitPDF(buffer, indices);
        const firstPage = indices[0] + 1;
        const lastPage = indices[indices.length - 1] + 1;
        const baseName =
          firstPage === lastPage
            ? `pages-${String(firstPage).padStart(pad, '0')}`
            : `pages-${String(firstPage).padStart(pad, '0')}-${String(lastPage).padStart(pad, '0')}`;

        let entryName = `${baseName}.pdf`;
        let suffix = 2;
        while (usedNames.has(entryName)) {
          entryName = `${baseName}-${suffix++}.pdf`;
        }
        usedNames.add(entryName);

        zip.file(entryName, pdfBytes);
        totalPagesExtracted += indices.length;
      }

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      console.log(`[${requestId}] Split complete (separate): ${usedNames.size} files, ${(zipBuffer.length / 1024 / 1024).toFixed(2)}MB zip`);

      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="split.zip"',
          'X-Request-ID': requestId,
          'X-Files-Count': String(usedNames.size),
          'X-Pages-Extracted': String(totalPagesExtracted),
        },
      });
    }

    console.log(`[${requestId}] Extracting pages: ${pageIndices.join(', ')} (${pageIndices.length} pages)`);

    const splitPdf = await splitPDF(buffer, pageIndices);
    
    console.log(`[${requestId}] Split complete: ${(splitPdf.length / 1024 / 1024).toFixed(2)}MB`);

    return new NextResponse(Buffer.from(splitPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="split.pdf"',
        'X-Request-ID': requestId,
        'X-Pages-Extracted': String(pageIndices.length),
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error splitting PDF:`, error);
    
    let errorMessage = 'Failed to split PDF. Please try again.';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Split operation timed out. The file may be too large. Please try with a smaller file.';
        statusCode = 408;
      } else if (error.message.includes('corrupt') || error.message.includes('invalid')) {
        errorMessage = 'The PDF file is corrupted or invalid. Please check your file and try again.';
        statusCode = 400;
      } else if (
        error.message.includes('out of range') ||
        error.message.includes('Page index') ||
        // parsePageRanges throws this for a range past the end of the document;
        // it is bad input, not a server fault, and it used to 500.
        error.message.includes('exceeds maximum pages')
      ) {
        // parsePageRanges writes these three messages for the user ("Page 5
        // exceeds maximum pages (3)"); rewriting them generically would drop
        // the only detail that helps.
        errorMessage = error.message; // leak-guard: authored — from parsePageRanges, not an engine
        statusCode = 400;
      } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
        errorMessage = 'File is too large to split. Please try with a smaller file.';
        statusCode = 413;
      }
      // No `else { errorMessage = error.message }`: an unrecognised failure is
      // internal detail and is already logged above.
    }
    
    return NextResponse.json(
      {
        error: errorMessage,
        requestId,
        ...(process.env.NODE_ENV === 'development' && { details: error instanceof Error ? error.stack : String(error) }),
      },
      { status: statusCode }
    );
  }
}

