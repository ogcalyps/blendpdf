import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { convertWithLibreOffice } from '@/lib/libreoffice';

const execAsync = promisify(exec);

const LIBREOFFICE_TIMEOUT_MS = 90_000;

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
 * - .pptx is a ZIP container: must start with PK\x03\x04
 * - legacy .ppt is an OLE compound file: D0 CF 11 E0 A1 B1 1A E1
 * - .odp is skipped (mirrors word-to-pdf, which does not magic-check .odt)
 * Returns null if valid, or an error message string.
 */
function validateMagicBytes(buffer: Buffer, extension: string): string | null {
  if (extension === '.pptx') {
    if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      return 'File does not appear to be a valid .pptx presentation';
    }
  } else if (extension === '.ppt') {
    const oleHeader = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    if (buffer.length < 8 || !oleHeader.every((byte, i) => buffer[i] === byte)) {
      return 'File does not appear to be a valid .ppt presentation';
    }
  }
  // .odp: no magic-byte check (mirrors word-to-pdf's handling of .odt)
  return null;
}

/**
 * Convert PowerPoint presentation to PDF using LibreOffice
 * Supports .ppt, .pptx, .odp formats
 */
async function convertPowerPointToPdfLibreOffice(pptBuffer: Buffer, inputExtension: string, requestId: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}${inputExtension}`);

  try {
    const libreOfficeCmd = await getLibreOfficeCommand();
    if (!libreOfficeCmd) {
      throw new Error('LibreOffice command not found');
    }

    // Write presentation to temp file
    await writeFile(inputPath, pptBuffer);

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

    // Use LibreOffice to convert PowerPoint to PDF
    // --headless: Run without GUI
    // --nodefault: Don't start default document
    // --nolockcheck: Don't check for file locks
    // (--convert-to and --outdir are added by convertWithLibreOffice)
    const flags = ['--headless', '--nodefault', '--nolockcheck'];

    logger.info(`[LibreOffice] Converting: ${inputId}${inputExtension}`, {
      inputPath,
      flags,
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

    const { output, stdout, stderr, exitCode, signal, timedOut } = await convertWithLibreOffice(libreOfficeCmd, inputPath, 'pdf', {
      flags,
      timeoutMs: LIBREOFFICE_TIMEOUT_MS,
      useXvfb,
      env: {
        ...process.env,
        PATH: updatedPath,
        HOME: homeDir,
        DISPLAY: useXvfb ? undefined : ':99', // Use virtual display or set to :99
        QT_QPA_PLATFORM: 'offscreen', // Prevent Qt from trying to use X11
        SAL_USE_VCLPLUGIN: 'gen',
        SAL_DISABLE_OPENCL: '1',
        SAL_NO_DEFAULT: '1',
      },
    });

    if (timedOut) {
      logger.warn('[LibreOffice] Timed out; process group killed', { timeoutMs: LIBREOFFICE_TIMEOUT_MS }, requestId);
      throw Object.assign(new Error(`LibreOffice timed out after ${LIBREOFFICE_TIMEOUT_MS / 1000}s`), { errorCode: 'TIMEOUT' });
    }

    if (exitCode !== 0) {
      // No crash/refusal split here: soffice.bin runs under its launcher
      // (oosplash), which reports a segfault as a plain exit 1.
      logger.warn('[LibreOffice] Conversion failed', { stdout, stderr, exitCode, signal }, requestId);
      throw Object.assign(new Error(`LibreOffice exited with ${exitCode ?? signal}: ${stderr}`), {
        errorCode: 'CONVERSION_FAILED',
      });
    }

    if (stderr && !stderr.includes('Application Error')) {
      logger.warn('LibreOffice conversion warning', { stderr }, requestId);
    }

    if (!output) {
      throw new Error('LibreOffice conversion failed: Output file not found');
    }
    
    await unlink(inputPath).catch(() => {});
    return output;
  } catch (error) {
    // Cleanup on error
    await unlink(inputPath).catch(() => {});
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const requestId = `powerpoint-to-pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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
          error: 'No file provided. Please select a PowerPoint presentation to convert.',
          requestId,
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = [
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.oasis.opendocument.presentation', // .odp
    ];

    const allowedExtensions = ['.ppt', '.pptx', '.odp'];
    const fileExtension = file.name.toLowerCase().match(/\.(pptx?|odp)$/)?.[0] || '';

    if (!allowedTypes.includes(file.type) && !allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return NextResponse.json(
        {
          error: 'File must be a PowerPoint presentation (.ppt, .pptx, or .odp)',
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

    // Validate magic bytes (.pptx = ZIP "PK", .ppt = OLE compound file)
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
    logger.info('PowerPoint to PDF conversion started', { ...fileLogMeta(file), fileType: fileExtension }, requestId);

    // Check if LibreOffice is available
    const hasLibreOffice = await checkLibreOffice();
    if (!hasLibreOffice) {
      throw new Error('LibreOffice is not available. Please install LibreOffice to use this feature.');
    }

    const conversionMethod = 'libreoffice';
    logger.info('PowerPoint to PDF conversion method check', {
      hasLibreOffice: true,
      willUse: 'libreoffice'
    }, requestId);

    const pdfBuffer = await convertPowerPointToPdfLibreOffice(buffer, fileExtension, requestId);

    const outputSizeMB = (pdfBuffer.length / 1024 / 1024).toFixed(2);
    logger.info('PowerPoint to PDF conversion completed successfully', {
      inputSize: `${fileSizeMB}MB`,
      outputSize: `${outputSizeMB}MB`,
      method: conversionMethod
    }, requestId);

    // Sanitize filename for Content-Disposition header
    const originalFilename = file.name.replace(/\.(pptx?|odp)$/i, '.pdf');
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
    logger.error('PowerPoint to PDF conversion failed', { error: error instanceof Error ? error.message : 'Unknown error', errorCode: (error as { errorCode?: string })?.errorCode, stack: error instanceof Error ? error.stack : undefined }, requestId);

    return NextResponse.json(
      {
        // LibreOffice's stderr used to land here verbatim. Logged above only.
        error: "We couldn't convert this presentation. Please check the file and try again.",
        errorCode: 'CONVERSION_FAILED',
        requestId,
      },
      { status: 500 }
    );
  }
}
