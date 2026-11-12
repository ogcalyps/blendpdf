/**
 * The analytics choice the consent banner stores in localStorage. The banner
 * writes it and GA's consent default reads it (components/GoogleAnalytics.tsx
 * replays it on later visits), so the key and values live here once. It
 * governs Google Analytics only: the first-party counts (lib/analytics.ts
 * sendEvent and the run counter) carry nothing that identifies anyone and
 * count every visitor.
 */
export const CONSENT_STORAGE_KEY = 'blendpdf-consent';
export const CONSENT_GRANTED = 'granted';
/** The visitor clicked "No thanks". */
export const CONSENT_DENIED = 'denied';

/** Record the banner's choice in localStorage. Never throws. */
export function recordConsentChoice(granted: boolean): void {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, granted ? CONSENT_GRANTED : CONSENT_DENIED);
  } catch {
    // Storage unavailable: the choice holds for this page load only (GA starts denied on the next).
  }
}
