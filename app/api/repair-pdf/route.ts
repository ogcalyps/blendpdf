import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { toHeaderSafeFilename } from '@/lib/pdf-processor';
import { hasPdfMagicBytes } from '@/lib/pdf-validation';
import { runProcess } from '@/lib/run-process';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

const PYPDF_REPAIR_TIMEOUT_MS = 120_000;

/**
 * Repair with qpdf (primary strategy): a plain rewrite recovers xref/structure
 * damage. qpdf exit code 3 means "succeeded with warnings" (i.e. it recovered
 * from real damage), so we treat it as success.
 */
async function repairWithQpdf(pdfBuffer: Buffer, requestId: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const outputPath = join(tempDir, `${inputId}_repaired.pdf`);

  try {
    await writeFile(inputPath, pdfBuffer);
    logger.info(`[repair-pdf] Attempting qpdf repair: ${inputId}.pdf`, {}, requestId);

    try {
      await execFileAsync('qpdf', [inputPath, outputPath], {
        timeout: 60000,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (qpdfError: any) {
      if (qpdfError?.code !== 3) {
        throw qpdfError;
      }
      logger.warn(
        `[repair-pdf] qpdf recovered with warnings`,
        { stderr: typeof qpdfError.stderr === 'string' ? qpdfError.stderr.slice(0, 500) : undefined },
        requestId
      );
    }

    const repairedPdf = await readFile(outputPath);
    if (repairedPdf.length < 5 || repairedPdf.toString('utf8', 0, 5) !== '%PDF-') {
      throw new Error('qpdf produced invalid output');
    }

    logger.info(`[repair-pdf] qpdf repair succeeded`, {}, requestId);
    return repairedPdf;
  } finally {
    await Promise.all([
      unlink(inputPath).catch(() => {}),
      unlink(outputPath).catch(() => {}),
    ]);
  }
}

async function checkPyPDF2(requestId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('python3 -c "import PyPDF2; print(\'OK\')"', {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim() === 'OK';
  } catch {
    try {
      const { stdout } = await execAsync('python3 -c "import pypdf; print(\'OK\')"', {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
      });
      return stdout.trim() === 'OK';
    } catch {
      return false;
    }
  }
}

async function repairPdf(pdfBuffer: Buffer, requestId: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const outputPath = join(tempDir, `${inputId}_repaired.pdf`);
  const pythonScriptPath = join(tempDir, `${inputId}_repair.py`);

  try {
    await writeFile(inputPath, pdfBuffer);
    const hasPyPDF2 = await checkPyPDF2(requestId);
    const library = hasPyPDF2 ? 'PyPDF2' : 'pypdf';

    const pythonScript = `
import ${library}
import sys

try:
    input_path = "${inputPath}"
    output_path = "${outputPath}"
    
    with open(input_path, 'rb') as file:
        try:
            pdf_reader = ${library}.PdfReader(file, strict=False)
            pdf_writer = ${library}.PdfWriter()
            
            # Try to copy all pages
            for page in pdf_reader.pages:
                pdf_writer.add_page(page)
            
            # Write repaired PDF
            with open(output_path, 'wb') as output_file:
                pdf_writer.write(output_file)
            
            print("SUCCESS")
        except Exception as e:
            # If reading fails, try to repair by recreating
            file.seek(0)
            try:
                pdf_reader = ${library}.PdfReader(file, strict=False)
                pdf_writer = ${library}.PdfWriter()
                
                # Try to extract what we can
                for i in range(len(pdf_reader.pages)):
                    try:
                        page = pdf_reader.pages[i]
                        pdf_writer.add_page(page)
                    except:
                        continue  # Skip corrupted pages
                
                if len(pdf_writer.pages) == 0:
                    print("ERROR: Could not recover any pages", file=sys.stderr)
                    sys.exit(1)
                
                with open(output_path, 'wb') as output_file:
                    pdf_writer.write(output_file)
                
                print("SUCCESS")
            except Exception as e2:
                print(f"ERROR: {e2}", file=sys.stderr)
                sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

    await writeFile(pythonScriptPath, pythonScript);
    logger.info(`[repair-pdf] Repairing PDF: ${inputId}.pdf`, {}, requestId);

    const pathEnv = process.env.PATH || '';
    const commonPaths = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin'];
    const pathParts = pathEnv.split(':').filter((p) => p);
    const updatedPath = [...new Set([...commonPaths, ...pathParts])].join(':');

    // No shell, own process group: on timeout python itself is killed, and
    // this returns only once it has exited, so the finally below cannot delete
    // the output before its last write (see lib/run-process.ts).
    const { stdout, stderr, exitCode, signal, timedOut } = await runProcess('python3', [pythonScriptPath], {
      timeoutMs: PYPDF_REPAIR_TIMEOUT_MS,
      env: { ...process.env, PATH: updatedPath },
    });

    if (timedOut) {
      logger.warn(`[repair-pdf] Timed out; process group killed`, { timeoutMs: PYPDF_REPAIR_TIMEOUT_MS }, requestId);
      throw Object.assign(new Error(`pypdf repair timed out after ${PYPDF_REPAIR_TIMEOUT_MS / 1000}s`), { errorCode: 'TIMEOUT' });
    }

    if (exitCode !== 0 || !stdout.includes('SUCCESS')) {
      // Without a shell in between, a native crash arrives as the signal
      // itself rather than as exit code 139.
      const crashed = signal !== null;
      logger.error(`[repair-pdf] Python script error`, { stderr, exitCode, signal, crashed }, requestId);
      throw Object.assign(new Error(`Failed to repair PDF: ${stderr || `exit ${exitCode ?? signal}`}`), {
        errorCode: crashed ? 'CONVERTER_CRASHED' : 'REPAIR_FAILED',
      });
    }

    const repairedPdf = await readFile(outputPath);
    logger.info(`[repair-pdf] PDF repaired successfully`, {}, requestId);

    return repairedPdf;
  } catch (error: any) {
    logger.error(`[repair-pdf] Error repairing PDF`, { error: error.message, errorCode: error.errorCode }, requestId);
    throw error;
  } finally {
    try {
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {}),
        unlink(pythonScriptPath).catch(() => {}),
      ]);
    } catch (cleanupError) {
      logger.warn(`[repair-pdf] Cleanup error`, { error: cleanupError }, requestId);
    }
  }
}

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const requestId = `repair-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

    if (!file) {
      return NextResponse.json({ error: 'No file provided.', requestId }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF', requestId }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Magic bytes only. This route exists to accept structurally broken PDFs,
    // so inspectPdf()'s parse check would reject precisely the files it is
    // meant to repair. A file that is not a PDF at all is still worth catching
    // here rather than after two engine timeouts.
    if (!hasPdfMagicBytes(buffer)) {
      logger.warn('Repair rejected: not a PDF', { bytes: buffer.length }, requestId);
      return NextResponse.json(
        { error: "This file doesn't appear to be a PDF at all, so there's nothing to repair.", errorCode: 'INVALID_FILE_CONTENT', requestId },
        { status: 400 }
      );
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('Repair PDF started', { ...fileLogMeta(file) }, requestId);

    // Try qpdf first (real structural repair: rebuilds xref tables, recovers
    // damaged objects). Fall back to the pypdf page-copy path if qpdf fails.
    let repairedPdf: Buffer;
    let repairMethod: 'qpdf' | 'pypdf';
    try {
      repairedPdf = await repairWithQpdf(buffer, requestId);
      repairMethod = 'qpdf';
    } catch (qpdfError: any) {
      logger.warn(`[repair-pdf] qpdf repair failed, falling back to pypdf`, { error: qpdfError?.message }, requestId);

      const hasPyPDF2 = await checkPyPDF2(requestId);
      if (!hasPyPDF2) {
        try {
          await execAsync('python3 -c "import pypdf; print(\'OK\')"', { timeout: 5000, maxBuffer: 1024 * 1024 });
        } catch {
          return NextResponse.json({ error: 'PDF repair service is not available.', requestId }, { status: 503 });
        }
      }

      repairedPdf = await repairPdf(buffer, requestId);
      repairMethod = 'pypdf';
    }

    const outputSizeMB = (repairedPdf.length / 1024 / 1024).toFixed(2);
    logger.info('Repair PDF completed', { inputSize: `${fileSizeMB}MB`, outputSize: `${outputSizeMB}MB`, repairMethod }, requestId);

    return new NextResponse(Buffer.from(repairedPdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${toHeaderSafeFilename(file.name.replace('.pdf', '_repaired.pdf'), 'repaired.pdf')}"`,
        'X-Request-ID': requestId,
        'X-Repair-Method': repairMethod,
      },
    });
  } catch (error: any) {
    // error.message here is the repair script's stderr — log only.
    logger.error('Repair PDF failed', { error: error?.message, errorCode: error?.errorCode, stack: error?.stack }, requestId);
    return NextResponse.json(
      { error: "This PDF is damaged beyond what we can repair automatically.", errorCode: 'REPAIR_FAILED', requestId },
      { status: 500 }
    );
  }
}
