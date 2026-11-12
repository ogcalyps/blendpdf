/**
 * Line detection for "Edit text (beta)": the lines of existing text on one
 * source page, from the editor's own pdf.js page (no second copy of the
 * file), each with its geometry in SOURCE user space (what PDFium removes
 * by), its box on the visual page, a prefill, a colour, and the flags that
 * keep a line from being offered (invisible OCR text, slanted text).
 * Reached only through import() (from ./index). pdf.js itself is never
 * imported here: the page object comes from the caller, and the OPS table
 * from options.ops or lib/pdfjs-init (the only route to pdf.js).
 *
 * Two passes, ported from the Phase C spike (lines.mjs):
 *   1. getTextContent items, bucketed by angle and baseline, split at wide
 *      gaps (table cells become their own lines): the line boxes.
 *   2. The operator list, glyph by glyph (CTM, text state, form matrices,
 *      fill colour, render mode): each glyph's own ToUnicode string and
 *      position, assigned to the line with the nearest baseline. The
 *      prefill is rebuilt from these (./prefill.ts).
 *
 * "Keep the font" (keep-font-spec.md section 2) reads the same glyph pass
 * through detectLinesWithGlyphs: every glyph also carries its pdf.js font
 * id, its content-stream code, its width and its effective size, so the
 * font analysis needs no second operator-list walker.
 */
import { pageGeometry, pdfRectToVisualBox } from '@/lib/pdf-geometry';
import { arabicLetters, arabicScriptLanguage, logicalOrder, prefillLooksBroken, prefillText, strongDirection } from './prefill';
import type {
  DetectedTextPage,
  Direction,
  HexColor,
  LineDetectionOptions,
  LineDetectionPage,
  QuarterTurn,
  SourceTextLine,
} from './types';
import type { LineGlyph, PdfjsFontFacts } from './keep-font/types';

/** Items whose baselines are this close (in em of the larger) share a line. */
const BUCKET_EM = 0.35;
/** A gap wider than this (em) along the baseline starts a new line: table cells, columns. */
const GAP_EM = 1.5;
/** A gap wider than this (em) between two pdf.js items, or two glyphs, reads as a space. */
const ITEM_SPACE_EM = 0.15;
const GLYPH_SPACE_EM = 0.2;
/** A glyph belongs to a line when its origin is this close (em) to the baseline, and nearest that baseline. */
const GLYPH_BAND_EM = 0.5;
/** Angles within this many degrees of a quarter turn count as that quarter turn. */
const SNAP_DEGREES = 0.5;
const DEFAULT_ASCENT = 0.8;
const DEFAULT_DESCENT = 0.2;

type Matrix = [number, number, number, number, number, number];

/** m then n: the PDF convention, where `a b c d e f cm` makes CTM' = M x CTM. */
function multiply(m: readonly number[], n: readonly number[]): Matrix {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

const apply = (m: readonly number[], x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** tan of the angle between a text matrix's y axis and the normal of its x axis (0 for upright text, about 0.2 for synthetic italic). */
function slant(m: readonly number[]): number {
  const length = Math.hypot(m[0], m[1]) || 1;
  const ux = m[0] / length;
  const uy = m[1] / length;
  const across = -m[2] * uy + m[3] * ux;
  const along = m[2] * ux + m[3] * uy;
  return across === 0 ? 0 : along / across;
}

/** A unit direction, snapped onto the axis when it is within SNAP_DEGREES of one. */
function axis(dx: number, dy: number): { ux: number; uy: number; theta: number } {
  const length = Math.hypot(dx, dy) || 1;
  let ux = dx / length;
  let uy = dy / length;
  let theta = (Math.atan2(uy, ux) * 180) / Math.PI;
  const quarter = Math.round(theta / 90) * 90;
  if (Math.abs(theta - quarter) <= SNAP_DEGREES) {
    theta = quarter;
    const r = (quarter * Math.PI) / 180;
    ux = Math.round(Math.cos(r));
    uy = Math.round(Math.sin(r));
  }
  return { ux, uy, theta };
}

const sameAxis = (a: { ux: number; uy: number }, b: { ux: number; uy: number }) => a.ux * b.ux + a.uy * b.uy > Math.cos((1 * Math.PI) / 180);

interface Item {
  str: string;
  size: number;
  ascent: number;
  descent: number;
  ux: number;
  uy: number;
  theta: number;
  /** Along the baseline, and across it (the baseline's offset). */
  s: number;
  p: number;
  width: number;
}

interface Glyph {
  text: string;
  x: number;
  y: number;
  ux: number;
  uy: number;
  /** Advance along the baseline in user space (spacing included). */
  advance: number;
  fill: HexColor;
  mode: number;
  /** pdf.js font id (setFont's first argument). */
  font: string;
  /** Content-stream code (pdf.js originalCharCode). */
  code: number;
  /** Glyph width in 1/1000 em, font matrix applied. */
  width: number;
  isSpace: boolean;
  /** Effective font size along and across the baseline, user units. */
  sx: number;
  sy: number;
  /** Slant of the glyph's vertical axis (tan of the angle from the baseline's normal): synthetic italic. */
  skew: number;
}

interface Line {
  ux: number;
  uy: number;
  theta: number;
  items: Item[];
  start: number;
  end: number;
  baseline: number;
  size: number;
  ascent: number;
  descent: number;
  glyphs: Array<Glyph & { s: number; p: number }>;
}

const isBlank = (text: string) => prefillText(text) === '';

interface TextItemLike {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
}

/** Pass 1: getTextContent items, bucketed into lines. */
async function itemLines(page: LineDetectionPage): Promise<Line[]> {
  const content = await page.getTextContent({ includeMarkedContent: false });
  const styles = content.styles as Record<string, { ascent?: number; descent?: number } | undefined>;
  const items: Item[] = [];
  for (const raw of content.items as TextItemLike[]) {
    if (typeof raw.str !== 'string' || raw.str.length === 0 || !raw.transform) continue;
    const [a, b, c, d, e, f] = raw.transform;
    const { ux, uy, theta } = axis(a, b);
    const size = Math.hypot(c, d) || raw.height || Math.hypot(a, b);
    if (!(size > 0)) continue;
    const width = raw.width ?? 0;
    // Control-only items (bidi marks) and zero-width blanks carry nothing.
    if (isBlank(raw.str) && (width === 0 || raw.str.trim() !== '')) continue;
    const style = styles[raw.fontName ?? ''] ?? {};
    const ascent = style.ascent !== undefined && style.ascent > 0.3 && style.ascent < 1.5 ? style.ascent : DEFAULT_ASCENT;
    const descent = style.descent !== undefined && style.descent < 0 && style.descent > -0.6 ? -style.descent : DEFAULT_DESCENT;
    items.push({ str: raw.str, size, ascent, descent, ux, uy, theta, s: ux * e + uy * f, p: -uy * e + ux * f, width });
  }

  const buckets: Array<{ ux: number; uy: number; theta: number; p: number; size: number; items: Item[] }> = [];
  for (const item of items) {
    let bucket = buckets.find((b) => sameAxis(b, item) && Math.abs(b.p - item.p) < BUCKET_EM * Math.max(b.size, item.size));
    if (!bucket) buckets.push((bucket = { ux: item.ux, uy: item.uy, theta: item.theta, p: item.p, size: item.size, items: [] }));
    bucket.items.push(item);
    bucket.size = Math.max(bucket.size, item.size);
  }

  const lines: Line[] = [];
  for (const bucket of buckets) {
    const sorted = [...bucket.items].sort((x, y) => x.s - y.s);
    let current: Item[] | null = null;
    let inkEnd = -Infinity;
    for (const item of sorted) {
      if (item.str.trim() === '') {
        current?.push(item);
        continue;
      }
      if (!current || item.s - inkEnd > GAP_EM * bucket.size) {
        current = [];
        lines.push({ ux: bucket.ux, uy: bucket.uy, theta: bucket.theta, items: current, start: 0, end: 0, baseline: 0, size: 0, ascent: 0, descent: 0, glyphs: [] });
        inkEnd = -Infinity;
      }
      current.push(item);
      inkEnd = Math.max(inkEnd, item.s + item.width);
    }
  }

  for (const line of lines) {
    while (line.items.length > 0 && line.items[line.items.length - 1].str.trim() === '') line.items.pop();
    const ink = line.items.filter((item) => item.str.trim() !== '');
    line.start = Math.min(...ink.map((item) => item.s));
    line.end = Math.max(...ink.map((item) => item.s + item.width));
    line.size = Math.max(...ink.map((item) => item.size));
    // The baseline most of the line's characters sit on.
    const weight = ink.reduce((sum, item) => sum + item.str.length, 0);
    line.baseline = ink.reduce((sum, item) => sum + item.p * item.str.length, 0) / weight;
    line.ascent = Math.max(...ink.map((item) => item.ascent * item.size));
    line.descent = Math.max(...ink.map((item) => item.descent * item.size));
  }
  return lines;
}

const hex2 = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
const hexColor = (r: number, g: number, b: number): HexColor => `#${hex2(r)}${hex2(g)}${hex2(b)}`;

interface GraphicsState {
  ctm: Matrix;
  fill: HexColor;
  mode: number;
  font: string;
  fontMatrix: readonly number[];
  vertical: boolean;
  size: number;
  hscale: number;
  charSpacing: number;
  wordSpacing: number;
  leading: number;
  rise: number;
}

interface PdfJsGlyph {
  unicode?: string;
  width?: number;
  isSpace?: boolean;
  originalCharCode?: number;
}

interface PdfJsFontObject {
  fontMatrix?: number[];
  vertical?: boolean;
  name?: string;
  isType3Font?: boolean;
  composite?: boolean;
}

/** Pass 2: every glyph the page draws, with its own string, origin, colour, render mode, font and code. */
async function pageGlyphs(page: LineDetectionPage, OPS: Readonly<Record<string, number>>): Promise<{ glyphs: Glyph[]; fonts: Record<string, PdfjsFontFacts> }> {
  const { fnArray, argsArray } = await page.getOperatorList();
  const glyphs: Glyph[] = [];
  const fonts: Record<string, PdfjsFontFacts> = {};
  let state: GraphicsState = {
    ctm: [1, 0, 0, 1, 0, 0],
    fill: '#000000',
    mode: 0,
    font: '',
    fontMatrix: [0.001, 0, 0, 0.001, 0, 0],
    vertical: false,
    size: 1,
    hscale: 1,
    charSpacing: 0,
    wordSpacing: 0,
    leading: 0,
    rise: 0,
  };
  const stack: GraphicsState[] = [];
  let tm: Matrix = [1, 0, 0, 1, 0, 0];
  let tlm: Matrix = [1, 0, 0, 1, 0, 0];
  const lineMove = (tx: number, ty: number) => {
    tlm = multiply([1, 0, 0, 1, tx, ty], tlm);
    tm = [...tlm];
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] as unknown[];
    switch (fn) {
      case OPS.save:
        stack.push({ ...state });
        break;
      case OPS.restore:
        state = stack.pop() ?? state;
        break;
      case OPS.transform:
        state.ctm = multiply(args as number[], state.ctm);
        break;
      case OPS.paintFormXObjectBegin:
        stack.push({ ...state });
        if (Array.isArray(args[0]) && args[0].length === 6) state.ctm = multiply(args[0] as number[], state.ctm);
        break;
      case OPS.paintFormXObjectEnd:
        state = stack.pop() ?? state;
        break;
      case OPS.setFillRGBColor: {
        const [r, g, b] = args as number[];
        state.fill = hexColor(r, g, b);
        break;
      }
      case OPS.setTextRenderingMode:
        state.mode = Number(args[0]) || 0;
        break;
      case OPS.beginText:
        tm = [1, 0, 0, 1, 0, 0];
        tlm = [1, 0, 0, 1, 0, 0];
        break;
      case OPS.setTextMatrix:
        tm = (args as number[]).slice(0, 6) as Matrix;
        tlm = [...tm];
        break;
      case OPS.moveText:
        lineMove(Number(args[0]), Number(args[1]));
        break;
      case OPS.setLeadingMoveText:
        state.leading = -Number(args[1]);
        lineMove(Number(args[0]), Number(args[1]));
        break;
      case OPS.nextLine:
        lineMove(0, -state.leading);
        break;
      case OPS.setLeading:
        state.leading = Number(args[0]);
        break;
      case OPS.setCharSpacing:
        state.charSpacing = Number(args[0]);
        break;
      case OPS.setWordSpacing:
        state.wordSpacing = Number(args[0]);
        break;
      case OPS.setHScale:
        state.hscale = Number(args[0]) / 100;
        break;
      case OPS.setTextRise:
        state.rise = Number(args[0]);
        break;
      case OPS.setFont: {
        state.size = Number(args[1]);
        state.font = String(args[0]);
        try {
          const font = page.commonObjs.get(state.font) as PdfJsFontObject | undefined;
          state.fontMatrix = font?.fontMatrix ?? [0.001, 0, 0, 0.001, 0, 0];
          state.vertical = !!font?.vertical;
          if (!fonts[state.font]) {
            fonts[state.font] = { name: font?.name ?? '', type3: !!font?.isType3Font, composite: !!font?.composite, vertical: !!font?.vertical };
          }
        } catch {
          // not resolved: keep the default em
        }
        break;
      }
      case OPS.showText: {
        if (state.vertical) break; // vertical writing is not offered
        const { size, hscale, charSpacing, wordSpacing, rise, fontMatrix } = state;
        for (const entry of (args[0] as Array<PdfJsGlyph | number | null>) ?? []) {
          if (typeof entry === 'number') {
            tm = multiply([1, 0, 0, 1, (-entry / 1000) * size * hscale, 0], tm);
            continue;
          }
          if (!entry) continue;
          const toUser = multiply(tm, state.ctm);
          const [x, y] = apply(toUser, 0, rise);
          const scale = Math.hypot(toUser[0], toUser[1]);
          // The em ACROSS the baseline: the y axis' component normal to the x axis, so a slanted
          // (synthetic italic) matrix does not read taller than it draws.
          const across = scale > 0 ? Math.abs(toUser[0] * toUser[3] - toUser[1] * toUser[2]) / scale : Math.hypot(toUser[2], toUser[3]);
          const width = (entry.width ?? 0) * fontMatrix[0] * size;
          const advance = (width + charSpacing + (entry.isSpace ? wordSpacing : 0)) * hscale;
          const { ux, uy } = axis(toUser[0], toUser[1]);
          glyphs.push({
            text: entry.unicode ?? '',
            x,
            y,
            ux,
            uy,
            advance: advance * scale,
            fill: state.fill,
            mode: state.mode,
            font: state.font,
            code: entry.originalCharCode ?? -1,
            width: (entry.width ?? 0) * fontMatrix[0] * 1000,
            isSpace: !!entry.isSpace,
            sx: size * hscale * scale,
            sy: size * across,
            skew: slant(toUser),
          });
          tm = multiply([1, 0, 0, 1, advance, 0], tm);
        }
        break;
      }
      default:
        break;
    }
  }
  return { glyphs, fonts };
}

/** Give each glyph to the line whose baseline is nearest, if it is within that line's band and extent. */
function assignGlyphs(lines: Line[], glyphs: Glyph[]): void {
  for (const glyph of glyphs) {
    let best: Line | null = null;
    let bestDistance = Infinity;
    let bestFrame = { s: 0, p: 0 };
    for (const line of lines) {
      if (!sameAxis(line, glyph)) continue;
      const s = glyph.x * line.ux + glyph.y * line.uy;
      const p = -glyph.x * line.uy + glyph.y * line.ux;
      const distance = Math.abs(p - line.baseline);
      if (distance >= GLYPH_BAND_EM * line.size) continue;
      if (s < line.start - 0.3 * line.size || s > line.end + 0.1 * line.size) continue;
      if (distance < bestDistance) {
        best = line;
        bestDistance = distance;
        bestFrame = { s, p };
      }
    }
    best?.glyphs.push({ ...glyph, ...bestFrame });
  }
}

const isMark = (text: string) => text !== '' && /^\p{M}+$/u.test(text);

/**
 * Producers disagree on how a ligature glyph that stands for several RTL
 * letters maps to text. Chrome writes it in logical order ("لا"); writers
 * aimed at viewers that reverse RTL text character by character (BlendPDF's
 * own lib/pdf-text among them) write it reversed ("ال"). Only lam-alef
 * shows which: no font ligates alef + lam. Its order is the evidence.
 */
type LigatureOrder = 'logical' | 'reversed';
const ALEF = '[\u0622\u0623\u0625\u0627]';
const LAM_ALEF = new RegExp(`^\u0644${ALEF}$`);
const ALEF_LAM = new RegExp(`^${ALEF}\u0644$`);
/** Several letters (and marks) of one RTL script in one glyph. */
const isRtlCluster = (text: string) => [...text].length > 1 && /^[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefe]+$/.test(text);

function ligatureOrder(glyphs: readonly Glyph[]): LigatureOrder | null {
  let logical = 0;
  let reversed = 0;
  for (const glyph of glyphs) {
    if (LAM_ALEF.test(glyph.text)) logical++;
    else if (ALEF_LAM.test(glyph.text)) reversed++;
  }
  if (logical === reversed) return null;
  return reversed > logical ? 'reversed' : 'logical';
}

/** Glyphs left to right as strings, with ' ' at visible gaps; a zero-width mark rides on the glyph it sits over. */
function glyphPieces(line: Line, order: LigatureOrder): string[] {
  const sorted = [...line.glyphs].sort((a, b) => a.s - b.s);
  const bases = sorted.filter((g) => !(isMark(g.text) && g.advance < 0.05 * line.size));
  const own = (g: Glyph) => (order === 'reversed' && isRtlCluster(g.text) ? [...g.text].reverse().join('') : g.text);
  const texts = new Map(bases.map((g) => [g, own(g)]));
  for (const mark of sorted) {
    if (texts.has(mark)) continue;
    let host = bases[0];
    let hostDistance = Infinity;
    for (const base of bases) {
      const centre = base.s + Math.max(base.advance, 0) / 2;
      const inside = mark.s >= base.s - 0.02 * line.size && mark.s <= base.s + Math.max(base.advance, 0) + 0.02 * line.size;
      const distance = inside ? 0 : Math.abs(mark.s - centre);
      if (distance < hostDistance) {
        host = base;
        hostDistance = distance;
      }
    }
    if (host) texts.set(host, texts.get(host)! + own(mark));
  }
  const pieces: string[] = [];
  bases.forEach((glyph, k) => {
    if (k > 0) {
      const previous = bases[k - 1];
      const gap = glyph.s - (previous.s + previous.advance);
      if (gap > GLYPH_SPACE_EM * line.size && previous.text.trim() !== '' && glyph.text.trim() !== '') pieces.push(' ');
    }
    pieces.push(texts.get(glyph)!);
  });
  return pieces;
}

/** pdf.js item strings left to right, with ' ' at visible gaps (the fallback when no glyph was found). */
function itemPieces(line: Line): string[] {
  const pieces: string[] = [];
  let previousEnd: number | null = null;
  for (const item of line.items) {
    const last = pieces[pieces.length - 1] ?? '';
    if (previousEnd !== null && item.s - previousEnd > ITEM_SPACE_EM * line.size && !/\s$/.test(last) && !/^\s/.test(item.str)) pieces.push(' ');
    pieces.push(item.str);
    previousEnd = item.s + item.width;
  }
  return pieces;
}

function mostCommon<T>(values: readonly T[], fallback: T): T {
  const counts = new Map<T, number>();
  let best = fallback;
  let bestCount = 0;
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** Clockwise quarter turn of a reading direction on the visual page, or null when it is not one. */
function visualTurn(theta: number, rotate: number): QuarterTurn | null {
  // theta is counter-clockwise in user space (y up); on screen (y down) that reads as -theta clockwise, then /Rotate adds.
  const turn = (((rotate - theta) % 360) + 360) % 360;
  const quarter = Math.round(turn / 90) * 90;
  if (Math.abs(turn - quarter) > SNAP_DEGREES) return null;
  return (quarter % 360) as QuarterTurn;
}

/** detectLinesWithGlyphs' result: the lines, each line's glyphs, and the pdf.js fonts the page uses. */
export interface DetectedLinesWithGlyphs {
  page: DetectedTextPage;
  /** SourceTextLine.id -> its glyphs in s order (marks and spaces included). */
  glyphs: Record<string, LineGlyph[]>;
  /** pdf.js font id -> what pdf.js says about it. */
  fonts: Record<string, PdfjsFontFacts>;
}

/** The lines of a page (exactly what detectTextLines returns) plus every line's glyphs, from one glyph pass. */
export async function detectLinesWithGlyphs(page: LineDetectionPage, pageIndex: number, options: LineDetectionOptions = {}): Promise<DetectedLinesWithGlyphs> {
  const OPS = options.ops ?? (await (await import('@/lib/pdfjs-init')).getPdfJs()).OPS;
  const lines = await itemLines(page);
  const pass = await pageGlyphs(page, OPS as unknown as Record<string, number>);
  assignGlyphs(lines, pass.glyphs);
  const detected = linesOf(page, pageIndex, lines);
  const glyphs: Record<string, LineGlyph[]> = {};
  detected.lines.forEach((line, n) => {
    glyphs[line.id] = [...lines[n].glyphs]
      .sort((a, b) => a.s - b.s)
      .map((g) => ({ font: g.font, code: g.code, text: g.text, width: g.width, isSpace: g.isSpace, s: g.s, p: g.p, sx: g.sx, sy: g.sy, skew: g.skew, fill: g.fill, mode: g.mode }));
  });
  return { page: detected, glyphs, fonts: pass.fonts };
}

export async function detectTextLines(page: LineDetectionPage, pageIndex: number, options: LineDetectionOptions = {}): Promise<DetectedTextPage> {
  return (await detectLinesWithGlyphs(page, pageIndex, options)).page;
}

/** The detected lines of a page, from its line buckets with their glyphs assigned. Sorts `lines` into reading order. */
function linesOf(page: LineDetectionPage, pageIndex: number, lines: Line[]): DetectedTextPage {
  const [x0, y0, x1, y1] = page.view;
  const geometry = pageGeometry({ mediaBox: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, rotation: page.rotate });
  lines.sort((a, b) => a.theta - b.theta || b.baseline - a.baseline || a.start - b.start);

  // Ligature order: the line's own lam-alef glyphs say it, else the page's, else Chrome's (logical).
  const pageOrder = ligatureOrder(lines.flatMap((line) => line.glyphs)) ?? 'logical';
  const texts = lines.map((line) => {
    const ink = line.glyphs.filter((g) => g.text.trim() !== '');
    const order = ligatureOrder(line.glyphs) ?? pageOrder;
    return { ink, pieces: ink.length > 0 ? glyphPieces(line, order) : itemPieces(line) };
  });
  // A line with no letters at all (a number cell) reads in the page's main direction.
  const pageDirection = strongDirection(texts.map((t) => t.pieces.join('')).join(' '));
  // Arabic or Persian: the line's own letters say it, else the page's (only when no line of it is Persian).
  const languages = texts.map((t) => arabicScriptLanguage(t.pieces.join('')));
  const pageLanguage = languages.includes('persian') ? null : languages.includes('arabic') ? 'arabic' : null;

  const result: SourceTextLine[] = lines.map((line, n) => {
    const { ux, uy, start, end, baseline, ascent, descent, size } = line;
    const { ink, pieces } = texts[n];
    const fromGlyphs = ink.length > 0;
    const direction: Direction = strongDirection(pieces.join(''), pageDirection);
    const ordered = logicalOrder(pieces, direction);
    const raw = (languages[n] ?? pageLanguage) === 'arabic' ? arabicLetters(ordered) : ordered;
    const textUnsure = prefillLooksBroken(raw.normalize('NFKC'));
    // Corners of the ink box in (s, p), back to user space: x = s*ux - p*uy, y = s*uy + p*ux.
    const corners = [
      [start, baseline - descent],
      [end, baseline - descent],
      [start, baseline + ascent],
      [end, baseline + ascent],
    ].map(([s, p]) => [s * ux - p * uy, s * uy + p * ux]);
    const xs = corners.map((c) => c[0]);
    const ys = corners.map((c) => c[1]);
    const rect = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    const neighbours = lines
      .filter((other) => other !== line && sameAxis(other, line) && !(other.end < start || other.start > end))
      .map((other) => other.baseline);
    return {
      id: `${pageIndex}:${n}`,
      pageIndex,
      text: textUnsure ? '' : prefillText(raw),
      textUnsure,
      direction,
      color: mostCommon(ink.map((g) => g.fill), '#000000' as HexColor),
      box: pdfRectToVisualBox(geometry, rect),
      turn: visualTurn(line.theta, page.rotate),
      invisible: fromGlyphs && ink.every((g) => g.mode === 3 || g.mode === 7),
      geometry: { rect, ux, uy, baseline, start, end, size, ascent, descent, neighbours },
    };
  });
  return { pageIndex, lines: result };
}
