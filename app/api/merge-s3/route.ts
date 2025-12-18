import { NextRequest, NextResponse } from 'next/server';
import { mergePDFs } from '@/lib/pdf-processor';
import { downloadFromS3, deleteMultipleFromS3 } from '@/lib/s3-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * Merge PDFs from S3
 * POST body: { keys: string[] } - S3 keys of files to merge
 * Returns: Merged PDF as Base64
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `merge-s3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}] MERGE S3 REQUEST INITIATED`);
  console.error(`[${requestId}] MERGE S3 REQUEST INITIATED`);
  
  const s3Keys: string[] = [];
  
  try {
    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys) || keys.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 S3 keys are required' },
        { status: 400 }
      );
    }

    s3Keys.push(...keys);
    console.log(`[${requestId}] Received ${keys.length} S3 keys to merge`);

    // Download files from S3
    console.log(`[${requestId}] Downloading files from S3...`);
    const downloadStart = Date.now();
    
    const buffers = await Promise.all(
      keys.map(async (key: string, index: number) => {
        const fileStart = Date.now();
        const buffer = await downloadFromS3(key);
        console.log(`[${requestId}] Downloaded file ${index + 1}/${keys.length} (${key}) in ${Date.now() - fileStart}ms, size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
        return buffer;
      })
    );
    
    console.log(`[${requestId}] All files downloaded in ${Date.now() - downloadStart}ms`);

    // Merge PDFs
    console.log(`[${requestId}] Starting PDF merge...`);
    const mergeStart = Date.now();
    const mergedPdf = await mergePDFs(buffers);
    const mergeTime = Date.now() - mergeStart;
    console.log(`[${requestId}] PDF merge completed in ${mergeTime}ms. Size: ${(mergedPdf.length / 1024 / 1024).toFixed(2)}MB`);

    // Clean up uploaded files from S3
    console.log(`[${requestId}] Cleaning up S3 files...`);
    await deleteMultipleFromS3(keys);
    console.log(`[${requestId}] Cleanup completed`);

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
    // Clean up on error
    if (s3Keys.length > 0) {
      console.log(`[${requestId}] Cleaning up S3 files after error...`);
      await deleteMultipleFromS3(s3Keys).catch(console.error);
    }

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

