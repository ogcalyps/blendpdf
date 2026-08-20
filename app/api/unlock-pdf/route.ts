import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/cloudwatch-logger';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';

const execAsync = promisify(exec);

async function unlockPdfProcess(
  pdfBuffer: Buffer,
  mode: 'remove-restrictions' | 'unlock-password',
  password?: string,
  requestId?: string
): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const outputPath = join(tempDir, `${inputId}_unlocked.pdf`);

  try {
    await writeFile(inputPath, pdfBuffer);

    logger.info(`[unlock-pdf] Processing PDF: ${inputId}.pdf, mode: ${mode}`, {}, requestId);

    // If removing restrictions, we first check if the document is actually encrypted.
    if (mode === 'remove-restrictions') {
      try {
        const { stdout } = await execAsync(`qpdf --show-encryption "${inputPath}"`, { timeout: 10000 });
        if (stdout.includes('File is not encrypted') || stdout.includes('not encrypted')) {
          throw new Error("This PDF already has no restrictions.");
        }
      } catch (checkError: any) {
        if (checkError.message.includes("already has no restrictions")) {
          throw checkError;
        }
        // If qpdf --show-encryption fails for another reason, it might be an open password.
        // We will catch it in the decrypt step.
      }
    }

    let command = '';
    if (mode === 'unlock-password') {
      // Escape password for shell to prevent command injection
      const escapedPassword = password ? password.replace(/'/g, "'\\''") : '';
      command = `qpdf --decrypt --password='${escapedPassword}' "${inputPath}" "${outputPath}"`;
    } else {
      command = `qpdf --decrypt "${inputPath}" "${outputPath}"`;
    }

    try {
      await execAsync(command, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 });
    } catch (execError: any) {
      const stderr = execError.stderr || '';
      const stdout = execError.stdout || '';

      if (mode === 'unlock-password') {
        if (stderr.toLowerCase().includes('password') || stdout.toLowerCase().includes('password')) {
          throw new Error('Incorrect password. Please try again.');
        } else {
          throw new Error(`Failed to unlock PDF: ${stderr}`);
        }
      } else if (mode === 'remove-restrictions') {
        if (stderr.toLowerCase().includes('password') || stdout.toLowerCase().includes('password')) {
          throw new Error("This PDF is encrypted with an open password. Switch to 'Unlock with Password' to enter your password.");
        } else if (stderr.includes('not encrypted') || stdout.includes('not encrypted')) {
          throw new Error("This PDF already has no restrictions.");
        } else {
          throw new Error(`Failed to remove restrictions: ${stderr}`);
        }
      } else {
        throw new Error(`Failed to process PDF: ${stderr}`);
      }
    }

    const { readFile } = await import('fs/promises');
    const unlockedPdf = await readFile(outputPath);
    logger.info(`[unlock-pdf] PDF processed successfully`, {}, requestId);

    return unlockedPdf;
  } catch (error: any) {
    logger.error(`[unlock-pdf] Error processing PDF`, { error: error.message }, requestId);
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

    // Quick validation check by trying to see if it's a PDF structure
    if (buffer.length < 5 || buffer.toString('utf8', 0, 5) !== '%PDF-') {
      return NextResponse.json({ error: "This file doesn't appear to be a valid PDF.", requestId }, { status: 400 });
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('Unlock PDF started', { fileSize: `${fileSizeMB}MB`, fileName: file.name, mode }, requestId);

    const unlockedPdf = await unlockPdfProcess(buffer, mode, password, requestId);
    const outputSizeMB = (unlockedPdf.length / 1024 / 1024).toFixed(2);
    logger.info('Unlock PDF completed', { inputSize: `${fileSizeMB}MB`, outputSize: `${outputSizeMB}MB` }, requestId);

    return new NextResponse(Buffer.from(unlockedPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${file.name.replace('.pdf', '_unlocked.pdf')}"`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error: any) {
    logger.error('Unlock PDF failed', { error: error.message }, requestId);
    return NextResponse.json({ error: error.message || 'Failed to unlock PDF.', requestId }, { status: 500 });
  }
}
