/**
 * Test oracle for /edit-pdf exports: read a PDF back with pdf.js 3.11 in Node
 * and report what each page paints, in fractions of the page AS DISPLAYED
 * (pdf.js's own viewport: CropBox and /Rotate applied), so placement checks
 * never depend on lib/pdf-geometry. Tests only; app code goes through
 * lib/pdfjs-init.ts.
 */
import { createRequire } from 'node:module';
import { constants as zlibConstants, inflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

export type Pt = [number, number];
type M = [number, number, number, number, number, number];
type RGB = [number, number, number];

export interface PaintedPath {
  /** Every point the path visits (moveTo/lineTo/curve end points, rectangle corners), in display fractions. */
  points: Pt[];
  /** Points per subpath (a moveTo starts a new one). */
  subpaths: Pt[][];
  paint: 'stroke' | 'fill' | 'fillStroke';
  stroke: RGB;
  fill: RGB;
  /** In user-space units (no test content uses cm with a scale). */
  lineWidth: number;
  lineCap: number;
  lineJoin: number;
  /** Blend mode set through an ExtGState, lower-cased as pdf.js reports it, or null. */
  blend: string | null;
}

export interface PaintedImage {
  /** The image's own bottom-left, bottom-right and top-left corners, in display fractions. */
  bl: Pt;
  br: Pt;
  tl: Pt;
}

export interface OracleAnnotation {
  subtype: string;
  rect: number[];
  fieldType?: string;
}

export interface GraphicsPage {
  /** Displayed size in points (viewport at scale 1). */
  width: number;
  height: number;
  /** pdf.js page.rotate and page.view. */
  rotate: number;
  view: number[];
  paths: PaintedPath[];
  images: PaintedImage[];
  /** getTextContent strings joined with spaces. */
  text: string;
  annotations: OracleAnnotation[];
}

export interface GraphicsDoc {
  pages: GraphicsPage[];
  /** Outline titles with the 0-based page index their destination resolves to (null when it does not). */
  outline: Array<{ title: string; pageIndex: number | null }>;
}

const multiply = (m1: M, m2: M): M => [
  m1[0] * m2[0] + m1[2] * m2[1],
  m1[1] * m2[0] + m1[3] * m2[1],
  m1[0] * m2[2] + m1[2] * m2[3],
  m1[1] * m2[2] + m1[3] * m2[3],
  m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
  m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
];
const apply = (m: M, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

export async function readGraphics(bytes: Uint8Array): Promise<GraphicsDoc> {
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;
  try {
    const { OPS } = pdfjs;
    const PAINT: Record<number, PaintedPath['paint']> = {
      [OPS.stroke]: 'stroke',
      [OPS.closeStroke]: 'stroke',
      [OPS.fill]: 'fill',
      [OPS.eoFill]: 'fill',
      [OPS.fillStroke]: 'fillStroke',
      [OPS.eoFillStroke]: 'fillStroke',
      [OPS.closeFillStroke]: 'fillStroke',
      [OPS.closeEOFillStroke]: 'fillStroke',
    };
    const pages: GraphicsPage[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const toFraction = (x: number, y: number): Pt => {
        const [vx, vy] = vp.convertToViewportPoint(x, y) as [number, number];
        return [vx / vp.width, vy / vp.height];
      };
      interface State {
        ctm: M;
        stroke: RGB;
        fill: RGB;
        lineWidth: number;
        lineCap: number;
        lineJoin: number;
        blend: string | null;
      }
      let s: State = { ctm: [1, 0, 0, 1, 0, 0], stroke: [0, 0, 0], fill: [0, 0, 0], lineWidth: 1, lineCap: 0, lineJoin: 0, blend: null };
      const stack: State[] = [];
      const paths: PaintedPath[] = [];
      const images: PaintedImage[] = [];
      let pending: Pt[][] = [];

      const { fnArray, argsArray } = await page.getOperatorList();
      for (let i = 0; i < fnArray.length; i++) {
        const fn = fnArray[i];
        const args = argsArray[i];
        if (fn === OPS.save || fn === OPS.paintFormXObjectBegin) {
          stack.push({ ...s });
          if (fn === OPS.paintFormXObjectBegin && Array.isArray(args[0])) s = { ...s, ctm: multiply(s.ctm, args[0] as M) };
        } else if (fn === OPS.restore || fn === OPS.paintFormXObjectEnd) s = stack.pop() ?? s;
        else if (fn === OPS.transform) s = { ...s, ctm: multiply(s.ctm, args as M) };
        else if (fn === OPS.setStrokeRGBColor) s = { ...s, stroke: [args[0], args[1], args[2]] };
        else if (fn === OPS.setFillRGBColor) s = { ...s, fill: [args[0], args[1], args[2]] };
        else if (fn === OPS.setLineWidth) s = { ...s, lineWidth: args[0] };
        else if (fn === OPS.setLineCap) s = { ...s, lineCap: args[0] };
        else if (fn === OPS.setLineJoin) s = { ...s, lineJoin: args[0] };
        else if (fn === OPS.setGState) {
          for (const [key, value] of args[0] as Array<[string, unknown]>) if (key === 'BM') s = { ...s, blend: String(value).toLowerCase() };
        } else if (fn === OPS.constructPath) {
          const [subOps, coords] = args as [number[], number[]];
          let k = 0;
          const at = (x: number, y: number) => toFraction(...apply(s.ctm, x, y));
          for (const op of subOps) {
            if (op === OPS.moveTo) {
              pending.push([at(coords[k], coords[k + 1])]);
              k += 2;
            } else if (op === OPS.lineTo) {
              pending[pending.length - 1].push(at(coords[k], coords[k + 1]));
              k += 2;
            } else if (op === OPS.curveTo) {
              pending[pending.length - 1].push(at(coords[k + 4], coords[k + 5]));
              k += 6;
            } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
              pending[pending.length - 1].push(at(coords[k + 2], coords[k + 3]));
              k += 4;
            } else if (op === OPS.rectangle) {
              const [x, y, w, h] = coords.slice(k, k + 4);
              pending.push([at(x, y), at(x + w, y), at(x + w, y + h), at(x, y + h)]);
              k += 4;
            }
          }
        } else if (fn in PAINT) {
          paths.push({
            points: pending.flat(),
            subpaths: pending,
            paint: PAINT[fn],
            stroke: s.stroke,
            fill: s.fill,
            lineWidth: s.lineWidth,
            lineCap: s.lineCap,
            lineJoin: s.lineJoin,
            blend: s.blend,
          });
          pending = [];
        } else if (fn === OPS.endPath) {
          pending = [];
        } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
          images.push({
            bl: toFraction(...apply(s.ctm, 0, 0)),
            br: toFraction(...apply(s.ctm, 1, 0)),
            tl: toFraction(...apply(s.ctm, 0, 1)),
          });
        }
      }

      const content = await page.getTextContent();
      const text = (content.items as Array<{ str?: string }>).map((item) => item.str ?? '').join(' ');
      const annotations = ((await page.getAnnotations()) as Array<{ subtype: string; rect: number[]; fieldType?: string }>).map((a) => ({
        subtype: a.subtype,
        rect: a.rect,
        fieldType: a.fieldType,
      }));
      pages.push({ width: vp.width, height: vp.height, rotate: page.rotate, view: page.view, paths, images, text, annotations });
    }

    const outline: GraphicsDoc['outline'] = [];
    for (const item of ((await doc.getOutline()) ?? []) as Array<{ title: string; dest: unknown }>) {
      let pageIndex: number | null = null;
      try {
        const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
        if (Array.isArray(dest) && dest[0] && typeof dest[0] === 'object') pageIndex = await doc.getPageIndex(dest[0]);
      } catch {
        pageIndex = null;
      }
      outline.push({ title: item.title, pageIndex });
    }
    return { pages, outline };
  } finally {
    await task.destroy();
  }
}

/** Axis-aligned bounds of fractions. */
export function boundsOf(points: Pt[]): { xPct: number; yPct: number; wPct: number; hPct: number } {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { xPct: Math.min(...xs), yPct: Math.min(...ys), wPct: Math.max(...xs) - Math.min(...xs), hPct: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Every stream in the raw bytes of a saved PDF, inflated where it is
 * Flate-compressed. Scans the file itself (not a parser's view of it), so
 * object streams count too: an object packed into one is searchable. For
 * "is this content really gone from the file" checks.
 */
export function decodedStreams(bytes: Uint8Array): Buffer[] {
  const file = Buffer.from(bytes);
  const out: Buffer[] = [];
  for (let at = file.indexOf('stream'); at !== -1; at = file.indexOf('stream', at + 6)) {
    if (file.subarray(at - 3, at).toString('latin1') === 'end') continue;
    let start = at + 6;
    if (file[start] === 0x0d) start++;
    if (file[start] === 0x0a) start++;
    const end = file.indexOf('endstream', start);
    if (end === -1) break;
    const data = file.subarray(start, end);
    try {
      out.push(inflateSync(data, { finishFlush: zlibConstants.Z_SYNC_FLUSH }));
    } catch {
      out.push(data);
    }
    at = end + 9 - 6;
  }
  return out;
}

/** The raw file plus every decoded stream, as one searchable buffer. */
export function searchableBytes(bytes: Uint8Array): Buffer {
  return Buffer.concat([Buffer.from(bytes), ...decodedStreams(bytes)]);
}

/**
 * Whether a string is anywhere in the bytes, in any form pdf-lib writes it:
 * ASCII (literal strings), upper-case hex (text shown with a standard font)
 * or UTF-16BE hex (PDFHexString.fromText, e.g. a form field value).
 */
export function containsMarker(haystack: Buffer, marker: string): boolean {
  const utf16 = Buffer.from(marker, 'utf16le').swap16().toString('hex').toUpperCase();
  const forms = [marker, Buffer.from(marker, 'latin1').toString('hex').toUpperCase(), utf16];
  return forms.some((form) => haystack.includes(Buffer.from(form, 'latin1')));
}
