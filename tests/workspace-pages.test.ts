import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { dynamicImports, staticImports } from './helpers/static-imports';
import { acceptsFile } from '@/lib/file-handoff';
import { TOOL_FAQ_KEYS } from '@/lib/tool-faqs';
import { MODES } from '@/lib/workspace/modes';
import type { WorkspaceMode } from '@/lib/workspace/types';

/**
 * Every tool page opens the workspace (workspace-spec.md, section 6): the
 * page keeps its hero, steps, FAQ and related tools (SEO), and its tool
 * section is <ToolWorkspace mode="…" />. The shell stays out of the first
 * load: the editor, the save pipeline and the PDF engines are reached only
 * through next/dynamic or import().
 */
const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const SHELL = 'components/workspace/ToolWorkspace.tsx';

interface PageCase {
  slug: string;
  mode: WorkspaceMode;
  /** The H1's message key. */
  h1: string;
  related: string;
  /** ToolFAQ's faqPagePath; null = ToolFAQ without one; false = the page renders its own FAQ. */
  faq: string | null | false;
  /** Renders the shared HowItWorks section. */
  howItWorks: boolean;
}

const PAGES: PageCase[] = [
  { slug: 'edit-pdf', mode: 'edit', h1: 'editPdf.title', related: 'editPdf', faq: null, howItWorks: true },
  { slug: 'sign-pdf', mode: 'sign', h1: 'signPdf.title', related: 'sign', faq: '/sign-pdf/faq', howItWorks: true },
  { slug: 'crop-pdf', mode: 'crop', h1: 'cropPdf.title', related: 'cropPdf', faq: '/crop-pdf/faq', howItWorks: true },
  { slug: 'rotate-pdf', mode: 'rotate', h1: 'rotatePdf.title', related: 'rotate', faq: '/rotate-pdf/faq', howItWorks: true },
  { slug: 'delete-pages', mode: 'delete', h1: 'deletePages.title', related: 'delete-pages', faq: '/delete-pages/faq', howItWorks: true },
  { slug: 'reorder-pdf', mode: 'reorder', h1: 'reorderPdf.title', related: 'reorder', faq: '/reorder-pdf/faq', howItWorks: true },
  { slug: 'extract-pages', mode: 'extract', h1: 'extractPages.title', related: 'extractPages', faq: '/extract-pages/faq', howItWorks: true },
  { slug: 'split-pdf', mode: 'split', h1: 'splitPdf.title', related: 'split', faq: '/split-pdf/faq', howItWorks: true },
  { slug: 'merge-pdf', mode: 'merge', h1: 'mergePdf.title', related: 'merge', faq: '/merge-pdf/faq', howItWorks: true },
  { slug: 'watermark-pdf', mode: 'watermark', h1: 'watermarkPdf.title', related: 'watermark', faq: '/watermark-pdf/faq', howItWorks: true },
  { slug: 'add-page-numbers', mode: 'numbers', h1: 'addPageNumbers.title', related: 'add-page-numbers', faq: '/add-page-numbers/faq', howItWorks: true },
  { slug: 'compress-pdf', mode: 'compress', h1: 'compressPdf.title', related: 'compress', faq: '/compress-pdf/faq', howItWorks: true },
  { slug: 'protect-pdf', mode: 'protect', h1: 'protectPdf.title', related: 'protect', faq: '/protect-pdf/faq', howItWorks: true },
  { slug: 'unlock-pdf', mode: 'unlock', h1: 'unlockPdf.heroTitle', related: 'unlock', faq: false, howItWorks: true },
  { slug: 'repair-pdf', mode: 'repair', h1: 'repairPdf.title', related: 'repair', faq: '/repair-pdf/faq', howItWorks: true },
  { slug: 'ocr-pdf', mode: 'ocr', h1: 'ocrPdf.title', related: 'ocrPdf', faq: '/ocr-pdf/faq', howItWorks: true },
  { slug: 'flatten-pdf', mode: 'flatten', h1: 'flattenPdf.title', related: 'flattenPdf', faq: '/flatten-pdf/faq', howItWorks: true },
  { slug: 'remove-metadata', mode: 'metadata', h1: 'removeMetadata.title', related: 'removeMetadata', faq: '/remove-metadata/faq', howItWorks: true },
  { slug: 'pdf-to-word', mode: 'word', h1: 'pdfToWord.title', related: 'pdf-to-word', faq: '/pdf-to-word/faq', howItWorks: true },
  { slug: 'pdf-to-excel', mode: 'excel', h1: 'pdfToExcel.title', related: 'pdf-to-excel', faq: '/pdf-to-excel/faq', howItWorks: true },
  { slug: 'pdf-to-images', mode: 'images', h1: 'pdfToImages.title', related: 'pdf-to-images', faq: '/pdf-to-images/faq', howItWorks: true },
  { slug: 'pdf-to-text', mode: 'text', h1: 'pdfToText.title', related: 'pdfToText', faq: '/pdf-to-text/faq', howItWorks: true },
  { slug: 'extract-images', mode: 'imagesInside', h1: 'extractImages.title', related: 'extractImages', faq: '/extract-images/faq', howItWorks: true },
  { slug: 'pdf-to-pdfa', mode: 'pdfa', h1: 'pdfToPdfa.title', related: 'pdfa', faq: null, howItWorks: true },
  // Converters keep their own upload and steps column, and open the PDF they made.
  { slug: 'word-to-pdf', mode: 'converted', h1: 'wordToPdf.title', related: 'word-to-pdf', faq: '/word-to-pdf/faq', howItWorks: false },
  { slug: 'powerpoint-to-pdf', mode: 'converted', h1: 'powerpointToPdf.title', related: 'powerpointToPdf', faq: '/powerpoint-to-pdf/faq', howItWorks: false },
  { slug: 'excel-to-pdf', mode: 'converted', h1: 'excelToPdf.title', related: 'excelToPdf', faq: '/excel-to-pdf/faq', howItWorks: false },
  { slug: 'images-to-pdf', mode: 'converted', h1: 'imagesToPdf.title', related: 'images-to-pdf', faq: '/images-to-pdf/faq', howItWorks: true },
];

const pageSource = (slug: string) => read(`app/[locale]/${slug}/page.tsx`);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

describe('tool pages open the workspace', () => {
  it('covers every mode, and each tool mode names its own page', () => {
    const modes = new Set(PAGES.map((p) => p.mode));
    expect([...modes].sort()).toEqual(Object.keys(MODES).sort());
    for (const { slug, mode } of PAGES) {
      if (mode !== 'converted') expect(MODES[mode].slug, mode).toBe(slug);
    }
  });

  it.each(PAGES)('$slug renders ToolWorkspace in its mode and keeps its SEO sections', ({ slug, mode, h1, related, faq, howItWorks }) => {
    const src = pageSource(slug);
    expect(src).toMatch(new RegExp(`<ToolWorkspace\\b[^>]*\\bmode="${mode}"`));
    expect(src).toMatch(new RegExp(`<h1[^>]*>\\s*\\{t\\('${escape(h1)}'\\)\\}`));
    expect(src).toContain(`RelatedTools currentTool="${related}"`);
    expect(src).toMatch(/<BreadcrumbSchema\b/);
    expect(src).toMatch(/<HowToSchema\b/);
    if (howItWorks) expect(src).toMatch(/<\s*HowItWorks steps=\{steps\}(?: title=\{t\('[\w.]+\.howToTitle'\)\})? \/>/);
    if (faq === false) expect(src).toMatch(/<FAQSchema faqs=\{faqData\} \/>/);
    else if (faq === null) expect(src).toMatch(/<ToolFAQ questions=\{faqData\} \/>/);
    else expect(src).toMatch(new RegExp(`<\\s*ToolFAQ questions=\\{faqData\\} faqPagePath="${escape(faq)}" />`));
  });

  it.each(PAGES)('$slug no longer carries its own PDF processing', ({ slug, mode }) => {
    const imports = staticImports(pageSource(slug));
    for (const gone of ['@/components/ProcessingModal', '@/store/useFileStore', 'pdf-lib', 'pdfjs-dist', '@/lib/pdfjs-init', '@/lib/client-pdf']) {
      expect(imports, `${slug} imports ${gone}`).not.toContain(gone);
    }
    if (mode !== 'converted') {
      // The shell owns the dropzone and the delivery step
      for (const gone of ['@/hooks/useTrackedDropzone', '@/hooks/useDeliveryChoice', '@/components/FileDeliveryModal']) {
        expect(imports, `${slug} imports ${gone}`).not.toContain(gone);
      }
    }
  });

  // Copy Google indexed from the old options panels: kept as static text under the workspace, same keys and wording
  const INFO_BLOCKS: Record<string, string[]> = {
    'compress-pdf': [
      'compressPdf.compressionSettings', 'compressPdf.highQuality', 'compressPdf.highQualityDesc', 'compressPdf.mediumQuality',
      'compressPdf.recommended', 'compressPdf.mediumQualityDesc', 'compressPdf.lowQuality', 'compressPdf.lowQualityDesc',
      'compressPdf.howCompressionWorks', 'compressPdf.howCompressionWorksDesc',
    ],
    'protect-pdf': ['protectPdf.setPassword', 'protectPdf.passwordHint', 'protectPdf.securityInfo', 'protectPdf.securityInfoDesc'],
    'ocr-pdf': ['ocrPdf.howItWorksDesc', 'ocrPdf.supportedFormats'],
    'add-page-numbers': [
      'addPageNumbers.customize', 'addPageNumbers.positionLabel', 'addPageNumbers.formatLabel',
      'addPageNumbers.startFromLabel', 'addPageNumbers.fontSizeLabel',
    ],
    'watermark-pdf': [
      'watermarkPdf.customize', 'watermarkPdf.typeLabel', 'watermarkPdf.textLabel', 'watermarkPdf.positionLabel',
      'watermarkPdf.opacityLabel', 'watermarkPdf.fontSizeLabel',
    ],
    'sign-pdf': ['signPdf.needText'],
  };
  const messages = { en: JSON.parse(read('messages/en.json')), ar: JSON.parse(read('messages/ar.json')) };
  const lookup = (tree: unknown, key: string) => key.split('.').reduce<unknown>((at, part) => (at as Record<string, unknown> | undefined)?.[part], tree);

  it.each(Object.entries(INFO_BLOCKS))('%s still renders the copy its options panel had, as static text', (slug, keys) => {
    const src = pageSource(slug);
    const after = src.slice(src.indexOf('<ToolWorkspace'));
    for (const key of keys) {
      expect(after, `${slug} renders ${key}`).toContain(`{t('${key}')}`);
      for (const [locale, tree] of Object.entries(messages)) expect(typeof lookup(tree, key), `${locale} ${key}`).toBe('string');
    }
    // Text only: the controls live in the workspace
    expect(src).not.toMatch(/<(input|select|textarea|button)\b|\bon(Click|Change)=/);
  });

  // The workspace offers options that need our server on every page (Word, compress…), so no copy a page renders
  // (hero, badges, cards, steps, FAQ answers in the schema) may promise the file never leaves the device without saying so.
  const NO_UPLOAD = {
    en: /never leaves|never (been )?uploaded|nothing is uploaded|not uploaded|100% in your browser|nothing ever leaves|stays (entirely )?on your device/i,
    ar: /لا يغادر|لا يُرفع|لم يغادر|يبقى (الملف )?على جهازك/,
  };
  const SAYS_SERVER = { en: /an option that needs (our server|it)|unless you choose otherwise/, ar: /خيارًا يحتاج إلى خادمنا|خيارًا يحتاج إليه|ما لم تختر/ };
  const faqKeys = (src: string) => {
    const ns = /useToolFaqs\('([^']+)'\)/.exec(src)?.[1];
    return ns ? (TOOL_FAQ_KEYS[ns] ?? []).map((slug) => `${ns}.faq.${slug}.answer`) : [];
  };

  it.each(PAGES.filter((p) => p.mode !== 'converted'))('$slug promises no upload only with the server options named', ({ slug }) => {
    const src = pageSource(slug);
    const keys = [...new Set([...[...src.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1]), ...faqKeys(src)])];
    expect(keys.length, slug).toBeGreaterThan(5);
    for (const locale of ['en', 'ar'] as const) {
      const offenders = keys.filter((key) => {
        const text = lookup(messages[locale], key);
        return typeof text === 'string' && NO_UPLOAD[locale].test(text) && !SAYS_SERVER[locale].test(text);
      });
      expect(offenders, locale).toEqual([]);
    }
  });

  it('the no-upload check catches the old wording (it is not vacuous)', () => {
    expect(NO_UPLOAD.en.test('100% in your browser — your file never leaves your device')).toBe(true);
    expect(NO_UPLOAD.ar.test('ملفك لا يغادر جهازك أبداً')).toBe(true);
    expect(SAYS_SERVER.en.test(lookup(messages.en, 'editPdf.faq.private.answer') as string)).toBe(true);
  });

  it('sign-pdf keeps its always-visible link to Edit PDF', () => {
    expect(pageSource('sign-pdf')).toMatch(/<Link href="\/edit-pdf"[^>]*>\s*\{t\('signPdf\.needText'\)\}\s*<\/Link>/);
  });

  it('converters open the PDF they made and offer it at once', () => {
    for (const { slug } of PAGES.filter((p) => p.mode === 'converted')) {
      const src = pageSource(slug);
      expect(src, slug).toMatch(/<ToolWorkspace\b[^>]*?\binitialFile=\{converted\}[\s\S]*?\bdeliverOnOpen\b/);
      expect(src, slug).toMatch(/setConverted\(new File\(\[blob\], filename, \{ type: 'application\/pdf' \}\)\)/);
      expect(src, slug).not.toMatch(/openDelivery\(/);
    }
  });
});

// ── First load: the static import graph from the shell ───────────────────

const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js'];
const rel = (file: string) => relative(ROOT, file).split('\\').join('/');

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

const FORBIDDEN_FILES = ['components/edit-pdf/EditorWorkspace.tsx', 'lib/workspace/save.ts', 'lib/workspace/fixes.ts', 'lib/edit-pdf/export.ts'];
const FORBIDDEN_PACKAGES = ['pdf-lib', 'pdfjs-dist', 'jszip', '@embedpdf/pdfium'];

/** Every chain of static imports from the entries that reaches a forbidden module. */
function forbiddenPaths(entries: string[]): { offenders: string[]; visited: Set<string> } {
  const parent = new Map<string, string | null>(entries.map((file) => [file, null]));
  const chain = (file: string) => {
    const out: string[] = [];
    for (let at: string | null | undefined = file; at; at = parent.get(at)) out.unshift(rel(at));
    return out;
  };
  const offenders: string[] = [];
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    for (const specifier of staticImports(readFileSync(file, 'utf8'))) {
      if (FORBIDDEN_PACKAGES.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
        offenders.push([...chain(file), specifier].join(' -> '));
        continue;
      }
      const target = resolveSource(file, specifier);
      if (!target) continue;
      if (FORBIDDEN_FILES.includes(rel(target))) {
        offenders.push([...chain(file), rel(target)].join(' -> '));
        continue;
      }
      if (!parent.has(target)) {
        parent.set(target, file);
        queue.push(target);
      }
    }
  }
  return { offenders, visited: new Set([...parent.keys()].map(rel)) };
}

describe('the workspace stays out of the first load', () => {
  const shell = read(SHELL);

  it('imports only the dropzone, the Drive picker, the delivery step and pure data statically', () => {
    expect(staticImports(shell).sort()).toEqual(
      [
        'react',
        'next/dynamic',
        'next-intl',
        'lucide-react',
        '@/hooks/useTrackedDropzone',
        '@/hooks/useDeliveryChoice',
        '@/components/FileDeliveryModal',
        '@/components/GoogleDrivePicker',
        // downloadBlob, which owns the download event (tests/download-helper-guard.test.ts)
        '@/lib/utils',
        '@/lib/edit-pdf',
        '@/lib/workspace/modes',
        // the open work carried across a language switch (pure, held in memory)
        'next/navigation',
        '@/lib/workspace/carry-over',
      ].sort(),
    );
  });

  it('loads the editor, the save pipeline and the fixes with import()', () => {
    expect(dynamicImports(shell)).toEqual(['@/components/edit-pdf/EditorWorkspace', '@/lib/workspace/save', '@/lib/workspace/fixes']);
    expect(shell).toMatch(/dynamic\(\(\) => import\('@\/components\/edit-pdf\/EditorWorkspace'\), \{\s*ssr: false,/);
  });

  it('walks the real graph (the check is not vacuous)', () => {
    const { visited } = forbiddenPaths([join(ROOT, SHELL)]);
    for (const file of ['hooks/useTrackedDropzone.ts', 'components/FileDeliveryModal.tsx', 'lib/edit-pdf/index.ts', 'lib/edit-pdf/model.ts', 'lib/analytics.ts']) {
      expect(visited, file).toContain(file);
    }
    // The same walker finds a forbidden module where it is imported statically
    expect(forbiddenPaths([join(ROOT, 'lib/workspace/save.ts')]).offenders).toContain('lib/workspace/save.ts -> lib/zip-generation.ts -> jszip');
    expect(forbiddenPaths([join(ROOT, 'lib/pdf-ops.ts')]).offenders).toContain('lib/pdf-ops.ts -> pdf-lib');
  });

  it('reaches no editor, pipeline or PDF engine from the shell or any tool page', () => {
    const entries = [SHELL, ...PAGES.map((p) => `app/[locale]/${p.slug}/page.tsx`)].map((file) => join(ROOT, file));
    expect(forbiddenPaths(entries).offenders, 'load it with next/dynamic or import()').toEqual([]);
  });
});

// ── Keep working / home page handoff ─────────────────────────────────────

describe('a handed-over file opens the workspace', () => {
  const shell = read(SHELL);
  const dropzone = /useTrackedDropzone\(\{([\s\S]*?)\}\);/.exec(shell)?.[1] ?? '';

  it('the shell\'s dropzone is the main one, so it takes the handoff on mount', () => {
    expect(dropzone).not.toBe('');
    // useTrackedDropzone skips the handoff for a secondary (uploadRole) or disabled dropzone
    expect(dropzone).not.toMatch(/uploadRole/);
    expect(dropzone).toMatch(/disabled: !!initialFile,/);
    expect(dropzone).toMatch(/accept: \{ 'application\/pdf': \['\.pdf'\] \},/);
    expect(dropzone).toMatch(/maxSize: MAX_PDF_BYTES,/);
  });

  it('accepts what Keep working and the home page hand over', () => {
    const accept = { 'application/pdf': ['.pdf'] };
    expect(acceptsFile(accept, { name: 'a_cropped.pdf', type: 'application/pdf' })).toBe(true);
    expect(acceptsFile(accept, { name: 'Scan.PDF', type: '' })).toBe(true);
    expect(acceptsFile(accept, { name: 'cv.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe(false);
  });

  it('opens the editor with what the dropzone hands it', () => {
    expect(shell).toMatch(/const onDrop = useCallback\(\s*\(accepted: File\[\], rejections: FileRejection\[\]\) => take\(accepted,/);
    expect(shell).toMatch(/setFiles\(accepted\);/);
    expect(shell).toMatch(/\{files \? \(\s*<EditorWorkspace files=\{files\} mode=\{mode\}/);
  });

  it('no tool page keeps a main dropzone of its own that would take the file first', () => {
    for (const { slug, mode } of PAGES) {
      if (mode === 'converted') continue;
      expect(pageSource(slug), slug).not.toMatch(/useTrackedDropzone\(/);
    }
  });
});
