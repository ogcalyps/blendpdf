/**
 * Shared by the "keep the font" engine tests: fixtures (Phase C replace
 * fixtures and the keep-font ones), the font analysis of every line of a
 * file, the shipped fonts read from public/fonts, PDFium page renders and
 * the spike's pixel-difference rule. Tests only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeLineFont, releaseLineFonts } from '../../lib/edit-pdf/keep-font/analyze';
import { loadPdfium } from '../../lib/edit-pdf/pdfium';
import { lineBoxAt } from '../../lib/edit-pdf';
import type { LineFont, ReplaceObject, SourceTextLine } from '../../lib/edit-pdf';
import { detectTextLines } from '../../lib/edit-pdf/lines';
import { PDFIUM_WASM, pdfjs } from './replace-fixtures';

const ROOT = join(__dirname, '..', '..');

/** A fixture from tests/fixtures/edit-pdf/replace (Phase C) or tests/fixtures/edit-pdf/keep-font. */
export function anyFixture(name: string): Uint8Array {
  const dir = /^k\d/.test(name) ? 'keep-font' : 'replace';
  return new Uint8Array(readFileSync(join(ROOT, 'tests', 'fixtures', 'edit-pdf', dir, name)));
}

/** A shipped font's bytes by its URL (/fonts/...), read from public/; cached so fontkit parses each file once. */
const fontCache = new Map<string, Uint8Array>();
export async function loadPublicFont(url: string): Promise<Uint8Array> {
  let bytes = fontCache.get(url);
  if (!bytes) {
    if (!url.startsWith('/fonts/')) throw new Error(`not a shipped font: ${url}`);
    bytes = new Uint8Array(readFileSync(join(ROOT, 'public', url)));
    fontCache.set(url, bytes);
  }
  return bytes;
}

export interface AnalyzedLine {
  line: SourceTextLine;
  font: LineFont | null;
}

/** Every line of every page (first `maxPages`) with its font analysis, as the editor would get them. */
export async function analyzeFile(bytes: Uint8Array, maxPages = 50): Promise<{ file: Blob; lines: AnalyzedLine[]; pageCount: number }> {
  releaseLineFonts();
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const file = new Blob([bytes.slice().buffer as ArrayBuffer]);
  const lines: AnalyzedLine[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      const { lines: found } = await detectTextLines(await doc.getPage(n), n - 1, { ops: pdfjs.OPS });
      for (const line of found) lines.push({ line, font: await analyzeLineFont(file, doc, line, { ops: pdfjs.OPS }) });
    }
    return { file, lines, pageCount: doc.numPages };
  } finally {
    releaseLineFonts();
    await task.destroy();
  }
}

/** A replace object as the editor opens it with a font analysis: autoSize, size = the line size placeholder. */
export function replaceWithFont(line: SourceTextLine, font: LineFont | null, text: string, extra: Partial<ReplaceObject> = {}): ReplaceObject {
  const placeholder = Math.min(72, Math.max(4, Math.round(line.geometry.size * 10) / 10));
  return {
    id: `r-${line.id}`,
    pageId: `s${line.pageIndex}`,
    kind: 'replace',
    line,
    box: lineBoxAt(line, 0),
    text,
    size: placeholder,
    color: line.color,
    ...(font ? { font, autoSize: true as const } : {}),
    ...extra,
  };
}

export interface Rendered {
  width: number;
  height: number;
  /** RGBA, tightly packed. */
  pixels: Uint8Array;
}

/** A page drawn by PDFium (the editor's own 2.15.1) on white, at `dpi`. */
export async function renderWithPdfium(bytes: Uint8Array, pageIndex: number, dpi = 150): Promise<Rendered> {
  const { api, runtime } = await loadPdfium(PDFIUM_WASM);
  const ptr = runtime.wasmExports.malloc(bytes.length);
  runtime.HEAPU8.set(bytes, ptr);
  const doc = api.FPDF_LoadMemDocument(ptr, bytes.length, '');
  if (!doc) throw new Error('PDFium could not open the file');
  try {
    const page = api.FPDF_LoadPage(doc, pageIndex);
    try {
      const width = Math.round((api.FPDF_GetPageWidthF(page) * dpi) / 72);
      const height = Math.round((api.FPDF_GetPageHeightF(page) * dpi) / 72);
      const bitmap = api.FPDFBitmap_Create(width, height, 0);
      try {
        api.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xffffffff);
        api.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, 0x10);
        const stride = api.FPDFBitmap_GetStride(bitmap);
        const buffer = api.FPDFBitmap_GetBuffer(bitmap);
        const raw = runtime.HEAPU8.slice(buffer, buffer + stride * height);
        const pixels = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++) pixels.set(raw.subarray(y * stride, y * stride + width * 4), y * width * 4);
        return { width, height, pixels };
      } finally {
        api.FPDFBitmap_Destroy(bitmap);
      }
    } finally {
      api.FPDF_ClosePage(page);
    }
  } finally {
    api.FPDF_CloseDocument(doc);
    runtime.wasmExports.free(ptr);
  }
}

/** One character of PDFium's text page (FPDFText): what Chrome's viewer copies, searches and highlights. */
export interface PdfiumChar {
  text: string;
  /** The character's box, points (left, right, bottom, top). */
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** PDFium's text of one page, character by character, in the order PDFium reads it. */
export async function pdfiumChars(bytes: Uint8Array, pageIndex: number): Promise<PdfiumChar[]> {
  const { api, runtime } = await loadPdfium(PDFIUM_WASM);
  const ptr = runtime.wasmExports.malloc(bytes.length);
  runtime.HEAPU8.set(bytes, ptr);
  const doc = api.FPDF_LoadMemDocument(ptr, bytes.length, '');
  if (!doc) throw new Error('PDFium could not open the file');
  const box = runtime.wasmExports.malloc(32);
  try {
    const page = api.FPDF_LoadPage(doc, pageIndex);
    const textPage = api.FPDFText_LoadPage(page);
    try {
      const out: PdfiumChar[] = [];
      const count = api.FPDFText_CountChars(textPage);
      for (let i = 0; i < count; i++) {
        api.FPDFText_GetCharBox(textPage, i, box, box + 8, box + 16, box + 24);
        out.push({
          text: String.fromCharCode(api.FPDFText_GetUnicode(textPage, i)),
          left: runtime.getValue(box, 'double'),
          right: runtime.getValue(box + 8, 'double'),
          bottom: runtime.getValue(box + 16, 'double'),
          top: runtime.getValue(box + 24, 'double'),
        });
      }
      return out;
    } finally {
      api.FPDFText_ClosePage(textPage);
      api.FPDF_ClosePage(page);
    }
  } finally {
    runtime.wasmExports.free(box);
    api.FPDF_CloseDocument(doc);
    runtime.wasmExports.free(ptr);
  }
}

/**
 * The keep-font spike's pixdiff rule: per pixel, the luminance of the
 * absolute RGB difference; pixels above 40 count as changed.
 */
export function changedPixels(a: Rendered, b: Rendered, threshold = 40): number {
  if (a.width !== b.width || a.height !== b.height) return Infinity;
  let changed = 0;
  for (let i = 0; i < a.pixels.length; i += 4) {
    const l = 0.299 * Math.abs(a.pixels[i] - b.pixels[i]) + 0.587 * Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) + 0.114 * Math.abs(a.pixels[i + 2] - b.pixels[i + 2]);
    if (l > threshold) changed++;
  }
  return changed;
}
