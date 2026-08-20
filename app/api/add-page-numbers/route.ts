import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { toHeaderSafeFilename } from '@/lib/pdf-processor';

export const runtime = 'nodejs';
export const maxDuration = 30;

type PageNumberPosition = 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right';
type PageNumberFormat = '1' | '1 / 10' | 'Page 1' | 'Page 1 of 10';

export async function POST(request: NextRequest) {
  const requestId = `add-page-numbers-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    const position = (formData.get('position') as PageNumberPosition) || 'bottom-center';
    const format = (formData.get('format') as PageNumberFormat) || '1';
    const startFrom = parseInt((formData.get('startFrom') as string) || '1');
    const fontSize = parseInt((formData.get('fontSize') as string) || '12');

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided. Please select a PDF file.',
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

    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    if (pdfDoc.isEncrypted) {
      return NextResponse.json(
        {
          error: 'This PDF is password-protected. Please use the Unlock PDF tool to remove the password first, then try again.',
          errorCode: 'ENCRYPTED_PDF',
          requestId,
        },
        { status: 400 }
      );
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // Embed font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Calculate position coordinates based on position option
    const getPosition = (page: any, pageNum: number, totalPages: number): { x: number; y: number } => {
      const { width, height } = page.getSize();
      const margin = 20;
      const pageNumber = startFrom + pageNum - 1;
      const text = formatPageNumber(format, pageNumber, totalPages);

      let x = 0;
      let y = 0;

      if (position.includes('bottom')) {
        y = margin;
      } else {
        y = height - margin - fontSize;
      }

      if (position.includes('center')) {
        // Calculate text width (approximate)
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        x = (width - textWidth) / 2;
      } else if (position.includes('left')) {
        x = margin;
      } else if (position.includes('right')) {
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        x = width - textWidth - margin;
      }

      return { x, y };
    };

    // Add page numbers to each page
    pages.forEach((page, index) => {
      const pageNum = index + 1;
      const { x, y } = getPosition(page, pageNum, totalPages);
      const pageNumber = startFrom + pageNum - 1;
      const text = formatPageNumber(format, pageNumber, totalPages);

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${toHeaderSafeFilename(file.name.replace('.pdf', '_numbered.pdf'), 'numbered.pdf')}"`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error: any) {
    console.error('Error adding page numbers:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to add page numbers. Please try again.',
        requestId,
      },
      { status: 500 }
    );
  }
}

function formatPageNumber(format: PageNumberFormat, pageNum: number, totalPages: number): string {
  switch (format) {
    case '1':
      return String(pageNum);
    case '1 / 10':
      return `${pageNum} / ${totalPages}`;
    case 'Page 1':
      return `Page ${pageNum}`;
    case 'Page 1 of 10':
      return `Page ${pageNum} of ${totalPages}`;
    default:
      return String(pageNum);
  }
}
