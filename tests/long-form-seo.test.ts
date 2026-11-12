import { describe, expect, it } from 'vitest';
import sitemap from '../app/sitemap';
import { locales } from '../i18n';
import { LONG_FORM_LOCALES, longFormSeo } from '../lib/i18n/seo';
import { GUIDES } from '../lib/guides';
import { COMPARE_PATH, COMPARISONS } from '../lib/comparisons';
import { SIZE_TARGETS } from '../lib/size-limits/targets';
import { UPLOAD_LIMITS_PATH } from '../lib/upload-limits';

/**
 * Guides, comparisons, compress-to-a-size pages, the ID copy page and the
 * upload limits reference are written per locale. A locale launched without
 * them shows the English text, so there they must stay out of the index, the
 * sitemap and hreflang, the way the /<locale>/…/faq pages do.
 */
const BASE = 'https://blendpdf.com';
const unwritten = locales.filter((l) => !LONG_FORM_LOCALES.includes(l));
const longFormPaths = [
  '/guides',
  ...GUIDES.map((g) => `/guides/${g.slug}`),
  COMPARE_PATH,
  ...COMPARISONS.map((c) => c.path),
  ...SIZE_TARGETS.map((t) => `/compress-pdf/${t.slug}`),
  '/watermark-pdf/id-copy',
  UPLOAD_LIMITS_PATH,
];

describe('long-form pages in a locale they are not written in', () => {
  it('none, today: every site locale has its long-form pages (a new locale launching without them is added deliberately)', () => {
    expect(unwritten).toEqual([]);
  });

  it('point at the English URL, unindexed, with hreflang only for the written locales', () => {
    for (const locale of unwritten) {
      const seo = longFormSeo(BASE, locale, '/guides/sign-and-stamp');
      expect(seo.robots).toEqual({ index: false, follow: true });
      expect(seo.alternates?.canonical).toBe(`${BASE}/guides/sign-and-stamp`);
      expect(Object.keys(seo.alternates?.languages ?? {}).sort()).toEqual([...LONG_FORM_LOCALES, 'x-default'].sort());
    }
  });

  it('stay indexable and self-canonical in the locales they are written in', () => {
    for (const locale of LONG_FORM_LOCALES) {
      const seo = longFormSeo(BASE, locale, '/compare');
      expect(seo.robots).toBeUndefined();
      expect(seo.alternates?.canonical).toBe(locale === 'en' ? `${BASE}/compare` : `${BASE}/${locale}/compare`);
    }
  });

  it('are left out of the sitemap, while the translated tool pages are in it', async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    for (const locale of unwritten) {
      for (const path of longFormPaths) expect(urls.has(`${BASE}/${locale}${path}`), `/${locale}${path}`).toBe(false);
      for (const path of ['', '/edit-pdf', '/compress-pdf', '/merge-pdf', '/privacy', '/terms']) {
        expect(urls.has(`${BASE}/${locale}${path}`), `/${locale}${path}`).toBe(true);
      }
    }
  });

  it('never list an unwritten locale as an alternate in the sitemap', async () => {
    for (const entry of await sitemap()) {
      if (!longFormPaths.some((p) => entry.url.endsWith(p))) continue;
      for (const locale of unwritten) expect(entry.alternates?.languages ?? {}, entry.url).not.toHaveProperty(locale);
    }
  });
});
