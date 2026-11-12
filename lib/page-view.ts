/**
 * page_view for the first-party events (lib/events.ts), sent by
 * components/PageViewTracker on load and on every client navigation. It goes
 * through sendEvent, not trackEvent: GA's own page_view is sent by
 * components/GoogleAnalytics.tsx.
 *
 * The visit's first view says how the visitor arrived: landing, the referring
 * site's host (never its path, and never our own host) and utm_source. Every
 * view says the device class, from the window width.
 */
import { sendEvent } from './analytics';

export type Device = 'phone' | 'tablet' | 'desktop';

export function deviceFor(width: number): Device {
  if (width < 768) return 'phone';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, '');

/** The referring site's host without `www.`, or undefined for no referrer, our own site or one that isn't a URL. */
export function referrerHost(referrer: string, ownHost: string): string | undefined {
  if (!referrer) return undefined;
  let host: string;
  try {
    host = bareHost(new URL(referrer).hostname);
  } catch {
    return undefined;
  }
  return host && host !== bareHost(ownHost) ? host : undefined;
}

/** Click ids Google Ads appends to a landing URL (same list as AD_CLICK_IDS in lib/backoffice/nginx/parse.ts). */
const AD_CLICK_IDS = ['gclid', 'gbraid', 'wbraid'];

/**
 * utm_source from a query string, lower-cased (encodeEvent drops a value that
 * doesn't fit), else 'gads' when the URL carries a Google Ads click id.
 */
export function utmSource(search: string): string | undefined {
  const params = new URLSearchParams(search);
  const value = params.get('utm_source')?.trim().toLowerCase();
  if (value) return value;
  return AD_CLICK_IDS.some((id) => params.get(id)?.trim()) ? 'gads' : undefined;
}

export interface PageViewContext {
  /** window.innerWidth */
  width: number;
  /** document.referrer */
  referrer: string;
  /** location.hostname: our own host, never reported as a referrer */
  host: string;
  /** location.search */
  search: string;
}

/** A page_view's params: the landing details on the visit's first view only, the device on every view. */
export function pageViewParams(first: boolean, context: PageViewContext): Record<string, unknown> {
  const device = deviceFor(context.width);
  if (!first) return { device };
  return {
    landing: 1,
    device,
    referrer_host: referrerHost(context.referrer, context.host),
    utm_source: utmSource(context.search),
  };
}

/** The pathname of the last page_view sent in this page load (null before the first). */
let lastPath: string | null = null;

/**
 * Send page_view for `pathname` unless it was the last one sent: React's
 * StrictMode runs a mount effect twice in development, and a re-render on
 * the same page is not a new view. Never throws.
 */
export function trackPageView(pathname: string): void {
  if (typeof window === 'undefined' || pathname === lastPath) return;
  const first = lastPath === null;
  lastPath = pathname;
  try {
    sendEvent(
      'page_view',
      pageViewParams(first, {
        width: window.innerWidth,
        referrer: document.referrer,
        host: window.location.hostname,
        search: window.location.search,
      }),
    );
  } catch {
    // Counting must never break the app
  }
}
