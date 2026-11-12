/**
 * "Compress a PDF to under N" pages (/compress-pdf/to-<n>) and pages for one
 * site's upload limit (/compress-pdf/for-<site>): the compress tool opened with
 * "Under a size limit" already set, and the answers people need when an upload
 * form refuses their file. Text may mark a UI label in **bold**.
 */

export type SizeTargetSlug = 'to-100kb' | 'to-200kb' | 'to-500kb' | 'to-1mb' | 'to-2mb';
export type PortalSlug = 'for-ants' | 'for-ircc' | 'for-campus-france' | 'for-anef' | 'for-caf' | 'for-france-travail';
export type PageLocale = 'en' | 'fr' | 'ar';

/** A limit and how much fits under it. */
export interface SizeLimit {
  /** What the size limit field opens with (MB, 1 MB = 1,000,000 bytes). */
  limitMb: number;
  /**
   * How many pages of a colour phone scan of an A4 page fit: at good quality
   * (100 dpi, about 90 KB a page) and at the smallest readable setting (36 dpi,
   * about 22 KB a page). Measured with FIT_STEPS' Ghostscript settings, Nov 2026.
   */
  pagesGood: number;
  pagesSmallest: number;
}

export interface SizeTarget extends SizeLimit {
  slug: SizeTargetSlug;
}

/** One site's upload rules, from its own help pages or its own replies. */
export interface PortalTarget extends SizeLimit {
  slug: PortalSlug;
  /** Only the languages its users search in; the page 404s in the others. */
  locales: readonly PageLocale[];
  sourceUrl: string;
  /** When we last read the source (YYYY-MM-DD). */
  checked: string;
}

export interface SizePageText {
  /** The page's heading. */
  title: string;
  /** <title>, with the brand. */
  metaTitle: string;
  description: string;
  /** Who asks for this size, one sentence. */
  whoAsks: string;
}

export interface PortalText extends SizePageText {
  /** "l’ANTS", "IRCC": as it reads in a sentence. */
  name: string;
  /** "ANTS": on the links between pages. */
  short: string;
  /** The tool its rules call for, like merging the pages of one document first. */
  link?: { href: string; text: string };
  /** What the site accepts and refuses, one rule per item. */
  rules: string[];
  /** What the source is: "ANTS reply on Services Publics+". */
  sourceName: string;
}

/** The words around every size page, per language. */
export interface SizeChrome {
  /** "100 KB", "1 MB", in the language's own units. */
  label: (limit: SizeLimit) => string;
  /** The answer first: what to press. */
  summary: (limit: SizeLimit) => string;
  fitsTitle: string;
  fits: (limit: SizeLimit) => string;
  tooBigTitle: string;
  /** With the tool that does it, when there is one. */
  tooBig: { title: string; text: string; link?: { href: string; text: string } }[];
  faq: (limit: SizeLimit) => { question: string; answer: string }[];
  otherSizes: string;
  /** The link to the step-by-step guide. */
  guide: string;
  /** The link to /pdf-upload-limits. */
  allLimits: string;
  home: string;
  compress: string;
  /** "What l’ANTS accepts" */
  rulesTitle: (name: string) => string;
  /** "Source: …, checked on …" */
  source: (sourceName: string, checked: string) => string;
  otherSites: string;
}
