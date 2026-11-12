import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackToolComplete, trackToolError, withToolTracking } from '../lib/analytics';
import { ClientPdfError, fallsBackToServer } from '../lib/client-pdf';
import { CONSENT_DENIED, CONSENT_GRANTED, CONSENT_STORAGE_KEY } from '../lib/consent';

/**
 * The page side of the anonymous run counter: trackToolComplete/Error send
 * one empty, cookie-free POST to /api/run/<tool>/<ok|error> for a browser
 * run, for every visitor: also after "No thanks", with Global Privacy
 * Control, or when the choice cannot be read (the owner counts everyone; the
 * banner's choice governs GA only). The suite runs in node, so each test
 * installs a fake window and navigator. The same calls also send their
 * first-party event to /api/ev (tests/first-party-events.test.ts); these
 * tests look at the run beacons only.
 */

type Env = { beacons: string[]; fetches: { url: string; init: RequestInit }[]; gtag: unknown[][]; store: Map<string, string> };

function install(opts: {
  consent?: string | null;
  gpc?: boolean;
  storageThrows?: boolean;
  setItemThrows?: boolean;
  fetch?: 'ok' | 'missing' | 'throws' | 'rejects';
  gtag?: boolean;
} = {}): Env {
  const env: Env = { beacons: [], fetches: [], gtag: [], store: new Map() };
  if (opts.consent) env.store.set(CONSENT_STORAGE_KEY, opts.consent);
  const localStorage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new DOMException('denied', 'SecurityError');
      return env.store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.storageThrows || opts.setItemThrows) throw new DOMException('full', 'QuotaExceededError');
      env.store.set(k, v);
    },
  };
  vi.stubGlobal('window', {
    location: { pathname: '/en/crop-pdf' },
    localStorage,
    ...(opts.gtag === false ? {} : { gtag: (...args: unknown[]) => env.gtag.push(args) }),
  });
  // sendBeacon is always there, so a test sees it if the code ever reaches
  // for it: it would attach the site's cookies (GA's _ga ID after Accept).
  vi.stubGlobal('navigator', {
    globalPrivacyControl: opts.gpc ?? false,
    sendBeacon: (url: string) => {
      env.beacons.push(url);
      return true;
    },
  });
  const mode = opts.fetch ?? 'ok';
  vi.stubGlobal(
    'fetch',
    mode === 'missing'
      ? undefined
      : (url: string, init: RequestInit) => {
          env.fetches.push({ url, init });
          if (mode === 'throws') throw new TypeError('keepalive quota');
          if (mode === 'rejects') return Promise.reject(new TypeError('Failed to fetch'));
          return Promise.resolve(new Response(null, { status: 204 }));
        },
  );
  return env;
}

const CLIENT = { processing_method: 'client' };
/** What every run report must look like: a POST with no body and no cookies. */
const NO_COOKIES = { method: 'POST', keepalive: true, credentials: 'omit' };
/** The run beacons sent (the first-party /api/ev events are another suite's). */
const runFetches = (env: Env) => env.fetches.filter((f) => f.url.startsWith('/api/run/'));
const urls = (env: Env) => runFetches(env).map((f) => f.url);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the run beacon', () => {
  it('sends one empty POST per finished browser run, named as daily_tool names it', () => {
    const env = install();
    trackToolComplete('crop_pdf', 120, CLIENT);
    trackToolError('crop_pdf', new Error('boom'), 80, CLIENT);
    trackToolComplete('merge_pdf', 50, CLIENT);
    trackToolComplete('split_pdf', 50, CLIENT);
    trackToolComplete('fill_form_template', 50, CLIENT);
    expect(urls(env)).toEqual([
      '/api/run/crop-pdf/ok',
      '/api/run/crop-pdf/error',
      '/api/run/merge/ok',
      '/api/run/split/ok',
      '/api/run/form-templates/ok',
    ]);
  });

  it('carries no cookie: a keepalive fetch with credentials omit, never sendBeacon (which always sends cookies)', () => {
    const env = install({ consent: CONSENT_GRANTED });
    trackToolComplete('rotate_pdf', 10, CLIENT);
    trackToolError('rotate_pdf', new Error('x'), 10, CLIENT);
    expect(runFetches(env).map((f) => f.init)).toEqual([NO_COOKIES, NO_COOKIES]);
    expect(env.beacons).toEqual([]);
  });

  it('never breaks the page when fetch is missing, throws or rejects', async () => {
    for (const fetch of ['missing', 'throws', 'rejects'] as const) {
      const env = install({ fetch });
      expect(() => trackToolComplete('crop_pdf', 10, CLIENT), fetch).not.toThrow();
      expect(env.beacons, fetch).toEqual([]);
      await Promise.resolve();
      vi.unstubAllGlobals();
    }
  });

  it('carries nothing but the tool and the outcome: no file name, size, message or ID reaches the URL', () => {
    const env = install();
    trackToolComplete('sign_pdf', 99, { ...CLIENT, file_count: 1, total_size_mb: 3.2, page_slug: 'sign_pdf' });
    trackToolError('sign_pdf', new Error('Contrat Dupont.pdf is broken'), 10, CLIENT);
    expect(runFetches(env)).toEqual([
      { url: '/api/run/sign-pdf/ok', init: NO_COOKIES },
      { url: '/api/run/sign-pdf/error', init: NO_COOKIES },
    ]);
  });

  it('stays silent for server runs, untagged calls, retried client failures and unknown tools', () => {
    const env = install();
    trackToolComplete('compress_pdf', 10, { processing_method: 'server' });
    trackToolComplete('crop_pdf', 10);
    trackToolError('merge_pdf', new Error('worker crashed'), 10, { ...CLIENT, server_fallback: true });
    trackToolComplete('pdf_to_word', 10, CLIENT);
    expect(runFetches(env)).toEqual([]);
  });

  it('still counts when GA is blocked (no gtag)', () => {
    const env = install({ gtag: false });
    trackToolComplete('flatten_pdf', 10, CLIENT);
    expect(urls(env)).toEqual(['/api/run/flatten-pdf/ok']);
  });
});

describe('everyone is counted (the banner governs GA only)', () => {
  it('still uses the key and values the banner writes', () => {
    expect(CONSENT_STORAGE_KEY).toBe('blendpdf-consent');
    expect(CONSENT_DENIED).toBe('denied');
  });

  it('counts after "No thanks"', () => {
    const env = install({ consent: CONSENT_DENIED });
    trackToolComplete('crop_pdf', 10, CLIENT);
    trackToolError('crop_pdf', new Error('x'), 10, CLIENT);
    expect(urls(env)).toEqual(['/api/run/crop-pdf/ok', '/api/run/crop-pdf/error']);
    expect(runFetches(env).map((f) => f.init)).toEqual([NO_COOKIES, NO_COOKIES]);
    expect(env.beacons).toEqual([]);
  });

  it('counts when the browser sends Global Privacy Control, whatever the banner says', () => {
    for (const consent of [null, CONSENT_GRANTED, CONSENT_DENIED]) {
      const env = install({ gpc: true, consent });
      trackToolComplete('crop_pdf', 10, CLIENT);
      expect(urls(env), String(consent)).toEqual(['/api/run/crop-pdf/ok']);
      vi.unstubAllGlobals();
    }
  });

  it('counts when storage is blocked', () => {
    const env = install({ storageThrows: true });
    trackToolComplete('crop_pdf', 10, CLIENT);
    expect(urls(env)).toEqual(['/api/run/crop-pdf/ok']);
    expect(env.beacons).toEqual([]);
  });

  it('counts before any choice and after Accept', () => {
    for (const consent of [null, CONSENT_GRANTED]) {
      const env = install({ consent });
      trackToolComplete('crop_pdf', 10, CLIENT);
      expect(urls(env), String(consent)).toEqual(['/api/run/crop-pdf/ok']);
      vi.unstubAllGlobals();
    }
  });

  // Fresh modules: nothing a click leaves behind may leak into other tests.
  it('keeps counting for the rest of the page load after "No thanks", saved or not', async () => {
    for (const setItemThrows of [false, true]) {
      vi.resetModules();
      const consent = await import('../lib/consent');
      const analytics = await import('../lib/analytics');
      const env = install({ setItemThrows });
      analytics.trackToolComplete('crop_pdf', 10, CLIENT);
      expect(() => consent.recordConsentChoice(false)).not.toThrow();
      expect(env.store.get(CONSENT_STORAGE_KEY), String(setItemThrows)).toBe(setItemThrows ? undefined : CONSENT_DENIED);
      analytics.trackToolComplete('crop_pdf', 10, CLIENT);
      analytics.trackToolError('crop_pdf', new Error('x'), 10, CLIENT);
      expect(urls(env), String(setItemThrows)).toEqual(['/api/run/crop-pdf/ok', '/api/run/crop-pdf/ok', '/api/run/crop-pdf/error']);
      vi.unstubAllGlobals();
    }
  });

  it('stores the choice where the banner and GA read it', async () => {
    vi.resetModules();
    const consent = await import('../lib/consent');
    const env = install();
    consent.recordConsentChoice(true);
    expect(env.store.get(CONSENT_STORAGE_KEY)).toBe(CONSENT_GRANTED);
    consent.recordConsentChoice(false);
    expect(env.store.get(CONSENT_STORAGE_KEY)).toBe(CONSENT_DENIED);
  });
});

describe('withToolTracking and the run beacon', () => {
  let env: Env;
  beforeEach(() => {
    env = install();
  });

  it('fires exactly once for a browser run that works', async () => {
    const run = withToolTracking('sign_pdf', 'client', async () => 'done');
    await run();
    expect(urls(env)).toEqual(['/api/run/sign-pdf/ok']);
  });

  it('fires exactly once, as an error, for a browser failure the page will not retry', async () => {
    const run = withToolTracking('merge_pdf', 'client', async () => {
      throw new ClientPdfError('encrypted', 'ENCRYPTED_PDF', false);
    }, { fallsBackToServer });
    await expect(run()).rejects.toThrow('encrypted');
    expect(urls(env)).toEqual(['/api/run/merge/error']);
  });

  it('stays silent for a browser failure the page retries on the server (the server line counts it)', async () => {
    for (const error of [new ClientPdfError('timed out', 'TIMEOUT'), new TypeError('worker died')]) {
      const run = withToolTracking('split_pdf', 'client', async () => {
        throw error;
      }, { fallsBackToServer });
      await expect(run()).rejects.toBe(error);
    }
    expect(runFetches(env)).toEqual([]);
    // GA still sees the attempt, marked as a fallback.
    const errors = env.gtag.filter((c) => c[1] === 'tool_process_error').map((c) => c[2] as Record<string, unknown>);
    expect(errors.map((p) => p.server_fallback)).toEqual([true, true]);
  });

  it('never fires for a server-tracked run', async () => {
    await withToolTracking('compress_pdf', 'server', async () => 'ok')();
    await expect(
      withToolTracking('compress_pdf', 'server', async () => {
        throw new Error('500');
      })(),
    ).rejects.toThrow();
    expect(runFetches(env)).toEqual([]);
  });
});
