/**
 * lib/edit-pdf/index.ts is what the editor UI and the page import, so it is
 * part of /edit-pdf's first load. pdf-lib, fontkit, bidi-js and the export
 * code must stay behind import() in it, or they would ship with the page
 * before the visitor has even chosen a file. tests/pdf-text-lazy-load.test.ts
 * only catches fontkit and bidi-js, and only once a UI file imports a value
 * from the facade; this guards the facade itself, pdf-lib included.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { dynamicImports, staticImports } from './helpers/static-imports';

const ROOT = join(__dirname, '..');
const FACADE = join(ROOT, 'lib', 'edit-pdf', 'index.ts');
const HEAVY = ['pdf-lib', '@pdf-lib/fontkit', 'bidi-js', 'pdfjs-dist'];
const rel = (file: string) => relative(ROOT, file).split('\\').join('/');
const read = (file: string) => readFileSync(file, 'utf8');

function resolveSource(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every file the facade loads statically, and every package specifier on the way. */
function staticGraph(entry: string): { files: string[]; packages: string[] } {
  const files = [entry];
  const packages: string[] = [];
  for (let i = 0; i < files.length; i++) {
    for (const specifier of staticImports(read(files[i]))) {
      const target = resolveSource(files[i], specifier);
      if (!target) packages.push(specifier);
      else if (!files.includes(target)) files.push(target);
    }
  }
  return { files: files.map(rel), packages };
}

function sourcesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourcesIn(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

describe('lib/edit-pdf facade stays light', () => {
  it('imports only ./types and ./model statically', () => {
    const imports = staticImports(read(FACADE));
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.filter((s) => s !== './types' && s !== './model'), 'move it behind import() inside the function that needs it').toEqual([]);
  });

  it('and nothing it loads statically reaches pdf-lib, fontkit, bidi-js or pdf.js', () => {
    const graph = staticGraph(FACADE);
    expect(graph.files).toEqual(['lib/edit-pdf/index.ts', 'lib/edit-pdf/types.ts', 'lib/edit-pdf/model.ts']);
    expect(graph.packages.filter((p) => HEAVY.some((h) => p === h || p.startsWith(`${h}/`)))).toEqual([]);
  });

  it('reaches the engine modules through import()', () => {
    expect(dynamicImports(read(FACADE)).sort()).toEqual(['./export', './images', './insert', './keep-font/analyze', './keep-font/preview', './lines', './load', './replace', './text-engine', './text-extent', './text-layer']);
  });

  it('the editor UI and the page import lib/edit-pdf only through the facade (or its light types and model)', () => {
    const allowed = new Set(['lib/edit-pdf/index.ts', 'lib/edit-pdf/types.ts', 'lib/edit-pdf/model.ts']);
    const clients = [...sourcesIn(join(ROOT, 'components', 'edit-pdf')), ...sourcesIn(join(ROOT, 'app', '[locale]', 'edit-pdf'))];
    const offenders = clients.flatMap((file) =>
      staticImports(read(file))
        .map((specifier) => resolveSource(file, specifier))
        .filter((target): target is string => target !== null && rel(target).startsWith('lib/edit-pdf/') && !allowed.has(rel(target)))
        .map((target) => `${rel(file)} -> ${rel(target)}`),
    );
    expect(offenders, "import from '@/lib/edit-pdf' instead").toEqual([]);
  });
});
