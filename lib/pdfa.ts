/**
 * PDF/A: the levels /pdf-to-pdfa makes, and the veraPDF verdict that travels
 * back with the file. The route reads veraPDF's JSON report into a PdfaCheck
 * and sends it as X-PdfA-* headers next to the PDF; the page reads the same
 * headers back. One module so the two can't disagree on a name.
 *
 * No imports: the page bundle loads this too.
 */

/** The "b" (basic) levels: what Ghostscript can guarantee. "a" needs a tagged structure it drops. */
export type PdfaLevel = '1b' | '2b' | '3b';

/** In the order the page offers them: 2b is what most universities ask for. */
export const PDFA_LEVELS: readonly PdfaLevel[] = ['2b', '1b', '3b'];

export const DEFAULT_PDFA_LEVEL: PdfaLevel = '2b';

export function isPdfaLevel(value: unknown): value is PdfaLevel {
  return typeof value === 'string' && (PDFA_LEVELS as readonly string[]).includes(value);
}

export interface PdfaCheck {
  level: PdfaLevel;
  /** pass or fail: veraPDF's verdict on the file we made. unchecked: the file was made, but veraPDF didn't run. */
  status: 'pass' | 'fail' | 'unchecked';
  /** "veraPDF 1.30.4", or null when unchecked. */
  validator: string | null;
  /** Failed rules as "clause-test" (6.2.4.2-1), at most MAX_LISTED_RULES. */
  failedRules: string[];
  /**
   * PDF/A-1b only: pages that had text and came back as a picture, because
   * PDF/A-1 forbids transparency (lib/pdfa-pages.ts). How many, and the first
   * MAX_LISTED_PAGES of their 1-based numbers.
   */
  flattenedCount: number;
  flattenedPages: number[];
}

export const MAX_LISTED_RULES = 8;
export const MAX_LISTED_PAGES = 12;

export const PDFA_HEADERS = {
  level: 'X-PdfA-Level',
  status: 'X-PdfA-Check',
  validator: 'X-PdfA-Validator',
  failed: 'X-PdfA-Failed',
  flattened: 'X-PdfA-Flattened',
  flattenedPages: 'X-PdfA-Flattened-Pages',
} as const;

const RULE_ID = /^\d+(\.\d+)*-\d+$/;

/**
 * veraPDF's `--format json` report for one file: compliant or not, which
 * build checked it and the rules it failed. null when the report isn't one
 * (veraPDF crashed, ran out of memory, or couldn't parse the file).
 */
export function readVeraPdfReport(report: unknown): { compliant: boolean; validator: string | null; failedRules: string[] } | null {
  const root = (report as { report?: unknown } | null)?.report as
    | { buildInformation?: { releaseDetails?: { id?: unknown; version?: unknown }[] }; jobs?: unknown[] }
    | undefined;
  const job = root?.jobs?.[0] as { validationResult?: unknown[] } | undefined;
  const result = job?.validationResult?.[0] as
    | { compliant?: unknown; details?: { ruleSummaries?: { clause?: unknown; testNumber?: unknown }[] } }
    | undefined;
  if (!result || typeof result.compliant !== 'boolean') return null;

  const release = root?.buildInformation?.releaseDetails?.find((r) => r.id === 'apps') ?? root?.buildInformation?.releaseDetails?.[0];
  const version = typeof release?.version === 'string' && /^[\w.-]{1,20}$/.test(release.version) ? release.version : null;

  const failedRules = (result.details?.ruleSummaries ?? [])
    .map((rule) => `${rule.clause}-${rule.testNumber}`)
    .filter((id) => RULE_ID.test(id))
    .slice(0, MAX_LISTED_RULES);

  return { compliant: result.compliant, validator: version ? `veraPDF ${version}` : 'veraPDF', failedRules };
}

export function pdfaHeaders(check: PdfaCheck): Record<string, string> {
  return {
    [PDFA_HEADERS.level]: check.level,
    [PDFA_HEADERS.status]: check.status,
    ...(check.validator ? { [PDFA_HEADERS.validator]: check.validator } : {}),
    ...(check.failedRules.length > 0 ? { [PDFA_HEADERS.failed]: check.failedRules.join(',') } : {}),
    ...(check.flattenedCount > 0
      ? { [PDFA_HEADERS.flattened]: String(check.flattenedCount), [PDFA_HEADERS.flattenedPages]: check.flattenedPages.join(',') }
      : {}),
  };
}

/** The verdict back out of a response's headers. Anything unexpected reads as unchecked, never as a pass. */
export function pdfaCheckFromHeaders(get: (name: string) => string | null, requested: PdfaLevel): PdfaCheck {
  const level = get(PDFA_HEADERS.level);
  const status = get(PDFA_HEADERS.status);
  const validator = get(PDFA_HEADERS.validator);
  const failed = get(PDFA_HEADERS.failed);
  const flattened = get(PDFA_HEADERS.flattened);
  const flattenedCount = flattened && /^\d{1,6}$/.test(flattened) ? Number(flattened) : 0;
  return {
    level: isPdfaLevel(level) ? level : requested,
    status: status === 'pass' || status === 'fail' ? status : 'unchecked',
    validator: validator && /^veraPDF( [\w.-]{1,20})?$/.test(validator) ? validator : null,
    failedRules: (failed ?? '')
      .split(',')
      .filter((id) => RULE_ID.test(id))
      .slice(0, MAX_LISTED_RULES),
    flattenedCount,
    flattenedPages:
      flattenedCount > 0
        ? (get(PDFA_HEADERS.flattenedPages) ?? '')
            .split(',')
            .filter((page) => /^[1-9]\d{0,5}$/.test(page))
            .map(Number)
            .slice(0, MAX_LISTED_PAGES)
        : [],
  };
}

/** "PDF/A-2b" */
export function pdfaLabel(level: PdfaLevel): string {
  return `PDF/A-${level}`;
}
