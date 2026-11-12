/**
 * Pure helpers over the editor model, shared by the UI reducer and the
 * export. No DOM, no pdf-lib, no pdf.js: tests run them in Node.
 * Owner: ENGINE builder (tests/edit-pdf-model.test.ts).
 */
import {
  LETTERHEAD_MIN_SCALE,
  REPLACE_FIT_MAX,
  REPLACE_FIT_MIN,
  REPLACE_FIT_UNSURE,
  REPLACE_MAX_SIZE,
  REPLACE_MIN_SIZE,
  REPLACE_SIZE_STEP,
} from './types';
import type {
  EditorObject,
  EditorPage,
  PageNumberStamp,
  PagePoint,
  QuarterTurn,
  ReplaceObject,
  SourcePageInfo,
  SourceTextLine,
  StampPosition,
  VisualBox,
  LetterheadStamp,
  TextExtent,
  WatermarkStamp,
} from './types';

export interface PageSize {
  /** Points. */
  width: number;
  height: number;
}

/** The page's size as the editor shows it: source visible box (or blank size) turned by /Rotate + the added turns. */
export function pageVisualSize(page: EditorPage, sourcePages: readonly SourcePageInfo[]): PageSize {
  let width: number;
  let height: number;
  let turn: number = page.rotation;
  if (page.source.kind === 'source') {
    const info = sourcePages[page.source.index];
    if (!info) throw new RangeError(`No source page ${page.source.index}`);
    width = info.width;
    height = info.height;
    turn += info.rotate;
  } else {
    width = page.source.width;
    height = page.source.height;
  }
  return turn % 180 === 90 ? { width: height, height: width } : { width, height };
}

/** Text and images stay upright for the reader when their page turns; everything else turns with the page. */
export function isUprightObject(object: EditorObject): boolean {
  return object.kind === 'text' || object.kind === 'image';
}

function boundsOfPoints(points: readonly number[]): VisualBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < points.length; i += 2) {
    minX = Math.min(minX, points[i]);
    maxX = Math.max(maxX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    maxY = Math.max(maxY, points[i + 1]);
  }
  if (minX === Infinity) return { xPct: 0, yPct: 0, wPct: 0, hPct: 0 };
  return { xPct: minX, yPct: minY, wPct: maxX - minX, hPct: maxY - minY };
}

/** The axis-aligned box an object covers on its visual page (stroke width not included). */
export function objectBounds(object: EditorObject): VisualBox {
  switch (object.kind) {
    case 'line':
      return boundsOfPoints([object.from.x, object.from.y, object.to.x, object.to.y]);
    case 'ink':
      return boundsOfPoints(object.points);
    default:
      return object.box;
  }
}

/** A point on the visual page in POINTS from its top-left (y down). */
export interface PointPt {
  x: number;
  y: number;
}

/**
 * The two arms of the open arrowhead at `to`, in points on the visual page.
 * Preview and export both draw tip→arm with the line's width and round caps,
 * so they must take the arms from here. Work in points, never fractions: a
 * fraction is longer one way than the other on a non-square page.
 */
export function arrowHeadArms(from: PointPt, to: PointPt, strokeWidth: number): [PointPt, PointPt] {
  const length = Math.max(8, strokeWidth * 4);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = (25 * Math.PI) / 180;
  return [
    { x: to.x - length * Math.cos(angle - spread), y: to.y - length * Math.sin(angle - spread) },
    { x: to.x - length * Math.cos(angle + spread), y: to.y - length * Math.sin(angle + spread) },
  ];
}

/** A point of the visual page after the page turns 90° clockwise: (x, y) → (1 - y, x). */
function turnPoint(point: PagePoint): PagePoint {
  return { x: 1 - point.y, y: point.x };
}

/** Where a box of `size` may start so it stays on the page (a box larger than the page starts at 0). */
function clampStart(start: number, size: number): number {
  return size >= 1 ? 0 : Math.min(Math.max(start, 0), 1 - size);
}

/**
 * The object after its page turns 90° clockwise (the editor's Rotate button).
 * `before` is the page's visual size in points BEFORE the turn.
 *
 * - Cover, highlight, shapes, lines and drawing turn with the page, exactly,
 *   so they stay over the same content.
 * - Text and images stay upright: same size in points, centre on the same
 *   spot of the content, moved back inside the page if the new shape of the
 *   page pushes them out.
 *
 * Four turns give back the same object (up to floating point), unless a turn
 * had to move an upright object back inside the page.
 */
export function rotateObjectClockwise(object: EditorObject, before: PageSize): EditorObject {
  switch (object.kind) {
    case 'line':
      return { ...object, from: turnPoint(object.from), to: turnPoint(object.to) };
    case 'ink': {
      const points: number[] = [];
      for (let i = 0; i + 1 < object.points.length; i += 2) {
        const p = turnPoint({ x: object.points[i], y: object.points[i + 1] });
        points.push(p.x, p.y);
      }
      return { ...object, points };
    }
    case 'text':
    case 'image': {
      const b = object.box;
      // Size in points is kept: after the turn the page is before.height wide and before.width high.
      const wPct = (b.wPct * before.width) / before.height;
      const hPct = (b.hPct * before.height) / before.width;
      const centre = turnPoint({ x: b.xPct + b.wPct / 2, y: b.yPct + b.hPct / 2 });
      return {
        ...object,
        box: { xPct: clampStart(centre.x - wPct / 2, wPct), yPct: clampStart(centre.y - hPct / 2, hPct), wPct, hPct },
      };
    }
    default:
      // Cover, highlight, shapes and replace (whose page the reducer never turns) turn with the page.
      return { ...object, box: turnBoxClockwise(object.box) };
  }
}

/** A box of the visual page after the page turns 90° clockwise. */
function turnBoxClockwise(b: VisualBox): VisualBox {
  return { xPct: 1 - b.yPct - b.hPct, yPct: b.xPct, wPct: b.hPct, hPct: b.wPct };
}

// ── Crop and document stamps (workspace-spec.md 3.1) ───────────────────────

/** Page numbers sit this far from the visible box's edges (lib/pdf-ops addPageNumbers). */
export const STAMP_MARGIN_PT = 20;
/** Diagonal and tiled text watermarks, in degrees, counter-clockwise for the reader. */
export const WATERMARK_ANGLE = 45;
/** Space between tiled text watermarks, across and down (lib/pdf-ops watermarkPDF). */
export const WATERMARK_TILE_GAP_PT = 100;
/** Space between tiled image watermarks. */
export const WATERMARK_IMAGE_TILE_GAP_PT = 50;
/** An image watermark is drawn at this many points per pixel (lib/pdf-ops: image.scale(0.5)). */
export const WATERMARK_IMAGE_SCALE = 0.5;
/** ...but never wider or taller than this fraction of the visible box. */
export const WATERMARK_IMAGE_MAX = 0.8;

/** The crop after its page turns 90° clockwise: it stays over the same content. Four turns give it back. */
export function rotateCropClockwise(crop: VisualBox): VisualBox {
  return turnBoxClockwise(crop);
}

/** What a reader sees of the page, in points: pageVisualSize cut down by the crop. */
export function visibleSize(page: EditorPage, sourcePages: readonly SourcePageInfo[]): PageSize {
  const size = pageVisualSize(page, sourcePages);
  return page.crop ? { width: size.width * page.crop.wPct, height: size.height * page.crop.hPct } : size;
}

/**
 * The number line of one saved page. `outputIndex` is the page's 0-based
 * position among the saved pages, `outputCount` how many are saved. The
 * total counts as if numbering had started at 1 before the first saved page
 * (start 3 on 4 pages ends "Page 6 of 6"; lib/pdf-ops would say "of 4").
 */
export function pageNumberText(stamp: Pick<PageNumberStamp, 'template' | 'startFrom'>, outputIndex: number, outputCount: number): string {
  const n = String(stamp.startFrom + outputIndex);
  const total = String(stamp.startFrom - 1 + outputCount);
  return stamp.template.split('{n}').join(n).split('{total}').join(total);
}

/**
 * Top-left of the number's box, in points from the visible box's top-left
 * (y down): STAMP_MARGIN_PT from the edges it sits against, centred across
 * for the *-center positions. `textWidth` and `lineHeight` are the laid-out
 * line's (the export's lib/pdf-text layout, the preview's TextEngine).
 */
export function pageNumberOrigin(position: StampPosition, visible: PageSize, textWidth: number, lineHeight: number): PointPt {
  const y = position.startsWith('top') ? STAMP_MARGIN_PT : visible.height - STAMP_MARGIN_PT - lineHeight;
  let x = STAMP_MARGIN_PT;
  if (position.endsWith('center')) x = (visible.width - textWidth) / 2;
  else if (position.endsWith('right')) x = visible.width - STAMP_MARGIN_PT - textWidth;
  return { x, y };
}

/** One copy of the watermark: its centre in points from the visible box's top-left (y down), and its angle in degrees counter-clockwise for the reader. */
export interface WatermarkPlacement {
  cx: number;
  cy: number;
  angle: number;
}

/**
 * Where the copies of a `w` x `h` point watermark go on a visible box.
 * center: one copy, upright. diagonal: one copy at WATERMARK_ANGLE (text
 * only: an image stays upright, as lib/pdf-ops draws it). tiled: a grid
 * stepping (w + gap, h + gap) from half a step in, enough rows and columns
 * to cover the box, every copy at WATERMARK_ANGLE for text, upright for images.
 */
export function watermarkPlacements(
  stamp: Pick<WatermarkStamp, 'type' | 'position'>,
  visible: PageSize,
  w: number,
  h: number,
): WatermarkPlacement[] {
  const text = stamp.type === 'text';
  if (stamp.position !== 'tiled') {
    return [{ cx: visible.width / 2, cy: visible.height / 2, angle: text && stamp.position === 'diagonal' ? WATERMARK_ANGLE : 0 }];
  }
  const gap = text ? WATERMARK_TILE_GAP_PT : WATERMARK_IMAGE_TILE_GAP_PT;
  const stepX = Math.max(w, 0) + gap;
  const stepY = Math.max(h, 0) + gap;
  const cols = Math.max(1, Math.ceil(visible.width / stepX));
  const rows = Math.max(1, Math.ceil(visible.height / stepY));
  const angle = text ? WATERMARK_ANGLE : 0;
  const out: WatermarkPlacement[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) out.push({ cx: (col + 0.5) * stepX, cy: (row + 0.5) * stepY, angle });
  }
  return out;
}

/** An image watermark's size in points: WATERMARK_IMAGE_SCALE points per pixel, scaled down (aspect kept) to fit WATERMARK_IMAGE_MAX of the visible box. */
export function watermarkImageSize(image: { width: number; height: number }, visible: PageSize): PageSize {
  const width = image.width * WATERMARK_IMAGE_SCALE;
  const height = image.height * WATERMARK_IMAGE_SCALE;
  const k = Math.min(1, (visible.width * WATERMARK_IMAGE_MAX) / width, (visible.height * WATERMARK_IMAGE_MAX) / height);
  return { width: width * k, height: height * k };
}

// ── Letterhead ──────────────────────────────────────────────────────────────

/** From the page edges. */
export const LETTERHEAD_MARGIN_PT = 24;
/** The logo's height; a wide logo is narrowed to LETTERHEAD_LOGO_MAX_W_PT. */
export const LETTERHEAD_LOGO_PT = 40;
export const LETTERHEAD_LOGO_MAX_W_PT = 120;
/** Between the logo and each side's text, and between a block and its rule. */
export const LETTERHEAD_GAP_PT = 10;
/** Page content is never shrunk below this to make room. */
export const LETTERHEAD_ROOM_MIN_SCALE = 0.6;

export interface BoxPt {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Something to draw: text on a side or at the bottom, or a logo. */
export function letterheadHasContent(stamp: Pick<LetterheadStamp, 'left' | 'right' | 'footer' | 'logoAssetId'>): boolean {
  return !!stamp.logoAssetId || [stamp.left, stamp.right, stamp.footer].some((t) => t.trim() !== '');
}

/** The logo's box, centred at the top, or null. `logo` is its size in pixels. */
export function letterheadLogoBox(visible: PageSize, logo: PageSize | undefined): BoxPt | null {
  if (!logo || logo.width <= 0 || logo.height <= 0) return null;
  let h = LETTERHEAD_LOGO_PT;
  let w = (h * logo.width) / logo.height;
  if (w > LETTERHEAD_LOGO_MAX_W_PT) {
    h *= LETTERHEAD_LOGO_MAX_W_PT / w;
    w = LETTERHEAD_LOGO_MAX_W_PT;
  }
  return { x: (visible.width - w) / 2, y: LETTERHEAD_MARGIN_PT, w, h };
}

/** How wide each side's text may be: half of what the logo leaves between the margins. Text wraps to this. */
export function letterheadSideWidth(visible: PageSize, logo: PageSize | undefined): number {
  const box = letterheadLogoBox(visible, logo);
  const inner = Math.max(0, visible.width - 2 * LETTERHEAD_MARGIN_PT);
  return Math.max(1, (inner - (box ? box.w + 2 * LETTERHEAD_GAP_PT : LETTERHEAD_GAP_PT)) / 2);
}

/** How wide the bottom lines may be. */
export function letterheadFooterWidth(visible: PageSize): number {
  return Math.max(1, visible.width - 2 * LETTERHEAD_MARGIN_PT);
}

/** A side's text split for drawing: its first line is the name, the rest are the details (either may be ''). */
export function splitLetterheadText(text: string): { name: string; details: string } {
  const lines = text.trim().split(/\r?\n/);
  return { name: lines[0].trim(), details: lines.slice(1).join('\n').trim() };
}

/**
 * A text block laid out at its base sizes and wrapped to its width: its
 * widest line (wider than the width only for a word that can't break) and
 * its height.
 */
export interface MeasuredBlock {
  width: number;
  height: number;
}

/** The size multiplier that fits a block in `avail`, never under LETTERHEAD_MIN_SCALE. */
export function letterheadScale(block: MeasuredBlock, avail: number): number {
  return Math.max(LETTERHEAD_MIN_SCALE, Math.min(1, avail / Math.max(block.width, 1e-9)));
}

/**
 * Where the letterhead's parts go, in points from the visible box's top-left
 * (y down), shared by the export and the preview. Each text box is its whole
 * column (left side, right side, footer across the margins): the text aligns
 * inside it. `scale` multiplies the block's font sizes. Rules are y
 * positions across the margins, or null.
 */
export interface LetterheadPlacement {
  left: (BoxPt & { scale: number }) | null;
  right: (BoxPt & { scale: number }) | null;
  logo: BoxPt | null;
  footer: (BoxPt & { scale: number }) | null;
  headerRule: number | null;
  footerRule: number | null;
}

/** `left`, `right`, `footer`: each block measured at scale 1 (see MeasuredBlock); `logo` in pixels. */
export interface LetterheadSizes {
  left?: MeasuredBlock;
  right?: MeasuredBlock;
  logo?: PageSize;
  footer?: MeasuredBlock;
}

export function letterheadPlacement(visible: PageSize, sizes: LetterheadSizes): LetterheadPlacement {
  const m = LETTERHEAD_MARGIN_PT;
  const gap = LETTERHEAD_GAP_PT;
  const logo = letterheadLogoBox(visible, sizes.logo);
  const side = letterheadSideWidth(visible, sizes.logo);
  const column = (block: MeasuredBlock | undefined, x: number, y: number, w: number) => {
    if (!block || block.height <= 0) return null;
    const scale = letterheadScale(block, w);
    return { x, y, w, h: block.height * scale, scale };
  };
  const left = column(sizes.left, m, m, side);
  const right = column(sizes.right, visible.width - m - side, m, side);
  const band = Math.max(left?.h ?? 0, right?.h ?? 0, logo?.h ?? 0);
  const headerRule = band > 0 ? m + band + gap / 2 : null;

  const inner = letterheadFooterWidth(visible);
  const f = sizes.footer && sizes.footer.height > 0 ? letterheadScale(sizes.footer, inner) : null;
  const footer = f !== null ? { x: m, y: visible.height - m - sizes.footer!.height * f, w: inner, h: sizes.footer!.height * f, scale: f } : null;
  const footerRule = footer ? footer.y - gap / 2 : null;
  return { left, right, logo, footer, headerRule, footerRule };
}

/**
 * The page's own content, shrunk and moved so its text clears the
 * letterhead: content point (x, y) goes to (dx + scale·x, dy + scale·y), in
 * points from the visible top-left (y down). null when the text already
 * clears it (or the page has no text). It moves as little as it can: only
 * down when there is room below, smaller only when it must, centred across.
 */
export interface LetterheadRoom {
  scale: number;
  dx: number;
  dy: number;
}

export function letterheadRoom(visible: PageSize, placed: LetterheadPlacement, text: TextExtent | undefined): LetterheadRoom | null {
  if (!text || !(text.bottom > text.top)) return null;
  const gap = LETTERHEAD_GAP_PT;
  const top = placed.headerRule !== null ? placed.headerRule + gap : 0;
  const bottom = placed.footerRule !== null ? placed.footerRule - gap : visible.height;
  if (text.top >= top && text.bottom <= bottom) return null;
  const scale = Math.max(LETTERHEAD_ROOM_MIN_SCALE, Math.min(1, (bottom - top) / (text.bottom - text.top)));
  const lo = top - scale * text.top;
  const hi = bottom - scale * text.bottom;
  // The smallest move that clears both: 0 if it can, else the nearest bound (lo wins when even the smallest scale can't fit)
  const dy = lo > hi ? lo : Math.min(Math.max(0, lo), hi);
  return { scale, dx: ((1 - scale) * visible.width) / 2, dy };
}

// ── Replace text (Phase C) ─────────────────────────────────────────────────

/** A detected line's box on its page as the editor shows it, with `rotation` added in the editor. */
export function lineBoxAt(line: SourceTextLine, rotation: QuarterTurn): VisualBox {
  let box = line.box;
  for (let turn = 0; turn < rotation; turn += 90) box = turnBoxClockwise(box);
  return box;
}

/**
 * Why a detected line can't get a replace box right now, or null when it can:
 * 'invisible' = OCR layer of a scan (the picture would still show the old
 * words), 'slanted' = not a quarter turn, 'turned' = it doesn't read normally
 * on screen at this editor rotation (the box can't be rotated).
 */
export type LineBlock = 'invisible' | 'slanted' | 'turned';

export function lineBlock(line: SourceTextLine, rotation: QuarterTurn): LineBlock | null {
  if (line.invisible) return 'invisible';
  if (line.turn === null) return 'slanted';
  return (line.turn + rotation) % 360 === 0 ? null : 'turned';
}

const roundSize = (size: number) => Math.round(size * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * The size a new replace box starts at. `prefillWidth` = width in points of
 * line.text laid out in Cairo at line.geometry.size (TextEngine.layout).
 */
export function defaultReplaceSize(line: SourceTextLine, prefillWidth: number): number {
  const { size, start, end } = line.geometry;
  const fit = line.textUnsure || !(prefillWidth > 0) ? REPLACE_FIT_UNSURE : clamp((end - start) / prefillWidth, REPLACE_FIT_MIN, REPLACE_FIT_MAX);
  return roundSize(clamp(size * fit, REPLACE_MIN_SIZE, REPLACE_MAX_SIZE));
}

/** Smaller (-1) / Bigger (+1) for a replacement, up to `max`. Returns `size` unchanged at either end (the button shows its disabled reason). */
export function stepReplaceSize(size: number, direction: 1 | -1, max = REPLACE_MAX_SIZE): number {
  const next = roundSize(clamp(size + direction * REPLACE_SIZE_STEP, REPLACE_MIN_SIZE, max));
  return next === roundSize(size) ? size : next;
}

/**
 * The largest size a replacement may have: REPLACE_MAX_SIZE, or the line's
 * own size (rounded to 0.1) when it is drawn in its own font above that, so
 * Smaller on a 96 pt title steps to 95.5, not straight down to 72.
 */
export function replaceSizeMax(object: Pick<ReplaceObject, 'font' | 'line'>): number {
  const own = object.font && object.font.lineId === object.line.id && Number.isFinite(object.font.size) ? roundSize(object.font.size) : 0;
  return Math.max(REPLACE_MAX_SIZE, own);
}

/** Where the preview starts the new text, in fractions of the visual page. */
export interface ReplaceAnchor {
  /** The old line's start edge: its left edge for an 'ltr' line, its right edge for 'rtl'. */
  x: number;
  edge: 'left' | 'right';
  /** The old baseline. */
  baseline: number;
}

/**
 * The preview's anchor for a replace object. Valid because a replace object
 * only exists while its line reads normally on screen (lineBlock null), so
 * its box is upright: baseline = top + height * ascent / (ascent + descent).
 * The export uses line.geometry (user space) for the same point.
 */
export function replaceAnchor(object: ReplaceObject): ReplaceAnchor {
  const { box, line } = object;
  const { ascent, descent } = line.geometry;
  const edge = line.direction === 'rtl' ? 'right' : 'left';
  const total = ascent + descent;
  return {
    x: edge === 'left' ? box.xPct : box.xPct + box.wPct,
    edge,
    baseline: box.yPct + (total > 0 ? (box.hPct * ascent) / total : box.hPct),
  };
}
