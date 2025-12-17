import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { splitPDF } from '@/lib/pdf-processor';
import { parsePageRanges } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const ranges = formData.get('ranges') as string;

    if (!file || !ranges) {
      return NextResponse.json({ error: 'File and ranges are required' }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buffer);
    const pageCount = pdf.getPageCount();
    const pageIndices = parsePageRanges(ranges, pageCount);

    if (pageIndices.length === 0) {
      return NextResponse.json({ error: 'Invalid page ranges' }, { status: 400 });
    }

    const splitPdf = await splitPDF(buffer, pageIndices);

    return new NextResponse(Buffer.from(splitPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="split.pdf"',
      },
    });
  } catch (error) {
    console.error('Error splitting PDF:', error);
    return NextResponse.json({ error: 'Split failed' }, { status: 500 });
  }
}

