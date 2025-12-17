import { NextRequest, NextResponse } from 'next/server';
import { mergePDFs } from '@/lib/pdf-processor';

export async function POST(request: NextRequest) {
  try {
    // Get form data from request
    const formData = await request.formData();
    
    // Get all files from form data
    const files = formData.getAll('files') as File[];
    
    // Validate: need at least 2 files to merge
    if (files.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 PDF files are required to merge' },
        { status: 400 }
      );
    }
    
    // Validate all files are PDFs
    const invalidFiles = files.filter(file => file.type !== 'application/pdf');
    if (invalidFiles.length > 0) {
      return NextResponse.json(
        { error: 'All files must be PDFs' },
        { status: 400 }
      );
    }
    
    // Convert files to ArrayBuffers
    const buffers = await Promise.all(
      files.map(file => file.arrayBuffer())
    );
    
    // Merge PDFs
    const mergedPdf = await mergePDFs(buffers);
    
    // Return merged PDF as response (convert Uint8Array to Buffer)
    return new NextResponse(Buffer.from(mergedPdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="merged.pdf"',
      },
    });
  } catch (error) {
    // Log error for debugging
    console.error('Error merging PDFs:', error);
    
    // Return error response
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred while merging PDFs';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

