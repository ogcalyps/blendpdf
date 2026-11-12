import { describe, expect, it } from 'vitest';
import {
  FIT_WIDTH_CAP,
  MIN_TEXT_WIDTH_PT,
  boxFromPoints,
  canZoom,
  canvasBackingSize,
  cssPageSize,
  dockReplaceField,
  imageBoxFor,
  isDrag,
  lineAround,
  lineAt,
  placeMiniBar,
  placeReplaceField,
  replaceFieldDocked,
  pointerToFraction,
  resizeBox,
  resizeTextWidth,
  shouldAddInkPoint,
  stepIn,
  stepZoom,
  textBoxAt,
  translateObject,
  visibleCenter,
  withBounds,
  type Corner,
} from '@/components/edit-pdf/interaction';
import {
  MAX_CANVAS_PIXELS,
  STROKE_WIDTHS,
  TEXT_SIZES,
  ZOOM_STEPS,
  objectBounds,
  type InkObject,
  type LineObject,
  type ReplaceObject,
  type SourceTextLine,
  type VisualBox,
} from '@/lib/edit-pdf';

const A4 = { width: 595, height: 842 };
const near = (a: VisualBox, b: VisualBox) => {
  expect(a.xPct).toBeCloseTo(b.xPct, 9);
  expect(a.yPct).toBeCloseTo(b.yPct, 9);
  expect(a.wPct).toBeCloseTo(b.wPct, 9);
  expect(a.hPct).toBeCloseTo(b.hPct, 9);
};

describe('edit-pdf pointer and page size math', () => {
  it('maps a pointer to page fractions, whatever the zoom, and clamps it to the page', () => {
    // A 600 x 848 page at zoom 1 and the same page at zoom 2, both scrolled to (10, 20).
    for (const zoom of [1, 2]) {
      const rect = { left: 10, top: 20, width: 600 * zoom, height: 848 * zoom };
      const p = pointerToFraction(10 + 150 * zoom, 20 + 212 * zoom, rect);
      expect(p.x).toBeCloseTo(0.25);
      expect(p.y).toBeCloseTo(0.25);
    }
    expect(pointerToFraction(-50, 5000, { left: 0, top: 0, width: 100, height: 100 })).toEqual({ x: 0, y: 1 });
  });

  it('fits the page to the container, capped, times the zoom', () => {
    expect(cssPageSize(343, 1, A4)).toEqual({ width: 343, height: Math.floor((343 * 842) / 595) });
    expect(cssPageSize(2000, 1, A4).width).toBe(FIT_WIDTH_CAP);
    expect(cssPageSize(400, 2, A4).width).toBe(800);
  });

  it('caps the canvas backing store at MAX_CANVAS_PIXELS', () => {
    // 3x zoom on a wide screen at DPR 2: 2700 x 3820 CSS px would need about 41 MP.
    const css = cssPageSize(1200, 3, A4);
    const big = canvasBackingSize(css.width, css.height, 2);
    expect(big.width * big.height).toBeLessThanOrEqual(MAX_CANVAS_PIXELS);
    expect(big.ratio).toBeLessThan(2);
    expect(big.ratio).toBeGreaterThan(1);
    expect(big.width / big.height).toBeCloseTo(css.width / css.height, 2);
    // Small enough: the full device pixel ratio.
    const small = canvasBackingSize(343, 485, 3);
    expect(small).toEqual({ width: 1029, height: 1455, ratio: 3 });
    // Bad DPR values fall back to 1.
    expect(canvasBackingSize(100, 100, 0).ratio).toBe(1);
  });

  it('steps the zoom and stops at both ends', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(ZOOM_STEPS[0], -1)).toBe(ZOOM_STEPS[0]);
    expect(stepZoom(ZOOM_STEPS[ZOOM_STEPS.length - 1], 1)).toBe(ZOOM_STEPS[ZOOM_STEPS.length - 1]);
    expect(canZoom(ZOOM_STEPS[0], -1)).toBe(false);
    expect(canZoom(ZOOM_STEPS[0], 1)).toBe(true);
    expect(canZoom(3, 1)).toBe(false);
  });

  it('steps text sizes and stroke widths through the fixed lists, stopping at the ends', () => {
    expect(stepIn(TEXT_SIZES, 14, 1)).toBe(16);
    expect(stepIn(TEXT_SIZES, 14, -1)).toBe(12);
    expect(stepIn(TEXT_SIZES, 72, 1)).toBe(72);
    expect(stepIn(TEXT_SIZES, 8, -1)).toBe(8);
    // A value between steps goes to the next one in that direction.
    expect(stepIn(TEXT_SIZES, 15, 1)).toBe(16);
    expect(stepIn(TEXT_SIZES, 15, -1)).toBe(14);
    expect(stepIn(STROKE_WIDTHS, 2, 1)).toBe(3);
    expect(stepIn(STROKE_WIDTHS, 12, 1)).toBe(12);
  });

  it('tells a drag from a tap and thins freehand points in CSS pixels', () => {
    expect(isDrag({ x: 0, y: 0 }, { x: 0.005, y: 0 }, 600, 800)).toBe(false); // 3 px
    expect(isDrag({ x: 0, y: 0 }, { x: 0.01, y: 0 }, 600, 800)).toBe(true); // 6 px
    expect(shouldAddInkPoint({ x: 0, y: 0 }, { x: 1 / 600, y: 0 }, 600, 800)).toBe(false);
    expect(shouldAddInkPoint({ x: 0, y: 0 }, { x: 2 / 600, y: 0 }, 600, 800)).toBe(true);
  });
});

describe('edit-pdf placement', () => {
  it('builds boxes from drag corners in any order', () => {
    near(boxFromPoints({ x: 0.6, y: 0.5 }, { x: 0.2, y: 0.1 }), { xPct: 0.2, yPct: 0.1, wPct: 0.4, hPct: 0.4 });
  });

  it('puts a new text box with the tap at its start corner: top-left, or top-right in Arabic', () => {
    near(textBoxAt({ x: 0.5, y: 0.3 }, 0.4, 0.02, false), { xPct: 0.5, yPct: 0.3, wPct: 0.4, hPct: 0.02 });
    near(textBoxAt({ x: 0.5, y: 0.3 }, 0.4, 0.02, true), { xPct: 0.1, yPct: 0.3, wPct: 0.4, hPct: 0.02 });
    // Clamped at the page edges.
    near(textBoxAt({ x: 0.9, y: 0.995 }, 0.4, 0.02, false), { xPct: 0.6, yPct: 0.98, wPct: 0.4, hPct: 0.02 });
    near(textBoxAt({ x: 0.1, y: 0 }, 0.4, 0.02, true), { xPct: 0, yPct: 0, wPct: 0.4, hPct: 0.02 });
  });

  it('keeps a tapped line on the page', () => {
    const l = lineAround({ x: 0.95, y: 0.5 }, 0.2);
    expect(l.from.x).toBeCloseTo(0.8);
    expect(l.to.x).toBeCloseTo(1);
  });

  it('sizes a picture to 40% of the page width, or its natural size, never taller than 80%', () => {
    const photo = imageBoxFor(3000, 2000, A4, 0.4);
    expect(photo.wPct).toBeCloseTo(0.4);
    expect(photo.xPct).toBeCloseTo(0.3);
    const icon = imageBoxFor(100, 100, A4, 0.4);
    expect(icon.wPct * A4.width).toBeCloseTo(75);
    const tall = imageBoxFor(100, 4000, A4, 0.4);
    expect(tall.hPct).toBeCloseTo(0.8);
  });

  it('puts an inserted object in the middle of the part of the page on screen', () => {
    // A 1280 x 860 window: the page (900 x 1273 px) runs past the bottom of its scroll area (y 227 to 847).
    const page = { left: 190, top: 227, right: 1090, bottom: 1500 };
    const area = { left: 166, top: 203, right: 1114, bottom: 847 };
    const viewport = { left: 0, top: 0, right: 1280, bottom: 860 };
    const center = visibleCenter(page, [area, viewport]);
    expect(center.x).toBeCloseTo(0.5);
    expect(center.y).toBeCloseTo((227 + 847) / 2 / 1273 - 227 / 1273);
    const signature = imageBoxFor(120, 30, A4, 0.3, false, center);
    expect((signature.yPct + signature.hPct / 2) * 1273 + 227).toBeCloseTo(537);
    // Scrolled to the page's end: the box stays on the page.
    const end = visibleCenter({ ...page, top: -700, bottom: 573 }, [area, viewport]);
    expect(end.y).toBeGreaterThan(0.75);
    const photo = imageBoxFor(3000, 2000, A4, 0.4, true, { x: 0.5, y: 0.99 });
    expect(photo.yPct + photo.hPct).toBeCloseTo(1);
    // Nothing of the page on screen, or no size yet: the page's own middle.
    expect(visibleCenter(page, [{ left: 0, top: 0, right: 100, bottom: 100 }])).toEqual({ x: 0.5, y: 0.5 });
    expect(visibleCenter({ left: 0, top: 0, right: 0, bottom: 0 }, [viewport])).toEqual({ x: 0.5, y: 0.5 });
  });

  it('places a signature at 30% of the page width whatever its pixel size', () => {
    const small = imageBoxFor(120, 30, A4, 0.3, false);
    expect(small.wPct).toBeCloseTo(0.3);
    expect((small.hPct * A4.height) / (small.wPct * A4.width)).toBeCloseTo(30 / 120);
  });
});

describe('edit-pdf move and resize', () => {
  it('moves an object and stops at the page edges', () => {
    const line: LineObject = {
      id: 'o1', pageId: 's0', kind: 'line', arrow: true, color: '#000000', strokeWidth: 2,
      from: { x: 0.1, y: 0.1 }, to: { x: 0.3, y: 0.2 },
    };
    const moved = translateObject(line, 0.9, -0.5);
    expect(moved.from.x).toBeCloseTo(0.8);
    expect(moved.to.x).toBeCloseTo(1);
    expect(moved.from.y).toBeCloseTo(0);
    expect(moved.to.y).toBeCloseTo(0.1);
    const ink: InkObject = { id: 'o2', pageId: 's0', kind: 'ink', color: '#000000', strokeWidth: 2, points: [0.5, 0.5, 0.6, 0.7] };
    expect(translateObject(ink, 0.1, 0.1).points.map((v) => +v.toFixed(6))).toEqual([0.6, 0.6, 0.7, 0.8]);
  });

  it('resizes from each corner with the aspect kept, the opposite corner fixed', () => {
    const start: VisualBox = { xPct: 0.3, yPct: 0.3, wPct: 0.2, hPct: 0.1 };
    const ratio = (b: VisualBox) => (b.wPct * A4.width) / (b.hPct * A4.height);
    const anchors: Record<Corner, (b: VisualBox) => [number, number]> = {
      nw: (b) => [b.xPct + b.wPct, b.yPct + b.hPct],
      ne: (b) => [b.xPct, b.yPct + b.hPct],
      sw: (b) => [b.xPct + b.wPct, b.yPct],
      se: (b) => [b.xPct, b.yPct],
    };
    const grow: Record<Corner, [number, number]> = { nw: [-0.05, -0.05], ne: [0.05, -0.05], sw: [-0.05, 0.05], se: [0.05, 0.05] };
    for (const corner of Object.keys(anchors) as Corner[]) {
      const [dx, dy] = grow[corner];
      const b = resizeBox(start, corner, dx, dy, { keepAspect: true, page: A4 });
      expect(ratio(b)).toBeCloseTo(ratio(start), 9);
      expect(b.wPct).toBeGreaterThan(start.wPct);
      const [ax, ay] = anchors[corner](b);
      const [sx, sy] = anchors[corner](start);
      expect(ax).toBeCloseTo(sx, 9);
      expect(ay).toBeCloseTo(sy, 9);
    }
  });

  it('keeps an aspect-locked resize on the page and above the minimum size', () => {
    const start: VisualBox = { xPct: 0.6, yPct: 0.6, wPct: 0.2, hPct: 0.1 };
    const huge = resizeBox(start, 'se', 5, 5, { keepAspect: true, page: A4 });
    expect(huge.xPct + huge.wPct).toBeLessThanOrEqual(1 + 1e-9);
    expect(huge.yPct + huge.hPct).toBeLessThanOrEqual(1 + 1e-9);
    const tiny = resizeBox(start, 'se', -5, -5, { keepAspect: true, page: A4, minPt: 10 });
    expect(Math.min(tiny.wPct * A4.width, tiny.hPct * A4.height)).toBeCloseTo(10);
    expect(tiny.xPct).toBeCloseTo(start.xPct);
  });

  it('resizes freely without flipping', () => {
    const start: VisualBox = { xPct: 0.3, yPct: 0.3, wPct: 0.2, hPct: 0.1 };
    const b = resizeBox(start, 'nw', 0.5, -0.1, { keepAspect: false, page: A4, minPt: 6 });
    expect(b.wPct * A4.width).toBeCloseTo(6);
    expect(b.xPct + b.wPct).toBeCloseTo(0.5);
    expect(b.hPct).toBeCloseTo(0.2);
    expect(b.yPct).toBeCloseTo(0.2);
  });

  it(`never makes a text box narrower than ${MIN_TEXT_WIDTH_PT} pt or wider than the page`, () => {
    const start: VisualBox = { xPct: 0.2, yPct: 0.1, wPct: 0.4, hPct: 0.05 };
    const narrow = resizeTextWidth(start, 'e', -1, A4.width);
    expect(narrow.wPct * A4.width).toBeCloseTo(MIN_TEXT_WIDTH_PT);
    expect(narrow.xPct).toBe(0.2);
    const wide = resizeTextWidth(start, 'e', 5, A4.width);
    expect(wide.xPct + wide.wPct).toBeCloseTo(1);
    const fromStart = resizeTextWidth(start, 'w', -1, A4.width);
    expect(fromStart.xPct).toBe(0);
    expect(fromStart.wPct).toBeCloseTo(0.6);
    const pinched = resizeTextWidth(start, 'w', 1, A4.width);
    expect(pinched.wPct * A4.width).toBeCloseTo(MIN_TEXT_WIDTH_PT);
    expect(pinched.xPct + pinched.wPct).toBeCloseTo(0.6);
  });

  it('scales a freehand stroke into new bounds', () => {
    const ink: InkObject = { id: 'o', pageId: 's0', kind: 'ink', color: '#000000', strokeWidth: 2, points: [0.1, 0.1, 0.3, 0.2] };
    const scaled = withBounds(ink, { xPct: 0.1, yPct: 0.1, wPct: 0.4, hPct: 0.2 });
    near(objectBounds(scaled), { xPct: 0.1, yPct: 0.1, wPct: 0.4, hPct: 0.2 });
  });
});

describe('edit-pdf mini-bar placement', () => {
  const bar = { width: 200, height: 52 };
  const page = { width: 600, height: 800 };

  it('sits centred above the selection when there is room', () => {
    expect(placeMiniBar({ left: 200, top: 300, width: 100, height: 40 }, bar, page)).toEqual({
      left: 150,
      top: 300 - 8 - 52,
      placement: 'above',
    });
  });

  it('goes below when there is no room above', () => {
    expect(placeMiniBar({ left: 200, top: 20, width: 100, height: 40 }, bar, page)).toEqual({
      left: 150,
      top: 20 + 40 + 8,
      placement: 'below',
    });
  });

  it('is clamped inside the page sideways and at the bottom', () => {
    const p = placeMiniBar({ left: -30, top: 10, width: 60, height: 780 }, bar, page);
    expect(p.left).toBe(0);
    expect(p.top).toBe(page.height - bar.height);
    expect(placeMiniBar({ left: 580, top: 300, width: 20, height: 20 }, bar, page).left).toBe(400);
  });
});

// ── Edit text (beta): picking a line, and where the field goes ─────────────

/**
 * A detected line on an A4 page shown at editor turn 0: `top` and `height`
 * as fractions of the page height, ascent:descent 3:1, so its baseline sits
 * three quarters of the way down its box.
 */
const line = (n: number, top: number, extra: Partial<SourceTextLine> = {}): SourceTextLine => ({
  id: `0:${n}`,
  pageIndex: 0,
  text: `line ${n}`,
  textUnsure: false,
  direction: 'ltr',
  color: '#000000',
  box: { xPct: 0.1, yPct: top, wPct: 0.6, hPct: 0.02 },
  turn: 0,
  invisible: false,
  geometry: { rect: { x: 60, y: 0, width: 357, height: 16.84 }, ux: 1, uy: 0, baseline: 0, start: 60, end: 417, size: 12, ascent: 9, descent: 3, neighbours: [] },
  ...extra,
});

describe('edit-pdf Edit text: which line a click lands on', () => {
  it('finds the line whose box holds the point and misses outside every box', () => {
    const lines = [line(0, 0.1), line(1, 0.2)];
    expect(lineAt(lines, { x: 0.3, y: 0.11 }, 0, A4)?.id).toBe('0:0');
    expect(lineAt(lines, { x: 0.3, y: 0.21 }, 0, A4)?.id).toBe('0:1');
    expect(lineAt(lines, { x: 0.3, y: 0.15 }, 0, A4)).toBeNull();
    expect(lineAt(lines, { x: 0.05, y: 0.11 }, 0, A4)).toBeNull();
    expect(lineAt(lines, { x: 0.75, y: 0.11 }, 0, A4)).toBeNull();
    expect(lineAt([], { x: 0.3, y: 0.11 }, 0, A4)).toBeNull();
  });

  it('on exact line spacing, where ink boxes overlap, picks the nearest baseline, not the first box', () => {
    // Box A 0.100..0.120 (baseline 0.115), box B 0.112..0.132 (baseline 0.127): both hold 0.112..0.120.
    const a = line(0, 0.1);
    const b = line(1, 0.112);
    // 0.119 is 0.004 below A's baseline and 0.008 above B's: A, in either order.
    expect(lineAt([a, b], { x: 0.3, y: 0.119 }, 0, A4)?.id).toBe('0:0');
    expect(lineAt([b, a], { x: 0.3, y: 0.119 }, 0, A4)?.id).toBe('0:0');
    // 0.122 is in B's box only; 0.1205 is nearer A's baseline but outside A's box.
    expect(lineAt([a, b], { x: 0.3, y: 0.122 }, 0, A4)?.id).toBe('0:1');
    expect(lineAt([a, b], { x: 0.3, y: 0.1205 }, 0, A4)?.id).toBe('0:1');
  });

  it('a finger beside a line still picks it: the slop widens boxes across the line only, and in a gap the nearest box wins', () => {
    // A4 is 841.89 pt tall: 0.01 of it is about 8.4 pt. Boxes 0.100..0.120 and 0.130..0.150, baselines 0.115 and 0.145.
    const lines = [line(0, 0.1), line(1, 0.13)];
    const slop = 10;
    expect(lineAt(lines, { x: 0.3, y: 0.124 }, 0, A4)).toBeNull();
    expect(lineAt(lines, { x: 0.3, y: 0.124 }, 0, A4, undefined, slop)?.id).toBe('0:0');
    // 0.128 is nearer A's baseline (0.115) than B's (0.145), but 2 thousandths from B's ink and 8 from A's.
    expect(lineAt(lines, { x: 0.3, y: 0.128 }, 0, A4, undefined, slop)?.id).toBe('0:1');
    expect(lineAt(lines, { x: 0.3, y: 0.095 }, 0, A4, undefined, slop)?.id).toBe('0:0');
    expect(lineAt(lines, { x: 0.3, y: 0.085 }, 0, A4, undefined, slop)).toBeNull();
    // Not along the line: a tap past its end is still a miss.
    expect(lineAt(lines, { x: 0.705, y: 0.11 }, 0, A4, undefined, slop)).toBeNull();
    // A line running down the page (asked about with every line accepted) is widened sideways, not lengthwise.
    const vertical = line(2, 0.1, { turn: 90, box: { xPct: 0.1, yPct: 0.1, wPct: 0.02, hPct: 0.6 } });
    const any = () => true;
    expect(lineAt([vertical], { x: 0.13, y: 0.3 }, 0, A4, any, slop)?.id).toBe('0:2');
    expect(lineAt([vertical], { x: 0.11, y: 0.095 }, 0, A4, any, slop)).toBeNull();
  });

  it('lets the later box win inside the overlap when its baseline is the nearer one', () => {
    // B's ink is all below its baseline (ascent 0), so its baseline is the top of its box: 0.112.
    const a = line(0, 0.1);
    const b = line(1, 0.112, { geometry: { ...line(1, 0).geometry, ascent: 0, descent: 12 } });
    // 0.1125 is in both boxes, 0.0025 from A's baseline and 0.0005 from B's: B, though A comes first.
    expect(lineAt([a, b], { x: 0.3, y: 0.1125 }, 0, A4)?.id).toBe('0:1');
    expect(lineAt([b, a], { x: 0.3, y: 0.1125 }, 0, A4)?.id).toBe('0:1');
    // 0.1145 is 0.0005 from A's and 0.0025 from B's: A.
    expect(lineAt([b, a], { x: 0.3, y: 0.1145 }, 0, A4)?.id).toBe('0:0');
  });

  it('never hits a line that cannot get a box now: invisible OCR text, slanted text, a line turned on screen', () => {
    const invisible = line(0, 0.1, { invisible: true });
    const slanted = line(1, 0.2, { turn: null });
    const sideways = line(2, 0.3, { turn: 90 });
    const lines = [invisible, slanted, sideways];
    expect(lineAt(lines, { x: 0.3, y: 0.11 }, 0, A4)).toBeNull();
    expect(lineAt(lines, { x: 0.3, y: 0.21 }, 0, A4)).toBeNull();
    expect(lineAt(lines, { x: 0.3, y: 0.31 }, 0, A4)).toBeNull();
    // ...but the workspace can still ask which blocked line it was, to say why.
    expect(lineAt(lines, { x: 0.3, y: 0.11 }, 0, A4, () => true)?.id).toBe('0:0');
    expect(lineAt(lines, { x: 0.3, y: 0.21 }, 0, A4, () => true)?.id).toBe('0:1');
  });

  it('follows the editor turn: on a page turned 90 degrees the box turns with it and an upright line becomes blocked', () => {
    const upright = line(0, 0.1);
    // Turned 90 clockwise, the box (0.1, 0.1, 0.6 x 0.02) becomes x 0.88..0.90, y 0.1..0.7.
    expect(lineAt([upright], { x: 0.89, y: 0.4 }, 90, { width: 842, height: 595 })).toBeNull();
    expect(lineAt([upright], { x: 0.89, y: 0.4 }, 90, { width: 842, height: 595 }, () => true)?.id).toBe('0:0');
    // A line drawn turned 270 in the file reads normally once the page is turned 90.
    const vertical = line(1, 0.1, { turn: 270, box: { xPct: 0.1, yPct: 0.1, wPct: 0.02, hPct: 0.6 } });
    expect(lineAt([vertical], { x: 0.5, y: 0.11 }, 90, { width: 842, height: 595 })?.id).toBe('0:1');
  });
});

describe('edit-pdf Edit text: changed lines stay put', () => {
  it('a replace box is never moved or resized', () => {
    const l = line(0, 0.1);
    const object: ReplaceObject = { id: 'r', pageId: 's0', kind: 'replace', line: l, box: l.box, text: 'x', size: 12, color: '#000000' };
    expect(translateObject(object, 0.2, 0.2)).toBe(object);
    expect(withBounds(object, { xPct: 0, yPct: 0, wPct: 1, hPct: 1 })).toBe(object);
  });
});

describe('edit-pdf Edit text: where the field goes', () => {
  const page = { width: 600, height: 800 };

  it('docks below 768 px of window width, floats from 768 px', () => {
    expect(replaceFieldDocked(375)).toBe(true);
    expect(replaceFieldDocked(767)).toBe(true);
    expect(replaceFieldDocked(768)).toBe(false);
    expect(replaceFieldDocked(1280)).toBe(false);
  });

  it('floats centred above the line, as wide as the line within 240..480 px', () => {
    const p = placeReplaceField({ left: 100, top: 300, width: 300, height: 20 }, 90, page);
    expect(p).toEqual({ left: 100, top: 300 - 8 - 90, placement: 'above', width: 300 });
    expect(placeReplaceField({ left: 250, top: 300, width: 40, height: 20 }, 90, page).width).toBe(240);
    expect(placeReplaceField({ left: 0, top: 300, width: 590, height: 20 }, 90, page).width).toBe(480);
  });

  it('goes below the line when there is no room above, and is clamped inside the page', () => {
    const below = placeReplaceField({ left: 10, top: 40, width: 100, height: 20 }, 90, page);
    expect(below.placement).toBe('below');
    expect(below.top).toBe(40 + 20 + 8);
    expect(below.left).toBe(0);
    const right = placeReplaceField({ left: 560, top: 400, width: 40, height: 20 }, 90, page);
    expect(right.left).toBe(600 - 240);
    const low = placeReplaceField({ left: 10, top: 30, width: 100, height: 20 }, 790, page);
    expect(low.top).toBe(10);
    // Never wider than a narrow page.
    expect(placeReplaceField({ left: 0, top: 300, width: 100, height: 20 }, 90, { width: 200, height: 800 })).toMatchObject({ left: 0, width: 200 });
  });

  it('docks full width with 16 px gutters on the bottom of the visible viewport (above the keyboard)', () => {
    const viewport = { width: 390, height: 420, offsetLeft: 0, offsetTop: 0 };
    const docked = dockReplaceField({ left: 20, top: 100, right: 300, bottom: 120 }, 100, viewport);
    expect(docked).toEqual({ left: 16, top: 420 - 100 - 8, width: 390 - 32, scrollBy: 0 });
    // The page scrolled under a pinch zoom: the visible viewport's offset moves the field with it.
    const zoomed = dockReplaceField({ left: 20, top: 100, right: 300, bottom: 120 }, 100, { ...viewport, offsetLeft: 30, offsetTop: 200 });
    expect(zoomed).toMatchObject({ left: 46, top: 200 + 312 });
  });

  it('scrolls so the line shows just above the docked field, never past the line\'s own top', () => {
    const viewport = { width: 390, height: 420, offsetLeft: 0, offsetTop: 0 };
    // Field top 312, room up to 304: a line at 350..370 needs 66 px.
    expect(dockReplaceField({ left: 0, top: 350, right: 300, bottom: 370 }, 100, viewport).scrollBy).toBe(66);
    // A line taller than the room left: scroll only until its top reaches the top of the viewport.
    expect(dockReplaceField({ left: 0, top: 40, right: 300, bottom: 400 }, 100, viewport).scrollBy).toBe(40);
    // Already above the field: no scroll.
    expect(dockReplaceField({ left: 0, top: 200, right: 300, bottom: 300 }, 100, viewport).scrollBy).toBe(0);
  });
});
