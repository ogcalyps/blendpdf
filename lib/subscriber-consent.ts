/**
 * Which rows of the emails table may be emailed. Shared by the admin
 * Subscribers screen and the morning job's review requests.
 */

/** Addresses created before this were collected through a required checkbox: kept, flagged, never emailed. */
export const LEGACY_CUTOFF = '2026-08-10T15:13:26Z';

export type RawSubscriber = {
  email?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  source?: unknown;
  unsubscribed?: unknown;
  unsubscribedAt?: unknown;
};

/**
 * stub: no createdAt (an unsubscribe for an address never stored makes one);
 * unsubscribed; legacy: created before LEGACY_CUTOFF; opted_in: everyone else.
 */
export type Consent = 'opted_in' | 'legacy' | 'unsubscribed' | 'stub';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function classify(item: RawSubscriber, cutoff: string = LEGACY_CUTOFF): Consent {
  const created = typeof item.createdAt === 'string' && ISO_RE.test(item.createdAt) ? item.createdAt : null;
  if (!created) return 'stub';
  if (item.unsubscribed === true) return 'unsubscribed';
  return Date.parse(created) < Date.parse(cutoff) ? 'legacy' : 'opted_in';
}
