import { NextRequest, NextResponse } from 'next/server';
import { access, readFile, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { contentDisposition } from '@/lib/pdf-processor';
import { inspectPdf } from '@/lib/pdf-validation';
import { runProcess, withScratchDir } from '@/lib/run-process';
import { DEFAULT_PDFA_LEVEL, MAX_LISTED_PAGES, isPdfaLevel, pdfaHeaders, readVeraPdfReport, type PdfaCheck, type PdfaLevel } from '@/lib/pdfa';
import { flattenedPages, prepareForPdfa1, type Pdfa1Preparation } from '@/lib/pdfa-pages';

export const runtime = 'nodejs';
// Ghostscript rewrites every page, then veraPDF reads it all back.
export const maxDuration = 300;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB, like every server tool
const CONVERT_TIMEOUT_MS = 180_000;
const CHECK_TIMEOUT_MS = 90_000;
// veraPDF is a JVM on a 2 GB box that also runs the app and OCR: cap its heap.
const VERAPDF_JAVA_OPTS = '-Xmx448m -XX:+UseSerialGC';

/**
 * Ghostscript, through ocrmypdf, makes the PDF/A: ocrmypdf sets up the
 * output intent, XMP metadata and font embedding that Ghostscript alone gets
 * wrong. No OCR: --skip-text leaves pages with text alone and a timeout of 0
 * skips tesseract on the rest, so a scan comes back as the same pictures.
 *
 * - RGB: Chrome and Google Docs embed image ICC profiles veraPDF rejects
 *   (6.2.4.2); converting colour to RGB under the sRGB output intent fixes
 *   them, and it is what every tested file passed with (1b, 2b, 3b).
 * - lossless: images are not re-encoded as JPEG.
 * - --optimize 0: no other changes to the content.
 */
function ocrmypdfArgs(level: PdfaLevel, input: string, output: string): string[] {
  return [
    '--skip-text',
    '--tesseract-timeout', '0',
    '--output-type', `pdfa-${level[0]}`,
    '--optimize', '0',
    '--color-conversion-strategy', 'RGB',
    '--pdfa-image-compression', 'lossless',
    input,
    output,
  ];
}

// Same install locations as the other converters (see app/api/ocr-pdf).
function buildPath(): string {
  const commonPaths = ['/opt/verapdf', '/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin'];
  const pathParts = (process.env.PATH || '').split(':').filter((p) => p);
  return [...new Set([...commonPaths, ...pathParts])].join(':');
}

/** The first of these that can run. */
async function findExecutable(name: string): Promise<string | null> {
  for (const dir of buildPath().split(':')) {
    const candidate = join(dir, name);
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // next
    }
  }
  return null;
}

// Found once and kept. A miss is looked up again next time (a few stat calls),
// so installing veraPDF on the box takes effect without a restart.
let ocrmypdfPath: string | null = null;
let verapdfPath: string | null = null;
const getOcrmypdfPath = async () => (ocrmypdfPath ??= await findExecutable('ocrmypdf'));
const getVerapdfPath = async () => (verapdfPath ??= await findExecutable('verapdf'));

// SINGLE-JOB QUEUE, as in ocr-pdf: Ghostscript then a JVM, one file at a time.
const MAX_QUEUED_JOBS = 3;
let jobsInQueue = 0;
let queueTail: Promise<void> = Promise.resolve();

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  jobsInQueue++;
  const result = queueTail.then(job);
  queueTail = result.then(() => undefined, () => undefined).then(() => {
    jobsInQueue--;
  });
  return result;
}

interface PdfaError extends Error {
  errorCode?: string;
}

function pdfaError(message: string, errorCode: string): PdfaError {
  return Object.assign(new Error(message), { errorCode });
}

type Verdict = Omit<PdfaCheck, 'flattenedCount' | 'flattenedPages'>;

/** veraPDF's verdict on the file we made. Its failure never costs the visitor the file: it comes back unchecked. */
async function checkWithVeraPdf(outputPath: string, level: PdfaLevel, scratch: string, requestId: string): Promise<Verdict> {
  const unchecked: Verdict = { level, status: 'unchecked', validator: null, failedRules: [] };
  const verapdf = await getVerapdfPath();
  if (!verapdf) {
    logger.error('[pdf-to-pdfa] verapdf not found; sending the file unchecked', {}, requestId);
    return unchecked;
  }

  let result: Awaited<ReturnType<typeof runProcess>>;
  try {
    result = await runProcess(verapdf, ['--format', 'json', '--flavour', level, '--maxfailuresdisplayed', '1', outputPath], {
      timeoutMs: CHECK_TIMEOUT_MS,
      maxOutputBytes: 4 * 1024 * 1024,
      env: { ...process.env, PATH: buildPath(), TMPDIR: scratch, JAVA_OPTS: VERAPDF_JAVA_OPTS },
    });
  } catch (error) {
    // It was there once and can't start now (removed, or no longer executable): look again next time.
    verapdfPath = null;
    logger.error('[pdf-to-pdfa] verapdf could not start; sending the file unchecked', { error: error instanceof Error ? error.message : String(error) }, requestId);
    return unchecked;
  }
  const { stdout, stderr, exitCode, timedOut } = result;

  let report: ReturnType<typeof readVeraPdfReport> = null;
  try {
    report = timedOut ? null : readVeraPdfReport(JSON.parse(stdout));
  } catch {
    report = null;
  }
  if (!report) {
    logger.error('[pdf-to-pdfa] veraPDF gave no verdict', { exitCode, timedOut, stderr: stderr.slice(0, 1000) }, requestId);
    return unchecked;
  }
  return { level, status: report.compliant ? 'pass' : 'fail', validator: report.validator, failedRules: report.failedRules };
}

/** Pages Ghostscript turned into pictures. A count that can't be made is left out, never guessed. */
async function countFlattened(prepared: Pdfa1Preparation, pdf: Buffer, requestId: string): Promise<number[]> {
  try {
    const pages = await flattenedPages(prepared.fontPages, pdf);
    if (pages.length > 0 || prepared.cleanedPages > 0) {
      logger.info('[pdf-to-pdfa] PDF/A-1 pages', { cleanedPages: prepared.cleanedPages, flattened: pages.length }, requestId);
    }
    return pages;
  } catch (error) {
    logger.warn('[pdf-to-pdfa] could not count flattened pages', { error: error instanceof Error ? error.message : String(error) }, requestId);
    return [];
  }
}

async function convertToPdfa(pdfBuffer: Buffer, level: PdfaLevel, requestId: string): Promise<{ pdf: Buffer; check: PdfaCheck }> {
  const ocrmypdf = await getOcrmypdfPath();
  if (!ocrmypdf) throw pdfaError('PDF/A conversion is temporarily unavailable.', 'ENGINE_UNAVAILABLE');

  // Input, output and every temp file of Ghostscript and the JVM live in one
  // private folder, removed once both programs (and their children) are gone.
  return withScratchDir('pdfa-', async (scratch) => {
    const inputPath = join(scratch, 'input.pdf');
    const outputPath = join(scratch, 'output.pdf');
    // PDF/A-1 only (lib/pdfa-pages.ts). If it fails, the original is converted and nothing is counted.
    let prepared: Pdfa1Preparation | null = null;
    if (level === '1b') {
      try {
        prepared = await prepareForPdfa1(pdfBuffer);
      } catch (error) {
        logger.warn('[pdf-to-pdfa] could not prepare the file for PDF/A-1; converting it as is', { error: error instanceof Error ? error.message : String(error) }, requestId);
      }
    }
    await writeFile(inputPath, prepared?.pdf ?? pdfBuffer);

    const { stderr, exitCode, signal, timedOut } = await runProcess(ocrmypdf, ocrmypdfArgs(level, inputPath, outputPath), {
      timeoutMs: CONVERT_TIMEOUT_MS,
      env: { ...process.env, PATH: buildPath(), TMPDIR: scratch },
    });

    if (timedOut) throw pdfaError('Converting this PDF took too long.', 'TIMEOUT');
    if (exitCode !== 0) {
      // ocrmypdf refuses to rewrite a signed PDF: the rewrite would break the signature.
      if (/digital signature/i.test(stderr)) throw pdfaError('This PDF is digitally signed.', 'SIGNED_PDF');
      logger.error('[pdf-to-pdfa] ocrmypdf failed', { exitCode, signal, cleanedPages: prepared?.cleanedPages ?? 0, stderr: stderr.slice(0, 2000) }, requestId);
      throw pdfaError('Conversion failed.', signal !== null ? 'CONVERTER_CRASHED' : 'CONVERSION_FAILED');
    }

    const pdf = await readFile(outputPath);
    const flattened = prepared ? await countFlattened(prepared, pdf, requestId) : [];
    const verdict = await checkWithVeraPdf(outputPath, level, scratch, requestId);
    return { pdf, check: { ...verdict, flattenedCount: flattened.length, flattenedPages: flattened.slice(0, MAX_LISTED_PAGES) } };
  });
}

export async function POST(request: NextRequest) {
  const requestId = `pdfa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });
  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { ip: getClientIP(request) }, requestId);
    return NextResponse.json(
      { error: 'Too many PDF/A conversions. Please wait a few minutes before trying again.', requestId },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      },
    );
  }

  // Every rejection is logged, so the back office can tell which branch a visitor hit.
  const reject = (status: number, errorCode: string, error: string, detail?: Record<string, unknown>) => {
    logger.warn('[pdf-to-pdfa] Request rejected', { errorCode, status, ...detail }, requestId);
    return NextResponse.json({ error, errorCode, requestId }, { status });
  };

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const rawLevel = formData.get('level') ?? DEFAULT_PDFA_LEVEL;

    if (!file) return reject(400, 'NO_FILE', 'No file provided. Please select a PDF to convert.');
    if (!isPdfaLevel(rawLevel)) return reject(400, 'INVALID_LEVEL', 'Choose PDF/A-1b, PDF/A-2b or PDF/A-3b.');
    const level = rawLevel;

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_FILE_SIZE) {
      return reject(400, 'FILE_TOO_LARGE', 'File size limit is 50MB. Try our Compress PDF tool first.', {
        sizeMB: (buffer.length / 1024 / 1024).toFixed(2),
      });
    }

    // Magic bytes, a parse that touches every page, and the encrypted check:
    // PDF/A forbids encryption, so a locked file has to be unlocked first.
    const inspection = await inspectPdf(buffer);
    if (!inspection.ok) {
      const { errorCode, message, detail } = inspection.rejection;
      return reject(400, errorCode, message, detail);
    }
    const { pageCount } = inspection.value;

    if (!(await getOcrmypdfPath())) {
      logger.error('[pdf-to-pdfa] ocrmypdf binary not found', {}, requestId);
      return NextResponse.json(
        { error: 'PDF/A conversion is temporarily unavailable. Please try again later.', errorCode: 'ENGINE_UNAVAILABLE', requestId },
        { status: 503 },
      );
    }

    if (jobsInQueue > MAX_QUEUED_JOBS) {
      logger.warn('[pdf-to-pdfa] Queue full, rejecting request', { jobsInQueue }, requestId);
      return NextResponse.json(
        { error: 'The converter is busy right now. Please try again in a minute.', errorCode: 'BUSY', requestId },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    logger.info('PDF to PDF/A started', { ...fileLogMeta(file), pageCount, level, jobsInQueue }, requestId);
    const startedAt = Date.now();
    const { pdf, check } = await enqueue(() => convertToPdfa(buffer, level, requestId));
    logger.info(
      'PDF to PDF/A completed',
      {
        inputSize: `${(buffer.length / 1024 / 1024).toFixed(2)}MB`,
        outputSize: `${(pdf.length / 1024 / 1024).toFixed(2)}MB`,
        pageCount,
        level,
        check: check.status,
        failedRules: check.failedRules,
        flattenedPages: check.flattenedCount,
        durationMs: Date.now() - startedAt,
      },
      requestId,
    );

    const baseName = file.name.replace(/\.pdf$/i, '');
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(`${baseName}_pdfa.pdf`, 'document_pdfa.pdf'),
        'X-Request-ID': requestId,
        ...pdfaHeaders(check),
      },
    });
  } catch (error) {
    const err = error as PdfaError;

    if (err.errorCode === 'SIGNED_PDF') {
      return reject(
        400,
        'SIGNED_PDF',
        'This PDF is digitally signed. Turning it into PDF/A rewrites the file, which would break the signature, so convert the unsigned version and sign it after.',
      );
    }
    if (err.errorCode === 'ENGINE_UNAVAILABLE') {
      return NextResponse.json(
        { error: 'PDF/A conversion is temporarily unavailable. Please try again later.', errorCode: 'ENGINE_UNAVAILABLE', requestId },
        { status: 503 },
      );
    }
    if (err.errorCode === 'TIMEOUT') {
      logger.error('PDF to PDF/A failed', { errorCode: 'TIMEOUT' }, requestId);
      return NextResponse.json(
        { error: 'This PDF takes too long to convert in one go. Split it into smaller parts and convert them one at a time.', errorCode: 'CONVERSION_TIMEOUT', requestId },
        { status: 504 },
      );
    }

    logger.error(
      'PDF to PDF/A failed',
      { error: err instanceof Error ? err.message : 'Unknown error', errorCode: err?.errorCode, stack: err instanceof Error ? err.stack : undefined },
      requestId,
    );
    return NextResponse.json(
      // Never ocrmypdf's or Ghostscript's own text: it names server paths.
      { error: 'We couldn’t turn this PDF into PDF/A. The file may be damaged: try Repair PDF first.', errorCode: 'CONVERSION_FAILED', requestId },
      { status: 500 },
    );
  }
}
