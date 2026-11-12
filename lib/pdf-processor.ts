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

      // pdf.js paints gradients (shading patterns) with `new DOMMatrix()`,
      // which Node lacks, so /api/pdf-to-images failed on any page with a
      // gradient. node-canvas, which the pages are drawn on, ships one.
      if (typeof globalThis.DOMMatrix === 'undefined') {
        (globalThis as any).DOMMatrix = require('canvas').DOMMatrix;
      }
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
 *
 * This is only the ASCII *fallback* half of the contract — pair it with an
 * RFC 5987 `filename*=UTF-8''<encoded>` parameter so browsers still get the
 * user's real name. Stripping alone turns "مستند-عربي.pdf" into "-.pdf".
 *
 * @param name - Proposed filename (may contain non-ASCII characters)
 * @param fallback - Filename to use if nothing usable remains after sanitizing
 * @returns ASCII-only filename safe to embed in a quoted header value
 */
export function toHeaderSafeFilename(name: string, fallback: string): string {
  const stripped = name.replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '').trim();
  const ext = stripped.match(/\.[^.]*$/)?.[0] ?? '';
  // Stripping a non-Latin name leaves the punctuation that surrounded it —
  // "مستند-عربي_protected.pdf" becomes "-_protected.pdf". Trim those edges so
  // the fallback reads like a filename rather than like a bug.
  const stem = stripped
    .slice(0, stripped.length - ext.length)
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[^A-Za-z0-9]+$/, '');
  if (!stem) {
    return fallback;
  }
  return stem + ext;
}

/**
 * Build a complete Content-Disposition value that survives a non-ASCII name.
 *
 * Emits both halves: a sanitized ASCII `filename=` for old clients and an
 * RFC 5987 `filename*=` carrying the real UTF-8 name, which every current
 * browser prefers. Use this instead of interpolating a filename directly —
 * a raw non-ASCII value makes the Response constructor throw, which is how
 * an Arabic upload turned into a 500.
 */
export function contentDisposition(name: string, fallback: string): string {
  const ascii = toHeaderSafeFilename(name, fallback);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
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
