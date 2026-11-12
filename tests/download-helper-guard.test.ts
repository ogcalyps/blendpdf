import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * downloadBlob (lib/utils.ts) is the only place that fires the GA4 file_download
 * event. Code that builds its own <a download> skips it and its downloads
 * silently go missing from analytics, so pages, components, hooks, stores,
 * workers and lib helpers must call downloadBlob instead.
 */
const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app/[locale]', 'lib', 'components', 'hooks', 'store', 'workers'].map((dir) => join(ROOT, dir));

// Files allowed to build their own anchor, and why.
const ALLOWED: Record<string, string> = {
  'lib/utils.ts': 'downloadBlob itself',
  'lib/csv-parsing.ts': 'blank batch-fill template is an input, not a result, so it must not count as file_download',
};

const RAW_ANCHOR = [/\.download\s*=/, /createElement\(\s*['"]a['"]\s*\)/];

function findSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findSources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('downloads go through downloadBlob', () => {
  const files = SCAN_DIRS.flatMap(findSources).filter((file) => !(relative(ROOT, file) in ALLOWED));
  const scanned = (dir: string) => files.filter((file) => relative(ROOT, file).startsWith(`${dir}/`));

  it('finds the sources', () => {
    expect(scanned('app').filter((file) => file.endsWith('page.tsx')).length).toBeGreaterThan(20);
    expect(scanned('lib')).toContain(join(ROOT, 'lib', 'zip-generation.ts'));
    expect(scanned('components').length).toBeGreaterThan(10);
    expect(scanned('hooks')).toContain(join(ROOT, 'hooks', 'useFileDelivery.ts'));
    expect(scanned('store')).toContain(join(ROOT, 'store', 'use-file-store.ts'));
    expect(scanned('workers')).toContain(join(ROOT, 'workers', 'pdf.worker.ts'));
  });

  it('no file builds its own download anchor', () => {
    const offenders = files.flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, i) =>
          RAW_ANCHOR.some((re) => re.test(line)) ? [`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`] : []
        )
    );
    expect(offenders, 'use downloadBlob from lib/utils.ts so file_download is tracked').toEqual([]);
  });
});
