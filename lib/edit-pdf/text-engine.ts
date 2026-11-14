/**
 * The text layout the PDF writer uses, packaged for the editor preview.
 * Reached only through import() from ./index (it brings fontkit and bidi-js).
 *
 * The preview draws each engine line as its own absolutely positioned div in
 * the same Cairo file, registered as a FontFace with ascentOverride /
 * descentOverride set from `ascent` / `descent` and lineGapOverride 0%, so
 * the browser's CSS half-leading puts every baseline where the PDF has it
 * (lib/pdf-text layout.ts computes `baseline` with the same model). A box
 * with letters Cairo lacks is laid out with Liberation Sans as the export
 * will (text-fonts.ts), once the session fetched it.
 */
import type { Font } from '@pdf-lib/fontkit';
import { createLayoutFont } from '@/lib/pdf-text';
import { loadCairoBytes, loadFontFile } from './font';
import { layoutNewText, TEXT_FALLBACK_FONT_URL } from './text-fonts';
import type { TextBoxLayout, TextEngine, TextLayoutRequest } from './types';

/**
 * Lay out a text box exactly as export.ts will: direction 'auto' per
 * paragraph, the request's fallback for a box with no strong character,
 * start alignment per line.
 */
export function layoutTextBox(font: Font, text: string, request: TextLayoutRequest, fallback: Font | null = null): TextBoxLayout {
  const { fonts, layout } = layoutNewText(font, fallback, text, {
    size: request.size,
    maxWidth: request.width,
    direction: 'auto',
    fallbackDirection: request.fallbackDirection,
  });
  return {
    lines: layout.lines.map((line) => ({
      text: line.text,
      direction: line.direction,
      // drawLayout's 'start' alignment: an RTL line ends at the box's right edge.
      x: line.direction === 'rtl' ? request.width - line.width : 0,
      width: line.width,
    })),
    lineHeight: layout.lineHeight,
    height: layout.height,
    missing: layout.missing,
    fonts,
  };
}

/** A preview engine over the given Cairo bytes, and the fallback's when loaded (tests pass the files from public/fonts). */
export function createTextEngine(fontBytes: Uint8Array, fallbackBytes: Uint8Array | null = null): TextEngine {
  const font = createLayoutFont(fontBytes);
  const fallback = fallbackBytes ? createLayoutFont(fallbackBytes) : null;
  return {
    fontBytes,
    fallbackBytes,
    ascent: font.ascent / font.unitsPerEm,
    descent: -font.descent / font.unitsPerEm,
    layout: (text, request) => layoutTextBox(font, text, request, fallback),
  };
}

const engines: { cairo: Promise<TextEngine> | null; fallback: Promise<TextEngine> | null } = { cairo: null, fallback: null };

/**
 * The session's engine: fetches Cairo once, and with `fallback` Liberation Sans too (only when a
 * box needs it: 400 KB). A failed fetch is not cached, so the next call retries.
 */
export function loadTextEngine(options: { fallback?: boolean } = {}): Promise<TextEngine> {
  const key = options.fallback ? 'fallback' : 'cairo';
  let engine = engines[key];
  if (!engine) {
    const attempt = options.fallback
      ? Promise.all([loadCairoBytes(), loadFontFile(TEXT_FALLBACK_FONT_URL)]).then(([cairo, fallback]) => createTextEngine(cairo, fallback))
      : loadCairoBytes().then((cairo) => createTextEngine(cairo));
    engine = attempt;
    engines[key] = attempt;
    attempt.catch(() => {
      if (engines[key] === attempt) engines[key] = null;
    });
  }
  return engine;
}
