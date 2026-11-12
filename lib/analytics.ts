/**
 * Usage events, sent two ways from one call.
 *
 * trackEvent(name, params) is the single entry point:
 * - Google Analytics (GA4) through gtag, when it is loaded. It runs in Consent
 *   Mode (components/GoogleAnalytics.tsx, components/ConsentBanner.tsx), so the
 *   banner's choice governs what GA keeps; an ad blocker or a missing GA ID
 *   makes this half a no-op.
 * - First-party, for every visitor, through sendEvent: one empty, cookie-free
 *   POST to /api/ev whose query lib/events.ts encodes (enum values, slugs and
 *   small numbers only: never a file name, typed text or error message).
 *   It does not depend on gtag, consent or Global Privacy Control: every
 *   visitor is counted, and nothing in the query identifies anyone (its visit
 *   ID lives in the page's memory and is gone on reload).
 *
 * Nothing else calls gtag('event', ...) (tests/first-party-events.test.ts),
 * so no event can reach GA without its first-party copy.
 *
 * Standard events:
 * - tool_process_start    { tool_name, processing_method, file_count, total_size_mb }
 * - tool_process_complete { tool_name, processing_method, duration_ms, ... }
 * - tool_process_error    { tool_name, processing_method, duration_ms, error_message }
 * - file_upload           { tool_name, upload_source, upload_role, file_count, total_size_mb }
 * - file_download         { tool_name, file_extension }
 * - email_capture_submitted / delivery_choice { tool_name, ... }
 * - email_sent            { tool_name }  (the file went out: a conversion, like file_download)
 * - email_send_failed     { tool_name, status }  (HTTP status, 'too_large', 'network' or 'timeout')
 * - review_prompt_shown   { tool_name }
 * - review_prompt_clicked { tool_name, action: 'review' | 'already' }
 * - consent_choice        { action: 'accept' | 'decline' }
 * - home_start            { to_tool }
 * - tool_pick             { tool_id, surface: 'toolbar' | 'insert' | 'all_tools' }
 * - all_tools_open / save_open / choose_another
 * - save_plan             { format, options, page_count }
 * page_view goes first-party only (sendEvent from components/PageViewTracker):
 * GA's own page_view is sent by components/GoogleAnalytics.tsx.
 *
 * Browser runs are also counted on their own: see sendRunBeacon.
 */

import { encodeEvent, eventPage, EVENT_PATH } from './events';
import { runPath, runToolForGa, type RunOutcome } from './run-tools';

export function trackEvent(name: string, params?: Record<string, unknown>): void {
  // First-party first, and whatever GA's state: an ad blocker hides GA, not us.
  sendEvent(name, params);
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  try {
    window.gtag('event', name, params);
  } catch {
    // Analytics must never break the app
  }
}

/** This page load's visit ID (lib/events.ts `v`): made on the first event, kept in memory only. */
let visitId: string | null = null;
/** The next event's position in the visit. */
let nextSeq = 0;

const VISIT_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** 10 random characters from [a-z0-9]. Not stored anywhere: a reload makes a new one. */
function newVisitId(): string {
  const bytes = new Uint8Array(10);
  const crypto = globalThis.crypto;
  if (crypto && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => VISIT_ALPHABET[b % VISIT_ALPHABET.length]).join('');
}

/** The back office is never tracked (as in components/GoogleAnalytics.tsx). */
const isAdminPath = (path: string) => path === '/admin' || path.startsWith('/admin/');

/**
 * Send one first-party event: `POST /api/ev?<query>` (lib/events.ts), which
 * nginx logs and the back office counts. For every visitor: no consent or
 * Global Privacy Control check, since the query carries nothing that
 * identifies anyone (encodeEvent drops any param outside its table and any
 * value that doesn't fit, and sends nothing for an unknown event).
 *
 * The transport is sendRunBeacon's, for the same reason: a fetch with
 * credentials 'omit' and keepalive, never navigator.sendBeacon, which always
 * attaches the site's cookies. Never throws.
 */
export function sendEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  try {
    const path = window.location.pathname;
    if (isAdminPath(path)) return;
    const page = eventPage(path);
    if (page === null) return;
    const locale = ['ar', 'fr', 'es'].find((l) => path === `/${l}` || path.startsWith(`/${l}/`)) ?? 'en';
    visitId ??= newVisitId();
    const query = encodeEvent(name, { visit: visitId, seq: nextSeq, page, locale }, params);
    if (query === null) return;
    nextSeq++;
    void fetch(`${EVENT_PATH}?${query}`, { method: 'POST', keepalive: true, credentials: 'omit' }).catch(() => {});
  } catch {
    // Counting must never break the app
  }
}

/** Derive the tool slug from the current URL, e.g. /merge-pdf and /ar/merge-pdf/faq → merge_pdf, / and /ar → home */
export function currentToolFromPath(): string {
  if (typeof window === 'undefined') return 'unknown';
  const segments = window.location.pathname.split('/').filter(Boolean);
  // English has no locale prefix (localePrefix 'as-needed'): /merge-pdf, /ar/merge-pdf, and /ar, /fr or /es alone is the home page
  if (segments[0] === 'ar' || segments[0] === 'fr' || segments[0] === 'es' || segments[0] === 'en') segments.shift();
  const slug = segments[0] || 'home';
  return slug.replace(/-/g, '_');
}

/** Summarize a set of files into the count/size params every file event carries. */
export function fileSizeMeta(files: File[]): { file_count: number; total_size_mb: number } {
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  return {
    file_count: files.length,
    total_size_mb: Math.round((totalBytes / 1024 / 1024) * 100) / 100,
  };
}

function fileMeta(args: unknown[]): { file_count: number; total_size_mb: number } | undefined {
  const files = args
    .flat()
    .filter((a): a is File => typeof File !== 'undefined' && a instanceof File);
  if (files.length === 0) return undefined;
  return fileSizeMeta(files);
}

/**
 * The anonymous run counter: a finished browser run (params.processing_method
 * === 'client') sends one empty POST to /api/run/<tool>/<ok|error>, which the
 * back office counts from the nginx log. GA sees only a few percent of
 * visitors, and a tool that never reaches the server is otherwise invisible.
 *
 * The URL carries two enum values and nothing else: no file data, no ID, no
 * body. Like sendEvent it counts every visitor (no consent or Global Privacy
 * Control check: there is nothing in it to identify anyone) and does not
 * depend on gtag (an ad blocker hides GA, not the run). It skips a client
 * failure the page retries on the server (params.server_fallback), which the
 * server's own log line counts.
 *
 * The transport is a fetch with credentials 'omit', never navigator.sendBeacon:
 * sendBeacon always attaches the site's cookies (NEXT_LOCALE, and GA's _ga
 * client ID after Accept), and the privacy page promises the request carries
 * no cookie or ID. The run ends while the page is open, so sendBeacon's
 * survive-the-unload guarantee buys nothing; keepalive covers a tab closed
 * right after. No fetch (no browser this site supports) means no count.
 */
function sendRunBeacon(gaTool: string, outcome: RunOutcome, params?: Record<string, unknown>): void {
  if (params?.processing_method !== 'client' || params.server_fallback === true) return;
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;
  const tool = runToolForGa(gaTool);
  if (!tool) return;
  try {
    void fetch(runPath(tool, outcome), { method: 'POST', keepalive: true, credentials: 'omit' }).catch(() => {});
  } catch {
    // Counting must never break the app
  }
}

export function trackToolStart(tool: string, params?: Record<string, unknown>): void {
  trackEvent('tool_process_start', { tool_name: tool, ...params });
}

export function trackToolComplete(tool: string, durationMs: number, params?: Record<string, unknown>): void {
  trackEvent('tool_process_complete', { tool_name: tool, duration_ms: durationMs, ...params });
  sendRunBeacon(tool, 'ok', params);
}

/** An Error carrying the HTTP status (and errorCode) of the response that produced it. */
export interface ApiError extends Error {
  status?: number;
  errorCode?: string;
}

/**
 * Build the Error for a failed fetch, with the response's status attached.
 *
 * Use this for EVERY `if (!response.ok) throw ...` on a tool page. The status is
 * what lets trackToolError tell "we declined bad input" from "we broke"; a bare
 * `new Error(message)` loses it and silently lands in the failure bucket. This is
 * the same shared-helper-got-bypassed shape as downloadBlob and useTrackedDropzone.
 *
 * @param message - already-localized copy for the user; never raw server text.
 */
export function responseError(
  response: { status: number },
  message: string,
  errorCode?: string
): ApiError {
  const error = new Error(message) as ApiError;
  error.status = response.status;
  if (errorCode) error.errorCode = errorCode;
  return error;
}

/**
 * A 4xx is the tool working: we looked at the input and correctly declined it
 * (wrong password, not a PDF, over the size cap, rate limited). A 5xx — or a
 * thrown error with no status at all, which is a client-side crash — is the
 * tool failing.
 *
 * These used to share one event, so `tool_process_error` counted both. In the
 * 6 Aug - 2 Sept window that read as unlock_pdf failing on 5 of 6 attempts
 * when every one of those five was a wrong password. Splitting them keeps
 * `tool_process_error` meaning "we broke", which is the number worth alerting
 * on, and gives `tool_input_rejected` for the UX question of how often people
 * hand us something we can't take.
 */
function isInputRejection(error: unknown): boolean {
  const status = (error as ApiError | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500;
}

export function trackToolError(tool: string, error: unknown, durationMs?: number, params?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  const { status, errorCode } = (error ?? {}) as ApiError;
  trackEvent(isInputRejection(error) ? 'tool_input_rejected' : 'tool_process_error', {
    tool_name: tool,
    error_message: message.slice(0, 100),
    ...(status !== undefined ? { status_code: status } : {}),
    ...(errorCode !== undefined ? { error_code: errorCode } : {}),
    ...(durationMs !== undefined ? { duration_ms: durationMs } : {}),
    ...params,
  });
  sendRunBeacon(tool, 'error', params);
}

/** Where the files came from: 'home' is a file dropped on the home page and handed to the tool it opens. */
export type UploadSource = 'local' | 'keep_working' | 'home';

/**
 * Fire file_upload for a set of accepted files.
 *
 * Prefer the shared entry points over calling this directly: the
 * useTrackedDropzone hook covers every drag-and-drop/file-picker path, so no
 * upload can silently go uncounted (the same reason downloadBlob owns
 * trackDownload).
 *
 * @param role - which slot the file filled; 'document' is the file the tool
 *   operates on, anything else is a secondary asset (watermark image,
 *   signature image, spreadsheet of form data).
 */
export function trackFileUpload(
  files: File[],
  source: UploadSource = 'local',
  role: string = 'document'
): void {
  if (files.length === 0) return;
  trackEvent('file_upload', {
    tool_name: currentToolFromPath(),
    upload_source: source,
    upload_role: role,
    ...fileSizeMeta(files),
  });
}

/**
 * Fire file_download. Only the extension leaves the browser: the filename is
 * usually built from the visitor's own upload (`${baseName}_numbered.pdf`), and
 * gtag runs in Consent Mode advanced, so event params reach Google even for
 * visitors who declined analytics. The site promises documents are never
 * tracked, so the name must never be an event param.
 */
export function trackDownload(filename: string): void {
  trackEvent('file_download', {
    tool_name: currentToolFromPath(),
    file_extension: fileExtension(filename),
  });
}

/** The extension, or 'unknown' when what follows the last dot is not one we could have produced. */
function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  const ext = dot === -1 ? '' : filename.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{1,5}$/.test(ext) ? ext : 'unknown';
}

export type ToolTrackingOptions = {
  /**
   * For a browser attempt the page retries on the server when it fails: true
   * for the errors it will retry. Their error event carries
   * server_fallback: true, so the run counter waits for the server's answer
   * instead of counting the run twice.
   */
  fallsBackToServer?: (error: unknown) => boolean;
};

/**
 * Wrap an async processing function so it fires start/complete/error events
 * automatically. File args are summarized into file_count/total_size_mb.
 */
export function withToolTracking<A extends unknown[], R>(
  tool: string,
  method: 'server' | 'client',
  fn: (...args: A) => Promise<R>,
  options: ToolTrackingOptions = {}
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const meta = { page_slug: currentToolFromPath(), ...fileMeta(args) };
    const started = Date.now();
    trackToolStart(tool, { processing_method: method, ...meta });
    try {
      const result = await fn(...args);
      trackToolComplete(tool, Date.now() - started, { processing_method: method, ...meta });
      return result;
    } catch (error) {
      const fallback = options.fallsBackToServer?.(error) === true;
      trackToolError(tool, error, Date.now() - started, {
        processing_method: method,
        ...meta,
        ...(fallback ? { server_fallback: true } : {}),
      });
      throw error;
    }
  };
}
