import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const requestId = `reorder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: 20 reorders per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  if (!rateLimit.allowed) {
    console.warn(`[${requestId}] Rate limit exceeded for IP: ${getClientIP(request)}`);
    return NextResponse.json(
      {
        error: 'Too many requests. Please wait a few minutes before trying again.',
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
    const pageOrderStr = formData.get('pageOrder') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided', requestId }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size limit is 50MB. Try our Compress PDF tool first.',
          errorCode: 'FILE_TOO_LARGE',
          requestId,
        },
        { status: 400 }
      );
    }

    if (!pageOrderStr) {
      return NextResponse.json({ error: 'No page order provided', requestId }, { status: 400 });
    }

    let pageOrder: number[];
    try {
      pageOrder = JSON.parse(pageOrderStr) as number[];
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse page order:`, parseError);
      return NextResponse.json({ error: 'Invalid page order format', requestId }, { status: 400 });
    }

    if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
      return NextResponse.json({ error: 'Invalid page order format', requestId }, { status: 400 });
    }

    // Load source PDF (ignoreEncryption so we can inspect it, then reject encrypted files cleanly)
    const arrayBuffer = await file.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    if (srcDoc.isEncrypted) {
      return NextResponse.json(
        {
          error: 'This PDF is password-protected. Please use the Unlock PDF tool to remove the password first, then try again.',
          errorCode: 'ENCRYPTED_PDF',
          requestId,
        },
        { status: 400 }
      );
    }

    const totalPages = srcDoc.getPageCount();
    for (const pageNum of pageOrder) {
      if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > totalPages) {
        return NextResponse.json(
          { error: `Invalid page number ${pageNum}. The PDF has ${totalPages} page${totalPages !== 1 ? 's' : ''}.`, requestId },
          { status: 400 }
        );
      }
    }

    // Create new PDF with pages in new order
    const newDoc = await PDFDocument.create();

    for (const pageNum of pageOrder) {
      // Page numbers are 1-indexed in UI, but copyPages uses 0-indexed
      const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
      newDoc.addPage(copiedPage);
    }

    // Save reordered PDF
    const pdfBytes = await newDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="reordered.pdf"`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error reordering PDF:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to reorder PDF', requestId },
      { status: 500 }
    );
  }
}
