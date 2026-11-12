import { NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

/**
 * Shared front-door validation for every route that takes a PDF upload.
 *
 * Why this exists: each route hand-rolled its own checks, and they disagreed.
 * Probing production with a file that starts with `%PDF-` and is garbage after
 * that produced four different behaviours from four routes — /api/split and
 * /api/reorder-pdf returned a 500 carrying the raw pdf-lib message
 * ("Cannot read properties of undefined (reading 'Pages')"), /api/protect-pdf
 * returned a 500 with clean copy, and /api/compress returned **200 and echoed
 * the broken bytes back**, so the user downloaded a corrupt file believing it
 * had worked.
 *
 * pdf-lib is lazy, which is the trap: `PDFDocument.load()` accepts a broken
 * file without complaint and it is `getPageCount()` (or any later access) that
 * throws. Guarding only the load is not enough — the whole inspection has to be
 * inside the try.
 */

export type PdfRejection = {
  errorCode: 'INVALID_FILE_CONTENT' | 'ENCRYPTED_PDF';
  /** User-facing copy. Safe to return in a response body. */
  message: string;
  /** Diagnostic detail for the log only — never put this in a response. */
  detail?: Record<string, unknown>;
};

export type PdfInspection = {
  isEncrypted: boolean;
  pageCount: number;
};

/** True when the buffer at least claims to be a PDF. */
export function hasPdfMagicBytes(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.toString('utf8', 0, 5) === '%PDF-';
}

/**
 * Parse and inspect an uploaded PDF.
 *
 * @param opts.allowEncrypted - routes that exist to handle protected files
 *   (unlock-pdf) pass true; everything else should reject them with the
 *   "unlock it first" hint rather than failing deep inside an engine later.
 * @returns the inspection on success, or a rejection describing what is wrong.
 *   Never throws for bad input — a malformed upload is an expected outcome.
 */
export async function inspectPdf(
  buffer: Buffer,
  opts: { allowEncrypted?: boolean } = {}
): Promise<{ ok: true; value: PdfInspection } | { ok: false; rejection: PdfRejection }> {
  if (!hasPdfMagicBytes(buffer)) {
    return {
      ok: false,
      rejection: {
        errorCode: 'INVALID_FILE_CONTENT',
        message: "This file doesn't appear to be a valid PDF.",
        detail: { bytes: buffer.length },
      },
    };
  }

  let isEncrypted: boolean;
  let pageCount: number;
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    isEncrypted = doc.isEncrypted;
    // Deliberately inside the try: this is the call that actually throws on a
    // structurally broken file that load() waved through.
    pageCount = doc.getPageCount();
  } catch (error) {
    return {
      ok: false,
      rejection: {
        errorCode: 'INVALID_FILE_CONTENT',
        message: "Failed to read the PDF. Please make sure it's a valid PDF file.",
        detail: { parseError: error instanceof Error ? error.message : 'Unknown error' },
      },
    };
  }

  if (isEncrypted && !opts.allowEncrypted) {
    return {
      ok: false,
      rejection: {
        errorCode: 'ENCRYPTED_PDF',
        message:
          'This PDF is password-protected. Please use the Unlock PDF tool to remove the password first, then try again.',
      },
    };
  }

  return { ok: true, value: { isEncrypted, pageCount } };
}

/**
 * The 400 every route should return for a rejected upload.
 *
 * `rejection.detail` is deliberately NOT included: it carries the raw engine
 * message, which is exactly what must never reach the client. Log it at the
 * call site with whatever logger that route already uses.
 */
export function pdfRejectionResponse(rejection: PdfRejection, requestId: string) {
  return NextResponse.json(
    { error: rejection.message, errorCode: rejection.errorCode, requestId },
    { status: 400 }
  );
}
