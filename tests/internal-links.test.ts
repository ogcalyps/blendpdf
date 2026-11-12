import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * English URLs carry no locale prefix (localePrefix: 'as-needed'), so a link
 * built as `/${locale}/…` points English pages at /en/…, which only redirects.
 * Crawlers then meet the redirect instead of the canonical page; that is how
 * /en/forms/… URLs ended up in Google's index. Links go through the Link from
 * '@/i18n/routing' with an unprefixed path instead.
 */
const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib'];
const PREFIXED_HREF = /href=\{\s*`\/\$\{locale\}/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('internal links', () => {
  it('never build hrefs with a /${locale} prefix', () => {
    const offenders = SCAN_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)))
      .filter((file) => PREFIXED_HREF.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
