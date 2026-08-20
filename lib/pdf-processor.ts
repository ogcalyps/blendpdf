import { PDFDocument } from 'pdf-lib';

/**
 * Server-side PDF helpers.
 *
 * The pure pdf-lib operations live in lib/pdf-ops.ts (isomorphic — shared
 * with the client-side Web Worker) and are re-exported here so existing API
 * route imports keep working. Only server-tainted helpers (getPdfJs) and
 * HTTP-specific utilities live in this file. Do NOT import this module from
 * client components or the worker — use lib/pdf-ops.ts there.
 */
export {
  mergePDFs,
  splitPDF,
  rotatePDF,
  rotatePages,
  reorderPages,
  deletePages,
  addPageNumbers,
  watermarkPDF,
  isWinAnsiEncodable,
  EncryptedPdfError,
  UnsupportedTextError,
} from './pdf-ops';

// Lazy-loaded pdf.js instance (used by pdf-to-word and pdf-to-images routes)
let pdfjsLib: any = null;
let pdfjsAvailable = true;

export async function getPdfJs() {
  if (pdfjsLib !== null) {
    return pdfjsLib;
  }

  if (!pdfjsAvailable) {
    throw new Error('pdf.js is not available');
  }

  try {
    // Use older version (3.11.174) which has better Next.js compatibility
    // Use require for CommonJS module (server-side only)
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);

    // Disable worker BEFORE loading pdfjs to prevent worker initialization
    // Set environment variable to disable worker
    if (typeof window === 'undefined') {
      // Set workerSrc to empty string before requiring pdfjs
      // This prevents pdfjs from trying to load a worker
      process.env.PDFJS_DISABLE_WORKER = '1';
    }

    // Use require for older version (CommonJS) - add type assertion
    pdfjsLib = require('pdfjs-dist/build/pdf.js') as any;

    // Disable worker completely for server-side usage (workers are for browsers)
    // This prevents the "Cannot find module" error in Next.js API routes
    if (typeof window === 'undefined') {
      // Disable worker - use synchronous mode for server-side
      // Set to null or empty string to completely disable
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = null as any;
        // Try to prevent worker initialization
        try {
          if (typeof pdfjsLib.GlobalWorkerOptions.setWorkerSrc === 'function') {
            pdfjsLib.GlobalWorkerOptions.setWorkerSrc(null);
          }
        } catch (e) {
          // Ignore if method doesn't exist
        }
      }
    }

    return pdfjsLib;
  } catch (importError) {
    console.warn('pdf.js not available, will use fallback compression:', importError);
    pdfjsAvailable = false;
    pdfjsLib = null;
    throw importError;
  }
}

/**
 * Make a filename safe for use in a Content-Disposition header.
 * HTTP header values must be ASCII; non-Latin filenames (e.g. Arabic) would
 * make NextResponse throw and turn the whole request into a 500.
 * @param name - Proposed filename (may contain non-ASCII characters)
 * @param fallback - Filename to use if nothing usable remains after sanitizing
 * @returns ASCII-only filename safe to embed in a quoted header value
 */
export function toHeaderSafeFilename(name: string, fallback: string): string {
  const safe = name.replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '').trim();
  if (!safe || safe.startsWith('.')) {
    return fallback;
  }
  return safe;
}

/**
 * Get metadata from a PDF file
 * @param pdfBuffer - PDF file buffer
 * @returns PDF metadata object
 * @throws Error if PDF loading or metadata extraction fails
 */
export async function getPDFMetadata(pdfBuffer: ArrayBuffer): Promise<{
  pageCount: number;
  title: string | undefined;
  author: string | undefined;
  subject: string | undefined;
  keywords: string | undefined;
  creator: string | undefined;
  producer: string | undefined;
}> {
  try {
    const pdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });

    return {
      pageCount: pdf.getPageCount(),
      title: pdf.getTitle(),
      author: pdf.getAuthor(),
      subject: pdf.getSubject(),
      keywords: pdf.getKeywords(),
      creator: pdf.getCreator(),
      producer: pdf.getProducer(),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get PDF metadata: ${error.message}`);
    }
    throw new Error('Failed to get PDF metadata: Unknown error');
  }
}
