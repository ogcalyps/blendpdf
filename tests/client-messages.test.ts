import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  PAGE_ONLY_KEYS,
  TOOL_ROUTE_NAMESPACES,
  WORKSPACE_TOOL_NAMESPACES,
  pageClientMessages,
  sharedClientMessages,
  type ToolNamespace,
} from '../lib/i18n/client-messages';

/**
 * The browser gets the shared messages on every page and a tool's own
 * namespace on that tool's route only (lib/i18n/client-messages.ts). A client
 * component that reads another tool's namespace would render raw keys such as
 * "compressPdf.title", so this scans every 'use client' file for the
 * namespaces it reads and checks each one ships where that file runs.
 */
const ROOT = join(__dirname, '..');
const SCAN_DIRS = ['app/[locale]', 'components', 'lib', 'hooks', 'store'];
type Messages = Record<string, unknown>;
const en = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8')) as Messages;
const ar = JSON.parse(readFileSync(join(ROOT, 'messages/ar.json'), 'utf8')) as Messages;

const ROUTE_OF = new Map<string, string>(Object.entries(TOOL_ROUTE_NAMESPACES).map(([route, ns]) => [ns, route]));

/** Unused files that read a tool namespace. The test fails as soon as live code imports one. */
const UNUSED: Record<string, string> = {
  'components/ReorderPageThumbnail.tsx': 'only ReorderPageGrid imports it',
  'components/ReorderPageGrid.tsx': 'nothing imports it',
};
/** Files that build the namespace from a variable, and why that is safe. */
const DYNAMIC_OK: Record<string, string> = {
  'lib/tool-faqs.ts': 'useToolFaqs(namespace): each call site passes a literal, checked like any other read',
};

/**
 * Per-locale budget for JSON.stringify(sharedClientMessages(messages)) in
 * UTF-8 bytes: what every page carries before its own namespace. Measured at
 * 44,783 B English and 67,700 B Arabic when this split landed (the whole
 * catalog was 203,780 B and 309,404 B).
 */
const SHARED_BUDGET = { en: 50_000, ar: 75_000 } as const;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** pageOnly: the read reaches into a page-only key (faq, guide), which never ships outside the tool's route. */
type Read = { ns: string; pageOnly: boolean; line: number };

/** The top-level namespaces a source reads with useTranslations, a root translator, or useToolFaqs. */
function readsOf(source: string): Read[] {
  const lineAt = (index: number) => source.slice(0, index).split('\n').length;
  const reads: Read[] = [];
  const add = (path: string, index: number) => {
    const [ns, ...rest] = path.split('.');
    reads.push({ ns, pageOnly: PAGE_ONLY_KEYS.has(rest[0]), line: lineAt(index) });
  };

  for (const m of source.matchAll(/useTranslations\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) add(m[1], m.index!);
  for (const m of source.matchAll(/useToolFaqs\(\s*['"`]([A-Za-z]+)['"`]\s*\)/g)) add(`${m[1]}.faq`, m.index!);

  // Translators made with no namespace take the whole path, namespace first.
  const roots = [...source.matchAll(/(?:const|let)\s+(\w+)\s*=\s*useTranslations\(\s*\)/g)].map((m) => m[1]);
  for (const name of roots) {
    const call = new RegExp(`\\b${name}(?:\\.(?:rich|markup|raw|has))?\\(\\s*(['"\`])(.*?)\\1`, 'g');
    for (const m of source.matchAll(call)) {
      if (m[2].startsWith('${')) reads.push({ ns: '${dynamic}', pageOnly: false, line: lineAt(m.index!) });
      else add(m[2], m.index!);
    }
  }
  return reads;
}

const clientFiles = SCAN_DIRS.flatMap((dir) => sources(join(ROOT, dir)))
  .map((file) => ({ rel: relative(ROOT, file), source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => /^\s*['"]use client['"]/.test(source));

describe('client components read only the messages their page ships', () => {
  it('finds the client sources and their reads', () => {
    expect(clientFiles.length).toBeGreaterThan(60);
    const fix = clientFiles.find(({ rel }) => rel === 'components/edit-pdf/FixPanel.tsx')!;
    expect(readsOf(fix.source).map((r) => r.ns)).toContain('ocrPdf');
    const merge = clientFiles.find(({ rel }) => rel === 'app/[locale]/merge-pdf/page.tsx')!;
    expect(readsOf(merge.source).map((r) => r.ns)).toContain('mergePdf');
  });

  it('a tool namespace is read on its own route, or by the workspace without its page-only keys', () => {
    const offenders = clientFiles.flatMap(({ rel, source }) =>
      readsOf(source).flatMap((read) => {
        if (read.ns === '${dynamic}') {
          return rel in DYNAMIC_OK ? [] : [`${rel}:${read.line}: builds the namespace from a variable`];
        }
        const route = ROUTE_OF.get(read.ns);
        if (!route) return [];
        if (rel in UNUSED || rel.startsWith(`app/[locale]/${route}/`)) return [];
        if (WORKSPACE_TOOL_NAMESPACES.has(read.ns as ToolNamespace) && !read.pageOnly) return [];
        return [`${rel}:${read.line}: reads ${read.ns}${read.pageOnly ? ' (a page-only key)' : ''}, which only ships on /${route}`];
      })
    );
    expect(offenders, 'move the strings to a shared namespace, or list the namespace in lib/i18n/client-messages.ts').toEqual([]);
  });

  it('the unused files stay unused', () => {
    const all = SCAN_DIRS.flatMap((dir) => sources(join(ROOT, dir))).map((file) => relative(ROOT, file));
    for (const unused of Object.keys(UNUSED)) {
      const name = unused.replace(/^.*\//, '').replace(/\.tsx?$/, '');
      const importers = all.filter(
        (rel) => rel !== unused && new RegExp(`from ['"][^'"]*/${name}['"]`).test(readFileSync(join(ROOT, rel), 'utf8'))
      );
      expect(importers.filter((rel) => !(rel in UNUSED)), `${unused} is imported now: check the messages it reads`).toEqual([]);
    }
  });

  it('every tool layout adds its own namespace', () => {
    for (const [route, ns] of Object.entries(TOOL_ROUTE_NAMESPACES)) {
      const layout = readFileSync(join(ROOT, 'app/[locale]', route, 'layout.tsx'), 'utf8');
      expect(layout, `app/[locale]/${route}/layout.tsx`).toContain(`<PageMessages namespace="${ns}">{children}</PageMessages>`);
      expect(en[ns], `messages/en.json has ${ns}`).toBeTypeOf('object');
      expect(ar[ns], `messages/ar.json has ${ns}`).toBeTypeOf('object');
    }
  });

  it('the root layout ships the shared messages, not the catalog', () => {
    const layout = readFileSync(join(ROOT, 'app/[locale]/layout.tsx'), 'utf8');
    expect(layout).toContain('messages={sharedClientMessages(messages)}');
    expect(layout).not.toMatch(/messages=\{messages\}/);
  });
});

describe('sharedClientMessages / pageClientMessages', () => {
  it('drops tool namespaces, keeps the workspace ones without their page-only keys, and leaves the input alone', () => {
    const shared = sharedClientMessages(en as never);
    expect(shared.mergePdf).toBeUndefined();
    expect(shared.pdfToWord).toBeUndefined();
    expect(shared.nav).toEqual(en.nav);
    expect(shared.workspace).toEqual(en.workspace);
    for (const ns of WORKSPACE_TOOL_NAMESPACES) {
      expect(shared[ns], ns).toBeTypeOf('object');
      expect((shared[ns] as Messages).faq, ns).toBeUndefined();
      expect((shared[ns] as Messages).guide, ns).toBeUndefined();
    }
    expect((en.ocrPdf as Messages).faq).toBeTypeOf('object');
    expect((en.editPdf as Messages).guide).toBeTypeOf('object');
    expect((shared.editPdf as Messages).tools).toEqual((en.editPdf as Messages).tools);
  });

  it('a page adds exactly its own namespace, whole', () => {
    expect(pageClientMessages(en as never, 'mergePdf')).toEqual({ mergePdf: en.mergePdf });
    expect(pageClientMessages(ar as never, 'ocrPdf')).toEqual({ ocrPdf: ar.ocrPdf });
  });

  it.each(Object.entries({ en, ar }))('%s shared messages stay inside the budget', (locale, messages) => {
    const bytes = Buffer.byteLength(JSON.stringify(sharedClientMessages(messages as never)));
    expect(bytes).toBeLessThan(SHARED_BUDGET[locale as keyof typeof SHARED_BUDGET]);
  });
});
