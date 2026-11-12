/**
 * State for the single "Your file is ready" panel (components/FileDeliveryPanel.tsx).
 *
 * One panel offers both deliveries at once: a Download button and an inline
 * email row. Kept pure so the transitions can be tested without a DOM.
 */

export const USER_EMAIL_KEY = 'blendpdf_user_email';
export const USER_CONSENT_KEY = 'blendpdf_user_consent';

/** How long a finished panel stays up before closing itself, when it has no review ask to carry. */
export const AUTO_CLOSE_MS = { email: 3000, download: 1500 } as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/**
 * Whether this is an address we haven't stored yet. Only a new address gets the
 * marketing-consent checkbox and counts as an email capture.
 */
export function isNewAddress(email: string, savedEmail: string | null): boolean {
  if (!savedEmail) return true;
  return email.trim().toLowerCase() !== savedEmail.trim().toLowerCase();
}

export type EmailPhase = 'idle' | 'sending' | 'failed' | 'sent';

export interface DeliveryState {
  email: EmailPhase;
  /** The address the file went to, once sent. */
  sentTo: string | null;
  downloaded: boolean;
  /** Decided once, on the first finished delivery; null until then. */
  askForReview: boolean | null;
}

export type DeliveryAction =
  | { type: 'sendStart' }
  | { type: 'sendResult'; ok: boolean; to: string; askForReview: boolean }
  | { type: 'download'; askForReview: boolean }
  | { type: 'reset' };

export const initialDeliveryState: DeliveryState = {
  email: 'idle',
  sentTo: null,
  downloaded: false,
  askForReview: null,
};

export function deliveryReducer(state: DeliveryState, action: DeliveryAction): DeliveryState {
  switch (action.type) {
    case 'sendStart':
      if (state.downloaded || state.email === 'sending' || state.email === 'sent') return state;
      return { ...state, email: 'sending' };

    case 'sendResult':
      // A result that arrives after the user downloaded instead is stale: ignore it
      if (state.email !== 'sending' || state.downloaded) return state;
      if (!action.ok) return { ...state, email: 'failed' };
      return {
        ...state,
        email: 'sent',
        sentTo: action.to,
        askForReview: state.askForReview ?? action.askForReview,
      };

    case 'download':
      return {
        ...state,
        // Downloading supersedes a send still in flight
        email: state.email === 'sending' ? 'idle' : state.email,
        downloaded: true,
        askForReview: state.askForReview ?? action.askForReview,
      };

    case 'reset':
      return initialDeliveryState;
  }
}

/** The panel has delivered the file one way or the other. */
export function isFinished(state: DeliveryState): boolean {
  return state.downloaded || state.email === 'sent';
}

/**
 * How the panel was completed, for the caller's reset logic: a page clears its
 * result only after the file went out by email (a downloader may want it again).
 */
export function deliveryOutcome(state: DeliveryState): 'email' | 'download' {
  return state.email === 'sent' ? 'email' : 'download';
}

/**
 * Delay before the panel closes itself, or null when it must stay open: while
 * the review ask shows, or while "Keep working on this file" is on offer
 * (holdOpen), since closing would take that choice away.
 */
export function autoCloseDelay(state: DeliveryState, holdOpen = false): number | null {
  if (holdOpen || !isFinished(state) || state.askForReview !== false) return null;
  return state.downloaded ? AUTO_CLOSE_MS.download : AUTO_CLOSE_MS.email;
}

/** "Rapport.final.pdf" → base "Rapport.final", extension ".pdf"; a name without one keeps it all as the base. */
export function splitFilename(filename: string): { base: string; extension: string } {
  const dot = filename.lastIndexOf('.');
  const extension = dot > 0 ? filename.slice(dot) : '';
  if (!/^\.[A-Za-z0-9]{1,5}$/.test(extension)) return { base: filename, extension: '' };
  return { base: filename.slice(0, dot), extension };
}

/**
 * The name to save or send the file under: what the visitor typed in the
 * panel, without what file systems refuse (/ \ : * ? " < > | and control
 * characters), with the extension the tool produced so the file still opens.
 * Typing the extension too doesn't double it; a blank name keeps ours.
 */
export function chosenFilename(typed: string, filename: string): string {
  const { base, extension } = splitFilename(filename);
  let clean = typed
    .replace(/[\\/:*?"<>|\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (extension && clean.toLowerCase().endsWith(extension.toLowerCase())) clean = clean.slice(0, -extension.length);
  clean = clean.replace(/^[.\s]+|[.\s]+$/g, '').slice(0, 150).trim();
  return (clean || base) + extension;
}

const SHARE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

/**
 * The type a file goes to the share sheet with: the blob's own when it has
 * one, else from the name. WhatsApp sends a typed PDF as a document; an
 * untyped one, some phones won't offer at all.
 */
export function shareType(blobType: string, filename: string): string {
  if (blobType) return blobType;
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  return SHARE_TYPES[ext] ?? 'application/octet-stream';
}
