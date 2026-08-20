import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, getBucketName, deleteStaleUploads } from '@/lib/s3-client';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file
const MAX_TOTAL_SIZE = 100 * 1024 * 1024; // 100MB total
const MAX_FILES = 20; // Maximum number of files
const MIN_FILES = 2; // A merge needs at least 2 files

/**
 * Keep only characters that are safe in an S3 key so the generated keys always
 * match the pattern that /api/merge-s3 validates against.
 */
function sanitizeKeyFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file.pdf';
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 100);
  return safe || 'file.pdf';
}

/**
 * PDF merge flow: upload files to S3 via Next (not Strapi's POST /api/upload).
 * Path is /api/merge-upload so nginx can proxy /api/upload → Strapi for the CMS admin.
 * POST body: FormData with 'files' field — returns { keys: string[] }.
 */
export async function POST(request: NextRequest) {
  const requestId = `merge-upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.log(`[${requestId}] Merge-upload request initiated`);

  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 50,
  });

  if (!rateLimit.allowed) {
    console.warn(`[${requestId}] Rate limit exceeded for IP: ${getClientIP(request)}`);
    return NextResponse.json(
      {
        error: 'Too many upload requests. Please wait a few minutes before trying again.',
        requestId,
        retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '50',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'X-RateLimit-Reset': new Date(rateLimit.resetTime).toISOString(),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }

  const isDev = process.env.NODE_ENV === 'development' || !process.env.AWS_REGION;
  const BUCKET_NAME = getBucketName();
  const hasAwsCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  // Fire-and-forget: clean up abandoned uploads older than 1 hour so the
  // "deleted within 1 hour" privacy promise holds even when merges are abandoned.
  if (!isDev && BUCKET_NAME) {
    void deleteStaleUploads().catch((error) => {
      console.error(`[${requestId}] Stale upload cleanup failed:`, error);
    });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length < MIN_FILES) {
      return NextResponse.json(
        {
          error: 'At least 2 PDF files are required to merge. Please upload multiple files.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          error: `Too many files. Maximum ${MAX_FILES} files can be merged at once. Please split your files into smaller batches.`,
          requestId,
          maxFiles: MAX_FILES,
        },
        { status: 400 }
      );
    }

    // Validate types and sizes BEFORE reading buffers or touching S3
    const invalidFiles: string[] = [];
    let totalSize = 0;

    for (const file of files) {
      const isPdfType = file.type === 'application/pdf';
      const isPdfExtension = /\.pdf$/i.test(file.name);
      if (!isPdfType && !isPdfExtension) {
        invalidFiles.push(`${file.name} (type: ${file.type || 'unknown'})`);
      }

      if (file.size > MAX_FILE_SIZE) {
        invalidFiles.push(`${file.name} (size: ${(file.size / 1024 / 1024).toFixed(2)}MB > ${MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }

      totalSize += file.size;
    }

    if (invalidFiles.length > 0) {
      console.warn(`[${requestId}] Validation failed: invalid files`, invalidFiles);
      return NextResponse.json(
        {
          error: 'Some files are invalid. Please ensure all files are valid PDFs and under 50MB each.',
          requestId,
          details: invalidFiles,
        },
        { status: 400 }
      );
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      console.warn(`[${requestId}] Validation failed: total size ${(totalSize / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_TOTAL_SIZE / 1024 / 1024}MB`);
      return NextResponse.json(
        {
          error: `Total file size is too large. Maximum ${MAX_TOTAL_SIZE / 1024 / 1024}MB total. Your files total ${(totalSize / 1024 / 1024).toFixed(2)}MB. Please reduce the number or size of files.`,
          requestId,
          maxSize: `${MAX_TOTAL_SIZE / 1024 / 1024}MB`,
          currentSize: `${(totalSize / 1024 / 1024).toFixed(2)}MB`,
        },
        { status: 400 }
      );
    }

    // Read buffers once and verify PDF magic bytes before any storage write
    const fileBuffers = await Promise.all(files.map(async (file) => Buffer.from(await file.arrayBuffer())));

    const notPdfContent = files
      .filter((file, index) => {
        const buffer = fileBuffers[index];
        return buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-';
      })
      .map((file) => file.name);

    if (notPdfContent.length > 0) {
      console.warn(`[${requestId}] Validation failed: files without PDF magic bytes`, notPdfContent);
      return NextResponse.json(
        {
          error: "Some files don't appear to be valid PDFs. Please check your files and try again.",
          requestId,
          details: notPdfContent,
        },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] Received ${files.length} files to upload (${(totalSize / 1024 / 1024).toFixed(2)}MB total)`);

    if (isDev && (!BUCKET_NAME || !hasAwsCredentials)) {
      console.log(`[${requestId}] DEV MODE: Using temp filesystem (S3 not configured)`);

      const { writeFile } = await import('fs/promises');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      const { randomUUID } = await import('crypto');

      const tempDir = tmpdir();
      const uploadedKeys: string[] = [];

      await Promise.all(
        files.map(async (file, index) => {
          const key = `uploads/${Date.now()}-${randomUUID()}-${sanitizeKeyFilename(file.name)}`;
          const filePath = join(tempDir, key.replace(/\//g, '_'));

          const buffer = fileBuffers[index];

          await writeFile(filePath, buffer);
          console.log(
            `[${requestId}] DEV MODE: Stored file ${index + 1}/${files.length} (${file.name}) in temp: ${filePath}`
          );

          uploadedKeys.push(key);
        })
      );

      console.log(`[${requestId}] DEV MODE: All ${files.length} files stored in temp directory`);

      return NextResponse.json({
        success: true,
        keys: uploadedKeys,
        requestId,
        devMode: true,
      });
    }

    if (!BUCKET_NAME) {
      console.error(`[${requestId}] S3 bucket not configured`);
      return NextResponse.json(
        {
          error: 'File upload service is temporarily unavailable. Please try again later.',
          requestId,
        },
        { status: 503 }
      );
    }

    const UPLOAD_PREFIX = 'uploads/';
    const uploadedKeys: string[] = [];

    await Promise.all(
      files.map(async (file, index) => {
        const key = `${UPLOAD_PREFIX}${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${sanitizeKeyFilename(file.name)}`;
        const fileStart = Date.now();

        console.log(`[${requestId}] Uploading file ${index + 1}/${files.length} (${file.name}) to S3...`);

        const buffer = fileBuffers[index];

        const command = new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: key,
          Body: buffer,
          ContentType: file.type || 'application/pdf',
          Metadata: {
            // S3 metadata must be ASCII-safe header values (filenames can be Arabic)
            'original-filename': sanitizeKeyFilename(file.name),
          },
        });

        await s3Client.send(command);

        const uploadTime = Date.now() - fileStart;
        console.log(
          `[${requestId}] File ${index + 1} uploaded to S3 in ${uploadTime}ms (${(buffer.length / 1024 / 1024).toFixed(2)}MB)`
        );

        uploadedKeys.push(key);
      })
    );

    console.log(`[${requestId}] All ${files.length} files uploaded successfully`);

    return NextResponse.json({
      success: true,
      keys: uploadedKeys,
      requestId,
    });
  } catch (error) {
    console.error(`[${requestId}] Error uploading files:`, error);

    const isCredentialsError =
      error instanceof Error &&
      (error.message.includes('credentials') ||
        error.message.includes('CredentialsProviderError') ||
        error.message.includes('Could not load credentials'));

    if (isDev && isCredentialsError) {
      console.log(`[${requestId}] DEV MODE: AWS credentials error detected`);
      return NextResponse.json(
        {
          error:
            'AWS credentials not configured in DEV mode. The system should have automatically used a fallback. Please check the server logs.',
          requestId,
          devMode: true,
        },
        { status: 503 }
      );
    }

    let errorMessage = 'Failed to upload files. Please try again.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('S3') || error.message.includes('bucket')) {
        errorMessage = 'File storage service is temporarily unavailable. Please try again in a few moments.';
        statusCode = 503;
      } else if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Upload timed out. The files may be too large. Please try with smaller files.';
        statusCode = 408;
      } else if (error.message.includes('size') || error.message.includes('too large')) {
        errorMessage = 'Files are too large. Maximum file size is 50MB per file.';
        statusCode = 413;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        requestId,
        ...(process.env.NODE_ENV === 'development' && {
          details: error instanceof Error ? error.stack : String(error),
        }),
      },
      { status: statusCode }
    );
  }
}
