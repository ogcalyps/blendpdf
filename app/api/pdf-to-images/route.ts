import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { logger } from '@/lib/cloudwatch-logger';
import { getPdfJs } from '@/lib/pdf-processor';
import { createCanvas } from 'canvas';
import { randomUUID } from 'crypto';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import JSZip from 'jszip';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Rendering above this many pages risks OOM/timeouts on the 1.9GB production host
const MAX_PAGES = 100;

/**
 * Convert PDF pages to images
 * Returns a ZIP file containing all pages as images (JPG or PNG)
 */
export async function POST(request: NextRequest) {
  const requestId = `pdf-to-images-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Rate limiting: 10 conversions per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { ip: getClientIP(request) }, requestId);
    return NextResponse.json(
      {
        error: 'Too many conversion requests. Please wait a few minutes before trying again.',
        requestId,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const format = (formData.get('format') as string) || 'jpg'; // 'jpg' or 'png'
    const requestedDpi = parseInt((formData.get('dpi') as string) || '300', 10); // Default 300 DPI
    // Clamp to a sane range: very high DPI renders exhaust memory on the production host
    const dpi = Math.min(600, Math.max(72, Number.isFinite(requestedDpi) ? requestedDpi : 300));

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided. Please select a PDF file to convert.',
          requestId,
        },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        {
          error: 'File must be a PDF',
          requestId,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('PDF to Images conversion started', { 
      fileSize: `${fileSizeMB}MB`, 
      fileName: file.name,
      format,
      dpi 
    }, requestId);

    // Load PDF with pdf.js
    // pdf.js requires Uint8Array, not Buffer
    const pdfjs = await getPdfJs();
    const pdfData = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data: pdfData,
      verbosity: 0,
      useWorkerFetch: false,
      isEvalSupported: false,
      // Provide the bundled standard fonts so PDFs relying on non-embedded
      // base-14 fonts render with correct glyphs in Node (trailing slash required)
      standardFontDataUrl: join(process.cwd(), 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/',
    });

    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    logger.info('PDF loaded', { numPages }, requestId);

    if (numPages > MAX_PAGES) {
      logger.warn('PDF exceeds page limit', { numPages, maxPages: MAX_PAGES }, requestId);
      return NextResponse.json(
        {
          error: `This PDF has ${numPages} pages. The maximum supported is ${MAX_PAGES} pages per conversion. Please split the PDF first and convert it in parts.`,
          requestId,
        },
        { status: 400 }
      );
    }

    // PDF user space is 72 DPI, so the render scale is exactly dpi / 72
    // (requested DPI == actual output DPI)
    const scale = dpi / 72;

    // Create temp directory for images
    const tempDir = join(tmpdir(), `pdf-images-${randomUUID()}`);
    await mkdir(tempDir, { recursive: true });

    const imageFiles: Array<{ path: string; pageNumber: number }> = [];

    try {
      // Convert each page to an image
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        // Render PDF page to canvas
        const renderContext = {
          canvasContext: context as any,
          viewport: viewport,
        };

        await page.render(renderContext).promise;

        // Convert canvas to image buffer
        const imageBuffer = format === 'png' 
          ? canvas.toBuffer('image/png')
          : canvas.toBuffer('image/jpeg', { quality: 95 });

        // Save image to temp directory (zero-padded so files sort correctly when extracted)
        const imageExtension = format === 'png' ? 'png' : 'jpg';
        const imagePath = join(tempDir, `page-${String(pageNum).padStart(3, '0')}.${imageExtension}`);
        await writeFile(imagePath, imageBuffer);
        
        imageFiles.push({ path: imagePath, pageNumber: pageNum });
      }

      logger.info('All pages converted to images', { count: imageFiles.length }, requestId);

      // Create ZIP file with all images
      const zip = new JSZip();
      
      for (const { path, pageNumber } of imageFiles) {
        const imageBuffer = await readFile(path);
        const imageExtension = format === 'png' ? 'png' : 'jpg';
        const fileName = `page-${String(pageNumber).padStart(3, '0')}.${imageExtension}`;
        zip.file(fileName, imageBuffer);
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      const zipSizeMB = (zipBuffer.length / 1024 / 1024).toFixed(2);
      
      logger.info('ZIP file created', { 
        size: `${zipSizeMB}MB`, 
        imageCount: imageFiles.length,
        format 
      }, requestId);

      // Cleanup temp files
      for (const { path } of imageFiles) {
        await unlink(path).catch(() => {});
      }

      // Sanitize filename for Content-Disposition header
      const originalFilename = file.name.replace(/\.pdf$/i, '');
      const sanitizedFilename = originalFilename
        .replace(/[^\x20-\x7E]/g, '_')
        .substring(0, 200);
      
      const zipFilename = `${sanitizedFilename}_images.zip`;

      // Return ZIP file
      return new NextResponse(new Uint8Array(zipBuffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`,
          'X-Request-ID': requestId,
          'X-Page-Count': String(numPages),
          'X-Image-Format': format,
          'X-DPI': String(dpi),
        },
      });
    } catch (conversionError) {
      // Cleanup on error
      for (const { path } of imageFiles) {
        await unlink(path).catch(() => {});
      }
      throw conversionError;
    }
  } catch (error) {
    logger.error('PDF to Images conversion failed', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      stack: error instanceof Error ? error.stack : undefined 
    }, requestId);

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unknown error occurred while converting the PDF to images';

    return NextResponse.json(
      {
        error: errorMessage,
        requestId,
      },
      { status: 500 }
    );
  }
}

