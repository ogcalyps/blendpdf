/**
 * "Keep the font": which font a replaced line is drawn in, and at what size
 * (keep-font-spec.md sections 3 and 7, tests 3 and 8). planReplacement is
 * the one decision the preview and the export share.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, rgb, beginText, endText, popGraphicsState, pushGraphicsState, setFontAndSize, setTextMatrix, setTextRenderingMode, showText } from 'pdf-lib';
import { REPLACE_FIT_MAX, REPLACE_FIT_MIN } from '../lib/edit-pdf';
import type { LineFont, ReplaceObject, SourceTextLine } from '../lib/edit-pdf';
import { analyzeLineFont, releaseLineFonts } from '../lib/edit-pdf/keep-font/analyze';
import { planReplacement } from '../lib/edit-pdf/keep-font/choose';
import type { PlanDeps } from '../lib/edit-pdf/keep-font/choose';
import type { FaceInventory, GlyphEntry, LineFontData, ReplacementPlan } from '../lib/edit-pdf/keep-font/types';
import { foldText } from '../lib/edit-pdf/keep-font/arabic';
import { planLine, shapeInFace } from '../lib/edit-pdf/keep-font/plan';
import { detectTextLines } from '../lib/edit-pdf/lines';
import { analyzeFile, anyFixture, loadPublicFont, replaceWithFont } from './helpers/keep-font';
import type { AnalyzedLine } from './helpers/keep-font';
import { pdfjs } from './helpers/replace-fixtures';

const DEPS: PlanDeps = { loadFont: loadPublicFont };
const files = new Map<string, AnalyzedLine[]>();

beforeAll(async () => {
  for (const name of ['a-latin-pdflib.pdf', 'b-arabic-chrome.pdf', 'c-arabic-letter.pdf', 'c-english-invoice.pdf', 'k1-word-latin.pdf', 'k3-chrome-arial-times.pdf', 'i-arabic-times-chrome.pdf']) {
    files.set(name, (await analyzeFile(anyFixture(name))).lines);
  }
});
afterAll(() => releaseLineFonts());

function lineOf(name: string, id: string): { line: SourceTextLine; font: LineFont } {
  const found = files.get(name)!.find((l) => l.line.id === id)!;
  expect(found.font, `${name} ${id} analysed`).not.toBeNull();
  return { line: found.line, font: found.font! };
}

async function decide(name: string, id: string, text: string, extra: Partial<ReplaceObject> = {}): Promise<ReplacementPlan> {
  const { line, font } = lineOf(name, id);
  return planReplacement(replaceWithFont(line, font, text, extra), text, DEPS);
}

const summary = (plan: ReplacementPlan) => ({ kind: plan.kind, ...plan.choice });

describe('keep-font decisions', () => {
  it('a standard 14 font (pdf-lib Helvetica) draws any WinAnsi text in itself', async () => {
    expect(summary(await decide('a-latin-pdflib.pdf', '0:4', 'Settlement reference ZQ-9981 is confirmed for Friday évening. Please bring the'))).toEqual({
      kind: 'original',
      mode: 'original',
      font: null,
      reason: null,
      sameFamily: false,
    });
    expect((await decide('a-latin-pdflib.pdf', '0:0', 'Account ÜPDATE €5 – “done”')).kind).toBe('original');
  });

  it('LibreOffice invoice (Arial subset): digits it has stay original; a capital it never used goes to Liberation Sans', async () => {
    expect((await decide('c-english-invoice.pdf', '0:12', 'Total due: 68.00 GBP')).kind).toBe('original');
    const plan = await decide('c-english-invoice.pdf', '0:12', 'Total due: 86.00 EUR');
    expect(summary(plan)).toEqual({ kind: 'vector', mode: 'lookalike', font: 'Liberation Sans', reason: 'letters', sameFamily: false });
    if (plan.kind !== 'vector') return;
    // Liberation Sans has every letter: its Arabic companion is not even fetched.
    expect(plan.fonts).toEqual(['/fonts/LiberationSans-Regular.ttf']);
    expect(plan.oblique).toBe(false);
  });

  it('a Liberation Serif line stays in its own family: no note', async () => {
    const plan = await decide('c-english-invoice.pdf', '0:0', 'Northwind Supplies Ltd. Wxyz');
    expect(summary(plan)).toEqual({ kind: 'vector', mode: 'lookalike', font: 'Liberation Serif', reason: 'letters', sameFamily: true });
    if (plan.kind === 'vector') expect(plan.fonts[0]).toBe('/fonts/LiberationSerif-Bold.ttf');
  });

  it('Chrome Arabic (Arial): a word with a letter form the page never showed goes to Noto Sans Arabic, Arabic first in the stack', async () => {
    expect((await decide('k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل المرتجعات بعد مرور ثلاثين يوما على الاستلام.')).kind).toBe('original');
    const plan = await decide('k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل الطلبات بعد مرور ثلاثين يوما على الاستلام.');
    expect(summary(plan)).toEqual({ kind: 'vector', mode: 'lookalike', font: 'Noto Sans Arabic', reason: 'letters', sameFamily: false });
    if (plan.kind === 'vector') expect(plan.fonts).toEqual(['/fonts/NotoSansArabic-Regular.ttf']);
    // "$ ( ) U S D" are not in Noto Sans Arabic: Liberation Sans joins the stack, after it.
    const mixed = await decide('k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل الطلبات 25$ (USD)');
    expect(mixed.kind === 'vector' && mixed.fonts).toEqual(['/fonts/NotoSansArabic-Regular.ttf', '/fonts/LiberationSans-Regular.ttf']);
  });

  it("Chrome Times New Roman Arabic: a new word's heh is drawn with the glyph the file names heh doachashmee", async () => {
    const { line } = lineOf('i-arabic-times-chrome.pdf', '0:1');
    expect(line.text).toBe('تشهد شركة الأطلس للتجارة بأن السيد محمد العلوي يعمل لديها بصفة محاسب منذ 1 يناير 2021.');
    expect((await decide('i-arabic-times-chrome.pdf', '0:1', line.text.replace('2021', '2022'))).kind).toBe('original');
    // فيها: medial yeh and medial heh, which the file only names as Farsi yeh and heh doachashmee.
    expect((await decide('i-arabic-times-chrome.pdf', '0:1', line.text.replace('لديها', 'فيها'))).kind).toBe('original');
  });

  it('a CHANGED word with a haraka goes to the look-alike; a vowelled line left as it is stays original', async () => {
    expect(summary(await decide('k3-chrome-arial-times.pdf', '0:2', 'اسم العميل: مُحَمَّد النخيل للمقاولات، الرياض'))).toEqual({
      kind: 'vector',
      mode: 'lookalike',
      font: 'Noto Sans Arabic',
      reason: 'letters',
      sameFamily: false,
    });
    const { line } = lineOf('k3-chrome-arial-times.pdf', '0:5');
    expect(line.text).toMatch(/[ً-ْ]/);
    expect((await decide('k3-chrome-arial-times.pdf', '0:5', line.text)).kind).toBe('original');
  });

  it("Amiri (contextual alternates): a word whose letters' neighbours were never seen is not exact, so Noto Sans Arabic", async () => {
    const { line, font } = lineOf('b-arabic-chrome.pdf', '0:5');
    const words = line.text.split(' ');
    const text = ['المدير', ...words.slice(1)].join(' ');
    const { planLine } = await import('../lib/edit-pdf/keep-font/plan');
    const exact = planLine(font.data, line.text, text, line.direction, font.size);
    expect(exact.ok).toBe(true);
    expect(exact.approx.length).toBeGreaterThan(0);
    expect(summary(await decide('b-arabic-chrome.pdf', '0:5', text))).toEqual({ kind: 'vector', mode: 'lookalike', font: 'Noto Sans Arabic', reason: 'letters', sameFamily: false });
  });

  it('lam-alef is mandatory: a face that never showed it as one glyph is missing it, never draws a lone lam and alef', async () => {
    const { line, font } = lineOf('c-arabic-letter.pdf', '0:0');
    const face = font.data.faces[0];
    expect(face.ligatures).not.toContain('لا');
    expect(face.lamAlefLigature).toBe(true);
    // The face has an initial lam, a medial lam and a final alef, so a split would "work": it must not be used.
    for (const unit of ['ل|init', 'ل|medi', 'ا|fina']) expect(face.units[unit]?.length, unit).toBeGreaterThan(0);
    const text = line.text.replace('المالية', 'كلا');
    const { planLine } = await import('../lib/edit-pdf/keep-font/plan');
    expect(planLine(font.data, line.text, text, line.direction, font.size).missing).toEqual(['لا.fina']);
    expect(summary(await decide('c-arabic-letter.pdf', '0:0', text))).toEqual({ kind: 'vector', mode: 'lookalike', font: 'Noto Sans Arabic', reason: 'letters', sameFamily: false });
  });

  it("new letters take the producer's own kerning between a pair it kerned", async () => {
    const { line, font } = lineOf('k1-word-latin.pdf', '0:1');
    const { data } = font;
    const face = data.faces[0];
    // Which letter each (font, code) of the face draws.
    const letterOf = new Map<string, string>();
    for (const [key, entries] of Object.entries(face.units)) {
      const [text, form] = key.split('|');
      if (form === 'n' && /^[A-Za-z]$/.test(text)) for (const e of entries) letterOf.set(`${e.font}:${e.code}`, text);
    }
    // A pair Word kerned (its gap differs from the line's tracking) whose letters the face has.
    const kerned = Object.entries(face.kern).find(([pair, gap]) => Math.abs(gap - data.style.extra) > 0.01 && pair.split(',').every((g) => letterOf.has(g)));
    expect(kerned, 'k1 has kerned letter pairs').toBeTruthy();
    const [pair, gap] = kerned!;
    const [a, b] = pair.split(',');
    const word = `${letterOf.get(a)}${letterOf.get(b)}`;
    const text = line.text.replace(/\S+$/, word);
    const { planLine } = await import('../lib/edit-pdf/keep-font/plan');
    const plan = planLine(data, line.text, text, line.direction, font.size);
    expect(plan.ok && plan.approx).toEqual([]);
    const fresh = plan.glyphs.filter((g) => !g.verbatim && g.code >= 0);
    const at = fresh.findIndex((g, i) => `${g.font}:${g.code}` === a && fresh[i + 1] && `${fresh[i + 1].font}:${fresh[i + 1].code}` === b);
    expect(at, word).toBeGreaterThanOrEqual(0);
    const first = fresh[at];
    expect((fresh[at + 1].s - (first.s + first.advance)) / data.style.size).toBeCloseTo(gap, 4);
  });

  it('Carlito with a letter its subset lacks: Carlito itself, no note', async () => {
    expect(summary(await decide('k1-word-latin.pdf', '0:1', 'Client: Harbor Street Bakery Ltd, 14 Harbor Street, Portsmouth PO1 2AZ'))).toEqual({
      kind: 'vector',
      mode: 'lookalike',
      font: 'Carlito',
      reason: 'letters',
      sameFamily: true,
    });
  });

  it('a bold label on the line: the closest match draws it regular, so the note shows even for its own family', async () => {
    const { line } = lineOf('k1-word-latin.pdf', '0:3');
    expect(line.text.startsWith('Reference: ')).toBe(true);
    for (const text of [line.text.replace('Johnson', 'Zhang'), line.text.replace('Johnson', 'Jóhnson'), `${line.text} €5`]) {
      expect(summary(await decide('k1-word-latin.pdf', '0:3', text)), text).toEqual({ kind: 'vector', mode: 'lookalike', font: 'Carlito', reason: 'letters', sameFamily: false });
    }
  });

  it('own family only when the file drawn is the original look: the weight shipped, upright', async () => {
    const { pickLookalike, lookalikeFile } = await import('../lib/edit-pdf/keep-font/lookalike');
    const pick = (name: string, flags: number, weight: number | null, angle = 0) => pickLookalike(name, flags, weight, angle);
    // Bold files for Cambria's and Courier's look-alikes are shipped now.
    for (const [name, family, file] of [
      ['BAAAAA+Caladea-Bold', 'Caladea', '/fonts/Caladea-Bold.ttf'],
      ['BAAAAA+LiberationMono-Bold', 'Liberation Mono', '/fonts/LiberationMono-Bold.ttf'],
    ] as const) {
      const p = pick(name, 262178, 700);
      expect(p.latin).toBe(family);
      expect(p.sameFamily.latin, name).toBe(true);
      expect(lookalikeFile(p.latin, p.bold)).toBe(file);
    }
    expect(pick('BAAAAA+Cambria-Bold', 262178, 700).latin).toBe('Caladea');
    // No Cairo bold, no italic files: the note shows.
    expect(pick('BAAAAA+Cairo-Bold', 4, 700).sameFamily).toEqual({ latin: false, arabic: false });
    expect(pick('BAAAAA+Carlito-Italic', 68, 400, -11).sameFamily.latin).toBe(false);
    expect(pick('BAAAAA+LiberationSerif-Italic', 70, null, -15).sameFamily.latin).toBe(false);
    expect(pick('BAAAAA+Carlito', 4, 400).sameFamily.latin).toBe(true);
  });

  it('an italic line: the look-alike is drawn as an oblique; a bold one takes the bold file', async () => {
    const italic = await decide('k1-word-latin.pdf', '0:8', 'Signed in Zurich');
    expect(italic.kind === 'vector' && italic.oblique).toBe(true);
    expect(italic.choice.sameFamily).toBe(false);
    const bold = await decide('k1-word-latin.pdf', '0:0', 'Quarterly Service Agreement X');
    expect(bold.kind === 'vector' && bold.fonts[0]).toBe('/fonts/Carlito-Bold.ttf');
  });

  it("empty text: the line is taken out, nothing is drawn, no note", async () => {
    expect(summary(await decide('c-english-invoice.pdf', '0:12', '   '))).toEqual({ kind: 'empty', mode: 'original', font: null, reason: null, sameFamily: false });
  });

  it('no analysis: Cairo, as in Phase C, at the object size', async () => {
    const { line } = lineOf('c-english-invoice.pdf', '0:12');
    const object = replaceWithFont(line, null, 'Total due: 99.00 GBP', { size: 10.5 });
    const plan = await planReplacement(object, object.text, DEPS);
    expect(summary(plan)).toEqual({ kind: 'vector', mode: 'cairo', font: 'Cairo', reason: 'font', sameFamily: false });
    expect(plan.size).toBe(10.5);
    // An analysis made for another line is not used.
    const other = lineOf('c-english-invoice.pdf', '0:3').font;
    expect((await planReplacement({ ...object, font: other, autoSize: true }, object.text, DEPS)).choice.mode).toBe('cairo');
  });

  it("pdf-lib can't read the file: the closest match is still picked from pdf.js's font name, never Cairo", async () => {
    for (const [name, id, family] of [
      ['a-latin-pdflib.pdf', '0:4', 'Liberation Sans'],
      ['c-english-invoice.pdf', '0:0', 'Liberation Serif'],
    ] as const) {
      const bytes = anyFixture(name);
      const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
      const pdf = await task.promise;
      try {
        const line = (await detectTextLines(await pdf.getPage(1), 0, { ops: pdfjs.OPS })).lines.find((l) => l.id === id)!;
        // Bytes pdf-lib can't parse, with the editor's (working) pdf.js document.
        const font = await analyzeLineFont(new Blob([new Uint8Array([1, 2, 3])]), pdf, line, { ops: pdfjs.OPS });
        expect(font?.data.blocked, name).toBe('unresolved');
        const plan = await planReplacement(replaceWithFont(line, font, `${line.text} more`), `${line.text} more`, DEPS);
        expect(plan.choice).toMatchObject({ mode: 'lookalike', font: family, reason: 'font' });
      } finally {
        releaseLineFonts();
        await task.destroy();
      }
    }
  });

  it("a font the analysis can't reuse at all: the look-alike, reason 'font'", async () => {
    const { line, font } = lineOf('c-english-invoice.pdf', '0:12');
    const blocked: LineFont = { ...font, data: { ...font.data, blocked: 'unsupported-font' } as LineFontData };
    expect(summary(await planReplacement(replaceWithFont(line, blocked, 'Total due: 68.00 GBP'), 'Total due: 68.00 GBP', DEPS))).toEqual({
      kind: 'vector',
      mode: 'lookalike',
      font: 'Liberation Sans',
      reason: 'font',
      sameFamily: false,
    });
  });

  it('the look-alike lacks a character (or did not load): Cairo; Cairo lacks one too: a picture', async () => {
    const { line, font } = lineOf('k1-word-latin.pdf', '0:4');
    const latinOnly: LineFont = { ...font, data: { ...font.data, lookalike: { ...font.data.lookalike, latin: 'Caladea', arabic: 'Caladea' } } as LineFontData };
    const arabic = 'Monthly fee شهري';
    const lacking = await planReplacement(replaceWithFont(line, latinOnly, arabic), arabic, DEPS);
    expect(summary(lacking)).toEqual({ kind: 'vector', mode: 'cairo', font: 'Cairo', reason: 'letters', sameFamily: false });
    expect('transient' in lacking).toBe(false);
    // A look-alike that did not load: Cairo for now, marked so the preview does not keep it (the save fetches it again).
    const offline: PlanDeps = { loadFont: (url) => (url.includes('Cairo') ? loadPublicFont(url) : Promise.reject(new Error('offline'))) };
    const unloaded = await planReplacement(replaceWithFont(line, font, 'Monthly fee Z'), 'Monthly fee Z', offline);
    expect(unloaded.choice).toEqual({ mode: 'cairo', font: 'Cairo', reason: 'letters', sameFamily: false });
    expect(unloaded.kind === 'vector' && unloaded.transient).toBe(true);
    expect(summary(await planReplacement(replaceWithFont(line, font, 'Monthly fee ✓ 漢'), 'Monthly fee ✓ 漢', DEPS))).toEqual({ kind: 'image', mode: 'image', font: null, reason: 'letters', sameFamily: false });
  });

  it('text drawn by stroking (render mode 2) is not reused: the bold look-alike, reason font', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([400, 120]);
    const key = page.node.newFontDictionary(font.name, font.ref);
    page.pushOperators(pushGraphicsState(), beginText(), setFontAndSize(key, 14), setTextRenderingMode(2), setTextMatrix(1, 0, 0, 1, 30, 60), showText(font.encodeText('Heavy heading')), endText(), popGraphicsState());
    const bytes = await doc.save();
    const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
    const pdf = await task.promise;
    try {
      const [line] = (await detectTextLines(await pdf.getPage(1), 0, { ops: pdfjs.OPS })).lines;
      const analysis = await analyzeLineFont(new Blob([bytes.slice().buffer as ArrayBuffer]), pdf, line, { ops: pdfjs.OPS });
      expect(analysis?.data.blocked).toBe('render-mode');
      expect(analysis?.data.lookalike.bold).toBe(true);
      const plan = await planReplacement(replaceWithFont(line, analysis, 'Heavy heading'), 'Heavy heading', DEPS);
      expect(summary(plan)).toEqual({ kind: 'vector', mode: 'lookalike', font: 'Liberation Sans', reason: 'font', sameFamily: false });
      expect(plan.kind === 'vector' && plan.fonts[0]).toBe('/fonts/LiberationSans-Bold.ttf');
    } finally {
      releaseLineFonts();
      await task.destroy();
    }
  });
});

describe('keep-font: a glyph stands for its own character', () => {
  it('a typed 2 is never drawn with the superscript ² the line already has (no NFKC folding)', async () => {
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([400, 120]).drawText('Area 12 m²', { x: 40, y: 60, size: 14, font: helvetica });
    const bytes = await doc.save();
    const { lines } = await analyzeFile(bytes);
    const { line, font } = lines[0];
    const text = 'Area 12 m² in Q2';
    const plan = await planReplacement(replaceWithFont(line, font, text), text, DEPS);
    expect(plan.kind).toBe('original');
    if (plan.kind !== 'original') return;
    // ² is 0xB2 in WinAnsi, 2 is 0x32: "Q2" ends with the digit, "m²" keeps its superscript.
    const codes = plan.glyphs.filter((g) => g.code !== 0x20).map((g) => g.code);
    expect(codes.slice(-2)).toEqual([0x51, 0x32]);
    expect(codes.filter((c) => c === 0xb2)).toHaveLength(1);
  });

  it('keys fold only what IS its decomposition: presentation forms, ﷲ and Latin ligatures; never ², º or ™', () => {
    expect(foldText('ﻟ')).toBe('ل');
    expect(foldText('ﷲ')).toBe('الله');
    expect(foldText('ﬁ')).toBe('fi');
    expect(foldText('e\u0301')).toBe('é');
    for (const kept of ['²', '₂', 'º', 'ª', '½', '…', '™']) expect(foldText(kept)).toBe(kept);
  });

  it("a digit with a glyph per script is picked by the strong text around its word, as the harvest saw it across the line", () => {
    const entry = (code: number, context: string): GlyphEntry => ({ font: '1 0', code, width: 500, count: 3, source: 'harvest', contexts: { [context]: 3 } });
    const face = {
      key: 'F|type0-identity|4',
      face: 'F',
      fonts: {},
      units: { '1|n': [entry(10, 'L_L'), entry(20, 'A_A')] },
      kern: {},
      markOffsets: {},
      space: null,
      ligatures: [],
      lamAlefLigature: true,
      contextual: false,
      arabicInPieces: false,
    } as FaceInventory;
    expect(shapeInFace(face, '1', 'rtl', { left: 'A', right: 'A' }).glyphs.map((g) => g.code)).toEqual([20]);
    expect(shapeInFace(face, '1', 'ltr', { left: 'L', right: 'L' }).glyphs.map((g) => g.code)).toEqual([10]);
    // planLine gives a changed word the scripts of the words around it: "x 2" picks the 2 seen after Latin, not the commoner one.
    const two = (code: number, context: string, count: number): GlyphEntry => ({ ...entry(code, context), count, contexts: { [context]: count } });
    const info = { key: '1 0', objectNumber: 1, generation: 0, kind: 'type0-identity' as const, baseFont: 'F', face: 'F', twoByte: true, signature: 's', flags: 4, italicAngle: 0, weight: null };
    const lineFace = { ...face, fonts: { '1 0': info }, units: { 'x|n': [entry(30, '-_-')], '1|n': [entry(40, 'L_-')], '2|n': [two(50, 'L_-', 1), two(60, 'A_-', 5)] } } as FaceInventory;
    const glyph = (code: number, text: string, s: number) => ({ font: 'f1', code, text, width: 500, isSpace: text === ' ', s, p: 100, sx: 12, sy: 12, skew: 0, fill: '#000000' as const, mode: 0 });
    const data: LineFontData = {
      version: 1,
      fontKeys: { f1: '1 0' },
      faces: [lineFace],
      faceOf: { '1 0': 0 },
      glyphs: [glyph(30, 'x', 0), glyph(40, '1', 10)],
      line: { size: 12, baseline: 100, start: 0, end: 16 },
      style: { size: 12, hscale: 1, extra: 0, wordGap: 4, skew: 0 },
      blocked: null,
      lookalike: { latin: 'Liberation Sans', arabic: 'Noto Sans Arabic', bold: false, italic: false, sameFamily: { latin: false, arabic: false } },
    };
    const plan = planLine(data, 'x 1', 'x 2', 'ltr', 12);
    expect(plan.ok && plan.approx).toEqual([]);
    expect(plan.glyphs.map((g) => g.code)).toEqual([30, 50]);
  });
});

describe('keep-font: a changed word takes the look of the word it replaces', () => {
  /** One line from pieces drawn side by side: [text, font, size, colour, rise]. */
  async function pieces(parts: Array<[string, 'bold' | 'regular', number, [number, number, number], number?]>, gapEm: number): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const fonts = { bold: await doc.embedFont(StandardFonts.HelveticaBold), regular: await doc.embedFont(StandardFonts.Helvetica) };
    const page = doc.addPage([420, 120]);
    let x = 30;
    for (const [text, weight, size, [r, g, b], rise = 0] of parts) {
      const font = fonts[weight];
      page.drawText(text, { x, y: 60 + rise, size, font, color: rgb(r, g, b) });
      x += font.widthOfTextAtSize(text, size) + gapEm * 12;
    }
    return doc.save();
  }
  const BLACK: [number, number, number] = [0, 0, 0];

  it('a word whose letters use two fonts ("Total:" bold run into "100") is not exact: the closest match, reason font', async () => {
    const { lines } = await analyzeFile(await pieces([['Total:', 'bold', 12, BLACK], ['100 EUR', 'regular', 12, BLACK]], 0.1));
    const { line, font } = lines[0];
    expect(line.text).toBe('Total:100 EUR');
    const text = line.text.replace('100', '120');
    const plan = await planReplacement(replaceWithFont(line, font, text), text, DEPS);
    expect(summary(plan)).toMatchObject({ kind: 'vector', mode: 'lookalike', reason: 'font' });
    // Apart, each word has one font: the number stays regular, in the original.
    const { lines: apart } = await analyzeFile(await pieces([['Total:', 'bold', 12, BLACK], ['100 EUR', 'regular', 12, BLACK]], 0.3));
    const kept = await planReplacement(replaceWithFont(apart[0].line, apart[0].font, 'Total: 120 EUR'), 'Total: 120 EUR', DEPS);
    expect(kept.kind).toBe('original');
    if (kept.kind !== 'original') return;
    const regular = Object.keys(kept.fonts).find((key) => kept.fonts[key].baseFont === 'Helvetica');
    expect(kept.glyphs.filter((g) => !g.verbatim && g.code >= 0x30 && g.code <= 0x39).every((g) => g.font === regular)).toBe(true);
  });

  it('a raised, smaller, red word keeps its size, rise and colour; smaller letters inside a word are not exact', async () => {
    const red: [number, number, number] = [0.8, 0, 0];
    const { lines } = await analyzeFile(await pieces([['Total 100 ', 'regular', 12, BLACK], ['EUR', 'regular', 8, red, 4]], 0));
    const { line, font } = lines[0];
    expect(line.text).toBe('Total 100 EUR');
    const text = line.text.replace('EUR', 'USD');
    const plan = await planReplacement(replaceWithFont(line, font, text), text, DEPS);
    expect(plan.kind).toBe('original');
    if (plan.kind !== 'original') return;
    const usd = plan.glyphs.filter((g) => !g.verbatim && g.code !== 0x20);
    expect(usd).toHaveLength(3);
    const eur = font!.data.glyphs.find((g) => g.text === 'E')!;
    const total = font!.data.glyphs.find((g) => g.text === 'T')!;
    expect(eur.p - total.p).toBeCloseTo(4, 3);
    for (const g of usd) {
      expect(g.size).toBeCloseTo(8, 6);
      expect(g.p).toBeCloseTo(eur.p - font!.data.line.baseline, 6);
      expect(g.fill.toLowerCase()).toBe('#cc0000');
    }
    // A chosen colour still paints every glyph.
    const blue = await planReplacement(replaceWithFont(line, font, text, { color: '#2563EB' }), text, DEPS);
    expect(blue.kind === 'original' && new Set(blue.glyphs.map((g) => g.fill))).toEqual(new Set(['#2563EB']));
    // "1st" with a smaller "st" inside the word: retyping that word can't be exact.
    const { lines: ordinal } = await analyzeFile(await pieces([['Ordered 1', 'regular', 12, BLACK], ['st', 'regular', 8, BLACK]], 0));
    const first = ordinal[0];
    expect(first.line.text).toBe('Ordered 1st');
    const { planLine } = await import('../lib/edit-pdf/keep-font/plan');
    expect(planLine(first.font!.data, first.line.text, 'Ordered 2nd', 'ltr', first.font!.size).approx.some((a) => a.startsWith('font:'))).toBe(true);
    expect((await planReplacement(replaceWithFont(first.line, first.font, 'Ordered 2nd'), 'Ordered 2nd', DEPS)).choice.reason).toBe('font');
    expect((await planReplacement(replaceWithFont(first.line, first.font, 'Shipped 1st'), 'Shipped 1st', DEPS)).kind).toBe('original');
  });
});

describe('keep-font placement: unchanged words stay where they were', () => {
  const at = (n: number) => Math.round(n * 1e6) / 1e6;

  it("a bold label beside the changed word keeps its own glyphs, font and place; the new word takes the face it replaces", async () => {
    const { line, font } = lineOf('k1-word-latin.pdf', '0:3');
    const { data } = font;
    expect(data.faces.map((f) => f.key)).toEqual(['Carlito|simple-truetype|4', 'Carlito-Bold|simple-truetype|4']);
    const text = line.text.replace('Michael', 'Sarah');
    const plan = await decide('k1-word-latin.pdf', '0:3', text);
    expect(plan.kind).toBe('original');
    if (plan.kind !== 'original') return;
    const bold = new Set(Object.keys(data.faces[1].fonts));
    const original = data.glyphs.filter((g) => g.text.trim() !== '');
    const boldBefore = original.filter((g) => bold.has(data.fontKeys[g.font])).map((g) => `${data.fontKeys[g.font]}:${g.code}@${at(g.s)}`);
    const boldAfter = plan.glyphs.filter((g) => bold.has(g.font)).map((g) => `${g.font}:${g.code}@${at(g.s)}`);
    expect(boldBefore.length).toBeGreaterThan(5);
    expect(boldAfter).toEqual(boldBefore);
    expect(plan.glyphs.filter((g) => bold.has(g.font)).every((g) => g.verbatim)).toBe(true);
    // Everything left of the changed word is exactly where it was; the new word is drawn in the regular face.
    const changedAt = original.find((g) => g.text === 'M' && g.s > original[0].s)!.s;
    const leftBefore = original.filter((g) => g.s < changedAt - 0.01).map((g) => `${data.fontKeys[g.font]}:${g.code}@${at(g.s)}`);
    expect(plan.glyphs.filter((g) => g.s < changedAt - 0.01 && g.code >= 0).map((g) => `${g.font}:${g.code}@${at(g.s)}`).filter((g) => !g.startsWith(`${data.faces[0].space?.font}:${data.faces[0].space?.code}@`))).toEqual(leftBefore);
    const fresh = plan.glyphs.filter((g) => !g.verbatim && g.code >= 0);
    expect(fresh.length).toBeGreaterThan(0);
    for (const g of fresh) expect(Object.keys(data.faces[0].fonts)).toContain(g.font);
    // Changing the bold label itself: its new letters are bold too (the line's main face is the regular one).
    expect(line.text.startsWith('Reference: ')).toBe(true);
    const boldEdit = await decide('k1-word-latin.pdf', '0:3', line.text.replace('Reference:', 'Service:'));
    expect(boldEdit.kind).toBe('original');
    if (boldEdit.kind !== 'original') return;
    const space = data.faces[0].space;
    const newLetters = boldEdit.glyphs.filter((g) => !g.verbatim && g.code >= 0 && !(g.font === space?.font && g.code === space?.code));
    expect(newLetters).toHaveLength('Service:'.length);
    for (const g of newLetters) expect(bold.has(g.font), `${g.font}:${g.code}`).toBe(true);
  });

  it('a table row: the cell that did not change is redrawn verbatim in its own place', async () => {
    const { line, font } = lineOf('c-english-invoice.pdf', '0:9');
    const { data } = font;
    const plan = await decide('c-english-invoice.pdf', '0:9', 'Delivery charges 1');
    expect(plan.kind).toBe('original');
    if (plan.kind !== 'original') return;
    const cell = data.glyphs.filter((g) => g.text === '1');
    expect(cell).toHaveLength(1);
    const kept = plan.glyphs.filter((g) => g.code === cell[0].code && at(g.s) === at(cell[0].s));
    expect(kept).toHaveLength(1);
    expect(kept[0].verbatim).toBe(true);
    // The changed cell grows from its start: "Delivery" did not move either.
    const first = data.glyphs.find((g) => g.text === 'D')!;
    expect(plan.glyphs.find((g) => g.code === first.code && g.verbatim)?.s).toBeCloseTo(first.s, 6);
  });
});

describe('keep-font sizes', () => {
  it('autoSize in the original font: exactly the line size, unrounded (it may be above 72)', async () => {
    const { font } = lineOf('k3-chrome-arial-times.pdf', '0:6');
    const plan = await decide('k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل المرتجعات بعد مرور ثلاثين يوما على الاستلام.');
    expect(plan.kind).toBe('original');
    expect(plan.size).toBe(font.size);
    expect(Number.isInteger(plan.size * 10)).toBe(false);
  });

  it('autoSize in a look-alike: the width fit of the old prefill, clamped and rounded to 0.1; it follows the mode', async () => {
    const { line, font } = lineOf('k3-chrome-arial-times.pdf', '0:6');
    const plan = await decide('k3-chrome-arial-times.pdf', '0:6', 'ملاحظة: لا تقبل الطلبات بعد مرور ثلاثين يوما على الاستلام.');
    expect(plan.kind).toBe('vector');
    expect(plan.size).toBeGreaterThanOrEqual(Math.round(font.size * REPLACE_FIT_MIN * 10) / 10);
    expect(plan.size).toBeLessThanOrEqual(Math.round(font.size * REPLACE_FIT_MAX * 10) / 10);
    expect(Number.isInteger(Math.round(plan.size * 10))).toBe(true);
    // Noto Sans Arabic is wider than Arial's Arabic: the fit shrinks it.
    expect(plan.size).toBeLessThan(font.size);
    expect(line.text).not.toBe('');
  });

  it('a size the visitor chose (no autoSize) is used as is, and the original plan scales about the start edge', async () => {
    for (const [name, id] of [
      ['c-english-invoice.pdf', '0:12'],
      ['k3-chrome-arial-times.pdf', '0:6'],
    ] as const) {
      const { line, font } = lineOf(name, id);
      const auto = await planReplacement(replaceWithFont(line, font, line.text), line.text, DEPS);
      const k = 1.5;
      const size = Math.round(font.size * k * 10) / 10;
      const fixed = await planReplacement(replaceWithFont(line, font, line.text, { autoSize: undefined, size }), line.text, DEPS);
      expect(auto.kind).toBe('original');
      expect(fixed.kind).toBe('original');
      if (auto.kind !== 'original' || fixed.kind !== 'original') continue;
      expect(fixed.size).toBe(size);
      const factor = size / font.size;
      const edge = line.direction === 'rtl' ? line.geometry.end : line.geometry.start;
      fixed.glyphs.forEach((g, i) => {
        const a = auto.glyphs[i];
        expect(g.s - edge).toBeCloseTo((a.s - edge) * factor, 6);
        expect(g.size).toBeCloseTo(a.size * factor, 6);
      });
    }
  });

  it('colour: unchanged keeps each kept glyph its own fill and gives new ones the line colour; a new colour paints them all', async () => {
    const { line, font } = lineOf('c-english-invoice.pdf', '0:12');
    const text = 'Total due: 68.00 GBP';
    const same = await planReplacement(replaceWithFont(line, font, text), text, DEPS);
    const red = await planReplacement(replaceWithFont(line, font, text, { color: '#DC2626' }), text, DEPS);
    if (same.kind !== 'original' || red.kind !== 'original') throw new Error('expected original plans');
    expect(new Set(same.glyphs.map((g) => g.fill.toLowerCase()))).toEqual(new Set([line.color.toLowerCase()]));
    expect(new Set(red.glyphs.map((g) => g.fill))).toEqual(new Set(['#DC2626']));
  });
});

describe('keep-font font loading', () => {
  it('fetches each shipped font once per session; a failed fetch is not cached', async () => {
    const { vi } = await import('vitest');
    const { loadFontFile } = await import('../lib/edit-pdf/font');
    let fail = true;
    const fetchSpy = vi.fn(async (url: string) => {
      if (fail) return new Response('nope', { status: 503 });
      return new Response(new Uint8Array([1, 2, 3, url.length]));
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const url = '/fonts/LiberationMono-Regular.ttf';
      await expect(loadFontFile(url)).rejects.toThrow(/HTTP 503/);
      fail = false;
      const first = await loadFontFile(url);
      const second = await loadFontFile(url);
      expect(second).toBe(first);
      expect(fetchSpy.mock.calls.map(([u]) => u)).toEqual([url, url]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
