/**
 * The editor's text preview engine must describe exactly what the export
 * writes: same line breaks, same widths, each line at the same x inside the
 * box, same baselines. The PDF side is read back with pdf.js 3.11
 * (tests/helpers/pdf-glyph-oracle), the preview side is what
 * createTextEngine().layout() hands the UI.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createCanvas, loadImage } from 'canvas';
import { renderTextBlockToImage } from '../lib/text-to-image';
import { createLayoutFont, drawTextBox, embedTextFont, layoutText, uprightTransform } from '../lib/pdf-text';
import { CAIRO_FONT_URL, DEFAULT_LINE_HEIGHT } from '../lib/pdf-text/constants';
import { createTextEngine } from '../lib/edit-pdf/text-engine';
import { readPdf } from './helpers/pdf-glyph-oracle';

const FONT_BYTES = new Uint8Array(readFileSync(join(__dirname, '..', 'public', 'fonts', 'Cairo-Regular.ttf')));
const MARGIN = 36;
const PAGE = [595, 400] as const;

const CASES = [
  { name: 'Arabic', text: 'يرجى تعبئة هذا النموذج بالكامل وإرساله إلى قسم الموارد البشرية قبل نهاية الأسبوع', size: 14, width: 220, fallbackDirection: 'ltr' as const },
  { name: 'English', text: 'Please sign here and add the date at the end of the page, thank you.', size: 12, width: 200, fallbackDirection: 'ltr' as const },
  {
    name: 'mixed',
    text: 'الاسم: محمد (Mohammed) 2026\nInvoice INV-2026 رقم ١٥\n15/03/2026',
    size: 16,
    width: 260,
    fallbackDirection: 'rtl' as const,
  },
];

describe('edit-pdf text engine: the preview layout is the PDF layout', () => {
  const engine = createTextEngine(FONT_BYTES);

  it('exposes the Cairo metrics for the FontFace overrides, and they give the PDF baseline under CSS half-leading', () => {
    expect(engine.fontBytes).toBe(FONT_BYTES);
    expect(engine.ascent).toBeGreaterThan(0.5);
    expect(engine.descent).toBeGreaterThan(0.1);
    // CSS: a line box of line-height L holds the content area (ascent + descent) * size centred, the baseline `ascent * size` below its top.
    for (const size of [8, 14, 72]) {
      const lineHeight = DEFAULT_LINE_HEIGHT * size;
      const cssBaseline = (lineHeight - (engine.ascent + engine.descent) * size) / 2 + engine.ascent * size;
      expect(cssBaseline).toBeCloseTo(drawnBaseline(size), 9);
    }
  });

  it.each(CASES)('$name box: every line has the same text, width, x and baseline in the PDF', async (c) => {
    const preview = engine.layout(c.text, { size: c.size, width: c.width, fallbackDirection: c.fallbackDirection });

    const doc = await PDFDocument.create();
    const font = await embedTextFont(doc, FONT_BYTES);
    const page = doc.addPage([...PAGE]);
    const drawn = drawTextBox(page, font, c.text, {
      size: c.size,
      width: c.width,
      direction: 'auto',
      fallbackDirection: c.fallbackDirection,
      transform: uprightTransform(MARGIN, PAGE[1] - MARGIN),
    });
    const [read] = await readPdf(await doc.save());

    expect(preview.lines.length).toBeGreaterThan(1);
    expect(preview.missing).toEqual([]);
    expect(preview.lineHeight).toBeCloseTo(drawn.lineHeight, 9);
    expect(preview.height).toBeCloseTo(drawn.lines.length * drawn.lineHeight, 9);
    expect(preview.lines.map((l) => [l.text, l.direction])).toEqual(drawn.lines.map((l) => [l.text, l.direction]));

    preview.lines.forEach((line, i) => {
      const truth = drawn.lines[i];
      expect(line.width).toBeCloseTo(truth.width, 9);
      expect(line.width).toBeLessThanOrEqual(c.width + 0.01);
      // The glyphs pdf.js reads on this line: baseline i lines down, the first one at the line's x.
      const baseline = MARGIN + i * drawn.lineHeight + drawn.baseline;
      const onLine = read.glyphs.filter((g) => Math.abs(g.y - baseline) < drawn.lineHeight / 2);
      expect(onLine.length).toBeGreaterThan(0);
      const first = onLine.reduce((a, b) => (b.x < a.x ? b : a));
      expect(first.x - MARGIN - truth.glyphs[0].x).toBeCloseTo(line.x, 6);
      // Baseline: the first glyph's y minus its own GPOS offset (y down in the oracle, up in the layout).
      expect(first.y + truth.glyphs[0].y).toBeCloseTo(baseline, 6);
      if (line.direction === 'rtl') expect(line.x + line.width).toBeCloseTo(c.width, 9);
      else expect(line.x).toBe(0);
    });
  });

  it('a mixed box gives each paragraph its own direction; a box with no letters takes the fallback', () => {
    const lines = engine.layout('مرحبا\nHello\n2026', { size: 14, width: 200, fallbackDirection: 'ltr' }).lines;
    expect(lines.map((l) => l.direction)).toEqual(['rtl', 'ltr', 'ltr']);
    expect(engine.layout('12/10/2026', { size: 14, width: 200, fallbackDirection: 'rtl' }).lines[0].direction).toBe('rtl');
    expect(engine.layout('12/10/2026', { size: 14, width: 200, fallbackDirection: 'ltr' }).lines[0].direction).toBe('ltr');
  });

  it('lists characters Cairo lacks, so the UI can show the picture note', () => {
    expect(engine.layout('Done 😀', { size: 14, width: 200, fallbackDirection: 'ltr' }).missing).toEqual(['😀']);
  });
});

/** The baseline lib/pdf-text puts in every PDF line box, computed without the engine under test. */
function drawnBaseline(size: number): number {
  return layoutText(createLayoutFont(FONT_BYTES), 'a', { size }).baseline;
}

describe('edit-pdf text engine: loading', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('fetches Cairo once, and a failed fetch is retried on the next call', async () => {
    const calls: string[] = [];
    let fail = true;
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      if (fail) return new Response('nope', { status: 503 });
      return new Response(FONT_BYTES.slice());
    });
    const { loadTextEngine } = await import('../lib/edit-pdf');
    await expect(loadTextEngine()).rejects.toThrow(/503/);
    fail = false;
    const [a, b] = await Promise.all([loadTextEngine(), loadTextEngine()]);
    expect(a).toBe(b);
    expect(await loadTextEngine()).toBe(a);
    expect(calls).toEqual([CAIRO_FONT_URL, CAIRO_FONT_URL]);
    expect(a.layout('مرحبا', { size: 12, width: 100, fallbackDirection: 'ltr' }).lines[0].direction).toBe('rtl');
  });
});

/**
 * The picture fallback for boxes with characters Cairo lacks. Browser-only;
 * node-canvas stands in for the canvas (no FontFace, so it draws with a
 * system font, which is enough to check size, wrapping and alignment).
 */
describe('renderTextBlockToImage', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubCanvas() {
    vi.stubGlobal('document', {
      createElement: () => {
        const canvas = createCanvas(1, 1);
        return Object.assign(canvas, {
          toBlob: (callback: (blob: Blob) => void) => callback(new Blob([new Uint8Array(canvas.toBuffer('image/png'))], { type: 'image/png' })),
        });
      },
    });
  }

  /** Leftmost and rightmost inked column in each band of `pitch` pixel rows. */
  async function inkPerLine(bytes: ArrayBuffer, pitch: number): Promise<Array<[number, number] | null>> {
    const image = await loadImage(Buffer.from(bytes));
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);
    const lines = Math.round(image.height / pitch);
    return Array.from({ length: lines }, (_, line) => {
      let min = Infinity;
      let max = -Infinity;
      for (let y = Math.round(line * pitch); y < Math.min(image.height, Math.round((line + 1) * pitch)); y++) {
        for (let x = 0; x < image.width; x++) {
          if (data[(y * image.width + x) * 4 + 3] > 64) {
            min = Math.min(min, x);
            max = Math.max(max, x);
          }
        }
      }
      return min === Infinity ? null : [min, max];
    });
  }

  it('is exactly the box wide at the scale, one line pitch per line, each paragraph at its own start edge', async () => {
    stubCanvas();
    const result = await renderTextBlockToImage({ text: 'Hi there\nمرحبا بكم', size: 10, width: 100, color: '#000000', fallbackDirection: 'ltr', scale: 3, fontFamily: 'sans-serif' });
    const pitch = 1.6 * 10 * 3;
    expect([result.width, result.height]).toEqual([300, Math.ceil(2 * pitch)]);
    const [latin, arabic] = await inkPerLine(result.bytes, pitch);
    expect(latin![0]).toBeLessThan(15); // starts at the left edge
    expect(latin![1]).toBeLessThan(200);
    expect(arabic![1]).toBeGreaterThan(285); // ends at the right edge
    expect(arabic![0]).toBeGreaterThan(100);
  });

  it('wraps by words at the box width, and a block with no letters follows the fallback direction', async () => {
    stubCanvas();
    const words = 'one two three four five six seven eight nine ten';
    const wrapped = await renderTextBlockToImage({ text: words, size: 12, width: 80, color: '#1D4ED8', fallbackDirection: 'ltr', scale: 2, fontFamily: 'sans-serif' });
    const pitch = 1.6 * 12 * 2;
    const lines = await inkPerLine(wrapped.bytes, pitch);
    expect(lines.length).toBeGreaterThan(2);
    for (const ink of lines) expect(ink![1]).toBeLessThan(160);

    const digits = await renderTextBlockToImage({ text: '2026/10/14', size: 12, width: 150, color: '#000000', fallbackDirection: 'rtl', scale: 2, fontFamily: 'sans-serif' });
    const [ink] = await inkPerLine(digits.bytes, pitch);
    expect(ink![1]).toBeGreaterThan(285);
    expect(ink![0]).toBeGreaterThan(60);
  });

  it('refuses to run without a browser', async () => {
    await expect(renderTextBlockToImage({ text: 'x', size: 10, width: 50, color: '#000000', fallbackDirection: 'ltr', scale: 3 })).rejects.toThrow(/browser-only/);
  });
});
