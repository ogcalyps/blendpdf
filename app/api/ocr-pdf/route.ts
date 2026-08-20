import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/cloudwatch-logger';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { toHeaderSafeFilename } from '@/lib/pdf-processor';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';
// OCR is by far the slowest tool on the box (~1-2s/page, up to 50 pages).
export const maxDuration = 300;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PAGES = 50;
const OCR_TIMEOUT_MS = 240_000;

// Only these tesseract language packs are installed on the server
// (see scripts/provision-server.sh). The languages string ends up on an
// ocrmypdf command line, so it is strictly allowlisted.
const ALLOWED_LANGUAGES = ['ara', 'eng', 'fra'] as const;

/**
 * Validate a user-supplied languages string like "ara+eng".
 * Must be a +-joined, non-empty, duplicate-free subset of ALLOWED_LANGUAGES.
 */
function isValidLanguages(languages: string): boolean {
  const parts = languages.split('+');
  if (parts.length === 0 || parts.length > ALLOWED_LANGUAGES.length) return false;
  const seen = new Set<string>();
  for (const part of parts) {
    if (!(ALLOWED_LANGUAGES as readonly string[]).includes(part)) return false;
    if (seen.has(part)) return false;
    seen.add(part);
  }
  return true;
}

// Build a PATH that covers the usual install locations (mirrors word-to-pdf).
function buildPath(): string {
  const commonPaths = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
  ];
  const pathParts = (process.env.PATH || '').split(':').filter(p => p);
  return [...new Set([...commonPaths, ...pathParts])].join(':');
}

// ocrmypdf detection is memoized at module scope: the binary does not
// appear/disappear between requests, so exec-ing `which` per request is
// wasted latency. A failed lookup is cached too (the dev machine typically
// has no ocrmypdf) so every request does not shell out just to fail.
let ocrmypdfPathPromise: Promise<string | null> | null = null;

function getOcrmypdfPath(): Promise<string | null> {
  if (!ocrmypdfPathPromise) {
    ocrmypdfPathPromise = detectOcrmypdf();
  }
  return ocrmypdfPathPromise;
}

async function detectOcrmypdf(): Promise<string | null> {
  try {
    const { stdout } = await execAsync('which ocrmypdf', {
      timeout: 10000,
      env: { ...process.env, PATH: buildPath() },
    });
    const path = stdout.trim();
    return path || null;
  } catch {
    return null;
  }
}

// SINGLE-JOB QUEUE: ocrmypdf is CPU/RAM heavy, so only one process runs at a
// time. Each request chains onto the previous job's settled promise; anything
// beyond a short backlog is rejected up front with BUSY.
const MAX_QUEUED_JOBS = 3;
let jobsInQueue = 0;
let queueTail: Promise<void> = Promise.resolve();

function enqueueOcrJob<T>(job: () => Promise<T>): Promise<T> {
  jobsInQueue++;
  const result = queueTail.then(job);
  // The tail must never reject, or the whole queue would stall.
  queueTail = result.then(
    () => undefined,
    () => undefined
  ).then(() => {
    jobsInQueue--;
  });
  return result;
}

interface OcrError extends Error {
  errorCode?: string;
}

function ocrError(message: string, errorCode: string): OcrError {
  const error = new Error(message) as OcrError;
  error.errorCode = errorCode;
  return error;
}

async function runOcr(
  pdfBuffer: Buffer,
  languages: string,
  mode: 'searchable' | 'redo',
  requestId: string
): Promise<Buffer> {
  const ocrmypdfPath = await getOcrmypdfPath();
  if (!ocrmypdfPath) {
    // Should have been caught before enqueueing; defensive double-check.
    throw ocrError('OCR is temporarily unavailable.', 'ENGINE_UNAVAILABLE');
  }

  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const outputPath = join(tempDir, `${inputId}_ocr.pdf`);

  try {
    await writeFile(inputPath, pdfBuffer);

    // execFile with an argv array (never a shell string): the languages value
    // is user-influenced even after allowlisting.
    const args = [
      '-l', languages,
      mode === 'redo' ? '--redo-ocr' : '--skip-text',
      '--output-type', 'pdf',
      '--optimize', '0',
      inputPath,
      outputPath,
    ];

    logger.info(`[ocr-pdf] Running ocrmypdf`, { languages, mode }, requestId);

    try {
      await execFileAsync(ocrmypdfPath, args, {
        timeout: OCR_TIMEOUT_MS,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PATH: buildPath() },
      });
    } catch (execError) {
      const err = execError as Error & { code?: number | string; stderr?: string; killed?: boolean };
      // ocrmypdf exit code 6 = PriorOcrFoundError: every page already has a
      // text layer, so --skip-text found nothing to do.
      if (err.code === 6) {
        throw ocrError(
          'Every page in this PDF already has a text layer, so there is nothing to OCR. If the existing text is wrong, retry with the re-OCR option.',
          'ALREADY_HAS_TEXT'
        );
      }
      logger.error('[ocr-pdf] ocrmypdf failed', {
        exitCode: err.code,
        killed: err.killed,
        stderr: typeof err.stderr === 'string' ? err.stderr.slice(0, 2000) : undefined,
      }, requestId);
      throw new Error('OCR processing failed. The file may be damaged or use an unsupported scan format.');
    }

    return await readFile(outputPath);
  } finally {
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}

export async function POST(request: NextRequest) {
  const requestId = `ocr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: OCR is the heaviest tool on the box, so the tightest limit.
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
  });

  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { ip: getClientIP(request) }, requestId);
    return NextResponse.json(
      {
        error: 'Too many OCR requests. Please wait a few minutes before trying again.',
        requestId,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const languages = (formData.get('languages') as string | null) || 'eng';
    const mode = (formData.get('mode') as string) === 'redo' ? 'redo' : 'searchable';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Please select a PDF to OCR.', requestId },
        { status: 400 }
      );
    }

    if (!isValidLanguages(languages)) {
      return NextResponse.json(
        {
          error: 'Invalid languages. Supported OCR languages are Arabic (ara), English (eng), and French (fra), joined with "+".',
          errorCode: 'INVALID_LANGUAGES',
          requestId,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size limit is 50MB. Try our Compress PDF tool first.',
          errorCode: 'FILE_TOO_LARGE',
          requestId,
        },
        { status: 400 }
      );
    }

    if (buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-') {
      return NextResponse.json(
        { error: "This file doesn't appear to be a valid PDF.", requestId },
        { status: 400 }
      );
    }

    // Inspect the PDF before spending OCR time on it.
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

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

    const pageCount = pdfDoc.getPageCount();
    if (pageCount > MAX_PAGES) {
      return NextResponse.json(
        {
          error: `This PDF has ${pageCount} pages. OCR is limited to ${MAX_PAGES} pages so processing stays reliable — split the file first and OCR the parts separately.`,
          errorCode: 'PAGE_LIMIT',
          requestId,
        },
        { status: 400 }
      );
    }

    // Engine check before queueing: the dev machine has no ocrmypdf, and on
    // the server a missing binary should fail fast, not after waiting in line.
    const ocrmypdfPath = await getOcrmypdfPath();
    if (!ocrmypdfPath) {
      logger.error('[ocr-pdf] ocrmypdf binary not found', {}, requestId);
      return NextResponse.json(
        {
          error: 'OCR is temporarily unavailable. Please try again later.',
          errorCode: 'ENGINE_UNAVAILABLE',
          requestId,
        },
        { status: 503 }
      );
    }

    // Backlog check: one job runs at a time; refuse to queue more than a few.
    if (jobsInQueue > MAX_QUEUED_JOBS) {
      logger.warn('[ocr-pdf] Queue full, rejecting request', { jobsInQueue }, requestId);
      return NextResponse.json(
        {
          error: 'The OCR service is busy right now. Please try again in a minute.',
          errorCode: 'BUSY',
          requestId,
        },
        {
          status: 429,
          headers: { 'Retry-After': '60' },
        }
      );
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('OCR PDF started', {
      fileSize: `${fileSizeMB}MB`,
      fileName: file.name,
      pageCount,
      languages,
      mode,
      jobsInQueue,
    }, requestId);

    const startedAt = Date.now();
    const ocredPdf = await enqueueOcrJob(() => runOcr(buffer, languages, mode, requestId));

    const outputSizeMB = (ocredPdf.length / 1024 / 1024).toFixed(2);
    logger.info('OCR PDF completed', {
      inputSize: `${fileSizeMB}MB`,
      outputSize: `${outputSizeMB}MB`,
      pageCount,
      durationMs: Date.now() - startedAt,
    }, requestId);

    const baseName = file.name.replace(/\.pdf$/i, '');
    const outputFilename = toHeaderSafeFilename(`ocr-${baseName}.pdf`, 'ocr-document.pdf');

    return new NextResponse(new Uint8Array(ocredPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outputFilename}"; filename*=UTF-8''${encodeURIComponent(`ocr-${baseName}.pdf`)}`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    const err = error as OcrError;

    if (err.errorCode === 'ALREADY_HAS_TEXT') {
      return NextResponse.json(
        { error: err.message, errorCode: 'ALREADY_HAS_TEXT', requestId },
        { status: 400 }
      );
    }
    if (err.errorCode === 'ENGINE_UNAVAILABLE') {
      return NextResponse.json(
        { error: 'OCR is temporarily unavailable. Please try again later.', errorCode: 'ENGINE_UNAVAILABLE', requestId },
        { status: 503 }
      );
    }

    logger.error('OCR PDF failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    }, requestId);

    return NextResponse.json(
      {
        error: err instanceof Error && err.message ? err.message : 'Failed to OCR the PDF.',
        requestId,
      },
      { status: 500 }
    );
  }
}
