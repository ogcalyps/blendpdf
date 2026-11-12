import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { toHeaderSafeFilename } from '@/lib/pdf-processor';
import { hasPdfMagicBytes } from '@/lib/pdf-validation';
import { runProcess } from '@/lib/run-process';

const QPDF_TIMEOUT_MS = 60_000;

/** Something the caller can act on (wrong password, wrong mode) rather than a server fault. */
class UnlockRequestError extends Error {
  readonly status = 400;
}

type UnlockOutcome = {
  pdf: Buffer;
  /** True when there was nothing to remove: the file was never restricted, so `pdf` is the original. */
  noRestrictions: boolean;
};

/** qpdf prints "File is not encrypted" when there is neither an open password nor permission flags. */
async function isUnencrypted(inputPath: string): Promise<boolean> {
  try {
    const { stdout, exitCode } = await runProcess('qpdf', ['--show-encryption', inputPath], { timeoutMs: 10_000 });
    // A non-zero exit usually means an open password blocks inspection; the decrypt step reports that.
    return exitCode === 0 && stdout.includes('not encrypted');
  } catch {
    return false;
  }
}

async function unlockPdfProcess(
  pdfBuffer: Buffer,
  mode: 'remove-restrictions' | 'unlock-password',
  password?: string,
  requestId?: string
): Promise<UnlockOutcome> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const outputPath = join(tempDir, `${inputId}_unlocked.pdf`);

  try {
    await writeFile(inputPath, pdfBuffer);

    logger.info(`[unlock-pdf] Processing PDF: ${inputId}.pdf, mode: ${mode}`, {}, requestId);

    // Stripping restrictions from a file that has none is a no-op, not a failure: hand the
    // original back and let the UI say nothing needed removing.
    if (mode === 'remove-restrictions' && (await isUnencrypted(inputPath))) {
      logger.info(`[unlock-pdf] PDF carries no restrictions; returning it unchanged`, {}, requestId);
      return { pdf: pdfBuffer, noRestrictions: true };
    }

    // An argv array, no shell: the password is passed as-is and never parsed
    // by a shell. Own process group, and this returns only once qpdf has
    // exited, so the finally below cannot race its write (lib/run-process.ts).
    const args =
      mode === 'unlock-password'
        ? ['--decrypt', `--password=${password ?? ''}`, inputPath, outputPath]
        : ['--decrypt', inputPath, outputPath];

    const { stdout, stderr, exitCode, signal, timedOut } = await runProcess('qpdf', args, {
      timeoutMs: QPDF_TIMEOUT_MS,
    });

    if (timedOut) {
      logger.warn(`[unlock-pdf] Timed out; process group killed`, { timeoutMs: QPDF_TIMEOUT_MS }, requestId);
      throw Object.assign(new Error(`qpdf timed out after ${QPDF_TIMEOUT_MS / 1000}s`), { errorCode: 'TIMEOUT' });
    }

    if (exitCode !== 0) {
      if (signal !== null) {
        // A crash, not a verdict on the file or the password.
        throw Object.assign(new Error(`qpdf was killed by ${signal}`), { errorCode: 'CONVERTER_CRASHED' });
      }
      const mentionsPassword =
        stderr.toLowerCase().includes('password') || stdout.toLowerCase().includes('password');

      if (mode === 'unlock-password') {
        if (mentionsPassword) {
          throw new UnlockRequestError('Incorrect password. Please try again.');
        }
        throw new Error(`Failed to unlock PDF: ${stderr}`);
      }

      if (mentionsPassword) {
        throw new UnlockRequestError(
          "This PDF is encrypted with an open password. Switch to 'Unlock with Password' to enter your password."
        );
      }
      if (stderr.includes('not encrypted') || stdout.includes('not encrypted')) {
        // Same no-op as above, caught here when the pre-check could not read the file.
        logger.info(`[unlock-pdf] PDF carries no restrictions; returning it unchanged`, {}, requestId);
        return { pdf: pdfBuffer, noRestrictions: true };
      }
      throw new Error(`Failed to remove restrictions: ${stderr}`);
    }

    const unlockedPdf = await readFile(outputPath);
    logger.info(`[unlock-pdf] PDF processed successfully`, {}, requestId);

    return { pdf: unlockedPdf, noRestrictions: false };
  } catch (error: any) {
    if (error instanceof UnlockRequestError) {
      logger.warn(`[unlock-pdf] Cannot unlock as asked`, { reason: error.message }, requestId);
    } else {
      logger.error(`[unlock-pdf] Error processing PDF`, { error: error.message, errorCode: error.errorCode }, requestId);
    }
    throw error;
  } finally {
    try {
      await Promise.all([
        unlink(inputPath).catch(() => { }),
        unlink(outputPath).catch(() => { }),
      ]);
    } catch (cleanupError) {
      logger.warn(`[unlock-pdf] Cleanup error`, { error: cleanupError }, requestId);
    }
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const requestId = `unlock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a few minutes.', requestId },
      { status: 429, headers: { 'X-RateLimit-Limit': '20', 'X-RateLimit-Remaining': String(rateLimit.remaining) } }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) === 'unlock-password' ? 'unlock-password' : 'remove-restrictions';
    const password = formData.get('password') as string;

    if (!file) {
      return NextResponse.json({ error: 'No file provided.', requestId }, { status: 400 });
    }

    if (mode === 'unlock-password' && !password) {
      return NextResponse.json({ error: 'Password is required.', requestId }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF', requestId }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // File size limit: 50MB
    if (buffer.length > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size limit is 50MB. Try our Compress PDF tool first.', requestId }, { status: 400 });
    }

    // Magic bytes only, deliberately NOT the full inspectPdf(): an encrypted
    // PDF is the input this route exists to accept, and pdf-lib's structural
    // pass can throw on exactly those files. qpdf is the real parser here.
    if (!hasPdfMagicBytes(buffer)) {
      return NextResponse.json(
        { error: "This file doesn't appear to be a valid PDF.", errorCode: 'INVALID_FILE_CONTENT', requestId },
        { status: 400 }
      );
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('Unlock PDF started', { ...fileLogMeta(file), mode }, requestId);

    const { pdf: unlockedPdf, noRestrictions } = await unlockPdfProcess(buffer, mode, password, requestId);
    const outputSizeMB = (unlockedPdf.length / 1024 / 1024).toFixed(2);
    logger.info('Unlock PDF completed', { inputSize: `${fileSizeMB}MB`, outputSize: `${outputSizeMB}MB`, noRestrictions }, requestId);

    // Nothing was stripped, so the file keeps its own name.
    const downloadName = noRestrictions ? file.name : file.name.replace('.pdf', '_unlocked.pdf');
    // Header values are ASCII, so an Arabic filename needs the sanitized form plus the
    // RFC 5987 parameter that carries the real name for browsers that read it.
    const asciiName = toHeaderSafeFilename(downloadName, noRestrictions ? 'document.pdf' : 'unlocked.pdf');

    return new NextResponse(Buffer.from(unlockedPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
        'X-Request-ID': requestId,
        ...(noRestrictions ? { 'X-Unlock-Result': 'no-restrictions' } : {}),
      },
    });
  } catch (error: any) {
    // UnlockRequestError carries copy we wrote for the user (wrong password,
    // needs the other mode). Anything else is an engine failure whose message
    // is qpdf's stderr — logged, never returned.
    if (error instanceof UnlockRequestError) {
      return NextResponse.json(
        { error: error.message, errorCode: 'UNLOCK_REJECTED', requestId }, // leak-guard: authored — UnlockRequestError carries our copy
        { status: 400 }
      );
    }
    logger.error('Unlock PDF failed', { error: error?.message, errorCode: error?.errorCode, stack: error?.stack }, requestId);
    return NextResponse.json(
      { error: "We couldn't unlock this PDF. Please try again.", errorCode: 'UNLOCK_FAILED', requestId },
      { status: 500 }
    );
  }
}
