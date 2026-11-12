export type ComparisonLocale = 'en' | 'fr' | 'ar' | 'es';

export const comparisonLocale = (locale: string): ComparisonLocale => (locale === 'fr' || locale === 'ar' || locale === 'es' ? locale : 'en');

/** A render of a saved test file, at 2x. `phone`: a crop that stays readable at 375 px. */
export interface ComparisonShot {
  key: 'original' | 'blendpdf' | 'them';
  src: string;
  width: number;
  height: number;
  phone?: { src: string; width: number; height: number };
}

/** The other service's own words, exactly as shown. `source`: the page they're on; none for words in its editor. */
export interface ComparisonQuote {
  text: string;
  lang: 'en' | 'ar';
  source?: string;
}

/** One page's words in one language. Text may mark a UI label in **bold**. */
export interface ComparisonText {
  metaTitle: string;
  description: string;
  title: string;
  /** When the claims were checked. */
  tested: string;
  /** The answer first: what happened, and how to do it here. */
  summary: string;
  cta: string;
  /** What the saved files show: one caption per shot. */
  evidence?: {
    title: string;
    intro: string;
    shots: Partial<Record<ComparisonShot['key'], { label: string; caption: string; alt: string }>>;
  };
  /** Around the quotes; `glosses` translate them, in order, when they're in another language. */
  quotes?: { title: string; intro: string; after?: string; glosses?: string[] };
  table: {
    title: string;
    head: [string, string, string];
    rows: { label: string; blendpdf: string; them: string }[];
    note: string;
  };
  /** Where the other service does well, said plainly. */
  strengths?: { title: string; items: string[] };
  faq: { question: string; answer: string }[];
  disclaimer: string;
  breadcrumb: string;
  /** One line on the /compare hub. */
  card: string;
}

export interface Comparison {
  slug: string;
  path: string;
  name: string;
  /** Which how-to the page shows: changing a line, or adding one. */
  howTo: 'edit' | 'add';
  /** False when we didn't test it hands-on (Adobe): no "check it yourself" steps then. */
  checkable?: boolean;
  shots: ComparisonShot[];
  quotes: ComparisonQuote[];
  text: Record<ComparisonLocale, ComparisonText>;
}

/** What every comparison page shares in one language: our limits, the how-tos, the labels. */
export interface ComparisonChrome {
  home: string;
  howTo: Record<Comparison['howTo'], { title: string; steps: string[] }>;
  limits: { title: string; intro: string; items: { title: string; text: string }[] };
  more: { title: string; links: { href: string; label: string }[] };
  /** Answers about BlendPDF that several pages ask. */
  faq: Record<'freeEdit' | 'upload' | 'font' | 'realText' | 'noAccount', { question: string; answer: string }>;
  /** Under a quote, around the link to where it was read. */
  source: { before: string; after: string };
  /** How to repeat our test on the test page we publish, per kind of test. */
  method: { title: string; intro: string; download: string; steps: Record<Comparison['howTo'], string[]> };
  /** Under the disclaimer, around the contact address: how to report something out of date. */
  correction: { before: string; after: string };
  hub: { metaTitle: string; description: string; title: string; intro: string; cta: string };
}
