import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { staticImports } from './helpers/static-imports';

/**
 * lib/pdf-text brings fontkit and bidi-js with it (about 334 KB gzip), so the
 * editor must load it with import() once the user has dropped a PDF. One
 * static import anywhere on a page's import graph would put all of it into
 * that page's first load. This walks the static imports from every client
 * source (app/ without app/api, components/, hooks/) through whatever they
 * reach in lib/ and elsewhere, and fails if the walk gets to lib/pdf-text,
 * fontkit or bidi-js.
 *
 * Allowed: import() (not followed), `import type` / `export type` (erased at
 * build time), and lib/pdf-text/constants.ts, which imports nothing.
 */
const ROOT = join(__dirname, '..');
const ENTRY_DIRS = ['app', 'components', 'hooks'];
const SERVER_ONLY = ['app/api/'];
const ALLOWED = 'lib/pdf-text/constants.ts';
const FORBIDDEN_PACKAGES = ['@pdf-lib/fontkit', 'bidi-js'];
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

const rel = (file: string) => relative(ROOT, file).split('\\').join('/');

function sourcesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesIn(path);
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [path] : [];
  });
}

/** The repo file a specifier points at, or null for a package or a non-code file. */
function resolveSource(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate) && statSync(candidate).isFile() && /\.(ts|tsx|js|jsx)$/.test(candidate)) return candidate;
  }
  return null;
}

const isForbiddenFile = (file: string) => rel(file).startsWith('lib/pdf-text/') && rel(file) !== ALLOWED;
const isForbiddenPackage = (specifier: string) =>
  FORBIDDEN_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`));

/** Walk the static import graph from the entries; return every chain that reaches a forbidden module. */
function findStaticPaths(entries: string[]): { offenders: string[]; visited: Set<string> } {
  const parent = new Map<string, string | null>(entries.map((file) => [file, null]));
  const chain = (file: string): string[] => {
    const out: string[] = [];
    for (let at: string | null | undefined = file; at; at = parent.get(at)) out.unshift(rel(at));
    return out;
  };
  const offenders: string[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const specifier of staticImports(readFileSync(file, 'utf8'))) {
      if (isForbiddenPackage(specifier)) {
        offenders.push([...chain(file), specifier].join(' -> '));
        continue;
      }
      const target = resolveSource(file, specifier);
      if (!target) continue;
      if (isForbiddenFile(target)) {
        offenders.push([...chain(file), rel(target)].join(' -> '));
        continue;
      }
      if (!parent.has(target)) {
        parent.set(target, file);
        queue.push(target);
      }
    }
  }
  return { offenders, visited: new Set(parent.keys()) };
}

describe('lib/pdf-text stays out of every first load', () => {
  const entries = ENTRY_DIRS.flatMap((dir) => sourcesIn(join(ROOT, dir))).filter(
    (file) => !SERVER_ONLY.some((prefix) => rel(file).startsWith(prefix)),
  );

  it('reads import statements the way the bundler does', () => {
    const source = [
      "import { drawTextBox } from '@/lib/pdf-text';",
      "import type { TextLayout } from '@/lib/pdf-text';",
      "import { type Matrix, type TextAlign } from '@/lib/pdf-text';",
      "import { CAIRO_FONT_URL, type Matrix } from '@/lib/pdf-text/constants';",
      'import {',
      '  layoutText,',
      '  normalizeText,',
      "} from '../lib/pdf-text/layout';",
      "export * from './x';",
      "export type { BaseDirection } from './bidi';",
      "import 'side-effect';",
      "const engine = await import('@/lib/pdf-text');",
    ].join('\n');
    expect(staticImports(source)).toEqual(['@/lib/pdf-text', '@/lib/pdf-text/constants', '../lib/pdf-text/layout', './x', 'side-effect']);
  });

  it('finds the client sources and follows them into lib/', () => {
    const { visited } = findStaticPaths(entries);
    expect(entries.filter((file) => file.endsWith('page.tsx')).length).toBeGreaterThan(20);
    expect(entries.some((file) => rel(file).startsWith('components/'))).toBe(true);
    expect(entries.some((file) => rel(file).startsWith('hooks/'))).toBe(true);
    expect(entries.some((file) => rel(file).startsWith('app/api/'))).toBe(false);
    expect(visited).toContain(join(ROOT, 'lib', 'utils.ts'));
  });

  it('constants.ts imports nothing, so a static import of it stays small', () => {
    expect(staticImports(readFileSync(join(ROOT, ALLOWED), 'utf8'))).toEqual([]);
  });

  it('no client source reaches lib/pdf-text, fontkit or bidi-js through static imports', () => {
    expect(findStaticPaths(entries).offenders, "load it with await import('@/lib/pdf-text'); only lib/pdf-text/constants and import type may be static").toEqual([]);
  });
});
