/**
 * The size pages (/compress-pdf/to-<n>, lib/size-limits): every size in every
 * language, limits the compress route takes, every **label** one the site
 * shows, house style, and every page in the sitemap.
 */
import { describe, expect, it } from 'vitest';
import { badSpanish } from './helpers/spanish';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PORTALS, SIZE_TARGETS, portalTarget, portalText, sizeChrome, sizePageText, type PortalTarget, type SizeTarget } from '../lib/size-limits';
import { validLimitMb } from '../lib/workspace/summary';
import sitemap from '../app/sitemap';

const ROOT = join(__dirname, '..');
const LOCALES = ['en', 'fr', 'ar', 'es'] as const;

/** Every text a size page shows. */
function texts(locale: string, t: SizeTarget): string[] {
  const page = sizePageText(locale, t.slug);
  const c = sizeChrome(locale);
  return [
    page.title,
    page.metaTitle,
    page.description,
    page.whoAsks,
    c.summary(t),
    c.fitsTitle,
    c.fits(t),
    c.tooBigTitle,
    ...c.tooBig.flatMap((tip) => [tip.title, tip.text, tip.link?.text ?? '']),
    ...c.faq(t).flatMap((q) => [q.question, q.answer]),
    c.otherSizes,
    c.guide,
    c.allLimits,
  ].filter(Boolean);
}

function uiStrings(locale: string): string[] {
  const out: string[] = [];
  const walk = (o: unknown) => {
    if (typeof o === 'string') out.push(o);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8')));
  return out;
}

describe('size pages', () => {
  it('open with a limit the compress route takes, smallest first', () => {
    for (const t of SIZE_TARGETS) expect(validLimitMb(t.limitMb), t.slug).toBe(true);
    const limits = SIZE_TARGETS.map((t) => t.limitMb);
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
  });

  it('exist in every language and name their size in the heading', () => {
    for (const locale of LOCALES) {
      for (const t of SIZE_TARGETS) {
        const page = sizePageText(locale, t.slug);
        expect(page.title, `${locale} ${t.slug}`).toContain(sizeChrome(locale).label(t));
        expect(texts(locale, t).every((s) => s.trim().length > 0)).toBe(true);
      }
    }
  });

  it('render on request: dynamicParams = false with target-only params 404s every page in production', () => {
    const page = readFileSync(join(ROOT, 'app/[locale]/compress-pdf/[target]/page.tsx'), 'utf8');
    expect(page).not.toMatch(/export const dynamicParams\s*=\s*false/);
    expect(page).toMatch(/notFound\(\)/);
  });

  it('every **label** is one the site shows in that language', () => {
    for (const locale of LOCALES) {
      const ui = uiStrings(locale);
      const missing = SIZE_TARGETS.flatMap((t) =>
        texts(locale, t)
          .flatMap((s) => [...s.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]))
          .filter((label) => !ui.includes(label)),
      );
      expect(missing, locale).toEqual([]);
    }
  });

  it('house style: no dashes in English and French, French spacing, no banned Arabic words', () => {
    const all = (locale: string) => SIZE_TARGETS.flatMap((t) => texts(locale, t));
    for (const locale of ['en', 'fr']) expect(all(locale).filter((s) => /[–—]/.test(s)), locale).toEqual([]);
    const badFrench = all('fr').filter((s) => /[^\u00a0\u202f][;:!?»]|«[^\u00a0\u202f]/.test(s) || s.includes("'"));
    expect(badFrench).toEqual([]);
    expect(all('es').filter(badSpanish)).toEqual([]);
    const banned = ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—'];
    expect(all('ar').filter((s) => banned.some((w) => s.includes(w)))).toEqual([]);
  });

  it('are in the sitemap in every language', async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    for (const t of SIZE_TARGETS) {
      expect(urls.has(`https://blendpdf.com/compress-pdf/${t.slug}`), t.slug).toBe(true);
      expect(urls.has(`https://blendpdf.com/fr/compress-pdf/${t.slug}`), t.slug).toBe(true);
      expect(urls.has(`https://blendpdf.com/ar/compress-pdf/${t.slug}`), t.slug).toBe(true);
      expect(urls.has(`https://blendpdf.com/es/compress-pdf/${t.slug}`), t.slug).toBe(true);
    }
  });

  describe('pages for one site (/compress-pdf/for-<site>)', () => {
    /** Every text a site's page shows on top of the size page's. */
    const portalTexts = (locale: string, p: PortalTarget) => {
      const t = portalText(locale, p.slug);
      const c = sizeChrome(locale);
      return [t.title, t.metaTitle, t.description, t.whoAsks, t.name, t.short, ...t.rules, t.sourceName, t.link?.text ?? '', c.rulesTitle(t.name), c.source(t.sourceName, p.checked), c.otherSites].filter(Boolean);
    };

    it('have a sourced limit the route takes, and text in exactly their languages', () => {
      for (const p of PORTALS) {
        expect(validLimitMb(p.limitMb), p.slug).toBe(true);
        expect(p.sourceUrl, p.slug).toMatch(/^https:\/\//);
        expect(p.checked, p.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        for (const locale of LOCALES) {
          if (p.locales.includes(locale)) {
            expect(portalTarget(p.slug, locale), `${locale} ${p.slug}`).toBeDefined();
            expect(portalTexts(locale, p).every((s) => s.trim().length > 0)).toBe(true);
          } else {
            // The page 404s in a language its users don't search in
            expect(portalTarget(p.slug, locale), `${locale} ${p.slug}`).toBeUndefined();
          }
        }
      }
    });

    it('house style', () => {
      const all = (locale: string) => PORTALS.filter((p) => p.locales.includes(locale as never)).flatMap((p) => portalTexts(locale, p));
      for (const locale of ['en', 'fr']) expect(all(locale).filter((s) => /[–—]/.test(s)), locale).toEqual([]);
      const badFrench = all('fr').filter((s) => /[^\u00a0\u202f][;:!?»]|«[^\u00a0\u202f]/.test(s) || s.includes("'"));
      expect(badFrench).toEqual([]);
      const banned = ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—'];
      expect(all('ar').filter((s) => banned.some((w) => s.includes(w)))).toEqual([]);
    });

    it('are in the sitemap in their languages only', async () => {
      const urls = new Set((await sitemap()).map((e) => e.url));
      for (const p of PORTALS) {
        for (const locale of LOCALES) {
          const url = `https://blendpdf.com${locale === 'en' ? '' : `/${locale}`}/compress-pdf/${p.slug}`;
          expect(urls.has(url), url).toBe(p.locales.includes(locale));
        }
      }
    });
  });
});
