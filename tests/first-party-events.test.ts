/**
 * The page side of the first-party events (lib/events.ts is the contract,
 * tests/events.test.ts its own suite):
 *
 * - sendEvent: one empty, cookie-free keepalive POST to /api/ev per event,
 *   for every visitor (also after "No thanks" and with Global Privacy
 *   Control), with one visit ID per page load and a rising seq.
 * - trackEvent mirrors every GA event there, with or without gtag, and no
 *   file name or error message rides along.
 * - POST /api/ev answers 204 only for what encodeEvent sends.
 * - page_view: the landing details on the visit's first view only.
 * - The new events are wired where the visitor clicks.
 * - Nothing calls gtag('event', ...) except lib/analytics.ts (and GA's own
 *   page_view), so no event can skip its first-party copy.
 *
 * The suite runs in node: each test installs a fake window, document,
 * navigator and fetch, and loads fresh modules (the visit ID and seq live in
 * module memory, as they do in a page load).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as route from '../app/api/ev/route';
import { CONVERT_TOOLS, FILE_TOOLS } from '../components/edit-pdf/Toolbar';
import { ALL_TOOLS } from '../components/edit-pdf/workspace-rules';
import { CONSENT_DENIED, CONSENT_GRANTED, CONSENT_STORAGE_KEY } from '../lib/consent';
import { decodeEvent, encodeEvent, EVENT_PATH, type DecodedEvent } from '../lib/events';
import { startPageFor } from '../lib/home-start';
import { deviceFor, pageViewParams, referrerHost, utmSource } from '../lib/page-view';
import { savePlanParams } from '../lib/workspace/track';
import { DEFAULT_SAVE_PLAN, type SavePlan } from '../lib/workspace/types';

// The component's locale-aware Link is built on next/navigation, which only resolves inside Next
vi.mock('@/i18n/routing', () => ({ Link: () => null, useRouter: () => ({ push() {} }) }));
const { homeStartTool } = await import('../components/HomeDropZone');

const ROOT = join(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

type Fetch = { url: string; init: RequestInit };
type Env = { fetches: Fetch[]; beacons: string[]; gtag: unknown[][] };

function install(
  opts: {
    path?: string;
    search?: string;
    hostname?: string;
    referrer?: string;
    width?: number;
    consent?: string | null;
    gpc?: boolean;
    gtag?: boolean;
    crypto?: boolean;
  } = {},
): Env {
  const env: Env = { fetches: [], beacons: [], gtag: [] };
  const store = new Map<string, string>();
  if (opts.consent) store.set(CONSENT_STORAGE_KEY, opts.consent);
  vi.stubGlobal('window', {
    location: { pathname: opts.path ?? '/merge-pdf', search: opts.search ?? '', hostname: opts.hostname ?? 'blendpdf.com' },
    innerWidth: opts.width ?? 1280,
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) },
    ...(opts.gtag === false ? {} : { gtag: (...args: unknown[]) => env.gtag.push(args) }),
  });
  vi.stubGlobal('document', { referrer: opts.referrer ?? '' });
  // sendBeacon is always there, so a test sees it if the code ever reaches for it (it attaches cookies).
  vi.stubGlobal('navigator', {
    globalPrivacyControl: opts.gpc ?? false,
    sendBeacon: (url: string) => {
      env.beacons.push(url);
      return true;
    },
  });
  if (opts.crypto === false) vi.stubGlobal('crypto', undefined);
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    env.fetches.push({ url, init });
    return Promise.resolve(new Response(null, { status: 204 }));
  });
  return env;
}

/** Fresh modules: a new page load (no visit ID yet, seq from 0, no page_view sent). */
async function pageLoad() {
  vi.resetModules();
  return {
    analytics: await import('../lib/analytics'),
    pageView: await import('../lib/page-view'),
  };
}

/** What every event must look like: a POST with no body and no cookies. */
const NO_COOKIES = { method: 'POST', keepalive: true, credentials: 'omit' };

/** The events sent, decoded (null for a query the route would refuse). */
const events = (env: Env): (DecodedEvent | null)[] =>
  env.fetches.filter((f) => f.url.startsWith(`${EVENT_PATH}?`)).map((f) => decodeEvent(f.url.slice(EVENT_PATH.length)));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendEvent', () => {
  it('sends one empty, cookie-free keepalive POST to /api/ev that the route accepts', async () => {
    const env = install();
    const { analytics } = await pageLoad();
    analytics.sendEvent('save_open');
    expect(env.fetches).toHaveLength(1);
    expect(env.fetches[0].url.startsWith('/api/ev?e=save_open&')).toBe(true);
    expect(env.fetches[0].init).toEqual(NO_COOKIES);
    expect(env.beacons).toEqual([]);
    const [event] = events(env);
    expect(event).toMatchObject({ event: 'save_open', seq: 0, page: '/merge-pdf', locale: 'en', params: {} });
    expect(event!.visit).toMatch(/^[a-z0-9]{10}$/);
  });

  it('keeps one visit ID for the page load and counts seq up from 0', async () => {
    const env = install();
    const { analytics } = await pageLoad();
    analytics.sendEvent('all_tools_open');
    analytics.sendEvent('tool_pick', { tool_id: 'crop', surface: 'all_tools' });
    analytics.sendEvent('save_open');
    const sent = events(env);
    expect(sent.map((e) => e?.seq)).toEqual([0, 1, 2]);
    expect(new Set(sent.map((e) => e?.visit)).size).toBe(1);
    // A reload is a new visit
    const env2 = install();
    const next = await pageLoad();
    next.analytics.sendEvent('save_open');
    expect(events(env2)[0]?.seq).toBe(0);
    expect(events(env2)[0]?.visit).not.toBe(sent[0]?.visit);
  });

  it('makes a valid visit ID without crypto.getRandomValues', async () => {
    const env = install({ crypto: false });
    const { analytics } = await pageLoad();
    analytics.sendEvent('save_open');
    expect(events(env)[0]?.visit).toMatch(/^[a-z0-9]{10}$/);
  });

  it('sends for every visitor: after "No thanks", with Global Privacy Control, and both', async () => {
    for (const opts of [{ consent: CONSENT_DENIED }, { gpc: true }, { gpc: true, consent: CONSENT_DENIED }, { consent: CONSENT_GRANTED }]) {
      const env = install(opts);
      const { analytics } = await pageLoad();
      analytics.sendEvent('save_open');
      expect(events(env).map((e) => e?.event), JSON.stringify(opts)).toEqual(['save_open']);
      vi.unstubAllGlobals();
    }
  });

  it('takes the page and the locale from the path', async () => {
    for (const [path, page, locale] of [
      ['/', '/', 'en'],
      ['/merge-pdf', '/merge-pdf', 'en'],
      ['/en/merge-pdf/', '/merge-pdf', 'en'],
      ['/ar', '/', 'ar'],
      ['/ar/pdf-to-word', '/pdf-to-word', 'ar'],
      ['/arabic-pdf', '/arabic-pdf', 'en'],
    ]) {
      const env = install({ path });
      const { analytics } = await pageLoad();
      analytics.sendEvent('save_open');
      expect(events(env)[0], path).toMatchObject({ page, locale });
      vi.unstubAllGlobals();
    }
  });

  it('sends nothing when encodeEvent refuses (unknown event, a page it cannot hold) or in the back office', async () => {
    for (const [name, path] of [
      ['purchase', '/merge-pdf'],
      ['save_open', '/Contract for Sara.pdf'],
      ['save_open', '/admin'],
      ['save_open', '/admin/visitors'],
    ]) {
      const env = install({ path });
      const { analytics } = await pageLoad();
      analytics.sendEvent(name);
      expect(env.fetches, `${name} ${path}`).toEqual([]);
      vi.unstubAllGlobals();
    }
  });

  it('does not use up a seq on an event it refused', async () => {
    const env = install();
    const { analytics } = await pageLoad();
    analytics.sendEvent('purchase');
    analytics.sendEvent('save_open');
    expect(events(env)[0]?.seq).toBe(0);
  });

  it('never breaks the page when fetch throws or rejects', async () => {
    install();
    const { analytics } = await pageLoad();
    vi.stubGlobal('fetch', () => {
      throw new TypeError('keepalive quota');
    });
    expect(() => analytics.sendEvent('save_open')).not.toThrow();
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    expect(() => analytics.sendEvent('save_open')).not.toThrow();
    await Promise.resolve();
  });
});

describe('trackEvent mirrors GA to /api/ev', () => {
  it('sends the same event with its params under their short keys, with or without gtag', async () => {
    for (const gtag of [true, false]) {
      const env = install({ gtag, path: '/ar/compress-pdf' });
      const { analytics } = await pageLoad();
      analytics.trackEvent('tool_process_complete', { tool_name: 'compress_pdf', processing_method: 'server', duration_ms: 1834.4, page_slug: 'x' });
      expect(env.gtag.length, String(gtag)).toBe(gtag ? 1 : 0);
      expect(env.fetches[0].url).toContain('&t=compress_pdf&m=server&ms=1834.4');
      expect(events(env)[0], String(gtag)).toMatchObject({
        event: 'tool_process_complete',
        page: '/compress-pdf',
        locale: 'ar',
        params: { tool_name: 'compress_pdf', processing_method: 'server', duration_ms: '1834.4' },
      });
      vi.unstubAllGlobals();
    }
  });

  it('never sends an error message or a file name', async () => {
    const env = install({ path: '/pdf-to-word' });
    const { analytics } = await pageLoad();
    const error = Object.assign(new Error('Could not open Contract for Sara.pdf'), { status: 422, errorCode: 'TOO_MANY_PAGES' });
    analytics.trackToolError('pdf_to_word', error, 120, { processing_method: 'server' });
    analytics.trackDownload('Contract for Sara.pdf');
    expect(env.gtag.map((c) => c[1])).toEqual(['tool_input_rejected', 'file_download']);
    const urls = env.fetches.map((f) => f.url);
    expect(urls).toHaveLength(2);
    for (const url of urls) expect(url).not.toMatch(/Sara|Contract|error_message|Could/i);
    expect(events(env).map((e) => e && [e.event, e.params])).toEqual([
      ['tool_input_rejected', { tool_name: 'pdf_to_word', status_code: '422', error_code: 'TOO_MANY_PAGES', duration_ms: '120', processing_method: 'server' }],
      ['file_download', { tool_name: 'pdf_to_word', file_extension: 'pdf' }],
    ]);
  });

  it('mirrors a browser run once, beside its run beacon', async () => {
    const env = install({ path: '/edit-pdf' });
    const { analytics } = await pageLoad();
    analytics.trackToolComplete('crop_pdf', 10, { processing_method: 'client' });
    expect(env.fetches.map((f) => f.url.split('?')[0])).toEqual(['/api/ev', '/api/run/crop-pdf/ok']);
    expect(env.fetches.map((f) => f.init)).toEqual([NO_COOKIES, NO_COOKIES]);
  });
});

describe('POST /api/ev', () => {
  const ROUTE_FILE = 'app/api/ev/route.ts';
  const real = encodeEvent('save_plan', { visit: 'k3j9x0q2ab', seq: 3, page: '/compress-pdf', locale: 'ar' }, { format: 'pdf', options: 'compress', page_count: 12 })!;

  /** A request whose body is a sentinel: reading it would flip bodyUsed. */
  const post = (query: string) =>
    new Request(`https://blendpdf.com/api/ev${query}`, {
      method: 'POST',
      body: '{"file":"secret.pdf"}',
      headers: { 'content-type': 'application/json', cookie: 'a=b' },
    });

  it('answers 204 with no body for a real event', async () => {
    const response = await route.POST(post(`?${real}`));
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it.each([
    ['no query', ''],
    ['junk', '?hello=world'],
    ['an unknown key', `?${real}&email=a%40b.c`],
    ['an unknown event', `?${real.replace('e=save_plan', 'e=purchase')}`],
    ['a file name as a value', `?${real.replace('f=pdf', 'f=Contract%20for%20Sara.pdf')}`],
    ['a missing visit', `?${real.replace(/v=[^&]+&/, '')}`],
  ])('answers 404 for %s', async (_, query) => {
    const response = await route.POST(post(query));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
  });

  it('never reads the body, never sets a cookie and is never cached', async () => {
    for (const query of [`?${real}`, '?nope=1']) {
      const request = post(query);
      const response = await route.POST(request);
      expect(request.bodyUsed, query).toBe(false);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('handles POST only, is dynamic, and imports nothing that could store or log', () => {
    expect(Object.keys(route).filter((k) => /^[A-Z]+$/.test(k))).toEqual(['POST']);
    expect(route.dynamic).toBe('force-dynamic');
    const src = read(ROUTE_FILE);
    expect([...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1])).toEqual(['@/lib/events']);
    expect(src).not.toMatch(/console\.|logger|cookies\(|\.json\(\)|\.text\(\)|\.formData\(\)|\.arrayBuffer\(\)|\.body\b|rateLimit/);
  });

  it('is never rewritten by next-intl (the middleware skips /api)', () => {
    const matcher = /matcher:\s*\[\s*(?:\/\/.*\n\s*)*'([^']+)'/.exec(read('middleware.ts'))?.[1];
    expect(matcher).toBe('/((?!api|_next|_vercel|.*\\\\..*).*)');
    const re = new RegExp(`^${matcher!.replace(/\\\\/g, '\\')}$`);
    expect(re.test('/api/ev')).toBe(false);
    expect(re.test('/merge-pdf')).toBe(true);
  });
});

describe('page_view', () => {
  const context = { width: 1280, referrer: '', host: 'blendpdf.com', search: '' };

  it('carries the landing details on the first view only, and the device on every view', () => {
    const first = pageViewParams(true, { width: 390, referrer: 'https://www.Google.com/search?q=sara', host: 'blendpdf.com', search: '?utm_source=ChatGPT.com&x=1' });
    expect(first).toEqual({ landing: 1, device: 'phone', referrer_host: 'google.com', utm_source: 'chatgpt.com' });
    expect(pageViewParams(false, { width: 390, referrer: 'https://google.com/', host: 'blendpdf.com', search: '?utm_source=x' })).toEqual({ device: 'phone' });
  });

  it('keeps the referrer only for another site, and only its host', () => {
    expect(referrerHost('https://blendpdf.com/merge-pdf', 'blendpdf.com')).toBeUndefined();
    expect(referrerHost('https://www.blendpdf.com/', 'blendpdf.com')).toBeUndefined();
    expect(referrerHost('http://localhost:3000/', 'localhost')).toBeUndefined();
    expect(referrerHost('', 'blendpdf.com')).toBeUndefined();
    expect(referrerHost('not a url', 'blendpdf.com')).toBeUndefined();
    expect(referrerHost('https://chatgpt.com/c/123?file=Sara.pdf', 'blendpdf.com')).toBe('chatgpt.com');
    expect(referrerHost('https://WWW.Reddit.com/r/pdf', 'blendpdf.com')).toBe('reddit.com');
    expect(referrerHost('android-app://com.google.android.gm/', 'blendpdf.com')).toBe('com.google.android.gm');
    expect(pageViewParams(true, { ...context, referrer: 'https://blendpdf.com/ar' }).referrer_host).toBeUndefined();
  });

  it('reads utm_source only, lower-cased', () => {
    expect(utmSource('?utm_source=Newsletter&utm_medium=email')).toBe('newsletter');
    expect(utmSource('?utm_medium=email')).toBeUndefined();
    expect(utmSource('')).toBeUndefined();
    expect(utmSource('?gclid=Cj0KCQ')).toBe('gads');
    expect(utmSource('?wbraid=0AAAA&utm_source=Newsletter')).toBe('newsletter');
  });

  it('sorts the width into phone, tablet and desktop', () => {
    expect([0, 767, 768, 1023, 1024, 2560].map(deviceFor)).toEqual(['phone', 'phone', 'tablet', 'tablet', 'desktop', 'desktop']);
  });

  it('sends once per page, landing first, through sendEvent (GA has its own page_view)', async () => {
    const env = install({ path: '/', referrer: 'https://chatgpt.com/', search: '?utm_source=chatgpt.com', width: 800 });
    const { pageView } = await pageLoad();
    pageView.trackPageView('/');
    pageView.trackPageView('/'); // StrictMode runs the mount effect twice
    (window as unknown as { location: { pathname: string } }).location.pathname = '/merge-pdf';
    pageView.trackPageView('/merge-pdf');
    expect(env.gtag).toEqual([]);
    expect(events(env).map((e) => e && [e.event, e.seq, e.page, e.params])).toEqual([
      ['page_view', 0, '/', { landing: '1', device: 'tablet', referrer_host: 'chatgpt.com', utm_source: 'chatgpt.com' }],
      ['page_view', 1, '/merge-pdf', { device: 'tablet' }],
    ]);
  });

  it('is mounted once in the root layout, keyed on the pathname alone', () => {
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/import \{ PageViewTracker \} from "@\/components\/PageViewTracker";/);
    expect(layout.match(/<PageViewTracker \/>/g)).toHaveLength(1);
    const tracker = read('components/PageViewTracker.tsx');
    expect(tracker).toMatch(/const pathname = usePathname\(\);/);
    expect(tracker).toMatch(/useEffect\(\(\) => \{\s+if \(pathname\) trackPageView\(pathname\);\s+\}, \[pathname\]\);/);
    expect(tracker).not.toMatch(/useSearchParams/);
  });
});

describe('the new events', () => {
  const ENVELOPE = { visit: 'k3j9x0q2ab', seq: 0, page: '/edit-pdf', locale: 'en' };
  /** What the route would keep of these params. */
  const kept = (event: string, params: Record<string, unknown>) => decodeEvent(encodeEvent(event, ENVELOPE, params) ?? '')?.params;

  it('consent_choice: both buttons, after GA hears an Accept', () => {
    const banner = read('components/ConsentBanner.tsx');
    const decide = /const decide = \(granted: boolean\) => \{([\s\S]*?)\n {2}\};/.exec(banner)?.[1] ?? '';
    expect(decide).toMatch(/trackEvent\('consent_choice', \{ action: granted \? 'accept' : 'decline' \}\);/);
    expect(decide.indexOf("trackEvent('consent_choice'")).toBeGreaterThan(decide.indexOf("window.gtag('consent', 'update'"));
    expect(banner).toMatch(/onClick=\{\(\) => decide\(false\)\}/);
    expect(banner).toMatch(/onClick=\{\(\) => decide\(true\)\}/);
    for (const action of ['accept', 'decline']) expect(kept('consent_choice', { action })).toEqual({ action });
  });

  it('home_start: the page a dropped file opens, as a slug', () => {
    const files = ['a.pdf', 'a.docx', 'a.pptx', 'a.xlsx', 'a.png'].map((name) => new File(['x'], name));
    const tools = files.map((f) => homeStartTool(startPageFor(f)!));
    expect(tools).toEqual(['edit_pdf', 'word_to_pdf', 'powerpoint_to_pdf', 'excel_to_pdf', 'images_to_pdf']);
    for (const to_tool of tools) expect(kept('home_start', { to_tool })).toEqual({ to_tool });
    const zone = read('components/HomeDropZone.tsx');
    expect(zone).toMatch(/if \(problem\) return;\s+const file = accepted\[0\];\s+const page = startPageFor\(file\)!;\s+trackEvent\('home_start', \{ to_tool: homeStartTool\(page\) \}\);/);
  });

  it('tool_pick: every toolbar tool, Insert kind and All tools row fits tool_id', () => {
    const union = (file: string, type: string) => {
      const body = new RegExp(`export type ${type} =([^;]+);`).exec(read(file))?.[1] ?? '';
      return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    };
    const toolbar = union('components/edit-pdf/state.ts', 'EditorTool');
    const insert = union('components/edit-pdf/Toolbar.tsx', 'InsertKind');
    const allTools = ALL_TOOLS.flatMap((g) => g.items);
    expect(toolbar).toContain('rectangle');
    expect(insert).toContain('dateHijri');
    expect(allTools.length).toBeGreaterThan(25);
    const fileTools = [...FILE_TOOLS.flat().filter((id) => id !== 'convert'), ...CONVERT_TOOLS];
    for (const [surface, ids] of [['toolbar', toolbar], ['insert', insert], ['all_tools', allTools], ['file_tools', fileTools]] as const) {
      for (const tool_id of ids) expect(kept('tool_pick', { tool_id, surface }), `${surface} ${tool_id}`).toEqual({ tool_id, surface });
    }
  });

  it('save_plan: format, the options that are on (sorted) and the page count', () => {
    const plan = (over: Partial<SavePlan>): SavePlan => ({ ...DEFAULT_SAVE_PLAN, ...over });
    expect(savePlanParams(plan({}), 3)).toEqual({ format: 'pdf', page_count: 3 });
    expect(savePlanParams(plan({ compress: 'low', password: 'Sara1990', removeMetadata: true, flatten: true, pages: 'selected' }), 12)).toEqual({
      format: 'pdf',
      options: 'compress,flatten,metadata,password,selected',
      page_count: 12,
    });
    expect(savePlanParams(plan({ split: { kind: 'every', n: 2 } }), 4).options).toBe('split');
    expect(savePlanParams(plan({ alsoSelected: true }), 4).options).toBe('also');
    // What the save does: a PDF-only choice left on a Word save is not on
    expect(savePlanParams(plan({ format: 'word', compress: 'high', password: 'x', removeMetadata: true }), 2)).toEqual({ format: 'word', page_count: 2 });
    expect(savePlanParams(plan({ password: '' }), 1).options).toBeUndefined();
    // Never the password, and the route keeps every field
    const params = savePlanParams(plan({ compress: 'low', password: 'Sara1990', removeMetadata: true, flatten: true, pages: 'selected' }), 12);
    expect(JSON.stringify(params)).not.toContain('Sara');
    expect(kept('save_plan', params)).toEqual({ format: 'pdf', options: 'compress,flatten,metadata,password,selected', page_count: '12' });
    for (const format of ['pdf', 'word', 'excel', 'images', 'text', 'imagesInside'] as const) {
      expect(kept('save_plan', savePlanParams(plan({ format }), 1))?.format, format).toBe(format);
    }
  });

  describe('the editor wires them where the visitor clicks', () => {
    const source = read('components/edit-pdf/EditorWorkspace.tsx');
    const body = (start: RegExp) => {
      const at = source.search(start);
      expect(at, String(start)).toBeGreaterThan(-1);
      return source.slice(at, source.indexOf('\n  };\n', at));
    };

    it('tool_pick from the toolbar, its Insert menu, its second row, All tools and Fill again for the next person', () => {
      expect(source).toMatch(/\n {8}onTool=\{pickToolbarTool\}\n {8}onInsert=\{pickInsert\}\n/);
      expect(source).toMatch(/onPick=\{pickAllTool\}/);
      expect(source).toMatch(/fileTools=\{\{ onPick: pickFileTool, blocked: toolBlocked \}\}/);
      expect(body(/const pickToolbarTool = /)).toMatch(/trackEvent\('tool_pick', \{ tool_id: next, surface: 'toolbar' \}\);\s+setTool\(next\);$/);
      expect(body(/const pickInsert = /)).toMatch(/trackEvent\('tool_pick', \{ tool_id: kind, surface: 'insert' \}\);\s+onInsert\(kind\);$/);
      expect(body(/const pickAllTool = /)).toMatch(/trackEvent\('tool_pick', \{ tool_id: id, surface: 'all_tools' \}\);\s+runTool\(id\);$/);
      expect(body(/const pickFileTool = /)).toMatch(/trackEvent\('tool_pick', \{ tool_id: id, surface: 'file_tools' \}\);\s+runTool\(id\);$/);
      // Counted at the click only: runTool's own setTool/onInsert calls are not picks
      expect(body(/const runTool = /)).not.toMatch(/trackEvent/);
      expect(source).toMatch(/trackEvent\('tool_pick', \{ tool_id: 'nextPerson', surface: 'delivery' \}\);/);
      expect(source.match(/trackEvent\('tool_pick'/g)).toHaveLength(5);
    });

    it('all_tools_open when the panel opens (not when it closes)', () => {
      expect(source).toMatch(/settle\(\);\s+if \(!allTools\) trackEvent\('all_tools_open'\);\s+setAllTools\(allTools \? null : allToolsPlace\(button\)\);/);
    });

    it('save_open whenever the Save dialog opens', () => {
      expect(body(/const openDialog = /)).toMatch(/trackEvent\('save_open'\);\s+setDialog\(/);
      expect(source.match(/setDialog\(\{/g)).toHaveLength(1);
    });

    it('choose_another only when the visitor goes ahead', () => {
      expect(body(/const chooseAnother = /)).toMatch(/if \(dirty && !window\.confirm\(t\('discardConfirm'\)\)\) return;\s+trackEvent\('choose_another'\);\s+onClose\(\);$/);
    });

    it('save_plan when a save runs: after any fix it asks for first, right before runSave, with the doc\'s page count', () => {
      const save = /const save = useCallback\(([\s\S]*?)\n {2}\);/.exec(source)?.[1] ?? '';
      const tracked = save.indexOf("trackEvent('save_plan', savePlanParams(plan, s.doc.pages.length));");
      expect(tracked).toBeGreaterThan(save.indexOf("askFix(fix, { then: 'save', plan, pre });"));
      expect(tracked).toBeGreaterThan(save.indexOf('if (savingRef.current) return;'));
      expect(save.slice(tracked)).toMatch(/^trackEvent\('save_plan', [^;]+;\s+const result = await runSave\(input\);/);
      expect(source.match(/trackEvent\('save_plan'/g)).toHaveLength(1);
    });
  });
});

/** Every .ts/.tsx file under app, components, hooks and lib. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** gtag called with 'event' in any spelling: gtag('event', window.gtag?.("event", gtag(`event`. */
const GTAG_EVENT = /\bgtag\s*(?:\?\.)?\s*\(\s*['"`]event['"`]/;
/** Files that may: trackEvent itself, and GA's own page_view (sendEvent sends ours). */
const GTAG_EVENT_ALLOWED = ['lib/analytics.ts', 'components/GoogleAnalytics.tsx'];
/** A push straight into GA/GTM's queue skips trackEvent too. */
const DATALAYER_PUSH = /\bdataLayer\s*\.\s*push\s*\(/;
const DATALAYER_ALLOWED = ['components/GoogleAnalytics.tsx', 'components/GoogleTagManager.tsx'];

/** The files that break each rule. */
function bypasses(files: { file: string; src: string }[]) {
  return {
    gtag: files.filter((f) => GTAG_EVENT.test(f.src) && !GTAG_EVENT_ALLOWED.includes(f.file)).map((f) => f.file),
    dataLayer: files.filter((f) => DATALAYER_PUSH.test(f.src) && !DATALAYER_ALLOWED.includes(f.file)).map((f) => f.file),
    gaPageView: files.filter((f) => /\btrackEvent\(\s*['"]page_view['"]/.test(f.src)).map((f) => f.file),
  };
}

describe('nothing reaches GA without its first-party copy', () => {
  const files = ['app', 'components', 'hooks', 'lib'].flatMap((d) => sources(join(ROOT, d))).map((abs) => ({
    file: relative(ROOT, abs).split(sep).join('/'),
    src: readFileSync(abs, 'utf8'),
  }));

  it('calls gtag(\'event\', ...) only in trackEvent (and GA\'s own page_view), and pushes to dataLayer only in the GA and GTM loaders', () => {
    expect(bypasses(files)).toEqual({ gtag: [], dataLayer: [], gaPageView: [] });
  });

  it('sees the real call sites (the scan is not vacuous)', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.filter((f) => GTAG_EVENT.test(f.src)).map((f) => f.file).sort()).toEqual(GTAG_EVENT_ALLOWED.slice().sort());
    // GTM's loader pushes through w[l], which the pattern doesn't see; GA's gtag() stub is dataLayer.push
    expect(files.filter((f) => DATALAYER_PUSH.test(f.src)).map((f) => f.file)).toEqual(['components/GoogleAnalytics.tsx']);
  });

  it('catches each way around it', () => {
    const one = (src: string) => bypasses([{ file: 'components/X.tsx', src }]);
    expect(one(`window.gtag('event', 'file_download', {});`).gtag).toEqual(['components/X.tsx']);
    expect(one(`window.gtag?.("event", name);`).gtag).toEqual(['components/X.tsx']);
    expect(one('gtag(`event`, name)').gtag).toEqual(['components/X.tsx']);
    expect(one(`window.dataLayer.push({ event: 'x' });`).dataLayer).toEqual(['components/X.tsx']);
    expect(one(`trackEvent('page_view', {});`).gaPageView).toEqual(['components/X.tsx']);
    expect(one(`window.gtag('consent', 'update', {}); trackEvent('save_open');`)).toEqual({ gtag: [], dataLayer: [], gaPageView: [] });
  });
});

describe('currentToolFromPath', () => {
  it.each([
    ['/', 'home'],
    ['/ar', 'home'],
    ['/merge-pdf', 'merge_pdf'],
    ['/ar/merge-pdf', 'merge_pdf'],
    ['/merge-pdf/faq', 'merge_pdf'],
    ['/ar/merge-pdf/faq', 'merge_pdf'],
    ['/forms/rent-receipt', 'forms'],
  ])('%s → %s', async (pathname, tool) => {
    const { currentToolFromPath } = await import('@/lib/analytics');
    vi.stubGlobal('window', { location: { pathname } });
    try {
      expect(currentToolFromPath()).toBe(tool);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
