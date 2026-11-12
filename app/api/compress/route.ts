import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CompressionLevel } from '@/types';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { inspectPdf } from '@/lib/pdf-validation';
import { compressToFit } from '@/lib/compress-fit';

const execFileAsync = promisify(execFile);

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Ghostscript keeps text as text and vectors as vectors; it only downsamples
// and recompresses embedded images. Level names refer to output QUALITY (the
// UI labels: high = "High Quality, minimal loss", low = "Low Quality,
// maximum compression"), so lower quality = stronger compression = lower DPI.
const GS_PRESETS: Record<CompressionLevel, string> = {
  high: '/prepress', // high quality: lightest compression (300 dpi images)
  medium: '/ebook', // balanced (150 dpi images)
  low: '/screen', // low quality: strongest compression (72 dpi images)
};

/** Limits a size target can ask for: 100 KB to the 50 MB upload limit. */
const MIN_TARGET_BYTES = 100_000;

/** All Ghostscript passes for one request share this, under maxDuration. */
const GS_BUDGET_MS = 50000;

/**
 * One Ghostscript pass over a PDF already on disk. Preserves selectable text.
 */
async function runGhostscript(inputPath: string, settings: string[], timeoutMs: number): Promise<Buffer> {
  const outputPath = join(tmpdir(), `${randomUUID()}_compressed.pdf`);
  try {
    await execFileAsync(
      'gs',
      [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.5',
        ...settings,
        '-dNOPAUSE',
        '-dQUIET',
        '-dBATCH',
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }
    );

    const output = await readFile(outputPath);
    if (output.length < 5 || output.toString('utf8', 0, 5) !== '%PDF-') {
      throw new Error('Ghostscript produced invalid output');
    }
    return output;
  } finally {
    await unlink(outputPath).catch(() => {});
  }
}

async function withInputOnDisk<T>(buffer: Buffer, fn: (inputPath: string) => Promise<T>): Promise<T> {
  const inputPath = join(tmpdir(), `${randomUUID()}.pdf`);
  try {
    await writeFile(inputPath, buffer);
    return await fn(inputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
  }
}

/**
 * Compress via Ghostscript (primary strategy). Preserves selectable text.
 */
async function compressWithGhostscript(
  buffer: Buffer,
  level: CompressionLevel,
  requestId: string
): Promise<Buffer> {
  const output = await withInputOnDisk(buffer, (inputPath) =>
    runGhostscript(inputPath, [`-dPDFSETTINGS=${GS_PRESETS[level]}`], GS_BUDGET_MS)
  );
  console.log(`[${requestId}] Ghostscript compression succeeded (${GS_PRESETS[level]})`);
  return output;
}

/**
 * Fallback: lossless pdf-lib re-save with object streams. Never rasterizes.
 */
async function compressWithPdfLib(buffer: ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return await doc.save({ useObjectStreams: true, addDefaultPage: false });
}

export async function POST(request: NextRequest) {
  const requestId = `compress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: 20 compressions per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 20,
  });

  if (!rateLimit.allowed) {
    console.warn(`[${requestId}] Rate limit exceeded for IP: ${getClientIP(request)}`);
    return NextResponse.json(
      {
        error: 'Too many compression requests. Please wait a few minutes before trying again.',
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
    const level = (formData.get('level') as CompressionLevel) || 'medium';
    const targetField = formData.get('targetBytes');
    const targetBytes = targetField === null ? null : Number(targetField);

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided. Please select a PDF file to compress.',
          requestId,
        },
        { status: 400 }
      );
    }

    if (!GS_PRESETS[level]) {
      return NextResponse.json(
        {
          error: `Invalid compression level: ${level}. Valid levels are: low, medium, high`,
          requestId,
        },
        { status: 400 }
      );
    }

    if (targetBytes !== null && (!Number.isInteger(targetBytes) || targetBytes < MIN_TARGET_BYTES || targetBytes > MAX_FILE_SIZE)) {
      return NextResponse.json(
        {
          error: 'The size limit must be between 100 KB and 50 MB.',
          errorCode: 'INVALID_TARGET_SIZE',
          requestId,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size limit is 50MB.',
          errorCode: 'FILE_TOO_LARGE',
          requestId,
        },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const originalSize = buffer.byteLength;

    // Validate before compressing. Without this a structurally broken file
    // survives both engines, trips the "output >= input" guard below, and gets
    // handed straight back with a 200 and `already-optimized` — so the user
    // downloads their corrupt file believing it compressed fine.
    const inspection = await inspectPdf(Buffer.from(buffer));
    if (!inspection.ok) {
      const { errorCode, message, detail } = inspection.rejection;
      console.warn(`[${requestId}] Rejected: ${errorCode}`, detail ?? {});
      return NextResponse.json({ error: message, errorCode, requestId }, { status: 400 });
    }

    console.log(`[${requestId}] Compressing PDF: ${(originalSize / 1024 / 1024).toFixed(2)}MB, ${targetBytes === null ? `level: ${level}` : `target: ${targetBytes} bytes`}`);

    // Already under the limit: nothing to do, and any pass would only cost quality
    if (targetBytes !== null && originalSize <= targetBytes) {
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="compressed.pdf"',
          'X-Request-ID': requestId,
          'X-Original-Size': String(originalSize),
          'X-Compressed-Size': String(originalSize),
          'X-Reduction-Percent': '0',
          'X-Compression-Note': 'already-under-target',
          'X-Target-Bytes': String(targetBytes),
          'X-Target-Met': '1',
        },
      });
    }

    let compressed: Uint8Array;
    let method: 'ghostscript' | 'pdf-lib';
    let step: string | null = null;
    try {
      if (targetBytes === null) {
        compressed = await compressWithGhostscript(Buffer.from(buffer), level, requestId);
      } else {
        const fit = await withInputOnDisk(Buffer.from(buffer), (inputPath) =>
          compressToFit(targetBytes, (settings, timeoutMs) => runGhostscript(inputPath, settings, timeoutMs), GS_BUDGET_MS)
        );
        compressed = fit.output;
        step = fit.step;
        console.log(`[${requestId}] Ghostscript fit: ${fit.step}, ${fit.output.length} bytes, met: ${fit.met}`);
      }
      method = 'ghostscript';
    } catch (gsError) {
      console.warn(
        `[${requestId}] Ghostscript unavailable or failed, falling back to pdf-lib re-save:`,
        gsError instanceof Error ? gsError.message : gsError
      );
      compressed = await compressWithPdfLib(buffer);
      method = 'pdf-lib';
    }

    const compressedSize = compressed.length;
    const target = (size: number): Record<string, string> =>
      targetBytes === null ? {} : { 'X-Target-Bytes': String(targetBytes), 'X-Target-Met': size <= targetBytes ? '1' : '0' };

    // Never return a file bigger than the input: hand back the original instead
    if (compressedSize >= originalSize) {
      console.log(`[${requestId}] Output (${compressedSize} bytes) >= input (${originalSize} bytes) via ${method}; returning original file`);
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="compressed.pdf"',
          'X-Request-ID': requestId,
          'X-Original-Size': String(originalSize),
          'X-Compressed-Size': String(originalSize),
          'X-Reduction-Percent': '0',
          'X-Compression-Note': 'already-optimized',
          'X-Compression-Method': method,
          ...target(originalSize),
        },
      });
    }

    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`[${requestId}] Compression complete: ${step ?? level} (${method}) - Original: ${(originalSize / 1024 / 1024).toFixed(2)}MB, Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)}MB, Reduction: ${reduction}%`);

    return new NextResponse(Buffer.from(compressed), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="compressed.pdf"',
        'X-Request-ID': requestId,
        'X-Original-Size': String(originalSize),
        'X-Compressed-Size': String(compressedSize),
        'X-Reduction-Percent': reduction,
        'X-Compression-Method': method,
        ...(step ? { 'X-Compression-Step': step } : {}),
        ...target(compressedSize),
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Error compressing PDF:`, error);

    let errorMessage = 'Failed to compress PDF. Please try again.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        errorMessage = 'Compression timed out. The file may be too large or complex. Please try with a smaller file.';
        statusCode = 408;
      } else if (error.message.includes('corrupt') || error.message.includes('invalid')) {
        errorMessage = 'The PDF file is corrupted or invalid. Please check your file and try again.';
        statusCode = 400;
      } else if (error.message.includes('memory') || error.message.includes('out of memory')) {
        errorMessage = 'File is too large to compress. Please try with a smaller file.';
        statusCode = 413;
      }
      // Deliberately no raw-message fallback: unrecognised failures are
      // Ghostscript/pdf-lib internals, which must not reach the client.
    }

    return NextResponse.json(
      {
        error: errorMessage,
        requestId,
        ...(process.env.NODE_ENV === 'development' && { details: error instanceof Error ? error.stack : String(error) }),
      },
      { status: statusCode }
    );
  }
}
