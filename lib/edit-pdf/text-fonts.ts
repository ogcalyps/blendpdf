/**
 * The fonts a new text box is drawn in, shared by the preview
 * (text-engine.ts) and the export so both lay it out the same way. Cairo
 * when it has every character, as always. Otherwise Liberation Sans, which
 * has Hebrew, Cyrillic and Greek: alone when it has every character, so a
 * Hebrew line comes from one font (pdf.js starts a new text item at each
 * font change and would read the words in visual order), else after Cairo
 * for a box that mixes Arabic with one of those. When even that can't draw
 * the text, the Cairo layout comes back with its missing characters and
 * the box is saved as a picture.
 */
import type { Font } from '@pdf-lib/fontkit';
import { layoutText, type TextLayout, type TextLayoutOptions } from '@/lib/pdf-text';
import { CAIRO_FONT_URL } from '@/lib/pdf-text/constants';
import { lookalikeFile } from './keep-font/lookalike';
import type { TextFonts } from './types';

export const TEXT_FALLBACK_FONT_URL = lookalikeFile('Liberation Sans', false);

/** The font files of each choice, in stack order. */
export const TEXT_FONT_URLS: Readonly<Record<TextFonts, readonly string[]>> = {
  cairo: [CAIRO_FONT_URL],
  fallback: [TEXT_FALLBACK_FONT_URL],
  both: [CAIRO_FONT_URL, TEXT_FALLBACK_FONT_URL],
};

/** Lay `text` out in Cairo, or with the fallback when Cairo lacks a character (`fallback` null: not loaded). */
export function layoutNewText(cairo: Font, fallback: Font | null, text: string, options: TextLayoutOptions): { fonts: TextFonts; layout: TextLayout } {
  const own = layoutText(cairo, text, options);
  if (own.missing.length === 0 || !fallback) return { fonts: 'cairo', layout: own };
  const alone = layoutText(fallback, text, options);
  if (alone.missing.length === 0) return { fonts: 'fallback', layout: alone };
  const both = layoutText([cairo, fallback], text, options);
  return both.missing.length === 0 ? { fonts: 'both', layout: both } : { fonts: 'cairo', layout: own };
}
