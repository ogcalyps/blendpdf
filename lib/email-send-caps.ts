import { createHash } from 'node:crypto';

/**
 * Caps on the file email, kept in memory (one Node process serves the site):
 * a few files per recipient per day, and a ceiling per hour for everyone.
 * Without them /api/send-file-email could mail any address as often as the
 * per-IP rate limit allowed, from rotating IPs (security review, 2026-11-12).
 * Addresses are only held as SHA-256 hashes. A restart forgets the counts,
 * which is fine for caps this far above real use.
 */
export const PER_RECIPIENT_PER_DAY = 5;
export const GLOBAL_PER_HOUR = 60;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
/** Prune empty recipients once the map holds this many. */
const PRUNE_AT = 10_000;

const recipients = new Map<string, number[]>();
let everyone: number[] = [];

export type EmailSlot = { ok: true; firstToday: boolean } | { ok: false; reason: 'recipient' | 'global' };

/** Count one email to `address` if both caps allow it. firstToday: no other file went to it in the last 24 h. */
export function takeEmailSlot(address: string, now = Date.now()): EmailSlot {
  const key = createHash('sha256').update(address.trim().toLowerCase()).digest('hex');
  everyone = everyone.filter((t) => now - t < HOUR);
  const sent = (recipients.get(key) ?? []).filter((t) => now - t < DAY);
  if (sent.length >= PER_RECIPIENT_PER_DAY) {
    recipients.set(key, sent);
    return { ok: false, reason: 'recipient' };
  }
  if (everyone.length >= GLOBAL_PER_HOUR) return { ok: false, reason: 'global' };
  sent.push(now);
  recipients.set(key, sent);
  everyone.push(now);
  if (recipients.size > PRUNE_AT) {
    for (const [k, times] of recipients) if (!times.some((t) => now - t < DAY)) recipients.delete(k);
  }
  return { ok: true, firstToday: sent.length === 1 };
}

/** Tests only. */
export function resetEmailSlots(): void {
  recipients.clear();
  everyone = [];
}
