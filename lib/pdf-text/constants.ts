/**
 * The values a page needs before lib/pdf-text is loaded. This file imports
 * nothing, so it is the one part of lib/pdf-text client code may import
 * statically: everything else pulls in fontkit and bidi-js (about 334 KB gzip)
 * and must be loaded with import(). tests/pdf-text-lazy-load.test.ts enforces it.
 */

/** Where the bundled Cairo font is served from (public/fonts, OFL licence next to it). */
export const CAIRO_FONT_URL = '/fonts/Cairo-Regular.ttf';

/** Line pitch as a multiple of the font size, like CSS line-height. The on-screen preview must use the same. */
export const DEFAULT_LINE_HEIGHT = 1.6;
