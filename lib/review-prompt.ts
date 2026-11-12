/**
 * The Trustpilot review ask on the success screen.
 *
 * We can't see whether someone actually reviewed us, so clicking through (or
 * saying they already did) is the proxy: after that we never ask again.
 * Everyone else sees the ask at most once per cooldown, so repeat users aren't
 * nagged on every download. Every successful user gets the same ask; there is
 * deliberately no "did you like it?" gate in front of it, because Trustpilot
 * forbids inviting only the people likely to leave a good review.
 */

const STATUS_KEY = 'blendpdf_review_status';
const LAST_SHOWN_KEY = 'blendpdf_review_prompt_last_shown';

export const REVIEW_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export const TRUSTPILOT_REVIEW_URL = `https://www.trustpilot.com/evaluate/${
  process.env.NEXT_PUBLIC_TRUSTPILOT_DOMAIN || 'blendpdf.com'
}`;

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    // Storage blocked (privacy settings, sandboxed frame)
    return null;
  }
}

/** Whether this success screen should carry the review ask. */
export function shouldAskForReview(
  now: number = Date.now(),
  storage: KeyValueStore | null = browserStorage()
): boolean {
  // Without storage we can't remember a dismissal, so asking would mean asking every time
  if (!storage) return false;
  try {
    if (storage.getItem(STATUS_KEY)) return false;
    const lastShown = Number(storage.getItem(LAST_SHOWN_KEY));
    // A timestamp from the future (clock change) counts as stale rather than hiding the ask forever
    const inCooldown = lastShown > 0 && lastShown <= now && now - lastShown < REVIEW_PROMPT_COOLDOWN_MS;
    return !inCooldown;
  } catch {
    return false;
  }
}

export function markReviewPromptShown(
  now: number = Date.now(),
  storage: KeyValueStore | null = browserStorage()
): void {
  try {
    storage?.setItem(LAST_SHOWN_KEY, String(now));
  } catch {
    // Quota or privacy mode: worst case the ask shows again next time
  }
}

/** The user went to Trustpilot, or told us they already reviewed: stop asking. */
export function markReviewed(
  how: 'clicked' | 'already',
  storage: KeyValueStore | null = browserStorage()
): void {
  try {
    storage?.setItem(STATUS_KEY, how);
  } catch {
    // Quota or privacy mode: worst case the ask shows again after the cooldown
  }
}

/**
 * The inline review ask on tools without a success screen (extract-images,
 * fill-form, form templates). 'undecided' until the first successful download.
 * An ask on screen stays up through later downloads until the user acts on it,
 * and once they have, it doesn't come back in the same visit.
 */
export type InlineReviewAsk = 'undecided' | 'asking' | 'skipped' | 'acted';

/**
 * Next state after a successful download. `eligible` is shouldAskForReview(),
 * read once for this success. An ask already showing is kept even though
 * showing it started the cooldown, which would otherwise make it vanish on the
 * next download.
 */
export function inlineReviewAskAfterSuccess(state: InlineReviewAsk, eligible: boolean): InlineReviewAsk {
  if (state === 'asking' || state === 'acted') return state;
  return eligible ? 'asking' : 'skipped';
}
