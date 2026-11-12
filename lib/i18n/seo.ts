import type { Metadata } from 'next';
import { locales, type Locale } from '@/i18n';

const OPEN_GRAPH_LOCALES: Record<Locale, string> = { en: 'en_US', ar: 'ar_SA', fr: 'fr_FR', es: 'es_ES' };

/** The og:locale value for a site locale. */
export function ogLocale(locale: string): string {
  return OPEN_GRAPH_LOCALES[locale as Locale] ?? OPEN_GRAPH_LOCALES.en;
}

/** og:locale:alternate: every other locale the page exists in. */
export function ogAlternateLocales(locale: string): string[] {
  return locales.filter((l) => l !== locale).map((l) => OPEN_GRAPH_LOCALES[l]);
}

/** A page's URL in one locale: English at the unprefixed root, the others under /<locale>. */
export function localizedUrl(baseUrl: string, locale: string, path: string): string {
  return locale === 'en' ? `${baseUrl}${path}` : `${baseUrl}/${locale}${path}`;
}

/** hreflang alternates for a page translated into every locale. `path` is '' for the home page. */
export function languageAlternates(baseUrl: string, path: string): Record<string, string> {
  return {
    ...Object.fromEntries(locales.map((l) => [l, localizedUrl(baseUrl, l, path)])),
    'x-default': `${baseUrl}${path}`,
  };
}

/** hreflang alternates for a page in only some locales; x-default is the first of them. */
export function languageAlternatesFor(baseUrl: string, path: string, pageLocales: readonly string[]): Record<string, string> {
  return {
    ...Object.fromEntries(pageLocales.map((l) => [l, localizedUrl(baseUrl, l, path)])),
    'x-default': localizedUrl(baseUrl, pageLocales[0], path),
  };
}

/**
 * Long-form pages (guides, comparisons, compress-to-a-size pages, the ID copy
 * page, the upload limits reference) are written in these locales. Under any other locale they show the
 * English text.
 */
export const LONG_FORM_LOCALES: readonly Locale[] = ['en', 'ar', 'fr'];

/**
 * canonical, hreflang and robots for a long-form page. In a locale it is
 * written in: its own URL, with alternates in the locales it has. In any
 * other: the English text under a foreign URL, so, like the /<locale>/…/faq
 * pages, it points at the English URL and stays out of the index.
 */
export function longFormSeo(
  baseUrl: string,
  locale: string,
  path: string,
  pageLocales: readonly string[] = LONG_FORM_LOCALES,
): Pick<Metadata, 'alternates' | 'robots'> {
  const languages = languageAlternatesFor(baseUrl, path, pageLocales);
  if (pageLocales.includes(locale)) return { alternates: { canonical: localizedUrl(baseUrl, locale, path), languages } };
  return { alternates: { canonical: languages['x-default'], languages }, robots: { index: false, follow: true } };
}
