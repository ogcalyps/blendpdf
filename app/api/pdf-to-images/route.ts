import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { getPdfJs } from '@/lib/pdf-processor';
import { createCanvas } from 'canvas';
import { writeFile, mkdtemp, rm, stat } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import JSZip from 'jszip';
import { inspectPdf, pdfRejectionResponse } from '@/lib/pdf-validation';
import { BUSY_RESPONSE, runHeavyJob } from '@/lib/heavy-jobs';

export const runtime = 'nodejs';
export const maxDuration = 120;

// Rendering above this many pages risks OOM/timeouts on the 1.9GB production host
const MAX_PAGES = 100;
/**
 * Largest page canvas: 25 MP covers A4 at 600 dpi. A bigger page is drawn at a
 * lower scale instead of allocating gigabytes (a 3900 pt page at 600 dpi was a
 * 4.2 GB canvas; security review, 2026-11-12).
 */
const MAX_PAGE_PIXELS = 25_000_000;

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

    const inspection = await inspectPdf(buffer);
    if (!inspection.ok) {
      logger.warn('PDF rejected before conversion', { errorCode: inspection.rejection.errorCode, ...inspection.rejection.detail }, requestId);
      return pdfRejectionResponse(inspection.rejection, requestId);
    }
    logger.info('PDF to Images conversion started', { 
      ...fileLogMeta(file),
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

    // PDF user space is 72 DPI, so the render scale is dpi / 72, lowered for a
    // page so large that it would pass MAX_PAGE_PIXELS
    const scale = dpi / 72;
    const imageExtension = format === 'png' ? 'png' : 'jpg';

    // Private (0700) temp directory for the page images and the ZIP. It goes
    // when the response stream closes, or in the finally below on any other exit.
    const tempDir = await mkdtemp(join(tmpdir(), 'pdf-images-'));
    let handedOff = false;
    const removeTempDir = () =>
      rm(tempDir, { recursive: true, force: true }).catch((error) => {
        logger.warn('Could not remove temp directory', {
          error: error instanceof Error ? error.message : 'Unknown error',
        }, requestId);
      });

    try {
      // One memory-heavy image job at a time (lib/heavy-jobs.ts)
      const job = runHeavyJob(async () => {
        const imagePaths: string[] = [];
        let scaledDown = 0;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const natural = page.getViewport({ scale: 1 });
          const pageScale = Math.min(scale, Math.sqrt(MAX_PAGE_PIXELS / (natural.width * natural.height)));
          if (pageScale < scale) scaledDown++;
          const viewport = page.getViewport({ scale: pageScale });

          const canvas = createCanvas(Math.max(1, Math.floor(viewport.width)), Math.max(1, Math.floor(viewport.height)));
          const context = canvas.getContext('2d');
          await page.render({ canvasContext: context as any, viewport }).promise;

          const imageBuffer = format === 'png'
            ? canvas.toBuffer('image/png')
            : canvas.toBuffer('image/jpeg', { quality: 95 });
          // Free the page's pixels now rather than at the next garbage collection
          canvas.width = 0;
          canvas.height = 0;
          page.cleanup();

          // Zero-padded so files sort correctly when extracted
          const imagePath = join(tempDir, `page-${String(pageNum).padStart(3, '0')}.${imageExtension}`);
          await writeFile(imagePath, imageBuffer);
          imagePaths.push(imagePath);
        }

        // The ZIP is streamed from the page files to disk: 100 pages at 300 dpi
        // used to sit in memory twice (JSZip, then its output buffer)
        const zip = new JSZip();
        imagePaths.forEach((path, index) => {
          zip.file(`page-${String(index + 1).padStart(3, '0')}.${imageExtension}`, createReadStream(path));
        });
        const zipPath = join(tempDir, 'images.zip');
        await pipeline(zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true }), createWriteStream(zipPath));
        return { zipPath, size: (await stat(zipPath)).size, scaledDown };
      });
      if (!job) return NextResponse.json({ ...BUSY_RESPONSE, requestId }, { status: 503 });
      const { zipPath, size, scaledDown } = await job;

      logger.info('ZIP file created', {
        size: `${(size / 1024 / 1024).toFixed(2)}MB`,
        imageCount: numPages,
        scaledDown,
        format
      }, requestId);

      // Sanitize filename for Content-Disposition header
      const originalFilename = file.name.replace(/\.pdf$/i, '');
      const sanitizedFilename = originalFilename
        .replace(/[^\x20-\x7E]/g, '_')
        .substring(0, 200);
      
      const zipFilename = `${sanitizedFilename}_images.zip`;

      const stream = createReadStream(zipPath);
      stream.on('close', () => void removeTempDir());
      handedOff = true;

      return new NextResponse(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        headers: {
          'Content-Length': String(size),
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${zipFilename}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`,
          'X-Request-ID': requestId,
          'X-Page-Count': String(numPages),
          'X-Image-Format': format,
          'X-DPI': String(dpi),
        },
      });
    } finally {
      // Once the response has the ZIP, its stream removes the directory when it closes
      if (!handedOff) {
        await rm(tempDir, { recursive: true, force: true }).catch((error) => {
          logger.warn('Could not remove temp directory', {
            error: error instanceof Error ? error.message : 'Unknown error',
          }, requestId);
        });
      }
    }
  } catch (error) {
    logger.error('PDF to Images conversion failed', { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      stack: error instanceof Error ? error.stack : undefined 
    }, requestId);

    return NextResponse.json(
      {
        error: "We couldn't convert this PDF to images. Please try again.",
        errorCode: 'CONVERSION_FAILED',
        requestId,
      },
      { status: 500 }
    );
  }
}

