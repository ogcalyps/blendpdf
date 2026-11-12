import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { toHeaderSafeFilename } from '@/lib/pdf-processor';
import { inspectPdf } from '@/lib/pdf-validation';
import { runProcess, withScratchDir } from '@/lib/run-process';
import { OCR_MAX_PAGES } from '@/lib/ocr-limits';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
// OCR is by far the slowest tool on the box (~1-2s/page, up to 50 pages).
export const maxDuration = 300;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PAGES = OCR_MAX_PAGES;
const OCR_TIMEOUT_MS = 240_000;

// Only these tesseract language packs are installed on the server
// (see scripts/provision-server.sh). The languages string ends up on an
// ocrmypdf command line, so it is strictly allowlisted.
const ALLOWED_LANGUAGES = ['ara', 'eng', 'fra', 'spa'] as const;

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

/**
 * The pages ocrmypdf left alone because they already had text. With
 * --skip-text it still exits 0 when that is every page, and sent the file
 * back unchanged as if it had been read; it logs each one as
 * "    3 skipping all processing on this page" (15.2 on the server, 17.x too).
 */
function pagesSkippedForText(stderr: string): number {
  const pages = new Set<string>();
  for (const match of stderr.matchAll(/^\s*(\d+)\s.*skipping all processing on this page/gm)) pages.add(match[1]);
  return pages.size;
}

async function runOcr(
  pdfBuffer: Buffer,
  languages: string,
  mode: 'searchable' | 'redo',
  pageCount: number,
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

    // An argv array (never a shell string): the languages value is
    // user-influenced even after allowlisting.
    const args = [
      '-l', languages,
      mode === 'redo' ? '--redo-ocr' : '--skip-text',
      '--output-type', 'pdf',
      '--optimize', '0',
      inputPath,
      outputPath,
    ];

    logger.info(`[ocr-pdf] Running ocrmypdf`, { languages, mode }, requestId);

    // ocrmypdf runs tesseract and gs underneath, so a timeout has to take the
    // whole process group (lib/run-process.ts), not just ocrmypdf. Its work
    // folder goes in a private TMPDIR that is removed afterwards, because a
    // killed ocrmypdf never gets to clean that up itself.
    const { stderr, exitCode, signal, timedOut } = await withScratchDir('ocr-', (scratch) =>
      runProcess(ocrmypdfPath, args, {
        timeoutMs: OCR_TIMEOUT_MS,
        env: { ...process.env, PATH: buildPath(), TMPDIR: scratch },
      })
    );

    // Every page already has a text layer, so --skip-text found nothing to do
    // (exit code 6, PriorOcrFoundError, in older ocrmypdf; a 0 now).
    if (exitCode === 6 || (exitCode === 0 && mode === 'searchable' && pagesSkippedForText(stderr) >= pageCount)) {
      throw ocrError(
        'Every page in this PDF already has a text layer, so there is nothing to OCR. If the existing text is wrong, retry with the re-OCR option.',
        'ALREADY_HAS_TEXT'
      );
    }
    if (timedOut || exitCode !== 0) {
      // No shell in between, so a native crash shows up as the signal.
      const errorCode = timedOut ? 'TIMEOUT' : signal !== null ? 'CONVERTER_CRASHED' : 'OCR_FAILED';
      logger.error('[ocr-pdf] ocrmypdf failed', {
        errorCode,
        exitCode,
        signal,
        stderr: stderr.slice(0, 2000),
      }, requestId);
      throw ocrError('OCR processing failed. The file may be damaged or use an unsupported scan format.', errorCode);
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

    /**
     * A rejection is a normal outcome, but it still has to be visible: the
     * ocr_pdf errors in GA4 were untriageable because these 400s returned
     * without writing anything to the log, so there was no way to tell which
     * branch a user had hit. Every rejection goes through here.
     */
    const reject = (
      status: number,
      errorCode: string,
      error: string,
      detail?: Record<string, unknown>
    ) => {
      logger.warn('[ocr-pdf] Request rejected', { errorCode, status, ...detail }, requestId);
      return NextResponse.json({ error, errorCode, requestId }, { status });
    };

    if (!file) {
      return reject(400, 'NO_FILE', 'No file provided. Please select a PDF to OCR.');
    }

    if (!isValidLanguages(languages)) {
      return reject(
        400,
        'INVALID_LANGUAGES',
        'Invalid languages. Supported OCR languages are Arabic (ara), English (eng), French (fra) and Spanish (spa), joined with "+".',
        { languages }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.length > MAX_FILE_SIZE) {
      return reject(400, 'FILE_TOO_LARGE', 'File size limit is 50MB. Try our Compress PDF tool first.', {
        sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
      });
    }

    // Shared front door: magic bytes, a parse that also touches getPageCount
    // (pdf-lib is lazy — load() accepts a broken file and getPageCount() is what
    // throws), and the encrypted check.
    const inspection = await inspectPdf(buffer);
    if (!inspection.ok) {
      const { errorCode, message, detail } = inspection.rejection;
      return reject(400, errorCode, message, detail);
    }

    const { pageCount } = inspection.value;
    if (pageCount > MAX_PAGES) {
      return reject(
        400,
        'PAGE_LIMIT',
        `This PDF has ${pageCount} pages. OCR is limited to ${MAX_PAGES} pages so processing stays reliable — split the file first and OCR the parts separately.`,
        { pageCount }
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
      ...fileLogMeta(file),
      pageCount,
      languages,
      mode,
      jobsInQueue,
    }, requestId);

    const startedAt = Date.now();
    const ocredPdf = await enqueueOcrJob(() => runOcr(buffer, languages, mode, pageCount, requestId));

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
        { error: err.message, errorCode: 'ALREADY_HAS_TEXT', requestId }, // leak-guard: authored — thrown by this route, not an engine
        { status: 400 }
      );
    }
    if (err.errorCode === 'ENGINE_UNAVAILABLE') {
      return NextResponse.json(
        { error: 'OCR is temporarily unavailable. Please try again later.', errorCode: 'ENGINE_UNAVAILABLE', requestId },
        { status: 503 }
      );
    }
    // Ran out of time: the same file would time out again, so the visitor is
    // told to split it rather than to retry (lib/ocr-limits.ts). A 5xx like
    // pdf-to-word's CONVERSION_TIMEOUT: the box not keeping up counts as the
    // tool failing in the back office.
    if (err.errorCode === 'TIMEOUT') {
      logger.error('OCR PDF failed', { errorCode: 'TIMEOUT' }, requestId);
      return NextResponse.json(
        {
          error: 'This scan takes too long to read in one go. Split it into smaller parts, about 10 pages each, and OCR them one at a time.',
          errorCode: 'OCR_TIMEOUT',
          requestId,
        },
        { status: 504 }
      );
    }

    logger.error('OCR PDF failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
      errorCode: err?.errorCode,
      stack: err instanceof Error ? err.stack : undefined,
    }, requestId);

    return NextResponse.json(
      {
        // ocrmypdf's stderr reached users through this line.
        error: 'Failed to OCR the PDF. Please try again.',
        errorCode: 'OCR_FAILED',
        requestId,
      },
      { status: 500 }
    );
  }
}
