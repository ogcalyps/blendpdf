import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { rateLimitMiddleware, getClientIP } from '@/lib/rate-limit';
import { logger } from '@/lib/cloudwatch-logger';
import { fileLogMeta } from '@/lib/log-redact';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { inspectPdf } from '@/lib/pdf-validation';
import { runProcess } from '@/lib/run-process';
import { convertWithLibreOffice } from '@/lib/libreoffice';
import { PDF_TO_WORD_MAX_PAGES, pdf2docxFailureSummary, pdf2docxProgress } from '@/lib/pdf-to-word-limits';
import { ARABIC_LAYOUT_PY } from '@/lib/pdf-to-word-arabic';

const execAsync = promisify(exec);

const PDF2DOCX_TIMEOUT_MS = 120_000;
const LIBREOFFICE_TIMEOUT_MS = 90_000;

/**
 * Conversion failures carry an errorCode so the client can show a localized
 * message. The raw engine output NEVER reaches the response body — it is
 * diagnostic only, and used to have segfault dumps and tmp paths rendered on
 * users' screens.
 */
interface ConversionError extends Error {
  errorCode?: string;
}

function conversionError(message: string, errorCode: string): ConversionError {
  const error = new Error(message) as ConversionError;
  error.errorCode = errorCode;
  return error;
}

/**
 * What every log line about a run carries in place of the filename. On
 * 2026-10-04 two timeouts logged only `timeoutMs`, so nobody could tell whether
 * the file was long, heavy or both.
 */
interface RunLog {
  pages: number;
  bytes: number;
  fileRef: string;
}

export const runtime = 'nodejs';
// The converter's 120 s budget plus room to read the upload, inspect it and
// answer, so a platform that enforces this cannot cut the request before the
// friendly CONVERSION_TIMEOUT answer is sent. `next start` does not enforce it,
// and nginx allows 600 s on the box.
export const maxDuration = 150;

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
async function convertPdfToWordPdf2Docx(pdfBuffer: Buffer, requestId: string, runLog: RunLog): Promise<Buffer> {
  const tempDir = tmpdir();
  const inputId = randomUUID();
  const inputPath = join(tempDir, `${inputId}.pdf`);
  const expectedOutputPath = join(tempDir, `${inputId}.docx`);
  const pythonScriptPath = join(tempDir, `${inputId}_convert.py`); // Declare at function level for cleanup
  const type3TextPath = join(tempDir, `${inputId}_type3.pdf`);
  
  try {
    // Write PDF to temp file
    await writeFile(inputPath, pdfBuffer);
    
    // Use pdf2docx Python library for conversion
    // This provides much better quality than LibreOffice
    // Write Python script to a temp file to avoid shell escaping issues
    // Added error handling for version compatibility issues
    //
    // The logging filter drops pdf2docx's 'Ignore Line "<text>" due to overlap'
    // warnings, one per overlapping line. They quote the document, and on a
    // table-heavy file they fill the 1 MB of stderr runProcess keeps, so the
    // progress lines the timeout log reads ("[4/4]", "(8/21) Page 8") are cut
    // off. pdf2docx logs through the root logger, so a filter on that logger
    // catches them; the one on its handlers also catches child loggers.
    //
    // Type 3 fonts (headless Chrome prints variable fonts this way, matplotlib
    // by default): a glyph that starts with d1 takes its colour from the text.
    // PyMuPDF 1.26 reads a fill inside one as "colour undefined", draws the
    // glyph as loose vector paths and keeps the text only as invisible text,
    // which pdf2docx discards as a hidden OCR layer, and it splits every space
    // into its own span, which pdf2docx also drops. A 2026-11-03 brochure came
    // out with 43 of 293 words, glued together. A fill colour right after d1 is
    // ignored when drawing (d1 glyphs cannot set colour), but it makes MuPDF
    // keep the glyphs as ordinary text. Only a copy is rewritten, and only
    // when the file has such glyphs.
    //
    // pdf2docx leaves a page cut short when building it fails (it logs
    // "Ignore page" and still exits 0); its borderless-table guesser is the
    // usual cause, so the file is converted once more without it while there
    // is time.
    //
    // A scan after OCR (ours or anyone's) has only invisible text over a page
    // picture. pdf2docx drops invisible text unless told the file is OCR-ed
    // (ocr=2), so such a scan became a .docx holding one picture and no words.
    // When every bit of text in the file is invisible, it gets ocr=2: the
    // recognised text, without the page pictures.
    //
    // Arabic lines are read in reading order and their paragraphs marked
    // right-to-left (lib/pdf-to-word-arabic.ts). That is new on 2026-11-12, so
    // a conversion that fails with it is tried once more without it.
    const pythonScript = `from pdf2docx import Converter
import logging
import sys
import time
${ARABIC_LAYOUT_PY}

class DropQuotedLines(logging.Filter):
    def filter(self, record):
        return not str(record.msg).startswith('Ignore Line')

logging.getLogger().addFilter(DropQuotedLines())
for handler in logging.getLogger().handlers:
    handler.addFilter(DropQuotedLines())

class CountPageErrors(logging.Handler):
    def __init__(self):
        super().__init__(logging.ERROR)
        self.count = 0
    def emit(self, record):
        if str(record.msg).startswith('Ignore page'):
            self.count += 1

page_errors = CountPageErrors()
logging.getLogger().addHandler(page_errors)

def type3_glyphs_as_text(src, dst):
    import fitz
    doc = fitz.open(src)
    changed = 0
    for xref in range(1, doc.xref_length()):
        if doc.xref_get_key(xref, "Subtype")[1] != "/Type3":
            continue
        kind, procs = doc.xref_get_key(xref, "CharProcs")
        if kind == "xref":
            procs = doc.xref_object(int(procs.split()[0]), compressed=True)
        tokens = procs.replace("<<", " ").replace(">>", " ").replace("/", " /").split()
        for i in range(len(tokens) - 2):
            if tokens[i + 2] != "R" or not tokens[i].isdigit():
                continue
            data = doc.xref_stream(int(tokens[i]))
            if not data or data.split(None, 7)[6:7] != [b"d1"]:
                continue
            at = data.find(b"d1") + 2
            doc.update_stream(int(tokens[i]), data[:at] + b" 0 g" + data[at:])
            changed += 1
    if changed:
        doc.save(dst)
    doc.close()
    return dst if changed else src

def only_ocr_text(src):
    import fitz
    doc = fitz.open(src)
    try:
        hidden = 0
        for page in doc:
            for span in page.get_texttrace():
                if span.get("type") != 3:
                    return False
                hidden += 1
        return hidden > 0
    finally:
        doc.close()

try:
    source = type3_glyphs_as_text("${inputPath}", "${type3TextPath}")
except Exception:
    source = "${inputPath}"

# Only an OCR-ed scan gets the ocr setting; every other file converts as before.
try:
    ocr = {"ocr": 2} if only_ocr_text(source) else {}
except Exception:
    ocr = {}

try:
    arabic_undo = arabic_reader()
except Exception:
    arabic_undo = None

try:
    started = time.monotonic()
    cv = Converter(source)
    # Try conversion with error handling for version compatibility
    try:
        try:
            cv.convert("${expectedOutputPath}", start=0, end=None, **ocr)
        except Exception:
            if not (arabic_undo and arabic_lines_fixed):
                raise
            arabic_undo()
            cv.close()
            cv = Converter(source)
            cv.convert("${expectedOutputPath}", start=0, end=None, **ocr)
            print("ARABIC_READER_DROPPED")
        cv.close()
        if page_errors.count and time.monotonic() - started < 50:
            try:
                cv = Converter(source)
                cv.convert("${expectedOutputPath}", start=0, end=None, parse_stream_table=False, **ocr)
                cv.close()
                print("RETRIED")
            except Exception:
                pass
        if source != "${inputPath}":
            print("TYPE3_FIXED")
        if ocr:
            print("OCR_TEXT")
        try:
            if arabic_docx("${expectedOutputPath}"):
                print("ARABIC_FIXED")
        except Exception:
            print("ARABIC_DOCX_FAILED")
        print("SUCCESS")
    except AttributeError as attr_error:
        # Handle version compatibility issues (e.g., 'Rect' object has no attribute 'get_area')
        if 'get_area' in str(attr_error) or 'Rect' in str(attr_error):
            # Try with different parameters or re-raise with better error message
            cv.close()
            print("VERSION_ERROR", file=sys.stderr)
            sys.exit(2)
        else:
            raise
except Exception as e:
    error_msg = str(e)
    # The class name only: the message can quote the document's text.
    print(f"ERROR_TYPE: {type(e).__name__}", file=sys.stderr)
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

    // No shell, own process group: on timeout the python process itself is
    // killed, and this only returns once it has exited, so the cleanup below
    // cannot run before its last write (see lib/run-process.ts).
    const startedAt = Date.now();
    const { stdout, stderr, exitCode, signal, timedOut } = await runProcess('python3', [pythonScriptPath], {
      timeoutMs: PDF2DOCX_TIMEOUT_MS,
      env: {
        ...process.env,
        PATH: updatedPath,
      },
    });
    // Pages, bytes and time on every outcome line, so seconds per page can be
    // read straight off the log.
    const outcome = { ...runLog, elapsedMs: Date.now() - startedAt };

    if (timedOut) {
      logger.warn(
        `[pdf2docx] Timed out; process group killed`,
        { ...outcome, timeoutMs: PDF2DOCX_TIMEOUT_MS, progress: pdf2docxProgress(stderr) },
        requestId
      );
      throw conversionError(`pdf2docx timed out after ${PDF2DOCX_TIMEOUT_MS / 1000}s`, 'TIMEOUT');
    }

    if (exitCode !== 0) {
      // Logged as a summary only (exception class, flags, counts), never the
      // stderr: pdf2docx warnings and exception messages can quote the document.
      const failure = pdf2docxFailureSummary(stderr);

      // Version mismatch (marker from the wrapper, or exit code 2)
      if (failure.versionIssue || exitCode === 2) {
        logger.error(`[pdf2docx] Version compatibility error detected`, { ...outcome, exitCode, ...failure }, requestId);
        throw new Error('pdf2docx version compatibility issue. The installed version may be incompatible. Please update: pip3 install --upgrade pdf2docx');
      }
      
      if (!stdout.includes('SUCCESS')) {
        // pdf2docx 0.5.13 runs against a much newer PyMuPDF and can die in
        // native code on complex layouts; that is a crash, not a rejection, so
        // it gets its own code. Without a shell in between, the crash arrives
        // as the signal itself (SIGSEGV) rather than the shell's exit code 139.
        const crashed = signal !== null || /Segmentation fault|core dumped/i.test(stderr);
        logger.warn(
          `[pdf2docx] Conversion failed`,
          { ...outcome, exitCode, signal, crashed, ...failure },
          requestId
        );
        throw conversionError(
          `pdf2docx conversion failed: ${failure.errorType ?? `exit ${exitCode ?? signal}`}`,
          crashed ? 'CONVERTER_CRASHED' : 'CONVERSION_FAILED'
        );
      }
    }
    
    if (stderr && !stdout.includes('SUCCESS')) {
      logger.warn('[pdf2docx] Exited 0 without SUCCESS', { ...outcome, ...pdf2docxFailureSummary(stderr) }, requestId);
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

    logger.info('[pdf2docx] Converted', {
      ...outcome,
      outputBytes: docxBuffer.length,
      type3Fixed: stdout.includes('TYPE3_FIXED'),
      retriedWithoutStreamTables: stdout.includes('RETRIED'),
      ocrText: stdout.includes('OCR_TEXT'),
      arabic: stdout.includes('ARABIC_FIXED'),
      arabicReaderDropped: stdout.includes('ARABIC_READER_DROPPED'),
      arabicDocxFailed: stdout.includes('ARABIC_DOCX_FAILED'),
    }, requestId);
    
    // Cleanup
    await unlink(inputPath).catch(() => {});
    await unlink(expectedOutputPath).catch(() => {});
    await unlink(pythonScriptPath).catch(() => {});
    await unlink(type3TextPath).catch(() => {});
    
    return docxBuffer;
  } catch (error) {
    // Cleanup on error
    await unlink(inputPath).catch(() => {});
    await unlink(expectedOutputPath).catch(() => {});
    await unlink(pythonScriptPath).catch(() => {});
    await unlink(type3TextPath).catch(() => {});
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
    // (--convert-to docx and a private --outdir are added by convertWithLibreOffice)
    const flags = ['--headless'];
    
    logger.info(`[LibreOffice] Converting: ${inputId}.pdf`, { inputPath, flags }, requestId);
    
    // Create a proper HOME directory for LibreOffice if needed
    const libreOfficeHome = process.env.HOME || tempDir;
    
    // A non-zero exit is not treated as fatal here: whether an output came
    // back decides, as before. A timeout is: the process group is gone by
    // now, so nothing more will be written.
    const { output, stdout, stderr, exitCode, signal, timedOut } = await convertWithLibreOffice(libreOfficeCmd, inputPath, 'docx', {
      flags,
      timeoutMs: LIBREOFFICE_TIMEOUT_MS,
      env: {
        ...process.env,
        PATH: updatedPath,
        HOME: libreOfficeHome, // Use actual HOME or fallback
        'SAL_USE_VCLPLUGIN': 'headless',
        'SAL_DISABLE_OPENCL': '1',
        'SAL_NO_DEFAULT': '1',
      },
    });

    if (timedOut) {
      logger.warn('[LibreOffice] Timed out; process group killed', { timeoutMs: LIBREOFFICE_TIMEOUT_MS }, requestId);
      throw conversionError(`LibreOffice timed out after ${LIBREOFFICE_TIMEOUT_MS / 1000}s`, 'TIMEOUT');
    }
    
    // Log stdout and stderr for debugging (important for production troubleshooting)
    logger.info('LibreOffice conversion stdout', { stdout: stdout || '(empty)', exitCode, signal }, requestId);
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
    
    if (!output) {
      // Enhanced error logging with all diagnostic information
      logger.error('LibreOffice conversion failed: Output file not found', { 
        inputId,
        stdout: stdout || '(empty)',
        stderr: stderr || '(empty)',
        flags,
        exitCode,
        signal,
      }, requestId);
      throw new Error('LibreOffice conversion failed: Output file not found');
    }
    
    logger.info('Found LibreOffice output file', { size: `${(output.length / 1024 / 1024).toFixed(2)}MB` }, requestId);
    await unlink(inputPath).catch(() => {});
    return output;
  } catch (error) {
    // Cleanup on error
    await unlink(inputPath).catch(() => {});
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
        errorCode: 'RATE_LIMITED',
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
  
  let runLog: RunLog | undefined;
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

    // Check this before spending 40+ seconds in the converter: an encrypted or
    // structurally broken PDF fails deep inside the engine, which surfaced as an
    // opaque 500 instead of the actionable "unlock it first" / "not a valid PDF"
    // hint. inspectPdf also touches getPageCount, which is the call that
    // actually throws on a file pdf-lib's lazy load() waved through.
    const inspection = await inspectPdf(buffer);
    if (!inspection.ok) {
      const { errorCode, message, detail } = inspection.rejection;
      logger.warn('PDF rejected before conversion', { errorCode, ...detail }, requestId);
      return NextResponse.json({ error: message, errorCode, requestId }, { status: 400 });
    }

    runLog = { pages: inspection.value.pageCount, bytes: buffer.length, fileRef: fileLogMeta(file).fileRef };

    // Past this many pages one run would take most of the box's free memory,
    // whatever the file contains (see lib/pdf-to-word-limits.ts). Say so now,
    // with the way through, before python starts.
    if (runLog.pages > PDF_TO_WORD_MAX_PAGES) {
      logger.warn('PDF rejected before conversion: too many pages', { ...runLog, maxPages: PDF_TO_WORD_MAX_PAGES }, requestId);
      return NextResponse.json(
        {
          error: 'This PDF has too many pages to convert in one go. Split it into smaller files and convert them one at a time.',
          errorCode: 'TOO_MANY_PAGES',
          requestId,
        },
        { status: 422 }
      );
    }

    logger.info('PDF to Word conversion started', { ...fileLogMeta(file), pages: runLog.pages, bytes: runLog.bytes }, requestId);
    
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
        docxBuffer = await convertPdfToWordPdf2Docx(buffer, requestId, runLog);
        conversionMethod = 'pdf2docx';
      } catch (pdf2docxError) {
        // Deliberately NOT falling back to LibreOffice here. Across the whole
        // production log history it rescued a pdf2docx failure 0 times out of
        // 11, because `libreoffice --convert-to docx <pdf>` is not a real
        // PDF->DOCX path; it only ever burned its full 90s timeout before
        // failing anyway. Failing fast turns a ~135s dead wait into ~45s.
        // (LibreOffice is still the primary engine when pdf2docx is absent.)
        logger.error('pdf2docx conversion failed; LibreOffice fallback skipped (0/11 historical rescues)', {
          ...runLog,
          error: pdf2docxError instanceof Error ? pdf2docxError.message : 'Unknown error',
          errorCode: (pdf2docxError as ConversionError)?.errorCode,
        }, requestId);
        throw pdf2docxError;
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
          logger.error('LibreOffice conversion failed', {
            error: libreOfficeError instanceof Error ? libreOfficeError.message : 'Unknown error',
            errorCode: (libreOfficeError as ConversionError)?.errorCode,
          }, requestId);
          throw conversionError(
            `LibreOffice conversion failed: ${libreOfficeError instanceof Error ? libreOfficeError.message : 'Unknown error'}`,
            'CONVERSION_FAILED'
          );
        }
      } else {
        throw conversionError('No PDF-to-Word engine is available on the server.', 'ENGINE_UNAVAILABLE');
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
      ...runLog,
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
    const err = error as ConversionError;

    // The engine's own output — stderr, tmp paths, stack — is logged here and
    // ONLY here. It used to be echoed straight into the response body, which
    // put "Segmentation fault (core dumped)", a /tmp path and a
    // `pip3 install pdf2docx` instruction on a real user's phone.
    logger.error('PDF to Word conversion failed', {
      ...runLog,
      error: err instanceof Error ? err.message : 'Unknown error',
      errorCode: err?.errorCode,
      stack: err instanceof Error ? err.stack : undefined,
    }, requestId);

    // Ran out of time. Splitting the file is the way through, so the visitor
    // gets that instead of "too complex". It stays a 5xx: a timeout is the box
    // not keeping up, and the back office and GA4 count 5xx as the tool
    // failing, which is the signal that surfaced this incident.
    if (err?.errorCode === 'TIMEOUT') {
      return NextResponse.json(
        {
          error: 'This PDF takes too long to convert in one go. Split it into smaller files and convert them one at a time.',
          errorCode: 'CONVERSION_TIMEOUT',
          requestId,
        },
        { status: 504 }
      );
    }

    if (err?.errorCode === 'ENGINE_UNAVAILABLE') {
      return NextResponse.json(
        {
          error: 'PDF to Word conversion is temporarily unavailable. Please try again in a few minutes.',
          errorCode: 'ENGINE_UNAVAILABLE',
          requestId,
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "We couldn't convert this PDF to Word — its layout is too complex for the converter.",
        errorCode: err?.errorCode === 'CONVERTER_CRASHED' ? 'CONVERTER_CRASHED' : 'CONVERSION_FAILED',
        requestId,
      },
      { status: 500 }
    );
  }
}
