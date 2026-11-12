/**
 * "Keep the font" analysis on real producers' files (keep-font-spec.md
 * sections 2 and 12, tests 1, 2 and 6): every pdf.js font is resolved to one
 * PDF font object, every line's own text plans back onto its own glyphs, the
 * faces shape the producer's glyph sequence from the harvested inventory, and
 * Chrome's Type3 and Type0 halves of one face never merge.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { analyzeLineFont, fontSession, releaseLineFonts } from '../lib/edit-pdf/keep-font/analyze';
import { planLine, shapeInFace } from '../lib/edit-pdf/keep-font/plan';
import { planReplacement } from '../lib/edit-pdf/keep-font/choose';
import { fontsOfPage, normFontName } from '../lib/edit-pdf/keep-font/pdf-fonts';
import type { SourceFont } from '../lib/edit-pdf/keep-font/pdf-fonts';
import { FaceBuilder, isMarkGlyph, isTransparentGlyph } from '../lib/edit-pdf/keep-font/harvest';
import { collapseForm, formServes, isArabicLetter, presentationForm } from '../lib/edit-pdf/keep-font/arabic';
import type { Form } from '../lib/edit-pdf/keep-font/arabic';
import { macRomanCode, simpleGlyphFor, unicodeCmap } from '../lib/edit-pdf/keep-font/sfnt';
import type { FaceInventory, LineGlyph } from '../lib/edit-pdf/keep-font/types';
import { detectTextLines } from '../lib/edit-pdf/lines';
import { analyzeFile, anyFixture, loadPublicFont, replaceWithFont } from './helpers/keep-font';
import { pdfjs } from './helpers/replace-fixtures';

const FIXTURES = [
  'a-latin-pdflib.pdf',
  'b-arabic-chrome.pdf',
  'c-arabic-letter.pdf',
  'c-english-invoice.pdf',
  'c4-english-tight.pdf',
  'd1-form-xobject.pdf',
  'd2-rotate90-cropbox.pdf',
  'e-nontext-under-text.pdf',
  'f-tagged-3pages.pdf',
  'g-chrome-tagged-outline.pdf',
  'h-chrome-complex.pdf',
  'k1-word-latin.pdf',
  'k2-word-arabic.pdf',
  'k3-chrome-arial-times.pdf',
];

afterEach(() => releaseLineFonts());

async function openSession(name: string) {
  const bytes = anyFixture(name);
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  const session = await fontSession(new Blob([bytes.slice().buffer as ArrayBuffer]), doc, { ops: pdfjs.OPS });
  return { session, close: () => task.destroy() };
}

describe('keep-font analysis: every pdf.js font resolves to one PDF font object', () => {
  // The one id that stays unresolved draws only spaces: Chrome wrote two Cairo subsets that agree on that glyph, so which one it is can't be told, and nothing visible depends on it.
  const BLANK_ONLY_UNRESOLVED: Record<string, string[]> = { 'b-arabic-chrome.pdf': ['AAAAAA+Cairo-Regular'] };

  it.each(FIXTURES)('%s', async (name) => {
    const { session, close } = await openSession(name);
    try {
      const glyphs = [...session.pages.values()].flatMap((page) => Object.values(page.glyphs).flat());
      const inkIds = new Set(glyphs.filter((g) => g.text.trim() !== '').map((g) => g.font));
      const allIds = new Set(glyphs.map((g) => g.font));
      expect(allIds.size).toBeGreaterThan(0);
      for (const id of inkIds) {
        const key = session.resolved.get(id);
        expect(key, `${name} ${id} (${session.pdfjsFonts.get(id)?.name}) draws ink and must resolve`).toBeTruthy();
        const font = session.fonts.get(key!)!;
        expect(font.info.kind, `${name} ${font.info.baseFont}`).not.toBe('unsupported');
        // Same name (pdf.js keeps the subset tag): on these producers' files, the /BaseFont itself.
        expect(normFontName(font.info.baseFont)).toBe(normFontName(session.pdfjsFonts.get(id)?.name ?? ''));
        expect(font.names).toContain(normFontName(font.info.baseFont));
      }
      const unresolved = [...allIds].filter((id) => !session.resolved.get(id)).map((id) => session.pdfjsFonts.get(id)?.name);
      expect(unresolved).toEqual(BLANK_ONLY_UNRESOLVED[name] ?? []);
    } finally {
      await close();
    }
  });

  it('kinds as the producers wrote them', async () => {
    const kinds = async (name: string) => {
      const { session, close } = await openSession(name);
      const out = [...new Set([...session.resolved.values()].filter(Boolean).map((key) => session.fonts.get(key!)!.info.kind))].sort();
      await close();
      releaseLineFonts();
      return out;
    };
    expect(await kinds('a-latin-pdflib.pdf')).toEqual(['std14']);
    expect(await kinds('c-english-invoice.pdf')).toEqual(['simple-truetype']);
    expect(await kinds('b-arabic-chrome.pdf')).toEqual(['type0-identity', 'type3']);
    expect(await kinds('k3-chrome-arial-times.pdf')).toEqual(['type0-identity']);
  });
});

describe('keep-font analysis: identity', () => {
  /**
   * Per fixture: lines whose own prefill, shaped from the face inventory
   * alone (no verbatim glyphs), gives the producer's exact glyph sequence
   * (font object and code, marks compared as a set), out of the single-face
   * lines with a sure prefill. The misses are k2's isolated meem after a
   * date, k2's vowelled line (harakat its prefill can't carry) and k3's
   * vowelled line.
   */
  const SHAPED: Record<string, [number, number]> = {
    'a-latin-pdflib.pdf': [9, 9],
    'b-arabic-chrome.pdf': [13, 13],
    'c-arabic-letter.pdf': [8, 8],
    'c-english-invoice.pdf': [14, 14],
    'c4-english-tight.pdf': [12, 12],
    'd1-form-xobject.pdf': [5, 5],
    'd2-rotate90-cropbox.pdf': [3, 3],
    'e-nontext-under-text.pdf': [4, 4],
    'f-tagged-3pages.pdf': [5, 5],
    'g-chrome-tagged-outline.pdf': [6, 6],
    'h-chrome-complex.pdf': [4, 4],
    'k1-word-latin.pdf': [8, 8],
    'k2-word-arabic.pdf': [6, 8],
    'k3-chrome-arial-times.pdf': [8, 9],
  };

  it.each(FIXTURES)('%s: every line plans back onto its own glyphs, and the faces shape the producer\'s glyphs', async (name) => {
    const { lines } = await analyzeFile(anyFixture(name));
    let shaped = 0;
    let eligible = 0;
    for (const { line, font } of lines) {
      if (!font || !line.text || line.textUnsure || line.invisible) continue;
      expect(font.lineId).toBe(line.id);
      const data = font.data;
      if (data.blocked) continue;
      const own = data.glyphs.filter((g) => g.text.trim() !== '').map((g) => `${data.fontKeys[g.font]}:${g.code}`);
      // planLine: an unchanged line is drawn from its own glyphs, in their own places.
      const plan = planLine(data, line.text, line.text, line.direction, font.size);
      expect(plan.ok && plan.approx.length === 0, `${name} ${line.id}: ${plan.missing.join(',')}`).toBe(true);
      expect(plan.glyphs.map((g) => `${g.font}:${g.code}`), `${name} ${line.id}`).toEqual(own);
      expect(plan.glyphs.every((g) => g.verbatim)).toBe(true);
      // shaping the whole prefill from the inventory: the producer's glyph sequence?
      if (data.faces.length !== 1) continue;
      eligible++;
      const result = shapeInFace(data.faces[0], line.text, line.direction);
      const mine = result.glyphs.filter((g) => g.text.trim() !== '' && g.code >= 0).map((g) => `${g.font}:${g.code}`);
      const same = own.length === mine.length && (own.every((c, i) => c === mine[i]) || [...own].sort().join() === [...mine].sort().join());
      if (same) shaped++;
    }
    expect([shaped, eligible]).toEqual(SHAPED[name]);
  });
});

describe('keep-font analysis: faces', () => {
  it("Chrome's Type3 and Type0 halves of Cairo stay two faces; an edit on the Type0 line uses only Type0 objects", async () => {
    const { lines } = await analyzeFile(anyFixture('b-arabic-chrome.pdf'));
    const title = lines.find((l) => l.line.id === '0:0')!;
    const cell = lines.find((l) => l.line.id === '0:12')!;
    expect(title.font!.data.faces.map((f) => f.key)).toEqual(['Cairo-Regular|type3|4']);
    expect(cell.font!.data.faces.map((f) => f.key)).toEqual(['Cairo-Regular|type0-identity|4']);
    for (const face of cell.font!.data.faces) for (const info of Object.values(face.fonts)) expect(info.kind).toBe('type0-identity');
    const object = replaceWithFont(cell.line, cell.font, 'اشتراك الخدمة');
    const plan = await planReplacement(object, object.text, { loadFont: loadPublicFont });
    expect(plan.kind).toBe('original');
    if (plan.kind !== 'original') return;
    expect(Object.values(plan.fonts).map((f) => f.kind)).toEqual(['type0-identity']);
    expect(plan.glyphs.filter((g) => !g.verbatim).length).toBeGreaterThan(0);
    expect(plan.glyphs.every((g) => g.twoByte)).toBe(true);
  });

  it('LineFont is plain, frozen data: it survives structured clone and equals itself', async () => {
    const { lines } = await analyzeFile(anyFixture('k3-chrome-arial-times.pdf'));
    const { font } = lines[0];
    expect(font).not.toBeNull();
    expect(structuredClone(font)).toEqual(font);
    expect(Object.isFrozen(font!.data.faces[0])).toBe(true);
    expect(Object.isFrozen(font!.data.faces[0].units)).toBe(true);
  });

  it('a line on a page beyond the harvested ones still gets its page harvested in; the frozen faces are not touched', async () => {
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 4; i++) doc.addPage([400, 200]).drawText(`Page ${i + 1} reads plainly`, { x: 20, y: 100, size: 12, font: helvetica });
    const bytes = await doc.save();
    const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
    const pdf = await task.promise;
    try {
      const file = new Blob([bytes.slice().buffer as ArrayBuffer]);
      const first = (await detectTextLines(await pdf.getPage(1), 0, { ops: pdfjs.OPS })).lines[0];
      const last = (await detectTextLines(await pdf.getPage(4), 3, { ops: pdfjs.OPS })).lines[0];
      const a = await analyzeLineFont(file, pdf, first, { ops: pdfjs.OPS, maxPages: 2 });
      const before = JSON.stringify(a);
      const b = await analyzeLineFont(file, pdf, last, { ops: pdfjs.OPS, maxPages: 2 });
      expect(b?.data.blocked).toBeNull();
      expect(b?.data.faces[0]).not.toBe(a?.data.faces[0]);
      expect(JSON.stringify(a)).toBe(before);
      const session = await fontSession(file, pdf, { ops: pdfjs.OPS });
      expect(session.harvested).toEqual([0, 1]);
      expect([...session.extraFaces.keys()]).toEqual([3]);
    } finally {
      await task.destroy();
    }
  });

  it('the clicked page is harvested first, and always; past the time budget no more pages are taken', async () => {
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 5; i++) doc.addPage([400, 200]).drawText(`Page ${i + 1} reads plainly`, { x: 20, y: 100, size: 12, font: helvetica });
    const bytes = await doc.save();
    const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
    const pdf = await task.promise;
    try {
      const file = new Blob([bytes.slice().buffer as ArrayBuffer]);
      const line = (await detectTextLines(await pdf.getPage(4), 3, { ops: pdfjs.OPS })).lines[0];
      const font = await analyzeLineFont(file, pdf, line, { ops: pdfjs.OPS, budgetMs: 0 });
      expect(font?.data.blocked).toBeNull();
      expect((await fontSession(file, pdf)).harvested).toEqual([3]);
      releaseLineFonts();
      await analyzeLineFont(file, pdf, line, { ops: pdfjs.OPS });
      expect((await fontSession(file, pdf)).harvested).toEqual([0, 1, 2, 3, 4]);
    } finally {
      await task.destroy();
    }
  });

  it('timing: the first click on a 20-page file loads and harvests once; later clicks reuse it', async () => {
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < 20; i++) {
      const page = doc.addPage([612, 792]);
      for (let k = 0; k < 30; k++) page.drawText(`Line ${k + 1} of page ${i + 1}: the quick brown fox jumps over the lazy dog.`, { x: 40, y: 750 - k * 22, size: 11, font: helvetica });
    }
    const bytes = await doc.save();
    const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
    const pdf = await task.promise;
    try {
      const file = new Blob([bytes.slice().buffer as ArrayBuffer]);
      const lines = (await detectTextLines(await pdf.getPage(1), 0, { ops: pdfjs.OPS })).lines;
      let t = performance.now();
      expect(await analyzeLineFont(file, pdf, lines[0], { ops: pdfjs.OPS })).not.toBeNull();
      const first = performance.now() - t;
      t = performance.now();
      expect(await analyzeLineFont(file, pdf, lines[5], { ops: pdfjs.OPS })).not.toBeNull();
      const later = performance.now() - t;
      console.log(`keep-font analysis, 20 pages x 30 lines: first click ${first.toFixed(0)} ms, later click ${later.toFixed(1)} ms`);
      expect(first).toBeLessThan(5000);
      expect(later).toBeLessThan(200);
    } finally {
      await task.destroy();
    }
  });
});

describe('keep-font harvest: forms', () => {
  const font: SourceFont = {
    info: { key: '1 0', objectNumber: 1, generation: 0, kind: 'type0-identity', baseFont: 'F', face: 'F', twoByte: true, signature: 's', flags: 4, italicAngle: 0, weight: null },
    ref: null,
    toUnicode: new Map(),
    widths: new Map(),
    defaultWidth: 500,
    names: ['f'],
  };
  /** Two beh glyphs joined, in visual order (left = the logically second, final; right = the first, initial). */
  const behBeh = (left: string, right: string): LineGlyph[] =>
    [
      [left, 2, 0],
      [right, 1, 6],
    ].map(([text, code, s]) => ({ font: 'f1', code: code as number, text: text as string, width: 500, isSpace: false, s: s as number, p: 100, sx: 12, sy: 12, skew: 0, fill: '#000000', mode: 0 }));
  const forms = (lines: Array<{ glyphs: LineGlyph[]; unsure: boolean }>) => {
    const builder = new FaceBuilder('F|type0-identity|4', 'F', new Map([['1 0', font]]), (id) => (id === 'f1' ? '1 0' : undefined));
    for (const line of lines) builder.harvest({ ...line, size: 12 });
    return Object.keys(builder.freeze().units).sort();
  };

  it("a letter's form comes from its visual neighbours", () => {
    expect(forms([{ glyphs: behBeh('ب', 'ب'), unsure: false }])).toEqual(['ب|fina', 'ب|init']);
  });

  it("a thin glyph with no text between two letters (a dot drawn on its own) neither breaks the join nor hides the letters", () => {
    const [left, right] = behBeh('ب', 'ب');
    const dot: LineGlyph = { ...right, code: 9, text: '\u0000', width: 0, s: 3 };
    expect(forms([{ glyphs: [left, dot, right], unsure: false }])).toEqual(['ب|fina', 'ب|init']);
  });

  it('a line whose prefill is unsure teaches only the forms its glyphs name (presentation forms), never guessed ones', () => {
    expect(forms([{ glyphs: behBeh('ب', 'ب'), unsure: true }])).toEqual([]);
    expect(forms([{ glyphs: behBeh('ب', 'ﺑ'), unsure: true }])).toEqual(['ب|init']);
  });
});

// ── Forms checked against the glyphs' own names ───────────────────────────

/**
 * Harvested Arabic entries whose glyph names its own form (a presentation
 * form in the ToUnicode, else the program's cmap; a glyph the base letter
 * itself maps to names none) and is filed under a form that name rules out:
 * only the same form, or the pairs fonts share (initial also medial,
 * isolated also final), may be filed. [] = every harvested form agrees.
 */
function formContradictions(sources: ReadonlyMap<string, SourceFont>, faces: readonly FaceInventory[]): string[] {
  const problems: string[] = [];
  const cmaps = new Map<string, Map<number, Form[] | null>>();
  const programForms = (font: SourceFont): Map<number, Form[] | null> => {
    let table = cmaps.get(font.info.key);
    if (!table) {
      table = new Map();
      if (font.info.kind === 'type0-identity') {
        for (const [cp, gid] of unicodeCmap(font.program)) {
          const ch = String.fromCodePoint(cp);
          const pres = presentationForm(ch);
          if (pres && table.get(gid) !== null) table.set(gid, [...(table.get(gid) ?? []), pres.form]);
          else if (!pres && isArabicLetter(ch)) table.set(gid, null);
        }
      }
      cmaps.set(font.info.key, table);
    }
    return table;
  };
  for (const face of faces) {
    for (const [key, entries] of Object.entries(face.units)) {
      const [text, form] = key.split('|') as [string, Form | 'n' | 'm'];
      if (form === 'n' || form === 'm') continue;
      for (const entry of entries) {
        if (entry.source !== 'harvest') continue;
        const font = sources.get(entry.font);
        if (!font) continue;
        const pres = presentationForm(font.toUnicode.get(entry.code) ?? '');
        const own = pres ? [pres.form] : (programForms(font).get(entry.code) ?? null);
        if (!own) continue;
        if (!own.some((o) => formServes(collapseForm(text, o), form))) problems.push(`${face.face} ${key}: glyph ${entry.code} is ${own.join('/')}`);
      }
    }
  }
  return problems;
}

describe('keep-font harvest: every harvested form agrees with the glyph\'s own name', () => {
  const ARABIC = ['b-arabic-chrome.pdf', 'c-arabic-letter.pdf', 'h-chrome-complex.pdf', 'k2-word-arabic.pdf', 'k3-chrome-arial-times.pdf'];

  async function facesOf(name: string) {
    const bytes = anyFixture(name);
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const sources = new Map<string, SourceFont>();
    for (let page = 0; page < doc.getPageCount(); page++) fontsOfPage(doc, page, sources);
    const { lines } = await analyzeFile(bytes);
    const faces = new Map<string, FaceInventory>();
    for (const { font } of lines) for (const face of font?.data.faces ?? []) faces.set(face.key, face);
    return { sources, faces: [...faces.values()], lines };
  }

  it.each(ARABIC)('%s', async (name) => {
    const { sources, faces } = await facesOf(name);
    expect(formContradictions(sources, faces)).toEqual([]);
  });

  it('the guard sees a glyph filed under a form its name rules out (mutation check)', async () => {
    const { sources, faces } = await facesOf('k3-chrome-arial-times.pdf');
    const times = faces.find((f) => f.face === 'TimesNewRomanPSMT')!;
    // Glyph 920 is the medial teh (its ToUnicode says so): filed as final, as the old harvest did after a shadda ligature.
    const medial = times.units['ت|medi'].find((e) => e.code === 920)!;
    const broken: FaceInventory = { ...times, units: { ...times.units, 'ت|fina': [{ ...medial }] } };
    expect(formContradictions(sources, [broken])).toEqual(['TimesNewRomanPSMT ت|fina: glyph 920 is medi']);
  });

  it("Noto Naskh's dots and bodies (no text, Chrome) neither break nor fake a join, and the face never draws new Arabic letters", async () => {
    const { lines } = await facesOf('b-arabic-chrome.pdf');
    const naskh = lines.find((l) => l.line.id === '0:1')!;
    const face = naskh.font!.data.faces[0];
    expect(face.face).toBe('NotoNaskhArabic-Regular');
    expect(face.arabicInPieces).toBe(true);
    // Glyph 25 is the INITIAL hah: never an isolated one.
    expect((face.units['ح|isol'] ?? []).map((e) => e.code)).not.toContain(25);
    expect((face.units['ل|isol'] ?? []).map((e) => e.code)).not.toContain(70);
    for (const word of ['روح', 'مال', 'عادل']) {
      const plan = await planReplacement(replaceWithFont(naskh.line, naskh.font, word), word, { loadFont: loadPublicFont });
      expect(plan.kind, word).toBe('vector');
    }
    // The faces that draw whole letters are not affected.
    for (const { font } of lines) for (const f of font?.data.faces ?? []) if (f.face !== 'NotoNaskhArabic-Regular') expect(f.arabicInPieces, f.face).toBe(false);
  });

  it('k3 Times New Roman: the vowelled line teaches no wrong forms, so the face is not taken for a contextual one', async () => {
    const { faces } = await facesOf('k3-chrome-arial-times.pdf');
    const times = faces.find((f) => f.face === 'TimesNewRomanPSMT')!;
    expect(times.contextual).toBe(false);
    expect((times.units['ت|fina'] ?? []).map((e) => e.code)).not.toContain(920);
    expect((times.units['و|isol'] ?? []).map((e) => e.code)).not.toContain(1006);
    expect((times.units['ل|isol'] ?? []).map((e) => e.code)).not.toContain(991);
  });

  it('a shadda ligature (U+FC5E-FC63: NFKC starts with a space) and a thin glyph with no text are transparent; a wide one is not', () => {
    expect(isMarkGlyph({ text: '\uFC60', width: 0 })).toBe(true);
    expect(isTransparentGlyph({ text: '\uFC60', width: 0 })).toBe(true);
    expect(isMarkGlyph({ text: '\u0000', width: 0 })).toBe(false);
    expect(isTransparentGlyph({ text: '\u0000', width: 0 })).toBe(true);
    expect(isTransparentGlyph({ text: '\u0000', width: 292 })).toBe(false);
    expect(isTransparentGlyph({ text: 'ب', width: 0 })).toBe(false);
  });

  it('presentation forms: Uighur alef maksura has an initial and a medial form, nothing else', () => {
    expect(presentationForm('\uFBE8')).toEqual({ base: 'ى', form: 'init' });
    expect(presentationForm('\uFBE9')).toEqual({ base: 'ى', form: 'medi' });
    expect(presentationForm('\uFEEF')).toEqual({ base: 'ى', form: 'isol' });
    expect(presentationForm('\uFEF0')).toEqual({ base: 'ى', form: 'fina' });
    expect(presentationForm('\uFEDF')).toEqual({ base: 'ل', form: 'init' });
  });
});

describe('keep-font sfnt: a simple TrueType code to its glyph (PDF 32000 9.6.6.4)', () => {
  /** An sfnt with only a cmap: (1,0) format 0 from `mac` (code -> glyph) and, unless `withUnicode` is false, (3,1) format 4 from `unicode`. */
  function cmapOnly(mac: Record<number, number>, unicode: Record<number, number>, withUnicode = true): Uint8Array {
    const f0 = new Uint8Array(262);
    const v0 = new DataView(f0.buffer);
    v0.setUint16(0, 0);
    v0.setUint16(2, 262);
    for (const [code, gid] of Object.entries(mac)) f0[6 + Number(code)] = gid;
    const cps = Object.keys(unicode).map(Number).sort((a, b) => a - b);
    const segs = cps.length + 1;
    const f4 = new Uint8Array(16 + segs * 8);
    const v4 = new DataView(f4.buffer);
    v4.setUint16(0, 4);
    v4.setUint16(2, f4.length);
    v4.setUint16(6, segs * 2);
    [...cps, 0xffff].forEach((cp, i) => {
      v4.setUint16(14 + i * 2, cp);
      v4.setUint16(16 + segs * 2 + i * 2, cp);
      v4.setInt16(16 + segs * 4 + i * 2, cp === 0xffff ? 1 : (unicode[cp] - cp) & 0xffff);
    });
    const tables = withUnicode ? [[1, 0, f0], [3, 1, f4]] as const : ([[1, 0, f0]] as const);
    const header = 4 + tables.length * 8;
    const cmap = new Uint8Array(header + tables.reduce((n, [, , t]) => n + t.length, 0));
    const vc = new DataView(cmap.buffer);
    vc.setUint16(2, tables.length);
    let at = header;
    tables.forEach(([platform, encoding, table], i) => {
      vc.setUint16(4 + i * 8, platform);
      vc.setUint16(6 + i * 8, encoding);
      vc.setUint32(8 + i * 8, at);
      cmap.set(table, at);
      at += table.length;
    });
    const program = new Uint8Array(28 + cmap.length);
    const vp = new DataView(program.buffer);
    vp.setUint32(0, 0x00010000);
    vp.setUint16(4, 1);
    program.set([0x63, 0x6d, 0x61, 0x70], 12);
    vp.setUint32(20, 28);
    vp.setUint32(24, cmap.length);
    program.set(cmap, 28);
    return program;
  }
  // Glyph 5 is é, glyph 7 is È. WinAnsi code 0xE9 is é; MacRoman 0xE9 is È, MacRoman é is 0x8E.
  const MAC = { 0x8e: 5, 0xe9: 7 };
  const UNICODE = { 0xc8: 7, 0xe9: 5 };

  it('a non-symbolic font: the code\'s character through the Unicode cmap, else its MacRoman code, never the raw code in the Mac cmap', () => {
    expect(macRomanCode(0xe9)).toBe(0x8e);
    expect(simpleGlyphFor(cmapOnly(MAC, UNICODE), 0xe9, 0xe9, false)).toBe(5);
    expect(simpleGlyphFor(cmapOnly(MAC, UNICODE, false), 0xe9, 0xe9, false)).toBe(5);
  });

  it('a symbolic font: the raw code', () => {
    expect(simpleGlyphFor(cmapOnly(MAC, UNICODE), 0xe9, 0xe9, true)).toBe(7);
  });
});

