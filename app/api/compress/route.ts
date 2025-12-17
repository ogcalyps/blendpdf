import { NextRequest, NextResponse } from 'next/server';
import { compressPDF } from '@/lib/pdf-processor';
import type { CompressionLevel } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const level = (formData.get('level') as CompressionLevel) || 'medium';

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const originalSize = buffer.byteLength;
    const compressed = await compressPDF(buffer, level);
    const compressedSize = compressed.length;

    console.log(`Compression: ${level} - Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes, Reduction: ${((1 - compressedSize / originalSize) * 100).toFixed(1)}%`);

    return new NextResponse(Buffer.from(compressed), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="compressed.pdf"',
      },
    });
  } catch (error) {
    console.error('Error compressing PDF:', error);
    return NextResponse.json({ error: 'Compression failed' }, { status: 500 });
  }
}

