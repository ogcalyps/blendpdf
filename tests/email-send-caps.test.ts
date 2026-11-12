/**
 * The file email's caps (lib/email-send-caps.ts): anyone can ask the route to
 * mail any address, so one address gets a few files a day at most, everyone
 * together a ceiling per hour, and the Trustpilot invite goes out once per
 * address per day.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { GLOBAL_PER_HOUR, PER_RECIPIENT_PER_DAY, resetEmailSlots, takeEmailSlot } from '../lib/email-send-caps';

const T0 = Date.UTC(2026, 10, 12, 12);
const HOUR = 3_600_000;

afterEach(() => resetEmailSlots());

describe('file email caps', () => {
  it('lets one address get a few files a day, then refuses until a day has passed', () => {
    for (let i = 0; i < PER_RECIPIENT_PER_DAY; i++) {
      expect(takeEmailSlot('victim@example.com', T0 + i * HOUR)).toEqual({ ok: true, firstToday: i === 0 });
    }
    expect(takeEmailSlot('victim@example.com', T0 + 6 * HOUR)).toEqual({ ok: false, reason: 'recipient' });
    // Case and spaces don't make a new recipient
    expect(takeEmailSlot('  Victim@Example.COM ', T0 + 7 * HOUR)).toEqual({ ok: false, reason: 'recipient' });
    expect(takeEmailSlot('victim@example.com', T0 + 24 * HOUR + 1)).toEqual({ ok: true, firstToday: false });
    expect(takeEmailSlot('victim@example.com', T0 + 49 * HOUR)).toEqual({ ok: true, firstToday: true });
  });

  it('caps everyone together per hour, whatever the addresses', () => {
    for (let i = 0; i < GLOBAL_PER_HOUR; i++) expect(takeEmailSlot(`p${i}@example.com`, T0).ok).toBe(true);
    expect(takeEmailSlot('new@example.com', T0 + 1000)).toEqual({ ok: false, reason: 'global' });
    expect(takeEmailSlot('new@example.com', T0 + HOUR).ok).toBe(true);
  });

  it('does not count a refused send against the address', () => {
    for (let i = 0; i < GLOBAL_PER_HOUR; i++) takeEmailSlot(`p${i}@example.com`, T0);
    expect(takeEmailSlot('late@example.com', T0).ok).toBe(false);
    expect(takeEmailSlot('late@example.com', T0 + HOUR)).toEqual({ ok: true, firstToday: true });
  });
});
