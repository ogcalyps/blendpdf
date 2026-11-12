/**
 * The "BlendPDF vs X" pages and the /compare hub. Each page is what we saw on
 * 12 November 2026, dated on the page (EU comparative-advertising rules:
 * objective and verifiable): renders of the saved files, the other service's
 * own words quoted exactly, and where it does well. Server-only, like
 * lib/guides: no messages reach the browser.
 */
import { adobeAcrobat } from './adobe-acrobat';
import { CHROME } from './chrome';
import { ilovepdf } from './ilovepdf';
import { pdf24 } from './pdf24';
import { pdfbayt } from './pdfbayt';
import { pdfcandy } from './pdfcandy';
import { sejda } from './sejda';
import { smallpdf } from './smallpdf';
import { comparisonLocale, type Comparison, type ComparisonChrome, type ComparisonText } from './types';

export type { Comparison, ComparisonChrome, ComparisonQuote, ComparisonShot, ComparisonText } from './types';

export const COMPARE_PATH = '/compare';

/** In the order the hub lists them. */
export const COMPARISONS: readonly Comparison[] = [ilovepdf, smallpdf, sejda, pdf24, pdfcandy, adobeAcrobat, pdfbayt];

export function comparison(slug: string): Comparison {
  const found = COMPARISONS.find((c) => c.slug === slug);
  if (!found) throw new Error(`no comparison ${slug}`);
  return found;
}

export const comparisonText = (c: Comparison, locale: string): ComparisonText => c.text[comparisonLocale(locale)];

export const comparisonChrome = (locale: string): ComparisonChrome => CHROME[comparisonLocale(locale)];
