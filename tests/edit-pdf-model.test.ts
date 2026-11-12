/**
 * lib/edit-pdf/model.ts: the pure helpers the reducer and the export share.
 * Rotation is checked in PDF user space through lib/pdf-geometry (itself
 * checked against pdf.js in tests/pdf-geometry.test.ts): after the editor's
 * Rotate button, a cover must hide exactly the same rectangle of the page.
 */
import { describe, expect, it } from 'vitest';
import { pageGeometry, pdfRectToVisualBox, visualBoxToPdfRect, visualPointToPdf } from '../lib/pdf-geometry';
import type { PageGeometry, PdfRect } from '../lib/pdf-geometry';
import {
  REPLACE_MAX_SIZE,
  REPLACE_MIN_SIZE,
  STAMP_MARGIN_PT,
  WATERMARK_ANGLE,
  WATERMARK_IMAGE_TILE_GAP_PT,
  WATERMARK_TILE_GAP_PT,
  arrowHeadArms,
  defaultReplaceSize,
  isUprightObject,
  lineBlock,
  lineBoxAt,
  objectBounds,
  pageNumberOrigin,
  pageNumberText,
  pageVisualSize,
  replaceAnchor,
  rotateCropClockwise,
  rotateObjectClockwise,
  stepReplaceSize,
  visibleSize,
  watermarkImageSize,
  watermarkPlacements,
} from '../lib/edit-pdf';
import type { EditorObject, EditorPage, QuarterTurn, ReplaceObject, SourcePageInfo, SourceTextLine } from '../lib/edit-pdf';

const SOURCES: SourcePageInfo[] = [
  { width: 612, height: 792, rotate: 0 },
  { width: 300, height: 350, rotate: 90 },
  { width: 842, height: 595, rotate: 270 },
];
const page = (index: number, rotation: EditorPage['rotation'] = 0): EditorPage => ({ id: `s${index}`, source: { kind: 'source', index }, rotation });

describe('pageVisualSize', () => {
  it('turns the visible box by /Rotate plus the turns added in the editor', () => {
    expect(pageVisualSize(page(0), SOURCES)).toEqual({ width: 612, height: 792 });
    expect(pageVisualSize(page(0, 90), SOURCES)).toEqual({ width: 792, height: 612 });
    expect(pageVisualSize(page(0, 180), SOURCES)).toEqual({ width: 612, height: 792 });
    expect(pageVisualSize(page(0, 270), SOURCES)).toEqual({ width: 792, height: 612 });
    expect(pageVisualSize(page(1), SOURCES)).toEqual({ width: 350, height: 300 });
    expect(pageVisualSize(page(1, 90), SOURCES)).toEqual({ width: 300, height: 350 });
    expect(pageVisualSize(page(2, 270), SOURCES)).toEqual({ width: 842, height: 595 });
  });

  it('uses a blank page\'s own size, turned by its added rotation', () => {
    const blank = (rotation: EditorPage['rotation']): EditorPage => ({ id: 'b1', source: { kind: 'blank', width: 400, height: 600 }, rotation });
    expect(pageVisualSize(blank(0), SOURCES)).toEqual({ width: 400, height: 600 });
    expect(pageVisualSize(blank(90), SOURCES)).toEqual({ width: 600, height: 400 });
    expect(pageVisualSize(blank(180), SOURCES)).toEqual({ width: 400, height: 600 });
  });

  it('throws on a source page the file does not have', () => {
    expect(() => pageVisualSize(page(7), SOURCES)).toThrow(RangeError);
  });
});

describe('objectBounds and isUprightObject', () => {
  const base = { id: 'o1', pageId: 's0' };
  const box = { xPct: 0.1, yPct: 0.2, wPct: 0.3, hPct: 0.4 };

  it('gives the box of boxed kinds, and the extent of lines and strokes in either direction', () => {
    for (const object of [
      { ...base, kind: 'cover', box },
      { ...base, kind: 'highlight', box },
      { ...base, kind: 'image', box, assetId: 'a1' },
      { ...base, kind: 'text', box, text: 'x', size: 12, color: '#000000' },
      { ...base, kind: 'shape', shape: 'ellipse', box, color: '#000000', strokeWidth: 2 },
    ] as EditorObject[]) {
      expect(objectBounds(object), object.kind).toEqual(box);
    }
    const line: EditorObject = { ...base, kind: 'line', from: { x: 0.8, y: 0.9 }, to: { x: 0.2, y: 0.5 }, arrow: true, color: '#000000', strokeWidth: 2 };
    expectBox(objectBounds(line), { xPct: 0.2, yPct: 0.5, wPct: 0.6, hPct: 0.4 });
    const ink: EditorObject = { ...base, kind: 'ink', points: [0.5, 0.5, 0.1, 0.7, 0.3, 0.2, 0.9], color: '#000000', strokeWidth: 2 };
    expectBox(objectBounds(ink), { xPct: 0.1, yPct: 0.2, wPct: 0.4, hPct: 0.5 }); // a trailing odd number is ignored
    expect(objectBounds({ ...base, kind: 'ink', points: [], color: '#000000', strokeWidth: 2 })).toEqual({ xPct: 0, yPct: 0, wPct: 0, hPct: 0 });
  });

  it('keeps text and images upright, nothing else', () => {
    const kinds = ['text', 'image', 'shape', 'line', 'ink', 'highlight', 'cover'] as const;
    expect(kinds.filter((kind) => isUprightObject({ kind } as EditorObject))).toEqual(['text', 'image']);
  });
});

function expectBox(got: { xPct: number; yPct: number; wPct: number; hPct: number }, want: typeof got, what = '') {
  for (const k of ['xPct', 'yPct', 'wPct', 'hPct'] as const) expect(got[k], `${what} ${k}`).toBeCloseTo(want[k], 12);
}

function expectRect(got: PdfRect, want: PdfRect, what: string) {
  for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(got[k] - want[k]), `${what} ${k}`).toBeLessThan(1e-9);
}

describe('rotateObjectClockwise', () => {
  // The same page before and after the editor turns it: visible box fixed, rotation + 90.
  const PAGES = [0, 90, 180, 270].flatMap((rotate) =>
    [
      { label: 'plain', mediaBox: { x: 0, y: 0, width: 612, height: 792 } },
      { label: 'cropped', mediaBox: { x: 0, y: 0, width: 612, height: 792 }, cropBox: { x: 100, y: 150, width: 300, height: 350 } },
    ].map((p) => ({ name: `${p.label}, shown at ${rotate}`, mediaBox: p.mediaBox, cropBox: p.cropBox, rotate })),
  );
  const geometry = (p: (typeof PAGES)[number], turn: number): PageGeometry => pageGeometry({ mediaBox: p.mediaBox, cropBox: p.cropBox, rotation: p.rotate + turn });
  const base = { id: 'o1', pageId: 's0' };
  const box = { xPct: 0.12, yPct: 0.21, wPct: 0.3, hPct: 0.15 };
  const GEOMETRIC: EditorObject[] = [
    { ...base, kind: 'cover', box },
    { ...base, kind: 'highlight', box },
    { ...base, kind: 'shape', shape: 'rectangle', box, color: '#000000', strokeWidth: 2 },
    { ...base, kind: 'line', from: { x: 0.1, y: 0.7 }, to: { x: 0.65, y: 0.25 }, arrow: true, color: '#000000', strokeWidth: 2 },
    { ...base, kind: 'ink', points: [0.2, 0.3, 0.35, 0.32, 0.5, 0.6, 0.55, 0.9], color: '#000000', strokeWidth: 2 },
  ];
  const pointsOf = (o: EditorObject) =>
    o.kind === 'line' ? [o.from, o.to] : o.kind === 'ink' ? Array.from({ length: o.points.length / 2 }, (_, i) => ({ x: o.points[2 * i], y: o.points[2 * i + 1] })) : [];

  it.each(PAGES)('cover, highlight, shapes, lines and drawing stay over the same part of the page: $name', (p) => {
    const before = geometry(p, 0);
    const after = geometry(p, 90);
    for (const object of GEOMETRIC) {
      const turned = rotateObjectClockwise(object, { width: before.width, height: before.height });
      expectRect(visualBoxToPdfRect(after, objectBounds(turned)), visualBoxToPdfRect(before, objectBounds(object)), object.kind);
      pointsOf(object).forEach((point, i) => {
        const was = visualPointToPdf(before, point);
        const now = visualPointToPdf(after, pointsOf(turned)[i]);
        expect(Math.hypot(now.x - was.x, now.y - was.y), `${object.kind} point ${i}`).toBeLessThan(1e-9);
      });
    }
  });

  it.each(PAGES)('text and images keep their size in points and their centre on the same spot: $name', (p) => {
    const before = geometry(p, 0);
    const after = geometry(p, 90);
    const small = { xPct: 0.3, yPct: 0.35, wPct: 0.2, hPct: 0.1 };
    for (const object of [
      { ...base, kind: 'text', box: small, text: 'Hello', size: 12, color: '#000000' },
      { ...base, kind: 'image', box: small, assetId: 'a1' },
    ] as EditorObject[]) {
      const turned = rotateObjectClockwise(object, { width: before.width, height: before.height });
      const was = objectBounds(object);
      const now = objectBounds(turned);
      expect(now.wPct * after.width).toBeCloseTo(was.wPct * before.width, 9);
      expect(now.hPct * after.height).toBeCloseTo(was.hPct * before.height, 9);
      const centre = (g: PageGeometry, b: typeof was) => visualPointToPdf(g, { x: b.xPct + b.wPct / 2, y: b.yPct + b.hPct / 2 });
      const c0 = centre(before, was);
      const c1 = centre(after, now);
      expect(Math.hypot(c1.x - c0.x, c1.y - c0.y), object.kind).toBeLessThan(1e-9);
    }
  });

  it('four turns give back the same object', () => {
    const size = { width: 612, height: 792 };
    const upright: EditorObject = { ...base, kind: 'image', box: { xPct: 0.3, yPct: 0.35, wPct: 0.2, hPct: 0.1 }, assetId: 'a1' };
    for (const object of [...GEOMETRIC, upright]) {
      let turned = object;
      let current = size;
      for (let i = 0; i < 4; i++) {
        turned = rotateObjectClockwise(turned, current);
        current = { width: current.height, height: current.width };
      }
      if ('box' in object && 'box' in turned) expectBox(turned.box, object.box, object.kind);
      pointsOf(object).forEach((point, i) => {
        expect(pointsOf(turned)[i].x).toBeCloseTo(point.x, 12);
        expect(pointsOf(turned)[i].y).toBeCloseTo(point.y, 12);
      });
    }
  });

  it('moves an upright object back inside when the new page shape would push it out', () => {
    // A wide text box near the bottom of a portrait page: after the turn the page is landscape and less tall.
    const text: EditorObject = { ...base, kind: 'text', box: { xPct: 0.05, yPct: 0.02, wPct: 0.9, hPct: 0.05 }, text: 'Wide', size: 12, color: '#000000' };
    const turned = rotateObjectClockwise(text, { width: 612, height: 792 });
    const b = objectBounds(turned);
    expect(b.xPct).toBeGreaterThanOrEqual(0);
    expect(b.yPct).toBeGreaterThanOrEqual(0);
    expect(b.xPct + b.wPct).toBeLessThanOrEqual(1 + 1e-12);
    expect(b.yPct + b.hPct).toBeLessThanOrEqual(1 + 1e-12);
    expect(b.wPct * 792).toBeCloseTo(0.9 * 612, 9); // still the same width in points
  });
});

describe('arrowHeadArms', () => {
  const length = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

  it('gives two arms of equal length, mirrored about the shaft', () => {
    const from = { x: 100, y: 300 };
    const to = { x: 260, y: 180 };
    const [a, b] = arrowHeadArms(from, to, 4);
    expect(length(a, to)).toBeCloseTo(length(b, to), 9);
    // Same angle to the shaft (pointing back from the tip), on opposite sides.
    const back = Math.atan2(from.y - to.y, from.x - to.x);
    const angle = (p: { x: number; y: number }) => Math.atan2(p.y - to.y, p.x - to.x) - back;
    const wrap = (r: number) => Math.atan2(Math.sin(r), Math.cos(r));
    expect(wrap(angle(a))).toBeCloseTo(-wrap(angle(b)), 9);
    expect(Math.abs(wrap(angle(a)))).toBeCloseTo((25 * Math.PI) / 180, 9);
  });

  it('grows with the stroke width, never shorter than 8 points', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    expect(length(arrowHeadArms(from, to, 1)[0], to)).toBeCloseTo(8, 9);
    expect(length(arrowHeadArms(from, to, 2)[0], to)).toBeCloseTo(8, 9);
    expect(length(arrowHeadArms(from, to, 4)[0], to)).toBeCloseTo(16, 9);
    expect(length(arrowHeadArms(from, to, 12)[0], to)).toBeCloseTo(48, 9);
    // Pointing right in a y-down space: the arms sit behind the tip, one above and one below.
    const [a, b] = arrowHeadArms(from, to, 4);
    expect(a.x).toBeLessThan(100);
    expect(b.x).toBeLessThan(100);
    expect(Math.sign(a.y)).toBe(-Math.sign(b.y));
  });
});

// ── Replace text (Phase C) ─────────────────────────────────────────────────

/**
 * A line that reads normally on a page with /Rotate `rotate`: its glyph
 * advance in user space is the page's own turn undone (text drawn turned so
 * that the viewer's rotation sets it upright). s along the advance, p across.
 */
function uprightLine(rotate: QuarterTurn, direction: 'ltr' | 'rtl', overrides: Partial<SourceTextLine> = {}): { line: SourceTextLine; g: PageGeometry } {
  const r = (rotate * Math.PI) / 180;
  const ux = Math.round(Math.cos(r));
  const uy = Math.round(Math.sin(r));
  const g = pageGeometry({ mediaBox: { x: -20, y: 30, width: 600, height: 800 }, rotation: rotate });
  // Pick s and p so the line lands inside the box whatever the turn.
  const centre = { x: -20 + 300, y: 30 + 400 };
  const sMid = centre.x * ux + centre.y * uy;
  const pMid = -centre.x * uy + centre.y * ux;
  const geometry = { ux, uy, baseline: pMid - 50, start: sMid - 120, end: sMid + 80, size: 12, ascent: 10, descent: 3, neighbours: [] as number[] };
  const corners = [
    [geometry.start, geometry.baseline - geometry.descent],
    [geometry.end, geometry.baseline + geometry.ascent],
  ].map(([sv, pv]) => [sv * ux - pv * uy, sv * uy + pv * ux]);
  const rect = {
    x: Math.min(corners[0][0], corners[1][0]),
    y: Math.min(corners[0][1], corners[1][1]),
    width: Math.abs(corners[1][0] - corners[0][0]),
    height: Math.abs(corners[1][1] - corners[0][1]),
  };
  const line: SourceTextLine = {
    id: '0:0',
    pageIndex: 0,
    text: 'line',
    textUnsure: false,
    direction,
    color: '#000000',
    box: pdfRectToVisualBox(g, rect),
    turn: 0,
    invisible: false,
    geometry: { ...geometry, rect },
    ...overrides,
  };
  return { line, g };
}

const replaceObject = (line: SourceTextLine, rotation: QuarterTurn = 0): ReplaceObject => ({
  id: 'r1',
  pageId: 's0',
  kind: 'replace',
  line,
  box: lineBoxAt(line, rotation),
  text: 'new',
  size: 12,
  color: '#000000',
});

describe('lineBoxAt and lineBlock', () => {
  const { line } = uprightLine(0, 'ltr');

  it('turns the line box with the page: four turns give it back, and it turns exactly like a cover', () => {
    expectBox(lineBoxAt(line, 0), line.box);
    let cover: EditorObject = { id: 'c', pageId: 's0', kind: 'cover', box: line.box };
    for (const turn of [90, 180, 270] as QuarterTurn[]) {
      cover = rotateObjectClockwise(cover, { width: 1, height: 1 });
      expectBox(lineBoxAt(line, turn), (cover as { box: typeof line.box }).box);
    }
    cover = rotateObjectClockwise(cover, { width: 1, height: 1 });
    expectBox((cover as { box: typeof line.box }).box, line.box);
  });

  it('blocks invisible text, slanted text, and a line that does not read normally at this rotation', () => {
    expect(lineBlock(line, 0)).toBeNull();
    expect(lineBlock({ ...line, invisible: true }, 0)).toBe('invisible');
    expect(lineBlock({ ...line, turn: null }, 0)).toBe('slanted');
    expect(lineBlock({ ...line, turn: 270 }, 90)).toBeNull();
    expect(lineBlock({ ...line, turn: 0 }, 90)).toBe('turned');
    expect(lineBlock({ ...line, turn: 90 }, 0)).toBe('turned');
  });
});

describe('defaultReplaceSize and stepReplaceSize', () => {
  const { line } = uprightLine(0, 'ltr'); // 12 pt, 200 pt wide

  it("matches the old line's width in Cairo, within 0.6x..1.15x of its size", () => {
    expect(defaultReplaceSize(line, 200)).toBe(12);
    expect(defaultReplaceSize(line, 250)).toBe(9.6);
    expect(defaultReplaceSize(line, 2000)).toBe(7.2); // 0.6x
    expect(defaultReplaceSize(line, 20)).toBe(13.8); // 1.15x
  });

  it('starts at 0.85x when the prefill is unsure or has no width; stays within 4..72', () => {
    expect(defaultReplaceSize({ ...line, textUnsure: true }, 200)).toBe(10.2);
    expect(defaultReplaceSize(line, 0)).toBe(10.2);
    const big = { ...line, geometry: { ...line.geometry, size: 100 } };
    expect(defaultReplaceSize(big, 200)).toBe(REPLACE_MAX_SIZE);
    const tiny = { ...line, geometry: { ...line.geometry, size: 3 } };
    expect(defaultReplaceSize(tiny, 200)).toBe(REPLACE_MIN_SIZE);
  });

  it('steps by half a point and returns the same size at either end', () => {
    expect(stepReplaceSize(12, 1)).toBe(12.5);
    expect(stepReplaceSize(12.3, -1)).toBe(11.8);
    expect(stepReplaceSize(71.8, 1)).toBe(72);
    expect(stepReplaceSize(72, 1)).toBe(72);
    expect(stepReplaceSize(4, -1)).toBe(4);
  });
});

describe('replaceAnchor', () => {
  it.each([0, 90, 180, 270] as QuarterTurn[])('is the old start edge on the old baseline in user space (/Rotate %i)', (rotate) => {
    for (const direction of ['ltr', 'rtl'] as const) {
      const { line, g } = uprightLine(rotate, direction);
      const anchor = replaceAnchor(replaceObject(line));
      expect(anchor.edge).toBe(direction === 'rtl' ? 'right' : 'left');
      const user = visualPointToPdf(g, { x: anchor.x, y: anchor.baseline });
      const { ux, uy, start, end, baseline } = line.geometry;
      const s = direction === 'rtl' ? end : start;
      expect(user.x, `${direction} x`).toBeCloseTo(s * ux - baseline * uy, 6);
      expect(user.y, `${direction} y`).toBeCloseTo(s * uy + baseline * ux, 6);
    }
  });
});

// ── Workspace: crop and document stamps (workspace-spec.md 3.1) ────────────

describe('rotateCropClockwise and visibleSize', () => {
  const PAGES = [0, 90, 180, 270].flatMap((rotate) =>
    [
      { label: 'plain', mediaBox: { x: 0, y: 0, width: 612, height: 792 } },
      { label: 'cropped', mediaBox: { x: 0, y: 0, width: 612, height: 792 }, cropBox: { x: 100, y: 150, width: 300, height: 350 } },
    ].map((p) => ({ name: `${p.label}, shown at ${rotate}`, mediaBox: p.mediaBox, cropBox: p.cropBox, rotate })),
  );
  const crop = { xPct: 0.12, yPct: 0.21, wPct: 0.5, hPct: 0.4 };

  it.each(PAGES)('a turned crop keeps the same part of the page visible: $name', (p) => {
    const before = pageGeometry({ mediaBox: p.mediaBox, cropBox: p.cropBox, rotation: p.rotate });
    const after = pageGeometry({ mediaBox: p.mediaBox, cropBox: p.cropBox, rotation: p.rotate + 90 });
    expectRect(visualBoxToPdfRect(after, rotateCropClockwise(crop)), visualBoxToPdfRect(before, crop), 'crop');
  });

  it('four turns give the crop back', () => {
    let turned = crop;
    for (let i = 0; i < 4; i++) turned = rotateCropClockwise(turned);
    for (const k of ['xPct', 'yPct', 'wPct', 'hPct'] as const) expect(turned[k]).toBeCloseTo(crop[k], 12);
  });

  it('is the visual size cut down by the crop, turns included', () => {
    expect(visibleSize(page(0), SOURCES)).toEqual({ width: 612, height: 792 });
    expect(visibleSize({ ...page(0), crop: { xPct: 0.1, yPct: 0.2, wPct: 0.5, hPct: 0.25 } }, SOURCES)).toEqual({ width: 306, height: 198 });
    expect(visibleSize({ ...page(1, 90), crop: { xPct: 0, yPct: 0, wPct: 0.5, hPct: 0.5 } }, SOURCES)).toEqual({ width: 150, height: 175 });
  });
});

describe('page numbers', () => {
  const stamp = { template: 'Page {n} of {total}', startFrom: 1 };

  it('numbers the saved pages from startFrom; the total counts as if numbering started at 1', () => {
    expect(pageNumberText(stamp, 0, 4)).toBe('Page 1 of 4');
    expect(pageNumberText({ ...stamp, startFrom: 3 }, 0, 4)).toBe('Page 3 of 6');
    expect(pageNumberText({ ...stamp, startFrom: 3 }, 3, 4)).toBe('Page 6 of 6');
    expect(pageNumberText({ template: '{n}', startFrom: 10 }, 2, 5)).toBe('12');
    expect(pageNumberText({ template: '{n} / {total} ({n})', startFrom: 1 }, 1, 2)).toBe('2 / 2 (2)');
    expect(pageNumberText({ template: 'صفحة {n} من {total}', startFrom: 1 }, 0, 2)).toBe('صفحة 1 من 2');
  });

  it('sits STAMP_MARGIN_PT inside the edges it is against, centred across for *-center', () => {
    const visible = { width: 400, height: 600 };
    const [w, h] = [50, 19.2];
    expect(pageNumberOrigin('top-left', visible, w, h)).toEqual({ x: STAMP_MARGIN_PT, y: STAMP_MARGIN_PT });
    expect(pageNumberOrigin('top-center', visible, w, h)).toEqual({ x: 175, y: STAMP_MARGIN_PT });
    expect(pageNumberOrigin('top-right', visible, w, h)).toEqual({ x: 400 - STAMP_MARGIN_PT - w, y: STAMP_MARGIN_PT });
    expect(pageNumberOrigin('bottom-left', visible, w, h)).toEqual({ x: STAMP_MARGIN_PT, y: 600 - STAMP_MARGIN_PT - h });
    expect(pageNumberOrigin('bottom-center', visible, w, h)).toEqual({ x: 175, y: 600 - STAMP_MARGIN_PT - h });
    expect(pageNumberOrigin('bottom-right', visible, w, h)).toEqual({ x: 400 - STAMP_MARGIN_PT - w, y: 600 - STAMP_MARGIN_PT - h });
  });
});

describe('watermark placement', () => {
  const visible = { width: 600, height: 800 };

  it('center and diagonal are one copy in the middle; only text turns', () => {
    expect(watermarkPlacements({ type: 'text', position: 'center' }, visible, 200, 50)).toEqual([{ cx: 300, cy: 400, angle: 0 }]);
    expect(watermarkPlacements({ type: 'text', position: 'diagonal' }, visible, 200, 50)).toEqual([{ cx: 300, cy: 400, angle: WATERMARK_ANGLE }]);
    expect(watermarkPlacements({ type: 'image', position: 'diagonal' }, visible, 200, 50)).toEqual([{ cx: 300, cy: 400, angle: 0 }]);
  });

  it('tiled is a grid stepping (w + gap, h + gap) from half a step, covering the box', () => {
    const text = watermarkPlacements({ type: 'text', position: 'tiled' }, visible, 200, 50);
    const [stepX, stepY] = [200 + WATERMARK_TILE_GAP_PT, 50 + WATERMARK_TILE_GAP_PT];
    expect(text).toHaveLength(Math.ceil(600 / stepX) * Math.ceil(800 / stepY));
    expect(text[0]).toEqual({ cx: stepX / 2, cy: stepY / 2, angle: WATERMARK_ANGLE });
    expect(text[1]).toEqual({ cx: stepX * 1.5, cy: stepY / 2, angle: WATERMARK_ANGLE });
    expect(Math.max(...text.map((p) => p.cx)) + stepX / 2).toBeGreaterThanOrEqual(600);
    expect(Math.max(...text.map((p) => p.cy)) + stepY / 2).toBeGreaterThanOrEqual(800);

    const images = watermarkPlacements({ type: 'image', position: 'tiled' }, visible, 100, 100);
    expect(images[0]).toEqual({ cx: (100 + WATERMARK_IMAGE_TILE_GAP_PT) / 2, cy: (100 + WATERMARK_IMAGE_TILE_GAP_PT) / 2, angle: 0 });
    expect(images.every((p) => p.angle === 0)).toBe(true);
  });

  it('an image is half a point per pixel, scaled down to 80% of the visible box at most', () => {
    expect(watermarkImageSize({ width: 400, height: 200 }, visible)).toEqual({ width: 200, height: 100 });
    const wide = watermarkImageSize({ width: 2400, height: 600 }, visible);
    expect(wide.width).toBeCloseTo(480, 9);
    expect(wide.height).toBeCloseTo(120, 9);
    const tall = watermarkImageSize({ width: 800, height: 2400 }, visible);
    expect(tall.height).toBeCloseTo(640, 9);
    expect(tall.width).toBeCloseTo(640 / 3, 9);
  });
});
