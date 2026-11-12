/**
 * "Keep the font" guards (keep-font-spec.md section 12, test 10):
 *   (a) every look-alike file is shipped unmodified from its upstream
 *       release, next to its licence file, under OFL 1.1 or Apache 2.0, and
 *       every TTF in public/fonts is registered (or is Cairo); every Arabic
 *       look-alike draws each letter as one glyph of its own, so the text it
 *       writes can be copied and searched;
 *   (b) fonts come from this site only: no Google Fonts, jsDelivr or unpkg;
 *   (c) the keep-font engine is never part of a page's first load: no static
 *       import chain from a page, component or hook reaches it;
 *   (d) the pdf-lib internals it relies on (StandardFontEmbedder's metrics
 *       and WinAnsi table, PDFObjectCopier, a page's normalised /Font) still
 *       exist in the pinned pdf-lib.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDict, PDFDocument, PDFObjectCopier, StandardFontEmbedder } from 'pdf-lib';
import { CAIRO_FONT_URL } from '../lib/pdf-text/constants';
import { LOOKALIKE_FONTS } from '../lib/edit-pdf/keep-font/lookalike';
import { staticImports } from './helpers/static-imports';

const ROOT = join(__dirname, '..');
const FONTS = join(ROOT, 'public', 'fonts');
const rel = (file: string) => relative(ROOT, file).split('\\').join('/');
const publicFile = (url: string) => join(ROOT, 'public', url);

function filesIn(dir: string, pattern: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : filesIn(path, pattern);
    return pattern.test(entry.name) ? [path] : [];
  });
}

/** The name-table records the guard reads. */
function nameTable(file: string): { family: string; version: string; licence: string; copyright: string } {
  const font = fontkit.create(readFileSync(file)) as unknown as { name: { records: Record<string, Record<string, string> | undefined> } };
  const record = (key: string) => {
    const entry = font.name.records[key];
    return entry ? (entry.en ?? Object.values(entry)[0] ?? '') : '';
  };
  return { family: record('fontFamily'), version: record('version'), licence: record('license'), copyright: record('copyright') };
}

/** Problems with the shipped look-alikes; [] = all good. The guard and its mutation test share it. */
function lookalikeProblems(fontsDir: string): string[] {
  const problems: string[] = [];
  const registered = new Set<string>();
  for (const [family, files] of Object.entries(LOOKALIKE_FONTS)) {
    const urls = [files.regular, ...(files.bold ? [files.bold] : [])];
    const licencePath = join(fontsDir, files.licence.replace(/^\/fonts\//, ''));
    if (!existsSync(licencePath)) {
      problems.push(`${family}: no licence file ${files.licence}`);
      continue;
    }
    const licenceText = readFileSync(licencePath, 'utf8');
    for (const url of urls) {
      registered.add(url);
      const path = join(fontsDir, url.replace(/^\/fonts\//, ''));
      if (!existsSync(path)) {
        problems.push(`${family}: missing ${url}`);
        continue;
      }
      const name = nameTable(path);
      if (!name.version.startsWith(files.version)) problems.push(`${url}: ${name.version}, registry says ${files.version}`);
      if (!name.family.replace(/\s/g, '').toLowerCase().startsWith(family.replace(/\s/g, '').toLowerCase())) problems.push(`${url}: family ${name.family}`);
      const ofl = /SIL Open Font License, Version 1\.1/.test(name.licence);
      const apache = /Apache License, Version 2\.0/.test(name.licence);
      if (!ofl && !apache) problems.push(`${url}: licence ${name.licence}`);
      if (ofl && !/SIL OPEN FONT LICENSE Version 1\.1/.test(licenceText)) problems.push(`${files.licence}: not the OFL 1.1 text`);
      if (apache && !/Apache License\s+Version 2\.0, January 2004/.test(licenceText)) problems.push(`${files.licence}: not the Apache 2.0 text`);
      const holder = /Red Hat|Noto Project|tyPoland|Huerta|Cairo Project/.exec(name.copyright)?.[0];
      if (!holder || !licenceText.includes(holder)) problems.push(`${files.licence}: does not carry ${url}'s copyright (${name.copyright})`);
    }
  }
  for (const file of filesIn(fontsDir, /\.(ttf|otf|woff2?)$/i)) {
    const url = `/fonts/${relative(fontsDir, file).split('\\').join('/')}`;
    if (!registered.has(url) && url !== CAIRO_FONT_URL) problems.push(`${url}: shipped but not in LOOKALIKE_FONTS`);
  }
  return problems;
}

/**
 * Why an Arabic font can't be a look-alike; [] = it can. A PDF maps each
 * glyph back to text through one ToUnicode entry, so every letter, in every
 * joining form, must be ONE glyph that no other letter uses. A font that
 * draws dots as glyphs of their own and shares one dotless glyph between
 * letters (Noto Naskh Arabic: ب ت ث ن ي) writes lines no viewer can copy.
 */
function arabicGlyphProblems(file: string): string[] {
  const font = fontkit.create(readFileSync(file));
  const tatweel = new Set(font.layout('\u0640').glyphs.map((g) => g.id));
  const owner = new Map<number, string>();
  const problems: string[] = [];
  for (let cp = 0x0621; cp <= 0x064a; cp++) {
    if (cp >= 0x063b && cp <= 0x0640) continue;
    const letter = String.fromCodePoint(cp);
    const forms: Array<[string, string]> = [
      ['isol', letter],
      ['init', `${letter}\u0640`],
      ['medi', `\u0640${letter}\u0640`],
      ['fina', `\u0640${letter}`],
    ];
    for (const [form, text] of forms) {
      const ids = font.layout(text).glyphs.map((g) => g.id).filter((id) => !tatweel.has(id));
      const other = owner.get(ids[0]);
      if (ids.length !== 1) problems.push(`${letter} ${form}: ${ids.length} glyphs`);
      else if (other !== undefined && other !== letter) problems.push(`${letter} ${form}: glyph ${ids[0]} is also ${other}`);
      else owner.set(ids[0], letter);
    }
  }
  return problems;
}

describe('keep-font guard (a): look-alike fonts ship unmodified, licensed, registered', () => {
  it('every registered file exists with its licence; OFL 1.1 or Apache 2.0; the upstream version; nothing extra', () => {
    expect(lookalikeProblems(FONTS)).toEqual([]);
  });

  it('Reserved Font Names are kept: Liberation and Carlito ship under their own names', () => {
    expect(readFileSync(join(FONTS, 'OFL-LiberationSans.txt'), 'utf8')).toContain('with Reserved Font Name Liberation.');
    expect(readFileSync(join(FONTS, 'OFL-Carlito.txt'), 'utf8')).toContain('with Reserved Font Name "Carlito".');
    expect(nameTable(publicFile('/fonts/LiberationSans-Regular.ttf')).family).toBe('Liberation Sans');
  });

  it('about 4 MB in all, and a visitor needs at most two files per line', () => {
    const total = Object.values(LOOKALIKE_FONTS)
      .flatMap((f) => [f.regular, ...(f.bold ? [f.bold] : [])])
      .filter((url) => url !== CAIRO_FONT_URL)
      .reduce((n, url) => n + statSync(publicFile(url)).size, 0);
    expect(total).toBeLessThan(4.1 * 1024 * 1024);
  });

  it('every Arabic look-alike draws each letter, in each joining form, as one glyph of its own (so the saved line can be copied)', () => {
    const arabic = Object.entries(LOOKALIKE_FONTS).filter(([, files]) => files.covers !== 'latin');
    expect(arabic.map(([family]) => family).sort()).toEqual(['Cairo', 'Noto Sans Arabic']);
    for (const [family, files] of arabic) {
      for (const url of [files.regular, ...(files.bold ? [files.bold] : [])]) expect(arabicGlyphProblems(publicFile(url)), `${family}: ${url}`).toEqual([]);
    }
  });
});

describe('keep-font guard (b): fonts only from this site', () => {
  const CDN = /fonts\.googleapis|fonts\.gstatic|jsdelivr|unpkg/i;
  it('no Google Fonts, jsDelivr or unpkg in lib/, components/ or public/fonts', () => {
    const files = [...filesIn(join(ROOT, 'lib'), /\.(tsx?|jsx?|mjs|css)$/), ...filesIn(join(ROOT, 'components'), /\.(tsx?|jsx?|css)$/), ...filesIn(FONTS, /./)];
    expect(files.length).toBeGreaterThan(20);
    expect(files.filter((file) => CDN.test(readFileSync(file).toString('latin1'))).map(rel)).toEqual([]);
  });

  it('every look-alike URL is a /fonts/ path on this site', () => {
    for (const files of Object.values(LOOKALIKE_FONTS)) {
      for (const url of [files.regular, files.bold, files.licence].filter(Boolean) as string[]) expect(url).toMatch(/^\/fonts\/[A-Za-z0-9-]+\.(ttf|txt)$/);
    }
  });
});

// ── (c) The engine stays out of every first load ─────────────────────────────

const ENTRY_DIRS = ['app', 'components', 'hooks'];
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];

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

/** Static import chains from `entries` that reach a file `isTarget` accepts. `read` lets the mutation test swap one file's source. */
function staticChains(entries: string[], isTarget: (relPath: string) => boolean, read: (file: string) => string = (file) => readFileSync(file, 'utf8')): string[] {
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
      const target = resolveSource(file, specifier);
      if (!target) continue;
      if (isTarget(rel(target))) {
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

const isEngine = (path: string) => path.startsWith('lib/edit-pdf/keep-font/') || path === 'lib/edit-pdf/font.ts';
const clientEntries = () =>
  ENTRY_DIRS.flatMap((dir) => filesIn(join(ROOT, dir), /\.(tsx?|jsx?)$/)).filter((file) => !rel(file).startsWith('app/api/') && !file.endsWith('.d.ts'));

describe('keep-font guard (c): the engine loads only when Edit text needs it', () => {
  it('no static import chain from a page, component or hook reaches lib/edit-pdf/keep-font or the font loader', () => {
    const entries = clientEntries();
    expect(entries.length).toBeGreaterThan(20);
    expect(staticChains(entries, isEngine), 'reach them through the lib/edit-pdf facade, which uses import()').toEqual([]);
  });

  it('the guard sees a static import from a component (mutation check)', () => {
    const entries = clientEntries();
    const victim = entries.find((file) => rel(file) === 'components/edit-pdf/ReplaceField.tsx')!;
    expect(victim).toBeTruthy();
    const read = (file: string) => (file === victim ? `import { planReplacement } from '@/lib/edit-pdf/keep-font/choose';\n${readFileSync(file, 'utf8')}` : readFileSync(file, 'utf8'));
    expect(staticChains(entries, isEngine, read)).toEqual(['components/edit-pdf/ReplaceField.tsx -> lib/edit-pdf/keep-font/choose.ts']);
  });

  it('the facade reaches the engine with import() only', () => {
    const facade = readFileSync(join(ROOT, 'lib', 'edit-pdf', 'index.ts'), 'utf8');
    expect(staticImports(facade).filter((s) => s.includes('keep-font'))).toEqual([]);
    expect(facade).toMatch(/import\('\.\/keep-font\/analyze'\)/);
    expect(facade).toMatch(/import\('\.\/keep-font\/preview'\)/);
  });
});

describe('keep-font guard (d): the pdf-lib internals the engine relies on', () => {
  it('StandardFontEmbedder gives metrics and the WinAnsi table; PDFObjectCopier copies; a page normalises its own /Font', async () => {
    const helvetica = StandardFontEmbedder.for('Helvetica' as Parameters<typeof StandardFontEmbedder.for>[0]);
    expect(helvetica.encoding.supportedCodePoints.length).toBeGreaterThan(200);
    expect(helvetica.encoding.encodeUnicodeCodePoint(0x20ac)).toEqual({ code: 0x80, name: 'Euro' });
    expect(helvetica.font.getWidthOfGlyph('A')).toBe(667);
    const source = await PDFDocument.create();
    const target = await PDFDocument.create();
    const ref = source.context.register(source.context.obj({ Type: 'Font', Subtype: 'Type1', BaseFont: 'Helvetica' }));
    const copy = PDFObjectCopier.for(source.context, target.context).copy(ref);
    expect(target.context.lookup(copy)).toBeInstanceOf(PDFDict);
    expect(target.addPage().node.normalizedEntries().Font).toBeInstanceOf(PDFDict);
  });
});
