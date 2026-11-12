import en from '@/messages/en.json';
import ar from '@/messages/ar.json';
import fr from '@/messages/fr.json';
import es from '@/messages/es.json';

/**
 * The tools a file email can come from, keyed by route slug (the page path),
 * so the email can name the tool that made the file, link back to it, and
 * suggest two that usually come next. Names come from nav.tools in the
 * message files, so they always match the site.
 */

type NavKey = keyof typeof en.nav.tools;

type EmailTool = { nav: NavKey; next: [string, string] };

const EMAIL_TOOLS: Record<string, EmailTool> = {
  'merge-pdf': { nav: 'mergePdf', next: ['compress-pdf', 'sign-pdf'] },
  'split-pdf': { nav: 'splitPdf', next: ['merge-pdf', 'compress-pdf'] },
  'compress-pdf': { nav: 'compressPdf', next: ['merge-pdf', 'protect-pdf'] },
  'rotate-pdf': { nav: 'rotatePdf', next: ['crop-pdf', 'compress-pdf'] },
  'reorder-pdf': { nav: 'reorderPages', next: ['delete-pages', 'merge-pdf'] },
  'delete-pages': { nav: 'deletePages', next: ['reorder-pdf', 'merge-pdf'] },
  'extract-pages': { nav: 'extractPages', next: ['merge-pdf', 'compress-pdf'] },
  'crop-pdf': { nav: 'cropPdf', next: ['rotate-pdf', 'compress-pdf'] },
  'images-to-pdf': { nav: 'imagesToPdf', next: ['compress-pdf', 'merge-pdf'] },
  'pdf-to-images': { nav: 'pdfToImages', next: ['images-to-pdf', 'compress-pdf'] },
  'pdf-to-word': { nav: 'pdfToWord', next: ['word-to-pdf', 'pdf-to-excel'] },
  'pdf-to-excel': { nav: 'pdfToExcel', next: ['excel-to-pdf', 'pdf-to-word'] },
  'pdf-to-text': { nav: 'pdfToText', next: ['pdf-to-word', 'ocr-pdf'] },
  'pdf-to-pdfa': { nav: 'pdfToPdfa', next: ['word-to-pdf', 'merge-pdf'] },
  'word-to-pdf': { nav: 'wordToPdf', next: ['merge-pdf', 'sign-pdf'] },
  'excel-to-pdf': { nav: 'excelToPdf', next: ['merge-pdf', 'compress-pdf'] },
  'powerpoint-to-pdf': { nav: 'powerpointToPdf', next: ['compress-pdf', 'merge-pdf'] },
  'ocr-pdf': { nav: 'ocrPdf', next: ['pdf-to-word', 'pdf-to-text'] },
  'repair-pdf': { nav: 'repairPdf', next: ['compress-pdf', 'ocr-pdf'] },
  'protect-pdf': { nav: 'protectPdf', next: ['sign-pdf', 'watermark-pdf'] },
  'unlock-pdf': { nav: 'unlockPdf', next: ['pdf-to-word', 'compress-pdf'] },
  'add-page-numbers': { nav: 'addPageNumbers', next: ['watermark-pdf', 'merge-pdf'] },
  'watermark-pdf': { nav: 'addWatermark', next: ['protect-pdf', 'add-page-numbers'] },
  'sign-pdf': { nav: 'signPdf', next: ['flatten-pdf', 'protect-pdf'] },
  'edit-pdf': { nav: 'editPdf', next: ['sign-pdf', 'compress-pdf'] },
  'flatten-pdf': { nav: 'flattenPdf', next: ['sign-pdf', 'protect-pdf'] },
  'remove-metadata': { nav: 'removeMetadata', next: ['protect-pdf', 'compress-pdf'] },
};

export type EmailToolLink = { name: string; url: string };

export type EmailToolInfo = { tool: EmailToolLink; next: EmailToolLink[] };

/**
 * The tool behind a file email, with links that say where the visit came from
 * (utm_source=file-email shows up in the nginx log), or null for an unknown slug.
 */
export function emailToolInfo(slug: string | undefined, locale: 'en' | 'ar' | 'fr' | 'es', siteUrl: string): EmailToolInfo | null {
  // Own keys only: "constructor" or "__proto__" from the request must not resolve to Object.prototype
  const entry = slug && Object.hasOwn(EMAIL_TOOLS, slug) ? EMAIL_TOOLS[slug] : undefined;
  if (!entry) return null;
  const names = { en, ar, fr, es }[locale].nav.tools;
  const link = (s: string, content: string): EmailToolLink => ({
    name: names[EMAIL_TOOLS[s].nav].title,
    url: `${siteUrl}/${s}?utm_source=file-email&utm_medium=email&utm_campaign=${slug}&utm_content=${content}`,
  });
  return { tool: link(slug!, 'same-tool'), next: entry.next.map((s) => link(s, 'next-tool')) };
}

/** Exposed for tests: every route slug the email knows. */
export const EMAIL_TOOL_SLUGS = Object.keys(EMAIL_TOOLS);
