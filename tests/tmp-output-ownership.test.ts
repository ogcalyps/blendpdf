import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

/**
 * word-to-pdf, excel-to-pdf, powerpoint-to-pdf and pdf-to-word (LibreOffice
 * path) used to fall back to "the most recently modified .pdf/.docx in /tmp
 * from the last 30-60 s" when their own output was missing. That fallback only
 * ran when this request had produced nothing, so whatever it found belonged to
 * someone else: another visitor's upload or conversion, served as this
 * visitor's result. A route must only ever read the output path it created.
 */

const root = join(__dirname, '..');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('no route picks an output file by recency', () => {
  const files = routeFiles(join(root, 'app/api'));

  it('is looking at the converter routes', () => {
    for (const route of ['word-to-pdf', 'excel-to-pdf', 'powerpoint-to-pdf', 'pdf-to-word']) {
      expect(files).toContain(join(root, 'app/api', route, 'route.ts'));
    }
  });

  for (const file of files) {
    it(relative(root, file), () => {
      expect(stripComments(readFileSync(file, 'utf8'))).not.toMatch(/\bmtime(?:Ms)?\b/);
    });
  }
});
