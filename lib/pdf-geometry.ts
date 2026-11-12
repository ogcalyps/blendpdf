/**
 * Page geometry for writing onto existing PDF pages with pdf-lib.
 *
 * Pure math: no pdf.js, no pdf-lib import, no DOM. The same code can run on the
 * main thread, in workers/pdf.worker.ts and on the server. pdf.js 3.11 is the
 * test oracle (tests/pdf-geometry.test.ts), so "where the user sees it" means
 * "where pdf.js renders it".
 *
 * CONVENTIONS
 *
 * User space: PDF points, origin bottom-left, y up. This is what pdf-lib's
 *   drawImage / drawText / drawRectangle take.
 *
 * Visible box: the CropBox intersected with the MediaBox. It falls back to the
 *   MediaBox when there is no CropBox, the CropBox is empty or the two don't
 *   overlap, and an empty MediaBox falls back to US Letter. Corners are
 *   normalised, so [x1 y1 x0 y0] works. pdf.js does exactly this (`page.view`).
 *   A malformed CropBox (not four numbers) is ignored the same way: pdf-lib
 *   throws on it, pdf.js shows the MediaBox.
 *   MediaBox-only math (page.getSize() with origin 0,0) is wrong on every
 *   cropped page, BlendPDF's own crop-pdf output included, and on pages whose
 *   box doesn't start at 0,0.
 *
 * Rotation: the page's /Rotate, which viewers apply clockwise. Normalised the
 *   way pdf.js does it: a value that isn't a multiple of 90 counts as 0, and
 *   the rest wrap into 0/90/180/270 (-90 becomes 270).
 *
 * Visual page: the page as the user sees it rendered, i.e. the visible box
 *   turned by the rotation. Origin top-left, x right, y down. Its size in
 *   points is PageGeometry.width x PageGeometry.height; a 90 or 270 page swaps
 *   the visible box's width and height.
 *
 * Visual box: { xPct, yPct, wPct, hPct } as fractions of the visual page.
 *   (xPct, yPct) is the top-left corner the user sees, wPct/hPct its size.
 *
 * Placement: { x, y, width, height, rotation }, fed straight to pdf-lib:
 *     page.drawImage(img, { x, y, width, height, rotate: degrees(rotation) })
 *   (x, y) is where the box's visual BOTTOM-LEFT corner lands in user space.
 *   pdf-lib turns the drawing counter-clockwise about that point, so rotation
 *   equals the page's /Rotate and cancels it: the result reads upright.
 *   drawRectangle takes the same fields. drawText takes x, y and rotate, with
 *   (x, y) as the baseline origin, so give it a box whose bottom edge is the
 *   baseline.
 */

export type PageRotation = 0 | 90 | 180 | 270;

/** A rectangle the way pdf-lib reports boxes: lower-left corner plus size. */
export interface PdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A box in fractions of the visual page, top-left origin. */
export interface VisualBox {
  xPct: number;
  yPct: number;
  wPct: number;
  hPct: number;
}

export interface PageGeometry {
  /** Visible box in user space, normalised (width and height > 0). */
  box: PdfRect;
  rotation: PageRotation;
  /** Visual page width in points, as the user sees the page. */
  width: number;
  /** Visual page height in points, as the user sees the page. */
  height: number;
}

/** Where to draw a visual box in user space (see the header for the contract). */
export interface PdfPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Degrees counter-clockwise; pass as pdf-lib's `rotate: degrees(rotation)`. */
  rotation: PageRotation;
}

/** What geometryOfPage reads. A pdf-lib PDFPage satisfies it. */
export interface PageBoxSource {
  getMediaBox(): PdfRect;
  getCropBox(): PdfRect;
  getRotation(): { angle: number };
}

const US_LETTER: PdfRect = { x: 0, y: 0, width: 612, height: 792 };

export function normalizeRotation(angle: number): PageRotation {
  if (!Number.isFinite(angle) || angle % 90 !== 0) return 0;
  return (((angle % 360) + 360) % 360) as PageRotation;
}

function normalizeRect(r: PdfRect): PdfRect {
  return {
    x: r.width < 0 ? r.x + r.width : r.x,
    y: r.height < 0 ? r.y + r.height : r.y,
    width: Math.abs(r.width),
    height: Math.abs(r.height),
  };
}

const hasArea = (r: PdfRect) => r.width > 0 && r.height > 0;

/** The area a viewer shows: CropBox intersected with MediaBox (header has the fallbacks). */
export function visibleBox(mediaBox: PdfRect, cropBox?: PdfRect | null): PdfRect {
  const rawMedia = normalizeRect(mediaBox);
  const media = hasArea(rawMedia) ? rawMedia : US_LETTER;
  if (!cropBox) return media;
  const crop = normalizeRect(cropBox);
  if (!hasArea(crop)) return media;
  // pdf-lib's getCropBox() returns the MediaBox when there is no CropBox; skip
  // the intersection then so uncropped pages keep their exact numbers.
  if (crop.x === media.x && crop.y === media.y && crop.width === media.width && crop.height === media.height) {
    return media;
  }
  const x0 = Math.max(crop.x, media.x);
  const y0 = Math.max(crop.y, media.y);
  const x1 = Math.min(crop.x + crop.width, media.x + media.width);
  const y1 = Math.min(crop.y + crop.height, media.y + media.height);
  return x1 - x0 > 0 && y1 - y0 > 0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } : media;
}

export function pageGeometry(input: { mediaBox: PdfRect; cropBox?: PdfRect | null; rotation?: number }): PageGeometry {
  const box = visibleBox(input.mediaBox, input.cropBox);
  const rotation = normalizeRotation(input.rotation ?? 0);
  const sideways = rotation === 90 || rotation === 270;
  return {
    box,
    rotation,
    width: sideways ? box.height : box.width,
    height: sideways ? box.width : box.height,
  };
}

/** Geometry of a pdf-lib page: its boxes and /Rotate, read the way pdf.js reads them. */
export function geometryOfPage(page: PageBoxSource): PageGeometry {
  let cropBox: PdfRect | null = null;
  try {
    cropBox = page.getCropBox();
  } catch {
    // pdf-lib throws on a CropBox that isn't four numbers; pdf.js ignores it
    // and shows the MediaBox, so do the same rather than fail the whole save.
  }
  return pageGeometry({
    mediaBox: page.getMediaBox(),
    cropBox,
    rotation: page.getRotation().angle,
  });
}

/** A visual point (points from the visual top-left) in user space. */
function visualToUser(g: PageGeometry, u: number, v: number): [number, number] {
  const { x, y, width, height } = g.box;
  switch (g.rotation) {
    case 90:
      return [x + v, y + u];
    case 180:
      return [x + width - u, y + v];
    case 270:
      return [x + width - v, y + height - u];
    default:
      return [x + u, y + height - v];
  }
}

/** A user-space point as a visual point (points from the visual top-left). */
function userToVisual(g: PageGeometry, px: number, py: number): [number, number] {
  const { x, y, width, height } = g.box;
  switch (g.rotation) {
    case 90:
      return [py - y, px - x];
    case 180:
      return [x + width - px, py - y];
    case 270:
      return [y + height - py, x + width - px];
    default:
      return [px - x, y + height - py];
  }
}

/**
 * A visual box wPct wide whose height keeps an image's aspect (height / width)
 * on screen. hPct depends on the visual page's shape, so it needs the geometry.
 */
export function visualBoxFromAspect(
  g: PageGeometry,
  b: { xPct: number; yPct: number; wPct: number; aspect: number }
): VisualBox {
  return { xPct: b.xPct, yPct: b.yPct, wPct: b.wPct, hPct: (b.wPct * g.width * b.aspect) / g.height };
}

/** Where to draw a visual box so it shows exactly there, upright. */
export function visualBoxToPdf(g: PageGeometry, b: VisualBox): PdfPlacement {
  const w = b.wPct * g.width;
  const h = b.hPct * g.height;
  const [x, y] = visualToUser(g, b.xPct * g.width, b.yPct * g.height + h);
  return { x, y, width: w, height: h, rotation: g.rotation };
}

/** The axis-aligned user-space rectangle a visual box covers. */
export function visualBoxToPdfRect(g: PageGeometry, b: VisualBox): PdfRect {
  const u0 = b.xPct * g.width;
  const v0 = b.yPct * g.height;
  const [ax, ay] = visualToUser(g, u0, v0);
  const [bx, by] = visualToUser(g, u0 + b.wPct * g.width, v0 + b.hPct * g.height);
  return { x: Math.min(ax, bx), y: Math.min(ay, by), width: Math.abs(bx - ax), height: Math.abs(by - ay) };
}

/**
 * A point of the visual page, in fractions (x right, y down from the visual
 * top-left), in user space. For lines and freehand strokes, and for the
 * top-left corner of a text box (uprightTransform takes it from there).
 */
export function visualPointToPdf(g: PageGeometry, p: { x: number; y: number }): { x: number; y: number } {
  const [x, y] = visualToUser(g, p.x * g.width, p.y * g.height);
  return { x, y };
}

/** Inverse of visualBoxToPdfRect: a user-space rectangle in visual fractions. */
export function pdfRectToVisualBox(g: PageGeometry, rect: PdfRect): VisualBox {
  const r = normalizeRect(rect);
  const [au, av] = userToVisual(g, r.x, r.y);
  const [bu, bv] = userToVisual(g, r.x + r.width, r.y + r.height);
  return {
    xPct: Math.min(au, bu) / g.width,
    yPct: Math.min(av, bv) / g.height,
    wPct: Math.abs(bu - au) / g.width,
    hPct: Math.abs(bv - av) / g.height,
  };
}
