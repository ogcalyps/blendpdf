/**
 * Unsubscribe link signing/verification.
 *
 * Emails captured in DynamoDB (see app/api/subscribe/route.ts) are keyed by
 * lowercase email. Unsubscribe links carry an HMAC-SHA256 signature so only
 * the recipient of an email we sent can flip their record to unsubscribed.
 */

import { createHmac, timingSafeEqual } from 'crypto';

function getUnsubscribeSecret(): string {
  return process.env.UNSUBSCRIBE_SECRET || 'blendpdf-unsubscribe-v1';
}

/** Normalize the same way app/api/subscribe/route.ts stores emails. */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** HMAC-SHA256(email) as lowercase hex. */
export function signUnsubscribeEmail(email: string): string {
  return createHmac('sha256', getUnsubscribeSecret())
    .update(normalizeEmail(email))
    .digest('hex');
}

/** Constant-time verification of an unsubscribe signature. */
export function verifyUnsubscribeSig(email: string, sig: string): boolean {
  if (!email || !sig) {
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
