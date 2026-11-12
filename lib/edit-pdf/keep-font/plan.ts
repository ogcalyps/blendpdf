/**
 * "Keep the font": mapping new text onto the line's own glyphs
 * (keep-font-spec.md section 4). Pure: no PDF, no pdf.js. Ported from the
 * keep-font spike (scripts/core.mts plan/layoutPlan, scripts/layout.mts
 * planLine, scripts/arabic.mts).
 *
 * Unchanged words are redrawn from their original glyphs and positions; only
 * a changed segment (run between wide gaps) re-flows, from its reading-start
 * edge, with the original gaps between words that were neighbours. A changed
 * word is shaped in the face of the word it replaces: Arabic forms by
 * joining type (UAX #9 L2 visual order, lam-alef mandatory when the face
 * showed it), each (text, form) looked up in the face's inventory, kerning
 * from harvested pairs, marks only at harvested (base, mark) offsets.
 *
 * Owner: ENGINE.
 */
import { getBidi } from '@/lib/pdf-text/bidi';
import { assignForms, collapseForm, foldText, shapeUnits } from './arabic';
import type { Form, Unit } from './arabic';
import { isTransparentGlyph, median, neutralContext, scriptOf, unitKey } from './harvest';
import type { Script } from './harvest';
import type { HexColor } from '../types';
import type { FaceInventory, GlyphEntry, LineFontData, LineGlyph, LinePlan, PlacedGlyph } from './types';

/** A gap wider than this (em of the line) between two glyphs separates words. */
const WORD_GAP_EM = 0.15;
/** A gap wider than this (em) separates segments (table cells, tab stops) inside one detected line. */
const SEGMENT_GAP_EM = 0.9;
const LAM_ALEF = /^ل[آأإا]$/;

const isInk = (g: LineGlyph) => g.text.trim() !== '';
const nominal = (g: LineGlyph) => (g.width / 1000) * g.sx;
/** Text compared between glyphs and the prefill: NFKC, no tatweel, no joiners or bidi marks. */
const norm = (s: string) => s.normalize('NFKC').replace(/[ـ‌-‏]/g, '');
const stripMarks = (s: string) => s.replace(/\p{M}/gu, '');

export interface OldWord {
  glyphs: LineGlyph[];
  start: number;
  end: number;
  /** Segment index, left to right. */
  segment: number;
}

/** The old line's ink glyphs cut into visual words (left to right) and segments. */
export function oldWords(glyphs: readonly LineGlyph[], em: number): OldWord[] {
  const words: OldWord[] = [];
  let current: OldWord | null = null;
  let previousEnd = -Infinity;
  let segment = 0;
  for (const g of glyphs) {
    if (!isInk(g)) continue;
    const gap = g.s - previousEnd;
    const mark = isTransparentGlyph(g);
    if (!current || (!mark && gap > WORD_GAP_EM * em)) {
      if (current && gap > SEGMENT_GAP_EM * em) segment++;
      current = { glyphs: [], start: g.s, end: g.s, segment };
      words.push(current);
    }
    current.glyphs.push(g);
    if (!mark) {
      current.end = Math.max(current.end, g.s + nominal(g));
      previousEnd = Math.max(previousEnd, g.s + nominal(g));
    }
  }
  return words;
}

/** Median gap between neighbouring words of one segment (user units), or null when the line has none. */
export function measuredWordGap(glyphs: readonly LineGlyph[], em: number): number | null {
  const words = oldWords(glyphs, em);
  const gaps: number[] = [];
  for (let k = 0; k + 1 < words.length; k++) if (words[k + 1].segment === words[k].segment) gaps.push(words[k + 1].start - words[k].end);
  return gaps.length ? median(gaps) : null;
}

/** Reorder items with these embedding levels into visual order (UAX #9 L2). */
function reorder<T>(items: T[], levels: number[]): T[] {
  const order = items.map((_, i) => i);
  if (items.length === 0) return [];
  const highest = Math.max(...levels);
  let lowestOdd = Infinity;
  for (const level of levels) if (level % 2 === 1) lowestOdd = Math.min(lowestOdd, level);
  for (let level = highest; level >= lowestOdd && level > 0; level--) {
    for (let i = 0; i < order.length; ) {
      if (levels[order[i]] < level) {
        i++;
        continue;
      }
      let j = i;
      while (j < order.length && levels[order[j]] >= level) j++;
      order.splice(i, j - i, ...order.slice(i, j).reverse());
      i = j;
    }
  }
  return order.map((i) => items[i]);
}

/** Visual (left to right) order of logical words, by UAX #9 on the whole line: indices into `words`. */
export function visualWordOrder(words: readonly string[], direction: 'ltr' | 'rtl'): number[] {
  const text = words.join(' ');
  const { levels } = getBidi().getEmbeddingLevels(text, direction);
  const wordLevels: number[] = [];
  let at = 0;
  for (const w of words) {
    wordLevels.push(levels[at] ?? 0);
    at += w.length + 1;
  }
  return reorder(
    words.map((_, i) => i),
    wordLevels,
  );
}

/** For each new word: >= 0 the unchanged old word (logical index); < 0 changed, replacing old word -1 - value. LCS on words. */
function alignWords(oldW: readonly string[], newW: readonly string[]): number[] {
  const n = oldW.length;
  const m = newW.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = oldW[i] === newW[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const map = new Array<number>(m).fill(-1);
  const same = new Array<boolean>(m).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldW[i] === newW[j]) {
      map[j] = i;
      same[j] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] > dp[i][j + 1]) i++;
    else if (dp[i + 1][j] < dp[i][j + 1]) j++;
    else {
      map[j] = i;
      i++;
      j++;
    }
  }
  for (let k = 0; k < m; k++) if (map[k] === -1) map[k] = k > 0 ? map[k - 1] : -1;
  for (let k = m - 1; k >= 0; k--) if (map[k] === -1) map[k] = k + 1 < m ? map[k + 1] : 0;
  return map.map((o, k) => (same[k] ? o : -1 - Math.max(0, o)));
}

// ── Shaping new text in one face ─────────────────────────────────────────────

/** One shaped glyph of new text, before placement. */
interface ShapedGlyph {
  font: string;
  code: number;
  /** 1/1000 em. */
  width: number;
  mark: boolean;
  /** Mark offset from its base's origin, em. */
  ds?: number;
  dp?: number;
  text: string;
}

export interface ShapeResult {
  ok: boolean;
  missing: string[];
  approx: string[];
  /** Visual order, left to right; a space with code -1 is a gap the face has no glyph for. */
  glyphs: ShapedGlyph[];
}

type VisualUnit = Unit & { level: number; mirror?: string };

/** Units in visual order (UAX #9 L2) for a line of this base direction, with bracket mirroring at odd levels. */
function visualUnits(text: string, units: Unit[], direction: 'ltr' | 'rtl'): VisualUnit[] {
  const bidi = getBidi();
  const { levels } = bidi.getEmbeddingLevels(text, direction);
  const utf16At: number[] = [];
  let offset = 0;
  for (const ch of text) {
    utf16At.push(offset);
    offset += ch.length;
  }
  const out: VisualUnit[] = units.map((u) => {
    const level = levels[utf16At[u.start]] ?? 0;
    const mirror = level % 2 === 1 && [...u.text].length === 1 ? bidi.getMirroredCharacter(u.text) : null;
    return { ...u, level, ...(mirror ? { mirror } : {}) };
  });
  return reorder(
    out,
    out.map((u) => u.level),
  );
}

/** The best entry for a letter in context: exact (previous, next) neighbours first, else the most used. */
function pickLetter(list: readonly GlyphEntry[] | undefined, prev: string, next: string): { entry: GlyphEntry; exact: boolean } | null {
  if (!list || list.length === 0) return null;
  let best = list[0];
  let bestScore = -1;
  let exact = false;
  for (const e of list) {
    let score = e.count;
    let hit = false;
    for (const [context, n] of Object.entries(e.contexts)) {
      const [p, q] = context.split('_');
      const s = (p === prev ? 2 : 0) + (q === next ? 1 : 0);
      if (s === 3) hit = true;
      score = Math.max(score, s * 1000 + n);
    }
    if (score > bestScore) {
      bestScore = score;
      best = e;
      exact = hit;
    }
  }
  return { entry: best, exact };
}

/** A neutral (digit, punctuation, Latin letter) whose face has several glyphs for it: the one seen between the same scripts. */
function pickNeutral(list: readonly GlyphEntry[] | undefined, context: string): GlyphEntry | null {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0];
  const exact = list.filter((e) => e.contexts[context] !== undefined).sort((a, b) => b.contexts[context] - a.contexts[context]);
  if (exact.length) return exact[0];
  const [l, r] = context.split('_');
  const side = list.filter((e) => Object.keys(e.contexts).some((c) => c.split('_')[0] === l || c.split('_')[1] === r));
  return [...(side.length ? side : list)].sort((a, b) => b.count - a.count)[0];
}

/**
 * Map logical text onto one face's glyphs. ok = every unit (and every mark
 * position) exists. approx = decisions not guaranteed to match the
 * producer's shaping: a ligature split because its form was never seen, or
 * (in a face with contextual alternates) a letter whose exact neighbours
 * were never seen. `outside`: the scripts of the strong text either side of
 * this word on its line (the harvest reads a neutral's context across the
 * whole line).
 */
export function shapeInFace(face: FaceInventory, typed: string, direction: 'ltr' | 'rtl', outside?: { left: Script; right: Script }): ShapeResult {
  // A font the writer can't reuse for new glyphs (a non-embedded Symbol, a non-Identity CMap): nothing from this face.
  if (Object.values(face.fonts).some((f) => f.kind === 'unsupported' || f.objectNumber < 0)) {
    return { ok: false, missing: [`${FONT_PROBLEM} ${face.face} can't draw new text`], approx: [], glyphs: [] };
  }
  // Keyed as the harvest keys glyphs: a decomposed é is é, a typed presentation form its letter.
  const text = foldText(typed);
  const units = shapeUnits(text, face.ligatures, face.lamAlefLigature);
  const approx: string[] = [];
  for (let changed = true; changed; ) {
    changed = false;
    for (let k = 0; k < units.length; k++) {
      const u = units[k];
      if ([...u.text].length < 2 || u.form === 'n' || face.units[unitKey(u.text, u.form)]) continue;
      if (LAM_ALEF.test(u.text) && face.lamAlefLigature) continue; // mandatory: stays one unit, reported missing
      const chars = [...u.text];
      units.splice(k, 1, ...chars.map((c, i) => ({ text: c, form: 'isol' as Form | 'n', marks: i === chars.length - 1 ? u.marks : [], start: u.start + i })));
      approx.push(`split ${u.text}.${u.form}`);
      assignForms(units);
      changed = true;
      break;
    }
  }
  const visual = visualUnits(text, units, direction);
  const texts = visual.map((u) => u.mirror ?? u.text);
  const logicalIndex = new Map(units.map((u, i) => [u.start, i]));
  const letter = (u: Unit | undefined) => (u && u.form !== 'n' ? u.text : undefined);
  const missing: string[] = [];
  const glyphs: ShapedGlyph[] = [];
  visual.forEach((u, vi) => {
    const li = logicalIndex.get(u.start)!;
    const prev = letter(units[li - 1]) ?? '^';
    const next = letter(units[li + 1]) ?? '$';
    const t = texts[vi];
    if (t === ' ' || t === ' ') {
      const space = face.space;
      glyphs.push(space ? { font: space.font, code: space.code, width: space.width, mark: false, text: ' ' } : { font: '', code: -1, width: 250, mark: false, text: ' ' });
      return;
    }
    let entry: GlyphEntry | null;
    let form: Form | 'n' = u.form;
    if (u.form === 'n') entry = pickNeutral(face.units[unitKey(t, 'n')], neutralContext(texts, vi, outside));
    else if (face.arabicInPieces) {
      // Its letter glyphs may be bodies whose dots are glyphs of their own: never a new Arabic letter from this face.
      missing.push(`${t}.${collapseForm(u.text, u.form)} (letters drawn in pieces)`);
      return;
    } else {
      form = collapseForm(u.text, u.form);
      // Arabic yeh and Farsi yeh share a glyph in initial and medial form (producers' ToUnicode often names
      // the Farsi one); alef maksura and Farsi yeh share one in isolated and final form. Heh and heh
      // doachashmee share one in every form but the isolated (Chrome's Times New Roman names them so).
      const joined = form === 'init' || form === 'medi';
      const candidates = [t, joined ? t.replace('ي', 'ی') : t.replace('ى', 'ی'), joined ? t.replace('ی', 'ي') : t.replace('ی', 'ى')];
      if (form !== 'isol') candidates.push(t.replace('ه', 'ھ'), t.replace('ھ', 'ه'));
      const list = candidates.map((c) => face.units[unitKey(c, form)]).find((l) => l && l.length > 0);
      const found = pickLetter(list, prev, next);
      entry = found?.entry ?? null;
      if (found && !found.exact && face.contextual) approx.push(`context ${t}.${form} ${prev}_${next}`);
    }
    if (!entry) {
      missing.push(`${t}${form === 'n' ? '' : `.${form}`}`);
      return;
    }
    const base: ShapedGlyph = { font: entry.font, code: entry.code, width: entry.width, mark: false, text: u.text };
    glyphs.push(base);
    for (const mark of u.marks) {
      const options = face.units[unitKey(mark, 'm')];
      if (!options || options.length === 0) {
        missing.push(`mark ${mark}`);
        continue;
      }
      const chosen = options.find((x) => face.markOffsets[`${base.font}:${base.code},${x.font}:${x.code}`]) ?? options[0];
      const offset = face.markOffsets[`${base.font}:${base.code},${chosen.font}:${chosen.code}`];
      if (!offset) {
        missing.push(`mark ${mark} on ${u.text} (position never seen)`);
        continue;
      }
      glyphs.push({ font: chosen.font, code: chosen.code, width: chosen.width, mark: true, ds: offset[0], dp: offset[1], text: mark });
    }
  });
  return { ok: missing.length === 0, missing, approx, glyphs };
}

interface Style {
  size: number;
  hscale: number;
  extra: number;
  skew: number;
}

/** What new glyphs are drawn with: a face, its style, an offset from the baseline and, when the old word had one of its own, a fill. */
interface Run {
  face: FaceInventory;
  style: Style;
  /** Offset from the baseline, user units (a raised word stays raised). */
  p: number;
  /** The old word's own fill (kept while the colour is unchanged); null = the line's colour. */
  fill: HexColor | null;
}

/** Problems that are not about letters (the note then says the font can't be used, not that letters are missing). */
export const FONT_PROBLEM = 'font:';

/** Positions of shaped glyphs from 0 along the baseline (user units), and the advance of the whole run. */
function placeShaped(face: FaceInventory, shaped: readonly ShapedGlyph[], style: Style): { glyphs: Array<ShapedGlyph & { s: number; p: number; advance: number }>; width: number } {
  const S = style.size;
  let pen = 0;
  let previous: ShapedGlyph | null = null;
  let previousS = 0;
  const out: Array<ShapedGlyph & { s: number; p: number; advance: number }> = [];
  for (const g of shaped) {
    if (g.mark) {
      out.push({ ...g, s: previousS + (g.ds ?? 0) * S, p: (g.dp ?? 0) * S, advance: 0 });
      continue;
    }
    if (previous) {
      const kern = previous.code >= 0 && g.code >= 0 ? face.kern[`${previous.font}:${previous.code},${g.font}:${g.code}`] : undefined;
      pen += (kern ?? style.extra) * S;
    }
    const advance = (g.width / 1000) * S * style.hscale;
    if (g.code >= 0) out.push({ ...g, s: pen, p: 0, advance });
    previousS = pen;
    pen += advance;
    previous = g;
  }
  return { glyphs: out, width: pen };
}

// ── The whole line ─────────────────────────────────────────────────────────

/**
 * For each word (logical index): the script of the nearest strong character
 * to its left and to its right among the OTHER words of the line, in visual
 * order (`order`: word indices left to right).
 */
function outsideScripts(words: readonly string[], order: readonly number[], direction: 'ltr' | 'rtl'): Array<{ left: Script; right: Script }> {
  const visual = words.map((w) => {
    const text = foldText(w);
    return visualUnits(text, shapeUnits(text), direction).map((u) => u.text);
  });
  const out = words.map(() => ({ left: null as Script, right: null as Script }));
  order.forEach((j, k) => {
    for (let m = k - 1; m >= 0 && !out[j].left; m--) for (let c = visual[order[m]].length - 1; c >= 0 && !out[j].left; c--) out[j].left = scriptOf(visual[order[m]][c]);
    for (let m = k + 1; m < order.length && !out[j].right; m++) for (let c = 0; c < visual[order[m]].length && !out[j].right; c++) out[j].right = scriptOf(visual[order[m]][c]);
  });
  return out;
}

/**
 * The new text of a line drawn with the line's own glyphs: `oldText` is the
 * prefill (line.text), `direction` the line's. `size` other than
 * data.style.size (the visitor pressed Smaller or Bigger) scales the planned
 * line about its reading-start edge (left for LTR, right for RTL).
 */
export function planLine(data: LineFontData, oldText: string, newText: string, direction: 'ltr' | 'rtl', size: number): LinePlan {
  const main = data.faces[0];
  const style: Style = { size: data.style.size, hscale: data.style.hscale, extra: data.style.extra, skew: data.style.skew };
  const baseline = data.line.baseline;
  const result: LinePlan = { ok: true, approx: [], missing: [], glyphs: [], placement: 'verbatim+reflow' };
  if (!main) return { ...result, ok: false, missing: ['no face'] };
  const faceOfGlyph = (g: LineGlyph): FaceInventory | undefined => {
    const key = data.fontKeys[g.font];
    return key === undefined ? undefined : data.faces[data.faceOf[key]];
  };
  const fontOf = (key: string) => data.faces[data.faceOf[key]]?.fonts[key];
  const verbatim = (g: LineGlyph, shift = 0) => {
    const key = data.fontKeys[g.font];
    const info = key === undefined ? undefined : fontOf(key);
    if (!info) {
      result.ok = false;
      result.missing.push('unresolved font');
      return;
    }
    // Redrawn by reference to its own object with its own code: needs an indirect object, and one-byte codes or
    // Identity-H ones (an unsupported two-byte font may use a CMap whose codes are not two bytes).
    if (info.objectNumber < 0 || (info.kind === 'unsupported' && info.twoByte)) {
      result.ok = false;
      result.missing.push(`${FONT_PROBLEM} ${info.face} can't be redrawn`);
      return;
    }
    result.glyphs.push({
      font: key!,
      code: g.code,
      twoByte: info.twoByte,
      s: g.s + shift,
      p: g.p - baseline,
      size: g.sy,
      hscale: g.sy > 0 ? g.sx / g.sy : 1,
      skew: g.skew,
      advance: nominal(g),
      fill: g.fill,
      verbatim: true,
    });
  };
  const newWords = newText.split(' ').filter(Boolean);
  const newVis = visualWordOrder(newWords, direction);
  const outside = outsideScripts(newWords, newVis, direction);
  const lineRun: Run = { face: main, style, p: 0, fill: null };
  const hscaleOf = (g: LineGlyph) => (g.sy > 0 ? g.sx / g.sy : 1);
  /**
   * The one face, size, scale, slant, baseline offset and fill an old word's
   * letters share, or null when they differ (a bold label run into a regular
   * number, a raised or smaller letter inside the word, two colours): new
   * glyphs can't take that word's place exactly.
   */
  const runOf = (glyphs: readonly LineGlyph[]): Run | null => {
    const letters = glyphs.filter((g) => isInk(g) && !isTransparentGlyph(g));
    const first = letters[0];
    const face = first && faceOfGlyph(first);
    if (!first || !face) return null;
    const alike = letters.every(
      (g) =>
        faceOfGlyph(g) === face &&
        Math.abs(g.sy - first.sy) <= 0.01 * first.sy &&
        Math.abs(hscaleOf(g) - hscaleOf(first)) <= 0.002 &&
        Math.abs(g.skew - first.skew) <= 1e-3 &&
        Math.abs(g.p - first.p) <= 0.05 * first.sy &&
        g.fill.toLowerCase() === first.fill.toLowerCase(),
    );
    if (!alike) return null;
    return { face, style: { size: first.sy, hscale: hscaleOf(first), extra: style.extra, skew: first.skew }, p: first.p - baseline, fill: first.fill };
  };
  const fresh = (run: Run, j: number) => {
    const shaped = shapeInFace(run.face, newWords[j], direction, outside[j]);
    if (!shaped.ok) {
      result.ok = false;
      result.missing.push(...shaped.missing);
    }
    result.approx.push(...shaped.approx);
    return { run, ...placeShaped(run.face, shaped.glyphs, run.style) };
  };
  const push = (g: ShapedGlyph & { s: number; p: number; advance: number }, x: number, run: Run) => {
    const info = fontOf(g.font);
    if (!info) return;
    const { size: glyphSize, hscale, skew } = run.style;
    result.glyphs.push({
      font: g.font,
      code: g.code,
      twoByte: info.twoByte,
      s: x + g.s,
      p: run.p + g.p,
      size: glyphSize,
      hscale,
      skew,
      advance: g.advance,
      fill: run.fill ?? '#000000',
      verbatim: false,
      ...(run.fill ? { ownFill: true as const } : {}),
    });
  };
  const space = (x: number) => {
    if (main.space) push({ font: main.space.font, code: main.space.code, width: main.space.width, mark: false, text: ' ', s: 0, p: 0, advance: (main.space.width / 1000) * style.size * style.hscale }, x, lineRun);
  };

  const em = data.line.size;
  const ink = data.glyphs.filter(isInk);
  const words = oldWords(data.glyphs, em);
  const oldLogical = oldText.split(' ').filter(Boolean);
  const vis = visualWordOrder(oldLogical, direction);
  const mapped =
    words.length === oldLogical.length &&
    words.every((w, k) => {
      const t = stripMarks(norm(w.glyphs.filter((g) => !isTransparentGlyph(g)).map((g) => g.text).join('')));
      const want = stripMarks(norm(oldLogical[vis[k]]));
      const sorted = (s: string) => [...s].sort().join('');
      return t === want || [...t].reverse().join('') === want || sorted(t) === sorted(want);
    });
  const wordGap = data.style.wordGap > 0 ? data.style.wordGap : main.space ? (main.space.width / 1000) * style.size : 0.25 * style.size;

  if (!mapped && norm(newText) === norm(oldText)) {
    // Nothing changed, but the words could not be matched (a glyph whose ToUnicode is broken): the line as it was.
    for (const g of ink) verbatim(g);
  } else if (!mapped) {
    // The whole line laid out again from its reading-start edge, in the main face (still the original font):
    // exact only when every letter of the old line shared one face, size, slant and fill.
    result.placement = 'full-relayout';
    if (!runOf(ink)) result.approx.push(`${FONT_PROBLEM} the line mixes fonts, sizes or colours`);
    const placed = newVis.map((j) => fresh(lineRun, j));
    const total = placed.reduce((n, w) => n + w.width, 0) + wordGap * Math.max(0, placed.length - 1);
    let x = direction === 'rtl' ? data.line.end - total : data.line.start;
    placed.forEach((w, k) => {
      if (k > 0) {
        space(x);
        x += wordGap;
      }
      for (const g of w.glyphs) push(g, x, w.run);
      x += w.width;
    });
  } else {
    const oldVisualOf = new Map<number, number>();
    vis.forEach((logical, k) => oldVisualOf.set(logical, k));
    const align = alignWords(oldLogical, newWords);
    const segments = words.length ? Math.max(...words.map((w) => w.segment)) + 1 : 0;
    for (let segment = 0; segment < segments; segment++) {
      const items = newVis.map((j) => ({ j, a: align[j] })).filter(({ a }) => words[oldVisualOf.get(a >= 0 ? a : -1 - a)!].segment === segment);
      const oldInSegment = words.filter((w) => w.segment === segment);
      const unchanged = items.length === oldInSegment.length && items.every(({ a }, k) => a >= 0 && words[oldVisualOf.get(a)!] === oldInSegment[k]);
      if (unchanged) {
        for (const w of oldInSegment) for (const g of w.glyphs) verbatim(g);
        continue;
      }
      const placed = items.map(({ j, a }) => {
        if (a >= 0) {
          const w = words[oldVisualOf.get(a)!];
          return { old: w as OldWord | null, width: w.end - w.start, fresh: null as ReturnType<typeof fresh> | null };
        }
        // Shaped like the word it replaces: its face, size, slant, baseline and fill.
        const replaced = words[oldVisualOf.get(-1 - a)!];
        let run = runOf(replaced.glyphs);
        if (!run) {
          result.approx.push(`${FONT_PROBLEM} "${newWords[j]}" replaces a word drawn in more than one font, size or colour`);
          const firstInk = replaced.glyphs.find((g) => !isTransparentGlyph(g));
          run = { ...lineRun, face: (firstInk && faceOfGlyph(firstInk)) || main };
        }
        const shaped = fresh(run, j);
        return { old: null as OldWord | null, width: shaped.width, fresh: shaped };
      });
      const gapBetween = (l: (typeof placed)[number], r: (typeof placed)[number]) => {
        if (l.old && r.old) {
          const i = words.indexOf(l.old);
          const k = words.indexOf(r.old);
          if (k === i + 1) return r.old.start - l.old.end;
        }
        return wordGap;
      };
      let total = 0;
      placed.forEach((p, k) => {
        total += p.width + (k > 0 ? gapBetween(placed[k - 1], p) : 0);
      });
      const segmentStart = oldInSegment[0].start;
      const segmentEnd = oldInSegment[oldInSegment.length - 1].end;
      let x = direction === 'rtl' ? segmentEnd - total : segmentStart;
      placed.forEach((p, k) => {
        if (k > 0) {
          space(x);
          x += gapBetween(placed[k - 1], p);
        }
        if (p.old) for (const g of p.old.glyphs) verbatim(g, x - p.old.start);
        else for (const g of p.fresh!.glyphs) push(g, x, p.fresh!.run);
        x += p.width;
      });
    }
  }

  if (Math.abs(size - style.size) > 1e-9 && style.size > 0) {
    const k = size / style.size;
    const edge = direction === 'rtl' ? data.line.end : data.line.start;
    result.glyphs = result.glyphs.map((g): PlacedGlyph => ({ ...g, s: edge + (g.s - edge) * k, p: g.p * k, size: g.size * k, advance: g.advance * k }));
  }
  return result;
}
