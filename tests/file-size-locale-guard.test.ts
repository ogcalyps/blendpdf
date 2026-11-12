import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { formatFileSize } from '@/lib/utils';

/**
 * formatFileSize (lib/utils.ts) only speaks the page's language when it is
 * given the locale; without it, /fr and /ar show "318.25 KB". The save dialog
 * and the merge cards shipped that way, so every call in pages, components and
 * hooks must pass a second argument. lib keeps the English default for its
 * English-only validation messages.
 */
const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app/[locale]', 'components', 'hooks', 'store'].map((dir) => join(ROOT, dir));

function findSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findSources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The argument list of each formatFileSize( call, nested brackets included. */
function callArguments(source: string): { args: string; line: number }[] {
  const calls: { args: string; line: number }[] = [];
  const re = /\bformatFileSize\(/g;
  for (let match = re.exec(source); match; match = re.exec(source)) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < source.length && depth > 0; i++) {
      if ('([{'.includes(source[i])) depth++;
      else if (')]}'.includes(source[i])) depth--;
    }
    calls.push({ args: source.slice(re.lastIndex, i - 1), line: source.slice(0, match.index).split('\n').length });
  }
  return calls;
}

/** True when the argument list has a comma outside any nested brackets. */
function hasSecondArgument(args: string): boolean {
  let depth = 0;
  for (const ch of args) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) return true;
  }
  return false;
}

describe('file sizes are shown in the page language', () => {
  const files = SCAN_DIRS.flatMap(findSources);

  it('finds the callers', () => {
    const callers = files.filter((file) => /\bformatFileSize\(/.test(readFileSync(file, 'utf8'))).map((file) => relative(ROOT, file));
    expect(callers).toContain('components/FileDeliveryPanel.tsx');
    expect(callers).toContain('components/FileList.tsx');
    expect(callers.length).toBeGreaterThan(5);
  });

  it('every call passes the locale', () => {
    const offenders = files.flatMap((file) =>
      callArguments(readFileSync(file, 'utf8'))
        .filter((call) => !hasSecondArgument(call.args))
        .map((call) => `${relative(ROOT, file)}:${call.line}: formatFileSize(${call.args})`)
    );
    expect(offenders, 'pass useLocale() as the second argument').toEqual([]);
  });

  it('formats French, Spanish and Arabic the way the save dialog should show them', () => {
    expect(formatFileSize(325889, 'fr')).toBe('318,25 Ko');
    expect(formatFileSize(450717, 'ar')).toBe('440.15 كيلوبايت');
    expect(formatFileSize(325889, 'es')).toBe('318,25\u00a0KB');
    expect(formatFileSize(0, 'es')).toBe('0\u00a0bytes');
    expect(formatFileSize(325889)).toBe('318.25 KB');
  });
});
