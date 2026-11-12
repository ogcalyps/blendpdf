/**
 * Opening the visitor's PDF with pdf-lib, shared by inspectPdf (at upload)
 * and the export. Reached only through import().
 */
import { PDFDocument } from 'pdf-lib';
import { EditPdfError } from './types';
import type { PdfInspection } from './types';

/**
 * Objects pdf-lib parses (and writes) between yields to the event loop. Its
 * defaults (100 to parse, 50 to save) cost one setTimeout each, which a
 * browser clamps to about 4 ms: thousands of them on a large file. A few
 * thousand objects per tick keeps the page responsive without that tax.
 */
export const OBJECTS_PER_TICK = 2000;

/** pdf-lib's view of the file. Encrypted files load (ignoreEncryption) so the caller can say so. */
export async function loadSource(source: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(source, { ignoreEncryption: true, updateMetadata: false, parseSpeed: OBJECTS_PER_TICK });
  } catch (error) {
    throw new EditPdfError('UNREADABLE', error instanceof Error ? error.message : undefined);
  }
}

export async function inspectPdf(source: Uint8Array): Promise<PdfInspection> {
  const doc = await loadSource(source);
  // Encryption first: in an AES file (qpdf's default) the page tree sits inside
  // encrypted object streams pdf-lib cannot read, so counting pages would throw
  // and an encrypted file would be reported as damaged.
  if (doc.isEncrypted) {
    let pageCount = 0;
    try {
      pageCount = doc.getPageCount();
    } catch {
      // unknown: the visitor is sent to /unlock-pdf either way
    }
    return { encrypted: true, pageCount };
  }
  try {
    return { encrypted: false, pageCount: doc.getPageCount() };
  } catch (error) {
    throw new EditPdfError('UNREADABLE', error instanceof Error ? error.message : undefined);
  }
}
