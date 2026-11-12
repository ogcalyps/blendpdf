/**
 * "Edit text (beta)": taking a line of existing text OUT of the file with
 * PDFium (./pdfium.ts), checked twice before anything is saved. Reached only
 * through import() (from ./index and ./export).
 *
 * Removal works on whole TEXT OBJECTS chosen by baseline, never on a
 * rectangle: a text object belongs to the line when its origin sits within
 * half an em of the line's baseline, nearer it than any neighbouring line's,
 * and its extent lies within the line's. Rectangle redaction is only the
 * fallback for an object that runs from this line into the next cell, and
 * then only on a thin band above the baseline.
 *
 * The contract (phase-c-spec.md section 4):
 *   - Safety: each rewritten page is rendered by PDFium before (every one
 *     before any is touched) and after; any 10 px tile outside the removed
 *     objects' boxes and the lines' own boxes whose mean colour moved by more
 *     than 8 refuses the page (REPLACE_REFUSED). PDFium 2.15.1 drops soft
 *     masks when it rewrites a page; this is what catches it. A line removed
 *     from a form XObject must leave every other page that is kept the same
 *     text, or it is refused too (the form is drawn there as well).
 *   - Verification: the saved file is opened again and must show no glyph
 *     left on any replaced line (REPLACE_FAILED otherwise).
 * Every PDFium call runs synchronously once the module is ready (no await
 * between opening a document and closing it), so a click-time probe and an
 * export never interleave, and every allocation is freed in a finally.
 */
import { forgetPdfium, loadPdfium } from './pdfium';
import type { Pdfium } from './pdfium';
import { EditPdfError } from './types';
import type { LineGeometry, LineRefusal, LineRemovalCheck, ObjectId, SourceTextLine } from './types';

/** FPDFPageObj_GetType values. */
const OBJECT_TEXT = 1;
const OBJECT_PATH = 2;
const OBJECT_IMAGE = 3;
const OBJECT_SHADING = 4;
const OBJECT_FORM = 5;

/** A text object's origin must be this close to the baseline (em) to belong to the line. */
const ORIGIN_BAND_EM = 0.5;
/** Its extent may pass the line's start and end by this much (em) and still count as the line's own. */
const EXTENT_EM = 0.6;
/** Further than this (em) outside the line's extent, an object is in another column. */
const OTHER_COLUMN_EM = 0.2;
/** The fallback band for an object that straddles two cells: this far above the baseline (em). */
const BAND_FROM_EM = 0.05;
const BAND_TO_EM = 0.45;
/** Verification: a glyph left this close to the baseline (em), inside the line's extent widened by this (em), fails it. */
const VERIFY_BAND_EM = 0.5;
const VERIFY_EXTENT_EM = 0.1;
/**
 * A glyph whose origin is off the baseline (a dot or mark some producers
 * draw as its own glyph, lowered by mark positioning) still belongs to the
 * line when all its ink lies inside the line's ascent..descent band (with
 * this slack, em), its centre is nearer this baseline than a neighbour's,
 * and its origin is within INK_ORIGIN_EM.
 */
const INK_SLACK_EM = 0.05;
const INK_ORIGIN_EM = 1;

/** Safety check: 72 dpi (1 px = 1 pt), 10 px tiles, mean colour difference limit, padding around removed boxes. */
const SAFETY_TILE = 10;
const SAFETY_LIMIT = 8;
const SAFETY_PAD = 2;
/** A page rendered for the check is scaled down past this many pixels (a poster-sized page). */
const SAFETY_MAX_PIXELS = 4_000_000;
/** FPDF_REVERSE_BYTE_ORDER: RGBA. Annotations are not drawn (the rewrite never touches them). */
const RENDER_FLAGS = 0x10;

type Matrix = [number, number, number, number, number, number];

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One line to take out: what the export knows about it. */
export interface RemovalTarget {
  objectId: ObjectId;
  /** 0-based page of the source file (the bytes removeLines receives). */
  pageIndex: number;
  /** 1-based page of the OUTPUT, for the refusal message. */
  pageNumber: number;
  geometry: LineGeometry;
}

export interface RemovalOptions {
  pdfiumWasm?: Uint8Array;
  /** Pages pdf-lib counts in the source. PDFium must count the same, or page indexes would not mean the same pages. */
  sourcePageCount: number;
  /**
   * 0-based source pages the output keeps (default: all). A page the export
   * deletes is not checked for losing a line from a form it shares.
   */
  keptPages?: ReadonlySet<number>;
}

export interface RemovalResult {
  bytes: Uint8Array;
  /** Lines removed and verified gone: always targets.length (anything else rejects). */
  removedLines: number;
}

const multiply = (m: readonly number[], n: readonly number[]): Matrix => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const apply = (m: readonly number[], x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** The line's own frame: s along the baseline, p across it. */
const alongOf = (g: LineGeometry, x: number, y: number) => x * g.ux + y * g.uy;
const acrossOf = (g: LineGeometry, x: number, y: number) => -x * g.uy + y * g.ux;

/** A rectangle given in (s, p) of the line, as an axis-aligned user-space rect. */
function frameRect(g: LineGeometry, s0: number, s1: number, p0: number, p1: number): Rect {
  const corners = [
    [s0, p0],
    [s1, p0],
    [s0, p1],
    [s1, p1],
  ].map(([s, p]) => [s * g.ux - p * g.uy, s * g.uy + p * g.ux]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

const intersects = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Does a glyph or text object sit on this line? `p` is its origin across the
 * baseline, `p0..p1` its ink across it. By origin: within `band` em of the
 * baseline and nearer it than any neighbour's. By ink: see INK_SLACK_EM.
 */
function onLine(g: LineGeometry, p: number, p0: number, p1: number, band: number): boolean {
  const distance = Math.abs(p - g.baseline);
  if (distance <= band * g.size && !g.neighbours.some((other) => Math.abs(p - other) < distance)) return true;
  if (distance > INK_ORIGIN_EM * g.size) return false;
  const slack = INK_SLACK_EM * g.size;
  if (p0 < g.baseline - g.descent - slack || p1 > g.baseline + g.ascent + slack) return false;
  const centre = (p0 + p1) / 2;
  const own = Math.abs(centre - g.baseline);
  return !g.neighbours.some((other) => Math.abs(centre - other) < own);
}

/** Whitespace PDFium reports as characters (generated ones are skipped separately). */
const isBlankCode = (code: number) => code === 0x20 || code === 0xa0 || code === 0x09 || code === 0x0a || code === 0x0d || code === 0x3000 || (code >= 0x2000 && code <= 0x200b);

/** One PDFium session: allocations and handles that are always released. */
class Session {
  private readonly blocks: number[] = [];

  constructor(readonly pd: Pdfium) {}

  get api() {
    return this.pd.api;
  }

  alloc(size: number): number {
    const ptr = this.pd.runtime.wasmExports.malloc(size);
    if (!ptr) throw new EditPdfError('REPLACE_UNAVAILABLE', 'PDFium ran out of memory');
    this.blocks.push(ptr);
    return ptr;
  }

  free(ptr: number): void {
    const at = this.blocks.indexOf(ptr);
    if (at !== -1) this.blocks.splice(at, 1);
    this.pd.runtime.wasmExports.free(ptr);
  }

  release(): void {
    for (const ptr of this.blocks.splice(0)) this.pd.runtime.wasmExports.free(ptr);
  }

  floats(ptr: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => this.pd.runtime.getValue(ptr + i * 4, 'float'));
  }

  doubles(ptr: number, count: number): number[] {
    return Array.from({ length: count }, (_, i) => this.pd.runtime.getValue(ptr + i * 8, 'double'));
  }

  setFloats(ptr: number, values: readonly number[]): void {
    values.forEach((value, i) => this.pd.runtime.setValue(ptr + i * 4, value, 'float'));
  }

  /** Copy bytes into the heap. The caller frees the pointer (or release() does). */
  copyIn(bytes: Uint8Array): number {
    const ptr = this.alloc(Math.max(1, bytes.length));
    this.pd.runtime.HEAPU8.set(bytes, ptr);
    return ptr;
  }

  /** Open a document from heap memory; 0 when PDFium can't read it. */
  open(ptr: number, size: number): number {
    return this.api.FPDF_LoadMemDocument(ptr, size, '');
  }

  save(doc: number): Uint8Array {
    const api = this.api;
    const writer = api.PDFiumExt_OpenFileWriter();
    try {
      if (!api.PDFiumExt_SaveAsCopy(doc, writer)) throw new EditPdfError('REPLACE_FAILED', 'PDFium could not save the file');
      const size = api.PDFiumExt_GetFileWriterSize(writer);
      const out = this.alloc(Math.max(1, size));
      try {
        api.PDFiumExt_GetFileWriterData(writer, out, size);
        return this.pd.runtime.HEAPU8.slice(out, out + size);
      } finally {
        this.free(out);
      }
    } finally {
      api.PDFiumExt_CloseFileWriter(writer);
    }
  }
}

interface PageRemoval {
  /** User-space boxes of the removed objects (and of a fallback band): the safety check skips these. */
  boxes: Rect[];
  /** An object inside a Form XObject was removed (the form may be drawn on other pages too). */
  inForm: boolean;
  refused: LineRefusal | null;
}

/** Glyphs PDFium still sees on the line (verification). */
function leftoverGlyphs(session: Session, page: number, g: LineGeometry): number {
  const { api } = session;
  const text = api.FPDFText_LoadPage(page);
  if (!text) throw new EditPdfError('REPLACE_FAILED', 'PDFium could not read the page text');
  const point = session.alloc(32);
  const matrix = session.alloc(24);
  let left = 0;
  try {
    const count = api.FPDFText_CountChars(text);
    for (let i = 0; i < count; i++) {
      if (api.FPDFText_IsGenerated(text, i)) continue;
      if (isBlankCode(api.FPDFText_GetUnicode(text, i))) continue;
      if (!api.FPDFText_GetCharOrigin(text, i, point, point + 8)) continue;
      const [x, y] = session.doubles(point, 2);
      // Text on another axis (a stamp across the line) is not this line's.
      if (api.FPDFText_GetMatrix(text, i, matrix)) {
        const [a, b] = session.floats(matrix, 2);
        const length = Math.hypot(a, b);
        if (length > 0 && (a * g.ux + b * g.uy) / length < Math.cos((5 * Math.PI) / 180)) continue;
      }
      const s = alongOf(g, x, y);
      if (s < g.start - VERIFY_EXTENT_EM * g.size || s > g.end + VERIFY_EXTENT_EM * g.size) continue;
      const p = acrossOf(g, x, y);
      let p0 = p;
      let p1 = p;
      if (api.FPDFText_GetCharBox(text, i, point, point + 8, point + 16, point + 24)) {
        const [l, r, b, t] = session.doubles(point, 4);
        const across = [acrossOf(g, l, b), acrossOf(g, r, b), acrossOf(g, l, t), acrossOf(g, r, t)];
        p0 = Math.min(...across);
        p1 = Math.max(...across);
      }
      if (onLine(g, p, p0, p1, VERIFY_BAND_EM)) left++;
    }
  } finally {
    session.free(point);
    session.free(matrix);
    api.FPDFText_ClosePage(text);
  }
  return left;
}

/**
 * Take the line's text objects off a loaded page (not yet regenerated).
 * Objects are walked from the top of the z-order down, into forms with the
 * composed matrix.
 */
function removeLineObjects(session: Session, page: number, g: LineGeometry): PageRemoval {
  const { api } = session;
  const matrixPtr = session.alloc(24);
  const boundsPtr = session.alloc(16);
  const boxes: Rect[] = [];
  let inForm = false;
  let straddling = false;
  try {
    const visit = (holder: number, isForm: boolean, toPage: Matrix): void => {
      const count = isForm ? api.FPDFFormObj_CountObjects(holder) : api.FPDFPage_CountObjects(holder);
      for (let i = count - 1; i >= 0; i--) {
        const object = isForm ? api.FPDFFormObj_GetObject(holder, i) : api.FPDFPage_GetObject(holder, i);
        if (!object) continue;
        const type = api.FPDFPageObj_GetType(object);
        if (type !== OBJECT_TEXT && type !== OBJECT_FORM) continue;
        if (!api.FPDFPageObj_GetMatrix(object, matrixPtr)) continue;
        const own = session.floats(matrixPtr, 6) as Matrix;
        if (type === OBJECT_FORM) {
          visit(object, true, multiply(own, toPage));
          continue;
        }
        const [ox, oy] = apply(toPage, own[4], own[5]);
        const p = acrossOf(g, ox, oy);
        if (Math.abs(p - g.baseline) > Math.max(ORIGIN_BAND_EM, INK_ORIGIN_EM) * g.size) continue;
        if (!api.FPDFPageObj_GetBounds(object, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12)) continue;
        const [l, b, r, t] = session.floats(boundsPtr, 4);
        const corners = [apply(toPage, l, b), apply(toPage, r, b), apply(toPage, l, t), apply(toPage, r, t)];
        const across = corners.map(([x, y]) => acrossOf(g, x, y));
        if (!onLine(g, p, Math.min(...across), Math.max(...across), ORIGIN_BAND_EM)) continue; // a neighbour line's, or not text of this line
        const along = corners.map(([x, y]) => alongOf(g, x, y));
        const s0 = Math.min(...along);
        const s1 = Math.max(...along);
        if (s1 < g.start - OTHER_COLUMN_EM * g.size || s0 > g.end + OTHER_COLUMN_EM * g.size) continue; // another column
        if (s0 < g.start - EXTENT_EM * g.size || s1 > g.end + EXTENT_EM * g.size) {
          straddling = true; // runs into the next cell: only its part on this line goes, below
          continue;
        }
        const removed = isForm ? api.FPDFFormObj_RemoveObject(holder, object) : api.FPDFPage_RemoveObject(holder, object);
        if (!removed) continue;
        api.FPDFPageObj_Destroy(object);
        if (isForm) inForm = true;
        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => c[1]);
        boxes.push({ x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
      }
    };
    visit(page, false, IDENTITY);
  } finally {
    session.free(matrixPtr);
    session.free(boundsPtr);
  }
  if (!straddling) return { boxes, inForm, refused: null };

  // Fallback for an object that straddles: redact a thin band of this line only, lifting any
  // picture, path or shading under it out of the way first (rectangle redaction punches them).
  const band = frameRect(g, g.start, g.end, g.baseline + BAND_FROM_EM * g.size, g.baseline + BAND_TO_EM * g.size);
  const lifted: Array<{ object: number; index: number }> = [];
  const rectPtr = session.alloc(16);
  const boundsPtr2 = session.alloc(16);
  try {
    for (let i = api.FPDFPage_CountObjects(page) - 1; i >= 0; i--) {
      const object = api.FPDFPage_GetObject(page, i);
      const type = api.FPDFPageObj_GetType(object);
      if (type !== OBJECT_IMAGE && type !== OBJECT_PATH && type !== OBJECT_SHADING) continue;
      if (!api.FPDFPageObj_GetBounds(object, boundsPtr2, boundsPtr2 + 4, boundsPtr2 + 8, boundsPtr2 + 12)) continue;
      const [l, b, r, t] = session.floats(boundsPtr2, 4);
      if (intersects(band, { x0: l, y0: b, x1: r, y1: t }) && api.FPDFPage_RemoveObject(page, object)) lifted.push({ object, index: i });
    }
    session.setFloats(rectPtr, [band.x0, band.y1, band.x1, band.y0]); // FS_RECTF: left, top, right, bottom
    api.EPDFText_RedactInRect(page, rectPtr, true, false);
  } finally {
    for (const { object, index } of lifted.reverse()) api.FPDFPage_InsertObjectAtIndex(page, object, index);
    session.free(rectPtr);
    session.free(boundsPtr2);
  }
  boxes.push(frameRect(g, g.start, g.end, g.baseline - g.descent, g.baseline + g.ascent));
  // Whatever the band missed is still in memory: the line can't be taken out on its own.
  const refused = leftoverGlyphs(session, page, g) > 0 ? 'CANT_ISOLATE' : null;
  return { boxes, inForm, refused };
}

interface Rendered {
  width: number;
  height: number;
  stride: number;
  pixels: Uint8Array;
}

/** The page drawn on white at 72 dpi (or smaller for a huge page), plus a mapper from user space to its pixels. */
function renderPage(session: Session, page: number): Rendered & { toDevice: (x: number, y: number) => [number, number] } {
  const { api, pd } = session;
  const pointsWide = api.FPDF_GetPageWidthF(page);
  const pointsHigh = api.FPDF_GetPageHeightF(page);
  const scale = Math.min(1, Math.sqrt(SAFETY_MAX_PIXELS / Math.max(1, pointsWide * pointsHigh)));
  const width = Math.max(1, Math.round(pointsWide * scale));
  const height = Math.max(1, Math.round(pointsHigh * scale));
  const bitmap = api.FPDFBitmap_Create(width, height, 0);
  if (!bitmap) throw new EditPdfError('REPLACE_UNAVAILABLE', 'PDFium ran out of memory');
  let rendered: Rendered;
  try {
    api.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xffffffff);
    api.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, RENDER_FLAGS);
    const stride = api.FPDFBitmap_GetStride(bitmap);
    const buffer = api.FPDFBitmap_GetBuffer(bitmap);
    rendered = { width, height, stride, pixels: pd.runtime.HEAPU8.slice(buffer, buffer + stride * height) };
  } finally {
    api.FPDFBitmap_Destroy(bitmap);
  }
  // Valid while the page is open; the two ints are freed with the session.
  const device = session.alloc(8);
  const toDevice = (x: number, y: number): [number, number] => {
    api.FPDF_PageToDevice(page, 0, 0, width, height, 0, x, y, device, device + 4);
    return [pd.runtime.getValue(device, 'i32'), pd.runtime.getValue(device + 4, 'i32')];
  };
  return { ...rendered, toDevice };
}

/** User-space boxes as padded pixel boxes of a rendered page. */
function deviceBoxes(boxes: readonly Rect[], toDevice: (x: number, y: number) => [number, number]): Rect[] {
  return boxes.map((box) => {
    const points = [toDevice(box.x0, box.y0), toDevice(box.x1, box.y0), toDevice(box.x0, box.y1), toDevice(box.x1, box.y1)];
    const xs = points.map((pt) => pt[0]);
    const ys = points.map((pt) => pt[1]);
    return { x0: Math.min(...xs) - SAFETY_PAD, y0: Math.min(...ys) - SAFETY_PAD, x1: Math.max(...xs) + SAFETY_PAD, y1: Math.max(...ys) + SAFETY_PAD };
  });
}

/** True when no 10 px tile outside `masked` changed by more than the limit. */
function sameOutside(before: Rendered, after: Rendered, masked: readonly Rect[]): boolean {
  if (before.width !== after.width || before.height !== after.height) return false;
  for (let ty = 0; ty < before.height; ty += SAFETY_TILE) {
    for (let tx = 0; tx < before.width; tx += SAFETY_TILE) {
      const tile = { x0: tx, y0: ty, x1: tx + SAFETY_TILE, y1: ty + SAFETY_TILE };
      if (masked.some((box) => intersects(tile, box))) continue;
      let sum = 0;
      let n = 0;
      for (let y = ty; y < Math.min(before.height, ty + SAFETY_TILE); y++) {
        for (let x = tx; x < Math.min(before.width, tx + SAFETY_TILE); x++) {
          const a = y * before.stride + x * 4;
          const b = y * after.stride + x * 4;
          sum += Math.abs(before.pixels[a] - after.pixels[b]) + Math.abs(before.pixels[a + 1] - after.pixels[b + 1]) + Math.abs(before.pixels[a + 2] - after.pixels[b + 2]);
          n += 3;
        }
      }
      if (sum / n > SAFETY_LIMIT) return false;
    }
  }
  return true;
}

/** Characters PDFium finds on a page (the shared-form check). */
function charCount(session: Session, doc: number, pageIndex: number): number {
  const { api } = session;
  const page = api.FPDF_LoadPage(doc, pageIndex);
  if (!page) return -1;
  try {
    const text = api.FPDFText_LoadPage(page);
    if (!text) return -1;
    try {
      return api.FPDFText_CountChars(text);
    } finally {
      api.FPDFText_ClosePage(text);
    }
  } finally {
    api.FPDF_ClosePage(page);
  }
}

/**
 * Remove each target line from the source bytes, then prove it: the safety
 * check on every rewritten page and the verification on the saved file.
 * Rejects with EditPdfError: REPLACE_UNAVAILABLE (PDFium did not load, out of
 * memory), REPLACE_REFUSED (objectIds + pageNumbers of the refused lines),
 * REPLACE_FAILED (PDFium could not open or save the file, page counts
 * disagree, a glyph is still on a line after removal, or PDFium itself
 * stopped: then the module is dropped and the next call loads a fresh one).
 */
export async function removeLines(source: Uint8Array, targets: readonly RemovalTarget[], options: RemovalOptions): Promise<RemovalResult> {
  const pd = await loadPdfium(options.pdfiumWasm);
  try {
    return removeLinesNow(pd, source, targets, options);
  } catch (error) {
    return stopped(error, 'REPLACE_FAILED');
  }
}

/**
 * Anything but our own EditPdfError means PDFium trapped or aborted (a
 * WebAssembly RuntimeError) or the code around it broke: its heap can't be
 * trusted, so the module and the file held in it are dropped (never freed:
 * freeing on a dead module throws too) and the next call starts over.
 */
function stopped(error: unknown, code: 'REPLACE_FAILED' | 'UNREADABLE'): never {
  if (error instanceof EditPdfError) throw error;
  held = null;
  reading = null;
  forgetPdfium();
  throw new EditPdfError(code, `PDFium stopped: ${error instanceof Error ? error.message : String(error)}`);
}

function removeLinesNow(pd: Pdfium, source: Uint8Array, targets: readonly RemovalTarget[], options: RemovalOptions): RemovalResult {
  const session = new Session(pd);
  const { api } = session;
  const byPage = new Map<number, RemovalTarget[]>();
  for (const target of targets) {
    const list = byPage.get(target.pageIndex) ?? [];
    list.push(target);
    byPage.set(target.pageIndex, list);
  }
  const refused = new Set<RemovalTarget>();
  const failed = new Set<RemovalTarget>();
  const inForm = new Set<RemovalTarget>();
  const boxesByPage = new Map<number, Rect[]>();
  const before = new Map<number, Rendered>();
  let output: Uint8Array;

  try {
    const sourcePtr = session.copyIn(source);
    const doc = session.open(sourcePtr, source.length);
    if (!doc) throw new EditPdfError('REPLACE_FAILED', `PDFium could not open the file (error ${api.FPDF_GetLastError()})`);
    try {
      if (api.FPDF_GetPageCount(doc) !== options.sourcePageCount) throw new EditPdfError('REPLACE_FAILED', 'PDFium and pdf-lib count different pages');
      // Every target page is drawn BEFORE any is rewritten: a form two target pages share is
      // rewritten in place with the first, and the second's picture must still show it.
      for (const pageIndex of byPage.keys()) {
        const page = api.FPDF_LoadPage(doc, pageIndex);
        if (!page) throw new EditPdfError('REPLACE_FAILED', `PDFium could not open page ${pageIndex + 1}`);
        try {
          before.set(pageIndex, renderPage(session, page));
        } finally {
          api.FPDF_ClosePage(page);
        }
      }
      for (const [pageIndex, list] of byPage) {
        const page = api.FPDF_LoadPage(doc, pageIndex);
        if (!page) throw new EditPdfError('REPLACE_FAILED', `PDFium could not open page ${pageIndex + 1}`);
        try {
          // Each line's own box may change, even where nothing was removed on this page (a shared
          // form already lost it with an earlier page); everything else must stay as it was.
          const boxes: Rect[] = list.map(({ geometry: g }) => frameRect(g, g.start, g.end, g.baseline - g.descent, g.baseline + g.ascent));
          for (const target of list) {
            const removal = removeLineObjects(session, page, target.geometry);
            boxes.push(...removal.boxes);
            if (removal.inForm) inForm.add(target);
            if (removal.refused) refused.add(target);
          }
          boxesByPage.set(pageIndex, boxes);
          if (!api.FPDFPage_GenerateContent(page)) throw new EditPdfError('REPLACE_FAILED', 'PDFium could not rewrite the page');
        } finally {
          api.FPDF_ClosePage(page);
        }
      }
      output = session.save(doc);
    } finally {
      api.FPDF_CloseDocument(doc);
    }
    // The heap never shrinks, so its peak is what it costs: the source copy goes before the output
    // comes in, unless the shared-form check below has to open the source again.
    if (inForm.size === 0) session.free(sourcePtr);

    // Open what was saved: the safety check and the verification run on the real output.
    const outputPtr = session.copyIn(output);
    const saved = session.open(outputPtr, output.length);
    if (!saved) throw new EditPdfError('REPLACE_FAILED', 'PDFium could not reopen its own output');
    try {
      if (api.FPDF_GetPageCount(saved) !== options.sourcePageCount) throw new EditPdfError('REPLACE_FAILED', 'the rewrite changed the page count');
      for (const [pageIndex, list] of byPage) {
        const page = api.FPDF_LoadPage(saved, pageIndex);
        if (!page) throw new EditPdfError('REPLACE_FAILED', `PDFium could not reopen page ${pageIndex + 1}`);
        try {
          const after = renderPage(session, page);
          const masked = deviceBoxes(boxesByPage.get(pageIndex) ?? [], after.toDevice);
          if (!sameOutside(before.get(pageIndex)!, after, masked)) {
            for (const target of list) refused.add(target);
            continue;
          }
          for (const target of list) {
            if (refused.has(target)) continue;
            if (leftoverGlyphs(session, page, target.geometry) > 0) failed.add(target);
          }
        } finally {
          api.FPDF_ClosePage(page);
        }
      }
      // A form drawn on other pages too lost the line there as well: compare those pages' text.
      if (inForm.size > 0) {
        const fresh = session.open(sourcePtr, source.length);
        try {
          for (let pageIndex = 0; pageIndex < options.sourcePageCount; pageIndex++) {
            if (byPage.has(pageIndex) || (options.keptPages && !options.keptPages.has(pageIndex))) continue;
            if (charCount(session, fresh, pageIndex) !== charCount(session, saved, pageIndex)) {
              for (const target of inForm) refused.add(target);
              break;
            }
          }
        } finally {
          if (fresh) api.FPDF_CloseDocument(fresh);
        }
      }
    } finally {
      api.FPDF_CloseDocument(saved);
    }
  } finally {
    session.release();
  }

  const report = (code: 'REPLACE_REFUSED' | 'REPLACE_FAILED', list: Set<RemovalTarget>, message: string) =>
    new EditPdfError(code, message, {
      objectIds: [...list].map((t) => t.objectId),
      pageNumbers: [...new Set([...list].map((t) => t.pageNumber))].sort((a, b) => a - b),
    });
  if (refused.size > 0) throw report('REPLACE_REFUSED', refused, 'the old text could not be taken out without changing something else');
  if (failed.size > 0) throw report('REPLACE_FAILED', failed, 'text was still found on a replaced line');
  return { bytes: output, removedLines: targets.length };
}

// ── The click-time probe ───────────────────────────────────────────────────

interface HeldFile {
  pd: Pdfium;
  file: Blob;
  ptr: number;
  size: number;
  doc: number;
  /** Pages already found to change when rewritten. */
  pageEffects: Set<number>;
}

let held: HeldFile | null = null;
let reading: { file: Blob; bytes: Promise<Uint8Array> } | null = null;

function dropHeld(): void {
  if (!held) return;
  const { pd, doc, ptr } = held;
  held = null;
  pd.api.FPDF_CloseDocument(doc);
  pd.runtime.wasmExports.free(ptr);
}

/** The file, open in PDFium, read once per Blob and kept until releaseTextReplacer() or another file. */
async function holdFile(pd: Pdfium, file: Blob): Promise<HeldFile> {
  if (held && held.file === file && held.pd === pd) return held;
  if (!reading || reading.file !== file) reading = { file, bytes: file.arrayBuffer().then((buffer) => new Uint8Array(buffer)) };
  const bytes = await reading.bytes;
  if (held && held.file === file && held.pd === pd) return held; // another probe got here first
  if (held && held.pd !== pd) held = null; // its module was forgotten: its memory went with it
  dropHeld();
  const ptr = pd.runtime.wasmExports.malloc(Math.max(1, bytes.length));
  if (!ptr) throw new EditPdfError('REPLACE_UNAVAILABLE', 'PDFium ran out of memory');
  pd.runtime.HEAPU8.set(bytes, ptr);
  const doc = pd.api.FPDF_LoadMemDocument(ptr, bytes.length, '');
  if (!doc) {
    pd.runtime.wasmExports.free(ptr);
    throw new EditPdfError('UNREADABLE', 'PDFium could not open the file');
  }
  reading = null;
  held = { pd, file, ptr, size: bytes.length, doc, pageEffects: new Set() };
  return held;
}

/** Load PDFium (cached). REPLACE_UNAVAILABLE when it can't. */
export async function loadTextReplacer(options: { pdfiumWasm?: Uint8Array } = {}): Promise<void> {
  await loadPdfium(options.pdfiumWasm);
}

/**
 * Can this line come out cleanly? The real removal and safety check on a
 * one-page copy of its page; the file itself is never changed. Advisory:
 * the export checks again on the real combination of lines. A page whose
 * rewrite changes it outside the line (not because of a form the line was
 * in) is remembered: every later line there gets the same answer, with
 * `wholePage`.
 */
export async function checkLineRemoval(file: Blob, line: SourceTextLine): Promise<LineRemovalCheck> {
  const pd = await loadPdfium();
  try {
    return checkHeldLine(pd, await holdFile(pd, file), line);
  } catch (error) {
    return stopped(error, 'UNREADABLE');
  }
}

function checkHeldLine(pd: Pdfium, source: HeldFile, line: SourceTextLine): LineRemovalCheck {
  if (source.pageEffects.has(line.pageIndex)) return { ok: false, reason: 'PAGE_EFFECTS', wholePage: true };
  const session = new Session(pd);
  const { api } = session;
  // Synchronous from here to the end.
  const scratch = api.FPDF_CreateNewDocument();
  if (!scratch) throw new EditPdfError('REPLACE_UNAVAILABLE', 'PDFium ran out of memory');
  let copy: Uint8Array;
  let boxes: Rect[];
  let inForm: boolean;
  let before: Rendered;
  try {
    const indexes = session.alloc(4);
    pd.runtime.setValue(indexes, line.pageIndex, 'i32');
    if (!api.FPDF_ImportPagesByIndex(scratch, source.doc, indexes, 1, 0)) throw new EditPdfError('UNREADABLE', `PDFium could not read page ${line.pageIndex + 1}`);
    const page = api.FPDF_LoadPage(scratch, 0);
    if (!page) throw new EditPdfError('UNREADABLE', `PDFium could not read page ${line.pageIndex + 1}`);
    try {
      before = renderPage(session, page);
      const removal = removeLineObjects(session, page, line.geometry);
      if (removal.refused) return { ok: false, reason: removal.refused };
      boxes = removal.boxes;
      inForm = removal.inForm;
      if (!api.FPDFPage_GenerateContent(page)) return { ok: false, reason: 'PAGE_EFFECTS' };
    } finally {
      api.FPDF_ClosePage(page);
    }
    copy = session.save(scratch);
  } finally {
    api.FPDF_CloseDocument(scratch);
    session.release();
  }

  const check = new Session(pd);
  try {
    const ptr = check.copyIn(copy);
    const doc = check.open(ptr, copy.length);
    if (!doc) return { ok: false, reason: 'PAGE_EFFECTS' };
    try {
      const page = api.FPDF_LoadPage(doc, 0);
      if (!page) return { ok: false, reason: 'PAGE_EFFECTS' };
      try {
        const after = renderPage(check, page);
        if (!sameOutside(before, after, deviceBoxes(boxes, after.toDevice))) {
          // A form PDFium regenerated can move the rest of the form (2.15.1 bakes its /Matrix into
          // its contents and keeps it too): that refuses this line, not every line of the page.
          if (inForm) return { ok: false, reason: 'PAGE_EFFECTS' };
          source.pageEffects.add(line.pageIndex);
          return { ok: false, reason: 'PAGE_EFFECTS', wholePage: true };
        }
        if (leftoverGlyphs(check, page, line.geometry) > 0) return { ok: false, reason: 'CANT_ISOLATE' };
      } finally {
        api.FPDF_ClosePage(page);
      }
    } finally {
      api.FPDF_CloseDocument(doc);
    }
  } finally {
    check.release();
  }
  return { ok: true };
}

/** Close the held file, free its heap copy and drop the module (its memory never shrinks otherwise). */
export async function releaseTextReplacer(): Promise<void> {
  reading = null;
  dropHeld();
  forgetPdfium();
}
