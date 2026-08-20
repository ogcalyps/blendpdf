import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { isWinAnsiEncodable, toHeaderSafeFilename } from '@/lib/pdf-processor';

export const runtime = 'nodejs';
export const maxDuration = 30;

type SignatureType = 'text' | 'image';
type SignaturePosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';

export async function POST(request: NextRequest) {
  const requestId = `sign-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    const signatureType = (formData.get('signatureType') as SignatureType) || 'text';
    const text = (formData.get('text') as string) || 'Signature';
    const position = (formData.get('position') as SignaturePosition) || 'bottom-right';
    const pageNumber = parseInt((formData.get('pageNumber') as string) || '1');
    const imageFile = formData.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.', requestId }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF', requestId }, { status: 400 });
    }

    // StandardFonts use WinAnsi encoding: Arabic/CJK/emoji text would crash drawText
    if (signatureType === 'text' && !isWinAnsiEncodable(text)) {
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

    if (pageNumber < 1 || pageNumber > totalPages) {
      return NextResponse.json({ error: `Invalid page number. PDF has ${totalPages} pages.`, requestId }, { status: 400 });
    }

    const page = pages[pageNumber - 1];
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    if (signatureType === 'text') {
      const fontSize = 12;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const margin = 20;

      let x = 0;
      let y = 0;

      if (position.includes('bottom')) {
        y = margin;
      } else {
        y = height - margin - fontSize;
      }

      if (position.includes('left')) {
        x = margin;
      } else if (position.includes('right')) {
        x = width - textWidth - margin;
      } else if (position.includes('center')) {
        x = (width - textWidth) / 2;
      }

      page.drawText(text, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      // Draw a line above the signature
      page.drawLine({
        start: { x: x - 10, y: y + fontSize + 5 },
        end: { x: x + textWidth + 10, y: y + fontSize + 5 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
    } else if (signatureType === 'image' && imageFile) {
      const imageBytes = await imageFile.arrayBuffer();
      let image;
      if (imageFile.type === 'image/png') {
        image = await pdfDoc.embedPng(imageBytes);
      } else if (imageFile.type === 'image/jpeg' || imageFile.type === 'image/jpg') {
        image = await pdfDoc.embedJpg(imageBytes);
      } else {
        return NextResponse.json({ error: 'Image must be PNG or JPEG', requestId }, { status: 400 });
      }

      const { width: imgWidth, height: imgHeight } = image.scale(0.3);
      const margin = 20;

      let x = 0;
      let y = 0;

      if (position.includes('bottom')) {
        y = margin;
      } else {
        y = height - imgHeight - margin;
      }

      if (position.includes('left')) {
        x = margin;
      } else if (position.includes('right')) {
        x = width - imgWidth - margin;
      } else if (position.includes('center')) {
        x = (width - imgWidth) / 2;
      }

      page.drawImage(image, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
      });
    } else {
      return NextResponse.json({ error: 'Image file required for image signature', requestId }, { status: 400 });
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${toHeaderSafeFilename(file.name.replace('.pdf', '_signed.pdf'), 'signed.pdf')}"`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error: any) {
    console.error('Error adding signature:', error);
    return NextResponse.json({ error: error.message || 'Failed to add signature.', requestId }, { status: 500 });
  }
}
