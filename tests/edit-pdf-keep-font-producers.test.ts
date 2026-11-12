/**
 * "Keep the font" on producer habits the real fixtures don't show
 * (keep-font-spec.md sections 2 and 4): horizontal scaling (Tz) with
 * tracking (Tc), a synthetic italic drawn with a slanted text matrix, and
 * font names pdf.js reports differently from the font's /BaseFont (the
 * descriptor's /FontName, a Type0 whose /BaseFont carries the CMap name).
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  StandardFontEmbedder,
  StandardFonts,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSpacing,
  setCharacterSqueeze,
  setFontAndSize,
  setTextMatrix,
  showText,
} from 'pdf-lib';
import type { PDFOperator } from 'pdf-lib';
import { exportEditedPdf } from '../lib/edit-pdf';
import type { EditorPage, ExportOptions, ReplaceObject } from '../lib/edit-pdf';
import { releaseLineFonts } from '../lib/edit-pdf/keep-font/analyze';
import { planReplacement } from '../lib/edit-pdf/keep-font/choose';
import { analyzeFile, anyFixture, changedPixels, loadPublicFont, pdfiumChars, renderWithPdfium, replaceWithFont } from './helpers/keep-font';
import type { AnalyzedLine } from './helpers/keep-font';
import { CAIRO, PDFIUM_WASM, detectPage, linesOn } from './helpers/replace-fixtures';

const OPTIONS: ExportOptions = { fontBytes: CAIRO, pdfiumWasm: PDFIUM_WASM, loadFont: loadPublicFont };
const pagesOf = (count: number): EditorPage[] => Array.from({ length: count }, (_, i) => ({ id: `s${i}`, source: { kind: 'source', index: i }, rotation: 0 }));
const request = (count: number, objects: ReplaceObject[]) => ({ pages: pagesOf(count), objects, assets: {}, fallbackDirection: 'ltr' as const });

afterEach(() => releaseLineFonts());

/** Three Helvetica lines: squeezed to 80 % with 0.4 pt tracking, slanted 0.25 (a synthetic italic), and plain. */
async function styledLines(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([420, 200]);
  const key = page.node.newFontDictionary(font.name, font.ref);
  const line = (ops: PDFOperator[], text: string) =>
    page.pushOperators(pushGraphicsState(), beginText(), setFontAndSize(key, 14), ...ops, showText(font.encodeText(text)), endText(), popGraphicsState());
  line([setCharacterSqueeze(80), setCharacterSpacing(0.4), setTextMatrix(1, 0, 0, 1, 30, 150)], 'Squeezed and tracked words here');
  line([setTextMatrix(1, 0, 0.25, 1, 30, 100)], 'Slanted words like a fake italic');
  line([setTextMatrix(1, 0, 0, 1, 30, 50)], 'Plain upright words for contrast');
  return doc.save();
}

const byText = (lines: AnalyzedLine[], start: string) => {
  const found = lines.find((l) => l.line.text.startsWith(start));
  expect(found?.font, start).toBeTruthy();
  return found!;
};

describe('keep-font: Tz, Tc and a slanted text matrix', () => {
  it('the analysis measures the squeeze, the tracking and the slant; a slanted line reads its true size', async () => {
    const { lines } = await analyzeFile(await styledLines());
    const squeezed = byText(lines, 'Squeezed').font!.data.style;
    expect(squeezed.size).toBeCloseTo(14, 6);
    expect(squeezed.hscale).toBeCloseTo(0.8, 6);
    expect(squeezed.extra * squeezed.size).toBeCloseTo(0.4 * 0.8, 3);
    const slanted = byText(lines, 'Slanted').font!;
    // Across the baseline the em is 14 pt; the slanted y axis is longer (14 x 1.03) but does not draw taller.
    expect(slanted.size).toBeCloseTo(14, 6);
    expect(slanted.data.style.hscale).toBeCloseTo(1, 6);
    expect(slanted.data.style.skew).toBeCloseTo(0.25, 6);
    expect(slanted.data.lookalike.italic).toBe(true);
  });

  it('every line rewritten with its own text renders pixel-identical in PDFium', async () => {
    const source = await styledLines();
    const { lines, pageCount } = await analyzeFile(source);
    const objects: ReplaceObject[] = [];
    for (const { line, font } of lines) {
      const object = replaceWithFont(line, font, line.text);
      expect((await planReplacement(object, line.text, { loadFont: loadPublicFont })).kind, line.text).toBe('original');
      objects.push(object);
    }
    expect(objects).toHaveLength(3);
    for (const object of objects) {
      const result = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS);
      expect(changedPixels(await renderWithPdfium(source, 0), await renderWithPdfium(result.bytes, 0)), object.line.text).toBe(0);
    }
  });

  it('an edit keeps the squeeze and the slant: the new words read back on the old baseline from the old start', async () => {
    const source = await styledLines();
    const { lines, pageCount } = await analyzeFile(source);
    for (const [start, text] of [
      ['Squeezed', 'Squeezed and tracked text here'],
      ['Slanted', 'Slanted text like a fake italic'],
    ] as const) {
      const { line, font } = byText(lines, start);
      const object = replaceWithFont(line, font, text);
      const plan = await planReplacement(object, text, { loadFont: loadPublicFont });
      expect(plan.kind).toBe('original');
      if (plan.kind === 'original') {
        for (const g of plan.glyphs) {
          expect(g.size).toBeCloseTo(14, 6);
          expect(g.hscale).toBeCloseTo(start === 'Squeezed' ? 0.8 : 1, 6);
          expect(g.skew).toBeCloseTo(start === 'Slanted' ? 0.25 : 0, 6);
        }
      }
      const result = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS);
      const [now] = linesOn((await detectPage(result.bytes)).lines, line);
      expect(now.text).toBe(text);
      expect(Math.abs(now.geometry.start - line.geometry.start)).toBeLessThan(0.01);
      expect(Math.abs(now.geometry.baseline - line.geometry.baseline)).toBeLessThan(0.01);
      expect(now.geometry.size).toBeCloseTo(line.geometry.size, 3);
    }
  });

  it("a letter Helvetica's WinAnsi lacks sends the slanted line to the look-alike, drawn oblique", async () => {
    const { lines } = await analyzeFile(await styledLines());
    const { line, font } = byText(lines, 'Slanted');
    const plan = await planReplacement(replaceWithFont(line, font, 'Slanted words like a fake ğ'), 'Slanted words like a fake ğ', { loadFont: loadPublicFont });
    expect(plan.kind === 'vector' && plan.choice.font).toBe('Liberation Sans');
    expect(plan.kind === 'vector' && plan.oblique).toBe(true);
  });
});

/** The fixture with every font object matching `pick` renamed by `rename` (its /BaseFont only). */
async function renamed(name: string, pick: (font: PDFDict) => boolean, rename: (baseFont: string, objectNumber: number) => string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(anyFixture(name), { updateMetadata: false });
  let count = 0;
  for (const [ref, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict) || object.get(PDFName.of('Type')) !== PDFName.of('Font') || !pick(object)) continue;
    const baseFont = object.get(PDFName.of('BaseFont'));
    if (!(baseFont instanceof PDFName)) continue;
    object.set(PDFName.of('BaseFont'), PDFName.of(rename(baseFont.decodeText(), ref.objectNumber)));
    count++;
  }
  expect(count).toBeGreaterThan(0);
  return doc.save({ useObjectStreams: false });
}

const subtypeIs = (subtype: string) => (font: PDFDict) => font.get(PDFName.of('Subtype')) === PDFName.of(subtype);

describe('keep-font: the names pdf.js reports', () => {
  it("a simple font whose /BaseFont differs from its descriptor's /FontName (pdf.js reports the /FontName) still resolves and is reused", async () => {
    const source = await renamed('c-english-invoice.pdf', subtypeIs('TrueType'), (_, n) => `RNMABC+Renamed${n}`);
    const { lines } = await analyzeFile(source);
    const analysed = lines.filter((l) => l.font && l.line.text);
    expect(analysed.length).toBeGreaterThan(10);
    for (const { line, font } of analysed) expect(font!.data.blocked, line.id).toBeNull();
    const { line, font } = lines.find((l) => l.line.id === '0:12')!;
    expect((await planReplacement(replaceWithFont(line, font, 'Total due: 68.00 GBP'), 'Total due: 68.00 GBP', { loadFont: loadPublicFont })).kind).toBe('original');
  });

  it('a Type0 whose /BaseFont carries the CMap name ("-Identity-H", as PDF 32000 suggests; pdf.js reports the descendant\'s) still resolves', async () => {
    const source = await renamed('k3-chrome-arial-times.pdf', subtypeIs('Type0'), (baseFont) => `${baseFont}-Identity-H`);
    const { lines } = await analyzeFile(source);
    const analysed = lines.filter((l) => l.font && l.line.text);
    expect(analysed.length).toBeGreaterThan(5);
    for (const { line, font } of analysed) expect(font!.data.blocked, line.id).toBeNull();
    const { line, font } = lines.find((l) => l.line.id === '0:6')!;
    const text = 'ملاحظة: لا تقبل المرتجعات بعد مرور ثلاثين يوما';
    expect((await planReplacement(replaceWithFont(line, font, text), text, { loadFont: loadPublicFont })).kind).toBe('original');
  });
});

describe('keep-font: zero widths are placeholders, not glyphs', () => {
  it("a Helvetica whose /Widths give 0 to letters the producer never used: those letters go to the look-alike, the rest stay original", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([420, 120]);
    const helvetica = StandardFontEmbedder.for('Helvetica' as Parameters<typeof StandardFontEmbedder.for>[0]);
    const used = new Set('Plain words here');
    const widths: number[] = [];
    for (let code = 32; code <= 126; code++) {
      const ch = String.fromCharCode(code);
      widths.push(used.has(ch) ? (helvetica.font.getWidthOfGlyph(helvetica.encoding.encodeUnicodeCodePoint(code).name) as number) : 0);
    }
    const ref = doc.context.register(
      doc.context.obj({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Helvetica', Encoding: 'WinAnsiEncoding', FirstChar: 32, LastChar: 126, Widths: widths }),
    );
    const key = page.node.newFontDictionary('F1', ref);
    const hex = PDFHexString.of([...'Plain words here'].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    page.pushOperators(pushGraphicsState(), beginText(), setFontAndSize(key, 14), setTextMatrix(1, 0, 0, 1, 30, 60), showText(hex), endText(), popGraphicsState());
    const { lines } = await analyzeFile(await doc.save());
    const { line, font } = byText(lines, 'Plain');
    const plan = (text: string) => planReplacement(replaceWithFont(line, font, text), text, { loadFont: loadPublicFont });
    expect((await plan('Plain words where')).kind).toBe('original');
    const zebra = await plan('Plain Zebra words here');
    expect(zebra.kind === 'vector' && zebra.choice.font).toBe('Liberation Sans');
  });
});

describe('keep-font: a standard 14 font with no /Encoding draws StandardEncoding', () => {
  /** "Total price 100 for the hotel" in a non-embedded Helvetica whose dictionary has no /Encoding (or /WinAnsiEncoding). */
  async function helvetica(encoding: 'WinAnsiEncoding' | null): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([420, 120]);
    const dict: Record<string, string> = { Type: 'Font', Subtype: 'Type1', BaseFont: 'Helvetica' };
    if (encoding) dict.Encoding = encoding;
    const key = page.node.newFontDictionary('F1', doc.context.register(doc.context.obj(dict)));
    const hex = PDFHexString.of([...'Total price 100 for the hotel'].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
    page.pushOperators(pushGraphicsState(), beginText(), setFontAndSize(key, 14), setTextMatrix(1, 0, 0, 1, 30, 60), showText(hex), endText(), popGraphicsState());
    return doc.save();
  }

  it('only the codes StandardEncoding shares with WinAnsi are drawn in it: é, ’, – and € go to the look-alike', async () => {
    const source = await helvetica(null);
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = byText(lines, 'Total');
    const plan = (text: string) => planReplacement(replaceWithFont(line, font, text), text, { loadFont: loadPublicFont });
    for (const text of ['Total price 100 for the hôtel café', 'Total price 100 don’t – €5', "Total price 100 don't", 'Total price `100`']) {
      const decided = await plan(text);
      expect(decided.kind === 'vector' && decided.choice.font, text).toBe('Liberation Sans');
    }
    // Plain ASCII stays in the original font, and reads back as typed.
    const text = 'Total price 120 for the hotel, (incl. tax) #7!';
    expect((await plan(text)).kind).toBe('original');
    const result = await exportEditedPdf(source, request(pageCount, [replaceWithFont(line, font, text)]), OPTIONS);
    expect((await pdfiumChars(result.bytes, 0)).map((c) => c.text).join('')).toBe(text);
  });

  it('with /WinAnsiEncoding the same letters stay in the original font', async () => {
    const { lines } = await analyzeFile(await helvetica('WinAnsiEncoding'));
    const { line, font } = byText(lines, 'Total');
    for (const text of ['Total price 100 for the hôtel café', 'Total price 100 don’t – €5', "Total price 100 don't"]) {
      expect((await planReplacement(replaceWithFont(line, font, text), text, { loadFont: loadPublicFont })).kind, text).toBe('original');
    }
  });
});

describe('keep-font: a font that cannot draw new text only stops edits to its own words', () => {
  it('a Symbol bullet in front of a Helvetica line: the number changes in Helvetica, the bullet is redrawn as it was', async () => {
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const symbol = await doc.embedFont(StandardFonts.Symbol);
    const page = doc.addPage([400, 120]);
    page.drawText('•', { x: 40, y: 60, size: 12, font: symbol });
    page.drawText('Total due 100 EUR', { x: 52, y: 60, size: 12, font: helvetica });
    // Another line on the page: PDFium reads a page whose only text is one line of single-glyph text objects with a
    // wide gap (the bullet's) as vertical writing; real pages have more text.
    page.drawText('Payment is due within thirty days of the invoice date.', { x: 40, y: 90, size: 12, font: helvetica });
    const source = await doc.save();
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.text.includes('Total'))!;
    expect(font!.data.blocked).toBeNull();
    expect(font!.data.faces.map((f) => Object.values(f.fonts)[0].kind)).toEqual(['std14', 'unsupported']);
    const text = line.text.replace('100', '120');
    const plan = await planReplacement(replaceWithFont(line, font, text), text, { loadFont: loadPublicFont });
    expect(plan.kind).toBe('original');
    const result = await exportEditedPdf(source, request(pageCount, [replaceWithFont(line, font, text)]), OPTIONS);
    expect((await pdfiumChars(result.bytes, 0)).map((c) => c.text).join('')).toContain('• Total due 120 EUR');
    // Retyping the bullet itself needs new glyphs from Symbol: the closest match, and the note says the font can't be used.
    const dash = line.text.replace('•', '-');
    expect((await planReplacement(replaceWithFont(line, font, dash), dash, { loadFont: loadPublicFont })).choice).toMatchObject({ mode: 'lookalike', reason: 'font' });
    // An unsupported TWO-byte font (a CMap other than Identity-H) can't even be redrawn: its codes may not be two bytes.
    const data = font!.data;
    const [bulletKey, info] = Object.entries(data.faces[1].fonts)[0];
    const twoByte = { ...data, faces: [data.faces[0], { ...data.faces[1], fonts: { [bulletKey]: { ...info, twoByte: true } } }] };
    const { planLine } = await import('../lib/edit-pdf/keep-font/plan');
    expect(planLine(twoByte, line.text, text, 'ltr', font!.size).missing).toEqual(["font: Symbol can't be redrawn"]);
  });
});


describe('keep-font: a title above the size range', () => {
  it('a 96 pt title stepped down half a point saves at 95.5 pt in its own font; past its own size is refused', async () => {
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([700, 300]);
    page.drawText('Annual Report', { x: 30, y: 160, size: 96, font: helvetica });
    page.drawText('Prepared for the board of directors, October 2026.', { x: 30, y: 60, size: 12, font: helvetica });
    const source = await doc.save();
    const { lines, pageCount } = await analyzeFile(source);
    const title = lines.find((l) => l.line.text === 'Annual Report')!;
    const body = lines.find((l) => l.line.text.startsWith('Prepared'))!;
    expect(title.font!.size).toBeCloseTo(96, 1);
    const object = replaceWithFont(title.line, title.font, 'Annual Review');
    const { autoSize: _auto, ...fixed } = object;
    void _auto;
    const stepped: ReplaceObject = { ...fixed, size: 95.5 };
    const result = await exportEditedPdf(source, request(pageCount, [stepped]), OPTIONS);
    const [now] = linesOn((await detectPage(result.bytes)).lines, title.line);
    expect(now.text).toBe('Annual Review');
    expect(now.geometry.size).toBeCloseTo(95.5, 1);
    const refused = async (o: ReplaceObject) => ((await exportEditedPdf(source, request(pageCount, [o]), OPTIONS).catch((e: unknown) => e)) as { code?: string }).code;
    expect(await refused({ ...stepped, size: 96.5 })).toBe('INVALID_REQUEST');
    // A 12 pt line keeps the range's own end.
    const { autoSize: _a, ...small } = replaceWithFont(body.line, body.font, 'Prepared for the board');
    void _a;
    expect(await refused({ ...small, size: 80 })).toBe('INVALID_REQUEST');
  });
});
