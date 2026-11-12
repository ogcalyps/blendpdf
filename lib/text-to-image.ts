/**
 * Render text to a transparent PNG via a canvas — browser-only.
 *
 * Why: pdf-lib's StandardFonts are WinAnsi-encoded and cannot draw Arabic,
 * CJK, or emoji. Embedding a Unicode font wouldn't help either, because
 * pdf-lib does no bidi/shaping — Arabic would come out as disconnected,
 * left-to-right letters. The browser's canvas text renderer, on the other
 * hand, shapes and orders complex scripts natively. So for non-WinAnsi text
 * we rasterize it here and stamp the PNG into the PDF as an image.
 *
 * Sizing contract: `fontSizePx` is the LITERAL canvas pixel size of the
 * glyphs — there is no hidden devicePixelRatio or retina multiplier, because
 * pdf-lib sizes embedded images by their intrinsic pixel dimensions, so any
 * hidden upscale would change the stamped size on the page. Callers pick the
 * final visual size themselves: render at >= 2x the target PDF point size
 * (then draw scaled down) so the stamp stays crisp.
 */

export interface TextImageResult {
  /** PNG bytes, transparent background. */
  bytes: ArrayBuffer;
  /** Intrinsic PNG pixel width (what pdf-lib will see). */
  width: number;
  /** Intrinsic PNG pixel height (what pdf-lib will see). */
  height: number;
}

export interface RenderTextToImageOptions {
  /** Canvas pixel size of the glyphs — see sizing contract above. */
  fontSizePx: number;
  /** CSS color; defaults to a dark gray. */
  color?: string;
  /** CSS font-family stack; defaults to the site's Arabic-capable stack. */
  fontFamily?: string;
  /** Canvas text direction; 'auto' lets the browser infer from the text. */
  direction?: 'rtl' | 'ltr' | 'auto';
}

/** Hard cap — watermark/signature strings, not documents. */
export const MAX_TEXT_IMAGE_CHARS = 200;

const DEFAULT_COLOR = '#333333';
// Cairo is already loaded by the site's Arabic UI; the rest are fallbacks
// for browsers/locales where it isn't available.
const DEFAULT_FONT_FAMILY = "Cairo, 'Noto Naskh Arabic', 'Geeza Pro', sans-serif";

export async function renderTextToImage(
  text: string,
  opts: RenderTextToImageOptions
): Promise<TextImageResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Cannot render empty text');
  }
  if (trimmed.length > MAX_TEXT_IMAGE_CHARS) {
    throw new Error(`Text is too long to render (max ${MAX_TEXT_IMAGE_CHARS} characters)`);
  }
  if (typeof document === 'undefined') {
    throw new Error('renderTextToImage is browser-only');
  }

  const fontSizePx = Math.max(1, Math.round(opts.fontSizePx));
  const color = opts.color ?? DEFAULT_COLOR;
  const fontFamily = opts.fontFamily ?? DEFAULT_FONT_FAMILY;
  const font = `${fontSizePx}px ${fontFamily}`;

  // Make sure webfonts (Cairo) are actually loaded before measuring —
  // otherwise we'd measure with a fallback font and draw with another.
  if (typeof document.fonts?.load === 'function') {
    try {
      await document.fonts.load(font, trimmed);
    } catch {
      // Font loading is best-effort; fallback fonts still shape correctly.
    }
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D is not supported in this browser');
  }

  // Canvas has no 'auto' direction ('ltr' | 'rtl' | 'inherit'), and 'inherit'
  // on a detached canvas depends on the document — so resolve 'auto' ourselves
  // from the text content (Hebrew, Arabic + presentation forms ranges).
  const direction: CanvasDirection =
    (opts.direction ?? 'auto') === 'auto'
      ? /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(trimmed)
        ? 'rtl'
        : 'ltr'
      : (opts.direction as CanvasDirection);

  const applyTextStyle = (c: CanvasRenderingContext2D) => {
    c.font = font;
    // ctx.direction is not implemented everywhere (e.g. older Firefox).
    try {
      c.direction = direction;
    } catch {
      /* keep browser default */
    }
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
  };

  applyTextStyle(ctx);
  const metrics = ctx.measureText(trimmed);

  // actualBoundingBox* give the real ink extents (Arabic descenders/marks
  // routinely exceed the em box). Fall back to generous em-based estimates
  // where the metrics are unsupported.
  const ascent =
    typeof metrics.actualBoundingBoxAscent === 'number' && metrics.actualBoundingBoxAscent > 0
      ? metrics.actualBoundingBoxAscent
      : fontSizePx;
  const descent =
    typeof metrics.actualBoundingBoxDescent === 'number' && metrics.actualBoundingBoxDescent >= 0
      ? metrics.actualBoundingBoxDescent
      : fontSizePx * 0.4;
  const left =
    typeof metrics.actualBoundingBoxLeft === 'number' ? Math.max(0, metrics.actualBoundingBoxLeft) : 0;
  const right =
    typeof metrics.actualBoundingBoxRight === 'number' && metrics.actualBoundingBoxRight > 0
      ? metrics.actualBoundingBoxRight
      : metrics.width;
  const inkWidth = Math.max(left + right, metrics.width, 1);

  // Small padding so anti-aliased edges aren't clipped. Kept proportional and
  // tiny because canvas dimensions directly become the stamped image size.
  const pad = Math.ceil(fontSizePx * 0.08) + 2;

  canvas.width = Math.ceil(inkWidth + pad * 2);
  canvas.height = Math.ceil(ascent + descent + pad * 2);

  // Resizing the canvas resets the context state — re-apply everything.
  applyTextStyle(ctx);
  ctx.fillStyle = color;
  // Transparent background: simply don't paint one.
  ctx.fillText(trimmed, pad + left, pad + ascent);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to export text image'));
    }, 'image/png');
  });

  return {
    bytes: await blob.arrayBuffer(),
    width: canvas.width,
    height: canvas.height,
  };
}

// ── Multi-line text block (the /edit-pdf fallback) ──────────────────────────

export interface TextBlockImageOptions {
  /** Any length; "\n" separates paragraphs. */
  text: string;
  /** Font size in PDF points. */
  size: number;
  /** Wrap width in PDF points (the image is exactly this wide). */
  width: number;
  /** CSS colour. */
  color: string;
  /** Direction of a block with no strong character at all (the UI locale's). */
  fallbackDirection: 'ltr' | 'rtl';
  /** Canvas pixels per PDF point. Draw the PNG at width x (height / scale) points. */
  scale: number;
  /** CSS font-family stack; defaults to the site's Arabic-capable stack. */
  fontFamily?: string;
  /** Line pitch as a multiple of `size`. Default 1.6, like lib/pdf-text. */
  lineHeight?: number;
}

/** Grapheme clusters, so an over-long word never splits a letter from its marks. */
function graphemes(text: string): string[] {
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].map((s) => s.segment);
  }
  return [...text];
}

/** Greedy wrap on spaces with the canvas's own measurements; a word wider than the line is cut between graphemes. */
function wrapParagraph(ctx: CanvasRenderingContext2D, paragraph: string, maxWidth: number): string[] {
  const words = paragraph.split(' ');
  const lines: string[] = [];
  let line = '';
  const push = (word: string) => {
    if (ctx.measureText(word).width <= maxWidth) return word;
    let piece = '';
    for (const g of graphemes(word)) {
      if (piece && ctx.measureText(piece + g).width > maxWidth) {
        lines.push(piece);
        piece = g;
      } else {
        piece += g;
      }
    }
    return piece;
  };
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = line ? candidate : push(word);
    } else {
      lines.push(line);
      line = push(word);
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Render a text box to a transparent PNG exactly `width` points wide, for a
 * box whose characters the vector font lacks (emoji, CJK). Each paragraph
 * takes its own direction like a textarea with dir="auto" (the same rule as
 * lib/pdf-text) and aligns to its start. No length cap. Browser only.
 */
export async function renderTextBlockToImage(options: TextBlockImageOptions): Promise<TextImageResult> {
  if (typeof document === 'undefined') throw new Error('renderTextBlockToImage is browser-only');
  const { text, size, width, color, fallbackDirection, scale } = options;
  if (!(size > 0) || !(width > 0) || !(scale > 0)) throw new RangeError('size, width and scale must be positive');
  // bidi-js is loaded on demand: this file is imported statically by pages that never need it.
  const { resolveParagraphDirections } = await import('./pdf-text/bidi');

  const fontPx = size * scale;
  const font = `${fontPx}px ${options.fontFamily ?? DEFAULT_FONT_FAMILY}`;
  const pitch = (options.lineHeight ?? 1.6) * fontPx;
  if (typeof document.fonts?.load === 'function') {
    try {
      await document.fonts.load(font, text);
    } catch {
      // Best effort: fallback fonts still draw.
    }
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  const pixelWidth = Math.max(1, Math.ceil(width * scale));
  const style = (c: CanvasRenderingContext2D, direction: 'ltr' | 'rtl') => {
    c.font = font;
    try {
      c.direction = direction;
    } catch {
      /* keep the browser default */
    }
    c.textBaseline = 'alphabetic';
    c.textAlign = direction === 'rtl' ? 'right' : 'left';
    c.fillStyle = color;
  };

  const paragraphs = text.replace(/\r\n|[\r\u2028\u2029]/g, '\n').replace(/\t/g, ' ').split('\n');
  const directions = resolveParagraphDirections(paragraphs, 'auto', fallbackDirection);
  const lines: Array<{ text: string; direction: 'ltr' | 'rtl' }> = [];
  paragraphs.forEach((paragraph, i) => {
    style(ctx, directions[i]);
    for (const line of wrapParagraph(ctx, paragraph, pixelWidth)) lines.push({ text: line, direction: directions[i] });
  });

  canvas.width = pixelWidth;
  canvas.height = Math.max(1, Math.ceil(lines.length * pitch));
  // Same half-leading model as lib/pdf-text: the em box centred in each line.
  style(ctx, 'ltr');
  const m = ctx.measureText('Hg');
  const ascent = m.fontBoundingBoxAscent > 0 ? m.fontBoundingBoxAscent : fontPx * 0.8;
  const descent = m.fontBoundingBoxDescent > 0 ? m.fontBoundingBoxDescent : fontPx * 0.2;
  const baseline = (pitch - (ascent + descent)) / 2 + ascent;
  lines.forEach((line, i) => {
    style(ctx, line.direction);
    ctx.fillText(line.text, line.direction === 'rtl' ? pixelWidth : 0, i * pitch + baseline);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Failed to export text image'))), 'image/png');
  });
  return { bytes: await blob.arrayBuffer(), width: canvas.width, height: canvas.height };
}
