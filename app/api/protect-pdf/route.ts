import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { contentDisposition } from '@/lib/pdf-processor';
import { inspectPdf } from '@/lib/pdf-validation';

const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';
export const maxDuration = 30;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PASSWORD_LENGTH = 128;

/** Thrown when the qpdf binary is not installed on the host. */
class QpdfNotAvailableError extends Error {
  constructor() {
    super('qpdf binary not found');
    this.name = 'QpdfNotAvailableError';
  }
}

/**
 * Encrypt a PDF with AES-256 using qpdf.
 *
 * The password is passed as a dedicated argv element via execFile (no shell is
 * ever involved), so it cannot be used for command or code injection.
 * qpdf >= 11.7 supports --user-password/--owner-password inside --encrypt,
 * which also handles passwords that start with a dash.
 */
async function protectPdfWithPassword(
  pdfBuffer: Buffer,
  password: string,
  requestId: string
): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const outputPath = join(tempDir, `${inputId}_protected.pdf`);

  try {
    await writeFile(inputPath, pdfBuffer);

    logger.info(`[protect-pdf] Encrypting PDF with qpdf (AES-256): ${inputId}.pdf`, {}, requestId);

    const args = [
      '--encrypt',
      `--user-password=${password}`,
      `--owner-password=${password}`,
      '--bits=256',
      '--',
      inputPath,
      outputPath,
    ];

    try {
      await execFileAsync('qpdf', args, {
        timeout: 60000, // 1 minute
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (execError: any) {
      if (execError?.code === 'ENOENT') {
        throw new QpdfNotAvailableError();
      }
      const stderr: string = execError?.stderr || '';
      logger.error(`[protect-pdf] qpdf failed`, { stderr: stderr.slice(0, 500) }, requestId);
      if (stderr.toLowerCase().includes('password')) {
        throw new Error('This PDF is already password protected. Unlock it first, then protect it with a new password.');
      }
      throw new Error('Failed to encrypt PDF. The file may be corrupted or invalid.');
    }

    const protectedPdf = await readFile(outputPath);
    logger.info(`[protect-pdf] PDF encrypted successfully (AES-256)`, {}, requestId);
    return protectedPdf;
  } finally {
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}

export async function POST(request: NextRequest) {
  const requestId = `protect-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: 20 protections per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  if (!rateLimit.allowed) {
    console.warn(`[${requestId}] Rate limit exceeded for IP: ${getClientIP(request)}`);
    return NextResponse.json(
      {
        error: 'Too many protection requests. Please wait a few minutes before trying again.',
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
    const password = (formData.get('password') as string) || '';

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided. Please select a PDF file to protect.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (!password || password.length < 1) {
      return NextResponse.json(
        {
          error: 'Password is required. Please enter a password to protect your PDF.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (password.length > MAX_PASSWORD_LENGTH) {
      return NextResponse.json(
        {
          error: `Password is too long. Maximum length is ${MAX_PASSWORD_LENGTH} characters.`,
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

    const buffer = Buffer.from(await file.arrayBuffer());

    // File size limit: 50MB
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size limit is 50MB. Try our Compress PDF tool first.', requestId },
        { status: 400 }
      );
    }

    // Shared front door. The magic-bytes check this replaced let a file that
    // starts with %PDF- and is broken after that through to qpdf, which failed
    // as a 500 instead of a 400.
    const inspection = await inspectPdf(buffer);
    if (!inspection.ok) {
      const { errorCode, message, detail } = inspection.rejection;
      logger.warn('[protect-pdf] Request rejected', { errorCode, ...detail }, requestId);
      return NextResponse.json({ error: message, errorCode, requestId }, { status: 400 });
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('Protect PDF started', { ...fileLogMeta(file) }, requestId);

    const protectedPdf = await protectPdfWithPassword(buffer, password, requestId);

    const outputSizeMB = (protectedPdf.length / 1024 / 1024).toFixed(2);
    logger.info('Protect PDF completed successfully', {
      inputSize: `${fileSizeMB}MB`,
      outputSize: `${outputSizeMB}MB`,
    }, requestId);

    return new NextResponse(Buffer.from(protectedPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        // Raw interpolation here was the Arabic-filename 500: a non-ASCII value
        // makes the Response constructor throw ("Cannot convert argument to a
        // ByteString"). contentDisposition emits an ASCII fallback plus RFC 5987.
        'Content-Disposition': contentDisposition(
          file.name.replace(/\.pdf$/i, '_protected.pdf'),
          'protected.pdf'
        ),
        'X-Request-ID': requestId,
      },
    });
  } catch (error: any) {
    if (error instanceof QpdfNotAvailableError) {
      logger.error('[protect-pdf] qpdf is not installed on this host — install qpdf to enable PDF encryption', {}, requestId);
      return NextResponse.json(
        {
          error: 'PDF encryption service is not available. Please contact support.',
          requestId,
        },
        { status: 503 }
      );
    }

    logger.error('Protect PDF failed', { error: error?.message, stack: error?.stack }, requestId);
    // Fixed copy only — the thrown message is internal detail (logged above).
    return NextResponse.json(
      {
        error: 'Failed to protect the PDF. Please try again.',
        errorCode: 'PROCESSING_FAILED',
        requestId,
      },
      { status: 500 }
    );
  }
}
