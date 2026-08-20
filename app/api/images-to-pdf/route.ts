import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { logger } from '@/lib/cloudwatch-logger';

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB per image (mirrors the client-side limit)
const MAX_IMAGES = 100;

// A4 page size in PDF points
const A4_WIDTH = 595;
const A4_HEIGHT = 842;

export async function POST(request: NextRequest) {
  const requestId = `images-to-pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    const count = parseInt(formData.get('count') as string, 10);
    // Page size option: 'a4' (default) letterboxes onto portrait A4,
    // 'fit' sizes each page exactly to its image dimensions
    const pageSizeParam = (formData.get('pageSize') as string) || 'a4';
    const pageSize = pageSizeParam === 'fit' ? 'fit' : 'a4';

    if (!count || count === 0) {
      return NextResponse.json({ error: 'No images provided', requestId }, { status: 400 });
    }

    if (count > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Too many images. The maximum is ${MAX_IMAGES} images per PDF.`, requestId },
        { status: 400 }
      );
    }

    logger.info('Images to PDF conversion started', { count, pageSize }, requestId);

    // Create new PDF
    const pdfDoc = await PDFDocument.create();

    // Inputs that could not be embedded (unsupported type, too large, corrupt data).
    // Reported back via the X-Skipped-Files header instead of being silently dropped.
    const skippedFiles: string[] = [];

    // Process each image in order
    for (let i = 0; i < count; i++) {
      const imageFile = formData.get(`image_${i}`) as File;
      if (!imageFile) continue;

      if (imageFile.size > MAX_IMAGE_SIZE) {
        skippedFiles.push(imageFile.name || `image_${i}`);
        continue;
      }

      const imageBytes = await imageFile.arrayBuffer();

      // Embed image based on type
      let image;
      try {
        if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
          image = await pdfDoc.embedJpg(imageBytes);
        } else if (imageFile.type === 'image/png') {
          image = await pdfDoc.embedPng(imageBytes);
        } else {
          // pdf-lib only supports JPEG and PNG (the client normalizes WebP to PNG)
          skippedFiles.push(imageFile.name || `image_${i}`);
          continue;
        }
      } catch (embedError) {
        logger.warn('Failed to embed image', {
          fileName: imageFile.name,
          error: embedError instanceof Error ? embedError.message : 'Unknown error',
        }, requestId);
        skippedFiles.push(imageFile.name || `image_${i}`);
        continue;
      }

      // Get image dimensions
      const { width, height } = image;

      if (pageSize === 'fit') {
        // Page sized exactly to the image: no margins, no scaling loss
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });
      } else {
        // Fit image to A4 page (595 x 842 points)
        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

        // Calculate scaling to fit image within page while maintaining aspect ratio
        const scale = Math.min(A4_WIDTH / width, A4_HEIGHT / height);

        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        // Center image on page
        const x = (A4_WIDTH - scaledWidth) / 2;
        const y = (A4_HEIGHT - scaledHeight) / 2;

        page.drawImage(image, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
      }
    }

    if (pdfDoc.getPageCount() === 0) {
      return NextResponse.json(
        { error: 'None of the provided images could be converted. Please use JPG, PNG, or WEBP images up to 10MB each.', requestId },
        { status: 400 }
      );
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    logger.info('Images to PDF conversion completed', {
      pages: pdfDoc.getPageCount(),
      skipped: skippedFiles.length,
      outputSize: `${(pdfBytes.length / 1024 / 1024).toFixed(2)}MB`,
    }, requestId);

    const headers: Record<string, string> = {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="images.pdf"',
      'X-Request-ID': requestId,
    };
    if (skippedFiles.length > 0) {
      // Header values must be Latin-1 safe: URI-encode each name
      headers['X-Skipped-Files'] = skippedFiles.map(name => encodeURIComponent(name)).join(',');
    }

    return new NextResponse(Buffer.from(pdfBytes), { headers });
  } catch (error) {
    logger.error('Images to PDF conversion failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    }, requestId);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to convert images', requestId },
      { status: 500 }
    );
  }
}
