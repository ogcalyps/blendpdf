import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getEditTools } from '../lib/navigation';
import { EMAIL_TOOL_SLUGS, emailToolInfo } from '../lib/email-tools';
import { RUN_TOOLS } from '../lib/run-tools';
import sitemap from '../app/sitemap';
import { generateMetadata } from '../app/[locale]/edit-pdf/layout';

/**
 * A new tool has to be registered by hand in about a dozen places, and a
 * missed one fails silently (no nav link, no sitemap URL, no tool name in the
 * file email). This checks every place /edit-pdf must appear, and that the
 * comparison pages stopped saying BlendPDF has no editor.
 */
const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');
const en = JSON.parse(read('messages/en.json'));
const ar = JSON.parse(read('messages/ar.json'));

describe('/edit-pdf registrations', () => {
  it('is in the Edit nav group (desktop nav, mobile nav, footer), marked new', () => {
    const items = getEditTools((key) => key);
    const item = items.find((i) => i.href === '/edit-pdf');
    expect(item).toEqual({
      title: 'nav.tools.editPdf.title',
      description: 'nav.tools.editPdf.description',
      href: '/edit-pdf',
      badge: 'NEW',
    });
    expect(en.nav.tools.editPdf.title).toBe('Edit PDF');
    expect(ar.nav.tools.editPdf.title).toBe('تعديل PDF');
  });

  it('is on the homepage under its own id (not "edit", which is page numbers)', () => {
    const src = read('app/[locale]/page.tsx');
    expect(src).toMatch(/\{ id: 'edit-pdf', name: t\('nav\.tools\.editPdf\.title'\), url: '\/edit-pdf',[^\n]*category: 'edit'/);
    expect(src).toMatch(/\{ id: 'edit', name: t\('nav\.tools\.addPageNumbers\.title'\)/);
  });

  it('has a RelatedTools card, its own related list, and is linked from the neighbouring tools', () => {
    const src = read('app/[locale]/components/RelatedTools.tsx');
    const ids = [...src.matchAll(/^\s*id: '([a-z-]+)',$/gm)].map((m) => m[1]);
    expect(ids).toContain('edit-pdf');
    const list = (key: string) => {
      const m = new RegExp(`^\\s*'?${key}'?: \\[([^\\]]*)\\],$`, 'm').exec(src);
      return m ? [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]) : null;
    };
    const own = list('editPdf');
    expect(own).not.toBeNull();
    expect(own!.length).toBeGreaterThanOrEqual(4);
    for (const id of own!) expect(ids, `editPdf lists unknown tool ${id}`).toContain(id);
    // The cards are capped at 4, so edit-pdf must be within the first 4 to show
    for (const key of ['sign', 'fill-form', 'cropPdf', 'flattenPdf', 'watermark']) {
      expect(list(key)?.slice(0, 4), key).toContain('edit-pdf');
    }
    expect(read('app/[locale]/edit-pdf/page.tsx')).toContain('<RelatedTools currentTool="editPdf" />');
  });

  it('is known to the file email in both languages', () => {
    expect(EMAIL_TOOL_SLUGS).toContain('edit-pdf');
    expect(emailToolInfo('edit-pdf', 'en', 'https://blendpdf.com')?.tool.name).toBe('Edit PDF');
    expect(emailToolInfo('edit-pdf', 'ar', 'https://blendpdf.com')?.tool.name).toBe('تعديل PDF');
  });

  it('is in the sitemap in both locales, with no FAQ subpage URL', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain('https://blendpdf.com/edit-pdf');
    expect(urls).toContain('https://blendpdf.com/ar/edit-pdf');
    expect(urls.filter((u) => u.includes('/edit-pdf/'))).toEqual([]);
  });

  it('has its own metadata: canonical per locale, hreflang en/ar/fr/es/x-default, indexable', async () => {
    for (const locale of ['en', 'ar', 'fr', 'es']) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      const prefix = locale === 'en' ? '' : `/${locale}`;
      expect(meta.alternates?.canonical).toBe(`https://blendpdf.com${prefix}/edit-pdf`);
      expect(meta.alternates?.languages).toEqual({
        en: 'https://blendpdf.com/edit-pdf',
        ar: 'https://blendpdf.com/ar/edit-pdf',
        fr: 'https://blendpdf.com/fr/edit-pdf',
        es: 'https://blendpdf.com/es/edit-pdf',
        'x-default': 'https://blendpdf.com/edit-pdf',
      });
      expect(meta.robots).toBeUndefined();
      expect(String(meta.title)).toContain('BlendPDF');
    }
    for (const locale of ['en', 'fr', 'es']) {
      const meta = await generateMetadata({ params: Promise.resolve({ locale }) });
      expect(`${meta.title} ${meta.description}`).not.toMatch(/[—–]/);
    }
  });

  it('is in llms.txt under Edit & Sign', () => {
    const txt = read('public/llms.txt');
    const section = txt.slice(txt.indexOf('## Edit & Sign'), txt.indexOf('\n## ', txt.indexOf('## Edit & Sign') + 1));
    expect(section).toContain('[Edit PDF](https://blendpdf.com/edit-pdf)');
  });

  it('is counted by the run counter (no longer reserved)', () => {
    const tool = RUN_TOOLS.find((t) => t.run === 'edit-pdf');
    expect(tool).toEqual({ run: 'edit-pdf', ga: 'edit_pdf', page: '/edit-pdf', where: 'browser' });
  });

  it('is linked from /sign-pdf and from the Word to PDF FAQ', () => {
    // /sign-pdf's "need to add text?" link sat in its old tool section. The page now
    // opens the same editor (Add text included) and links /edit-pdf from its related
    // tools, which list it within the first 4 (checked above).
    const sign = read('app/[locale]/sign-pdf/page.tsx');
    expect(sign).toContain('<ToolWorkspace mode="sign" />');
    expect(sign).toContain('<RelatedTools currentTool="sign" />');
    expect(read('app/[locale]/word-to-pdf/faq/page.tsx')).toContain('<Link href="/edit-pdf"');
    for (const messages of [en, ar]) {
      expect(messages.wordToPdf.faq.editPdfAfterward.answer).toMatch(/Edit PDF|تعديل PDF/);
      expect(messages.signPdf.needText).toMatch(/Edit PDF|تعديل PDF/);
    }
  });
});

describe('comparison pages', () => {
  // Their words live in lib/comparisons since the pages became tested en/fr/ar comparisons
  const pages = ['lib/comparisons/ilovepdf.ts', 'lib/comparisons/smallpdf.ts', 'lib/comparisons/chrome.ts'];
  // Each was true before the editor (or OCR) shipped and is false now.
  const STALE = [
    /Latin-only/i,
    /Latin characters only/i,
    /Arabic (?:text|input) support[^.]*is coming/i,
    /OCR, a PDF editor/,
    /does not have[^.]*\bOCR\b/,
    /if you need OCR/i,
    /far more tools than\s+BlendPDF, including OCR/,
    /scanned paper documents \(OCR\)/,
    /larger toolset: OCR/,
  ];

  it.each(pages)('%s no longer says BlendPDF lacks an editor or OCR, or that typed text is Latin-only', (page) => {
    const src = read(page);
    expect(STALE.filter((re) => re.test(src)).map(String)).toEqual([]);
  });

  it('every comparison links to Edit PDF and OCR PDF', () => {
    const src = read('lib/comparisons/chrome.ts');
    expect(src.split("href: '/edit-pdf'").length - 1, 'once per language').toBe(3);
    expect(src.split("href: '/ocr-pdf'").length - 1, 'once per language').toBe(3);
    expect(read('components/compare/ComparisonPage.tsx')).toContain('chrome.more.links.map');
  });
});
