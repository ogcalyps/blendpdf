import { NextRequest, NextResponse } from 'next/server';
import { watermarkPDF, isWinAnsiEncodable, toHeaderSafeFilename } from '@/lib/pdf-processor';
import { rateLimitMiddleware } from '@/lib/rate-limit';
import { inspectPdf, pdfRejectionResponse } from '@/lib/pdf-validation';

export const runtime = 'nodejs';
export const maxDuration = 30;

type WatermarkType = 'text' | 'image';
type WatermarkPosition = 'center' | 'diagonal' | 'tiled';

export async function POST(request: NextRequest) {
  const requestId = `watermark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes.', requestId },
      { status: 429, headers: { 'X-RateLimit-Limit': '20', 'X-RateLimit-Remaining': String(rateLimit.remaining) } }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const watermarkType = (formData.get('watermarkType') as WatermarkType) || 'text';
    const text = (formData.get('text') as string) || 'DRAFT';
    const position = (formData.get('position') as WatermarkPosition) || 'diagonal';
    const opacity = parseFloat((formData.get('opacity') as string) || '0.3');
    const fontSize = parseInt((formData.get('fontSize') as string) || '48');
    const imageFile = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.', requestId }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF', requestId }, { status: 400 });
    }

    // StandardFonts use WinAnsi encoding: Arabic/CJK/emoji text would crash drawText
    if (watermarkType === 'text' && !isWinAnsiEncodable(text)) {
      return NextResponse.json(
        {
          error: 'This text contains characters that are not supported yet — Latin characters only for now.',
          errorCode: 'UNSUPPORTED_CHARACTERS',
          requestId,
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    // Front-door check. Without it a non-PDF reached pdf-lib and came back as a
    // 500 carrying the parser's own words — production was answering
    // "Failed to parse PDF document (line:0 col:54 offset=27): No PDF header
    // found" to anyone who uploaded the wrong file.
    const inspection = await inspectPdf(Buffer.from(arrayBuffer));
    if (!inspection.ok) {
      console.warn(`[${requestId}] Rejected: ${inspection.rejection.errorCode}`, inspection.rejection.detail ?? {});
      return pdfRejectionResponse(inspection.rejection, requestId);
    }

    const pdfBytes = await watermarkPDF(arrayBuffer, {
      type: watermarkType,
      text,
      imageFile: imageFile || undefined,
      position,
      opacity,
      fontSize,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${toHeaderSafeFilename(file.name.replace('.pdf', '_watermarked.pdf'), 'watermarked.pdf')}"`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    // Log the engine's words; never return them.
    console.error(`[${requestId}] Error adding watermark:`, error);
    return NextResponse.json(
      { error: 'Failed to add the watermark. Please try again.', errorCode: 'WATERMARK_FAILED', requestId },
      { status: 500 }
    );
  }
}
