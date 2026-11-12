/**
 * lib/extract-text on hand-made pdf.js text runs: what Chrome writes for
 * Arabic (one run per glyph, left to right as drawn, presentation forms) and
 * for ’ (U+02BC). pdf.js is a stub that hands the runs over as given.
 */
import { describe, expect, it, vi } from 'vitest';
import { extractText } from '../lib/extract-text';

type Run = { str: string; width: number; height: number; transform: number[]; dir: string; fontName: string; hasEOL: boolean };
const state = vi.hoisted(() => ({ runs: [] as unknown[] }));

vi.mock('@/lib/pdfjs-init', () => ({
  getPdfJs: async () => ({
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({ getTextContent: async () => ({ items: state.runs }) }),
        destroy: async () => undefined,
      }),
    }),
  }),
}));

const SIZE = 12;
/** Glyphs laid left to right from x, each `width` wide, a gap (in em) before each word after the first. */
function line(words: string[][], { x = 100, y = 700, width = 6, gap = 0.3 } = {}): Run[] {
  const runs: Run[] = [];
  words.forEach((glyphs, w) => {
    if (w > 0) x += gap * SIZE;
    for (const str of glyphs) {
      runs.push({ str, width, height: SIZE, transform: [SIZE, 0, 0, SIZE, x, y], dir: 'ltr', fontName: 'f', hasEOL: false });
      x += width;
    }
  });
  return runs;
}

async function text(runs: Run[]): Promise<string> {
  state.runs = runs;
  return extractText(new Uint8Array([1]), { pageSeparators: false });
}

describe('Arabic drawn glyph by glyph', () => {
  it('a word comes out right to left, in plain letters', async () => {
    // مبسطة as Chrome draws it: final teh marbuta on the left, initial meem on the right.
    expect(await text(line([['ﺔ', 'ﻄ', 'ﺴ', 'ﺒ', 'ﻣ']]))).toBe('مبسطة');
  });

  it('numbers keep their own order inside the sentence', async () => {
    // "رقم 4471" on the page: 4471 on the left, رقم on the right.
    expect(await text(line([['4', '4', '7', '1'], ['ﻢ', 'ﻗ', 'ر']]))).toBe('رقم 4471');
  });

  it('Latin words on an Arabic page stay readable, label by label', async () => {
    // The heading التحويل, then two labels side by side, "PDF إلى Word" on the
    // right and "PDF إلى صور" on the left, with a wide gap between them.
    const heading = line([['ﻞ', 'ﻴ', 'ﻮ', 'ﺤ', 'ﺘ', 'ﻟ', 'ا']], { y: 750 });
    const label = (left: string[], x: number) => line([left, ['ﻰ', 'ﻠ', 'إ'], ['P', 'D', 'F']], { x });
    const runs = [...heading, ...label(['ﺭ', 'ﻮ', 'ﺻ'], 100), ...label(['W', 'o', 'r', 'd'], 260)];
    expect(await text(runs)).toBe('التحويل\nPDF إلى Word PDF إلى صور');
  });

  it('ي drawn with a Persian glyph is still ي on an Arabic page, and stays ی on a Persian one', async () => {
    // ريال with Arial's shared yeh glyph (U+FBFF, Farsi yeh medial).
    const riyal = [['ﻞ', 'ﺎ', 'ﯿ', 'ﺭ']];
    expect(await text(line(riyal))).toBe('ريال');
    // Same word next to پ (Persian only): the page reads as Persian.
    expect(await text([...line(riyal), ...line([['پ']], { y: 650 })])).toBe('ریال\nپ');
  });
});

describe('apostrophes', () => {
  it('’ that Chrome mapped to U+02BC comes back as ’', async () => {
    expect(await text(line([['Lʼarabe']], { width: 30 }))).toBe('L’arabe');
  });
});
