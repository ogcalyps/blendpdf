import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The pages ChatGPT and Google send people to open with the answer: the line
 * under the H1 says how to do the task, that it's free, and its limits, so an
 * assistant quoting the page quotes something true and complete. The steps
 * heading and the HowTo schema name the task the way people search for it.
 */
const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const PAGES: Record<string, string> = {
  'edit-pdf': 'editPdf',
  'pdf-to-word': 'pdfToWord',
  'compress-pdf': 'compressPdf',
  'merge-pdf': 'mergePdf',
  'extract-images': 'extractImages',
  'protect-pdf': 'protectPdf',
  'extract-pages': 'extractPages',
  'repair-pdf': 'repairPdf',
  'powerpoint-to-pdf': 'powerpointToPdf',
  'crop-pdf': 'cropPdf',
  'remove-metadata': 'removeMetadata',
  'flatten-pdf': 'flattenPdf',
};

// About five lines on a phone: longer and the tool slides below the fold.
const MAX_ANSWER = 240;

const messages = Object.fromEntries(
  ['en', 'fr', 'ar'].map((locale) => [locale, JSON.parse(read(`messages/${locale}.json`)) as Record<string, Record<string, unknown>>]),
);

describe('tool pages answer first', () => {
  it.each(Object.entries(PAGES))('%s shows its answer right under the H1', (slug, ns) => {
    const src = read(`app/[locale]/${slug}/page.tsx`);
    expect(src).toMatch(new RegExp(`\\{t\\('${ns}\\.title'\\)\\}\\s*</h1>\\s*<p\\b[^>]*>\\s*\\{t\\('${ns}\\.answer'\\)\\}`));
  });

  it.each(Object.entries(PAGES))('%s names the task in its steps heading and HowTo schema', (slug, ns) => {
    const src = read(`app/[locale]/${slug}/page.tsx`);
    expect(src).toMatch(new RegExp(`<HowToSchema\\s+name=\\{t\\('${ns}\\.howToTitle'\\)\\}`));
    expect(src.split(`{t('${ns}.howToTitle')}`).length - 1, 'schema + visible heading').toBe(2);
  });

  it.each(Object.entries(PAGES))('%s has a short answer and a task heading in every language', (_slug, ns) => {
    for (const [locale, tree] of Object.entries(messages)) {
      const { answer, howToTitle } = tree[ns] as { answer?: unknown; howToTitle?: unknown };
      expect(typeof answer, `${locale} ${ns}.answer`).toBe('string');
      expect(typeof howToTitle, `${locale} ${ns}.howToTitle`).toBe('string');
      expect((answer as string).length, `${locale} ${ns}.answer`).toBeLessThanOrEqual(MAX_ANSWER);
    }
  });
});
