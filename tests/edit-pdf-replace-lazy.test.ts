/**
 * PDFium for "Edit text (beta)" is a 290 KB script plus a 4.6 MB wasm. It
 * must load only when the visitor picks Edit text (or saves a document with
 * replaced lines), and only from this site, never a CDN:
 *   - @embedpdf/pdfium is named in lib/edit-pdf/pdfium.ts only, and only
 *     inside import() (a type query `typeof import(...)` is erased, a
 *     dynamic import is a separate chunk);
 *   - no client or library source mentions jsDelivr or the package's
 *     DEFAULT_PDFIUM_WASM_URL (the package's own CDN default);
 *   - no static import chain from a page, component or hook reaches the
 *     modules that load it (pdfium.ts, replace.ts) or the line detector;
 *   - the export reaches ./replace through import(), so a save without
 *     replaced lines never loads PDFium.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { dynamicImports, staticImports } from './helpers/static-imports';

const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'hooks', 'lib', 'workers'];
const CLIENT_DIRS = ['app', 'components', 'hooks'];
const PACKAGE = '@embedpdf/pdfium';
const LOADER = 'lib/edit-pdf/pdfium.ts';
const LAZY_MODULES = ['lib/edit-pdf/pdfium.ts', 'lib/edit-pdf/replace.ts', 'lib/edit-pdf/lines.ts'];
const rel = (file: string) => relative(ROOT, file).split('\\').join('/');
const read = (file: string) => readFileSync(file, 'utf8');

function sourcesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourcesIn(path);
    return /\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every place a source names the package in code (comments don't count), and whether it is a dynamic import or a type query. */
function packageMentions(fileName: string, source: string): Array<{ line: number; lazy: boolean }> {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const hits: Array<{ line: number; lazy: boolean }> = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteralLike(node) && (node.text === PACKAGE || node.text.startsWith(`${PACKAGE}/`))) {
      const parent = node.parent;
      const dynamicImport = ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword;
      const typeQuery = ts.isLiteralTypeNode(parent) && ts.isImportTypeNode(parent.parent);
      hits.push({ line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, lazy: dynamicImport || typeQuery });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

function resolveSource(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) base = join(ROOT, specifier.slice(2));
  else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
  else return null;
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js']) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile() && /\.(ts|tsx|js|jsx)$/.test(candidate)) return candidate;
  }
  return null;
}

/** Static import chains from the entries that reach one of `targets`. */
function staticChainsTo(entries: string[], targets: string[]): string[] {
  const parent = new Map<string, string | null>(entries.map((file) => [file, null]));
  const queue = [...entries];
  const offenders: string[] = [];
  const chain = (file: string) => {
    const out: string[] = [];
    for (let at: string | null | undefined = file; at; at = parent.get(at)) out.unshift(rel(at));
    return out.join(' -> ');
  };
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const specifier of staticImports(read(file))) {
      if (specifier === PACKAGE || specifier.startsWith(`${PACKAGE}/`)) {
        offenders.push(`${chain(file)} -> ${specifier}`);
        continue;
      }
      const target = resolveSource(file, specifier);
      if (!target) continue;
      if (targets.includes(rel(target))) {
        offenders.push(`${chain(file)} -> ${rel(target)}`);
        continue;
      }
      if (!parent.has(target)) {
        parent.set(target, file);
        queue.push(target);
      }
    }
  }
  return offenders;
}

describe('PDFium loads lazily, from this site only', () => {
  const sources = SCAN_DIRS.flatMap((dir) => sourcesIn(join(ROOT, dir)));

  it('reads package mentions the way the bundler does', () => {
    const sample = [
      "// @embedpdf/pdfium in a comment does not count",
      "type Api = Awaited<ReturnType<(typeof import('@embedpdf/pdfium'))['init']>>;",
      "const { init } = await import('@embedpdf/pdfium');",
      "import { init as eager } from '@embedpdf/pdfium';",
      "const wasm = require('@embedpdf/pdfium/pdfium.wasm');",
    ].join('\n');
    expect(packageMentions('sample.ts', sample)).toEqual([
      { line: 2, lazy: true },
      { line: 3, lazy: true },
      { line: 4, lazy: false },
      { line: 5, lazy: false },
    ]);
  });

  it(`names ${PACKAGE} only in ${LOADER}, and only inside import()`, () => {
    const mentions = sources.flatMap((file) => packageMentions(file, read(file)).map((hit) => ({ file: rel(file), ...hit })));
    expect(mentions.filter((hit) => hit.file !== LOADER), `only ${LOADER} may load PDFium`).toEqual([]);
    expect(mentions.filter((hit) => !hit.lazy), 'load it with await import(), never statically').toEqual([]);
    expect(mentions.filter((hit) => hit.file === LOADER).length).toBeGreaterThan(0);
    expect(staticImports(read(join(ROOT, LOADER)))).not.toContain(PACKAGE);
  });

  it('never points at jsDelivr or the package\'s CDN default for the wasm', () => {
    const offenders = sources.filter((file) => /jsdelivr|DEFAULT_PDFIUM_WASM_URL/i.test(read(file))).map(rel);
    expect(offenders, 'the wasm is self-hosted (the bundler emits it under /_next/static/media)').toEqual([]);
  });

  it('no static import chain from a page, component or hook reaches the PDFium loader, the removal engine or the line detector', () => {
    const entries = CLIENT_DIRS.flatMap((dir) => sourcesIn(join(ROOT, dir))).filter((file) => !rel(file).startsWith('app/api/'));
    expect(entries.length).toBeGreaterThan(20);
    expect(staticChainsTo(entries, LAZY_MODULES), 'reach them through the lib/edit-pdf facade, which uses import()').toEqual([]);
  });

  it('the export reaches the removal engine only through import(), so a save without replaced lines never loads PDFium', () => {
    const exportFile = join(ROOT, 'lib', 'edit-pdf', 'export.ts');
    expect(staticChainsTo([exportFile], ['lib/edit-pdf/pdfium.ts', 'lib/edit-pdf/replace.ts'])).toEqual([]);
    expect(dynamicImports(read(exportFile))).toContain('./replace');
  });

  it('pins the package to one exact version', () => {
    const pkg = JSON.parse(read(join(ROOT, 'package.json'))) as { dependencies: Record<string, string> };
    expect(pkg.dependencies[PACKAGE]).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
