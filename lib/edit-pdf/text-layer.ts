/**
 * Does the opened file have a text layer? A scan without one gets the "Make
 * text searchable" offer (workspace-spec.md 4.8). Works on the editor's own
 * pdf.js document: no second copy of the file, no pdf-lib. Reached only
 * through import() from ./index.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * False when none of the first `pages` pages has a text item with something
 * other than spaces. Invisible text (render mode 3, an OCR layer) counts: it
 * IS the text layer, and pdf.js reports it like any other text.
 */
export async function hasTextLayer(pdf: Pick<PDFDocumentProxy, 'numPages' | 'getPage'>, pages = 3): Promise<boolean> {
  const count = Math.min(pdf.numPages, Math.max(1, pages));
  for (let n = 1; n <= count; n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    if (content.items.some((item) => 'str' in item && item.str.trim() !== '')) return true;
  }
  return false;
}
