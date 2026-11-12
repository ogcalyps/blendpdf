import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, degrees } from 'pdf-lib';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { inspectPdf, pdfRejectionResponse } from '@/lib/pdf-validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const requestId = `rotate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: 20 rotations per 15 minutes per IP
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
    const rotationsStr = formData.get('rotations') as string | null;

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

    if (!rotationsStr) {
      return NextResponse.json({ error: 'No rotations provided', requestId }, { status: 400 });
    }

    let rotations: { [key: number]: number };
    try {
      rotations = JSON.parse(rotationsStr);
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse rotations:`, parseError);
      return NextResponse.json({ error: 'Invalid rotations format', requestId }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    // Covers the encrypted case this route already handled, plus the one it
    // did not: pdf-lib's load() is lazy, so a structurally broken file only
    // blew up later at getPages() and surfaced as a raw-message 500.
    const inspection = await inspectPdf(Buffer.from(arrayBuffer));
    if (!inspection.ok) {
      console.warn(`[${requestId}] Rejected: ${inspection.rejection.errorCode}`, inspection.rejection.detail ?? {});
      return pdfRejectionResponse(inspection.rejection, requestId);
    }

    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    // Apply rotations to each page
    const pages = pdfDoc.getPages();
    pages.forEach((page, index) => {
      const pageNum = index + 1;
      const rotation = rotations[pageNum] || 0;
      if (rotation !== 0) {
        // Compose with the page's existing /Rotate value so the output matches
        // the pdf.js preview (which renders existing rotation + user delta)
        const currentRotation = page.getRotation().angle;
        const newRotation = (((currentRotation + rotation) % 360) + 360) % 360;
        page.setRotation(degrees(newRotation));
      }
    });

    // Save rotated PDF
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="rotated.pdf"`,
        'Content-Length': String(pdfBytes.length),
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error rotating PDF:`, error);
    return NextResponse.json(
      { error: 'Failed to rotate this PDF. Please try again.', errorCode: 'ROTATE_FAILED', requestId },
      { status: 500 }
    );
  }
}
