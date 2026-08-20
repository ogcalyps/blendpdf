import { NextRequest, NextResponse } from 'next/server';
import { mergePDFs } from '@/lib/pdf-processor';
import { downloadFromS3, deleteMultipleFromS3 } from '@/lib/s3-client';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MIN_KEYS = 2;
const MAX_KEYS = 20;

/**
 * Only accept keys shaped exactly like the ones /api/merge-upload generates:
 * uploads/<timestamp>-<random id or uuid>-<sanitized filename>
 * This prevents clients from pointing the merge at arbitrary S3 objects.
 */
const UPLOAD_KEY_PATTERN = /^uploads\/\d{10,16}-[a-z0-9-]{1,36}-[A-Za-z0-9._-]{1,100}$/;

/**
 * Merge PDFs from S3
 * POST body: { keys: string[] } - S3 keys of files to merge
 * Returns: Merged PDF as Base64
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `merge-s3-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.log(`[${requestId}] MERGE S3 REQUEST INITIATED`);
  
  // Rate limiting: 30 merges per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 30, // 30 merges per 15 minutes
  });

  if (!rateLimit.allowed) {
    console.warn(`[${requestId}] Rate limit exceeded for IP: ${getClientIP(request)}`);
    return NextResponse.json(
      {
        error: 'Too many merge requests. Please wait a few minutes before trying again.',
        requestId,
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '30',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }
  
  const s3Keys: string[] = [];
  
  try {
    const body = await request.json();
    const { keys } = body;

    if (!keys || !Array.isArray(keys) || keys.length < MIN_KEYS) {
      return NextResponse.json(
        {
          error: 'At least 2 PDF files are required to merge. Please upload multiple files.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (keys.length > MAX_KEYS) {
      return NextResponse.json(
        {
          error: `Too many files. Maximum ${MAX_KEYS} files can be merged at once. Please split your files into smaller batches.`,
          requestId,
        },
        { status: 400 }
      );
    }

    const invalidKeys = keys.filter(
      (key: unknown) => typeof key !== 'string' || !UPLOAD_KEY_PATTERN.test(key)
    );
    if (invalidKeys.length > 0) {
      console.warn(`[${requestId}] Rejected ${invalidKeys.length} invalid key(s)`);
      return NextResponse.json(
        {
          error: 'Invalid file references. Please upload your files again.',
          requestId,
        },
        { status: 400 }
      );
    }

    s3Keys.push(...keys);
    console.log(`[${requestId}] Received ${keys.length} S3 keys to merge`);

    // DEV mode fallback: Use temp filesystem instead of S3
    const isDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;
    
    let buffers: ArrayBuffer[];
    
    if (isDev) {
      console.log(`[${requestId}] DEV MODE: Reading files from temp directory...`);
      const downloadStart = Date.now();
      
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      const tempDir = tmpdir();
      
      buffers = await Promise.all(
        keys.map(async (key: string, index: number) => {
          const fileStart = Date.now();
          // Convert S3 key to temp file path
          const filePath = join(tempDir, key.replace(/\//g, '_'));
          
          try {
            const buffer = await readFile(filePath);
            console.log(`[${requestId}] DEV MODE: Read file ${index + 1}/${keys.length} (${key}) from temp in ${Date.now() - fileStart}ms, size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
          } catch (fileError) {
            // If file not found in temp, try S3 (might be a real S3 key)
            console.log(`[${requestId}] DEV MODE: File not in temp, trying S3...`);
            try {
              const buffer = await downloadFromS3(key);
              return buffer;
            } catch (s3Error) {
              throw new Error(`File not found: ${key}. Error: ${fileError instanceof Error ? fileError.message : 'Unknown'}`);
            }
          }
        })
      );
      
      console.log(`[${requestId}] DEV MODE: All files read in ${Date.now() - downloadStart}ms`);
    } else {
      // Download files from S3
      console.log(`[${requestId}] Downloading files from S3...`);
      const downloadStart = Date.now();
      
      buffers = await Promise.all(
        keys.map(async (key: string, index: number) => {
          const fileStart = Date.now();
          const buffer = await downloadFromS3(key);
          console.log(`[${requestId}] Downloaded file ${index + 1}/${keys.length} (${key}) in ${Date.now() - fileStart}ms, size: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
          return buffer;
        })
      );
      
      console.log(`[${requestId}] All files downloaded in ${Date.now() - downloadStart}ms`);
    }

    // Merge PDFs
    console.log(`[${requestId}] Starting PDF merge...`);
    const mergeStart = Date.now();
    const mergedPdf = await mergePDFs(buffers);
    const mergeTime = Date.now() - mergeStart;
    console.log(`[${requestId}] PDF merge completed in ${mergeTime}ms. Size: ${(mergedPdf.length / 1024 / 1024).toFixed(2)}MB`);

    // Clean up uploaded files from S3 (or temp directory in DEV)
    console.log(`[${requestId}] Cleaning up files...`);
    if (isDev) {
      const { unlink } = await import('fs/promises');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      const tempDir = tmpdir();
      
      await Promise.all(
        keys.map(async (key: string) => {
          const filePath = join(tempDir, key.replace(/\//g, '_'));
          try {
            await unlink(filePath);
          } catch (error) {
            // Ignore cleanup errors
          }
        })
      );
      console.log(`[${requestId}] DEV MODE: Cleanup completed`);
    } else {
      await deleteMultipleFromS3(keys);
      console.log(`[${requestId}] Cleanup completed`);
    }

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
      const isDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;
      console.log(`[${requestId}] Cleaning up files after error...`);
      
      if (isDev) {
        const { unlink } = await import('fs/promises');
        const { join } = await import('path');
        const { tmpdir } = await import('os');
        const tempDir = tmpdir();
        
        await Promise.all(
          s3Keys.map(async (key: string) => {
            const filePath = join(tempDir, key.replace(/\//g, '_'));
            try {
              await unlink(filePath);
            } catch {
              // Ignore cleanup errors
            }
          })
        ).catch(console.error);
      } else {
        await deleteMultipleFromS3(s3Keys).catch(console.error);
      }
    }

    const totalTime = Date.now() - startTime;
    console.error(`[${requestId}] Error after ${totalTime}ms:`, error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Failed to merge PDFs. Please try again.';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Merge operation timed out. The files may be too large or complex. Please try with smaller files.';
        statusCode = 408;
      } else if (error.message.includes('corrupt') || error.message.includes('invalid')) {
        errorMessage = 'One or more PDF files are corrupted or invalid. Please check your files and try again.';
        statusCode = 400;
      } else if (error.message.includes('S3') || error.message.includes('bucket') || error.message.includes('credentials')) {
        // In DEV mode, if it's a credentials error, provide a helpful message
        const isDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;
        if (isDev && error.message.includes('credentials')) {
          errorMessage = 'File storage service is not configured in DEV mode. The system should have automatically used a fallback.';
        } else {
          errorMessage = 'File storage service is temporarily unavailable. Please try again in a few moments.';
        }
        statusCode = 503;
      } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
        errorMessage = 'Files are too large to process. Please try with smaller files or split them into smaller batches.';
        statusCode = 413;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        requestId,
        processingTime: `${totalTime}ms`,
        // Don't expose internal errors to users
        ...(process.env.NODE_ENV === 'development' && { details: error instanceof Error ? error.stack : String(error) }),
      },
      { status: statusCode }
    );
  }
}


