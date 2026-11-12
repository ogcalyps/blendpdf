import { describe, it, expect, afterEach, vi } from 'vitest';
import { getClientIP } from '../lib/rate-limit';
import { normalizeEmail, signUnsubscribeEmail, verifyUnsubscribeSig } from '../lib/unsubscribe';

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/test', { headers });
}

describe('getClientIP (spoofing resistance)', () => {
  it('prefers x-real-ip when set by the proxy', () => {
    expect(
      getClientIP(req({ 'x-real-ip': '203.0.113.7', 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }))
    ).toBe('203.0.113.7');
  });

  it('takes the RIGHTMOST x-forwarded-for entry (the one nginx appends), not the client-controlled leftmost', () => {
    expect(getClientIP(req({ 'x-forwarded-for': 'spoofed-by-client, 198.51.100.9' }))).toBe('198.51.100.9');
  });

  it('a client sending a fake XFF with no proxy appendage still yields a stable single value', () => {
    expect(getClientIP(req({ 'x-forwarded-for': '1.2.3.4' }))).toBe('1.2.3.4');
  });
});

describe('unsubscribe HMAC', () => {
  it('round-trips sign → verify', () => {
    const sig = signUnsubscribeEmail('user@example.com');
    expect(verifyUnsubscribeSig('user@example.com', sig)).toBe(true);
  });

  it('rejects a tampered signature', () => {
    const sig = signUnsubscribeEmail('user@example.com');
    const tampered = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
    expect(verifyUnsubscribeSig('user@example.com', tampered)).toBe(false);
  });

  it('rejects a signature for a different email', () => {
    const sig = signUnsubscribeEmail('user@example.com');
    expect(verifyUnsubscribeSig('other@example.com', sig)).toBe(false);
  });

  it('normalizes email case/whitespace consistently', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe(normalizeEmail('user@example.com'));
  });

  it('rejects garbage signatures without throwing', () => {
    expect(verifyUnsubscribeSig('user@example.com', '')).toBe(false);
    expect(verifyUnsubscribeSig('user@example.com', 'zz')).toBe(false);
  });

  describe('production refuses a shipped default key', () => {
    // This source is published, so a hardcoded fallback secret would let anyone
    // forge an unsubscribe link for any address. Production must have no key
    // rather than a guessable one.
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('refuses to sign when the secret is missing', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UNSUBSCRIBE_SECRET', '');

      expect(() => signUnsubscribeEmail('user@example.com')).toThrow(/UNSUBSCRIBE_SECRET/);
    });

    it('treats every signature as invalid when the secret is missing', () => {
      // Signature minted with the non-production fallback key.
      const devSig = signUnsubscribeEmail('user@example.com');

      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UNSUBSCRIBE_SECRET', '');

      expect(verifyUnsubscribeSig('user@example.com', devSig)).toBe(false);
    });

    it('signs and verifies once a real secret is configured', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('UNSUBSCRIBE_SECRET', 'a'.repeat(64));

      const sig = signUnsubscribeEmail('user@example.com');
      expect(verifyUnsubscribeSig('user@example.com', sig)).toBe(true);
    });
  });
});
