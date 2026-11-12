import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

/**
 * pdf.js 3.11 runs font programs through eval unless isEvalSupported is false
 * (CVE-2024-4367). lib/pdfjs-init.ts forces the flag for every caller of
 * getPdfJs(), so app code must load pdf.js through it and never import
 * pdfjs-dist itself. Type-only imports are fine: they vanish at build time.
 * tests/ is not scanned, because tests use pdf.js in Node as an oracle.
 */
const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app', 'lib', 'components', 'hooks', 'workers'];

// Files allowed to load pdfjs-dist themselves, and why.
const PROCESSOR = 'lib/pdf-processor.ts';
const ALLOWED: Record<string, string> = {
  'lib/pdfjs-init.ts': 'the isEvalSupported:false wrapper itself',
  [PROCESSOR]:
    'server-only require; its one caller, app/api/pdf-to-images/route.ts, passes isEvalSupported:false itself (checked below)',
};

const isPdfJs = (specifier: string) => specifier === 'pdfjs-dist' || specifier.startsWith('pdfjs-dist/');
const isProcessor = (specifier: string) => /(^|\/)pdf-processor(\.ts)?$/.test(specifier);

const stringArg = (node: ts.CallExpression) => {
  const [arg] = node.arguments;
  return arg && ts.isStringLiteralLike(arg) ? arg.text : null;
};

const lineOf = (sf: ts.SourceFile, node: ts.Node) =>
  `${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}: ${node.getText(sf).split('\n')[0]}`;

function findSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : findSources(path);
    return /\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

/** Every import of pdfjs-dist that survives compilation, as "line: code". */
function runtimePdfJsImports(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const hits: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && isPdfJs(node.moduleSpecifier.text)) {
      const clause = node.importClause;
      const typeOnly =
        clause?.isTypeOnly ||
        (clause && !clause.name && clause.namedBindings && ts.isNamedImports(clause.namedBindings) &&
          clause.namedBindings.elements.length > 0 && clause.namedBindings.elements.every((el) => el.isTypeOnly));
      if (!typeOnly) hits.push(node);
    } else if (
      ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) && isPdfJs(node.moduleSpecifier.text)
    ) {
      hits.push(node);
    } else if (
      ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteral(node.moduleReference.expression) && isPdfJs(node.moduleReference.expression.text)
    ) {
      hits.push(node);
    } else if (ts.isCallExpression(node)) {
      // Any call whose first argument names pdfjs-dist counts as a load, whatever
      // the callee is called: import(), require(), and a require made with
      // createRequire under another name (lib/pdf-processor.ts uses createRequire).
      const specifier = stringArg(node);
      if (specifier && isPdfJs(specifier)) hits.push(node);
    }
    // `typeof import('pdfjs-dist')` is an ImportTypeNode, not a call, so it never matches.
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits.map((node) => lineOf(sf, node));
}

/**
 * Places a file can get lib/pdf-processor.ts's getPdfJs: a named import or
 * re-export of it, a namespace import or `export *`, or a dynamic import.
 */
function processorPdfJsUses(fileName: string, source: string): string[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const hits: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier) && isProcessor(node.moduleSpecifier.text)
    ) {
      const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : node.exportClause;
      const named = bindings && (ts.isNamedImports(bindings) || ts.isNamedExports(bindings)) ? bindings.elements : null;
      if (!named || named.some((el) => (el.propertyName ?? el.name).text === 'getPdfJs')) hits.push(node);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = stringArg(node);
      if (specifier && isProcessor(specifier)) hits.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits.map((node) => lineOf(sf, node));
}

/** Every getDocument(...) call that does not end up with isEvalSupported: false, as "line: code". */
function getDocumentCallsWithEval(fileName: string, source: string): { calls: number; offenders: string[] } {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  let calls = 0;
  const offenders: string[] = [];
  const propName = (p: ts.ObjectLiteralElementLike) =>
    p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isPropertyAccessExpression(callee) ? callee.name.text : ts.isIdentifier(callee) ? callee.text : null;
      if (name === 'getDocument') {
        calls++;
        const [arg] = node.arguments;
        // The last spread or isEvalSupported wins, so that is the one that must say false.
        const last =
          arg && ts.isObjectLiteralExpression(arg)
            ? [...arg.properties].reverse().find((p) => ts.isSpreadAssignment(p) || propName(p) === 'isEvalSupported')
            : undefined;
        const disabled = last && ts.isPropertyAssignment(last) && last.initializer.kind === ts.SyntaxKind.FalseKeyword;
        if (!disabled) offenders.push(lineOf(sf, node));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { calls, offenders };
}

describe('pdfjs-dist is only loaded through lib/pdfjs-init.ts', () => {
  const files = SCAN_DIRS.flatMap((dir) => findSources(join(ROOT, dir)));

  it('finds the sources, including the allowed loaders', () => {
    const rel = files.map((file) => relative(ROOT, file));
    for (const dir of SCAN_DIRS) expect(rel.some((file) => file.startsWith(`${dir}/`)), dir).toBe(true);
    for (const allowed of Object.keys(ALLOWED)) {
      expect(rel).toContain(allowed);
      // An allowance that no longer loads pdf.js should be removed, not left to cover a future import.
      expect(runtimePdfJsImports(allowed, readFileSync(join(ROOT, allowed), 'utf8')), allowed).not.toEqual([]);
    }
  });

  it('tells runtime imports from type-only ones', () => {
    const src = [
      "import * as a from 'pdfjs-dist';",
      "import 'pdfjs-dist/web/pdf_viewer.css';",
      "export { getDocument } from 'pdfjs-dist';",
      "const b = await import('pdfjs-dist/legacy/build/pdf.js');",
      "const c = require('pdfjs-dist/build/pdf.js');",
      "const r = createRequire(x); r('pdfjs-dist');",
      "import type { PDFDocumentProxy } from 'pdfjs-dist';",
      "import { type PDFPageProxy } from 'pdfjs-dist';",
      "type M = typeof import('pdfjs-dist');",
      "// import('pdfjs-dist') in a comment",
      "const fonts = join('node_modules', 'pdfjs-dist', 'standard_fonts');",
    ].join('\n');
    expect(runtimePdfJsImports('sample.ts', src).map((hit) => Number(hit.split(':')[0]))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('no other app, lib, component, hook or worker file imports pdfjs-dist', () => {
    const offenders = files
      .filter((file) => !(relative(ROOT, file) in ALLOWED))
      .flatMap((file) =>
        runtimePdfJsImports(file, readFileSync(file, 'utf8')).map((hit) => `${relative(ROOT, file)}:${hit}`)
      );
    expect(offenders, 'load pdf.js with getPdfJs() from lib/pdfjs-init.ts').toEqual([]);
  });

  it(`${PROCESSOR}'s pdf.js only reaches callers that pass isEvalSupported: false`, () => {
    // Its getPdfJs() hands out raw pdf.js, so its allowance holds only while
    // every file that gets it turns eval off on each getDocument call.
    const callers = files
      .filter((file) => relative(ROOT, file) !== PROCESSOR)
      .filter((file) => processorPdfJsUses(file, readFileSync(file, 'utf8')).length > 0)
      .map((file) => relative(ROOT, file));
    expect(callers, `new caller of ${PROCESSOR} getPdfJs: use lib/pdfjs-init.ts or check it here`).toEqual([
      'app/api/pdf-to-images/route.ts',
    ]);
    for (const caller of callers) {
      const { calls, offenders } = getDocumentCallsWithEval(caller, readFileSync(join(ROOT, caller), 'utf8'));
      expect(calls, `${caller} getDocument calls`).toBeGreaterThan(0);
      expect(offenders, `${caller}: pass isEvalSupported: false`).toEqual([]);
    }
  });

  it('spots every way to reach the processor getPdfJs, and a getDocument that leaves eval on', () => {
    const uses = [
      "import { getPdfJs } from '@/lib/pdf-processor';",
      "import { getPdfJs as load } from './pdf-processor';",
      "import * as proc from '../lib/pdf-processor';",
      "export { getPdfJs } from '@/lib/pdf-processor';",
      "const p = await import('@/lib/pdf-processor');",
      "import { toHeaderSafeFilename } from '@/lib/pdf-processor';",
      "import { getPdfJs } from '@/lib/pdfjs-init';",
    ].join('\n');
    expect(processorPdfJsUses('sample.ts', uses).map((hit) => Number(hit.split(':')[0]))).toEqual([1, 2, 3, 4, 5]);

    const calls = [
      'pdfjs.getDocument({ data, isEvalSupported: false });',
      'pdfjs.getDocument({ data });',
      'pdfjs.getDocument({ isEvalSupported: false, ...opts });',
      'pdfjs.getDocument({ data, isEvalSupported: true });',
      'getDocument(bytes);',
    ].join('\n');
    const { calls: count, offenders } = getDocumentCallsWithEval('sample.ts', calls);
    expect(count).toBe(5);
    expect(offenders.map((hit) => Number(hit.split(':')[0]))).toEqual([2, 3, 4, 5]);
  });
});
