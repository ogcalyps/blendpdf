/**
 * Arabic/English vector text for PDFs: bidi (bidi-js) + shaping (fontkit) +
 * glyph placement (pdf-lib), with selectable, searchable text.
 *
 * Client code must load this lazily (await import('@/lib/pdf-text')) because
 * fontkit is large; only ./constants (CAIRO_FONT_URL, DEFAULT_LINE_HEIGHT) and
 * `import type` may be used statically (tests/pdf-text-lazy-load.test.ts).
 * Typical export:
 *
 *   const bytes = new Uint8Array(await (await fetch(CAIRO_FONT_URL)).arrayBuffer());
 *   const font = await embedTextFont(doc, bytes);
 *   const layout = layoutText(font.font, text, { size, maxWidth: width });
 *   if (layout.missing.length) { ...use lib/text-to-image.ts for this box... }
 *   else drawLayout(page, font, layout, { size, width, transform, color, align });
 */
export { analyzeParagraph, firstStrongDirection, isBidiControl, resolveDirection, resolveParagraphDirections, visualRuns } from './bidi';
export type { BaseDirection, BidiParagraph, LevelRun, ResolvedDirection } from './bidi';
export { findMissingCharacters, isDefaultIgnorable, shapeRun } from './shaping';
export type { ShapedGlyph } from './shaping';
export { CAIRO_FONT_URL, DEFAULT_LINE_HEIGHT } from './constants';
export { fontsOf, layoutText, normalizeText } from './layout';
export type { FontStack, LaidOutGlyph, LaidOutLine, TextLayout, TextLayoutOptions } from './layout';
export {
  MissingGlyphsError,
  createLayoutFont,
  drawLayout,
  drawTextBox,
  embedTextFont,
  subsetInternals,
  toUnicodeCodePoints,
  uprightTransform,
} from './pdf';
export type { DrawTextOptions, Matrix, PdfTextFont, TextAlign } from './pdf';
