/**
 * The anonymous run counter's allowlist: the tool runs that happen in the
 * browser, which the server logs cannot otherwise see. One table serves the
 * page side (lib/analytics), the route (app/api/run/[tool]/[outcome]) and the
 * back office's log rollup (lib/backoffice/nginx/tools.ts), so the three can
 * never disagree on a name.
 *
 * Imports only the site's locale list: public pages and the route must never
 * pull in the back office.
 *
 * - run: the name in the URL and in daily_tool. A tool the server also runs
 *   keeps the name TOOL_ENDPOINTS gives it (merge, split, rotate-pdf...).
 * - ga: the tool_name the page hands trackToolComplete / trackToolError.
 * - page: the tool page's path without its locale prefix. Every real run
 *   loads it that day (tool pages are not cached), which is how the rollup
 *   tells a run from a forged POST.
 * - where: 'browser' never reaches the server; 'hybrid' runs in the browser
 *   and only uploads files over the worker limit (the server counts those).
 * - reserved: allowlisted ahead of a page that has not shipped yet.
 */

import { locales } from '../i18n';

export type RunTool = {
  run: string;
  ga: string;
  page: string;
  where: 'browser' | 'hybrid';
  reserved?: true;
};

export const RUN_TOOLS: ReadonlyArray<RunTool> = [
  { run: 'crop-pdf', ga: 'crop_pdf', page: '/crop-pdf', where: 'browser' },
  { run: 'extract-pages', ga: 'extract_pages', page: '/extract-pages', where: 'browser' },
  { run: 'extract-images', ga: 'extract_images', page: '/extract-images', where: 'browser' },
  { run: 'flatten-pdf', ga: 'flatten_pdf', page: '/flatten-pdf', where: 'browser' },
  { run: 'pdf-to-text', ga: 'pdf_to_text', page: '/pdf-to-text', where: 'browser' },
  { run: 'remove-metadata', ga: 'remove_metadata', page: '/remove-metadata', where: 'browser' },
  { run: 'sign-pdf', ga: 'sign_pdf', page: '/sign-pdf', where: 'browser' },
  // The fill on every /forms/<template> page (lib/pdf-generation.ts).
  { run: 'form-templates', ga: 'fill_form_template', page: '/forms/*', where: 'browser' },
  { run: 'edit-pdf', ga: 'edit_pdf', page: '/edit-pdf', where: 'browser' },
  { run: 'merge', ga: 'merge_pdf', page: '/merge-pdf', where: 'hybrid' },
  { run: 'split', ga: 'split_pdf', page: '/split-pdf', where: 'hybrid' },
  { run: 'rotate-pdf', ga: 'rotate_pdf', page: '/rotate-pdf', where: 'hybrid' },
  { run: 'reorder-pdf', ga: 'reorder_pdf', page: '/reorder-pdf', where: 'hybrid' },
  { run: 'delete-pages', ga: 'delete_pages', page: '/delete-pages', where: 'hybrid' },
  { run: 'add-page-numbers', ga: 'add_page_numbers', page: '/add-page-numbers', where: 'hybrid' },
  { run: 'watermark-pdf', ga: 'watermark_pdf', page: '/watermark-pdf', where: 'hybrid' },
];

/**
 * Pages that open the workspace (the PDF editor with every tool): a save on
 * any of them can run any browser tool, e.g. a crop on /compress-pdf. The
 * rollup pairs a beacon with a page by this list, not only by `page`.
 */
export const WORKSPACE_PAGES: ReadonlyArray<string> = [
  '/edit-pdf', '/sign-pdf', '/crop-pdf', '/rotate-pdf', '/delete-pages', '/reorder-pdf', '/extract-pages',
  '/split-pdf', '/merge-pdf', '/watermark-pdf', '/add-page-numbers', '/compress-pdf', '/protect-pdf',
  '/unlock-pdf', '/repair-pdf', '/ocr-pdf', '/flatten-pdf', '/remove-metadata', '/pdf-to-word', '/pdf-to-excel',
  '/pdf-to-images', '/pdf-to-text', '/extract-images', '/word-to-pdf', '/powerpoint-to-pdf', '/excel-to-pdf',
  '/images-to-pdf', '/pdf-to-pdfa',
];

export const RUN_OUTCOMES = ['ok', 'error'] as const;
export type RunOutcome = (typeof RUN_OUTCOMES)[number];

const BY_RUN = new Map(RUN_TOOLS.map((t) => [t.run, t]));
const BY_GA = new Map(RUN_TOOLS.map((t) => [t.ga, t]));
const BY_PAGE = new Map(RUN_TOOLS.filter((t) => !t.page.endsWith('/*')).map((t) => [t.page, t]));
const PREFIX_PAGES = RUN_TOOLS.filter((t) => t.page.endsWith('/*')).map((t) => ({ prefix: t.page.slice(0, -1), tool: t }));

export function isRunTool(name: string): boolean {
  return BY_RUN.has(name);
}

export function isRunOutcome(name: string): name is RunOutcome {
  return (RUN_OUTCOMES as ReadonlyArray<string>).includes(name);
}

/** The table's own run name for a value from a URL (a constant, never a slice of the input). */
export function runToolName(name: string): string | null {
  return BY_RUN.get(name)?.run ?? null;
}

/** The run name for a GA tool_name ('merge_pdf' → 'merge'); null for a tool the counter does not take. */
export function runToolForGa(gaTool: string): string | null {
  return BY_GA.get(gaTool)?.run ?? null;
}

export function runPath(tool: string, outcome: RunOutcome): string {
  return `/api/run/${tool}/${outcome}`;
}

/**
 * The run tool whose page this path is: `/crop-pdf`, `/ar/crop-pdf/`,
 * `/fr/crop-pdf` or `/en/crop-pdf` → `crop-pdf`; `/ar/forms/nda` →
 * `form-templates`. Null for any other path.
 */
export function runToolForPage(path: string): string | null {
  const p = pagePath(path);
  const exact = BY_PAGE.get(p);
  if (exact) return exact.run;
  for (const { prefix, tool } of PREFIX_PAGES) {
    if (p.startsWith(prefix) && /^[a-z0-9-]+$/i.test(p.slice(prefix.length))) return tool.run;
  }
  return null;
}

const WORKSPACE_RUNS = RUN_TOOLS.filter((t) => !t.page.endsWith('/*')).map((t) => t.run);
const WORKSPACE_PAGE_SET = new Set(WORKSPACE_PAGES);

/**
 * Every run tool a visit to this path can account for: its own run (as
 * runToolForPage), plus, on a workspace page, every browser tool the
 * workspace runs (form templates have their own pages).
 */
export function runToolsForPage(path: string): string[] {
  const own = runToolForPage(path);
  if (WORKSPACE_PAGE_SET.has(pagePath(path))) return WORKSPACE_RUNS;
  return own ? [own] : [];
}

/** Any locale prefix the site serves (English has none, but /en/… still resolves). */
const LOCALE_PREFIX = new RegExp(`^/(?:${locales.join('|')})(?=/|$)`);

/** The path without its locale prefix or a trailing slash. */
function pagePath(path: string): string {
  let p = path.replace(LOCALE_PREFIX, '');
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}
