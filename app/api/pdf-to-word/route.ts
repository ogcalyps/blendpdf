import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { logger } from '@/lib/cloudwatch-logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 120; // Increased for pdf2docx/LibreOffice conversion

// Engine detection is memoized at module scope: binaries do not appear/disappear
// between requests, so exec-ing `which`/import probes per request is wasted latency.
let pdf2docxCheckPromise: Promise<boolean> | null = null;
let libreOfficeCmdPromise: Promise<string | null> | null = null;

/**
 * Check if pdf2docx (Python) is available (cached at module scope)
 */
function checkPdf2Docx(requestId?: string): Promise<boolean> {
  if (!pdf2docxCheckPromise) {
    pdf2docxCheckPromise = detectPdf2Docx(requestId);
  }
  return pdf2docxCheckPromise;
}

async function detectPdf2Docx(requestId?: string): Promise<boolean> {
  try {
    // Build PATH with Python user bin directories
    const pathEnv = process.env.PATH || '';
    const homeDir = process.env.HOME || tmpdir();
    const commonPaths = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      // Python user bin directories (where pip installs packages)
      `${homeDir}/.local/bin`,           // Linux user pip installs
    ];
    const pathParts = pathEnv.split(':').filter(p => p);
    const updatedPath = [...new Set([...commonPaths, ...pathParts])].join(':');
    
    // Try python3 first, then python
    const pythonCommands = ['python3', 'python'];
    
    for (const pythonCmd of pythonCommands) {
      try {
        // First check if python command exists
        const whichResult = await execAsync(`which ${pythonCmd}`, {
          timeout: 2000,
          env: {
            ...process.env,
            PATH: updatedPath,
          },
        });
        
        const pythonPath = whichResult.stdout.trim();
        if (requestId) {
          logger.debug(`Found Python: ${pythonCmd} at ${pythonPath}`, {}, requestId);
        }
        
        // Then check if pdf2docx is importable
        const { stdout, stderr } = await execAsync(`${pythonCmd} -c "from pdf2docx import Converter; print('OK')"`, {
          timeout: 5000,
          env: {
            ...process.env,
            PATH: updatedPath,
            PYTHONPATH: process.env.PYTHONPATH || '', // Include PYTHONPATH if set
          },
        });
        
        if (stdout && stdout.includes('OK')) {
          if (requestId) {
            logger.info(`pdf2docx detected successfully using ${pythonCmd}`, { pythonPath }, requestId);
          }
          return true;
        } else if (stderr) {
          if (requestId) {
            logger.debug(`pdf2docx check stderr (non-fatal): ${stderr}`, {}, requestId);
          }
        }
      } catch (cmdError: any) {
        if (requestId) {
          logger.debug(`pdf2docx check failed for ${pythonCmd}`, { 
            error: cmdError.message || 'Unknown error',
            stderr: cmdError.stderr || '',
          }, requestId);
        }
        // Try next command
        continue;
      }
    }
    
    if (requestId) {
      logger.warn('pdf2docx not detected - will use LibreOffice fallback', {}, requestId);
    }
    return false;
  } catch (error) {
    // Log the error for debugging
    if (requestId) {
      logger.warn('pdf2docx detection failed', { error: error instanceof Error ? error.message : 'Unknown error' }, requestId);
    } else {
      console.warn('[checkPdf2Docx] Detection failed:', error instanceof Error ? error.message : 'Unknown error');
    }
    return false;
  }
}

/**
 * Convert PDF to Word using pdf2docx (Python library)
 * This provides much better formatting preservation than LibreOffice or text extraction
 * Same approach used by BentoPDF
 */
async function convertPdfToWordPdf2Docx(pdfBuffer: Buffer, requestId: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const expectedOutputPath = join(tempDir, `${inputId}.docx`);
  const pythonScriptPath = join(tempDir, `${inputId}_convert.py`); // Declare at function level for cleanup
  
  try {
    // Write PDF to temp file
    await writeFile(inputPath, pdfBuffer);
    
    // Use pdf2docx Python library for conversion
    // This provides much better quality than LibreOffice
    // Write Python script to a temp file to avoid shell escaping issues
    // Added error handling for version compatibility issues
    const pythonScript = `from pdf2docx import Converter
import sys
import traceback

try:
    cv = Converter("${inputPath}")
    # Try conversion with error handling for version compatibility
    try:
        cv.convert("${expectedOutputPath}", start=0, end=None)
        cv.close()
        print("SUCCESS")
    except AttributeError as attr_error:
        # Handle version compatibility issues (e.g., 'Rect' object has no attribute 'get_area')
        if 'get_area' in str(attr_error) or 'Rect' in str(attr_error):
            # Try with different parameters or re-raise with better error message
            cv.close()
            print(f"VERSION_ERROR: pdf2docx version compatibility issue: {attr_error}", file=sys.stderr)
            print(f"Please update pdf2docx: pip3 install --upgrade pdf2docx", file=sys.stderr)
            sys.exit(2)
        else:
            raise
except Exception as e:
    error_msg = str(e)
    error_trace = traceback.format_exc()
    print(f"ERROR: {error_msg}", file=sys.stderr)
    # Log full traceback for debugging
    if "get_area" in error_msg or "Rect" in error_msg:
        print("VERSION_COMPATIBILITY_ERROR", file=sys.stderr)
    sys.exit(1)
`;
    
    await writeFile(pythonScriptPath, pythonScript);
    
    logger.info(`[pdf2docx] Converting: ${inputId}.pdf`, {}, requestId);
    
    // Build PATH with common locations
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

    // Execute the Python script file instead of using -c to avoid escaping issues
    let stdout: string = '';
    let stderr: string = '';
    let exitCode: number = 0;
    
    try {
      const result = await execAsync(`python3 "${pythonScriptPath}"`, {
        timeout: 120000, // 2 minute timeout
        maxBuffer: 50 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: updatedPath,
        },
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (execError: any) {
      stdout = execError.stdout || '';
      stderr = execError.stderr || '';
      exitCode = execError.code || 1;
      
      // Check for version compatibility errors
      if (stderr && (stderr.includes('VERSION_COMPATIBILITY_ERROR') || 
                     stderr.includes('get_area') || 
                     stderr.includes("'Rect' object has no attribute"))) {
        logger.error(`[pdf2docx] Version compatibility error detected`, { stderr, exitCode }, requestId);
        throw new Error(`pdf2docx version compatibility issue. The installed version may be incompatible. Please update: pip3 install --upgrade pdf2docx. Error: ${stderr.split('\\n')[0]}`);
      }
      
      // If exit code is 2, it's a version error
      if (exitCode === 2) {
        logger.error(`[pdf2docx] Version error (exit code 2)`, { stderr }, requestId);
        throw new Error(`pdf2docx version compatibility issue. Please update: pip3 install --upgrade pdf2docx`);
      }
      
      // For other errors, re-throw to trigger LibreOffice fallback
      if (!stdout.includes('SUCCESS')) {
        logger.warn(`[pdf2docx] Conversion failed`, { stderr, exitCode }, requestId);
        throw new Error(`pdf2docx conversion failed: ${stderr || execError.message || 'Unknown error'}`);
      }
    }
    
    if (stderr && !stdout.includes('SUCCESS')) {
      logger.warn(`[pdf2docx] Warning: ${stderr}`, {}, requestId);
    }
    
    // Wait for file system sync
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Check if output file exists
    const { stat } = await import('fs/promises');
    let docxBuffer: Buffer | null = null;
    
    try {
      const stats = await stat(expectedOutputPath);
      if (stats.isFile() && stats.size > 0) {
        docxBuffer = await readFile(expectedOutputPath);
      } else {
        throw new Error('Output file is empty or not a file');
      }
    } catch (err) {
      throw new Error(`pdf2docx conversion failed: Output file not found`);
    }
    
    if (!docxBuffer) {
      throw new Error('pdf2docx conversion failed: No output generated');
    }
    
    // Cleanup
    await unlink(inputPath).catch(() => {});
    await unlink(expectedOutputPath).catch(() => {});
    await unlink(pythonScriptPath).catch(() => {});
    
    return docxBuffer;
  } catch (error) {
    // Cleanup on error
    await unlink(inputPath).catch(() => {});
    await unlink(expectedOutputPath).catch(() => {});
    await unlink(pythonScriptPath).catch(() => {});
    throw error;
  }
}

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
  // Build PATH with common locations for both macOS and Linux
  const pathEnv = process.env.PATH || '';
  const commonPaths = [
    '/opt/homebrew/bin',      // macOS Homebrew (Apple Silicon)
    '/opt/homebrew/sbin',     // macOS Homebrew (Apple Silicon)
    '/usr/local/bin',          // macOS Homebrew (Intel) / Linux local
    '/usr/bin',                // Linux standard
    '/bin',                    // Linux standard
    '/usr/sbin',               // Linux system binaries
  ];
  
  // Split existing PATH and combine with common paths, removing duplicates
  const pathParts = pathEnv.split(':').filter(p => p);
  const updatedPath = [...new Set([...commonPaths, ...pathParts])].join(':');
  
  const execOptions = {
    env: {
      ...process.env,
      PATH: updatedPath,
    },
  };
  
  // Try libreoffice first (works on Debian/Ubuntu and some macOS installs)
  try {
    await execAsync('which libreoffice', execOptions);
    return 'libreoffice';
  } catch {
    // Fallback to soffice (works on macOS Homebrew installs)
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
 * Convert PDF to Word using LibreOffice
 * This provides much better formatting preservation than text extraction
 */
async function convertPdfToWordLibreOffice(pdfBuffer: Buffer, requestId: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  
  // Expected output file: same name as input but with .docx extension
  // LibreOffice outputs with the same base filename as input, just changes extension
  const expectedOutputPath = join(tempDir, `${inputId}.docx`);
  
  try {
    // Get the correct LibreOffice command
    const libreOfficeCmd = await getLibreOfficeCommand();
    if (!libreOfficeCmd) {
      throw new Error('LibreOffice command not found');
    }
    
    // Write PDF to temp file
    await writeFile(inputPath, pdfBuffer);
    
    // Build PATH with common locations for both macOS and Linux (Debian/Ubuntu)
    const pathEnv = process.env.PATH || '';
    const commonPaths = [
      '/opt/homebrew/bin',      // macOS Homebrew (Apple Silicon)
      '/opt/homebrew/sbin',     // macOS Homebrew (Apple Silicon)
      '/usr/local/bin',          // macOS Homebrew (Intel) / Linux local
      '/usr/bin',                // Linux standard (Debian/Ubuntu)
      '/bin',                    // Linux standard
      '/usr/sbin',               // Linux system binaries
    ];
    
    // Split existing PATH and combine with common paths, removing duplicates
    const pathParts = pathEnv.split(':').filter(p => p);
    const updatedPath = [...new Set([...commonPaths, ...pathParts])].join(':');
    
    // Ensure file is readable by LibreOffice (set permissions to 644)
    try {
      await execAsync(`chmod 644 "${inputPath}"`, {
        env: { ...process.env, PATH: updatedPath },
      });
    } catch (chmodError) {
      // Log but don't fail - file should still be readable
      logger.debug('Failed to set file permissions (non-critical)', { error: chmodError instanceof Error ? chmodError.message : 'Unknown' }, requestId);
    }
    
    // Verify file exists and is readable before attempting conversion
    const { stat: statFile } = await import('fs/promises');
    try {
      const fileStats = await statFile(inputPath);
      if (!fileStats.isFile() || fileStats.size === 0) {
        throw new Error(`PDF file is invalid: ${inputPath} (size: ${fileStats.size} bytes)`);
      }
      logger.debug('PDF file verified', { path: inputPath, size: `${(fileStats.size / 1024).toFixed(2)}KB` }, requestId);
    } catch (statError) {
      logger.error('PDF file verification failed', { 
        path: inputPath, 
        error: statError instanceof Error ? statError.message : 'Unknown error' 
      }, requestId);
      throw new Error(`PDF file does not exist or is not accessible: ${inputPath}`);
    }
    
    // Wait a moment to ensure file is fully written and synced to disk
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Double-check file exists right before LibreOffice tries to access it
    try {
      const finalCheck = await statFile(inputPath);
      logger.info('File exists before LibreOffice conversion', {
        path: inputPath,
        size: finalCheck.size,
        isFile: finalCheck.isFile(),
        mode: finalCheck.mode.toString(8), // File permissions in octal
      }, requestId);
    } catch (finalCheckError) {
      logger.error('File disappeared before LibreOffice conversion!', {
        path: inputPath,
        error: finalCheckError instanceof Error ? finalCheckError.message : 'Unknown error',
      }, requestId);
      throw new Error(`PDF file no longer exists at ${inputPath}. This may indicate a file system issue.`);
    }
    
    // Use LibreOffice to convert PDF to DOCX
    // LibreOffice handles PDFs natively without needing --infilter parameter
    // --headless: Run without GUI
    // --convert-to docx: Convert to DOCX format
    // --outdir: Output directory
    // Use absolute paths to avoid any path resolution issues
    const absoluteInputPath = inputPath; // Already absolute from join(tempDir, ...)
    
    // Use simple command without cd - just absolute paths
    // Remove quotes from paths to avoid shell interpretation issues
    const command = `${libreOfficeCmd} --headless --convert-to docx --outdir ${tempDir} ${absoluteInputPath}`;
    
    logger.info(`[LibreOffice] Converting: ${inputId}.pdf`, { inputPath: absoluteInputPath, tempDir, command }, requestId);
    
    // Create a proper HOME directory for LibreOffice if needed
    const libreOfficeHome = process.env.HOME || tempDir;
    
    let stdout: string = '';
    let stderr: string = '';
    
    try {
      const result = await execAsync(command, {
        timeout: 90000, // 90 second timeout
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
        env: {
          ...process.env,
          PATH: updatedPath,
          HOME: libreOfficeHome, // Use actual HOME or fallback
          TMPDIR: tempDir, // Use temp directory for LibreOffice temp files
          // LibreOffice user profile to avoid conflicts
          'SAL_USE_VCLPLUGIN': 'headless',
          'SAL_DISABLE_OPENCL': '1',
          // Disable LibreOffice user profile to avoid permission issues
          'SAL_NO_DEFAULT': '1',
          // Additional LibreOffice environment variables
          'LIBREOFFICE_USER_PROFILE': join(tempDir, `lo-profile-${inputId}`),
        },
        cwd: tempDir, // Set working directory to temp directory
        shell: '/bin/bash', // Explicitly use bash shell
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (execError: any) {
      stdout = execError.stdout || '';
      stderr = execError.stderr || '';
    }
    
    // Log stdout and stderr for debugging (important for production troubleshooting)
    logger.info('LibreOffice conversion stdout', { stdout: stdout || '(empty)', command }, requestId);
    if (stderr) {
      logger.warn('LibreOffice conversion stderr', { stderr }, requestId);
    }
    
    // Check for the specific "source file could not be loaded" error
    const sourceFileError = stderr && stderr.includes('source file could not be loaded');
    
    if (sourceFileError) {
      // Verify file still exists and is readable
      const { stat: statFile } = await import('fs/promises');
      try {
        const fileStats = await statFile(inputPath);
        logger.error('LibreOffice cannot load PDF file - file verification', {
          path: inputPath,
          exists: true,
          size: fileStats.size,
          isFile: fileStats.isFile(),
          readable: true, // If stat succeeds, file is readable
          stderr,
        }, requestId);
      } catch (verifyError) {
        logger.error('LibreOffice cannot load PDF file - file does not exist or is not accessible', {
          path: inputPath,
          exists: false,
          error: verifyError instanceof Error ? verifyError.message : 'Unknown error',
          stderr,
        }, requestId);
      }
      
      throw new Error(`LibreOffice cannot load PDF file. File path: ${inputPath}. This may indicate: 1) File permissions issue, 2) Corrupted PDF, or 3) LibreOffice cannot access the file. Error: ${stderr.trim()}`);
    }
    
    // Parse stdout to find the actual output file path
    // LibreOffice outputs: "convert /path/to/input.pdf as ... -> /path/to/output.docx using filter ..."
    let parsedOutputPath: string | null = null;
    if (stdout) {
      const match = stdout.match(/->\s+([^\s]+\.docx)/);
      if (match && match[1]) {
        parsedOutputPath = match[1];
      }
    }
    
    // Check if conversion actually succeeded by looking for success indicators in stdout
    // LibreOffice typically outputs: "convert /path/to/input.pdf -> /path/to/output.docx using filter ..."
    const conversionSucceeded = stdout && (stdout.includes('->') || stdout.includes('convert') || stdout.includes('using filter'));
    
    // Check for actual errors in stderr
    const hasError = stderr && (
      stderr.includes('Error') || 
      stderr.includes('error') || 
      stderr.includes('failed') ||
      stderr.includes('Failed') ||
      (stderr.includes('Application Error') && !stderr.includes('Application Error: 0'))
    );
    
    if (hasError) {
      logger.error('LibreOffice conversion error detected in stderr', { stdout, stderr }, requestId);
    } else if (!conversionSucceeded) {
      logger.warn('LibreOffice conversion may have failed - no success indicator in stdout', { stdout: stdout || '(empty)', stderr: stderr || '(empty)' }, requestId);
    }
    
    // Wait for file system sync (increased wait time for production)
    // LibreOffice may need time to flush the file to disk
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // List all files in temp directory after conversion
    const { readdir, stat } = await import('fs/promises');
    let allFiles: string[] = [];
    try {
      allFiles = await readdir(tempDir);
      // Log all files found (important for debugging)
      logger.info('Files in temp directory after conversion', { 
        files: allFiles, 
        tempDir,
        inputId,
        expectedPath: expectedOutputPath 
      }, requestId);
      const docxFiles = allFiles.filter(f => f.endsWith('.docx'));
      logger.info('DOCX files found in temp directory', { docxFiles, count: docxFiles.length }, requestId);
    } catch (dirError) {
      logger.error('Error listing temp directory', { 
        error: dirError instanceof Error ? dirError.message : 'Unknown error',
        tempDir 
      }, requestId);
    }
    
    // Try multiple strategies to find the output file
    let docxBuffer: Buffer | null = null;
    const pathsToTry = [
      parsedOutputPath,                  // Path from LibreOffice stdout
      expectedOutputPath,                 // Expected path (same name as input)
      join(tempDir, `${inputId}.docx`),  // Alternative check
    ].filter((p): p is string => p !== null);
    
    logger.debug('Trying output file paths', { paths: pathsToTry }, requestId);
    
    // First, try the parsed and expected paths
    for (const path of pathsToTry) {
      try {
        const stats = await stat(path);
        if (stats.isFile() && stats.size > 0) {
          docxBuffer = await readFile(path);
          logger.info('Found LibreOffice output file', { path, size: `${(docxBuffer.length / 1024 / 1024).toFixed(2)}MB` }, requestId);
          break;
        }
      } catch (err) {
        logger.debug('Output file not found at path', { path }, requestId);
      }
    }
    
    // If still not found, search for any recent .docx file in temp directory
    if (!docxBuffer) {
      try {
        const docxFiles = allFiles.filter(f => f.endsWith('.docx'));
        logger.info('Searching for DOCX files in temp directory (fallback)', { count: docxFiles.length, files: docxFiles }, requestId);
        
        // Sort by modification time (most recent first)
        const filesWithStats = await Promise.all(
          docxFiles.map(async (file) => {
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
        validFiles.sort((a, b) => b.mtime - a.mtime); // Most recent first
        
        logger.info('Valid DOCX files found', { 
          count: validFiles.length, 
          files: validFiles.map(f => ({ name: f.file, size: `${(f.size / 1024 / 1024).toFixed(2)}MB`, age: `${Math.round((Date.now() - f.mtime) / 1000)}s` }))
        }, requestId);
        
        // Try the most recent file (likely our output) - increased time window to 60 seconds
        if (validFiles.length > 0) {
          const mostRecent = validFiles[0];
          const now = Date.now();
          // Check if file was modified in last 60 seconds (increased from 30)
          if (now - mostRecent.mtime < 60000) {
            docxBuffer = await readFile(mostRecent.path);
            logger.info('Found most recent DOCX file', { path: mostRecent.path, size: `${(docxBuffer.length / 1024 / 1024).toFixed(2)}MB`, age: `${Math.round((now - mostRecent.mtime) / 1000)}s` }, requestId);
          } else {
            logger.warn('Most recent DOCX file is too old', { 
              path: mostRecent.path, 
              age: `${Math.round((now - mostRecent.mtime) / 1000)}s`,
              threshold: '60s'
            }, requestId);
          }
        }
      } catch (dirError) {
        logger.error('Error searching temp directory', { error: dirError instanceof Error ? dirError.message : 'Unknown error' }, requestId);
      }
    }
    
    if (!docxBuffer) {
      // Enhanced error logging with all diagnostic information
      logger.error('LibreOffice conversion failed: Output file not found', { 
        expectedPath: expectedOutputPath, 
        parsedPath: parsedOutputPath, 
        allFiles: allFiles.slice(0, 50), // Limit to first 50 files to avoid huge logs
        tempDir,
        inputId,
        stdout: stdout || '(empty)',
        stderr: stderr || '(empty)',
        command
      }, requestId);
      throw new Error('LibreOffice conversion failed: Output file not found');
    }
    
    
    // Cleanup temp files
    try {
      await unlink(inputPath);
      // Clean up output file
      await unlink(expectedOutputPath).catch(() => {});
      if (parsedOutputPath && parsedOutputPath !== expectedOutputPath) {
        await unlink(parsedOutputPath).catch(() => {});
      }
      // Also try to clean up any .docx files with the input ID
      try {
        const files = await readdir(tempDir);
        for (const file of files) {
          if (file.endsWith('.docx') && file.includes(inputId)) {
            await unlink(join(tempDir, file)).catch(() => {});
          }
        }
      } catch {
        // Ignore cleanup errors
      }
    } catch (cleanupError) {
      logger.warn('Failed to cleanup temp files', { error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error' }, requestId);
    }
    
    return docxBuffer;
  } catch (error) {
    // Cleanup on error
    try {
      await unlink(inputPath).catch(() => {});
      await unlink(expectedOutputPath).catch(() => {});
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const requestId = `pdf-to-word-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
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
          error: 'No file provided. Please select a PDF file to convert.',
          requestId,
        },
        { status: 400 }
      );
    }

    // Validate file is a PDF
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        {
          error: 'File must be a PDF',
          requestId,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSizeMB = (buffer.length / 1024 / 1024).toFixed(2);
    logger.info('PDF to Word conversion started', { fileSize: `${fileSizeMB}MB`, fileName: file.name }, requestId);
    
    // Check if pdf2docx is available (best quality - same as BentoPDF)
    const hasPdf2Docx = await checkPdf2Docx(requestId);
    logger.info('PDF to Word conversion method check', { 
      hasPdf2Docx, 
      willUse: hasPdf2Docx ? 'pdf2docx (BentoPDF method)' : 'LibreOffice (fallback)' 
    }, requestId);
    
    let docxBuffer: Buffer;
    let conversionMethod = 'unknown';
    
    if (hasPdf2Docx) {
      // Use pdf2docx for best conversion quality (same as BentoPDF)
      try {
        docxBuffer = await convertPdfToWordPdf2Docx(buffer, requestId);
        conversionMethod = 'pdf2docx';
      } catch (pdf2docxError) {
        logger.warn('pdf2docx failed, falling back to LibreOffice', { error: pdf2docxError instanceof Error ? pdf2docxError.message : 'Unknown error' }, requestId);
        // Fallback to LibreOffice
        const hasLibreOffice = await checkLibreOffice();
        if (hasLibreOffice) {
          try {
            docxBuffer = await convertPdfToWordLibreOffice(buffer, requestId);
            conversionMethod = 'libreoffice';
          } catch (libreOfficeError) {
            logger.error('Both pdf2docx and LibreOffice conversion failed', { 
              pdf2docxError: pdf2docxError instanceof Error ? pdf2docxError.message : 'Unknown error',
              libreOfficeError: libreOfficeError instanceof Error ? libreOfficeError.message : 'Unknown error'
            }, requestId);
            // Provide helpful error message
            throw new Error(`PDF to Word conversion failed. pdf2docx error: ${pdf2docxError instanceof Error ? pdf2docxError.message : 'Unknown'}. LibreOffice error: ${libreOfficeError instanceof Error ? libreOfficeError.message : 'Unknown'}. Please ensure pdf2docx is installed: pip3 install pdf2docx`);
          }
        } else {
          throw new Error(`pdf2docx failed and LibreOffice is not available. pdf2docx error: ${pdf2docxError instanceof Error ? pdf2docxError.message : 'Unknown'}. Please install pdf2docx: pip3 install pdf2docx`);
        }
      }
    } else {
      // Fallback to LibreOffice if pdf2docx not available
      logger.warn('pdf2docx not available, using LibreOffice', {}, requestId);
      const hasLibreOffice = await checkLibreOffice();
      if (hasLibreOffice) {
        try {
          docxBuffer = await convertPdfToWordLibreOffice(buffer, requestId);
          conversionMethod = 'libreoffice';
        } catch (libreOfficeError) {
          logger.error('LibreOffice conversion failed', { error: libreOfficeError instanceof Error ? libreOfficeError.message : 'Unknown error' }, requestId);
          throw new Error(`LibreOffice conversion failed: ${libreOfficeError instanceof Error ? libreOfficeError.message : 'Unknown error'}. Consider installing pdf2docx for better results: pip3 install pdf2docx`);
        }
      } else {
        throw new Error('Neither pdf2docx nor LibreOffice is available. Please install pdf2docx: pip3 install pdf2docx');
      }
    }

    // Sanitize filename for Content-Disposition header (handle special characters)
    const sanitizedFilename = file.name
      .replace('.pdf', '.docx')
      .replace(/[^\x20-\x7E]/g, '_') // Replace non-ASCII characters with underscore
      .substring(0, 255); // Limit length
    
    // Log successful conversion
    logger.info('PDF to Word conversion completed successfully', { 
      method: conversionMethod, 
      inputSize: `${fileSizeMB}MB`, 
      outputSize: `${(docxBuffer.length / 1024 / 1024).toFixed(2)}MB`,
      fileName: file.name 
    }, requestId);
    
    // Return DOCX file
    return new NextResponse(new Uint8Array(docxBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodeURIComponent(file.name.replace('.pdf', '.docx'))}`,
        'X-Request-ID': requestId,
        'X-Conversion-Method': conversionMethod,
      },
    });
  } catch (error) {
    logger.error('PDF to Word conversion failed', { error: error instanceof Error ? error.message : 'Unknown error', stack: error instanceof Error ? error.stack : undefined }, requestId);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unknown error occurred while converting the PDF';
    
    return NextResponse.json(
      {
        error: errorMessage,
        requestId,
      },
      { status: 500 }
    );
  }
}
