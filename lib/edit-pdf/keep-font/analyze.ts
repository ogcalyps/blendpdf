/**
 * "Keep the font": the font analysis behind LineFont (keep-font-spec.md
 * section 2). Reached only through import() from ../index. Runs when the
 * visitor clicks a line, in parallel with checkLineRemoval:
 *
 *   1. once per File (cached until releaseLineFonts): load the ORIGINAL bytes
 *      with pdf-lib (./pdf-fonts: every font object of every page, form
 *      XObject resources included), and harvest the clicked line's page and
 *      then the first HARVEST_MAX_PAGES pages through pdf.js (../lines
 *      detectLinesWithGlyphs: one operator-list pass per page), stopping
 *      early once HARVEST_BUDGET_MS have passed (a heavy file opens the box
 *      late otherwise); every pdf.js font id is resolved to one PDF font
 *      object, and one FaceInventory per face is built (./harvest) the first
 *      time a line needs it, then frozen;
 *   2. per line: the line's glyphs from the same pass, its faces (main face =
 *      most ink first), its style, whether the original can be reused at all,
 *      and the look-alike. A line on a page outside the harvested set gets
 *      copies of its faces with that page added (the frozen ones are never
 *      touched).
 *
 * Never throws for a font problem: a line whose font can't be reused gets
 * data.blocked. When the analysis itself could not run (pdf-lib can't read
 * the file) the line still gets a LineFont, blocked 'unresolved', with the
 * look-alike picked from the name pdf.js gives its font; null only when even
 * that fails (then the replacement is drawn in Cairo, exactly as in Phase C).
 *
 * Owner: ENGINE.
 */
import type { PDFDocument } from 'pdf-lib';
import { detectLinesWithGlyphs } from '../lines';
import type { DetectedLinesWithGlyphs } from '../lines';
import { loadSource } from '../load';
import { FaceBuilder, isTransparentGlyph, median } from './harvest';
import type { HarvestLine } from './harvest';
import { ownFamily, pickLookalike, withSameFamily } from './lookalike';
import { fontsOfPage, normFontName, std14Metrics } from './pdf-fonts';
import type { SourceFont } from './pdf-fonts';
import { measuredWordGap } from './plan';
import type { FaceInventory, LineFontData, LineGlyph, PdfjsFontFacts, ReuseBlock } from './types';
import type { FontSourceDocument, LineDetectionOptions, LineFont, SourceTextLine } from '../types';

/** Pages harvested for the inventories, from the first; the clicked line's own page is always added. */
export const HARVEST_MAX_PAGES = 30;
/** The harvest stops taking more pages after this long (the clicked page is always taken). */
export const HARVEST_BUDGET_MS = 1500;

export interface AnalyzeOptions extends LineDetectionOptions {
  /** Default HARVEST_MAX_PAGES. */
  maxPages?: number;
  /** Default HARVEST_BUDGET_MS. */
  budgetMs?: number;
}

/** A harvested glyph's width may differ from the font object's by this much (1/1000 em) and still be the same font. */
const WIDTH_TOLERANCE = 1.5;

const isInk = (g: LineGlyph) => g.text.trim() !== '';

/** Everything the analysis keeps for one File. Session-private: only LineFont (plain data) leaves this module. */
export interface FontSession {
  file: Blob;
  pdf: FontSourceDocument;
  /** pdf-lib's view of the ORIGINAL bytes (the export's and the preview's source of font objects). */
  doc: PDFDocument;
  ops: Readonly<Record<string, number>> | undefined;
  maxPages: number;
  fonts: Map<string, SourceFont>;
  pageFonts: Map<number, SourceFont[]>;
  /** Pages of the base harvest, and extra pages added for clicked lines outside it. */
  pages: Map<number, DetectedLinesWithGlyphs>;
  harvested: number[];
  pdfjsFonts: Map<string, PdfjsFontFacts>;
  /** pdf.js font id -> font key, or null when it matched no font object (never guessed). */
  resolved: Map<string, string | null>;
  /** Base inventories by face key, built on first use. */
  faces: Map<string, FaceInventory>;
  /** Inventories with one extra page harvested in, by page then face key. */
  extraFaces: Map<number, Map<string, FaceInventory>>;
}

let current: { file: Blob; pdf: FontSourceDocument; session: Promise<FontSession> } | null = null;
const releaseHooks = new Set<() => void>();

/** Run `hook` when the session is released (the preview drops its documents). */
export function onLineFontsReleased(hook: () => void): void {
  releaseHooks.add(hook);
}

/** Drop the session (the pdf-lib copy of the file, the inventories, the preview documents). */
export function releaseLineFonts(): void {
  current = null;
  for (const hook of releaseHooks) hook();
}

/** The session for this File (built once; a failed build is not cached). */
export function fontSession(file: Blob, pdf: FontSourceDocument, options: AnalyzeOptions = {}, firstPage = 0): Promise<FontSession> {
  if (current && current.file === file && current.pdf === pdf) return current.session;
  if (current) releaseLineFonts();
  const session = buildSession(file, pdf, options, firstPage);
  const entry = { file, pdf, session };
  current = entry;
  session.catch(() => {
    if (current === entry) current = null;
  });
  return session;
}

/** The session already built for this File, if any (the preview reuses its pdf-lib document). */
export function existingSession(file: Blob): Promise<FontSession> | null {
  return current && current.file === file ? current.session : null;
}

async function buildSession(file: Blob, pdf: FontSourceDocument, options: AnalyzeOptions, firstPage: number): Promise<FontSession> {
  const started = typeof performance === 'object' ? performance.now() : Date.now();
  const elapsed = () => (typeof performance === 'object' ? performance.now() : Date.now()) - started;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await loadSource(bytes);
  if (doc.isEncrypted) throw new Error('encrypted');
  const maxPages = Math.max(1, options.maxPages ?? HARVEST_MAX_PAGES);
  const session: FontSession = {
    file,
    pdf,
    doc,
    ops: options.ops,
    maxPages,
    fonts: new Map(),
    pageFonts: new Map(),
    pages: new Map(),
    harvested: [],
    pdfjsFonts: new Map(),
    resolved: new Map(),
    faces: new Map(),
    extraFaces: new Map(),
  };
  const total = Math.min(pdf.numPages, doc.getPageCount());
  const order = [firstPage, ...Array.from({ length: Math.min(total, maxPages) }, (_, i) => i).filter((i) => i !== firstPage)].filter((i) => i >= 0 && i < total);
  const budget = options.budgetMs ?? HARVEST_BUDGET_MS;
  for (const index of order) {
    if (session.harvested.length > 0 && elapsed() > budget) break;
    await addPage(session, index);
    session.harvested.push(index);
  }
  session.harvested.sort((a, b) => a - b);
  resolvePending(session, session.harvested);
  return session;
}

/** Detect one page's lines and glyphs and read its font objects. */
async function addPage(session: FontSession, index: number): Promise<DetectedLinesWithGlyphs> {
  const known = session.pages.get(index);
  if (known) return known;
  const page = await session.pdf.getPage(index + 1);
  const detected = await detectLinesWithGlyphs(page, index, session.ops ? { ops: session.ops } : {});
  session.pages.set(index, detected);
  session.pageFonts.set(index, fontsOfPage(session.doc, index, session.fonts));
  for (const [id, facts] of Object.entries(detected.fonts)) if (!session.pdfjsFonts.has(id)) session.pdfjsFonts.set(id, facts);
  return detected;
}

/**
 * The PDF font object a pdf.js font id stands for: same name (BaseFont, or
 * the other names pdf.js may report, SourceFont.names; Type3 only to Type3,
 * composite only to two-byte), on every page the id is drawn on,
 * and every glyph drawn with it agrees with the object's ToUnicode (NFKC)
 * and widths. Several objects can only be told apart by data they share
 * (the same font written twice): then any of them draws the same, the first
 * is taken. Anything else is unresolved (null), never guessed.
 */
export function resolvePdfjsFont(id: string, facts: PdfjsFontFacts | undefined, glyphs: readonly LineGlyph[], candidates: readonly SourceFont[]): string | null {
  if (!facts) return null;
  const name = normFontName(facts.name);
  const byName = candidates.filter((c) => {
    const kind = c.info.kind;
    if (facts.type3 !== (kind === 'type3')) return false;
    if (kind !== 'unsupported' && facts.composite !== c.info.twoByte) return false;
    return c.names.includes(name) || (facts.type3 && name === '');
  });
  const own = glyphs.filter((g) => g.font === id && g.code >= 0);
  const consistent = byName.filter((c) =>
    own.every((g) => {
      const tu = c.toUnicode.get(g.code);
      if (c.toUnicode.size > 0 && tu !== undefined && g.text !== '' && tu.normalize('NFKC') !== g.text.normalize('NFKC')) return false;
      if (c.info.kind === 'type0-identity' && c.toUnicode.size > 0 && tu === undefined) return false;
      let width: number | null | undefined = c.widths.get(g.code);
      if (width === undefined && c.info.kind === 'std14' && c.widths.size === 0) width = std14Metrics(c.info.std14Name!).widthOfCode(g.code);
      if (width === undefined) width = c.info.twoByte ? c.defaultWidth : null;
      if (c.info.kind === 'type3' && (width === null || width === undefined)) return false;
      if (width !== null && width !== undefined && Math.abs(width - g.width) > WIDTH_TOLERANCE) return false;
      return true;
    }),
  );
  if (consistent.length === 0) return null;
  const keys = new Set(consistent.map((c) => c.info.key));
  if (keys.size === 1) return consistent[0].info.key;
  const same = (a: SourceFont, b: SourceFont) =>
    a.info.kind === b.info.kind &&
    a.info.baseFont === b.info.baseFont &&
    a.info.std14Name === b.info.std14Name &&
    sameBytes(a.program, b.program) &&
    a.toUnicode.size === b.toUnicode.size &&
    [...a.toUnicode].every(([code, text]) => b.toUnicode.get(code) === text) &&
    a.widths.size === b.widths.size &&
    [...a.widths].every(([code, width]) => b.widths.get(code) === width);
  return consistent.every((c) => same(c, consistent[0])) ? consistent[0].info.key : null;
}

function sameBytes(a: Uint8Array | undefined, b: Uint8Array | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Resolve every pdf.js font id drawn on these pages that is not resolved yet. */
function resolvePending(session: FontSession, pages: readonly number[]): void {
  const glyphsOf = new Map<string, LineGlyph[]>();
  const pagesOf = new Map<string, number[]>();
  for (const index of pages) {
    const detected = session.pages.get(index);
    if (!detected) continue;
    for (const list of Object.values(detected.glyphs)) {
      for (const g of list) {
        if (session.resolved.has(g.font)) continue;
        let own = glyphsOf.get(g.font);
        if (!own) glyphsOf.set(g.font, (own = []));
        own.push(g);
        const on = pagesOf.get(g.font) ?? [];
        if (!on.includes(index)) on.push(index);
        pagesOf.set(g.font, on);
      }
    }
  }
  for (const [id, glyphs] of glyphsOf) {
    const on = pagesOf.get(id) ?? [];
    // pdf.js names one font object with one id across pages: prefer objects present on every page the id is drawn on.
    const perPage = on.map((index) => session.pageFonts.get(index) ?? []);
    const everywhere = perPage.length ? perPage[0].filter((f) => perPage.every((list) => list.includes(f))) : [];
    const union = [...new Set(perPage.flat())];
    let key = resolvePdfjsFont(id, session.pdfjsFonts.get(id), glyphs, everywhere);
    if (key === null && everywhere.length !== union.length) key = resolvePdfjsFont(id, session.pdfjsFonts.get(id), glyphs, union);
    session.resolved.set(id, key);
  }
}

const faceKeyOf = (font: SourceFont) => `${font.info.face}|${font.info.kind}|${font.info.flags}`;

/** The frozen inventory of a face: base harvest, or base + one extra page. */
function inventory(session: FontSession, faceKey: string, extraPage: number | null): FaceInventory {
  const cache = extraPage === null ? session.faces : (session.extraFaces.get(extraPage) ?? new Map<string, FaceInventory>());
  if (extraPage !== null) session.extraFaces.set(extraPage, cache);
  const known = cache.get(faceKey);
  if (known) return known;
  const fonts = new Map<string, SourceFont>();
  const resolvedKeys = new Set(session.resolved.values());
  for (const font of session.fonts.values()) if (faceKeyOf(font) === faceKey && resolvedKeys.has(font.info.key)) fonts.set(font.info.key, font);
  const keyOf = (id: string) => {
    const key = session.resolved.get(id);
    return key && fonts.has(key) ? key : undefined;
  };
  const face = fonts.values().next().value?.info.face ?? faceKey.split('|')[0];
  const builder = new FaceBuilder(faceKey, face, fonts, keyOf);
  const pages = extraPage === null ? session.harvested : [...session.harvested, extraPage];
  for (const index of pages) {
    const detected = session.pages.get(index);
    if (!detected) continue;
    for (const line of detected.page.lines) {
      const glyphs = detected.glyphs[line.id] ?? [];
      if (!glyphs.some((g) => keyOf(g.font) !== undefined)) continue;
      const harvest: HarvestLine = { glyphs, size: line.geometry.size, unsure: line.textUnsure };
      builder.harvest(harvest);
    }
  }
  builder.declare();
  const frozen = builder.freeze();
  cache.set(faceKey, frozen);
  return frozen;
}

/** The detected line of the session's own pass that is `line` (same id, same place). */
function sameDetectedLine(detected: DetectedLinesWithGlyphs, line: SourceTextLine): SourceTextLine | undefined {
  const close = (a: SourceTextLine) => {
    const g = a.geometry;
    const h = line.geometry;
    return Math.abs(g.ux - h.ux) < 1e-6 && Math.abs(g.uy - h.uy) < 1e-6 && Math.abs(g.baseline - h.baseline) < 0.05 && Math.abs(g.start - h.start) < 0.05 && Math.abs(g.end - h.end) < 0.05;
  };
  const byId = detected.page.lines.find((l) => l.id === line.id);
  return byId && close(byId) ? byId : detected.page.lines.find(close);
}

/** The analysis of one line (the per-click part). */
export async function analyzeLine(session: FontSession, line: SourceTextLine): Promise<LineFontData | null> {
  const inBase = session.harvested.includes(line.pageIndex);
  const detected = await addPage(session, line.pageIndex);
  if (!inBase) resolvePending(session, [line.pageIndex]);
  const own = sameDetectedLine(detected, line);
  if (!own) return null;
  const glyphs = [...(detected.glyphs[own.id] ?? [])];
  const ink = glyphs.filter(isInk);

  const fontKeys: Record<string, string> = {};
  for (const g of glyphs) {
    const key = session.resolved.get(g.font);
    if (key) fontKeys[g.font] = key;
  }
  // Faces by ink, most first.
  const inkPerFace = new Map<string, number>();
  const faceOfKey = new Map<string, string>();
  for (const g of ink) {
    const key = fontKeys[g.font];
    const font = key ? session.fonts.get(key) : undefined;
    if (!font) continue;
    const faceKey = faceKeyOf(font);
    faceOfKey.set(key, faceKey);
    inkPerFace.set(faceKey, (inkPerFace.get(faceKey) ?? 0) + 1);
  }
  const faceKeys = [...inkPerFace.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
  const extra = inBase ? null : line.pageIndex;
  const faces = faceKeys.map((key) => inventory(session, key, extra));
  const faceOf: Record<string, number> = {};
  faces.forEach((face, index) => {
    for (const key of Object.keys(face.fonts)) faceOf[key] = index;
  });

  const main = faces[0];
  const mainKeys = new Set(main ? Object.keys(main.fonts) : []);
  const inMain = (g: LineGlyph) => mainKeys.has(fontKeys[g.font]);
  const own0 = ink.filter(inMain);
  const size = median(own0.map((g) => g.sy)) || own.geometry.size;
  const hscale = median(own0.map((g) => (g.sy > 0 ? g.sx / g.sy : 1))) || 1;
  const skew = median(own0.map((g) => g.skew));
  const bases = glyphs.filter((g) => !isTransparentGlyph(g));
  const gaps: number[] = [];
  for (let i = 0; i + 1 < bases.length; i++) {
    const a = bases[i];
    const b = bases[i + 1];
    if (!inMain(a) || !inMain(b)) continue;
    const e = (b.s - (a.s + (a.width / 1000) * a.sx)) / (a.sy || size);
    if (Math.abs(e) < 0.3) gaps.push(e);
  }
  const wordGap = measuredWordGap(glyphs, own.geometry.size) ?? 0;

  // Only the main face blocks the whole line: another face that can't draw new text (a Symbol bullet) only
  // stops edits to its own words (planLine), and its unchanged glyphs are redrawn by reference.
  let blocked: ReuseBlock | null = null;
  if (ink.length === 0 || ink.some((g) => fontKeys[g.font] === undefined)) blocked = 'unresolved';
  else if (main && Object.values(main.fonts).some((f) => f.kind === 'unsupported')) blocked = 'unsupported-font';
  else if (ink.some((g) => g.mode !== 0)) blocked = 'render-mode';

  // The look-alike from the main face's descriptor, or from pdf.js's name when nothing resolved; bold
  // drawn by stroking the outline (render mode 2) still reads bold, a slanted matrix reads italic.
  const pickFor = (face: FaceInventory | undefined) => {
    const keys = new Set(face ? Object.keys(face.fonts) : []);
    const own = face ? ink.filter((g) => keys.has(fontKeys[g.font])) : ink;
    const info = face ? Object.values(face.fonts)[0] : undefined;
    const counts = new Map<string, number>();
    for (const g of own) counts.set(g.font, (counts.get(g.font) ?? 0) + 1);
    const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const baseFont = info ? info.baseFont : topId ? (session.pdfjsFonts.get(topId)?.name ?? '') : '';
    const pick = info ? pickLookalike(info.baseFont, info.flags, info.weight, info.italicAngle) : pickLookalike(baseFont);
    if (own.some((g) => g.mode === 2)) pick.bold = true;
    if (Math.abs(median(own.map((g) => g.skew))) > 0.05) pick.italic = true;
    return { pick, own: ownFamily(baseFont) };
  };
  const mainPick = pickFor(main);
  // A face the main face's file would not draw alike (a bold label on a regular line) means the closest match changes how it looks.
  const uniform = faces.slice(1).every((face) => {
    const { pick } = pickFor(face);
    return pick.latin === mainPick.pick.latin && pick.arabic === mainPick.pick.arabic && pick.bold === mainPick.pick.bold && pick.italic === mainPick.pick.italic;
  });
  const lookalike = withSameFamily(mainPick.pick, mainPick.own, uniform);

  return {
    version: 1,
    fontKeys,
    faces,
    faceOf,
    glyphs,
    line: { size: own.geometry.size, baseline: own.geometry.baseline, start: own.geometry.start, end: own.geometry.end },
    style: { size, hscale, extra: median(gaps), wordGap, skew },
    blocked,
    lookalike,
  };
}

/**
 * When a line is clicked: what fonts it is drawn with and what they can
 * draw (ReplaceObject.font). Null when the analysis could not run.
 */
export async function analyzeLineFont(file: Blob, pdf: FontSourceDocument, line: SourceTextLine, options: AnalyzeOptions = {}): Promise<LineFont | null> {
  try {
    const session = await fontSession(file, pdf, options, line.pageIndex);
    const data = await analyzeLine(session, line);
    if (!data) return null;
    return Object.freeze({ lineId: line.id, size: data.style.size, data });
  } catch (error) {
    console.warn('keep-font: the font analysis failed', error);
    return lookalikeOnly(pdf, line, options);
  }
}

/**
 * A line whose fonts could not be analysed (pdf-lib can't read the file):
 * nothing of the original is reused (blocked 'unresolved'), but the closest
 * match is still picked from the name pdf.js gives the line's main font, so
 * a serif line is not drawn in Cairo. Null when pdf.js can't tell either.
 */
async function lookalikeOnly(pdf: FontSourceDocument, line: SourceTextLine, options: AnalyzeOptions): Promise<LineFont | null> {
  try {
    const page = await pdf.getPage(line.pageIndex + 1);
    const detected = await detectLinesWithGlyphs(page, line.pageIndex, options.ops ? { ops: options.ops } : {});
    const own = sameDetectedLine(detected, line);
    const ink = (own ? (detected.glyphs[own.id] ?? []) : []).filter(isInk);
    const counts = new Map<string, number>();
    for (const g of ink) counts.set(g.font, (counts.get(g.font) ?? 0) + 1);
    const topId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const name = topId ? detected.fonts[topId]?.name : undefined;
    if (!own || !name) return null;
    const top = ink.filter((g) => g.font === topId);
    const pick = pickLookalike(name);
    if (top.some((g) => g.mode === 2)) pick.bold = true;
    const skew = median(top.map((g) => g.skew));
    if (Math.abs(skew) > 0.05) pick.italic = true;
    const size = median(top.map((g) => g.sy)) || own.geometry.size;
    const data: LineFontData = {
      version: 1,
      fontKeys: {},
      faces: [],
      faceOf: {},
      glyphs: [],
      line: { size: own.geometry.size, baseline: own.geometry.baseline, start: own.geometry.start, end: own.geometry.end },
      style: { size, hscale: 1, extra: 0, wordGap: 0, skew },
      blocked: 'unresolved',
      lookalike: withSameFamily(pick, ownFamily(name)),
    };
    return Object.freeze({ lineId: line.id, size, data });
  } catch (error) {
    console.warn('keep-font: pdf.js could not name the line\'s font either', error);
    return null;
  }
}
