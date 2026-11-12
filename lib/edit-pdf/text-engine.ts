/**
 * The text layout the PDF writer uses, packaged for the editor preview.
 * Reached only through import() from ./index (it brings fontkit and bidi-js).
 *
 * The preview draws each engine line as its own absolutely positioned div in
 * the same Cairo file, registered as a FontFace with ascentOverride /
 * descentOverride set from `ascent` / `descent` and lineGapOverride 0%, so
 * the browser's CSS half-leading puts every baseline where the PDF has it
 * (lib/pdf-text layout.ts computes `baseline` with the same model).
 */
import type { Font } from '@pdf-lib/fontkit';
import { createLayoutFont, layoutText } from '@/lib/pdf-text';
import { loadCairoBytes } from './font';
import type { TextBoxLayout, TextEngine, TextLayoutRequest } from './types';

/**
 * Lay out a text box exactly as export.ts will: direction 'auto' per
 * paragraph, the request's fallback for a box with no strong character,
 * start alignment per line.
 */
export function layoutTextBox(font: Font, text: string, request: TextLayoutRequest): TextBoxLayout {
  const layout = layoutText(font, text, {
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
  };
}

/** A preview engine over the given Cairo bytes (tests pass the file from public/fonts). */
export function createTextEngine(fontBytes: Uint8Array): TextEngine {
  const font = createLayoutFont(fontBytes);
  return {
    fontBytes,
    ascent: font.ascent / font.unitsPerEm,
    descent: -font.descent / font.unitsPerEm,
    layout: (text, request) => layoutTextBox(font, text, request),
  };
}

let engine: Promise<TextEngine> | null = null;

/** The session's engine: fetches Cairo once. A failed fetch is not cached, so the next call retries. */
export function loadTextEngine(): Promise<TextEngine> {
  if (!engine) {
    const attempt = loadCairoBytes().then(createTextEngine);
    engine = attempt;
    attempt.catch(() => {
      if (engine === attempt) engine = null;
    });
  }
  return engine;
}
