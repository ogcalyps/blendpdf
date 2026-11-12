/**
 * Shared by the "Edit text (beta)" tests: the Phase C fixtures, PDFium's wasm
 * from node_modules, and pdf.js 3.11 (legacy build, Node) to detect lines
 * and read text back. Tests only; app code reaches pdf.js through
 * lib/pdfjs-init.ts and PDFium through lib/edit-pdf/pdfium.ts.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { detectTextLines } from '../../lib/edit-pdf';
import type { SourceTextLine } from '../../lib/edit-pdf';

const require = createRequire(import.meta.url);
export const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const ROOT = join(__dirname, '..', '..');
export const PDFIUM_WASM = new Uint8Array(readFileSync(join(ROOT, 'node_modules', '@embedpdf', 'pdfium', 'dist', 'pdfium.wasm')));
export const CAIRO = new Uint8Array(readFileSync(join(ROOT, 'public', 'fonts', 'Cairo-Regular.ttf')));

export const fixture = (name: string): Uint8Array => new Uint8Array(readFileSync(join(ROOT, 'tests', 'fixtures', 'edit-pdf', 'replace', name)));

/** What text comparisons ignore: presentation forms, controls, tatweel, all white space. */
export const squash = (s: string): string =>
  s.normalize('NFKC').replace(/[​-‏‪-‮⁦-⁩ـ]/g, '').replace(/\s+/g, '');

async function withDocument<T>(bytes: Uint8Array, run: (doc: any) => Promise<T>): Promise<T> {
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  try {
    return await run(await task.promise);
  } finally {
    await task.destroy();
  }
}

/** detectTextLines on one page (1-based), plus the file's page count. */
export function detectPage(bytes: Uint8Array, pageNumber = 1): Promise<{ lines: SourceTextLine[]; pageCount: number }> {
  return withDocument(bytes, async (doc) => {
    const { lines } = await detectTextLines(await doc.getPage(pageNumber), pageNumber - 1, { ops: pdfjs.OPS });
    return { lines, pageCount: doc.numPages };
  });
}

/** Every page's getTextContent strings, joined per page. */
export function pagesText(bytes: Uint8Array): Promise<string[]> {
  return withDocument(bytes, async (doc) => {
    const out: string[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      out.push((content.items as Array<{ str?: string }>).map((item) => item.str ?? '').join(' '));
    }
    return out;
  });
}

/** The line of `lines` whose prefill starts with `start` (squashed), or the line at that index. */
export function findLine(lines: SourceTextLine[], selector: string | number): SourceTextLine {
  const line = typeof selector === 'number' ? lines[selector] : lines.find((l) => squash(l.text).startsWith(squash(selector)));
  if (!line) throw new Error(`no line ${selector}`);
  return line;
}

/** The same line found again on a re-read page: same axis, baseline and extent. */
export function sameLine(a: SourceTextLine, b: SourceTextLine, tolerance = 0.05): boolean {
  const g = a.geometry;
  const h = b.geometry;
  return (
    Math.abs(g.ux - h.ux) < 1e-6 &&
    Math.abs(g.uy - h.uy) < 1e-6 &&
    Math.abs(g.baseline - h.baseline) < tolerance &&
    Math.abs(g.start - h.start) < tolerance &&
    Math.abs(g.end - h.end) < tolerance
  );
}

/** Any line of `lines` sitting on `target`'s baseline and overlapping its extent (glyphs left on it). */
export function linesOn(lines: SourceTextLine[], target: SourceTextLine): SourceTextLine[] {
  const g = target.geometry;
  return lines.filter((l) => {
    const h = l.geometry;
    return Math.abs(h.ux - g.ux) < 1e-6 && Math.abs(h.uy - g.uy) < 1e-6 && Math.abs(h.baseline - g.baseline) < 0.5 * g.size && h.end > g.start && h.start < g.end;
  });
}

/**
 * A letterhead drawn on every page from ONE form XObject (as Word and
 * LibreOffice headers often are), plus a body line of each page's own.
 * Letterhead token: ACME-SECRET-9; body tokens: BODY1, BODY2, ...
 */
export async function sharedLetterhead(pages = 2): Promise<Uint8Array> {
  const stamp = await PDFDocument.create();
  const stampFont = await stamp.embedFont(StandardFonts.Helvetica);
  stamp.addPage([400, 40]).drawText('Letterhead ACME-SECRET-9', { x: 10, y: 15, size: 12, font: stampFont });
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const [form] = await doc.embedPdf(await stamp.save());
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawPage(form, { x: 56, y: 720 });
    page.drawText(`Body text of page ${i + 1} BODY${i + 1}`, { x: 56, y: 600, size: 12, font });
  }
  return doc.save({ useObjectStreams: false });
}
