import { NextRequest, NextResponse } from 'next/server';
import { mergePDFs } from '@/lib/pdf-processor';

// AWS Amplify serverless function limits
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total
const MAX_FILES = 20; // Maximum number of files
const FUNCTION_TIMEOUT = 25000; // 25 seconds (AWS Amplify default is 10s, max 30s)

// AWS Amplify timeout configuration
// Note: Amplify has a default 10-second timeout that may override this
// You MUST increase the timeout in AWS Amplify Console → App settings → Build settings
export const maxDuration = 30; // Next.js API route max duration (seconds) - max is 30
export const runtime = 'nodejs'; // Use Node.js runtime

// Force immediate logging to help debug timeout issues
if (typeof process !== 'undefined') {
  process.stdout.write('MERGE_ROUTE_LOADED\n');
  process.stderr.write('MERGE_ROUTE_LOADED\n');
}

// Enhanced logging for AWS Amplify visibility
// Logs to both stdout and stderr to ensure visibility in AWS logs
const log = (message: string, data?: any) => {
  const timestamp = new Date().toISOString();
  const logMessage = data 
    ? `${message} ${JSON.stringify(data)}`
    : message;
  const fullMessage = `[${timestamp}] ${logMessage}`;
  console.log(fullMessage);
  console.error(fullMessage); // Also log to stderr for AWS CloudWatch
};

export async function POST(request: NextRequest) {
  // Log immediately - even before creating request ID
  // Use multiple logging methods to ensure visibility
  console.log('========== MERGE API ROUTE CALLED ==========');
  console.error('========== MERGE API ROUTE CALLED ==========');
  process.stdout.write('MERGE_ROUTE_HANDLER_CALLED\n');
  process.stderr.write('MERGE_ROUTE_HANDLER_CALLED\n');
  
  const startTime = Date.now();
  const requestId = `merge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Log with request ID
  console.log(`[${requestId}] MERGE REQUEST INITIATED`);
  console.error(`[${requestId}] MERGE REQUEST INITIATED`);
  process.stdout.write(`[${requestId}] MERGE REQUEST INITIATED\n`);
  process.stderr.write(`[${requestId}] MERGE REQUEST INITIATED\n`);
  
  try {
    log(`[${requestId}] ========== MERGE REQUEST STARTED ==========`);
    
    // Log before attempting to parse form data
    log(`[${requestId}] About to parse FormData...`);
    
    // Check request headers first - log ALL headers for debugging
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');
    const allHeaders: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });
    log(`[${requestId}] Content-Type: ${contentType}, Content-Length: ${contentLength}`);
    log(`[${requestId}] All headers:`, allHeaders);
    
    // If Content-Type is missing or wrong, try to handle it
    if (!contentType || (!contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded'))) {
      log(`[${requestId}] WARNING: Invalid Content-Type: ${contentType}`);
      log(`[${requestId}] Attempting to parse anyway...`);
    }
    
    // Get form data from request
    const formDataStart = Date.now();
    let formData: FormData;
    try {
      formData = await request.formData();
      log(`[${requestId}] FormData parsed successfully in ${Date.now() - formDataStart}ms`);
    } catch (formDataError) {
      log(`[${requestId}] FormData parsing failed:`, formDataError);
      // Try to read as stream and log what we get
      try {
        const text = await request.text();
        log(`[${requestId}] Request body (first 500 chars):`, text.substring(0, 500));
      } catch (textError) {
        log(`[${requestId}] Could not read request body as text:`, textError);
      }
      throw formDataError;
    }
    
    // Get all files from form data
    const files = formData.getAll('files') as File[];
    log(`[${requestId}] Received ${files.length} files`);
    
    // Validate: need at least 2 files to merge
    if (files.length < 2) {
      console.log(`[${requestId}] Validation failed: Need at least 2 files, got ${files.length}`);
      return NextResponse.json(
        { error: 'At least 2 PDF files are required to merge' },
        { status: 400 }
      );
    }
    
    // Validate file count
    if (files.length > MAX_FILES) {
      console.log(`[${requestId}] Validation failed: Too many files (${files.length} > ${MAX_FILES})`);
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES} files allowed for merging` },
        { status: 400 }
      );
    }
    
    // Validate all files are PDFs and check sizes
    const fileInfo: Array<{ name: string; size: number; type: string }> = [];
    let totalSize = 0;
    const invalidFiles: string[] = [];
    
    for (const file of files) {
      fileInfo.push({
        name: file.name,
        size: file.size,
        type: file.type,
      });
      
      if (file.type !== 'application/pdf') {
        invalidFiles.push(`${file.name} (type: ${file.type})`);
      }
      
      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} (size: ${(file.size / 1024 / 1024).toFixed(2)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }
      
      totalSize += file.size;
    }
    
    console.log(`[${requestId}] File info:`, JSON.stringify(fileInfo, null, 2));
    console.log(`[${requestId}] Total size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    if (invalidFiles.length > 0) {
      console.log(`[${requestId}] Validation failed: Invalid files`, invalidFiles);
      return NextResponse.json(
        { 
          error: 'Invalid files detected',
          details: invalidFiles 
        },
        { status: 400 }
      );
    }
    
    if (totalSize > MAX_TOTAL_SIZE) {
      console.log(`[${requestId}] Validation failed: Total size too large (${(totalSize / 1024 / 1024).toFixed(2)}MB > ${MAX_TOTAL_SIZE / 1024 / 1024}MB)`);
      return NextResponse.json(
        { error: `Total file size exceeds maximum allowed size of ${MAX_TOTAL_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }
    
    // Convert files to ArrayBuffers with timeout
    const bufferStart = Date.now();
    console.log(`[${requestId}] Starting to convert ${files.length} files to ArrayBuffers...`);
    
    const buffers = await Promise.all(
      files.map(async (file, index) => {
        const fileStart = Date.now();
        const buffer = await file.arrayBuffer();
        console.log(`[${requestId}] File ${index + 1}/${files.length} (${file.name}, ${(file.size / 1024 / 1024).toFixed(2)}MB) converted in ${Date.now() - fileStart}ms`);
        return buffer;
      })
    );
    
    console.log(`[${requestId}] All files converted to ArrayBuffers in ${Date.now() - bufferStart}ms`);
    console.log(`[${requestId}] Total buffer size: ${(buffers.reduce((sum, b) => sum + b.byteLength, 0) / 1024 / 1024).toFixed(2)}MB`);
    
    // Check if we're approaching timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > FUNCTION_TIMEOUT) {
      console.log(`[${requestId}] Timeout warning: ${elapsed}ms elapsed, approaching ${FUNCTION_TIMEOUT}ms limit`);
      return NextResponse.json(
        { error: 'Request is taking too long. Please try with smaller files or fewer files.' },
        { status: 408 }
      );
    }
    
    // Merge PDFs with timeout
    const mergeStart = Date.now();
    console.log(`[${requestId}] Starting PDF merge...`);
    
    const mergedPdf = await Promise.race([
      mergePDFs(buffers),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Merge operation timed out')), FUNCTION_TIMEOUT - elapsed)
      ),
    ]);
    
    const mergeTime = Date.now() - mergeStart;
    console.log(`[${requestId}] PDF merge completed in ${mergeTime}ms`);
    console.log(`[${requestId}] Merged PDF size: ${(mergedPdf.length / 1024 / 1024).toFixed(2)}MB`);
    
    const totalTime = Date.now() - startTime;
    console.log(`[${requestId}] Total request time: ${totalTime}ms`);
    
    // Return merged PDF as response (convert Uint8Array to Buffer)
    return new NextResponse(Buffer.from(mergedPdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="merged.pdf"',
        'X-Request-ID': requestId,
        'X-Processing-Time': `${totalTime}ms`,
      },
    });
  } catch (error) {
    const totalTime = Date.now() - startTime;
    
    // Log detailed error for debugging
    console.error(`[${requestId}] Error merging PDFs after ${totalTime}ms:`, error);
    
    if (error instanceof Error) {
      console.error(`[${requestId}] Error name: ${error.name}`);
      console.error(`[${requestId}] Error message: ${error.message}`);
      console.error(`[${requestId}] Error stack:`, error.stack);
    }
    
    // Return error response with request ID for debugging
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred while merging PDFs';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        requestId,
        processingTime: `${totalTime}ms`,
      },
      { status: 500 }
    );
  }
}

