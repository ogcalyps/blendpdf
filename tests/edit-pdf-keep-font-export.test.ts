/**
 * "Keep the font" end to end (keep-font-spec.md section 12, tests 4, 5 and
 * 9): PDFium takes the old line out, the export draws the new text in the
 * line's own font objects, and the result is checked the way a reader sees
 * it: PDFium renders of the page, pdf.js reading the lines back, the font
 * object each new line points at, and the preview's one-line PDF against the
 * export's glyphs.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import { exportEditedPdf } from '../lib/edit-pdf';
import { arabicLetters } from '../lib/edit-pdf/prefill';
import type { EditorPage, ExportOptions, ReplaceObject } from '../lib/edit-pdf';
import { releaseLineFonts } from '../lib/edit-pdf/keep-font/analyze';
import { planReplacement } from '../lib/edit-pdf/keep-font/choose';
import { buildPreviewPdf, dropReplacePreviews, previewDocumentIds, previewPlacement, renderPreviewCanvas } from '../lib/edit-pdf/keep-font/preview';
import type { PreviewPdfJs } from '../lib/edit-pdf/keep-font/preview';
import { createCanvas } from 'canvas';
import { analyzeFile, anyFixture, changedPixels, loadPublicFont, pdfiumChars, renderWithPdfium, replaceWithFont } from './helpers/keep-font';
import type { AnalyzedLine } from './helpers/keep-font';
import { searchableBytes } from './helpers/edit-pdf-oracle';
import { readPdf } from './helpers/pdf-glyph-oracle';
import type { OracleGlyph } from './helpers/pdf-glyph-oracle';
import { CAIRO, PDFIUM_WASM, detectPage, linesOn, pagesText, pdfjs, squash } from './helpers/replace-fixtures';

const noRaster = async (): Promise<never> => {
  throw new Error('no line should need the picture fallback here');
};
const OPTIONS: ExportOptions = { fontBytes: CAIRO, pdfiumWasm: PDFIUM_WASM, loadFont: loadPublicFont, rasterizeText: noRaster };
const pagesOf = (count: number): EditorPage[] => Array.from({ length: count }, (_, i) => ({ id: `s${i}`, source: { kind: 'source', index: i }, rotation: 0 }));
const request = (count: number, objects: ReplaceObject[], fallbackDirection: 'ltr' | 'rtl' = 'ltr') => ({ pages: pagesOf(count), objects, assets: {}, fallbackDirection });

afterAll(() => releaseLineFonts());

/** Every line the editor would offer whose own text plans back onto its own font. */
async function identityObjects(lines: AnalyzedLine[]): Promise<ReplaceObject[]> {
  const objects: ReplaceObject[] = [];
  for (const { line, font } of lines) {
    if (!font || !line.text || line.textUnsure || line.invisible || line.turn === null) continue;
    const object = replaceWithFont(line, font, line.text);
    if ((await planReplacement(object, line.text, { loadFont: loadPublicFont })).kind === 'original') objects.push(object);
  }
  return objects;
}

describe('keep-font export: every line rewritten with its own text looks exactly as before', () => {
  /**
   * Fixture -> [lines rewritten, the most PDFium pixels allowed to differ per
   * page (150 dpi, the spike's pixdiff rule)]. LibreOffice, Word, pdf-lib's
   * form XObject and the rotated page render identically. Chrome's text sits
   * under a 0.75 scale it applies to the whole page and pdf-lib's Helvetica
   * is drawn a string at a time, so their glyph edges anti-alias a little
   * differently where PDFium redraws them; the bound is the spike's
   * measurement plus a margin.
   */
  const CASES: Array<[string, number, number]> = [
    ['c-english-invoice.pdf', 14, 0],
    ['c-arabic-letter.pdf', 8, 0],
    ['d1-form-xobject.pdf', 5, 0],
    ['d2-rotate90-cropbox.pdf', 3, 0],
    ['k1-word-latin.pdf', 9, 0],
    ['k2-word-arabic.pdf', 8, 0],
    ['c4-english-tight.pdf', 12, 0],
    ['f-tagged-3pages.pdf', 5, 0],
    ['e-nontext-under-text.pdf', 4, 0],
    ['a-latin-pdflib.pdf', 9, 150],
    ['b-arabic-chrome.pdf', 13, 60],
    ['g-chrome-tagged-outline.pdf', 6, 600],
    ['k3-chrome-arial-times.pdf', 9, 4500],
  ];

  it.each(CASES)('%s', async (name, count, bound) => {
    const source = anyFixture(name);
    const { lines, pageCount } = await analyzeFile(source);
    const objects = await identityObjects(lines);
    expect(objects).toHaveLength(count);
    const result = await exportEditedPdf(source, request(pageCount, objects), OPTIONS);
    expect(result.removedLines).toBe(count);
    expect(result.warnings).toEqual([]);
    for (const pageIndex of [...new Set(objects.map((o) => o.line.pageIndex))]) {
      const changed = changedPixels(await renderWithPdfium(source, pageIndex), await renderWithPdfium(result.bytes, pageIndex));
      expect(changed, `${name} page ${pageIndex + 1}`).toBeLessThanOrEqual(bound);
    }
    for (const object of objects) {
      const on = linesOn((await detectPage(result.bytes, object.line.pageIndex + 1)).lines, object.line);
      expect(on.map((l) => squash(l.text)), `${name} ${object.line.id}`).toEqual([squash(object.text)]);
    }
  });
});

/** The output page's /KFn font entries: name -> object number. */
async function keptFontRefs(bytes: Uint8Array, pageIndex = 0): Promise<Record<string, number>> {
  const doc = await PDFDocument.load(bytes);
  const fonts = doc.getPage(pageIndex).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const out: Record<string, number> = {};
  for (const [key, value] of fonts.entries()) if (key.decodeText().startsWith('KF') && value instanceof PDFRef) out[key.decodeText()] = value.objectNumber;
  return out;
}

describe('keep-font export: edits in the original font', () => {
  it('LibreOffice invoice: the new line points at the SAME font object PDFium kept (44 0 R); copy and search read the new text', async () => {
    const source = anyFixture('c-english-invoice.pdf');
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === '0:12')!;
    const object = replaceWithFont(line, font, 'Total due: 68.00 GBP');
    const result = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS);
    expect(await keptFontRefs(result.bytes)).toEqual({ KF0: 44 });
    const [now] = linesOn((await detectPage(result.bytes)).lines, line);
    expect(now.text).toBe('Total due: 68.00 GBP');
    expect(Math.abs(now.geometry.start - line.geometry.start)).toBeLessThan(0.01);
    expect(Math.abs(now.geometry.baseline - line.geometry.baseline)).toBeLessThan(0.01);
    expect(squash((await pagesText(result.bytes))[0])).toContain(squash('Total due: 68.00 GBP'));
    expect(squash((await pagesText(result.bytes))[0])).not.toContain('86.00');
    // No Cairo, no look-alike in the file.
    const raw = searchableBytes(result.bytes).toString('latin1');
    expect(raw).not.toMatch(/Cairo|LiberationSans/);
  });

  it('a font PDFium dropped with the line (49 0 R, the title\'s Liberation Serif Bold) is copied from the original and still draws and reads back', async () => {
    const source = anyFixture('c-english-invoice.pdf');
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === '0:0')!;
    const object = replaceWithFont(line, font, 'Northwind Supplies Ltd.');
    const result = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS);
    const refs = await keptFontRefs(result.bytes);
    expect(Object.keys(refs)).toEqual(['KF0']);
    expect(refs.KF0).not.toBe(49);
    const changed = changedPixels(await renderWithPdfium(source, 0), await renderWithPdfium(result.bytes, 0));
    expect(changed).toBe(0);
    expect(linesOn((await detectPage(result.bytes)).lines, line).map((l) => l.text)).toEqual(['Northwind Supplies Ltd.']);
  });

  it('Arabic edits keep the right edge and the font: LibreOffice letter, Word letter, Chrome Arial', async () => {
    for (const [name, id, text] of [
      ['c-arabic-letter.pdf', '0:7', 'المدير العام: خالد بن سعد ____________'],
      ['k2-word-arabic.pdf', '0:2', 'السيد الأستاذ خالد المحترم'],
      ['k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل المرتجعات بعد مرور ثلاثين يوما'],
    ] as const) {
      const source = anyFixture(name);
      const { lines, pageCount } = await analyzeFile(source);
      const { line, font } = lines.find((l) => l.line.id === id)!;
      const object = replaceWithFont(line, font, text);
      expect((await planReplacement(object, text, { loadFont: loadPublicFont })).kind, `${name} plan`).toBe('original');
      const result = await exportEditedPdf(source, request(pageCount, [object], 'rtl'), OPTIONS);
      const on = linesOn((await detectPage(result.bytes)).lines, line);
      expect(on.map((l) => squash(l.text)), name).toEqual([squash(text)]);
      expect(Math.abs(on[0].geometry.end - line.geometry.end), `${name} right edge`).toBeLessThan(0.05);
      expect(Math.abs(on[0].geometry.baseline - line.geometry.baseline)).toBeLessThan(0.05);
      // Every kept font entry is a source font object or its copy: no embedded look-alike.
      const raw = searchableBytes(result.bytes).toString('latin1');
      expect(raw, name).not.toMatch(/NotoSansArabic|NotoNaskhArabic|Cairo-Regular/);
    }
  });

  it('a line inside a form XObject: the new text goes on the page itself, in the page\'s /Resources, on the old baseline', async () => {
    const source = anyFixture('d1-form-xobject.pdf');
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.text.startsWith('Line two'))!;
    const text = 'Line two holds the secret code LOTUS-12';
    const result = await exportEditedPdf(source, request(pageCount, [replaceWithFont(line, font, text)]), OPTIONS);
    expect(Object.keys(await keptFontRefs(result.bytes))).toEqual(['KF0']);
    const [now] = linesOn((await detectPage(result.bytes)).lines, line);
    expect(now.text).toBe(text);
    expect(Math.abs(now.geometry.baseline - line.geometry.baseline)).toBeLessThan(0.01);
  });

  it('a look-alike line embeds only the look-alike it needs, and reads back', async () => {
    const source = anyFixture('c-english-invoice.pdf');
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === '0:12')!;
    const fetched: string[] = [];
    const loadFont = (url: string) => {
      fetched.push(url);
      return loadPublicFont(url);
    };
    const result = await exportEditedPdf(source, request(pageCount, [replaceWithFont(line, font, 'Total due: 86.00 EUR')]), { ...OPTIONS, fontBytes: undefined, loadFont });
    expect([...new Set(fetched)]).toEqual(['/fonts/LiberationSans-Regular.ttf']);
    const raw = searchableBytes(result.bytes).toString('latin1');
    expect(raw).toMatch(/LiberationSans/);
    expect(raw).not.toMatch(/NotoSansArabic|Cairo/);
    expect(linesOn((await detectPage(result.bytes)).lines, line).map((l) => l.text)).toEqual(['Total due: 86.00 EUR']);
  });

  it('rejects an analysis made for another line as INVALID_REQUEST', async () => {
    const source = anyFixture('c-english-invoice.pdf');
    const { lines, pageCount } = await analyzeFile(source);
    const object = replaceWithFont(lines[12].line, lines[3].font, 'x');
    const error = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS).catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe('INVALID_REQUEST');
  });
});

describe("keep-font export: Chrome's viewer (PDFium) copies, finds and highlights the new words", () => {
  /**
   * Compared as PDFium hands text out: NFKC (it splits lam-alef and presentation forms), no spaces, bidi marks
   * or tatweel. Persian look-alikes read as Arabic: a kept font keeps the file's own ToUnicode, and Chrome named
   * k3's Arial yeh Farsi yeh, so the new words read exactly as the untouched lines of that page do.
   */
  const plain = (s: string) => arabicLetters(s).normalize('NFKC').replace(/[\s\u200e\u200f\u202a-\u202e\u0640\ufffe\uffff]/g, '');
  const CASES: Array<[string, string, string]> = [
    ['c-english-invoice.pdf', '0:12', 'Total due: 68.00 GBP'],
    ['a-latin-pdflib.pdf', '0:0', 'Account ÜPDATE €5 done'],
    ['c-arabic-letter.pdf', '0:7', 'المدير العام: خالد بن سعد ____________'],
    ['k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل المرتجعات بعد مرور ثلاثين يوما'],
    ['b-arabic-chrome.pdf', '0:12', 'اشتراك الخدمة'],
  ];

  it.each(CASES)('%s: the page text holds the new words in reading order, each letter in its own place', async (name, id, text) => {
    const source = anyFixture(name);
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === id)!;
    const object = replaceWithFont(line, font, text);
    const plan = await planReplacement(object, text, { loadFont: loadPublicFont });
    expect(plan.kind).toBe('original');
    if (plan.kind !== 'original') return;
    const result = await exportEditedPdf(source, request(pageCount, [object], line.direction), OPTIONS);
    const chars = await pdfiumChars(result.bytes, line.pageIndex);
    // Reading order: an RTL line comes out logical, not mirrored (an /ActualText span reverses it in PDFium before chromium/8000).
    expect(plain(chars.map((c) => c.text).join(''))).toContain(plain(text));
    // Each letter keeps its own box (an /ActualText span crams the whole line into its first glyph's box).
    const g = line.geometry;
    const own = chars.filter((c) => c.text.trim() !== '' && !/\p{M}/u.test(c.text) && (c.top + c.bottom) / 2 > g.baseline - 0.5 * g.size && (c.top + c.bottom) / 2 < g.baseline + g.size);
    const drawn = Math.max(...plan.glyphs.map((p) => p.s + p.advance)) - Math.min(...plan.glyphs.map((p) => p.s));
    expect(own.length).toBeGreaterThan(5);
    expect(Math.max(...own.map((c) => c.right)) - Math.min(...own.map((c) => c.left)), `${name}: the letters spread over the line`).toBeGreaterThan(0.8 * drawn);
    expect(new Set(own.map((c) => Math.round(c.left))).size, `${name}: letters in distinct places`).toBeGreaterThan(0.6 * own.length);
  });
});

describe('keep-font export: an Arabic line in the closest match reads back as typed', () => {
  const plain = (s: string) => s.normalize('NFKC').replace(/[\s\u200e\u200f\u202a-\u202e\u0640\ufffe\uffff]/g, '');
  // Times New Roman (Word) and Amiri (Chrome): naskh faces, whose closest match must still write copyable text.
  const CASES: Array<[string, string, string]> = [
    ['k2-word-arabic.pdf', '0:3', 'نفيدكم بأن طلبكم رقم 5821 قد تمت الموافقة عليه، وسيتم تحويل المبلغ خلال خمسة أيام عمل.'],
    ['b-arabic-chrome.pdf', '0:6', 'مع خالص الشكر والتقدير.'],
  ];

  it.each(CASES)('%s: PDFium (copy and search in Chrome) reads the new words, every dotted letter right', async (name, id, text) => {
    const source = anyFixture(name);
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === id)!;
    const object = replaceWithFont(line, font, text);
    const plan = await planReplacement(object, text, { loadFont: loadPublicFont });
    expect(plan.choice.mode).toBe('lookalike');
    const result = await exportEditedPdf(source, request(pageCount, [object], line.direction), OPTIONS);
    const read = plain((await pdfiumChars(result.bytes, line.pageIndex)).map((c) => c.text).join(''));
    expect(read).toContain(plain(text));
  });
});

/** Glyphs on one display baseline, left to right, with x relative to the first. */
function lineGlyphs(glyphs: OracleGlyph[], y: number | null): Array<{ unicode: string; cid: number; dx: number }> {
  const on = y === null ? glyphs : glyphs.filter((g) => Math.abs(g.y - y) < 3);
  const sorted = [...on].filter((g) => g.unicode.trim() !== '').sort((a, b) => a.x - b.x);
  return sorted.map((g) => ({ unicode: g.unicode, cid: g.cid, dx: Math.round((g.x - sorted[0].x) * 1000) / 1000 }));
}

describe('keep-font preview: the preview is the export', () => {
  const cases: Array<[string, string, string, string]> = [
    ['original', 'c-english-invoice.pdf', '0:12', 'Total due: 68.00 GBP'],
    ['look-alike', 'c-english-invoice.pdf', '0:12', 'Total due: 86.00 EUR'],
    ['original, Arabic', 'k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل المرتجعات بعد مرور ثلاثين يوما'],
    ['look-alike stack, Arabic first', 'k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل الطلبات 25$ (USD)'],
  ];

  it.each(cases)('%s: same glyphs, same codes, same spacing', async (_label, name, id, text) => {
    const source = anyFixture(name);
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === id)!;
    const object = replaceWithFont(line, font, text);
    const sourceDoc = PDFDocument.load(source, { updateMetadata: false });
    const preview = await buildPreviewPdf(object, text, { loadFont: loadPublicFont, source: () => sourceDoc, rasterize: noRaster });
    const result = await exportEditedPdf(source, request(pageCount, [object], line.direction), OPTIONS);
    const exported = (await readPdf(result.bytes))[0];
    const shown = (await readPdf(preview.bytes!))[0];
    const baselineY = exported.height - line.geometry.baseline;
    const fromExport = lineGlyphs(exported.glyphs, baselineY);
    const fromPreview = lineGlyphs(shown.glyphs, null);
    expect(fromPreview.length).toBeGreaterThan(5);
    expect(fromPreview).toEqual(fromExport);
    // The preview page box: the line's start is `left` points from the page's left edge.
    expect(preview.box!.s0).toBeLessThan(line.geometry.start);
    expect(preview.box!.p0).toBeLessThan(line.geometry.baseline);
    expect(preview.box!.p1).toBeGreaterThan(line.geometry.baseline);
  });

  it('a later render of the same object reuses its document and does not grow it', async () => {
    const source = anyFixture('c-english-invoice.pdf');
    const { lines } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === '0:12')!;
    const object = { ...replaceWithFont(line, font, ''), id: 'preview-growth' };
    const deps = { loadFont: loadPublicFont, source: () => PDFDocument.load(source), rasterize: noRaster };
    const sizes: number[] = [];
    for (const text of ['Total due: 68.00 GBP', 'Total due: 86.00 EUR', 'Total due: 68.00 GBP', 'Total due: 86.00 EUR', 'Total due: 68.00 GBP']) {
      sizes.push((await buildPreviewPdf(object, text, deps)).bytes!.length);
    }
    expect(sizes[4]).toBeLessThanOrEqual(sizes[2] + 64);
    expect((await buildPreviewPdf(object, '  ', deps)).bytes).toBeNull();
    const doc = await PDFDocument.load((await buildPreviewPdf(object, 'Total due', deps)).bytes!);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).node.lookup(PDFName.of('Contents'))).toBeInstanceOf(PDFArray);
  });

  it('a line that is gone drops its preview document (and its font copies); the others keep theirs', async () => {
    const source = anyFixture('c-english-invoice.pdf');
    const { lines } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === '0:12')!;
    const deps = { loadFont: loadPublicFont, source: () => PDFDocument.load(source), rasterize: noRaster };
    for (const id of ['kept', 'deleted']) await buildPreviewPdf({ ...replaceWithFont(line, font, ''), id }, 'Total due: 68.00 GBP', deps);
    expect(previewDocumentIds()).toEqual(expect.arrayContaining(['kept', 'deleted']));
    dropReplacePreviews(new Set(['kept']));
    expect(previewDocumentIds()).toEqual(['kept']);
    dropReplacePreviews(new Set());
    expect(previewDocumentIds()).toEqual([]);
  });
});

describe('keep-font preview: the canvas', () => {
  const nodePdfJs: PreviewPdfJs = {
    getDocument: (src) => pdfjs.getDocument({ ...src, disableFontFace: true, isEvalSupported: false, verbosity: 0 }),
  };

  it.each([
    ['original', 'c-english-invoice.pdf', '0:12', 'Total due: 86.00 GBP'],
    ['look-alike', 'c-english-invoice.pdf', '0:12', 'Total due: 86.00 EUR'],
    ['original, Arabic (right edge)', 'k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل المرتجعات بعد مرور ثلاثين يوما على الاستلام.'],
  ])('%s: transparent, and the ink sits where left/top say the line is', async (_label, name, id, text) => {
    const source = anyFixture(name);
    const { lines } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === id)!;
    const object = replaceWithFont(line, font, text);
    const doc = PDFDocument.load(source, { updateMetadata: false });
    const built = await buildPreviewPdf(object, text, { loadFont: loadPublicFont, source: () => doc, rasterize: noRaster });
    const scale = 2;
    const canvas = await renderPreviewCanvas(nodePdfJs, built.bytes!, scale, (w, h) => createCanvas(w, h));
    const { left, top, width, height } = previewPlacement(object, built);
    expect(canvas.width).toBe(Math.ceil(width * scale));
    expect(canvas.height).toBe(Math.ceil(height * scale));
    const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    const alpha = (x: number, y: number) => data[(y * canvas.width + x) * 4 + 3];
    expect([alpha(0, 0), alpha(canvas.width - 1, canvas.height - 1)]).toEqual([0, 0]);
    let minX = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (alpha(x, y) < 128) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    // ReplacePreview.left/top: points from the line's left ink edge to the canvas' left, from the baseline up to its top.
    const g = line.geometry;
    const edge = (line.direction === 'rtl' ? g.end - g.start - left : -left) * scale;
    expect(Math.abs((line.direction === 'rtl' ? maxX : minX) - edge), 'ink starts at the start edge').toBeLessThan(2.5 * scale);
    // Descenders aside, the ink's bottom is at the baseline: `top` points below the canvas top.
    expect(maxY / scale).toBeGreaterThan(top - 1);
    expect(maxY / scale).toBeLessThan(top + g.descent + 1);
    expect(left).toBeLessThan(0);
  });
});
