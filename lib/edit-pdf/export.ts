/**
 * The /edit-pdf export: the visitor's edits applied to the ORIGINAL file, in
 * place. Reached only through import() from ./index. No DOM here except the
 * default text rasterizer (injectable), so the whole pipeline can move into
 * workers/pdf.worker.ts unchanged if it ever needs to.
 *
 * Why in place and not copyPages into a new document: the original's
 * bookmarks, links, metadata, tags, page labels, optional content and the
 * annotations of kept pages all survive. The price is that pdf-lib writes
 * every object it loaded, so deleted pages are scrubbed and every
 * unreachable object is pruned before saving (./prune.ts).
 *
 * Order matters:
 *   1. load (encrypted files are refused: pdf-lib cannot write them)
 *   1b. "Edit text (beta)": when replace objects sit on kept pages, PDFium
 *      takes their lines out of the ORIGINAL bytes (source page indexes,
 *      source user space), checks the rewrite and verifies the removal
 *      (./replace.ts, loaded with import()), and everything below runs on
 *      its output. Any failure rejects the whole export: nothing is saved
 *      with an old line still in it.
 *   2. capture the page list ONCE. pdf-lib 1.17.1's removePage does not
 *      invalidate its page cache (PDFDocument.js:524), so getPages() is never
 *      called again; `current` mirrors the page tree from here on
 *   3. pin inherited page attributes on the kept pages and give each its own
 *      resources; then fix the tree's /Count values and stop it handing
 *      attributes down (./page-tree.ts)
 *   4. flatten the AcroForm (it finds widget pages in that list), or, when
 *      the request keeps the form live (flattenForm: false), only drop the
 *      fields left with no kept page
 *   5. insert blank pages, scrub and remove deleted pages, move the rest into
 *      output order, and check the tree now holds exactly that order
 *   6. per output page: set the final /Rotate FIRST, then read its geometry
 *      and draw; positions are fractions of the page as finally shown. Then
 *      the crop: /CropBox from the same geometry, so objects keep their
 *      place on the page while only part of it stays visible. Then the
 *      document stamps (./stamps.ts), against the geometry AFTER the crop
 *   7. drop stale thumbnails, and private page data (/PieceInfo) on pages
 *      PDFium rewrote; prune the structure tree, bookmarks, destinations
 *      and links that lead to deleted pages or removed text, and retitle
 *      bookmarks that read like a replaced line (./structure.ts); flush,
 *      prune, save
 *
 * Known limits of "Edit text (beta)": the new line is drawn untagged (a
 * screen reader that reads by tags skips it); the old words can survive in
 * places other than the line, such as the document title in /Info or XMP,
 * or the /ActualText of a tag that spans several lines.
 *
 * "Keep the font" (keep-font-spec.md section 10): a replaced line is drawn
 * by keep-font/draw.ts from the plan keep-font/choose.ts makes, the same
 * plan the preview draws: in the line's own font objects (referenced from
 * the ORIGINAL file's pdf-lib document when PDFium dropped them), else the
 * closest look-alike (fetched from /fonts only then), else Cairo, else a
 * picture.
 */
import {
  LineCapStyle,
  LineJoinStyle,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  appendBezierCurve,
  closePath,
  degrees,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingColor,
  setGraphicsState,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingColor,
  stroke,
} from 'pdf-lib';
import type { Color, PDFDocument, PDFImage, PDFOperator, PDFPage, PDFRef } from 'pdf-lib';
import { drawLayout, layoutText, uprightTransform } from '@/lib/pdf-text';
import type { PdfTextFont } from '@/lib/pdf-text';
import { CAIRO_FONT_URL } from '@/lib/pdf-text/constants';
import { geometryOfPage, normalizeRotation, visualBoxToPdf, visualBoxToPdfRect, visualPointToPdf } from '@/lib/pdf-geometry';
import type { PageGeometry, PdfRect } from '@/lib/pdf-geometry';
import { renderTextBlockToImage } from '@/lib/text-to-image';
import { flattenForm } from './flatten';
import { loadCairoBytes, loadFontFile } from './font';
import { layoutFontFor, planReplacement } from './keep-font/choose';
import { RASTER_SCALE, drawPlan, embeddedFont } from './keep-font/draw';
import type { DrawContext } from './keep-font/draw';
import { exportFontResolver } from './keep-font/write';
import type { FontRefResolver } from './keep-font/write';
import { OBJECTS_PER_TICK, loadSource } from './load';
import { arrowHeadArms, letterheadHasContent, objectBounds, replaceSizeMax } from './model';
import type { LetterheadRoom } from './model';
import { isolateResources, pageRefsInTree, tidyPageTree } from './page-tree';
import { pruneUnreachable } from './prune';
import { StampPainter } from './stamps';
import { moveContent } from './room';
import { pruneStructure } from './structure';
import {
  COVER_COLOR,
  EDITOR_FONT_FAMILY,
  EditPdfError,
  HIGHLIGHT_COLOR,
  MIN_CROP_PT,
  PAGE_NUMBER_SIZE_MAX,
  PAGE_NUMBER_SIZE_MIN,
  LETTERHEAD_MAX_CHARS,
  REPLACE_MIN_SIZE,
  WATERMARK_SIZE_MAX,
  WATERMARK_SIZE_MIN,
} from './types';
import type {
  DocStamps,
  EditorObject,
  EditorPage,
  ExportOptions,
  ExportRequest,
  ExportResult,
  ExportWarning,
  ImageAsset,
  PagePoint,
  PreparedImage,
  RasterTextInput,
  ReplaceObject,
  TextExtent,
  TextObject,
} from './types';

/** PDF's own limit on a page side (PDF 32000 Annex C), in points. */
const MAX_PAGE_SIDE = 14400;
/** Ellipse from four cubic Béziers. */
const KAPPA = 0.5522847498307936;
/** Annotation flags that keep an annotation off the screen: Hidden, NoView. */
const HIDDEN_FLAGS = 2 | 32;
/** Annotations that draw nothing over the page: a link is an invisible hotspot, a popup belongs to a note. */
const NOT_DRAWN = new Set(['Link', 'Popup']);
/** Entries of a deleted page that can still hold its content (or point to it) after it leaves the page tree. */
const SCRUBBED_KEYS = ['Contents', 'Annots', 'Thumb', 'Metadata', 'PieceInfo', 'AA', 'B'];
/** Inherited boxes and rotation are copied onto the page; resources get their own copy (isolateResources). */
const PINNED_KEYS = ['MediaBox', 'CropBox', 'Rotate'];
/** Floating-point room for fractions and sizes the UI computed (a crop edge at 1.0000000002 is the page edge). */
const SLACK = 1e-6;
const STAMP_POSITIONS = new Set(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']);
const WATERMARK_POSITIONS = new Set(['center', 'diagonal', 'tiled']);
/** PageNumberStamp.startFrom's range. */
const MAX_START_FROM = 99999;

function colorOf(hex: string): Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Line and paragraph breaks: a replacement is one line. */
const BREAKS = /[\n\r\u0085\u2028\u2029]/;
const finite = (...values: number[]) => values.every(Number.isFinite);
const inRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min - SLACK && value <= max + SLACK;

function validateReplace(object: ReplaceObject, page: EditorPage, lineIds: Set<string>): void {
  const fail = (why: string) => new EditPdfError('INVALID_REQUEST', `replace ${object.id}: ${why}`);
  const { line } = object;
  if (page.source.kind !== 'source' || page.source.index !== line.pageIndex) throw fail(`its line is on source page ${line.pageIndex}, not on this page`);
  if (BREAKS.test(object.text)) throw fail('the text has a line break');
  if (object.font && object.font.lineId !== line.id) throw fail(`its font analysis is for line ${object.font.lineId}`);
  // With autoSize the engine resolves the size (it may be the line's own, above REPLACE_MAX_SIZE); `size` is a placeholder.
  // A size the visitor stepped to may be up to the line's own size (replaceSizeMax).
  if (!object.autoSize && !(object.size >= REPLACE_MIN_SIZE && object.size <= replaceSizeMax(object))) throw fail(`size ${object.size}`);
  if (object.autoSize && !(object.size > 0 && Number.isFinite(object.size))) throw fail(`size ${object.size}`);
  if (!/^#[0-9a-f]{6}$/i.test(object.color)) throw fail(`colour ${object.color}`);
  const g = line.geometry;
  if (!finite(g.ux, g.uy, g.baseline, g.start, g.end, g.size, g.ascent, g.descent, ...g.neighbours) || !(g.size > 0) || !(g.end >= g.start)) throw fail('bad line geometry');
  if (lineIds.has(line.id)) throw fail(`line ${line.id} is replaced twice`);
  lineIds.add(line.id);
}

function validate(request: ExportRequest, sourceCount: number): void {
  const fail = (why: string) => new EditPdfError('INVALID_REQUEST', why);
  if (request.pages.length === 0) throw fail('no pages');
  const ids = new Set<string>();
  const sources = new Set<number>();
  for (const page of request.pages) {
    if (ids.has(page.id)) throw fail(`page ${page.id} listed twice`);
    ids.add(page.id);
    if (![0, 90, 180, 270].includes(page.rotation)) throw fail(`page ${page.id} rotation ${page.rotation}`);
    // Fractions here; the size in points (MIN_CROP_PT) is checked on the page itself, in the export loop.
    if (page.crop) {
      const { xPct, yPct, wPct, hPct } = page.crop;
      const inside = xPct >= -SLACK && yPct >= -SLACK && xPct + wPct <= 1 + SLACK && yPct + hPct <= 1 + SLACK;
      if (!finite(xPct, yPct, wPct, hPct) || !(wPct > 0 && hPct > 0) || !inside) throw fail(`page ${page.id} crop`);
    }
    if (page.source.kind === 'source') {
      const index = page.source.index;
      if (!Number.isInteger(index) || index < 0 || index >= sourceCount) throw fail(`no source page ${index}`);
      if (sources.has(index)) throw fail(`source page ${index} listed twice`);
      sources.add(index);
    } else {
      const { width, height } = page.source;
      if (!(width > 0 && height > 0 && width <= MAX_PAGE_SIDE && height <= MAX_PAGE_SIDE)) throw fail(`blank page ${width}x${height}`);
    }
  }
  const pages = new Map(request.pages.map((page) => [page.id, page]));
  const lineIds = new Set<string>();
  for (const object of request.objects) {
    if (!ids.has(object.pageId)) continue;
    if (object.kind === 'image' && !request.assets[object.assetId]) throw fail(`no asset ${object.assetId}`);
    if (object.kind === 'text' && !(object.size > 0 && Number.isFinite(object.size))) throw fail(`text size ${object.size}`);
    if (object.kind === 'replace') validateReplace(object, pages.get(object.pageId)!, lineIds);
  }
  if (request.stamps) validateStamps(request.stamps, request);
}

function validateStamps({ watermark, pageNumbers, letterhead }: DocStamps, request: ExportRequest): void {
  const fail = (why: string) => new EditPdfError('INVALID_REQUEST', why);
  if (watermark) {
    if (watermark.type === 'text') {
      if (typeof watermark.text !== 'string' || watermark.text.trim() === '') throw fail('watermark: no text');
      if (!inRange(watermark.size, WATERMARK_SIZE_MIN, WATERMARK_SIZE_MAX)) throw fail(`watermark size ${watermark.size}`);
    } else if (watermark.type === 'image') {
      if (!watermark.assetId || !request.assets[watermark.assetId]) throw fail(`watermark: no asset ${watermark.assetId}`);
    } else {
      throw fail(`watermark type ${String(watermark.type)}`);
    }
    if (!WATERMARK_POSITIONS.has(watermark.position)) throw fail(`watermark position ${watermark.position}`);
    if (!inRange(watermark.opacity, 0.1, 1)) throw fail(`watermark opacity ${watermark.opacity}`);
  }
  if (pageNumbers) {
    const { position, startFrom, template, size } = pageNumbers;
    if (!STAMP_POSITIONS.has(position)) throw fail(`page numbers position ${position}`);
    if (!Number.isInteger(startFrom) || startFrom < 1 || startFrom > MAX_START_FROM) throw fail(`page numbers start ${startFrom}`);
    if (typeof template !== 'string' || BREAKS.test(template) || !template.includes('{n}')) throw fail('page numbers template');
    if (!inRange(size, PAGE_NUMBER_SIZE_MIN, PAGE_NUMBER_SIZE_MAX)) throw fail(`page numbers size ${size}`);
  }
  if (letterhead) {
    const { left, right, footer, logoAssetId, pages } = letterhead;
    for (const text of [left, right, footer]) {
      if (typeof text !== 'string' || text.length > LETTERHEAD_MAX_CHARS) throw fail('letterhead text');
    }
    if (logoAssetId !== undefined && !request.assets[logoAssetId]) throw fail(`letterhead: no asset ${logoAssetId}`);
    if (pages !== 'all' && pages !== 'first') throw fail(`letterhead pages ${String(pages)}`);
    if (!letterheadHasContent(letterhead)) throw fail('letterhead: empty');
  }
}

/**
 * Take the replaced lines out of the original bytes with PDFium and return
 * its output, removed and verified (./replace.ts). Objects on deleted pages
 * were filtered out by the caller.
 */
async function removeReplacedLines(
  source: Uint8Array,
  request: ExportRequest,
  replaces: readonly ReplaceObject[],
  sourcePageCount: number,
  options: ExportOptions,
): Promise<{ bytes: Uint8Array; removedLines: number }> {
  let removeLines: typeof import('./replace').removeLines;
  try {
    ({ removeLines } = await import('./replace'));
  } catch (error) {
    throw new EditPdfError('REPLACE_UNAVAILABLE', error instanceof Error ? error.message : String(error));
  }
  const pageNumber = new Map(request.pages.map((page, i) => [page.id, i + 1]));
  const targets = replaces.map((object) => ({
    objectId: object.id,
    pageIndex: object.line.pageIndex,
    pageNumber: pageNumber.get(object.pageId)!,
    geometry: object.line.geometry,
  }));
  const keptPages = new Set(request.pages.flatMap((page) => (page.source.kind === 'source' ? [page.source.index] : [])));
  return removeLines(source, targets, { pdfiumWasm: options.pdfiumWasm, sourcePageCount, keptPages });
}

/**
 * Copy inherited /MediaBox, /CropBox and /Rotate onto the page itself. Moving
 * a page can put it under another node of the page tree, and it must not pick
 * up that node's boxes or rotation on the way.
 */
function pinInherited(page: PDFPage): void {
  for (const key of PINNED_KEYS) {
    const name = PDFName.of(key);
    if (page.node.has(name)) continue;
    const inherited = page.node.getInheritableAttribute(name);
    if (inherited !== undefined) page.node.set(name, inherited);
  }
}

/** Empty a page that leaves the document, so a link, outline item or tag still pointing at it reaches nothing. */
function scrub(doc: PDFDocument, page: PDFPage): void {
  for (const key of SCRUBBED_KEYS) page.node.delete(PDFName.of(key));
  page.node.set(PDFName.of('Resources'), doc.context.obj({}));
}

/** Put the pages of the output into the page tree, in order. `current` mirrors the tree throughout. */
function arrangePages(doc: PDFDocument, request: ExportRequest, original: PDFPage[], kept: Set<PDFRef>): PDFPage[] {
  const current = [...original];
  // Blank pages first (at the end), so the tree is never empty while pages leave it.
  const targets = request.pages.map((entry) => {
    if (entry.source.kind === 'source') return original[entry.source.index];
    const blank = doc.insertPage(current.length, [entry.source.width, entry.source.height]);
    current.push(blank);
    return blank;
  });
  for (const page of original) {
    if (kept.has(page.ref)) continue;
    scrub(doc, page);
    const at = current.indexOf(page);
    doc.removePage(at);
    current.splice(at, 1);
  }
  targets.forEach((page, i) => {
    if (current[i] === page) return;
    const at = current.indexOf(page);
    doc.removePage(at);
    current.splice(at, 1);
    doc.insertPage(i, page);
    current.splice(i, 0, page);
  });
  return targets;
}

const roundStroke = (color: Color, width: number): PDFOperator[] => [
  pushGraphicsState(),
  setStrokingColor(color),
  setLineWidth(width),
  setLineCap(LineCapStyle.Round),
  setLineJoin(LineJoinStyle.Round),
];

/** Everything one export needs across pages: fonts and images embedded once. */
class Painter {
  private readonly images = new Map<string, Promise<PDFImage>>();
  private readonly multiply = new Map<PDFPage, PDFName>();
  /** Fonts embedded in the output by URL: Cairo (text boxes and Cairo lines) once, each look-alike once. */
  private readonly embedded = new Map<string, Promise<PdfTextFont>>();
  private fontRefs: FontRefResolver | null = null;
  private stampPainter: StampPainter | null = null;
  readonly warnings: ExportWarning[] = [];

  constructor(
    private readonly doc: PDFDocument,
    private readonly request: ExportRequest,
    private readonly fontBytes: Uint8Array | null,
    private readonly rasterize: (input: RasterTextInput) => Promise<PreparedImage>,
    private readonly loadFont: (url: string) => Promise<Uint8Array>,
    /** The ORIGINAL file in pdf-lib, where a replaced line's own font objects are copied from when PDFium dropped them. */
    private readonly sourceDoc: PDFDocument | null,
  ) {}

  private image(asset: ImageAsset): Promise<PDFImage> {
    let image = this.images.get(asset.id);
    if (!image) {
      image = asset.format === 'jpg' ? this.doc.embedJpg(asset.bytes) : this.doc.embedPng(asset.bytes);
      this.images.set(asset.id, image);
    }
    return image;
  }

  private multiplyState(page: PDFPage): PDFName {
    let key = this.multiply.get(page);
    if (!key) {
      key = page.node.newExtGState('GS', this.doc.context.obj({ Type: 'ExtGState', BM: 'Multiply' }));
      this.multiply.set(page, key);
    }
    return key;
  }

  /** Source font objects in the output: the same object when PDFium kept it, else a copy from the original (made on first use). */
  private sourceFonts(): FontRefResolver {
    if (!this.fontRefs) {
      if (!this.sourceDoc) throw new Error('keep-font: no source document for the original font');
      this.fontRefs = exportFontResolver(this.sourceDoc, this.doc);
    }
    return this.fontRefs;
  }

  /** What keep-font/draw needs: this document, its embedded fonts, the source font objects, the picture fallback. */
  private drawContext(): DrawContext {
    return {
      doc: this.doc,
      embedded: this.embedded,
      loadFont: this.loadFont,
      rasterize: this.rasterize,
      fonts: { refFor: (font) => this.sourceFonts().refFor(font) },
    };
  }

  /**
   * The watermark and page numbers on one saved page (./stamps.ts), sharing
   * this export's Cairo and image embeds. `g` is the page AFTER its crop.
   */
  private stampPainterFor(stamps: DocStamps): StampPainter {
    if (!this.stampPainter) {
      this.stampPainter = new StampPainter(
        {
          doc: this.doc,
          fontBytes: this.fontBytes,
          cairo: () => embeddedFont({ doc: this.doc, embedded: this.embedded, loadFont: this.loadFont }, CAIRO_FONT_URL),
          image: (asset) => this.image(asset),
          assets: this.request.assets,
          rasterize: this.rasterize,
          fallbackDirection: this.request.fallbackDirection,
          warnings: this.warnings,
        },
        stamps,
      );
    }
    return this.stampPainter;
  }

  async stamps(page: PDFPage, g: PageGeometry, stamps: DocStamps, outputIndex: number, outputCount: number): Promise<void> {
    await this.stampPainterFor(stamps).draw(page, g, outputIndex, outputCount);
  }

  /** How the page's own content moves to clear the letterhead (./stamps.ts letterheadRoom), or null. */
  letterheadRoom(g: PageGeometry, stamps: DocStamps, outputIndex: number, text: TextExtent | undefined): LetterheadRoom | null {
    return this.stampPainterFor(stamps).letterheadRoom(g, outputIndex, text);
  }

  async draw(page: PDFPage, g: PageGeometry, object: EditorObject, pageNumber: number): Promise<void> {
    const point = (p: PagePoint) => visualPointToPdf(g, p);
    switch (object.kind) {
      case 'cover':
      case 'highlight': {
        const r = visualBoxToPdfRect(g, object.box);
        const highlight = object.kind === 'highlight';
        page.pushOperators(
          pushGraphicsState(),
          ...(highlight ? [setGraphicsState(this.multiplyState(page))] : []),
          setFillingColor(colorOf(highlight ? HIGHLIGHT_COLOR : COVER_COLOR)),
          rectangle(r.x, r.y, r.width, r.height),
          fill(),
          popGraphicsState(),
        );
        return;
      }
      case 'shape': {
        const r = visualBoxToPdfRect(g, object.box);
        const path: PDFOperator[] = [];
        if (object.shape === 'rectangle') {
          path.push(rectangle(r.x, r.y, r.width, r.height));
        } else {
          const [cx, cy, rx, ry] = [r.x + r.width / 2, r.y + r.height / 2, r.width / 2, r.height / 2];
          const [kx, ky] = [KAPPA * rx, KAPPA * ry];
          path.push(
            moveTo(cx + rx, cy),
            appendBezierCurve(cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry),
            appendBezierCurve(cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy),
            appendBezierCurve(cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry),
            appendBezierCurve(cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy),
            closePath(),
          );
        }
        page.pushOperators(...roundStroke(colorOf(object.color), object.strokeWidth), ...path, stroke(), popGraphicsState());
        return;
      }
      case 'line': {
        const from = point(object.from);
        const tip = point(object.to);
        const path = [moveTo(from.x, from.y), lineTo(tip.x, tip.y)];
        if (object.arrow) {
          // The arms are computed in points on the visual page (shared with the preview), then mapped like any point.
          const inPoints = (p: PagePoint) => ({ x: p.x * g.width, y: p.y * g.height });
          for (const arm of arrowHeadArms(inPoints(object.from), inPoints(object.to), object.strokeWidth)) {
            const end = point({ x: arm.x / g.width, y: arm.y / g.height });
            path.push(moveTo(tip.x, tip.y), lineTo(end.x, end.y));
          }
        }
        page.pushOperators(...roundStroke(colorOf(object.color), object.strokeWidth), ...path, stroke(), popGraphicsState());
        return;
      }
      case 'ink': {
        const pts = object.points;
        if (pts.length < 2) return;
        const path: PDFOperator[] = [];
        for (let i = 0; i + 1 < pts.length; i += 2) {
          const p = point({ x: pts[i], y: pts[i + 1] });
          path.push(i === 0 ? moveTo(p.x, p.y) : lineTo(p.x, p.y));
        }
        // A tap is a dot: a zero-length line with round caps (PDF 32000 8.5.3.2).
        if (path.length === 1) {
          const p = point({ x: pts[0], y: pts[1] });
          path.push(lineTo(p.x, p.y));
        }
        page.pushOperators(...roundStroke(colorOf(object.color), object.strokeWidth), ...path, stroke(), popGraphicsState());
        return;
      }
      case 'image': {
        const image = await this.image(this.request.assets[object.assetId]);
        const p = visualBoxToPdf(g, object.box);
        page.drawImage(image, { x: p.x, y: p.y, width: p.width, height: p.height, rotate: degrees(p.rotation) });
        return;
      }
      case 'text':
        await this.drawText(page, g, object, pageNumber);
        return;
      case 'replace':
        await this.drawReplacement(page, object, pageNumber);
        return;
    }
  }

  /**
   * The new wording of a replaced line, on the old baseline, from the old
   * start edge (left for an LTR line, right for RTL), along the line's own
   * axis in source user space: the plan keep-font/choose.ts makes (the same
   * one the preview drew), drawn by keep-font/draw.ts. The page's /Rotate
   * is ignored on purpose: the line's axis already reads right on screen,
   * and a page holding a replace object is never turned in the editor.
   */
  private async drawReplacement(page: PDFPage, object: ReplaceObject, pageNumber: number): Promise<void> {
    if (object.text.trim() === '') return;
    const plan = await planReplacement(object, object.text, { loadFont: this.loadFont });
    const g = object.line.geometry;
    const drawn = await drawPlan(page, object, object.text, plan, { ux: g.ux, uy: g.uy, baseline: g.baseline }, this.drawContext());
    if (drawn?.image) this.warnings.push({ code: 'TEXT_AS_IMAGE', objectId: object.id, pageNumber });
  }

  private async drawText(page: PDFPage, g: PageGeometry, object: TextObject, pageNumber: number): Promise<void> {
    const { fontBytes } = this;
    if (object.text.trim() === '' || !fontBytes) return;
    const width = object.box.wPct * g.width;
    const { fallbackDirection } = this.request;
    const layout = layoutText(layoutFontFor(fontBytes), object.text, { size: object.size, maxWidth: width, direction: 'auto', fallbackDirection });
    if (layout.missing.length === 0) {
      const topLeft = visualPointToPdf(g, { x: object.box.xPct, y: object.box.yPct });
      drawLayout(page, await embeddedFont({ doc: this.doc, embedded: this.embedded, loadFont: this.loadFont }, CAIRO_FONT_URL), layout, {
        size: object.size,
        width,
        align: 'start',
        color: colorOf(object.color),
        transform: uprightTransform(topLeft.x, topLeft.y, g.rotation),
      });
      return;
    }
    const picture = await this.rasterize({ text: object.text, size: object.size, width, color: object.color, fallbackDirection, scale: RASTER_SCALE });
    const image = await this.doc.embedPng(picture.bytes);
    const hPct = picture.height / RASTER_SCALE / g.height;
    const p = visualBoxToPdf(g, { ...object.box, hPct });
    page.drawImage(image, { x: p.x, y: p.y, width: p.width, height: p.height, rotate: degrees(p.rotation) });
    this.warnings.push({ code: 'TEXT_AS_IMAGE', objectId: object.id, pageNumber });
  }
}

/** Rectangles of the annotations viewers will paint over this page's content. */
function drawnAnnotationRects(page: PDFPage): PdfRect[] {
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  const rects: PdfRect[] = [];
  for (let i = 0; i < (annots?.size() ?? 0); i++) {
    const annot = annots!.lookup(i);
    if (!(annot instanceof PDFDict)) continue;
    const subtype = annot.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText();
    if (subtype && NOT_DRAWN.has(subtype)) continue;
    const flags = annot.lookupMaybe(PDFName.of('F'), PDFNumber)?.asNumber() ?? 0;
    if (flags & HIDDEN_FLAGS) continue;
    const rect = annot.lookupMaybe(PDFName.of('Rect'), PDFArray);
    const n = rect?.asArray().map((v) => annot.context.lookup(v));
    if (!n || n.length !== 4 || !n.every((v) => v instanceof PDFNumber)) continue;
    const [x0, y0, x1, y1] = n.map((v) => (v as PDFNumber).asNumber());
    rects.push({ x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) });
  }
  return rects;
}

/** The user-space area an object paints: its bounds, plus half the stroke for outlines, lines and drawing. */
function paintedRect(g: PageGeometry, object: EditorObject): PdfRect {
  const r = visualBoxToPdfRect(g, objectBounds(object));
  const pad = object.kind === 'shape' || object.kind === 'line' || object.kind === 'ink' ? object.strokeWidth / 2 : 0;
  return { x: r.x - pad, y: r.y - pad, width: r.width + 2 * pad, height: r.height + 2 * pad };
}

const overlaps = (a: PdfRect, b: PdfRect) =>
  Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0 && Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0;

async function defaultRasterize(input: RasterTextInput): Promise<PreparedImage> {
  const picture = await renderTextBlockToImage({ ...input, fontFamily: `"${EDITOR_FONT_FAMILY}", Cairo, sans-serif` });
  return { format: 'png', bytes: new Uint8Array(picture.bytes), width: picture.width, height: picture.height };
}

export async function exportEditedPdf(source: Uint8Array, request: ExportRequest, options: ExportOptions = {}): Promise<ExportResult> {
  let doc = await loadSource(source);
  /** The original file, kept when a replaced line may be drawn in its own font objects. */
  let sourceDoc: PDFDocument | null = null;
  if (doc.isEncrypted) throw new EditPdfError('ENCRYPTED');
  let original: PDFPage[];
  try {
    original = doc.getPages();
  } catch (error) {
    throw new EditPdfError('UNREADABLE', error instanceof Error ? error.message : undefined);
  }
  validate(request, original.length);

  // "Edit text (beta)": the old lines leave the original bytes first; everything below works on PDFium's output.
  const outputIds = new Set(request.pages.map((page) => page.id));
  const replaces = request.objects.filter((o): o is ReplaceObject => o.kind === 'replace' && outputIds.has(o.pageId));
  let removedLines = 0;
  const rewrittenIndexes = new Set(replaces.map((o) => o.line.pageIndex));
  if (replaces.length > 0) {
    if (replaces.some((o) => o.font && o.text.trim() !== '')) sourceDoc = doc;
    const sourcePageCount = original.length;
    const removal = await removeReplacedLines(source, request, replaces, sourcePageCount, options);
    const failed = (why: string) => new EditPdfError('REPLACE_FAILED', why);
    try {
      doc = await loadSource(removal.bytes);
      original = doc.getPages();
    } catch (error) {
      throw failed(`pdf-lib could not read PDFium's output: ${error instanceof Error ? error.message : error}`);
    }
    if (doc.isEncrypted) throw failed("PDFium's output is encrypted");
    if (original.length !== sourcePageCount) throw failed(`PDFium's output has ${original.length} pages, not ${sourcePageCount}`);
    removedLines = removal.removedLines;
  }

  const keptPages = request.pages.flatMap((entry) => (entry.source.kind === 'source' ? [original[entry.source.index]] : []));
  const kept = new Set(keptPages.map((page) => page.ref));
  const warnings: ExportWarning[] = [];

  // Before the form is flattened into the pages: that draws into their resources.
  const deletesPages = keptPages.length < original.length;
  for (const page of keptPages) {
    pinInherited(page);
    isolateResources(page, deletesPages);
  }
  tidyPageTree(doc);

  const unflattened = flattenForm(doc, original, kept, { all: request.flattenForm !== false });
  if (unflattened > 0) warnings.push({ code: 'FORM_NOT_FLATTENED', fields: unflattened });

  const output = arrangePages(doc, request, original, kept);
  const inTree = pageRefsInTree(doc);
  if (inTree.length !== output.length || inTree.some((ref, i) => ref !== output[i].ref)) {
    throw new EditPdfError('UNREADABLE', 'the page tree did not end up in the order asked for');
  }

  const byPage = new Map<string, EditorObject[]>(request.pages.map((entry) => [entry.id, []]));
  for (const object of request.objects) byPage.get(object.pageId)?.push(object);
  // Text boxes and text stamps are Cairo: fetched now. A replaced line fetches Cairo or a look-alike only if its plan needs it.
  const stamps = request.stamps?.watermark || request.stamps?.pageNumbers || request.stamps?.letterhead ? request.stamps : undefined;
  const needsCairo =
    !!stamps?.pageNumbers ||
    (!!stamps?.letterhead && [stamps.letterhead.left, stamps.letterhead.right, stamps.letterhead.footer].some((t) => t.trim() !== '')) ||
    stamps?.watermark?.type === 'text' ||
    request.objects.some((o) => o.kind === 'text' && byPage.has(o.pageId) && o.text.trim() !== '');
  const fontBytes = needsCairo ? (options.fontBytes ?? (await loadCairoBytes())) : null;
  const loadShipped = options.loadFont ?? loadFontFile;
  const loadFont = (url: string): Promise<Uint8Array> => {
    if (url !== CAIRO_FONT_URL) return loadShipped(url);
    if (fontBytes) return Promise.resolve(fontBytes);
    return options.fontBytes ? Promise.resolve(options.fontBytes) : loadCairoBytes();
  };
  const painter = new Painter(doc, request, fontBytes, options.rasterizeText ?? defaultRasterize, loadFont, sourceDoc);

  for (let i = 0; i < output.length; i++) {
    const entry: EditorPage = request.pages[i];
    const page = output[i];
    const base = entry.source.kind === 'source' ? normalizeRotation(page.getRotation().angle) : 0;
    page.setRotation(degrees((base + entry.rotation) % 360));
    const g = geometryOfPage(page); // after the final rotation: object fractions refer to the page as shown
    const objects = byPage.get(entry.id)!;
    // The letterhead's room: the page's own content shrinks and moves before anything is drawn on it, so the
    // visitor's objects stay where the preview showed them. Not on turned or cropped pages, nor beside a replaced
    // line (anchored to where the line was).
    if (stamps?.letterhead && entry.rotation === 0 && !entry.crop && g.rotation === 0 && !objects.some((o) => o.kind === 'replace')) {
      const room = painter.letterheadRoom(g, stamps, i, request.textExtents?.[entry.id]);
      if (room) moveContent(page, g, room);
    }
    for (const object of objects) await painter.draw(page, g, object, i + 1);

    // The crop, in fractions of that same page (pre-crop), as /CropBox; MediaBox and /Rotate stay (as crop-pdf does).
    if (entry.crop) {
      const r = visualBoxToPdfRect(g, entry.crop);
      if (!(r.width >= MIN_CROP_PT - SLACK && r.height >= MIN_CROP_PT - SLACK)) {
        throw new EditPdfError('INVALID_REQUEST', `page ${entry.id} crop ${r.width.toFixed(1)}x${r.height.toFixed(1)} pt`);
      }
      page.setCropBox(r.x, r.y, r.width, r.height);
    }
    // Stamps sit inside what stays visible: read the geometry again, after the crop.
    if (stamps) await painter.stamps(page, entry.crop ? geometryOfPage(page) : g, stamps, i, output.length);

    // A thumbnail shows the page as it was; PieceInfo can hold an application's private copy of the
    // page (the old text included), so it goes from every page PDFium rewrote.
    if (objects.length > 0 || entry.rotation !== 0 || entry.crop || stamps) page.node.delete(PDFName.of('Thumb'));
    if (entry.source.kind === 'source' && rewrittenIndexes.has(entry.source.index)) page.node.delete(PDFName.of('PieceInfo'));

    const annotations = drawnAnnotationRects(page);
    if (annotations.length === 0) continue;
    for (const object of objects) {
      const area = paintedRect(g, object);
      if (annotations.some((a) => overlaps(a, area))) warnings.push({ code: 'OVERLAPS_ANNOTATION', objectId: object.id, pageNumber: i + 1 });
    }
  }
  warnings.push(...painter.warnings);

  // Tags, bookmarks, named destinations and links that lead to a deleted page, marked content PDFium
  // took off a rewritten page, and bookmarks titled with a replaced line (./structure.ts); the prune
  // below then drops what they held.
  if (deletesPages || replaces.length > 0) {
    const rewritten = new Set([...rewrittenIndexes].map((index) => original[index].ref));
    const outputRef = new Map(request.pages.map((entry, i) => [entry.id, output[i].ref]));
    const retitled = replaces.map((o) => ({ page: outputRef.get(o.pageId)!, old: o.line.text, text: o.text }));
    pruneStructure(doc, output.map((page) => page.ref), rewritten, retitled);
  }

  await doc.flush();
  pruneUnreachable(doc.context);
  const bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false, objectsPerTick: OBJECTS_PER_TICK });
  return { bytes, warnings, removedLines };
}
