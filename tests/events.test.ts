/**
 * The first-party event table (lib/events.ts): what encodeEvent sends is
 * exactly what decodeEvent accepts, nothing outside the table gets through
 * either way, no free text can ride along, and every event a page fires
 * through trackEvent is in the table.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeEvent, encodeEvent, eventPage, EVENT_PARAMS, EVENTS, isEventName, MAX_EVENT_QUERY } from '@/lib/events';

const ENVELOPE = { visit: 'k3j9x0q2ab', seq: 4, page: '/pdf-to-word', locale: 'en' };

describe('encodeEvent and decodeEvent agree', () => {
  it('round-trips an event with its params', () => {
    const query = encodeEvent('tool_process_complete', ENVELOPE, {
      tool_name: 'pdf_to_word',
      processing_method: 'server',
      duration_ms: 1834,
      file_count: 1,
      total_size_mb: 0.37,
      server_fallback: false,
    });
    expect(query).not.toBeNull();
    expect(decodeEvent(`?${query}`)).toEqual({
      event: 'tool_process_complete',
      visit: 'k3j9x0q2ab',
      seq: 4,
      page: '/pdf-to-word',
      locale: 'en',
      params: { tool_name: 'pdf_to_word', processing_method: 'server', duration_ms: '1834', file_count: '1', total_size_mb: '0.37', server_fallback: 'false' },
    });
  });

  it('round-trips a landing page view', () => {
    const query = encodeEvent('page_view', { ...ENVELOPE, seq: 0, page: '/' }, { landing: 1, referrer_host: 'chatgpt.com', utm_source: 'chatgpt.com', device: 'phone' });
    expect(decodeEvent(query!)?.params).toEqual({ landing: '1', referrer_host: 'chatgpt.com', utm_source: 'chatgpt.com', device: 'phone' });
  });

  it('drops params outside the table, free text and values that do not fit, but keeps the event', () => {
    const query = encodeEvent('tool_process_error', ENVELOPE, {
      tool_name: 'pdf_to_word',
      error_message: 'Could not open Contract for Sara Haddad.pdf',
      file_name: 'Contract.pdf',
      error_code: 'TOO MANY PAGES; DROP TABLE',
      status_code: 422,
      page_slug: 'pdf_to_word',
      tool_id: undefined,
    })!;
    expect(query).not.toMatch(/Sara|Contract|DROP|page_slug|error_message/);
    expect(decodeEvent(query)?.params).toEqual({ tool_name: 'pdf_to_word', status_code: '422' });
  });

  it('refuses an unknown event or a bad envelope at the source', () => {
    expect(encodeEvent('purchase', ENVELOPE)).toBeNull();
    expect(encodeEvent('page_view', { ...ENVELOPE, visit: 'short' })).toBeNull();
    expect(encodeEvent('page_view', { ...ENVELOPE, locale: 'de' })).toBeNull();
    expect(encodeEvent('page_view', { ...ENVELOPE, page: '/Contract for Sara.pdf' })).toBeNull();
    expect(encodeEvent('page_view', { ...ENVELOPE, seq: 10000 })).toBeNull();
  });
});

describe('decodeEvent refuses anything encodeEvent would not send', () => {
  const ok = encodeEvent('save_plan', ENVELOPE, { format: 'word', options: 'compress,password', page_count: 3 })!;

  it('accepts the real thing', () => {
    expect(decodeEvent(ok)).not.toBeNull();
  });

  it.each([
    ['an empty query', ''],
    ['an unknown key', `${ok}&email=a%40b.c`],
    ['a repeated key', `${ok}&f=pdf`],
    ['a missing visit', ok.replace(/v=[^&]+&/, '')],
    ['a missing page', ok.replace(/p=[^&]+&/, '')],
    ['an unknown event', ok.replace('e=save_plan', 'e=purchase')],
    ['a bad value', ok.replace('f=word', 'f=word%20doc')],
    ['a key with no value', `${ok}&pg`],
    ['broken percent-encoding', `${ok}&r=%E0%A4%A`],
    ['an over-long query', `${ok}&r=${'a'.repeat(MAX_EVENT_QUERY)}`],
  ])('refuses %s', (_, query) => {
    expect(decodeEvent(query)).toBeNull();
  });
});

describe('the table', () => {
  it('gives every param its own short key, none of them the envelope\'s', () => {
    const keys = Object.values(EVENT_PARAMS).map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const envelope of ['e', 'v', 's', 'p', 'l']) expect(keys).not.toContain(envelope);
  });

  it('has each event once', () => {
    expect(new Set(EVENTS).size).toBe(EVENTS.length);
  });
});

describe('eventPage', () => {
  it.each([
    ['/', '/'],
    ['/en', '/'],
    ['/ar', '/'],
    ['/ar/', '/'],
    ['/merge-pdf', '/merge-pdf'],
    ['/en/merge-pdf/', '/merge-pdf'],
    ['/ar/pdf-to-word', '/pdf-to-word'],
    ['/forms/Rent-Receipt', '/forms/rent-receipt'],
    ['/english-guide', '/english-guide'],
  ])('%s → %s', (path, page) => {
    expect(eventPage(path)).toBe(page);
  });

  it('gives null for a path the event cannot hold', () => {
    expect(eventPage('/merge pdf')).toBeNull();
    expect(eventPage(`/${'a'.repeat(90)}`)).toBeNull();
  });
});

/** Every .ts/.tsx file under these folders, tests and the back office left out. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === 'backoffice' ? [] : sources(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('every event a page sends is in the table', () => {
  const root = join(__dirname, '..');
  const files = ['app', 'components', 'hooks', 'lib'].flatMap((d) => sources(join(root, d)));

  it('covers every trackEvent name in the source (else the server would refuse it)', () => {
    const names = files.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\btrackEvent\(\s*['"]([a-z_]+)['"]/g)].map((m) => m[1]));
    expect(names.length).toBeGreaterThan(5);
    expect(names.filter((n) => !isEventName(n))).toEqual([]);
  });

  it('covers the names trackToolError picks between', () => {
    expect(isEventName('tool_process_error') && isEventName('tool_input_rejected')).toBe(true);
  });
});
