/**
 * Pure geometry for the editor's pointer and layout work: pointer to page
 * fraction, clamps, moves, resizes, zoom steps, the canvas size cap and the
 * mini-bar placement. No React, no DOM: tests/edit-pdf-ui-interaction.test.ts
 * runs it in Node.
 *
 * Positions are fractions of the visual page (lib/edit-pdf/types.ts); sizes
 * that must not depend on the page are in points.
 */
import {
  MAX_CANVAS_PIXELS,
  ZOOM_STEPS,
  lineBlock,
  lineBoxAt,
  objectBounds,
  type EditorObject,
  type PagePoint,
  type PageSize,
  type QuarterTurn,
  type SourceTextLine,
  type VisualBox,
} from '@/lib/edit-pdf';

/** The page is never drawn wider than this (CSS px) at zoom 1, so a wide screen doesn't blow it up. */
export const FIT_WIDTH_CAP = 900;
/** Narrowest a text box may get, in points. */
export const MIN_TEXT_WIDTH_PT = 24;
/** Smallest a box may be resized to, in points. */
export const MIN_BOX_PT = 6;
/** Below this many CSS px a drag counts as a tap. */
export const TAP_SLOP_PX = 4;
/** Freehand points closer than this (CSS px) to the last kept one are dropped. */
export const INK_MIN_STEP_PX = 1.5;

export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A rectangle by its edges, as getBoundingClientRect gives it. */
export interface Edges {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The middle of the part of the page that is on screen, as page fractions:
 * the page's rect cut down by each clip (the scrolling area, the window).
 * The page's own middle when none of it shows.
 */
export function visibleCenter(page: Edges, clips: Edges[]): PagePoint {
  const width = page.right - page.left;
  const height = page.bottom - page.top;
  if (!(width > 0 && height > 0)) return { x: 0.5, y: 0.5 };
  let { left, top, right, bottom } = page;
  for (const clip of clips) {
    left = Math.max(left, clip.left);
    top = Math.max(top, clip.top);
    right = Math.min(right, clip.right);
    bottom = Math.min(bottom, clip.bottom);
  }
  if (right <= left || bottom <= top) return { x: 0.5, y: 0.5 };
  return { x: ((left + right) / 2 - page.left) / width, y: ((top + bottom) / 2 - page.top) / height };
}

/** A pointer position as a fraction of the page element's rect, clamped to the page. */
export function pointerToFraction(clientX: number, clientY: number, rect: Rect): PagePoint {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp((clientX - rect.left) / rect.width, 0, 1),
    y: clamp((clientY - rect.top) / rect.height, 0, 1),
  };
}

/** The page's CSS size: fit to the container width (capped), times the zoom, keeping the page's aspect. */
export function cssPageSize(containerWidth: number, zoom: number, page: PageSize): { width: number; height: number } {
  const fit = Math.max(0, Math.min(containerWidth, FIT_WIDTH_CAP));
  const width = Math.floor(fit * zoom);
  const height = page.width > 0 ? Math.floor((width * page.height) / page.width) : 0;
  return { width, height };
}

/**
 * Backing-store size for a canvas shown at cssWidth x cssHeight: the device
 * pixel ratio, lowered when needed so width * height stays within maxPixels
 * (iOS Safari refuses bigger canvases and draws nothing).
 */
export function canvasBackingSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  maxPixels: number = MAX_CANVAS_PIXELS,
): { width: number; height: number; ratio: number } {
  const dpr = devicePixelRatio > 0 && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  const area = cssWidth * cssHeight;
  const ratio = area > 0 ? Math.min(dpr, Math.sqrt(maxPixels / area)) : dpr;
  return { width: Math.max(1, Math.floor(cssWidth * ratio)), height: Math.max(1, Math.floor(cssHeight * ratio)), ratio };
}

function zoomIndex(zoom: number): number {
  let best = 0;
  ZOOM_STEPS.forEach((step, i) => {
    if (Math.abs(step - zoom) < Math.abs(ZOOM_STEPS[best] - zoom)) best = i;
  });
  return best;
}

/** The next zoom step in a direction; the same value at either end. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const index = clamp(zoomIndex(zoom) + direction, 0, ZOOM_STEPS.length - 1);
  return ZOOM_STEPS[index];
}

export function canZoom(zoom: number, direction: 1 | -1): boolean {
  const index = zoomIndex(zoom) + direction;
  return index >= 0 && index < ZOOM_STEPS.length;
}

/** The next value of a fixed list (TEXT_SIZES, STROKE_WIDTHS) in a direction, starting from the nearest entry; the same value at either end. */
export function stepIn(list: readonly number[], value: number, direction: 1 | -1): number {
  let index = 0;
  list.forEach((v, i) => {
    if (Math.abs(v - value) < Math.abs(list[index] - value)) index = i;
  });
  if (direction === 1 && list[index] <= value) index += 1;
  if (direction === -1 && list[index] >= value) index -= 1;
  return list[clamp(index, 0, list.length - 1)];
}

/** A box from two drag corners, in any order. */
export function boxFromPoints(a: PagePoint, b: PagePoint): VisualBox {
  return {
    xPct: Math.min(a.x, b.x),
    yPct: Math.min(a.y, b.y),
    wPct: Math.abs(b.x - a.x),
    hPct: Math.abs(b.y - a.y),
  };
}

/** A box of this size centred on a point, kept inside the page. */
export function boxAround(center: PagePoint, wPct: number, hPct: number): VisualBox {
  const w = Math.min(wPct, 1);
  const h = Math.min(hPct, 1);
  return { xPct: clamp(center.x - w / 2, 0, 1 - w), yPct: clamp(center.y - h / 2, 0, 1 - h), wPct: w, hPct: h };
}

/** A line of this length (fraction of the page width) centred on a point, kept inside the page. */
export function lineAround(center: PagePoint, lengthPct: number): { from: PagePoint; to: PagePoint } {
  const half = Math.min(lengthPct, 1) / 2;
  const cx = clamp(center.x, half, 1 - half);
  return { from: { x: cx - half, y: center.y }, to: { x: cx + half, y: center.y } };
}

/**
 * Where a new text box goes for a tap: the tap is its top-left corner in a
 * left-to-right locale and its top-right corner in Arabic, kept on the page.
 */
export function textBoxAt(tap: PagePoint, wPct: number, hPct: number, rtl: boolean): VisualBox {
  const w = Math.min(wPct, 1);
  const h = Math.min(hPct, 1);
  const x = rtl ? tap.x - w : tap.x;
  return { xPct: clamp(x, 0, 1 - w), yPct: clamp(tap.y, 0, 1 - h), wPct: w, hPct: h };
}

/** Move by (dx, dy) fractions, stopping at the page edges (a box larger than the page stays at 0). */
export function clampDelta(bounds: VisualBox, dx: number, dy: number): { dx: number; dy: number } {
  const minDx = -bounds.xPct;
  const maxDx = Math.max(minDx, 1 - bounds.xPct - bounds.wPct);
  const minDy = -bounds.yPct;
  const maxDy = Math.max(minDy, 1 - bounds.yPct - bounds.hPct);
  return { dx: clamp(dx, minDx, maxDx), dy: clamp(dy, minDy, maxDy) };
}

/** The object moved by (dx, dy) fractions of the page, kept inside the page. A replace box is anchored to its line and never moves. */
export function translateObject<T extends EditorObject>(object: T, dx: number, dy: number): T {
  if (object.kind === 'replace') return object;
  const d = clampDelta(objectBounds(object), dx, dy);
  if (d.dx === 0 && d.dy === 0) return object;
  switch (object.kind) {
    case 'line':
      return {
        ...object,
        from: { x: object.from.x + d.dx, y: object.from.y + d.dy },
        to: { x: object.to.x + d.dx, y: object.to.y + d.dy },
      };
    case 'ink':
      return { ...object, points: object.points.map((v, i) => v + (i % 2 === 0 ? d.dx : d.dy)) };
    default: {
      const box = (object as Extract<EditorObject, { box: VisualBox }>).box;
      return { ...object, box: { ...box, xPct: box.xPct + d.dx, yPct: box.yPct + d.dy } };
    }
  }
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se';

export interface ResizeOptions {
  /** Keep the box's proportions (images and signatures). */
  keepAspect: boolean;
  /** The visual page in points (aspect math is done in points, where a square is square). */
  page: PageSize;
  /** Smallest side in points. */
  minPt?: number;
}

/**
 * Resize a box by dragging one corner by (dx, dy) fractions; the opposite
 * corner stays put. The box never flips, never gets smaller than minPt and
 * never leaves the page. With keepAspect the new size is the projection of
 * the dragged size onto the original proportions.
 */
export function resizeBox(start: VisualBox, corner: Corner, dx: number, dy: number, options: ResizeOptions): VisualBox {
  const { page } = options;
  const minPt = options.minPt ?? MIN_BOX_PT;
  const east = corner === 'ne' || corner === 'se';
  const south = corner === 'sw' || corner === 'se';
  const anchorX = east ? start.xPct : start.xPct + start.wPct;
  const anchorY = south ? start.yPct : start.yPct + start.hPct;
  // Room from the anchor to the page edge in the drag direction, in points.
  const roomW = (east ? 1 - anchorX : anchorX) * page.width;
  const roomH = (south ? 1 - anchorY : anchorY) * page.height;
  let wPt = (start.wPct + (east ? dx : -dx)) * page.width;
  let hPt = (start.hPct + (south ? dy : -dy)) * page.height;

  if (options.keepAspect && start.wPct > 0 && start.hPct > 0) {
    const w0 = start.wPct * page.width;
    const h0 = start.hPct * page.height;
    let scale = (wPt * w0 + hPt * h0) / (w0 * w0 + h0 * h0);
    scale = Math.max(scale, minPt / Math.min(w0, h0));
    scale = Math.min(scale, roomW / w0, roomH / h0);
    wPt = w0 * scale;
    hPt = h0 * scale;
  } else {
    wPt = clamp(wPt, Math.min(minPt, roomW), roomW);
    hPt = clamp(hPt, Math.min(minPt, roomH), roomH);
  }

  const wPct = wPt / page.width;
  const hPct = hPt / page.height;
  return {
    xPct: east ? anchorX : anchorX - wPct,
    yPct: south ? anchorY : anchorY - hPct,
    wPct,
    hPct,
  };
}

/**
 * Change a text box's width from its left ('w') or right ('e') side by dx
 * fractions. The other side stays put; the width never drops below
 * MIN_TEXT_WIDTH_PT and the box stays on the page.
 */
export function resizeTextWidth(start: VisualBox, side: 'w' | 'e', dx: number, pageWidthPt: number): VisualBox {
  const minW = Math.min(1, MIN_TEXT_WIDTH_PT / pageWidthPt);
  if (side === 'e') {
    const wPct = clamp(start.wPct + dx, minW, 1 - start.xPct);
    return { ...start, wPct: Math.max(wPct, Math.min(minW, 1 - start.xPct)) };
  }
  const right = start.xPct + start.wPct;
  const xPct = clamp(start.xPct + dx, 0, Math.max(0, right - minW));
  return { ...start, xPct, wPct: right - xPct };
}

/** Map a point from one box to another (used to scale a freehand stroke with its bounds). */
function mapPoint(v: number, fromStart: number, fromSize: number, toStart: number, toSize: number): number {
  if (fromSize <= 0) return toStart + toSize / 2;
  return toStart + ((v - fromStart) / fromSize) * toSize;
}

/** The object fitted into a new bounding box (resize). Lines are resized by their endpoints instead; a replace box never changes. */
export function withBounds<T extends EditorObject>(object: T, box: VisualBox): T {
  switch (object.kind) {
    case 'line':
    case 'replace':
      return object;
    case 'ink': {
      const b = objectBounds(object);
      const points = object.points.map((v, i) =>
        i % 2 === 0 ? mapPoint(v, b.xPct, b.wPct, box.xPct, box.wPct) : mapPoint(v, b.yPct, b.hPct, box.yPct, box.hPct),
      );
      return { ...object, points };
    }
    default:
      return { ...object, box };
  }
}

/** A freehand point is kept only when it is at least INK_MIN_STEP_PX from the last kept one. */
export function shouldAddInkPoint(last: PagePoint, next: PagePoint, cssWidth: number, cssHeight: number): boolean {
  const dx = (next.x - last.x) * cssWidth;
  const dy = (next.y - last.y) * cssHeight;
  return dx * dx + dy * dy >= INK_MIN_STEP_PX * INK_MIN_STEP_PX;
}

/** Whether a drag moved far enough (CSS px) to count as a drag, not a tap. */
export function isDrag(a: PagePoint, b: PagePoint, cssWidth: number, cssHeight: number): boolean {
  return Math.hypot((b.x - a.x) * cssWidth, (b.y - a.y) * cssHeight) >= TAP_SLOP_PX;
}

/**
 * Where to put a new picture: centred on `center` (the page's middle by
 * default) and kept on the page, `widthPct` of the page wide, or its natural
 * size (1 image px = 0.75 pt, as CSS does) when that is smaller and
 * `allowNatural` is on, and never taller than 80% of the page.
 */
export function imageBoxFor(
  pixelWidth: number,
  pixelHeight: number,
  page: PageSize,
  widthPct: number,
  allowNatural = true,
  center: PagePoint = { x: 0.5, y: 0.5 },
): VisualBox {
  const aspect = pixelWidth > 0 && pixelHeight > 0 ? pixelHeight / pixelWidth : 1;
  const natural = allowNatural && pixelWidth > 0 ? pixelWidth * 0.75 : Infinity;
  let wPt = Math.min(widthPct * page.width, natural);
  let hPt = wPt * aspect;
  const maxH = 0.8 * page.height;
  if (hPt > maxH) {
    hPt = maxH;
    wPt = hPt / aspect;
  }
  return boxAround(center, wPt / page.width, hPt / page.height);
}

export interface MiniBarPlacement {
  left: number;
  top: number;
  placement: 'above' | 'below';
}

/**
 * Where the mini-bar goes, in CSS px inside the page: centred above the
 * selection, below it when there is no room above, and always clamped inside
 * the page (when neither fits it overlaps the selection rather than leaving
 * the page).
 */
export function placeMiniBar(
  anchor: Rect,
  bar: { width: number; height: number },
  container: { width: number; height: number },
  gap = 8,
): MiniBarPlacement {
  const left = clamp(anchor.left + anchor.width / 2 - bar.width / 2, 0, Math.max(0, container.width - bar.width));
  const above = anchor.top - gap - bar.height;
  if (above >= 0) return { left, top: above, placement: 'above' };
  const below = anchor.top + anchor.height + gap;
  return {
    left,
    top: clamp(below, 0, Math.max(0, container.height - bar.height)),
    placement: 'below',
  };
}

// ── Edit text (beta): picking a detected line, and the edit field ─────────

/**
 * Where a line's baseline crosses the page, in points from the visual page's
 * top-left, measured across the line: y of a horizontal line, x of a vertical
 * one. `turn` is the line's clockwise turn on screen; ascent sits on the
 * glyphs' "up" side (above for 0, right for 90, below for 180, left for 270).
 */
function baselineAcross(box: VisualBox, line: SourceTextLine, turn: number, page: PageSize): number {
  const { ascent, descent } = line.geometry;
  const total = ascent + descent;
  const up = total > 0 ? ascent / total : 1;
  const top = box.yPct * page.height;
  const left = box.xPct * page.width;
  const h = box.hPct * page.height;
  const w = box.wPct * page.width;
  switch (turn) {
    case 0:
      return top + h * up;
    case 180:
      return top + h * (1 - up);
    case 90:
      return left + w * (1 - up);
    default:
      return left + w * up;
  }
}

/** How far (CSS px) a finger may land beside a line's ink, across the line, and still pick it. */
export const LINE_TAP_SLOP_PX = 12;

/**
 * The detected line under a point of the visual page, for the Edit text tool.
 * Only lines `accept` lets through count (by default the ones that can get a
 * box right now: lineBlock null, so invisible, slanted and turned lines are
 * never hit). Among overlapping boxes (exact line spacing makes ink boxes
 * overlap) the line whose baseline is nearest the point wins, measured in
 * points across each line. A finger (`slopPt` > 0: lines set at 10 pt are
 * about 8 CSS px tall on a phone) may also land up to `slopPt` points beside
 * a box, across its line; a point in no box goes to the nearest box edge.
 * Null when the point is on no accepted line.
 */
export function lineAt(
  lines: readonly SourceTextLine[],
  point: PagePoint,
  rotation: QuarterTurn,
  page: PageSize,
  accept: (line: SourceTextLine) => boolean = (line) => lineBlock(line, rotation) === null,
  slopPt = 0,
): SourceTextLine | null {
  let best: SourceTextLine | null = null;
  let bestGap = Infinity;
  let bestDistance = Infinity;
  for (const line of lines) {
    if (!accept(line)) continue;
    const box = lineBoxAt(line, rotation);
    // How far outside the box the point is, in points, across the line (both ways for a slanted line).
    const across = line.turn === null ? null : (line.turn + rotation) % 180 === 0 ? 'y' : 'x';
    const outX = Math.max(0, box.xPct - point.x, point.x - box.xPct - box.wPct) * page.width;
    const outY = Math.max(0, box.yPct - point.y, point.y - box.yPct - box.hPct) * page.height;
    if ((across === 'y' && outX > 0) || (across === 'x' && outY > 0)) continue;
    const gap = across === 'y' ? outY : across === 'x' ? outX : Math.hypot(outX, outY);
    if (gap > slopPt) continue;
    let distance: number;
    if (line.turn === null) {
      // Slanted: no axis to measure across, so the distance to the box's middle.
      distance = Math.hypot((point.x - box.xPct - box.wPct / 2) * page.width, (point.y - box.yPct - box.hPct / 2) * page.height);
    } else {
      const turn = (line.turn + rotation) % 360;
      const across = turn % 180 === 0 ? point.y * page.height : point.x * page.width;
      distance = Math.abs(across - baselineAcross(box, line, turn, page));
    }
    if (gap < bestGap || (gap === bestGap && distance < bestDistance)) {
      best = line;
      bestGap = gap;
      bestDistance = distance;
    }
  }
  return best;
}

/** Below this viewport width (CSS px) the edit field docks full width above the on-screen keyboard. */
export const REPLACE_FIELD_DOCK_BELOW = 768;
/** The floating edit field's width range, CSS px. */
export const REPLACE_FIELD_MIN_WIDTH = 240;
export const REPLACE_FIELD_MAX_WIDTH = 480;
/** Side gutter of the docked field, CSS px. */
export const REPLACE_FIELD_GUTTER = 16;

export function replaceFieldDocked(viewportWidth: number): boolean {
  return viewportWidth < REPLACE_FIELD_DOCK_BELOW;
}

export interface FloatingFieldPlacement extends MiniBarPlacement {
  width: number;
}

/**
 * The floating edit field (768 px and up), in CSS px inside the page: as wide
 * as the line, kept between 240 and 480 px (and never wider than the page),
 * centred on the line, above it, below when there is no room above, clamped
 * inside the page like the mini-bar.
 */
export function placeReplaceField(
  line: Rect,
  fieldHeight: number,
  container: { width: number; height: number },
  gap = 8,
): FloatingFieldPlacement {
  const width = Math.min(clamp(line.width, REPLACE_FIELD_MIN_WIDTH, REPLACE_FIELD_MAX_WIDTH), Math.max(0, container.width));
  return { ...placeMiniBar(line, { width, height: fieldHeight }, container, gap), width };
}

/** The visible part of the window (window.visualViewport): it shrinks when the on-screen keyboard opens. */
export interface VisibleViewport {
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
}

export interface DockedFieldPlacement {
  /** position: fixed, CSS px. */
  left: number;
  top: number;
  width: number;
  /** How far to scroll the window down so the line shows above the field (0 when it already does). */
  scrollBy: number;
}

/**
 * The docked edit field (below 768 px): full width with 16 px gutters, sitting
 * on the bottom of the visible viewport, i.e. just above the on-screen
 * keyboard when it is open. `line` is the line's rect in viewport (client)
 * px; when the field would cover it, scrollBy says how far to scroll so the
 * line shows just above the field (never more than puts its top at the top
 * of the visible viewport).
 */
export function dockReplaceField(line: Edges, fieldHeight: number, viewport: VisibleViewport, gap = 8): DockedFieldPlacement {
  const top = viewport.offsetTop + Math.max(0, viewport.height - fieldHeight - gap);
  const width = Math.max(0, viewport.width - REPLACE_FIELD_GUTTER * 2);
  const room = top - gap;
  const overlap = line.bottom - room;
  const scrollBy = overlap > 0 ? Math.max(0, Math.min(overlap, line.top - viewport.offsetTop)) : 0;
  return { left: viewport.offsetLeft + REPLACE_FIELD_GUTTER, top, width, scrollBy };
}
