/**
 * The PDF upload limits reference (/pdf-upload-limits) and its CSV/JSON
 * downloads (/pdf-upload-limits.csv, .json). Server-only content, like
 * lib/size-limits and lib/comparisons.
 */
import { PORTALS, SIZE_TARGETS, sizeLabel } from '@/lib/size-limits/targets';
import type { LimitLocale, UploadLimit, UploadLimitsChrome } from './types';
import { chrome as en } from './en';
import { chrome as fr } from './fr';
import { chrome as ar } from './ar';
import { LIMITS } from './data';

export type { LimitCategory, LimitLocale, UploadLimit, UploadLimitsChrome } from './types';
export { LIMITS };

export const UPLOAD_LIMITS_PATH = '/pdf-upload-limits';
export const LICENSE = { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' };

const CHROME: Record<LimitLocale, UploadLimitsChrome> = { en, fr, ar };

export const limitsLocale = (locale: string): LimitLocale => (locale === 'fr' || locale === 'ar' ? locale : 'en');

export function uploadLimitsChrome(locale: string): UploadLimitsChrome {
  return CHROME[limitsLocale(locale)];
}

/** The newest "checked" date: when the table as a whole was last updated. */
export const LAST_CHECKED = LIMITS.map((row) => row.checked).sort().at(-1)!;

/** "France", "Maroc", "المغرب": the country in the page's language. */
export function countryName(code: string, locale: string): string {
  return new Intl.DisplayNames([limitsLocale(locale)], { type: 'region' }).of(code) ?? code;
}

/** Countries with the most rows first, then by name in the page's language. */
export function limitsByCountry(locale: string): { country: string; name: string; rows: UploadLimit[] }[] {
  const groups = new Map<string, UploadLimit[]>();
  for (const row of LIMITS) groups.set(row.country, [...(groups.get(row.country) ?? []), row]);
  return [...groups]
    .map(([country, rows]) => ({ country, name: countryName(country, locale), rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.name.localeCompare(b.name, limitsLocale(locale)));
}

/**
 * Where a row's "compress under" link goes: the portal's own page when it has
 * one in this language (/compress-pdf/for-ants), a size page with exactly its
 * limit (/compress-pdf/to-2mb), or else the compressor with what to set.
 */
export function compressLink(row: UploadLimit, locale: string): { href: string; label: string; hint?: string } {
  const chrome = uploadLimitsChrome(locale);
  const label = sizeLabel(row.limitMb, limitsLocale(locale));
  const portal = PORTALS.find((p) => p.slug === row.page && (p.locales as readonly string[]).includes(limitsLocale(locale)));
  const size = SIZE_TARGETS.find((t) => t.limitMb === row.limitMb);
  const page = portal ?? size;
  if (page) return { href: `/compress-pdf/${page.slug}`, label: chrome.compress(label) };
  return { href: '/compress-pdf', label: chrome.compress(label), hint: chrome.compressHint(label) };
}

const CSV_COLUMNS = ['id', 'country', 'portal', 'category', 'what_en', 'what_fr', 'what_ar', 'limit_mb', 'per', 'stated', 'formats', 'source_url', 'quote', 'checked'] as const;

const csvCell = (value: string | number) => {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** RFC 4180, UTF-8 with a BOM so spreadsheet apps read the accents and the Arabic. */
export function limitsCsv(): string {
  const lines = LIMITS.map((row) =>
    [row.id, row.country, row.portal, row.category, row.what.en, row.what.fr, row.what.ar, row.limitMb, row.per, row.stated, row.formats ?? '', row.sourceUrl, row.quote, row.checked]
      .map(csvCell)
      .join(','),
  );
  return `﻿${[CSV_COLUMNS.join(','), ...lines].join('\r\n')}\r\n`;
}

export function limitsJson() {
  return {
    name: en.title,
    url: `https://blendpdf.com${UPLOAD_LIMITS_PATH}`,
    license: LICENSE.url,
    credit: en.reuse.citation,
    updated: LAST_CHECKED,
    note: 'limit_mb uses 1 MB = 1,000,000 bytes, as the portals write it (Mo = MB). quote is the source’s own words.',
    rows: LIMITS.map((row) => ({
      id: row.id,
      country: row.country,
      portal: row.portal,
      category: row.category,
      what: row.what,
      limit_mb: row.limitMb,
      per: row.per,
      stated: row.stated,
      formats: row.formats ?? null,
      source_url: row.sourceUrl,
      quote: row.quote,
      checked: row.checked,
    })),
  };
}
