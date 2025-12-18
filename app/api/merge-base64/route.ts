import { NextRequest, NextResponse } from 'next/server';
import { mergePDFs } from '@/lib/pdf-processor';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Alternative merge endpoint that accepts Base64-encoded files
// This bypasses Amplify's FormData handling issues
export async function POST(request: NextRequest) {
  // Log immediately - even before creating request ID
  console.log('========== MERGE BASE64 API ROUTE CALLED ==========');
  console.error('========== MERGE BASE64 API ROUTE CALLED ==========');
  process.stdout.write('MERGE_BASE64_ROUTE_HANDLER_CALLED\n');
  process.stderr.write('MERGE_BASE64_ROUTE_HANDLER_CALLED\n');
  
  const startTime = Date.now();
  const requestId = `merge-base64-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}] MERGE BASE64 REQUEST INITIATED`);
  console.error(`[${requestId}] MERGE BASE64 REQUEST INITIATED`);
  process.stdout.write(`[${requestId}] MERGE BASE64 REQUEST INITIATED\n`);
  process.stderr.write(`[${requestId}] MERGE BASE64 REQUEST INITIATED\n`);
  
  try {
    // Log before parsing JSON
    console.log(`[${requestId}] About to parse JSON body...`);
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');
    console.log(`[${requestId}] Content-Type: ${contentType}, Content-Length: ${contentLength}`);
    
    // Parse JSON body with Base64-encoded files
    const body = await request.json();
    console.log(`[${requestId}] JSON body parsed successfully`);
    const { files } = body; // Array of { name: string, data: string (base64) }
    
    if (!files || !Array.isArray(files) || files.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 files are required' },
        { status: 400 }
      );
    }
    
    console.log(`[${requestId}] Received ${files.length} Base64-encoded files`);
    
    // Convert Base64 to ArrayBuffer
    const buffers = files.map((file: { name: string; data: string }, index: number) => {
      // Remove data: prefix if present
      const base64Data = file.data.replace(/^data:application\/pdf;base64,/, '').replace(/^data:.*;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      console.log(`[${requestId}] File ${index + 1}/${files.length} (${file.name}) decoded: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
      return buffer.buffer;
    });
    
    // Merge PDFs
    console.log(`[${requestId}] Starting PDF merge...`);
    const mergedPdf = await mergePDFs(buffers);
    console.log(`[${requestId}] PDF merge completed. Size: ${(mergedPdf.length / 1024 / 1024).toFixed(2)}MB`);
    
    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] Total request time: ${totalTime}ms`);
    
    // Return merged PDF as Base64
    const base64Result = Buffer.from(mergedPdf).toString('base64');
    
    return NextResponse.json({
      success: true,
      data: `data:application/pdf;base64,${base64Result}`,
      requestId,
      processingTime: `${totalTime}ms`,
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] Error after ${totalTime}ms:`, error);
    
    const errorMessage = error instanceof Error
      ? error.message
      : 'An unknown error occurred';
    
    return NextResponse.json(
      { error: errorMessage, requestId, processingTime: `${totalTime}ms` },
      { status: 500 }
    );
  }
}

