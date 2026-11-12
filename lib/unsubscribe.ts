/**
 * Unsubscribe link signing/verification.
 *
 * Emails captured in DynamoDB (see app/api/subscribe/route.ts) are keyed by
 * lowercase email. Unsubscribe links carry an HMAC-SHA256 signature so only
 * the recipient of an email we sent can flip their record to unsubscribed.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Used only outside production so the flow can be exercised without secrets.
 * Production never falls back to a constant: this source is published, so a
 * shipped default would let anyone forge an unsubscribe link for any address.
 */
const DEV_ONLY_SECRET = 'blendpdf-unsubscribe-dev-only';

/** The signing key, or null when production is missing UNSUBSCRIBE_SECRET. */
function getUnsubscribeSecret(): string | null {
  const configured = process.env.UNSUBSCRIBE_SECRET?.trim();
  if (configured) {
    return configured;
  }

  return process.env.NODE_ENV === 'production' ? null : DEV_ONLY_SECRET;
}

/** Normalize the same way app/api/subscribe/route.ts stores emails. */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** HMAC-SHA256(email) as lowercase hex. */
export function signUnsubscribeEmail(email: string): string {
  const secret = getUnsubscribeSecret();
  if (!secret) {
    // Refuse to mint a link we cannot later verify. Callers are on the send
    // path, so this surfaces as a failed send rather than an email with a
    // dead opt-out link.
    throw new Error('UNSUBSCRIBE_SECRET is not set; refusing to sign unsubscribe links');
  }

  return createHmac('sha256', secret).update(normalizeEmail(email)).digest('hex');
}

/** Constant-time verification of an unsubscribe signature. */
export function verifyUnsubscribeSig(email: string, sig: string): boolean {
  if (!email || !sig) {
    return false;
  }

  // No key means no way to validate; treat every link as invalid rather than
  // throwing, so the route can render its "invalid link" page.
  if (!getUnsubscribeSecret()) {
    return false;
  }

  const expected = Buffer.from(signUnsubscribeEmail(email), 'hex');
  let provided: Buffer;
  try {
    provided = Buffer.from(sig, 'hex');
  } catch {
    return false;
  }

  if (provided.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(expected, provided);
}

/** Absolute unsubscribe URL for the given recipient. */
export function buildUnsubscribeUrl(email: string): string {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com').replace(/\/$/, '');
  const normalized = normalizeEmail(email);
  return `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(normalized)}&sig=${signUnsubscribeEmail(normalized)}`;
}
