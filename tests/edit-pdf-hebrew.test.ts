/**
 * Hebrew in the editor. Cairo, the font of new text, has no Hebrew, and
 * neither do Noto Sans Arabic, Carlito or Caladea; the Liberation families
 * do. So a new Hebrew box used to be saved as a picture, and an edited
 * Hebrew line was drawn in a stack whose first font (Noto Sans Arabic) gave
 * the spaces while Liberation gave the letters: pdf.js starts a new text
 * item at every font change and read the words back in visual order.
 *
 * Fixtures: a letter printed by Chrome in Times New Roman and a quote saved
 * by LibreOffice in Arial (blendpdf-evidence/hebrew-2026-11, made like the
 * Arabic test set). Read back with pdf.js, which ignores ActualText and is
 * what Firefox searches with, and with the editor's own line detection.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createLayoutFont, layoutText } from '../lib/pdf-text';
import { exportEditedPdf } from '../lib/edit-pdf';
import type { EditorObject, EditorPage, ExportOptions } from '../lib/edit-pdf';
import { releaseLineFonts } from '../lib/edit-pdf/keep-font/analyze';
import { lookalikeStack, planReplacement } from '../lib/edit-pdf/keep-font/choose';
import type { LineFontData } from '../lib/edit-pdf/keep-font/types';
import { createTextEngine } from '../lib/edit-pdf/text-engine';
import { analyzeFile, anyFixture, loadPublicFont, replaceWithFont } from './helpers/keep-font';
import { CAIRO, PDFIUM_WASM, detectPage, linesOn, pdfjs, squash } from './helpers/replace-fixtures';

const font = (name: string) => new Uint8Array(readFileSync(join(__dirname, '..', 'public', 'fonts', name)));
const LIBERATION_SANS = font('LiberationSans-Regular.ttf');
const NOTO_SANS_ARABIC = font('NotoSansArabic-Regular.ttf');

const noRaster = async (): Promise<never> => {
  throw new Error('Hebrew should be saved as text, not as a picture');
};
const OPTIONS: ExportOptions = { fontBytes: CAIRO, pdfiumWasm: PDFIUM_WASM, loadFont: loadPublicFont, rasterizeText: noRaster };
const pagesOf = (count: number): EditorPage[] => Array.from({ length: count }, (_, i) => ({ id: `s${i}`, source: { kind: 'source', index: i }, rotation: 0 }));
const request = (count: number, objects: EditorObject[]) => ({ pages: pagesOf(count), objects, assets: {}, fallbackDirection: 'rtl' as const });

afterAll(() => releaseLineFonts());

/** pdf.js's text, one string per line as it reports them (hasEOL), in its reading order. */
async function pdfjsLines(bytes: Uint8Array): Promise<string[]> {
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  try {
    const page = await (await task.promise).getPage(1);
    const { items } = await page.getTextContent();
    return (items as Array<{ str: string; hasEOL: boolean }>)
      .map((i) => i.str + (i.hasEOL ? '\n' : ''))
      .join('')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } finally {
    await task.destroy();
  }
}

describe('Hebrew: font choice', () => {
  it('a Hebrew line laid out in a stack comes from one font, spaces included', () => {
    const fonts = [createLayoutFont(NOTO_SANS_ARABIC), createLayoutFont(LIBERATION_SANS)];
    const layout = layoutText(fonts, 'לכבוד הגברת רחל כהן', { size: 14, direction: 'auto' });
    expect(layout.missing).toEqual([]);
    expect(new Set(layout.lines[0].glyphs.map((g) => g.font))).toEqual(new Set([1]));
  });

  it.each([
    ['Carlito', 'Liberation Sans'],
    ['Caladea', 'Liberation Serif'],
    ['Liberation Mono', 'Liberation Mono'],
  ] as const)('an edited Hebrew line in a %s document leads with %s, which has Hebrew', (latin, expected) => {
    const data = { lookalike: { latin, arabic: 'Noto Sans Arabic', bold: false, italic: false, sameFamily: { latin: false, arabic: false } } } as unknown as LineFontData;
    expect(lookalikeStack(data, 'לכבוד הגברת רחל כהן', 'rtl')[0]).toBe(expected);
    expect(lookalikeStack(data, 'שלום مرحبا', 'rtl')).toContain('Noto Sans Arabic');
    expect(lookalikeStack(data, 'السيد يوسف', 'rtl')[0]).toBe('Noto Sans Arabic');
  });

  it('new text: Cairo when it has every letter, else Liberation Sans alone, else both', () => {
    const cairoOnly = createTextEngine(CAIRO);
    const withFallback = createTextEngine(CAIRO, LIBERATION_SANS);
    const req = { size: 14, width: 400, fallbackDirection: 'rtl' as const };
    const hebrew = 'שולם באמצעות PayPal ב-14 בנובמבר';
    expect(cairoOnly.layout(hebrew, req)).toMatchObject({ fonts: 'cairo' });
    expect(cairoOnly.layout(hebrew, req).missing.length).toBeGreaterThan(0);
    expect(withFallback.layout(hebrew, req)).toMatchObject({ fonts: 'fallback', missing: [] });
    expect(withFallback.layout('שַׁבָּת שָׁלוֹם', req)).toMatchObject({ fonts: 'fallback', missing: [] });
    expect(withFallback.layout('مرحبا שלום', req)).toMatchObject({ fonts: 'both', missing: [] });
    expect(withFallback.layout('السيد يوسف الإدريسي', req)).toMatchObject({ fonts: 'cairo', missing: [] });
  });
});

describe('Hebrew: export', () => {
  it('a new Hebrew box is saved as text and pdf.js reads it in order', async () => {
    const source = anyFixture('hebrew-chrome-times.pdf');
    const text = 'שולם באמצעות PayPal ב-14 בנובמבר';
    const object: EditorObject = { id: 'o1', pageId: 's0', kind: 'text', box: { xPct: 0.2, yPct: 0.6, wPct: 0.6, hPct: 0.05 }, text, size: 14, color: '#000000' };
    const fetched: string[] = [];
    const result = await exportEditedPdf(source, request(1, [object]), {
      ...OPTIONS,
      loadFont: (url) => {
        fetched.push(url);
        return loadPublicFont(url);
      },
    });
    expect(result.warnings.filter((w) => w.code === 'TEXT_AS_IMAGE')).toEqual([]);
    expect(fetched).toContain('/fonts/LiberationSans-Regular.ttf');
    expect(await pdfjsLines(result.bytes)).toContain(text);
  });

  it.each([
    ['hebrew-chrome-times.pdf', 'לכבוד מר דוד לוי', 'לכבוד הגברת רחל כהן', '/fonts/LiberationSerif-Regular.ttf'],
    ['hebrew-libreoffice-arial.pdf', 'עיצוב אתר על WordPress', 'חנות מקוונת על Shopify למשך 12 חודשים', '/fonts/LiberationSans-Regular.ttf'],
  ])('%s: an edited line is drawn in one Liberation font and reads back', async (name, from, to, family) => {
    const source = anyFixture(name);
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font: lineFont } = lines.find((l) => squash(l.line.text) === squash(from))!;
    const object = replaceWithFont(line, lineFont, to);
    const plan = await planReplacement(object, to, { loadFont: loadPublicFont });
    expect(plan).toMatchObject({ kind: 'vector', fonts: [family] });

    const result = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS);
    expect(result.warnings.filter((w) => w.code === 'TEXT_AS_IMAGE')).toEqual([]);
    const [now] = linesOn((await detectPage(result.bytes)).lines, line);
    expect(squash(now.text)).toBe(squash(to));
  });

  it('pdf.js reads an edited Hebrew line in reading order, not word-reversed', async () => {
    const source = anyFixture('hebrew-chrome-times.pdf');
    const { lines, pageCount } = await analyzeFile(source);
    const { line, font: lineFont } = lines.find((l) => l.line.text.includes('דוד'))!;
    const to = 'לכבוד הגברת רחל כהן';
    const result = await exportEditedPdf(source, request(pageCount, [replaceWithFont(line, lineFont, to)]), OPTIONS);
    const read = await pdfjsLines(result.bytes);
    expect(read).toContain(to);
    expect(read).not.toContain('כהן רחל הגברת לכבוד');
  });
});
