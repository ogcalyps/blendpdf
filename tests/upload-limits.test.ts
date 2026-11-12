/**
 * The PDF upload limits reference (/pdf-upload-limits, lib/upload-limits):
 * every row's number agrees with the words it quotes from its source, links
 * to a portal's own size page only when that page has the same limit, the
 * text exists in every language in house style, the CSV and JSON downloads
 * carry the same rows, and the page is in the sitemap and the footer.
 */
import { describe, expect, it } from 'vitest';
import { badSpanish } from './helpers/spanish';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PORTALS } from '../lib/size-limits/targets';
import { LIMITS, UPLOAD_LIMITS_PATH, compressLink, countryName, limitsByCountry, limitsCsv, limitsJson, uploadLimitsChrome } from '../lib/upload-limits';
import sitemap from '../app/sitemap';

const ROOT = join(__dirname, '..');
const LOCALES = ['en', 'fr', 'ar', 'es'] as const;

/** "300Kb" → 0.3, "10Mo par fichier" → 10, "4 MB" → 4. */
function statedMb(stated: string): number | null {
  const match = stated.match(/(\d+(?:[.,]\d+)?)\s*(Mo|MO|MB|mégabytes|M\b|Ko|KB|Kb|ko|kb|ميجابايت|ميغابايت|ميغا بايت|كيلوبايت)/);
  if (!match) return null;
  const n = Number(match[1].replace(',', '.'));
  return /^(Ko|KB|Kb|ko|kb|كيلوبايت)$/.test(match[2]) ? n / 1000 : n;
}

/** Every string the page shows in this language. */
function texts(locale: (typeof LOCALES)[number]): string[] {
  const c = uploadLimitsChrome(locale);
  return [
    c.title,
    c.metaTitle,
    c.description,
    c.intro,
    c.method,
    c.jumpTo,
    ...Object.values(c.columns),
    ...Object.values(c.per),
    ...Object.values(c.categories),
    c.checked('2026-11-12'),
    c.compress('4 MB'),
    c.compressHint('4 MB'),
    ...Object.values(c.reuse),
    c.report.before,
    c.report.after,
    ...c.faq.flatMap((q) => [q.question, q.answer]),
    ...LIMITS.map((row) => row.what[locale]),
  ];
}

/** Minimal RFC 4180 reader for the round trip. */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\r' && text[i + 1] === '\n') row.push(cell), rows.push(row), (row = []), (cell = ''), i++;
    else cell += ch;
  }
  return rows;
}

describe('upload limits reference', () => {
  it('has one row per id, each with a real country, an https source and a date that has passed', () => {
    expect(new Set(LIMITS.map((r) => r.id)).size).toBe(LIMITS.length);
    for (const row of LIMITS) {
      expect(row.id, row.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(countryName(row.country, 'en'), row.id).not.toBe(row.country);
      expect(row.sourceUrl, row.id).toMatch(/^https:\/\//);
      expect(row.checked, row.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(row.checked).getTime(), row.id).toBeLessThanOrEqual(Date.now());
    }
  });

  it('quotes its source with the number it lists', () => {
    for (const row of LIMITS) {
      const fromStated = statedMb(row.stated);
      expect(fromStated, `${row.id}: "${row.stated}"`).not.toBeNull();
      expect(fromStated, row.id).toBeCloseTo(row.limitMb, 6);
      // The quote carries the stated number itself ("4 MB" quotes "... 4 MB ...").
      const number = row.stated.match(/\d+(?:[.,]\d+)?/)![0];
      expect(row.quote, row.id).toContain(number);
    }
  });

  it('links to a site’s own page only when that page has the same limit', () => {
    for (const row of LIMITS.filter((r) => r.page)) {
      const portal = PORTALS.find((p) => p.slug === row.page);
      expect(portal?.limitMb, row.id).toBe(row.limitMb);
    }
    const ants = LIMITS.find((r) => r.id === 'ants-carte-grise')!;
    expect(compressLink(ants, 'fr').href).toBe('/compress-pdf/for-ants');
    // The ANTS page is French only: elsewhere the 1 MB size page.
    expect(compressLink(ants, 'en').href).toBe('/compress-pdf/to-1mb');
    const portal5 = LIMITS.find((r) => r.id === 'ircc-portal')!;
    expect(compressLink(portal5, 'en')).toMatchObject({ href: '/compress-pdf', hint: expect.stringContaining('5 MB') });
  });

  it('groups every row under its country, biggest groups first', () => {
    const groups = limitsByCountry('fr');
    expect(groups.flatMap((g) => g.rows).length).toBe(LIMITS.length);
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1].rows.length).toBeGreaterThanOrEqual(groups[i].rows.length);
    expect(countryName('FR', 'fr')).toBe('France');
  });

  it('exists in every language, in house style', () => {
    for (const locale of LOCALES) {
      expect(texts(locale).every((s) => s.trim().length > 0), locale).toBe(true);
      expect(uploadLimitsChrome(locale).faq).toHaveLength(uploadLimitsChrome('en').faq.length);
    }
    for (const locale of ['en', 'fr'] as const) expect(texts(locale).filter((s) => /[–—]/.test(s)), locale).toEqual([]);
    const badFrench = texts('fr').filter((s) => /[^  ][;:!?»]|«[^  ]/.test(s.replace(/https?:\/\/\S+/g, '')) || s.includes("'"));
    expect(badFrench).toEqual([]);
    expect(texts('es').filter(badSpanish)).toEqual([]);
    const banned = ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—'];
    expect(texts('ar').filter((s) => banned.some((w) => s.includes(w)))).toEqual([]);
  });

  it('downloads as CSV and JSON with exactly the rows of the page', () => {
    const csv = limitsCsv();
    expect(csv.startsWith('﻿')).toBe(true);
    const [header, ...rows] = readCsv(csv.slice(1));
    expect(header[0]).toBe('id');
    expect(rows.map((r) => r[0])).toEqual(LIMITS.map((r) => r.id));
    const quoteColumn = header.indexOf('quote');
    expect(rows.map((r) => r[quoteColumn])).toEqual(LIMITS.map((r) => r.quote));
    const json = limitsJson();
    expect(json.rows.map((r) => r.limit_mb)).toEqual(LIMITS.map((r) => r.limitMb));
    expect(json.license).toBe('https://creativecommons.org/licenses/by/4.0/');
  });

  it('is in the sitemap in every language and linked from the footer and the size pages', async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    for (const prefix of ['', '/fr', '/ar', '/es']) expect(urls.has(`https://blendpdf.com${prefix}${UPLOAD_LIMITS_PATH}`), prefix).toBe(true);
    expect(readFileSync(join(ROOT, 'components/Footer.tsx'), 'utf8')).toContain(`href="${UPLOAD_LIMITS_PATH}"`);
    expect(readFileSync(join(ROOT, 'app/[locale]/compress-pdf/[target]/page.tsx'), 'utf8')).toContain('href={UPLOAD_LIMITS_PATH}');
    for (const locale of LOCALES) {
      const footer = JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8')).footer;
      expect(footer.uploadLimits, locale).toBeTruthy();
    }
  });
});
