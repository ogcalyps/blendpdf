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

async function checkTabulaPy(requestId: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('python3 -c "import tabula; print(\'OK\')"', {
      timeout: 5000,
      maxBuffer: 1024 * 1024,
    });
    return stdout.trim() === 'OK';
  } catch {
    return false;
  }
}

async function convertPdfToExcel(
  pdfBuffer: Buffer,
  requestId: string
): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const outputPath = join(tempDir, `${inputId}.xlsx`);
  const pythonScriptPath = join(tempDir, `${inputId}_convert.py`);

  try {
    await writeFile(inputPath, pdfBuffer);
    const hasTabulaPy = await checkTabulaPy(requestId);

    if (!hasTabulaPy) {
      throw new Error('PDF to Excel conversion service is not available. Please contact support.');
    }

    const pythonScript = `
import tabula
import pandas as pd
import sys

try:
    input_path = "${inputPath}"
    output_path = "${outputPath}"
    
    # Extract all tables from PDF
    tables = tabula.read_pdf(input_path, pages='all', multiple_tables=True)
    
    if not tables or len(tables) == 0:
        print("ERROR: No tables found in PDF", file=sys.stderr)
        sys.exit(1)
    
    # If multiple tables, combine them or save to separate sheets
    if len(tables) == 1:
        # Single table - save directly
        tables[0].to_excel(output_path, index=False, engine='openpyxl')
    else:
        # Multiple tables - save to separate sheets
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            for i, table in enumerate(tables):
                sheet_name = f'Table_{i+1}' if len(tables) > 1 else 'Sheet1'
                table.to_excel(writer, sheet_name=sheet_name, index=False)
    
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
`;

    await writeFile(pythonScriptPath, pythonScript);
    logger.info(`[pdf-to-excel] Converting: ${inputId}.pdf`, {}, requestId);

    const pathEnv = process.env.PATH || '';
    const commonPaths = ['/opt/homebrew/bin', '/opt/homebrew/sbin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin'];
    const pathParts = pathEnv.split(':').filter((p) => p);
    const updatedPath = [...new Set([...commonPaths, ...pathParts])].join(':');

    const { stdout, stderr } = await execAsync(`python3 "${pythonScriptPath}"`, {
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, PATH: updatedPath },
    });

    if (stderr && !stdout.includes('SUCCESS')) {
      if (stderr.includes('No tables found')) {
        throw new Error('No tables found in the PDF. This PDF may not contain extractable table data.');
      }
      logger.error(`[pdf-to-excel] Python script error`, { stderr }, requestId);
      throw new Error(`Failed to convert PDF to Excel: ${stderr}`);
    }

    const { readFile } = await import('fs/promises');
    const excelFile = await readFile(outputPath);
    logger.info(`[pdf-to-excel] PDF converted successfully`, {}, requestId);

    return excelFile;
  } catch (error: any) {
    logger.error(`[pdf-to-excel] Error converting PDF`, { error: error.message }, requestId);
    throw error;
  } finally {
    try {
      await Promise.all([
        unlink(inputPath).catch(() => {}),
        unlink(outputPath).catch(() => {}),
        unlink(pythonScriptPath).catch(() => {}),
      ]);
    } catch (cleanupError) {
      logger.warn(`[pdf-to-excel] Cleanup error`, { error: cleanupError }, requestId);
    }
  }
}

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const requestId = `pdf-to-excel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('PDF to Excel conversion started', { fileSize: `${fileSizeMB}MB`, fileName: file.name }, requestId);

    const hasTabulaPy = await checkTabulaPy(requestId);
    if (!hasTabulaPy) {
      return NextResponse.json(
        { error: 'PDF to Excel conversion service is not available. Please contact support.', requestId },
        { status: 503 }
      );
    }

    const excelFile = await convertPdfToExcel(buffer, requestId);
    const outputSizeMB = (excelFile.length / 1024 / 1024).toFixed(2);
    logger.info('PDF to Excel conversion completed', { inputSize: `${fileSizeMB}MB`, outputSize: `${outputSizeMB}MB` }, requestId);

    // Sanitize filename for Content-Disposition header (same RFC 5987 pattern as pdf-to-word):
    // ASCII fallback in filename= plus UTF-8 original in filename*=
    const outputFilename = `${file.name.replace(/\.pdf$/i, '')}.xlsx`;
    const sanitizedFilename = outputFilename
      .replace(/[^\x20-\x7E]/g, '_') // Replace non-ASCII characters with underscore
      .substring(0, 255); // Limit length

    return new NextResponse(Buffer.from(excelFile), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(outputFilename)}`,
        'X-Request-ID': requestId,
      },
    });
  } catch (error: any) {
    logger.error('PDF to Excel conversion failed', { error: error.message }, requestId);
    return NextResponse.json({ error: error.message || 'Failed to convert PDF to Excel.', requestId }, { status: 500 });
  }
}
