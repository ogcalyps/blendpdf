/**
 * First-party usage events: what visitors do on the site, from landing to
 * download, counted for everyone (the cookie banner's choice governs Google
 * Analytics, not this). One table serves the page side (lib/analytics:
 * sendEvent), the route (app/api/ev) and the back office's log rollup, so
 * the three can never disagree on a name or a value.
 *
 * Transport: `POST /api/ev?<query>` with no body, no cookie (credentials
 * 'omit') and keepalive. nginx's access-log line is the record; the route
 * only answers 204 for a query decodeEvent accepts and 404 for anything else,
 * so a scanner's guesses never look like events in the logs.
 *
 * Privacy, by construction: the query holds enum values, slugs and small
 * numbers only. Never a file name, file content, text the visitor typed or a
 * stored ID. `v` is a random visit ID kept in the page's memory: it ties one
 * tab's events together (client navigations keep it) and is gone on reload.
 * The back office keeps daily totals, never a visit ID.
 *
 * No imports: public pages and the route must never pull in the back office.
 */

export const EVENT_PATH = '/api/ev';
/** The longest query decodeEvent accepts (a real event is well under half of it). */
export const MAX_EVENT_QUERY = 600;

/**
 * Every event the site sends. The GA events (lib/analytics trackEvent) are
 * mirrored as they are; the rest are first-party only.
 */
export const EVENTS = [
  // Navigation
  'page_view',
  'consent_choice',
  'home_start',
  // A tool's file and its run (GA names)
  'file_upload',
  'tool_process_start',
  'tool_process_complete',
  'tool_process_error',
  'tool_input_rejected',
  // The workspace
  'tool_pick',
  'all_tools_open',
  'save_open',
  'save_plan',
  'choose_another',
  // Delivery (GA names)
  'file_download',
  'delivery_choice',
  'email_capture_submitted',
  'email_capture_skipped',
  'email_sent',
  'email_send_failed',
  // After the result (GA names)
  'keep_working',
  'review_prompt_shown',
  'review_prompt_clicked',
] as const;
export type EventName = (typeof EVENTS)[number];

/**
 * A delivered file: what the back office counts as a conversion. Not
 * email_capture_submitted: it fires only for a new address, before the send.
 */
export const CONVERSION_EVENTS: ReadonlyArray<EventName> = ['file_download', 'email_sent'];

const SLUG = /^[a-z0-9_]{1,40}$/;
const WORD = /^[a-z_]{1,24}$/;
const CAMEL = /^[a-zA-Z]{1,24}$/;

type Param = {
  /** The short key in the query. */
  key: string;
  /** What a sent value must look like (as a string). */
  valid: RegExp;
};

/**
 * The params an event may carry, by the name the page passes (GA's names for
 * the GA events). Anything else is dropped by encodeEvent and refused by
 * decodeEvent. Free text (GA's error_message) is never sent.
 */
export const EVENT_PARAMS: Readonly<Record<string, Param>> = {
  // page_view
  landing: { key: 'lp', valid: /^1$/ },
  referrer_host: { key: 'r', valid: /^[a-z0-9.-]{1,100}$/ },
  utm_source: { key: 'u', valid: /^[a-z0-9_.-]{1,40}$/ },
  device: { key: 'd', valid: /^(phone|tablet|desktop)$/ },
  // consent_choice, review_prompt_clicked
  action: { key: 'act', valid: WORD },
  // tools and runs
  tool_name: { key: 't', valid: SLUG },
  processing_method: { key: 'm', valid: /^(client|server)$/ },
  upload_source: { key: 'src', valid: WORD },
  upload_role: { key: 'role', valid: WORD },
  file_count: { key: 'n', valid: /^\d{1,3}$/ },
  total_size_mb: { key: 'mb', valid: /^\d{1,5}(\.\d{1,2})?$/ },
  duration_ms: { key: 'ms', valid: /^\d{1,7}(\.\d{1,2})?$/ },
  status_code: { key: 'sc', valid: /^[1-5]\d\d$/ },
  error_code: { key: 'ec', valid: /^[A-Za-z0-9_]{1,40}$/ },
  server_fallback: { key: 'fb', valid: /^(true|false)$/ },
  // the workspace: tool_pick (an All tools id or an editor tool), save_plan
  tool_id: { key: 'id', valid: CAMEL },
  surface: { key: 'su', valid: WORD },
  format: { key: 'f', valid: CAMEL },
  options: { key: 'o', valid: /^[a-z]+(,[a-z]+){0,9}$/ },
  page_count: { key: 'pg', valid: /^\d{1,4}$/ },
  // delivery
  file_extension: { key: 'ext', valid: /^[a-z0-9]{1,7}$/ },
  choice: { key: 'ch', valid: WORD },
  marketing_consent: { key: 'mc', valid: /^(true|false)$/ },
  status: { key: 'es', valid: /^[a-z0-9_]{1,20}$/ },
  // keep_working, home_start
  from_tool: { key: 'from', valid: SLUG },
  to_tool: { key: 'to', valid: SLUG },
};

const BY_KEY = new Map(Object.entries(EVENT_PARAMS).map(([name, p]) => [p.key, { name, valid: p.valid }]));
const EVENT_SET: ReadonlySet<string> = new Set(EVENTS);

/** The envelope every event carries, besides its params. */
const VISIT = /^[a-z0-9]{10}$/;
const SEQ = /^\d{1,4}$/;
/** The page without its locale prefix: '/', '/merge-pdf', '/forms/rent-receipt'. */
const PAGE = /^\/[a-z0-9/-]{0,80}$/;
const LOCALES = ['en', 'ar', 'fr', 'es'] as const;
export type EventLocale = (typeof LOCALES)[number];

export type DecodedEvent = {
  event: EventName;
  visit: string;
  seq: number;
  page: string;
  locale: EventLocale;
  /** By param name (EVENT_PARAMS' keys), as sent. */
  params: Record<string, string>;
};

export function isEventName(name: string): name is EventName {
  return EVENT_SET.has(name);
}

/**
 * The query for one event, without the leading `?`. Params outside
 * EVENT_PARAMS, nullish ones and ones that don't match are left out (never a
 * reason to lose the event). Null when the event or the envelope is invalid.
 */
export function encodeEvent(
  event: string,
  envelope: { visit: string; seq: number; page: string; locale: string },
  params: Record<string, unknown> = {},
): string | null {
  if (!isEventName(event)) return null;
  const seq = String(envelope.seq);
  if (!VISIT.test(envelope.visit) || !SEQ.test(seq) || !PAGE.test(envelope.page)) return null;
  if (!(LOCALES as ReadonlyArray<string>).includes(envelope.locale)) return null;
  const parts = [`e=${event}`, `v=${envelope.visit}`, `s=${seq}`, `p=${encodeURIComponent(envelope.page)}`, `l=${envelope.locale}`];
  for (const [name, raw] of Object.entries(params)) {
    const param = EVENT_PARAMS[name];
    if (!param || raw === null || raw === undefined) continue;
    const value = typeof raw === 'number' ? (Number.isFinite(raw) ? String(Math.round(raw * 100) / 100) : '') : String(raw);
    if (param.valid.test(value)) parts.push(`${param.key}=${encodeURIComponent(value)}`);
  }
  const query = parts.join('&');
  return query.length <= MAX_EVENT_QUERY ? query : null;
}

/**
 * The event a query describes, or null for anything that isn't exactly what
 * encodeEvent produces: an unknown event or key, a bad value, a repeated key,
 * a missing envelope field or an over-long query. Takes the query with or
 * without its `?`.
 */
export function decodeEvent(query: string): DecodedEvent | null {
  const q = query.startsWith('?') ? query.slice(1) : query;
  if (q.length === 0 || q.length > MAX_EVENT_QUERY) return null;
  const seen = new Map<string, string>();
  for (const part of q.split('&')) {
    const eq = part.indexOf('=');
    if (eq <= 0) return null;
    const key = part.slice(0, eq);
    let value: string;
    try {
      value = decodeURIComponent(part.slice(eq + 1));
    } catch {
      return null;
    }
    if (seen.has(key)) return null;
    seen.set(key, value);
  }
  const event = seen.get('e');
  const visit = seen.get('v');
  const seq = seen.get('s');
  const page = seen.get('p');
  const locale = seen.get('l');
  if (!event || !isEventName(event) || !visit || !VISIT.test(visit) || !seq || !SEQ.test(seq)) return null;
  if (!page || !PAGE.test(page) || !locale || !(LOCALES as ReadonlyArray<string>).includes(locale)) return null;
  const params: Record<string, string> = {};
  for (const [key, value] of seen) {
    if (key === 'e' || key === 'v' || key === 's' || key === 'p' || key === 'l') continue;
    const param = BY_KEY.get(key);
    if (!param || !param.valid.test(value)) return null;
    params[param.name] = value;
  }
  return { event, visit, seq: Number(seq), page, locale: locale as EventLocale, params };
}

/**
 * The page part of a pathname: the locale prefix and any trailing slash
 * removed, lower-cased, '/' for the home page. Null for a path the PAGE
 * pattern can't hold (the event is then not sent).
 */
export function eventPage(pathname: string): string | null {
  let path = pathname.toLowerCase().replace(/\/+$/, '');
  for (const locale of LOCALES) {
    if (path === `/${locale}`) path = '';
    else if (path.startsWith(`/${locale}/`)) path = path.slice(locale.length + 1);
  }
  const page = path === '' ? '/' : path;
  return PAGE.test(page) ? page : null;
}
