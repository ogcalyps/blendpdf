/**
 * The "BlendPDF vs X" pages (lib/comparisons): the other service's words
 * quoted exactly and translated where the page is in another language, every
 * page dated, no prices (they're geo-priced), every **label** a real UI label,
 * house style, the saved-file renders on disk, and every page in the sitemap
 * and reachable from the footer and /edit-pdf.
 */
import { describe, expect, it } from 'vitest';
import { badSpanish } from './helpers/spanish';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHROME } from '../lib/comparisons/chrome';
import { COMPARE_PATH, COMPARISONS, comparison } from '../lib/comparisons';
import sitemap from '../app/sitemap';

const ROOT = join(__dirname, '..');
const LOCALES = ['en', 'fr', 'ar', 'es'] as const;
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const catalog = (locale: string) => JSON.parse(read(`messages/${locale}.json`)) as Record<string, Record<string, unknown>>;

const strings = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
};
/** Everything a page in this language can show: its own text and the shared text. */
const texts = (locale: (typeof LOCALES)[number]) => [...COMPARISONS.flatMap((c) => strings(c.text[locale])), ...strings(CHROME[locale])];
const QUOTED = COMPARISONS.flatMap((c) => c.quotes.map((q) => q.text));

describe('comparison pages', () => {
  it('quote the other services exactly', () => {
    expect(comparison('sejda').quotes.map((q) => q.text)).toEqual([
      'Right to left scripts are not fully supported (eg: Arabic, Hebrew)',
      'Complex script alphabets are not supported (eg: Arabic, Devanagari)',
    ]);
    expect(comparison('ilovepdf').quotes[0].text).toBe('The Content Editor does not currently support Right-to-Left (RTL) languages.');
    expect(comparison('smallpdf').quotes[0].text).toBe('Direct PDF text editing requires a Pro subscription');
    // An English page that quotes them in its answers quotes them word for word
    for (const c of COMPARISONS.filter((c) => c.slug === 'sejda' || c.slug === 'ilovepdf')) {
      const answers = c.text.en.faq.map((f) => f.answer).join(' ');
      for (const q of c.quotes) expect(answers, c.slug).toContain(`“${q.text}`);
    }
  });

  it('translate a quote from a page where they said it in another language', () => {
    for (const c of COMPARISONS) {
      for (const locale of LOCALES) {
        const glosses = c.text[locale].quotes?.glosses ?? [];
        c.quotes.forEach((q, i) => {
          // Words from an editor's UI (no source) are explained in the text around them instead
          if (q.source && q.lang !== locale) expect(glosses[i], `${c.slug} ${locale} quote ${i}`).toBeTruthy();
        });
        expect(glosses.length, `${c.slug} ${locale}`).toBeLessThanOrEqual(c.quotes.length);
        if (c.quotes.length) expect(c.text[locale].quotes, `${c.slug} ${locale}`).toBeDefined();
      }
    }
  });

  it('date what they say about the other service, in every language', () => {
    for (const c of COMPARISONS) {
      for (const locale of LOCALES) {
        const t = c.text[locale];
        for (const s of [t.tested, t.table.note, t.disclaimer]) expect(s, `${c.slug} ${locale}`).toMatch(/12 (?:de )?\S+ (?:de )?2026/);
      }
    }
  });

  it('print no prices: theirs depend on the visitor’s country', () => {
    for (const locale of LOCALES) {
      expect(texts(locale).filter((s) => /[$€£]|\b(?:USD|EUR|GBP|DH|MAD)\b|dirham|درهم|دولار|يورو/i.test(s)), locale).toEqual([]);
    }
  });

  it('caption every saved-file render in every language, and show each at the size it declares', () => {
    for (const c of COMPARISONS) {
      for (const locale of LOCALES) {
        const captions = c.text[locale].evidence?.shots ?? {};
        expect(Object.keys(captions).sort(), `${c.slug} ${locale}`).toEqual(c.shots.map((s) => s.key).sort());
      }
      for (const image of c.shots.flatMap((s) => (s.phone ? [s, s.phone] : [s]))) {
        const webp = readFileSync(join(ROOT, 'public', image.src));
        expect(webp.toString('ascii', 12, 16), image.src).toBe('VP8 ');
        expect([webp.readUInt16LE(26) & 0x3fff, webp.readUInt16LE(28) & 0x3fff], image.src).toEqual([image.width, image.height]);
      }
    }
  });

  it('every **label** is one the site shows in that language', () => {
    for (const locale of LOCALES) {
      const ui = strings(catalog(locale));
      const labels = texts(locale).flatMap((s) => [...s.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]));
      expect(labels.length, locale).toBeGreaterThan(10);
      expect([...new Set(labels.filter((l) => !ui.includes(l)))], locale).toEqual([]);
    }
  });

  it('house style', () => {
    for (const locale of ['en', 'fr'] as const) expect(texts(locale).filter((s) => /[–—]/.test(s)), locale).toEqual([]);
    // French spacing, leaving out their words, which are quoted in English
    const french = (s: string) => QUOTED.reduce((rest, q) => rest.replace(q, ''), s.replace(/https?:\/\/\S+/g, ''));
    expect(texts('fr').filter((s) => /[^  ][;:!?»]|«[^  ]/.test(french(s)) || s.includes("'"))).toEqual([]);
    expect(texts('es').filter((s) => badSpanish(french(s)))).toEqual([]);
    const banned = ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—'];
    expect(texts('ar').filter((s) => banned.some((w) => s.includes(w)))).toEqual([]);
  });

  it('let readers repeat the test, and say how to report something out of date', () => {
    expect(readFileSync(join(ROOT, 'public/compare/arabic-test-page.pdf')).toString('latin1', 0, 5)).toBe('%PDF-');
    const page = read('components/compare/ComparisonPage.tsx');
    expect(page).toContain("const TEST_PAGE = '/compare/arabic-test-page.pdf'");
    expect(page).toContain("const CONTACT = 'contact@blendpdf.com'");
    expect(read('app/[locale]/compare/page.tsx')).toContain('<Correction locale={locale} />');
    for (const locale of LOCALES) {
      const { method, correction } = CHROME[locale];
      for (const kind of ['edit', 'add'] as const) expect(method.steps[kind], `${locale} ${kind}`).toHaveLength(4);
      expect(correction.before.trim() && correction.after.trim(), locale).toBeTruthy();
      expect(correction.after, locale).toMatch(/7/);
    }
    // Only a page we didn't test hands-on goes without the steps
    expect(COMPARISONS.filter((c) => c.checkable === false).map((c) => c.slug)).toEqual(['adobe-acrobat']);
  });

  it('own up to the editor’s limits in every language', () => {
    for (const locale of LOCALES) {
      expect(CHROME[locale].limits.items, locale).toHaveLength(3);
      expect(strings(CHROME[locale].limits).join(' '), locale).toContain('Noto Sans Arabic');
    }
  });

  it('are in the sitemap in every language, each URL with all four alternates', async () => {
    const entries = await sitemap();
    for (const path of [...COMPARISONS.map((c) => c.path), COMPARE_PATH]) {
      for (const prefix of ['', '/fr', '/ar', '/es']) {
        const entry = entries.find((e) => e.url === `https://blendpdf.com${prefix}${path}`);
        expect(entry, `${prefix}${path}`).toBeDefined();
        expect(Object.keys(entry!.alternates!.languages!).sort(), `${prefix}${path}`).toEqual(['ar', 'en', 'es', 'fr']);
      }
    }
  });

  it('every page has its route, and the hub is linked from /edit-pdf and the footer', () => {
    for (const c of COMPARISONS) expect(read(`app/[locale]${c.path}/page.tsx`), c.slug).toContain(`'${c.slug}'`);
    expect(read('app/[locale]/edit-pdf/page.tsx')).toContain(`t.rich('editPdf.guide.compare', rich('${COMPARE_PATH}'))`);
    expect(read('components/Footer.tsx')).toContain(`<Link href="${COMPARE_PATH}"`);
    for (const locale of LOCALES) {
      const messages = catalog(locale) as { editPdf: { guide: { compare: string } }; footer: { compare: string } };
      expect(messages.editPdf.guide.compare, locale).toMatch(/<link>.+<\/link>/);
      expect(messages.footer.compare, locale).toBeTruthy();
    }
  });
});
