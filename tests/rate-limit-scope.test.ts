/**
 * The rate limiter keeps one budget per route and IP (workspace-spec.md 8.4):
 * a workspace save can chain unlock, OCR, compress and protect, and with one
 * shared counter per IP those used up OCR's 5 before the visitor reached it.
 * The route is keyed as Next resolves it (an encoded spelling reaches the
 * same handler, so it shares the budget), and every call also counts against
 * one ceiling per IP across all routes, so per-route budgets don't add up.
 */
import { describe, expect, it } from 'vitest';
import { GLOBAL_MAX_REQUESTS, rateLimitMiddleware } from '../lib/rate-limit';

const request = (route: string, ip: string) => new Request(`http://localhost${route}`, { method: 'POST', headers: { 'x-real-ip': ip } });
const COMPRESS = { maxRequests: 20 };
const OCR = { maxRequests: 5 };
const EMAIL = { maxRequests: 10 };

describe('rateLimitMiddleware scope', () => {
  it('6 compress calls leave OCR its own 5', () => {
    const ip = '203.0.113.1';
    for (let i = 0; i < 6; i++) expect(rateLimitMiddleware(request('/api/compress', ip), COMPRESS).allowed).toBe(true);
    const ocr = rateLimitMiddleware(request('/api/ocr-pdf', ip), OCR);
    expect(ocr).toMatchObject({ allowed: true, remaining: 4 });
  });

  it('a route still refuses past its own limit', () => {
    const ip = '203.0.113.2';
    for (let i = 0; i < 5; i++) expect(rateLimitMiddleware(request('/api/ocr-pdf', ip), OCR).allowed).toBe(true);
    const sixth = rateLimitMiddleware(request('/api/ocr-pdf', ip), OCR);
    expect(sixth.allowed).toBe(false);
    expect(sixth.error).toMatch(/Too many requests/);
  });

  it('another IP on the same route has its own budget', () => {
    for (let i = 0; i < 6; i++) rateLimitMiddleware(request('/api/ocr-pdf', '203.0.113.3'), OCR);
    expect(rateLimitMiddleware(request('/api/ocr-pdf', '203.0.113.4'), OCR).allowed).toBe(true);
  });
});

describe('rateLimitMiddleware keys the route Next resolves', () => {
  it('an encoded spelling of the path shares the route\'s counter', () => {
    const ip = '203.0.113.10';
    const spellings = ['/api/ocr-pdf', '/api/ocr%2Dpdf', '/api/ocr%2dpdf', '/api/%6Fcr-pdf', '/api//ocr-pdf/'];
    for (const spelling of spellings) expect(rateLimitMiddleware(request(spelling, ip), OCR).allowed, spelling).toBe(true);
    expect(rateLimitMiddleware(request('/api/ocr%2Dpdf', ip), OCR).allowed).toBe(false);
    expect(rateLimitMiddleware(request('/api/ocr-pdf', ip), OCR).allowed).toBe(false);
  });

  it('send-file-email can\'t be refilled by spelling it differently', () => {
    const ip = '203.0.113.11';
    for (let i = 0; i < 10; i++) {
      const spelling = i % 2 ? '/api/send-file-email' : '/api/send%2Dfile%2Demail';
      expect(rateLimitMiddleware(request(spelling, ip), EMAIL).allowed).toBe(true);
    }
    expect(rateLimitMiddleware(request('/api/send%2Dfile-email', ip), EMAIL).allowed).toBe(false);
  });

  it('a malformed escape does not throw, and still counts against the IP', () => {
    const ip = '203.0.113.12';
    expect(rateLimitMiddleware(request('/api/ocr%E0%A4%A', ip), OCR).allowed).toBe(true);
  });
});

describe('rateLimitMiddleware ceiling across all routes', () => {
  const ROUTES = ['/api/compress', '/api/protect-pdf', '/api/unlock-pdf', '/api/repair-pdf', '/api/split', '/api/rotate-pdf', '/api/sign-pdf', '/api/watermark-pdf'];

  it(`refuses an IP past ${GLOBAL_MAX_REQUESTS} calls spread over routes that each still have budget`, () => {
    const ip = '203.0.113.20';
    for (let i = 0; i < GLOBAL_MAX_REQUESTS; i++) {
      expect(rateLimitMiddleware(request(ROUTES[i % ROUTES.length], ip), COMPRESS).allowed, `call ${i + 1}`).toBe(true);
    }
    const over = rateLimitMiddleware(request('/api/delete-pages', ip), COMPRESS);
    expect(over.allowed).toBe(false);
    expect(over.error).toMatch(/Too many requests/);
    // Another visitor is untouched
    expect(rateLimitMiddleware(request('/api/delete-pages', '203.0.113.21'), COMPRESS).allowed).toBe(true);
  });

  it('a workspace save chain (unlock, OCR, compress, protect, then email) with two retries passes', () => {
    const ip = '203.0.113.22';
    const chain: [string, { maxRequests: number }][] = [
      ['/api/unlock-pdf', { maxRequests: 20 }],
      ['/api/ocr-pdf', OCR],
      ['/api/compress', COMPRESS],
      ['/api/protect-pdf', { maxRequests: 20 }],
      ['/api/send-file-email', EMAIL],
    ];
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const [route, limit] of chain) {
        expect(rateLimitMiddleware(request(route, ip), limit).allowed, `${route} try ${attempt + 1}`).toBe(true);
      }
    }
  });
});
