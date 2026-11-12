/**
 * Insert PDF (workspace merge, workspace-spec.md 3.3 and 4.4): the pages of
 * other files appended to the END of the working source, which the editor
 * then reopens in place of it. Reached only through import() from ./index.
 *
 * Why appending to the source and not a new merged document: everything the
 * session already holds keeps meaning. pdf-lib writes every loaded object
 * under its own number and gives new objects numbers above the largest, and
 * writes content streams as loaded, so the existing pages keep their indexes,
 * their detected lines keep their geometry, and keep-font's font objects
 * (named by object number + signature, keep-font/types.ts PdfFontInfo) are
 * still found by the export (tests/edit-pdf-workspace-engine.test.ts, E7).
 *
 * No pruning here: pages the visitor later drops (or an undone insert) are
 * scrubbed and pruned by the export like any deleted page.
 */
import type { PDFDocument, PDFPage } from 'pdf-lib';
import { OBJECTS_PER_TICK, loadSource } from './load';
import { EditPdfError } from './types';
import type { AppendResult } from './types';

export async function appendPdfs(source: Uint8Array, files: readonly { name: string; bytes: Uint8Array }[]): Promise<AppendResult> {
  const doc = await loadSource(source);
  // Cannot happen from the editor (it never opens an encrypted source), and pdf-lib cannot write one.
  if (doc.isEncrypted) throw new EditPdfError('ENCRYPTED');
  const added: AppendResult['added'] = [];
  const skipped: AppendResult['skipped'] = [];

  for (const { name, bytes } of files) {
    let other: PDFDocument;
    try {
      other = await loadSource(bytes);
    } catch {
      skipped.push({ name, reason: 'UNREADABLE' });
      continue;
    }
    if (other.isEncrypted) {
      skipped.push({ name, reason: 'ENCRYPTED' });
      continue;
    }
    let pages: PDFPage[];
    try {
      // The copier moves inherited /MediaBox, /CropBox, /Rotate and /Resources onto each copy.
      pages = await doc.copyPages(other, other.getPageIndices());
    } catch {
      // A broken page tree; whatever was copied before the throw is unreachable and the export prunes it.
      skipped.push({ name, reason: 'UNREADABLE' });
      continue;
    }
    if (pages.length === 0) {
      skipped.push({ name, reason: 'UNREADABLE' });
      continue;
    }
    try {
      for (const page of pages) doc.addPage(page);
    } catch (error) {
      // The working source's own page tree refused the pages: nothing sensible to return.
      throw new EditPdfError('UNREADABLE', error instanceof Error ? error.message : undefined);
    }
    added.push({ name, pages: pages.length });
  }

  if (added.length === 0) return { bytes: source, added, skipped };
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false, objectsPerTick: OBJECTS_PER_TICK });
  return { bytes, added, skipped };
}
