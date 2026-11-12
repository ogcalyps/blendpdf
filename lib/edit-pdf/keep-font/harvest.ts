/**
 * "Keep the font": one FaceInventory per face (keep-font-spec.md section 2,
 * step 3), i.e. which glyph each font object of the face uses for each
 * (text, form) unit. Two sources:
 *
 *   harvest  every line of the harvested pages: each glyph's own ToUnicode
 *            text, and for an Arabic letter the positional form its visual
 *            neighbours give it (marks and thin glyphs whose text is unknown,
 *            such as Noto Naskh's dots, are transparent; a gap of 0.12 em or
 *            more breaks the join); presentation-form ToUnicode values name
 *            the form outright, and a form the glyph's own presentation form
 *            (ToUnicode or the program's cmap) contradicts is never filed.
 *            Kerning pairs, mark offsets per (base, mark) glyph pair,
 *            ligatures and lam-alef come from here too.
 *   declared what the font object itself guarantees: the whole of WinAnsi
 *            for a standard 14 font with /WinAnsiEncoding (printable ASCII
 *            but ' and ` when it has no /Encoding: StandardEncoding); ToUnicode codes whose glyph has an
 *            outline for embedded TrueType and Identity-H fonts (an Arabic
 *            letter only when a presentation form names its form); Type3
 *            codes that have a CharProc; nothing more for Type1/CFF.
 *
 * Ported from the keep-font spike (scripts/core.mts harvestLine,
 * finishInventory, addFontDeclared). The builder uses Maps; freeze() turns
 * it into the plain FaceInventory every LineFont shares (never mutated).
 *
 * Owner: ENGINE. Pure (no pdf.js, no pdf-lib objects beyond SourceFont data).
 */
import { ALEFS, canJoinNext, canJoinPrev, foldText, formOf, formServes, hasArabic, isArabicLetter, isMarkChar, joining, joiningChars, presentationForm } from './arabic';
import type { Form } from './arabic';
import { std14Metrics, textOfGlyphName, winAnsiTables } from './pdf-fonts';
import type { SourceFont } from './pdf-fonts';
import { glyphHasOutline, simpleGlyphFor, unicodeCmap } from './sfnt';
import type { FaceInventory, GlyphEntry, LineGlyph, UnitForm } from './types';

/** One harvested line: its glyphs (s order) and how sure its prefill was. */
export interface HarvestLine {
  glyphs: readonly LineGlyph[];
  /** geometry.size of the line, the em when a glyph has no size of its own. */
  size: number;
  /** SourceTextLine.textUnsure: only forms the glyph's own ToUnicode declares count. */
  unsure: boolean;
}

/** A gap of this many em or more between two glyphs breaks an Arabic join. */
const JOIN_GAP_EM = 0.12;
/** A mark glyph narrower than this (1/1000 em) rides on its base. */
const MARK_WIDTH = 50;
/** Glyphs whose ToUnicode says nothing reliable. */
const UNKNOWN = /^$|[\u0000-\u0008\u000b-\u001f�]/;
const LAM_ALEF = /^ل[آأإا]$/;

export const unitKey = (text: string, form: UnitForm): string => `${text}|${form}`;

const glyphText = (g: LineGlyph) => foldText(g.text);
const nominal = (g: LineGlyph) => (g.width / 1000) * g.sx;
/** Marks only (spaces aside: the shadda ligatures U+FC5E-FC63 fold to a space and two marks). */
const allMarks = (text: string) => {
  const chars = [...foldText(text).replace(/\s/g, '')];
  return chars.length > 0 && chars.every((c) => isMarkChar(c));
};
/** A combining mark drawn as a thin glyph of its own: it rides on its base. */
export const isMarkGlyph = (g: Pick<LineGlyph, 'text' | 'width'>): boolean => g.text !== '' && g.width < MARK_WIDTH && allMarks(g.text);
/**
 * A glyph neighbours look through: a mark, or a thin glyph whose text is
 * unknown (Chrome writes Noto Naskh's dots as glyphs of their own with
 * ToUnicode U+0000). Never a word or join boundary, never a letter.
 */
export const isTransparentGlyph = (g: Pick<LineGlyph, 'text' | 'width'>): boolean => isMarkGlyph(g) || (g.width < MARK_WIDTH && UNKNOWN.test(g.text));
/** Arabic letters (a lam-alef, a ligature such as الله), tatweel allowed; never a mark, a digit or punctuation. */
const isArabicLetterText = (s: string) => {
  const jc = joiningChars(s);
  return hasArabic(s) && jc.length > 0 && jc.every((c) => isArabicLetter(c) || joining(c) === 'C');
};

export type Script = 'A' | 'L' | null;
export const scriptOf = (t: string): Script => (/[ء-يٮ-ۓﭐ-﷿ﹰ-ﻼ]/.test(t) ? 'A' : /[A-Za-zÀ-ɏ]/.test(t) ? 'L' : null);

/**
 * Scripts of the nearest strong neighbours on each side, across the whole
 * line (texts in visual order): picks between a neutral's script-specific
 * glyphs (Arabic vs Latin digits in one font). The plan shapes one word at a
 * time and passes what lies beyond it as `outside`, so both see the same.
 */
export function neutralContext(texts: readonly string[], i: number, outside: { left: Script; right: Script } = { left: null, right: null }): string {
  let left: Script = null;
  let right: Script = null;
  for (let k = i - 1; k >= 0 && !left; k--) left = scriptOf(texts[k]);
  for (let k = i + 1; k < texts.length && !right; k++) right = scriptOf(texts[k]);
  left ??= outside.left;
  right ??= outside.right;
  return `${left ?? '-'}_${right ?? '-'}`;
}

interface MutableEntry {
  font: string;
  code: number;
  width: number;
  count: number;
  source: GlyphEntry['source'];
  contexts: Map<string, number>;
}

/** The mutable inventory of one face while it is harvested. */
export class FaceBuilder {
  readonly units = new Map<string, MutableEntry[]>();
  readonly kern = new Map<string, number[]>();
  readonly markOffsets = new Map<string, Array<[number, number]>>();
  readonly ligatures = new Set<string>();
  space: { font: string; code: number; width: number } | null = null;
  lamAlefSplitSeen = false;
  /** A glyph whose text is unknown was drawn inside one of the face's Arabic words (see FaceInventory.arabicInPieces). */
  arabicInPieces = false;
  /** Program cmap of each Identity-H font: glyph id -> the presentation forms naming it (null when the base letter itself maps to it). */
  private readonly cmapForms = new Map<string, Map<number, Form[] | null>>();

  /**
   * @param key   `${face}|${kind}|${flags}`
   * @param fonts every font object of the face, by key
   * @param keyOf the face's font key for a pdf.js font id (undefined: not this face)
   */
  constructor(
    readonly key: string,
    readonly face: string,
    readonly fonts: ReadonlyMap<string, SourceFont>,
    private readonly keyOf: (pdfjsFont: string) => string | undefined,
  ) {}

  private add(key: string, font: string, code: number, width: number, source: GlyphEntry['source'], context?: string): void {
    let list = this.units.get(key);
    if (!list) this.units.set(key, (list = []));
    let entry = list.find((e) => e.code === code && e.font === font);
    if (!entry) list.push((entry = { font, code, width, count: 0, source, contexts: new Map() }));
    if (source === 'harvest') {
      entry.count++;
      if (entry.source !== 'harvest') entry.source = 'harvest';
    }
    if (context) entry.contexts.set(context, (entry.contexts.get(context) ?? 0) + 1);
  }

  /**
   * The presentation forms a glyph is, by its program's cmap (Identity-H
   * fonts: the code is the glyph id). Null when unknown, or when the base
   * letter itself maps to the glyph (the nominal glyph serves every form the
   * font has no glyph of its own for).
   */
  private programForms(font: string, code: number): Form[] | null {
    const source = this.fonts.get(font);
    if (source?.info.kind !== 'type0-identity' || !source.program) return null;
    let table = this.cmapForms.get(font);
    if (!table) {
      table = new Map();
      for (const [cp, gid] of unicodeCmap(source.program)) {
        const ch = String.fromCodePoint(cp);
        const pres = presentationForm(ch);
        if (pres) {
          const known = table.get(gid);
          if (known !== null) table.set(gid, [...(known ?? []), pres.form]);
        } else if (isArabicLetter(ch)) table.set(gid, null);
      }
      this.cmapForms.set(font, table);
    }
    return table.get(code) ?? null;
  }

  /** Harvest one line (keep-font spike core.mts harvestLine). */
  harvest(line: HarvestLine): void {
    const mine = (g: LineGlyph) => this.keyOf(g.font) !== undefined;
    const keyOf = (g: LineGlyph) => this.keyOf(g.font)!;
    const bases = line.glyphs.filter((g) => !isTransparentGlyph(g));
    const texts = bases.map(glyphText);
    // Letters drawn in pieces whose text is unknown (a body and its thin dots): the face's letter glyphs may not be whole
    // letters. A WIDE glyph of unknown text is a whole letter nobody can name (an alternate): it is only skipped.
    for (const u of line.glyphs) {
      if (this.arabicInPieces || !mine(u) || !(u.width < MARK_WIDTH) || !UNKNOWN.test(u.text)) continue;
      const reach = JOIN_GAP_EM * (u.sy || line.size);
      const inWord = bases.some((b) => b !== u && mine(b) && isArabicLetterText(glyphText(b)) && u.s >= b.s - reach && u.s <= b.s + nominal(b) + reach);
      if (inWord) this.arabicInPieces = true;
    }
    for (let i = 0; i < bases.length; i++) {
      const g = bases[i];
      if (!mine(g) || UNKNOWN.test(g.text)) continue;
      const t = texts[i];
      const font = keyOf(g);
      if (t.trim() === '') {
        if (!this.space) this.space = { font, code: g.code, width: g.width };
        this.add(unitKey(' ', 'n'), font, g.code, g.width, 'harvest');
        continue;
      }
      const size = g.sy || line.size;
      const adjacent = (a: LineGlyph | undefined, b: LineGlyph | undefined) => {
        if (!a || !b) return false;
        const [l, r] = a.s < b.s ? [a, b] : [b, a];
        return r.s - (l.s + nominal(l)) < JOIN_GAP_EM * size && glyphText(a).trim() !== '' && glyphText(b).trim() !== '';
      };
      if (!isArabicLetterText(t)) {
        this.add(unitKey(t, 'n'), font, g.code, g.width, 'harvest', neutralContext(texts, i));
        if ([...t].length > 1 && /^[A-Za-z]+$/.test(t)) this.ligatures.add(t); // fi, fl, ti, ff...
        continue;
      }
      // Visual neighbours: on the right is the logically previous letter, on the left the next one.
      const right = bases[i + 1];
      const left = bases[i - 1];
      if ((right && adjacent(g, right) && UNKNOWN.test(right.text)) || (left && adjacent(g, left) && UNKNOWN.test(left.text))) continue;
      const letterText = (x: LineGlyph) => {
        const s = glyphText(x);
        return isArabicLetterText(s) ? s : undefined;
      };
      const prev = adjacent(g, right) ? letterText(right) : undefined;
      const next = adjacent(g, left) ? letterText(left) : undefined;
      const jc = joiningChars(t);
      const first = jc[0];
      const last = jc[jc.length - 1];
      const joinsPrev = canJoinNext(prev ? joiningChars(prev).slice(-1)[0] : undefined) && canJoinPrev(first);
      const joinsNext = canJoinNext(last) && canJoinPrev(next ? joiningChars(next)[0] : undefined);
      const rightJoining = !canJoinNext(last);
      const collapse = (f: Form): Form => (rightJoining && f === 'init' ? 'isol' : rightJoining && f === 'medi' ? 'fina' : f);
      const pres = presentationForm(g.text);
      if (line.unsure && !pres) continue;
      const used = collapse(formOf(joinsPrev, joinsNext));
      const form = pres ? collapse(pres.form) : used;
      const context = `${prev ?? '^'}_${next ?? '$'}`;
      // A glyph whose program names its form (no ToUnicode form) is never filed under a form that contradicts it.
      const own = pres ? null : this.programForms(font, g.code);
      if (own && !own.some((f) => formServes(collapse(f), used))) continue;
      // The glyph serves the form the producer USED it in, even when its ToUnicode names another, but only
      // for the pairs fonts share (Arial's initial beh is also its medial; the reverse cmap names the first).
      if (pres && used !== form && formServes(form, used) && (prev !== undefined || next !== undefined)) this.add(unitKey(t, used), font, g.code, g.width, 'harvest', context);
      this.add(unitKey(t, form), font, g.code, g.width, 'harvest', context);
      if (jc.length > 1) this.ligatures.add(t);
      if (t === 'ل' && next && ALEFS.has(joiningChars(next)[0])) this.lamAlefSplitSeen = true;
    }
    for (let i = 0; i + 1 < bases.length; i++) {
      const a = bases[i];
      const b = bases[i + 1];
      if (!mine(a) || !mine(b)) continue;
      const extra = (b.s - (a.s + nominal(a))) / (a.sy || line.size);
      if (Math.abs(extra) > 0.5) continue;
      const key = `${keyOf(a)}:${a.code},${keyOf(b)}:${b.code}`;
      let list = this.kern.get(key);
      if (!list) this.kern.set(key, (list = []));
      list.push(extra);
    }
    for (const mark of line.glyphs) {
      if (!mine(mark) || !isMarkGlyph(mark)) continue;
      const size = mark.sy || line.size;
      let host: LineGlyph | null = null;
      let best = Infinity;
      for (const base of bases) {
        const inside = mark.s >= base.s - 0.02 * size && mark.s <= base.s + Math.max(nominal(base), 0) + 0.02 * size;
        const distance = inside ? 0 : Math.abs(mark.s - (base.s + nominal(base) / 2));
        if (distance < best) {
          best = distance;
          host = base;
        }
      }
      this.add(unitKey(glyphText(mark).replace(/\s/g, ''), 'm'), keyOf(mark), mark.code, mark.width, 'harvest');
      if (host && mine(host)) {
        const key = `${keyOf(host)}:${host.code},${keyOf(mark)}:${mark.code}`;
        let list = this.markOffsets.get(key);
        if (!list) this.markOffsets.set(key, (list = []));
        list.push([(mark.s - host.s) / size, (mark.p - host.p) / size]);
      }
    }
  }

  /** What the font objects guarantee beyond the harvest (spike addFontDeclared). */
  declare(): void {
    for (const [key, font] of this.fonts) this.declareFont(key, font);
  }

  private declareFont(key: string, font: SourceFont): void {
    const { kind } = font.info;
    if (kind === 'unsupported' || kind === 'simple-other') return;
    if (kind === 'std14') {
      const metrics = std14Metrics(font.info.std14Name!);
      const ranged = font.widths.size > 0;
      // No /Encoding: viewers draw the font's StandardEncoding, which shares only printable ASCII with
      // WinAnsi, and not 0x27 or 0x60 (quoteright and quoteleft there). Other codes come from the harvest.
      const standard = font.baseEncoding === undefined;
      for (const { text, code, width } of metrics.entries) {
        if (standard && (code < 0x20 || code > 0x7e || code === 0x27 || code === 0x60)) continue;
        // A font object with its own /Widths: only codes it has a width for (viewers use those);
        // a zero there is a placeholder for a code the producer never used, not a glyph.
        if (ranged && !font.widths.has(code)) continue;
        const w = ranged ? font.widths.get(code)! : width;
        if (!(w > 0) && text.trim() !== '') continue;
        this.add(unitKey(text === ' ' ? ' ' : text, 'n'), key, code, w, 'encoding');
      }
      if (!this.space) {
        const code = 32;
        const width = ranged ? font.widths.get(code) : metrics.widthOfCode(code);
        if (width !== undefined && width !== null) this.space = { font: key, code, width };
      }
      return;
    }
    const program = font.program;
    const formOfGlyph = new Map<number, { base: string; form: Form }>();
    if (kind === 'type0-identity') {
      for (const [cp, gid] of unicodeCmap(program)) {
        const pres = presentationForm(String.fromCodePoint(cp));
        if (pres) formOfGlyph.set(gid, pres);
      }
    }
    const texts = new Map<number, string>(font.toUnicode);
    if (kind === 'simple-truetype' || kind === 'type3') {
      // No ToUnicode entry: the encoding's own name for the code (WinAnsi, or the /Differences glyph name).
      const winAnsi = font.baseEncoding === 'WinAnsiEncoding' ? winAnsiTables().byCode : null;
      const codes = new Set<number>([...font.widths.keys(), ...(font.differences?.keys() ?? [])]);
      for (const code of codes) {
        if (texts.has(code)) continue;
        const name = font.differences?.get(code);
        const text = name !== undefined ? textOfGlyphName(name) : winAnsi?.get(code);
        if (text) texts.set(code, text);
      }
    }
    for (const [code, uni] of texts) {
      if (!uni || UNKNOWN.test(uni)) continue;
      const width = font.widths.get(code) ?? font.defaultWidth ?? null;
      if (width === null) continue;
      let present: boolean | null = true;
      if (kind === 'type0-identity') present = glyphHasOutline(program, code);
      else if (kind === 'simple-truetype') {
        // PDF 32000 table 123: bit 3 Symbolic, bit 6 Nonsymbolic.
        const symbolic = (font.info.flags & 4) !== 0 && (font.info.flags & 32) === 0;
        const gid = simpleGlyphFor(program, code, [...uni].length === 1 ? uni.codePointAt(0) : undefined, symbolic);
        present = gid === null ? null : glyphHasOutline(program, gid);
      } else if (kind === 'type3') {
        const name = font.differences?.get(code);
        present = name !== undefined && !!font.charProcs?.has(name);
      }
      const t = foldText(uni);
      if (t.trim() === '') {
        if (!this.space && present !== false) this.space = { font: key, code, width };
        continue;
      }
      if (present === false) continue;
      // Producers fill the codes they never used with zero widths: only a mark may really be that thin.
      if (!(width > 0) && ![...t].every((c) => isMarkChar(c))) continue;
      const source: GlyphEntry['source'] = font.toUnicode.has(code) ? 'tounicode' : 'encoding';
      if (isArabicLetterText(t)) {
        const pres = presentationForm(uni) ?? formOfGlyph.get(code) ?? null;
        if (pres) this.add(unitKey(foldText(pres.base), pres.form), key, code, width, presentationForm(uni) ? source : 'cmap');
        continue; // a bare letter's form is unknown without harvesting
      }
      if (allMarks(t)) {
        this.add(unitKey(t.replace(/\s/g, ''), 'm'), key, code, width, source);
        continue;
      }
      this.add(unitKey(t, 'n'), key, code, width, source);
    }
  }

  /** A face-level glyph identity: the glyph id where the producer kept it (Identity-H codes, Chrome's /gXXX Type3 names). */
  private glyphId(font: string, code: number): string {
    const f = this.fonts.get(font);
    if (f?.info.kind === 'type0-identity') return `G${code}`;
    const name = f?.differences?.get(code);
    if (f?.info.kind === 'type3' && name && /^g[0-9A-F]+$/.test(name)) return `G${parseInt(name.slice(1), 16)}`;
    return `${font}:${code}`;
  }

  /** The plain, frozen inventory. */
  freeze(): FaceInventory {
    let multi = 0;
    for (const [key, list] of this.units) {
      if (key.endsWith('|n') || key.endsWith('|m')) continue;
      const n = new Set(list.filter((e) => e.source === 'harvest').map((e) => this.glyphId(e.font, e.code))).size;
      if (n >= 3) multi += 2;
      else if (n === 2) multi++;
    }
    const units: Record<string, GlyphEntry[]> = {};
    for (const [key, list] of this.units) {
      units[key] = list.map((e) => Object.freeze({ font: e.font, code: e.code, width: e.width, count: e.count, source: e.source, contexts: Object.freeze(Object.fromEntries(e.contexts)) }));
    }
    const kern: Record<string, number> = {};
    for (const [key, list] of this.kern) kern[key] = median(list);
    const markOffsets: Record<string, [number, number]> = {};
    for (const [key, list] of this.markOffsets) markOffsets[key] = [median(list.map((x) => x[0])), median(list.map((x) => x[1]))];
    const ligatures = [...this.ligatures];
    const fonts: FaceInventory['fonts'] = {};
    for (const [key, font] of this.fonts) fonts[key] = font.info;
    return deepFreeze({
      key: this.key,
      face: this.face,
      fonts,
      units,
      kern,
      markOffsets,
      space: this.space,
      ligatures,
      lamAlefLigature: ligatures.some((l) => LAM_ALEF.test(l)) || !this.lamAlefSplitSeen,
      contextual: multi >= 2,
      arabicInPieces: this.arabicInPieces,
    });
  }
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
