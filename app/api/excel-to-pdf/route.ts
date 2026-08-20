import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { logger } from '@/lib/cloudwatch-logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 120;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// LibreOffice detection is memoized at module scope: the binary does not
// appear/disappear between requests, so exec-ing `which` per request is wasted latency.
let libreOfficeCmdPromise: Promise<string | null> | null = null;

/**
 * Get the LibreOffice command (libreoffice or soffice), cached at module scope.
 * Works on both macOS (soffice) and Debian/Ubuntu (libreoffice)
 */
function getLibreOfficeCommand(): Promise<string | null> {
  if (!libreOfficeCmdPromise) {
    libreOfficeCmdPromise = detectLibreOfficeCommand();
  }
  return libreOfficeCmdPromise;
}

async function detectLibreOfficeCommand(): Promise<string | null> {
  const pathEnv = process.env.PATH || '';
  const commonPaths = [
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
  ];

  const pathParts = pathEnv.split(':').filter(p => p);
  const updatedPath = [...new Set([...commonPaths, ...pathParts])].join(':');

  const execOptions = {
    env: {
      ...process.env,
      PATH: updatedPath,
    },
  };

  try {
    await execAsync('which libreoffice', execOptions);
    return 'libreoffice';
  } catch {
    try {
      await execAsync('which soffice', execOptions);
      return 'soffice';
    } catch {
      return null;
    }
  }
}

/**
 * Check if LibreOffice is available
 */
async function checkLibreOffice(): Promise<boolean> {
  const cmd = await getLibreOfficeCommand();
  return cmd !== null;
}

/**
 * Validate magic bytes for the given extension.
 * - .xlsx is a ZIP container: must start with PK\x03\x04
 * - legacy .xls is an OLE compound file: D0 CF 11 E0 A1 B1 1A E1
 * - .ods and .csv are skipped (mirrors word-to-pdf, which does not magic-check .odt;
 *   CSV is plain text and has no magic bytes)
 * Returns null if valid, or an error message string.
 */
function validateMagicBytes(buffer: Buffer, extension: string): string | null {
  if (extension === '.xlsx') {
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      return 'File does not appear to be a valid .xlsx spreadsheet';
    }
  } else if (extension === '.xls') {
    const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (buffer.length < 8 || !oleHeader.every((byte, i) => buffer[i] === byte)) {
      return 'File does not appear to be a valid .xls spreadsheet';
    }
  }
  // .ods / .csv: no magic-byte check
  return null;
}

/**
 * Convert Excel spreadsheet to PDF using LibreOffice
 * Supports .xls, .xlsx, .ods, .csv formats (CSV is opened by Calc and exported the same way).
 * Note: very wide sheets may paginate across multiple PDF pages — that's expected
 * LibreOffice behavior (it uses the sheet's print/page setup, same as printing from Calc).
 */
async function convertExcelToPdfLibreOffice(excelBuffer: Buffer, inputExtension: string, requestId: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}${inputExtension}`);
  const expectedOutputPath = join(tempDir, `${inputId}.pdf`);

  try {
    const libreOfficeCmd = await getLibreOfficeCommand();
    if (!libreOfficeCmd) {
      throw new Error('LibreOffice command not found');
    }

    // Write spreadsheet to temp file
    await writeFile(inputPath, excelBuffer);

    // Ensure file is readable
    const { chmod } = await import('fs/promises');
    await chmod(inputPath, 0o644);

    // Verify file exists and is readable before conversion
    const { access, constants } = await import('fs/promises');
    try {
      await access(inputPath, constants.F_OK | constants.R_OK);
      const fileStats = await stat(inputPath);
      logger.info('File verified before LibreOffice conversion', {
        path: inputPath,
        size: fileStats.size,
        isFile: fileStats.isFile(),
        mode: fileStats.mode.toString(8),
      }, requestId);
    } catch (err) {
      throw new Error(`File verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    // Check if xvfb-run is available (for virtual display)
    let useXvfb = false;
    try {
      await execAsync('which xvfb-run', { timeout: 2000 });
      useXvfb = true;
      logger.debug('[LibreOffice] xvfb-run available, will use virtual display', {}, requestId);
    } catch {
      logger.debug('[LibreOffice] xvfb-run not available, using environment variables', {}, requestId);
    }

    // Use LibreOffice to convert Excel to PDF
    // --headless: Run without GUI
    // --nodefault: Don't start default document
    // --nolockcheck: Don't check for file locks
    // --convert-to pdf: Convert to PDF format
    // --outdir: Output directory
    // Simplified command without quotes in paths to avoid shell interpretation issues
    const baseCommand = `${libreOfficeCmd} --headless --nodefault --nolockcheck --convert-to pdf --outdir ${tempDir} ${inputPath}`;
    const command = useXvfb ? `xvfb-run -a ${baseCommand}` : baseCommand;

    logger.info(`[LibreOffice] Converting: ${inputId}${inputExtension}`, {
      inputPath,
      tempDir,
      command,
      useXvfb,
    }, requestId);

    // Build PATH with common locations
    const pathEnv = process.env.PATH || '';
    const commonPaths = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/snap/bin', // For snap-based LibreOffice
    ];

    const pathParts = pathEnv.split(':').filter(p => p);
    const updatedPath = [...new Set([...commonPaths, ...pathParts])].join(':');

    // Set environment variables for LibreOffice
    const homeDir = process.env.HOME || '/tmp';
    const tempDirEnv = tempDir;
    const libreOfficeUserProfile = join(homeDir, '.libreoffice-profile');

    const { stdout, stderr } = await execAsync(command, {
      timeout: 90000,
      maxBuffer: 50 * 1024 * 1024,
      cwd: tempDir,
      shell: '/bin/bash',
      env: {
        ...process.env,
        PATH: updatedPath,
        HOME: homeDir,
        TMPDIR: tempDirEnv,
        DISPLAY: useXvfb ? undefined : ':99', // Use virtual display or set to :99
        QT_QPA_PLATFORM: 'offscreen', // Prevent Qt from trying to use X11
        SAL_USE_VCLPLUGIN: 'gen',
        SAL_DISABLE_OPENCL: '1',
        SAL_NO_DEFAULT: '1',
        LIBREOFFICE_USER_PROFILE: libreOfficeUserProfile,
      },
    });

    if (stderr && !stderr.includes('Application Error')) {
      logger.warn('LibreOffice conversion warning', { stderr }, requestId);
    }

    // Parse stdout to find the actual output file path
    let parsedOutputPath: string | null = null;
    if (stdout) {
      const match = stdout.match(/->\s+([^\s]+\.pdf)/);
      if (match && match[1]) {
        parsedOutputPath = match[1];
      }
    }

    // Wait for file system sync
    await new Promise(resolve => setTimeout(resolve, 500));

    // Try to find the output file
    const { readdir } = await import('fs/promises');
    let pdfBuffer: Buffer | null = null;
    const pathsToTry = [
      parsedOutputPath,
      expectedOutputPath,
      join(tempDir, `${inputId}.pdf`),
    ].filter((p): p is string => p !== null);

    // First, try the expected paths
    for (const path of pathsToTry) {
      try {
        const stats = await stat(path);
        if (stats.isFile() && stats.size > 0) {
          pdfBuffer = await readFile(path);
          break;
        }
      } catch (err) {
        // Continue to next path
      }
    }

    // If still not found, search for any recent .pdf file in temp directory
    if (!pdfBuffer) {
      try {
        const files = await readdir(tempDir);
        const pdfFiles = files.filter(f => f.endsWith('.pdf'));

        // Sort by modification time (most recent first)
        const filesWithStats = await Promise.all(
          pdfFiles.map(async (file) => {
            try {
              const filePath = join(tempDir, file);
              const stats = await stat(filePath);
              return { file, path: filePath, mtime: stats.mtimeMs, size: stats.size };
            } catch {
              return null;
            }
          })
        );

        const validFiles = filesWithStats.filter(f => f !== null && f.size > 0) as Array<{file: string, path: string, mtime: number, size: number}>;
        validFiles.sort((a, b) => b.mtime - a.mtime);

        // Try the most recent file (likely our output)
        if (validFiles.length > 0) {
          const mostRecent = validFiles[0];
          const now = Date.now();
          if (now - mostRecent.mtime < 30000) {
            pdfBuffer = await readFile(mostRecent.path);
          }
        }
      } catch (dirError) {
        // Ignore directory read errors
      }
    }

    if (!pdfBuffer) {
      throw new Error('LibreOffice conversion failed: Output file not found');
    }

    // Cleanup
    await unlink(inputPath).catch(() => {});
    await unlink(expectedOutputPath).catch(() => {});
    if (parsedOutputPath) {
      await unlink(parsedOutputPath).catch(() => {});
    }

    return pdfBuffer;
  } catch (error) {
    // Cleanup on error
    await unlink(inputPath).catch(() => {});
    await unlink(expectedOutputPath).catch(() => {});
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const requestId = `excel-to-pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Rate limiting: 10 conversions per 15 minutes per IP
  const rateLimit = rateLimitMiddleware(request, {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
  });

  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { ip: getClientIP(request) }, requestId);
    return NextResponse.json(
      {
        error: 'Too many conversion requests. Please wait a few minutes before trying again.',
        requestId,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': String(rateLimit.remaining),
          'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
        },
      }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        {
          error: 'No file provided. Please select an Excel spreadsheet to convert.',
          requestId,
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.oasis.opendocument.spreadsheet', // .ods
      'text/csv', // .csv
      'application/csv', // .csv alternative
    ];

    const allowedExtensions = ['.xls', '.xlsx', '.ods', '.csv'];
    const fileExtension = file.name.toLowerCase().match(/\.(xlsx?|ods|csv)$/)?.[0] || '';

    if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return NextResponse.json(
        {
          error: 'File must be an Excel spreadsheet (.xls, .xlsx, .ods, or .csv)',
          errorCode: 'INVALID_FILE_TYPE',
          requestId,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File size exceeds maximum allowed size of 50MB',
          errorCode: 'FILE_TOO_LARGE',
          requestId,
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        {
          error: 'File is empty',
          errorCode: 'EMPTY_FILE',
          requestId,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes (.xlsx = ZIP "PK", .xls = OLE compound file, .csv skipped)
    const magicError = validateMagicBytes(buffer, fileExtension);
    if (magicError) {
      return NextResponse.json(
        {
          error: magicError,
          errorCode: 'INVALID_FILE_CONTENT',
          requestId,
        },
        { status: 400 }
      );
    }

    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('Excel to PDF conversion started', { fileSize: `${fileSizeMB}MB`, fileName: file.name, fileType: fileExtension }, requestId);

    // Check if LibreOffice is available
    const hasLibreOffice = await checkLibreOffice();
    if (!hasLibreOffice) {
      throw new Error('LibreOffice is not available. Please install LibreOffice to use this feature.');
    }

    const conversionMethod = 'libreoffice';
    logger.info('Excel to PDF conversion method check', {
      hasLibreOffice: true,
      willUse: 'libreoffice'
    }, requestId);

    const pdfBuffer = await convertExcelToPdfLibreOffice(buffer, fileExtension, requestId);

    const outputSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
    logger.info('Excel to PDF conversion completed successfully', {
      inputSize: `${fileSizeMB}MB`,
      outputSize: `${outputSizeMB}MB`,
      method: conversionMethod
    }, requestId);

    // Sanitize filename for Content-Disposition header
    const originalFilename = file.name.replace(/\.(xlsx?|ods|csv)$/i, '.pdf');
    const sanitizedFilename = originalFilename
      .replace(/[^\x20-\x7E]/g, '_')
      .substring(0, 255);

    // Return PDF file
    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
        'Content-Length': String(pdfBuffer.length),
        'X-Request-ID': requestId,
        'X-Conversion-Method': conversionMethod,
      },
    });
  } catch (error) {
    logger.error('Excel to PDF conversion failed', { error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, requestId);

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unknown error occurred while converting the spreadsheet';

    return NextResponse.json(
      {
        error: errorMessage,
        requestId,
      },
      { status: 500 }
    );
  }
}
