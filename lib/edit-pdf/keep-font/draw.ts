/**
 * "Keep the font": drawing a ReplacementPlan on a page. The ONE drawing path
 * shared by the export (on the real page, in the line's own frame) and the
 * preview (on a one-line page, upright), so the preview shows exactly what
 * the export writes (keep-font-spec.md sections 8 and 10).
 *
 *   original  ./write drawOriginalLine with the source font objects
 *   vector    lib/pdf-text in the look-alike stack (or Cairo), from the old
 *             start edge (left for LTR, right for RTL), 12 degree oblique
 *             for an italic line
 *   image     the Phase C picture fallback (Cairo through lib/text-to-image)
 *
 * Owner: ENGINE. Reached only through import().
 */
import { degrees, rgb } from 'pdf-lib';
import type { Color, PDFDocument, PDFPage } from 'pdf-lib';
import { drawLayout, embedTextFont, layoutText } from '@/lib/pdf-text';
import type { Matrix, PdfTextFont } from '@/lib/pdf-text';
import { CAIRO_FONT_URL } from '@/lib/pdf-text/constants';
import type { PreparedImage, RasterTextInput, ReplaceObject } from '../types';
import { stackFonts } from './choose';
import type { PlanDeps } from './choose';
import { OBLIQUE_DEGREES } from './lookalike';
import type { ReplacementPlan } from './types';
import { drawOriginalLine } from './write';
import type { FontRefResolver, LineFrame } from './write';

/** Pixels per point for a line saved as a picture (as Phase C). */
export const RASTER_SCALE = 3;

/** What drawing a plan needs besides the page: fonts and the picture fallback. */
export interface DrawContext extends PlanDeps {
  doc: PDFDocument;
  /** Source font objects in `doc` (original plans). */
  fonts: FontRefResolver;
  /** Fonts embedded in `doc` so far, by URL (shared with the export's text boxes: Cairo is embedded once). */
  embedded: Map<string, Promise<PdfTextFont>>;
  rasterize: (input: RasterTextInput) => Promise<PreparedImage>;
}

/** Where the drawn line's ink lies, along the baseline (s) and across it (p, from the baseline up). */
export interface DrawnExtent {
  start: number;
  end: number;
  /** Above and below the baseline, points (descent positive). */
  ascent: number;
  descent: number;
  /** The picture fallback was used (TEXT_AS_IMAGE). */
  image: boolean;
}

function colorOf(hex: string): Color {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** A font embedded once per document, by URL. */
export function embeddedFont(ctx: Pick<DrawContext, 'doc' | 'embedded' | 'loadFont'>, url: string): Promise<PdfTextFont> {
  let font = ctx.embedded.get(url);
  if (!font) {
    font = ctx.loadFont(url).then((bytes) => embedTextFont(ctx.doc, bytes));
    ctx.embedded.set(url, font);
  }
  return font;
}

/** The frame's matrix at (s, p): x along the baseline, y across it. */
const frameAt = (frame: LineFrame, s: number, p: number): Matrix => [frame.ux, frame.uy, -frame.uy, frame.ux, s * frame.ux - p * frame.uy, s * frame.uy + p * frame.ux];

/**
 * Draw `plan` for `object` with the text `text` on `page`, along `frame`
 * (the export passes the line's own axis; the preview ux = 1, uy = 0). The
 * s coordinates are the line's (geometry.start..end) in both.
 */
export async function drawPlan(page: PDFPage, object: ReplaceObject, text: string, plan: ReplacementPlan, frame: LineFrame, ctx: DrawContext): Promise<DrawnExtent | null> {
  const { line } = object;
  const g = line.geometry;
  if (plan.kind === 'empty') return null;
  if (plan.kind === 'original') {
    drawOriginalLine(page, plan, frame, ctx.fonts);
    let start = Infinity;
    let end = -Infinity;
    let ascent = 0;
    let descent = 0;
    for (const glyph of plan.glyphs) {
      start = Math.min(start, glyph.s);
      end = Math.max(end, glyph.s + glyph.advance);
      ascent = Math.max(ascent, glyph.p + glyph.size * 0.95);
      descent = Math.max(descent, -glyph.p + glyph.size * 0.3);
    }
    return { start, end, ascent, descent, image: false };
  }
  if (plan.kind === 'vector') {
    const stack = await stackFonts(plan.fonts, ctx);
    const layout = layoutText(stack, text, { size: plan.size, direction: 'auto', fallbackDirection: line.direction });
    const left = line.direction === 'rtl' ? g.end - layout.width : g.start;
    let transform = frameAt(frame, left, frame.baseline + layout.baseline);
    if (plan.oblique) {
      // Slant about the baseline: x' = x + tan * (y + layout.baseline) in box space (y up, the baseline at -layout.baseline).
      const k = Math.tan((OBLIQUE_DEGREES * Math.PI) / 180);
      const [a, b, c, d, e, f] = transform;
      const shift = k * layout.baseline;
      transform = [a, b, a * k + c, b * k + d, a * shift + e, b * shift + f];
    }
    const embedded = await Promise.all(plan.fonts.map((url) => embeddedFont(ctx, url)));
    drawLayout(page, embedded, layout, { size: plan.size, width: layout.width, align: 'start', color: colorOf(object.color), transform });
    const ascent = Math.max(...stack.map((f) => (f.ascent / f.unitsPerEm) * plan.size));
    const descent = Math.max(...stack.map((f) => (-f.descent / f.unitsPerEm) * plan.size));
    return { start: left, end: left + layout.width, ascent, descent, image: false };
  }
  // A picture of the line, in the same frame (Phase C). The canvas wraps at its width, so it gets room to spare.
  const [cairo] = await stackFonts([CAIRO_FONT_URL], ctx);
  const layout = layoutText(cairo, text, { size: plan.size, direction: 'auto', fallbackDirection: line.direction });
  const width = layout.width + 2 * plan.size;
  const picture = await ctx.rasterize({ text, size: plan.size, width, color: object.color, fallbackDirection: line.direction, scale: RASTER_SCALE });
  const image = await ctx.doc.embedPng(picture.bytes);
  const w = picture.width / RASTER_SCALE;
  const h = picture.height / RASTER_SCALE;
  const textLeft = line.direction === 'rtl' ? g.end - layout.width : g.start;
  const imageLeft = layout.direction === 'rtl' ? textLeft + layout.width - w : textLeft;
  const [, , , , x, y] = frameAt(frame, imageLeft, frame.baseline + layout.baseline - h);
  page.drawImage(image, { x, y, width: w, height: h, rotate: degrees((Math.atan2(frame.uy, frame.ux) * 180) / Math.PI) });
  return { start: imageLeft, end: imageLeft + w, ascent: layout.baseline, descent: h - layout.baseline, image: true };
}
