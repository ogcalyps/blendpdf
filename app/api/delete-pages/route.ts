import { NextRequest, NextResponse } from 'next/server';
import { deletePages } from '@/lib/pdf-processor';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const requestId = `delete-pages-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: 20 requests per 15 minutes per IP
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
    const pagesToDeleteStr = formData.get('pagesToDelete') as string | null;

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

    if (!pagesToDeleteStr) {
      return NextResponse.json({ error: 'No pages specified for deletion', requestId }, { status: 400 });
    }

    let pagesToDelete: Set<number>;
    try {
      pagesToDelete = new Set(JSON.parse(pagesToDeleteStr) as number[]);
    } catch (parseError) {
      console.error(`[${requestId}] Failed to parse pages to delete:`, parseError);
      return NextResponse.json({ error: 'Invalid pages format', requestId }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();

    const pdfBytes = await deletePages(arrayBuffer, pagesToDelete);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="deleted.pdf"`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error deleting pages:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete pages', requestId },
      { status: 500 }
    );
  }
}
