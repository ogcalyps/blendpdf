/**
 * The PDF upload limits reference (/pdf-upload-limits): the largest file real
 * portals accept, each from the portal's own pages (or the government's), with
 * the sentence that says so. Published as a page and as CSV/JSON under CC BY 4.0.
 */

import type { PortalSlug } from '@/lib/size-limits/types';

export type LimitLocale = 'en' | 'fr' | 'ar';

export type LimitCategory = 'government' | 'immigration' | 'education' | 'employment' | 'housing' | 'tax' | 'health';

export interface UploadLimit {
  /** Stable id, also the row's anchor (#ants-carte-grise). */
  id: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** The portal's own name, as its site writes it. */
  portal: string;
  category: LimitCategory;
  /** What gets uploaded, per language. */
  what: Record<LimitLocale, string>;
  /** The limit in MB as the source means it (Mo = MB; 300 Ko = 0.3). */
  limitMb: number;
  /** Per file, or for everything uploaded together. */
  per: 'file' | 'total';
  /** As the source states it, in its language: "1 Mo", "4 MB". */
  stated: string;
  /** Accepted formats as the source states them, when it does. */
  formats?: string;
  sourceUrl: string;
  /** The source's own words, verbatim, containing the number. */
  quote: string;
  /** When we last read the source (YYYY-MM-DD). */
  checked: string;
  /** Its own /compress-pdf/for-… page, when it has one (lib/size-limits PORTALS). */
  page?: PortalSlug;
}

/** The words around the table, per language. */
export interface UploadLimitsChrome {
  title: string;
  metaTitle: string;
  description: string;
  intro: string;
  /** How rows were chosen and checked, one paragraph. */
  method: string;
  home: string;
  jumpTo: string;
  columns: { portal: string; what: string; limit: string; source: string };
  /** Opening and closing marks around a source's words, in the page's typography. */
  marks: [string, string];
  per: Record<UploadLimit['per'], string>;
  categories: Record<LimitCategory, string>;
  /** "Checked 12 Nov 2026" */
  checked: (date: string) => string;
  compress: (label: string) => string;
  /** On rows whose limit has no page of its own: what to set in the compressor. */
  compressHint: (label: string) => string;
  reuse: {
    title: string;
    text: string;
    /** The attribution line people paste. */
    citation: string;
    copy: string;
    copied: string;
    csv: string;
    json: string;
  };
  report: { before: string; after: string };
  faq: { question: string; answer: string }[];
}
