import { describe, it, expect, beforeAll } from 'vitest';
import { join } from 'node:path';
import { PDFDocument, PDFName, PDFNumber, PDFPage, PDFImage, PDFFont, StandardFonts, degrees, lineTo, moveTo, rgb, stroke } from 'pdf-lib';
import {
  geometryOfPage,
  normalizeRotation,
  pageGeometry,
  pdfRectToVisualBox,
  visibleBox,
  visualBoxFromAspect,
  visualBoxToPdf,
  visualBoxToPdfRect,
  visualPointToPdf,
  type PageGeometry,
  type VisualBox,
} from '../lib/pdf-geometry';

/**
 * lib/pdf-geometry.ts is checked against pdf.js 3.11, the renderer behind every
 * BlendPDF preview: draw with pdf-lib, let pdf.js read the page back, map what
 * it drew through page.getViewport({ scale: 1 }) and compare with where the box
 * was dropped. Expected positions come from pdf.js's viewport, never from the
 * module under test.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjs: any;
const STANDARD_FONTS = join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts') + '/';

beforeAll(async () => {
  // Node has no Web Worker: hand pdf.js its worker module to run in-process.
  // @ts-expect-error pdfjs-dist ships no types for the worker bundle
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.js');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = (worker as { default?: unknown }).default ?? worker;
  const lib = await import('pdfjs-dist/legacy/build/pdf.js');
  pdfjs = (lib as { default?: unknown }).default ?? lib;
});

// 2x1 opaque PNG.
const PNG_2X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAABmJLR0QA/wD/AP+gvaeTAAAAEUlEQVQImWNkYGD4z8DAwAAABQ0BAfVEv0AAAAAASUVORK5CYII=';

type Pt = [number, number];
type Box4 = [number, number, number, number];

interface PageCase {
  name: string;
  rotate: number;
  /** pdf-lib setMediaBox(x, y, width, height). */
  media: Box4;
  /** pdf-lib setCropBox(x, y, width, height). */
  crop?: Box4;
}

const VARIANTS: { label: string; media: Box4; crop?: Box4 }[] = [
  { label: 'plain', media: [0, 0, 612, 792] },
  // The shape BlendPDF's crop-pdf writes: a CropBox inside an untouched MediaBox.
  { label: 'cropped', media: [0, 0, 612, 792], crop: [100, 150, 300, 350] },
  { label: 'offset MediaBox', media: [-100, -100, 612, 792] },
];

const CASES: PageCase[] = [0, 90, 180, 270].flatMap((rotate) =>
  VARIANTS.map(({ label, media, crop }) => ({ name: `${label}, /Rotate ${rotate}`, rotate, media, crop }))
);
const PLAIN = (c: PageCase) => c.name.startsWith('plain,');

// Off-centre on both axes, so a mirrored or swapped axis can't pass by symmetry.
const SIGNATURE = { xPct: 0.1, yPct: 0.2, wPct: 0.5, aspect: 0.4 };
const RECT: VisualBox = { xPct: 0.55, yPct: 0.6, wPct: 0.3, hPct: 0.1 };
const TEXT_AT = { xPct: 0.15, yPct: 0.85 };

const TOLERANCE = 1e-6;

interface Seen {
  visualWidth: number;
  visualHeight: number;
  /** Visual fractions of the drawn object's own bottom-left, bottom-right and top-left corners. */
  image?: { bl: Pt; br: Pt; tl: Pt };
  rect?: { bl: Pt; br: Pt; tl: Pt };
  /** Text baseline origin (fractions) and unit directions in viewport points (y down). */
  text?: { origin: Pt; advance: Pt; up: Pt };
}

const mul = (m: number[], n: number[]) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: number[], x: number, y: number): Pt => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const unit = ([x, y]: Pt): Pt => [x / Math.hypot(x, y), y / Math.hypot(x, y)];

/** What pdf.js renders: every drawn object mapped into the visual page. */
async function seenByPdfJs(bytes: Uint8Array): Promise<Seen> {
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, standardFontDataUrl: STANDARD_FONTS, verbosity: 0 }).promise;
  try {
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const toViewport = (x: number, y: number): Pt => vp.convertToViewportPoint(x, y) as Pt;
    const toFraction = ([x, y]: Pt): Pt => {
      const [vx, vy] = toViewport(x, y);
      return [vx / vp.width, vy / vp.height];
    };
    const seen: Seen = { visualWidth: vp.width, visualHeight: vp.height };

    const { fnArray, argsArray } = await page.getOperatorList();
    const { OPS } = pdfjs;
    let ctm = [1, 0, 0, 1, 0, 0];
    const stack: number[][] = [];
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const args = argsArray[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
      else if (fn === OPS.transform) ctm = mul(ctm, args);
      else if (fn === OPS.paintImageXObject) {
        // Images fill the unit square; (0,0) is the image's bottom-left.
        seen.image = { bl: toFraction(apply(ctm, 0, 0)), br: toFraction(apply(ctm, 1, 0)), tl: toFraction(apply(ctm, 0, 1)) };
      } else if (fn === OPS.constructPath) {
        // pdf-lib's rectangle: moveTo(0,0) lineTo(0,h) lineTo(w,h) lineTo(w,0).
        const [subOps, coords] = args as [number[], number[]];
        const points: Pt[] = [];
        let k = 0;
        for (const op of subOps) {
          if (op === OPS.moveTo || op === OPS.lineTo) {
            points.push(apply(ctm, coords[k], coords[k + 1]));
            k += 2;
          }
        }
        seen.rect = { bl: toFraction(points[0]), tl: toFraction(points[1]), br: toFraction(points[3]) };
      }
    }

    const item = (await page.getTextContent()).items.find((it: { str?: string }) => it.str?.trim());
    if (item) {
      const [a, b, c, d, e, f] = item.transform as number[];
      const o = toViewport(e, f);
      const along = toViewport(e + a, f + b);
      const above = toViewport(e + c, f + d);
      seen.text = {
        origin: toFraction([e, f]),
        advance: unit([along[0] - o[0], along[1] - o[1]]),
        up: unit([above[0] - o[0], above[1] - o[1]]),
      };
    }
    return seen;
  } finally {
    await doc.destroy();
  }
}

type Drawer = (page: PDFPage, image: PDFImage, font: PDFFont) => void;

async function buildPage(c: PageCase) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.setMediaBox(...c.media);
  if (c.crop) page.setCropBox(...c.crop);
  page.setRotation(degrees(c.rotate));
  return { doc, page };
}

async function render(c: PageCase, draw: Drawer, tweak?: (doc: PDFDocument, page: PDFPage) => void): Promise<Seen> {
  const { doc, page } = await buildPage(c);
  tweak?.(doc, page);
  const image = await doc.embedPng(PNG_2X1);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  draw(page, image, font);
  return seenByPdfJs(await doc.save());
}

/** Everything an editor writes, placed through lib/pdf-geometry. */
const drawWithGeometry: Drawer = (page, image, font) => {
  const g = geometryOfPage(page);
  const sig = visualBoxToPdf(g, visualBoxFromAspect(g, SIGNATURE));
  page.drawImage(image, { x: sig.x, y: sig.y, width: sig.width, height: sig.height, rotate: degrees(sig.rotation) });
  const rect = visualBoxToPdf(g, RECT);
  page.drawRectangle({ x: rect.x, y: rect.y, width: rect.width, height: rect.height, rotate: degrees(rect.rotation), color: rgb(1, 1, 0) });
  const text = visualBoxToPdf(g, { ...TEXT_AT, wPct: 0, hPct: 0 });
  page.drawText('Ab', { x: text.x, y: text.y, size: 12, font, rotate: degrees(text.rotation) });
};

/** The pre-fix sign-pdf math (sign-pdf/page.tsx before this change), verbatim. */
const drawWithPreFixSignPdf: Drawer = (page, image) => {
  const p = { xPct: SIGNATURE.xPct, yPct: SIGNATURE.yPct, widthPct: SIGNATURE.wPct, aspect: SIGNATURE.aspect };
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const { width: W, height: H } = page.getSize();
  const sideways = rot === 90 || rot === 270;
  const visW = sideways ? H : W;
  const visH = sideways ? W : H;
  const w = p.widthPct * visW;
  const h = w * p.aspect;
  const vx = p.xPct * visW;
  const vy = p.yPct * visH;
  if (rot === 90) {
    page.drawImage(image, { x: vy + h, y: vx, width: w, height: h, rotate: degrees(90) });
  } else if (rot === 180) {
    page.drawImage(image, { x: W - vx, y: vy + h, width: w, height: h, rotate: degrees(180) });
  } else if (rot === 270) {
    page.drawImage(image, { x: W - vy - h, y: H - vx, width: w, height: h, rotate: degrees(270) });
  } else {
    page.drawImage(image, { x: vx, y: H - vy - h, width: w, height: h });
  }
};

/** Where the signature should appear, from pdf.js's own visual page size. */
function expectedSignature(seen: Seen) {
  const hPct = (SIGNATURE.wPct * seen.visualWidth * SIGNATURE.aspect) / seen.visualHeight;
  const { xPct: x, yPct: y, wPct: w } = SIGNATURE;
  return { bl: [x, y + hPct] as Pt, br: [x + w, y + hPct] as Pt, tl: [x, y] as Pt };
}

function boxCorners(b: VisualBox) {
  return { bl: [b.xPct, b.yPct + b.hPct] as Pt, br: [b.xPct + b.wPct, b.yPct + b.hPct] as Pt, tl: [b.xPct, b.yPct] as Pt };
}

function worstError(got: { bl: Pt; br: Pt; tl: Pt } | undefined, want: { bl: Pt; br: Pt; tl: Pt }): number {
  if (!got) return Infinity;
  return Math.max(
    ...(['bl', 'br', 'tl'] as const).flatMap((k) => [Math.abs(got[k][0] - want[k][0]), Math.abs(got[k][1] - want[k][1])])
  );
}

function expectNear(got: Pt | undefined, want: Pt, what: string) {
  expect(got, what).toBeDefined();
  expect(Math.abs(got![0] - want[0]), `${what} x`).toBeLessThan(TOLERANCE);
  expect(Math.abs(got![1] - want[1]), `${what} y`).toBeLessThan(TOLERANCE);
}

function expectPlacedUpright(seen: Seen) {
  // Corner by corner, so position, size and orientation (no mirror, no quarter turn) all count.
  expect(worstError(seen.image, expectedSignature(seen)), 'signature image corners').toBeLessThan(TOLERANCE);
  expect(worstError(seen.rect, boxCorners(RECT)), 'rectangle corners').toBeLessThan(TOLERANCE);
  expectNear(seen.text?.origin, [TEXT_AT.xPct, TEXT_AT.yPct], 'text baseline origin');
  expectNear(seen.text?.advance, [1, 0], 'text runs left to right');
  expectNear(seen.text?.up, [0, -1], 'text stands upright');
}

describe('pdf-geometry against pdf.js 3.11', () => {
  it.each(CASES)('places image, rectangle and text where they were dropped, upright: $name', async (c) => {
    expectPlacedUpright(await render(c, drawWithGeometry));
  });

  it.each<[string, PageCase, ((doc: PDFDocument, page: PDFPage) => void)?]>([
    ['CropBox hanging off the MediaBox', { name: '', rotate: 90, media: [0, 0, 612, 792], crop: [400, -50, 400, 300] }],
    ['CropBox written with its corners swapped', { name: '', rotate: 270, media: [0, 0, 612, 792], crop: [400, 500, -300, -350] }],
    ['CropBox that misses the MediaBox (pdf.js falls back to the MediaBox)', { name: '', rotate: 0, media: [0, 0, 612, 792], crop: [700, 900, 50, 50] }],
    ['/Rotate -90', { name: '', rotate: -90, media: [0, 0, 612, 792], crop: [100, 150, 300, 350] }],
    ['/Rotate 450', { name: '', rotate: 450, media: [-100, -100, 612, 792] }],
    [
      '/Rotate 45 (not a multiple of 90, shown unrotated)',
      { name: '', rotate: 0, media: [0, 0, 612, 792], crop: [100, 150, 300, 350] },
      (_doc, page) => page.node.set(PDFName.of('Rotate'), PDFNumber.of(45)),
    ],
    // pdf-lib's getCropBox() throws on these; pdf.js ignores them and shows the MediaBox.
    [
      'CropBox with five numbers',
      { name: '', rotate: 90, media: [-100, -100, 612, 792] },
      (doc, page) => page.node.set(PDFName.of('CropBox'), doc.context.obj([0, 0, 612, 792, 0])),
    ],
    [
      'CropBox with a null corner',
      { name: '', rotate: 180, media: [0, 0, 612, 792] },
      (doc, page) => page.node.set(PDFName.of('CropBox'), doc.context.obj([0, 0, 612, null])),
    ],
    [
      'CropBox that is a single number',
      { name: '', rotate: 270, media: [-100, -100, 612, 792] },
      (_doc, page) => page.node.set(PDFName.of('CropBox'), PDFNumber.of(5)),
    ],
  ])('agrees with pdf.js on an awkward page: %s', async (_label, c, tweak) => {
    expectPlacedUpright(await render(c, drawWithGeometry, tweak));
  });

  it.each(CASES)('maps a PDF rectangle back to the visual box pdf.js shows: $name', async (c) => {
    const { doc, page } = await buildPage(c);
    const pdfDoc = await pdfjs.getDocument({ data: await doc.save(), isEvalSupported: false, verbosity: 0 }).promise;
    try {
      const vp = (await pdfDoc.getPage(1)).getViewport({ scale: 1 });
      const rect = { x: 160, y: 210, width: 90, height: 40 };
      const corners = [
        vp.convertToViewportPoint(rect.x, rect.y),
        vp.convertToViewportPoint(rect.x + rect.width, rect.y + rect.height),
      ] as Pt[];
      const xs = corners.map(([x]) => x / vp.width);
      const ys = corners.map(([, y]) => y / vp.height);
      const want: VisualBox = {
        xPct: Math.min(...xs),
        yPct: Math.min(...ys),
        wPct: Math.max(...xs) - Math.min(...xs),
        hPct: Math.max(...ys) - Math.min(...ys),
      };
      const got = pdfRectToVisualBox(geometryOfPage(page), rect);
      for (const k of ['xPct', 'yPct', 'wPct', 'hPct'] as const) {
        expect(Math.abs(got[k] - want[k]), k).toBeLessThan(TOLERANCE);
      }
    } finally {
      await pdfDoc.destroy();
    }
  });

  it.each(CASES)('maps visual points (lines, drawing, text corners) to where pdf.js shows them: $name', async (c) => {
    const points = [{ x: 0.1, y: 0.2 }, { x: 0.7, y: 0.35 }, { x: 0.4, y: 0.9 }];
    const { doc, page } = await buildPage(c);
    const g = geometryOfPage(page);
    const mapped = points.map((p) => visualPointToPdf(g, p));
    page.pushOperators(moveTo(mapped[0].x, mapped[0].y), lineTo(mapped[1].x, mapped[1].y), lineTo(mapped[2].x, mapped[2].y), stroke());
    const pdfDoc = await pdfjs.getDocument({ data: await doc.save(), isEvalSupported: false, verbosity: 0 }).promise;
    try {
      const shown = await pdfDoc.getPage(1);
      const vp = shown.getViewport({ scale: 1 });
      const { fnArray, argsArray } = await shown.getOperatorList();
      const [, coords] = argsArray[fnArray.indexOf(pdfjs.OPS.constructPath)] as [number[], number[]];
      points.forEach((p, k) => {
        const [vx, vy] = vp.convertToViewportPoint(coords[2 * k], coords[2 * k + 1]) as Pt;
        expectNear([vx / vp.width, vy / vp.height], [p.x, p.y], `point ${k}`);
      });
    } finally {
      await pdfDoc.destroy();
    }
  });

  it('can tell the pre-fix getSize() math is wrong (the oracle is not vacuous)', async () => {
    const wrong: string[] = [];
    for (const c of CASES) {
      const seen = await render(c, drawWithPreFixSignPdf);
      if (worstError(seen.image, expectedSignature(seen)) > TOLERANCE) wrong.push(c.name);
    }
    expect(wrong).toEqual(CASES.filter((c) => !PLAIN(c)).map((c) => c.name));
  });
});

describe('pdf-geometry, pure math', () => {
  it('normalises /Rotate the way pdf.js does', () => {
    const cases: [number, number][] = [[0, 0], [90, 90], [180, 180], [270, 270], [360, 0], [450, 90], [-90, 270], [-180, 180], [-360, 0], [45, 0], [91, 0], [NaN, 0]];
    for (const [input, want] of cases) expect(normalizeRotation(input), String(input)).toBe(want);
  });

  it('takes the CropBox, clipped to the MediaBox, as the visible box', () => {
    const media = { x: 0, y: 0, width: 612, height: 792 };
    expect(visibleBox(media)).toEqual(media);
    expect(visibleBox(media, media)).toEqual(media);
    expect(visibleBox(media, { x: 100, y: 150, width: 300, height: 350 })).toEqual({ x: 100, y: 150, width: 300, height: 350 });
    expect(visibleBox(media, { x: 400, y: -50, width: 400, height: 300 })).toEqual({ x: 400, y: 0, width: 212, height: 250 });
    expect(visibleBox(media, { x: 400, y: 500, width: -300, height: -350 })).toEqual({ x: 100, y: 150, width: 300, height: 350 });
    expect(visibleBox(media, { x: 700, y: 900, width: 50, height: 50 })).toEqual(media);
    expect(visibleBox(media, { x: 10, y: 10, width: 0, height: 50 })).toEqual(media);
    expect(visibleBox({ x: 0, y: 0, width: 0, height: 0 })).toEqual({ x: 0, y: 0, width: 612, height: 792 });
  });

  it('swaps the visual width and height on sideways pages', () => {
    const g = pageGeometry({ mediaBox: { x: 0, y: 0, width: 612, height: 792 }, cropBox: { x: 100, y: 150, width: 300, height: 350 }, rotation: 90 });
    expect([g.width, g.height]).toEqual([350, 300]);
  });

  it('matches the previous sign-pdf math exactly on plain pages', () => {
    // Plain pages were right before the fix; they must not move by a point.
    const boxes = [SIGNATURE, { xPct: 0, yPct: 0, wPct: 1, aspect: 1.2941 }, { xPct: 0.73, yPct: 0.05, wPct: 0.18, aspect: 0.31 }];
    for (const rotate of [0, 90, 180, 270]) {
      for (const [W, H] of [[612, 792], [842, 595]]) {
        for (const s of boxes) {
          const g = pageGeometry({ mediaBox: { x: 0, y: 0, width: W, height: H }, rotation: rotate });
          const got = visualBoxToPdf(g, visualBoxFromAspect(g, s));
          const visW = rotate % 180 ? H : W;
          const visH = rotate % 180 ? W : H;
          const w = s.wPct * visW;
          const h = w * s.aspect;
          const vx = s.xPct * visW;
          const vy = s.yPct * visH;
          const want = [
            { x: vx, y: H - vy - h },
            { x: vy + h, y: vx },
            { x: W - vx, y: vy + h },
            { x: W - vy - h, y: H - vx },
          ][rotate / 90];
          const label = `${W}x${H} /Rotate ${rotate} ${JSON.stringify(s)}`;
          expect(got.rotation, label).toBe(rotate);
          for (const [k, v] of [['x', want.x], ['y', want.y], ['width', w], ['height', h]] as const) {
            expect(Math.abs(got[k] - v), `${label} ${k}`).toBeLessThan(1e-9);
          }
        }
      }
    }
  });

  it('maps a box\'s corners with visualPointToPdf exactly as visualBoxToPdfRect does', () => {
    for (const c of CASES) {
      const g = pageGeometry({
        mediaBox: { x: c.media[0], y: c.media[1], width: c.media[2], height: c.media[3] },
        cropBox: c.crop && { x: c.crop[0], y: c.crop[1], width: c.crop[2], height: c.crop[3] },
        rotation: c.rotate,
      });
      const a = visualPointToPdf(g, { x: RECT.xPct, y: RECT.yPct });
      const b = visualPointToPdf(g, { x: RECT.xPct + RECT.wPct, y: RECT.yPct + RECT.hPct });
      const rect = visualBoxToPdfRect(g, RECT);
      const got = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) };
      for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(got[k] - rect[k]), `${c.name} ${k}`).toBeLessThan(1e-9);
    }
  });

  it('round-trips a visual box through PDF space', () => {
    const geometries: PageGeometry[] = CASES.map((c) =>
      pageGeometry({
        mediaBox: { x: c.media[0], y: c.media[1], width: c.media[2], height: c.media[3] },
        cropBox: c.crop && { x: c.crop[0], y: c.crop[1], width: c.crop[2], height: c.crop[3] },
        rotation: c.rotate,
      })
    );
    for (const g of geometries) {
      const back = pdfRectToVisualBox(g, visualBoxToPdfRect(g, RECT));
      for (const k of ['xPct', 'yPct', 'wPct', 'hPct'] as const) {
        expect(Math.abs(back[k] - RECT[k]), `${k} at /Rotate ${g.rotation}`).toBeLessThan(1e-12);
      }
    }
  });
});
