/**
 * Which tools "Keep working on this file" offers after a result. Pure data,
 * so the panel and the tests share it.
 */

export interface KeepWorkingTool {
  /** Page slug, e.g. 'split-pdf'. */
  slug: string;
  /** Key under nav.tools.* for the tool's name. */
  titleKey: string;
}

/** Every tool that takes a single PDF, most useful next step first. */
export const KEEP_WORKING_TOOLS: readonly KeepWorkingTool[] = [
  { slug: 'edit-pdf', titleKey: 'editPdf' },
  { slug: 'split-pdf', titleKey: 'splitPdf' },
  { slug: 'merge-pdf', titleKey: 'mergePdf' },
  { slug: 'compress-pdf', titleKey: 'compressPdf' },
  { slug: 'sign-pdf', titleKey: 'signPdf' },
  { slug: 'pdf-to-word', titleKey: 'pdfToWord' },
  { slug: 'watermark-pdf', titleKey: 'addWatermark' },
  { slug: 'add-page-numbers', titleKey: 'addPageNumbers' },
  { slug: 'crop-pdf', titleKey: 'cropPdf' },
  { slug: 'rotate-pdf', titleKey: 'rotatePdf' },
  { slug: 'reorder-pdf', titleKey: 'reorderPages' },
  { slug: 'delete-pages', titleKey: 'deletePages' },
  { slug: 'extract-pages', titleKey: 'extractPages' },
  { slug: 'protect-pdf', titleKey: 'protectPdf' },
  { slug: 'ocr-pdf', titleKey: 'ocrPdf' },
  { slug: 'pdf-to-images', titleKey: 'pdfToImages' },
  { slug: 'pdf-to-excel', titleKey: 'pdfToExcel' },
  { slug: 'pdf-to-text', titleKey: 'pdfToText' },
  { slug: 'extract-images', titleKey: 'extractImages' },
  { slug: 'flatten-pdf', titleKey: 'flattenPdf' },
  { slug: 'remove-metadata', titleKey: 'removeMetadata' },
];

/** How many tools show before "All tools". */
export const KEEP_WORKING_SHOWN = 6;

/** Results the next tool can't open: a password-protected PDF. */
const NO_KEEP_WORKING_AFTER = new Set(['protect-pdf']);

/** Locale prefixes in URLs (i18n/routing.ts; English has none). */
const LOCALE_SEGMENTS = new Set(['en', 'ar', 'fr', 'es']);

/** Slug of the tool page at a pathname, with or without the locale ('/ar/crop-pdf' → 'crop-pdf'). */
export function toolSlugFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 1 && LOCALE_SEGMENTS.has(segments[0])) segments.shift();
  return segments[0] ?? '';
}

/** A single PDF, which any tool in the list can take. ZIPs, Word files and images can't. */
export function isPdfResult(fileBlob: Blob | null, filename: string): boolean {
  if (!fileBlob) return false;
  if (fileBlob.type) return fileBlob.type === 'application/pdf';
  return /\.pdf$/i.test(filename);
}

/** The tools to offer after `currentSlug`'s result, or [] when Keep working doesn't apply. */
export function keepWorkingTools(currentSlug: string, fileBlob: Blob | null, filename: string): KeepWorkingTool[] {
  if (NO_KEEP_WORKING_AFTER.has(currentSlug) || !isPdfResult(fileBlob, filename)) return [];
  return KEEP_WORKING_TOOLS.filter((tool) => tool.slug !== currentSlug);
}
