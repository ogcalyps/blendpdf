/**
 * Document stamps (workspace-spec.md 3.2): the watermark, the page
 * numbers and the letterhead, drawn on every saved page above everything else, inside the
 * page's visible box AFTER its crop, upright for the reader whatever the
 * page's /Rotate. Reached only from ./export (itself loaded with import()).
 *
 * Positions come from ./model, the same functions the preview uses, in
 * points from the visible box's top-left (y down). They reach the page
 * through lib/pdf-geometry's visual point and lib/pdf-text's upright frame,
 * then a matrix product for the turn:
 *
 *   M = upright(c) · rotate(angle) · translate(-w/2, ±h/2) [· scale(w, h)]
 *
 * so a diagonal watermark is plain text drawn in a turned frame: Cairo
 * through lib/pdf-text (Arabic shaped, selectable, read back in logical
 * order), no change to the text engine. Text the font can't draw is saved
 * as a picture (lib/text-to-image, as text boxes are) with a TEXT_AS_IMAGE
 * warning, once per stamp.
 */
import { concatTransformationMatrix, drawObject, popGraphicsState, pushGraphicsState, rgb, setGraphicsState } from 'pdf-lib';
import type { Color, PDFDocument, PDFImage, PDFName, PDFPage, PDFRef } from 'pdf-lib';
import { drawLayout, layoutText, uprightTransform } from '@/lib/pdf-text';
import type { Matrix, PdfTextFont, TextLayout } from '@/lib/pdf-text';
import { visualPointToPdf } from '@/lib/pdf-geometry';
import type { PageGeometry } from '@/lib/pdf-geometry';
import { layoutFontFor } from './keep-font/choose';
import { RASTER_SCALE } from './keep-font/draw';
import {
  LETTERHEAD_MARGIN_PT,
  letterheadFooterWidth,
  letterheadPlacement,
  letterheadRoom,
  letterheadSideWidth,
  splitLetterheadText,
  pageNumberOrigin, pageNumberText, watermarkImageSize, watermarkPlacements } from './model';
import type { BoxPt, LetterheadPlacement, LetterheadRoom, PageSize } from './model';
import { LETTERHEAD_FOOTER_SIZE, LETTERHEAD_NAME_SIZE, LETTERHEAD_RULE_COLOR, LETTERHEAD_TEXT_SIZE, WATERMARK_COLOR } from './types';
import type {
  AssetId,
  Direction,
  DocStamps,
  ExportWarning,
  HexColor,
  ImageAsset,
  LetterheadStamp,
  PageNumberStamp,
  PreparedImage,
  RasterTextInput,
  TextExtent,
  WatermarkStamp,
} from './types';

/** What the stamps need from the export: the output document, Cairo, images embedded once, the picture fallback. */
export interface StampContext {
  doc: PDFDocument;
  /** Cairo's bytes (for the layout); the export loads them whenever a stamp has text. */
  fontBytes: Uint8Array | null;
  /** Cairo embedded in the output, shared with the text boxes (embedded once). */
  cairo: () => Promise<PdfTextFont>;
  /** An asset embedded in the output, shared with image objects (embedded once). */
  image: (asset: ImageAsset) => Promise<PDFImage>;
  assets: Readonly<Record<AssetId, ImageAsset>>;
  rasterize: (input: RasterTextInput) => Promise<PreparedImage>;
  fallbackDirection: Direction;
  /** The export's list; each stamp adds at most one TEXT_AS_IMAGE. */
  warnings: ExportWarning[];
}

/** The watermark as drawn on every page: vector text, or a picture (an image watermark, or text the font lacks). */
type WatermarkArt =
  | { kind: 'text'; layout: TextLayout; w: number; h: number }
  | { kind: 'picture'; image: PDFImage; w: number; h: number };

/** `m1` after `m2`: a point goes through m2 first (PDF's row-vector order, m2 × m1). */
function compose(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [a1 * a2 + c1 * b2, b1 * a2 + d1 * b2, a1 * c2 + c1 * d2, b1 * c2 + d1 * d2, a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1];
}

/** Counter-clockwise by `angle` degrees in a y-up frame (counter-clockwise for the reader in the upright frame). */
function rotation(angle: number): Matrix {
  const a = (angle * Math.PI) / 180;
  const [cos, sin] = [Math.cos(a), Math.sin(a)];
  return [cos, sin, -sin, cos, 0, 0];
}

const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];
const scale = (x: number, y: number): Matrix => [x, 0, 0, y, 0, 0];

function colorOf(hex: string): Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const BLACK: HexColor = '#000000';

/** One run of a letterhead block at one size: the name, or the lines under it. */
interface LetterheadPart {
  text: string;
  size: number;
  layout: TextLayout;
}

interface LetterheadLayout {
  placed: LetterheadPlacement;
  left: LetterheadPart[];
  right: LetterheadPart[];
  footer: LetterheadPart[];
  asset: ImageAsset | undefined;
}

/** One per export: the watermark is laid out (or pictured) once, the opacity state registered once. */
export class StampPainter {
  private art: Promise<WatermarkArt> | null = null;
  private opacity: PDFRef | null = null;
  private readonly warned = new Set<string>();
  private readonly letterheads = new Map<string, LetterheadLayout>();

  constructor(
    private readonly ctx: StampContext,
    private readonly stamps: DocStamps,
  ) {}

  /** The stamps on one saved page; `g` is the page's geometry after its crop. Watermark first, so the rest stays on top. */
  async draw(page: PDFPage, g: PageGeometry, outputIndex: number, outputCount: number): Promise<void> {
    const { watermark, pageNumbers, letterhead } = this.stamps;
    if (watermark) await this.drawWatermark(page, g, watermark, outputIndex + 1);
    if (letterhead && (letterhead.pages === 'all' || outputIndex === 0)) await this.drawLetterhead(page, g, letterhead, outputIndex + 1);
    if (pageNumbers) await this.drawPageNumber(page, g, pageNumbers, outputIndex, outputCount);
  }

  private warn(objectId: string, pageNumber: number): void {
    if (this.warned.has(objectId)) return;
    this.warned.add(objectId);
    this.ctx.warnings.push({ code: 'TEXT_AS_IMAGE', objectId, pageNumber });
  }

  /** Without maxWidth each line of the text stays one line (watermark, page number); the letterhead wraps. */
  private layout(text: string, size: number, maxWidth?: number): TextLayout {
    const { fontBytes, fallbackDirection } = this.ctx;
    if (!fontBytes) throw new Error('stamps: Cairo was not loaded for a text stamp');
    return layoutText(layoutFontFor(fontBytes), text, { size, direction: 'auto', fallbackDirection, ...(maxWidth ? { maxWidth } : {}) });
  }

  /** Text the font can't draw, as an embedded PNG and its size in points. The wrap width gets an em of slack over the layout's guess. */
  private async picture(text: string, size: number, color: HexColor, layout: TextLayout): Promise<{ image: PDFImage; w: number; h: number }> {
    const { doc, rasterize, fallbackDirection } = this.ctx;
    const picture = await rasterize({ text, size, width: layout.width + size, color, fallbackDirection, scale: RASTER_SCALE });
    const image = await doc.embedPng(picture.bytes);
    return { image, w: picture.width / RASTER_SCALE, h: picture.height / RASTER_SCALE };
  }

  private watermarkArt(stamp: WatermarkStamp): Promise<WatermarkArt> {
    if (!this.art) {
      this.art = (async (): Promise<WatermarkArt> => {
        if (stamp.type === 'image') {
          const asset = this.ctx.assets[stamp.assetId!];
          // Sized per page (watermarkImageSize depends on the visible box); w and h are the pixel size here.
          return { kind: 'picture', image: await this.ctx.image(asset), w: asset.width, h: asset.height };
        }
        const layout = this.layout(stamp.text, stamp.size);
        if (layout.missing.length === 0) return { kind: 'text', layout, w: layout.width, h: layout.height };
        return { kind: 'picture', ...(await this.picture(stamp.text, stamp.size, WATERMARK_COLOR, layout)) };
      })();
    }
    return this.art;
  }

  /** The page's resource name for the watermark's opacity (one ExtGState object for the whole file). */
  private opacityState(page: PDFPage, opacity: number): PDFName {
    if (!this.opacity) this.opacity = this.ctx.doc.context.register(this.ctx.doc.context.obj({ Type: 'ExtGState', ca: opacity, CA: opacity }));
    return page.node.newExtGState('GS', this.opacity);
  }

  private async drawWatermark(page: PDFPage, g: PageGeometry, stamp: WatermarkStamp, pageNumber: number): Promise<void> {
    const art = await this.watermarkArt(stamp);
    const visible: PageSize = { width: g.width, height: g.height };
    const { width: w, height: h } = stamp.type === 'image' ? watermarkImageSize({ width: art.w, height: art.h }, visible) : { width: art.w, height: art.h };
    if (art.kind === 'picture' && stamp.type === 'text') this.warn('stamp:watermark', pageNumber);

    const font = art.kind === 'text' ? await this.ctx.cairo() : null;
    const name = art.kind === 'picture' ? page.node.newXObject('Image', art.image.ref) : null;
    page.pushOperators(pushGraphicsState(), setGraphicsState(this.opacityState(page, stamp.opacity)));
    for (const p of watermarkPlacements(stamp, visible, w, h)) {
      const c = visualPointToPdf(g, { x: p.cx / g.width, y: p.cy / g.height });
      const turned = compose(uprightTransform(c.x, c.y, g.rotation), rotation(p.angle));
      if (art.kind === 'text') {
        // Box space: origin at the box's top-left, y up; its centre (w/2, -h/2) goes to the placement.
        drawLayout(page, font!, art.layout, { size: stamp.size, width: w, align: 'center', color: colorOf(WATERMARK_COLOR), transform: compose(turned, translate(-w / 2, h / 2)) });
      } else {
        // Image space is the unit square, y up: scaled to w x h and centred on the placement.
        const m = compose(compose(turned, translate(-w / 2, -h / 2)), scale(w, h));
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m), drawObject(name!), popGraphicsState());
      }
    }
    page.pushOperators(popGraphicsState());
  }

  /**
   * The letterhead's layout on a page of this size, made once per size: the
   * placement, and each block's lines at their final sizes, wrapped to their
   * column (a side: the name at LETTERHEAD_NAME_SIZE, then the details).
   */
  private letterheadLayout(g: PageGeometry, stamp: LetterheadStamp): LetterheadLayout {
    const key = `${g.width}x${g.height}`;
    const cached = this.letterheads.get(key);
    if (cached) return cached;
    const visible: PageSize = { width: g.width, height: g.height };
    const asset = stamp.logoAssetId ? this.ctx.assets[stamp.logoAssetId] : undefined;
    const logo = asset ? { width: asset.width, height: asset.height } : undefined;
    const side = letterheadSideWidth(visible, logo);
    const inner = letterheadFooterWidth(visible);
    const parts = (text: string, column: number, sideBlock: boolean, scale: number): LetterheadPart[] => {
      const { name, details } = sideBlock ? splitLetterheadText(text) : { name: '', details: text.trim() };
      const list: LetterheadPart[] = [];
      if (name) list.push({ text: name, size: LETTERHEAD_NAME_SIZE * scale, layout: this.layout(name, LETTERHEAD_NAME_SIZE * scale, column) });
      const size = (sideBlock ? LETTERHEAD_TEXT_SIZE : LETTERHEAD_FOOTER_SIZE) * scale;
      if (details) list.push({ text: details, size, layout: this.layout(details, size, column) });
      return list;
    };
    const measure = (list: LetterheadPart[]) =>
      list.length === 0 ? undefined : { width: Math.max(...list.map((p) => p.layout.width)), height: list.reduce((h, p) => h + p.layout.height, 0) };
    const base = {
      left: parts(stamp.left, side, true, 1),
      right: parts(stamp.right, side, true, 1),
      footer: parts(stamp.footer, inner, false, 1),
    };
    const placed = letterheadPlacement(visible, { left: measure(base.left), right: measure(base.right), footer: measure(base.footer), logo });
    // A block drawn smaller is laid out again at its smaller sizes
    const final = (list: LetterheadPart[], box: LetterheadPlacement['left'], text: string, column: number, sideBlock: boolean) =>
      !box ? [] : box.scale === 1 ? list : parts(text, column, sideBlock, box.scale);
    const result: LetterheadLayout = {
      placed,
      left: final(base.left, placed.left, stamp.left, side, true),
      right: final(base.right, placed.right, stamp.right, side, true),
      footer: final(base.footer, placed.footer, stamp.footer, inner, false),
      asset,
    };
    this.letterheads.set(key, result);
    return result;
  }

  /** How this page's own content moves to clear the letterhead (letterheadRoom), or null. */
  letterheadRoom(g: PageGeometry, outputIndex: number, text: TextExtent | undefined): LetterheadRoom | null {
    const stamp = this.stamps.letterhead;
    if (!stamp || (stamp.pages === 'first' && outputIndex > 0) || !text) return null;
    return letterheadRoom({ width: g.width, height: g.height }, this.letterheadLayout(g, stamp).placed, text);
  }

  /** A block's parts stacked from the box's top, each line aligned to the box's side whatever the text's direction. */
  private async drawBlock(page: PDFPage, g: PageGeometry, list: LetterheadPart[], box: BoxPt, side: 'left' | 'right' | 'center', pageNumber: number): Promise<void> {
    let y = box.y;
    const rtl = list[0]?.layout.lines[0]?.direction === 'rtl';
    const align = side === 'center' ? 'center' : (side === 'left') !== rtl ? 'start' : 'end';
    for (const part of list) {
      const topLeft = visualPointToPdf(g, { x: box.x / g.width, y: y / g.height });
      if (part.layout.missing.length === 0) {
        drawLayout(page, await this.ctx.cairo(), part.layout, { size: part.size, width: box.w, align, color: colorOf(BLACK), transform: uprightTransform(topLeft.x, topLeft.y, g.rotation) });
      } else {
        const { image, w, h } = await this.picture(part.text, part.size, BLACK, part.layout);
        const x = side === 'center' ? (box.w - w) / 2 : side === 'right' ? box.w - w : 0;
        const m = compose(compose(uprightTransform(topLeft.x, topLeft.y, g.rotation), translate(x, -h)), scale(w, h));
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m), drawObject(page.node.newXObject('Image', image.ref)), popGraphicsState());
        this.warn('stamp:letterhead', pageNumber);
      }
      y += part.layout.height;
    }
  }

  private async drawLetterhead(page: PDFPage, g: PageGeometry, stamp: LetterheadStamp, pageNumber: number): Promise<void> {
    const { placed, left, right, footer, asset } = this.letterheadLayout(g, stamp);
    if (placed.left) await this.drawBlock(page, g, left, placed.left, 'left', pageNumber);
    if (placed.right) await this.drawBlock(page, g, right, placed.right, 'right', pageNumber);
    if (placed.footer) await this.drawBlock(page, g, footer, placed.footer, 'center', pageNumber);
    if (placed.logo && asset) {
      const { x, y, w, h } = placed.logo;
      const topLeft = visualPointToPdf(g, { x: x / g.width, y: y / g.height });
      const m = compose(compose(uprightTransform(topLeft.x, topLeft.y, g.rotation), translate(0, -h)), scale(w, h));
      const image = await this.ctx.image(asset);
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m), drawObject(page.node.newXObject('Image', image.ref)), popGraphicsState());
    }
    const rule = (y: number) => {
      const start = visualPointToPdf(g, { x: LETTERHEAD_MARGIN_PT / g.width, y: y / g.height });
      const end = visualPointToPdf(g, { x: (g.width - LETTERHEAD_MARGIN_PT) / g.width, y: y / g.height });
      page.drawLine({ start, end, thickness: 0.75, color: colorOf(LETTERHEAD_RULE_COLOR) });
    };
    if (placed.headerRule !== null) rule(placed.headerRule);
    if (placed.footerRule !== null) rule(placed.footerRule);
  }

  private async drawPageNumber(page: PDFPage, g: PageGeometry, stamp: PageNumberStamp, outputIndex: number, outputCount: number): Promise<void> {
    const text = pageNumberText(stamp, outputIndex, outputCount);
    const layout = this.layout(text, stamp.size);
    const visible: PageSize = { width: g.width, height: g.height };
    if (layout.missing.length === 0) {
      const o = pageNumberOrigin(stamp.position, visible, layout.width, layout.height);
      const topLeft = visualPointToPdf(g, { x: o.x / g.width, y: o.y / g.height });
      drawLayout(page, await this.ctx.cairo(), layout, {
        size: stamp.size,
        width: layout.width,
        align: 'start',
        color: colorOf(BLACK),
        transform: uprightTransform(topLeft.x, topLeft.y, g.rotation),
      });
      return;
    }
    const { image, w, h } = await this.picture(text, stamp.size, BLACK, layout);
    const o = pageNumberOrigin(stamp.position, visible, w, h);
    // The picture's top-left at the origin, upright: unit square scaled to w x h, hanging below the frame's origin.
    const topLeft = visualPointToPdf(g, { x: o.x / g.width, y: o.y / g.height });
    const m = compose(compose(uprightTransform(topLeft.x, topLeft.y, g.rotation), translate(0, -h)), scale(w, h));
    page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m), drawObject(page.node.newXObject('Image', image.ref)), popGraphicsState());
    this.warn('stamp:pageNumbers', outputIndex + 1);
  }
}
