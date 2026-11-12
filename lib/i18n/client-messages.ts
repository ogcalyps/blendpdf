import type { AbstractIntlMessages } from 'next-intl';

/**
 * Which translations reach the browser. Every page used to ship the whole
 * catalog: about 225 KB of JSON inside each page's HTML (330 KB in Arabic),
 * most of it other tools' FAQ prose. The root layout now ships the shared
 * namespaces, and each tool route adds its own through PageMessages in its
 * layout.tsx. tests/client-messages.test.ts checks that client code only reads
 * what its page ships.
 */

/** Tool route → its namespace, which ships on that route only. */
export const TOOL_ROUTE_NAMESPACES = {
  'add-page-numbers': 'addPageNumbers',
  'compress-pdf': 'compressPdf',
  'crop-pdf': 'cropPdf',
  'delete-pages': 'deletePages',
  'edit-pdf': 'editPdf',
  'excel-to-pdf': 'excelToPdf',
  'extract-images': 'extractImages',
  'extract-pages': 'extractPages',
  'flatten-pdf': 'flattenPdf',
  'images-to-pdf': 'imagesToPdf',
  'merge-pdf': 'mergePdf',
  'ocr-pdf': 'ocrPdf',
  'pdf-to-excel': 'pdfToExcel',
  'pdf-to-images': 'pdfToImages',
  'pdf-to-pdfa': 'pdfToPdfa',
  'pdf-to-text': 'pdfToText',
  'pdf-to-word': 'pdfToWord',
  'powerpoint-to-pdf': 'powerpointToPdf',
  'protect-pdf': 'protectPdf',
  'remove-metadata': 'removeMetadata',
  'reorder-pdf': 'reorderPdf',
  'repair-pdf': 'repairPdf',
  'rotate-pdf': 'rotatePdf',
  'sign-pdf': 'signPdf',
  'split-pdf': 'splitPdf',
  'unlock-pdf': 'unlockPdf',
  'watermark-pdf': 'watermarkPdf',
  'word-to-pdf': 'wordToPdf',
} as const;

export type ToolNamespace = (typeof TOOL_ROUTE_NAMESPACES)[keyof typeof TOOL_ROUTE_NAMESPACES];

const TOOL_NAMESPACES = new Set<string>(Object.values(TOOL_ROUTE_NAMESPACES));

/**
 * Tool namespaces the editor workspace reads on every tool page: its own
 * strings, the Fix panel's OCR languages, the Stamp panel's number formats and
 * the opening screen. They ship everywhere, without their page-only keys.
 */
export const WORKSPACE_TOOL_NAMESPACES: ReadonlySet<ToolNamespace> = new Set<ToolNamespace>([
  'editPdf',
  'ocrPdf',
  'addPageNumbers',
  'extractImages',
]);

/**
 * Keys of a workspace tool namespace that only its own page renders: the FAQ,
 * and the guide sections under the editor on /edit-pdf.
 */
export const PAGE_ONLY_KEYS: ReadonlySet<string> = new Set(['faq', 'guide']);

/** Everything but the tool namespaces, plus the workspace's tool namespaces minus their page-only keys. */
export function sharedClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const shared: AbstractIntlMessages = {};
  for (const [key, value] of Object.entries(messages)) {
    if (!TOOL_NAMESPACES.has(key)) {
      shared[key] = value;
    } else if (WORKSPACE_TOOL_NAMESPACES.has(key as ToolNamespace) && typeof value === 'object') {
      shared[key] = Object.fromEntries(Object.entries(value).filter(([k]) => !PAGE_ONLY_KEYS.has(k)));
    }
  }
  return shared;
}

/** The one tool namespace a tool route adds on top of the shared messages. */
export function pageClientMessages(messages: AbstractIntlMessages, namespace: ToolNamespace): AbstractIntlMessages {
  return { [namespace]: messages[namespace] };
}
