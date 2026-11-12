'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { trackEvent, currentToolFromPath } from '@/lib/analytics';
import { MAX_EMAIL_FILE_SIZE, pageLocale, sendFileByEmail } from '@/lib/send-file-by-email';
import { shouldAskForReview } from '@/lib/review-prompt';
import { keepWorkingTools, toolSlugFromPath } from '@/lib/keep-working';
import {
  USER_CONSENT_KEY,
  USER_EMAIL_KEY,
  autoCloseDelay,
  chosenFilename,
  deliveryOutcome,
  deliveryReducer,
  initialDeliveryState,
  isFinished,
  isNewAddress,
  isValidEmail,
  shareType,
  splitFilename,
} from '@/lib/file-delivery';

export type DeliveryOutcome = 'email' | 'download';

export interface UseFileDeliveryOptions {
  fileBlob: Blob | null;
  filename: string;
  /** Saves the file locally under `filename`, the name in the panel (the caller owns how: downloadBlob, a zip, etc.). */
  onDownload: (filename: string) => void;
  /** The panel is done: auto-close elapsed, or the user pressed Done / acted on the review ask. */
  onFinish: (outcome: DeliveryOutcome) => void;
  /** Closed without delivering (Close or Escape); the file stays on the page. */
  onDismiss: () => void;
  /** Stay open once delivered: the panel offers something that would vanish with it (Fill again for the next person). */
  holdOpen?: boolean;
  /** Start the email field with the last address used (the default). Off while filling forms for several people. */
  prefillEmail?: boolean;
}

function readSavedEmail(): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(USER_EMAIL_KEY);
  } catch {
    return null;
  }
}

function rememberEmail(email: string, consent: boolean) {
  try {
    window.localStorage.setItem(USER_EMAIL_KEY, email);
    window.localStorage.setItem(USER_CONSENT_KEY, consent ? 'true' : 'false');
  } catch {
    // Storage blocked: the user simply types the address again next time
  }
}

/**
 * Everything behind the single "Your file is ready" panel: Download and an
 * inline email row, side by side, so choosing email is one step, not two.
 * Owned by the component that owns the dialog (it needs isSending for Escape).
 */
export function useFileDelivery({ fileBlob, filename, onDownload, onFinish, onDismiss, holdOpen: holdOpenOption = false, prefillEmail = true }: UseFileDeliveryOptions) {
  const [state, dispatch] = useReducer(deliveryReducer, initialDeliveryState);
  const [email, setEmail] = useState('');
  const [savedEmail, setSavedEmail] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [invalidEmail, setInvalidEmail] = useState(false);
  // What the visitor typed in the name field; null until they touch it, so a new filename shows as is
  const [typedName, setTypedName] = useState<string | null>(null);
  // Bumped whenever a send is superseded (download, new file), so its late result is ignored
  const sendSeq = useRef(0);
  const onFinishRef = useRef(onFinish);
  const prefillRef = useRef(prefillEmail);
  prefillRef.current = prefillEmail;

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // A fresh panel for every new file, prefilled with the address we already know.
  // A blob going to null is not a new file (some pages drop theirs once downloaded).
  const lastBlob = useRef<Blob | null>(null);
  useEffect(() => {
    if (!fileBlob || fileBlob === lastBlob.current) return;
    lastBlob.current = fileBlob;
    sendSeq.current++;
    dispatch({ type: 'reset' });
    const saved = readSavedEmail();
    setSavedEmail(saved);
    // The last address is the previous person's when one form is filled for several people
    setEmail(prefillRef.current ? (saved ?? '') : '');
    setConsent(false);
    setInvalidEmail(false);
    setTypedName(null);
  }, [fileBlob]);

  // Close by itself once delivered, unless the review ask is showing and needs time to read,
  // or the panel offers Keep working
  const holdOpen =
    holdOpenOption ||
    (typeof window !== 'undefined' && keepWorkingTools(toolSlugFromPath(window.location.pathname), fileBlob, filename).length > 0);
  const delay = autoCloseDelay(state, holdOpen);
  const outcome = deliveryOutcome(state);
  useEffect(() => {
    if (delay === null) return;
    const timer = setTimeout(() => onFinishRef.current(outcome), delay);
    return () => clearTimeout(timer);
  }, [delay, outcome]);

  const { base, extension } = splitFilename(filename);
  const savedName = typedName === null ? filename : chosenFilename(typedName, filename);
  const renamed = savedName !== filename;

  const tooLarge = fileBlob !== null && fileBlob.size > MAX_EMAIL_FILE_SIZE;
  const isSending = state.email === 'sending';
  const finished = isFinished(state);

  const send = async () => {
    if (!fileBlob || tooLarge || isSending || finished) return;
    const address = email.trim();
    if (!isValidEmail(address)) {
      setInvalidEmail(true);
      return;
    }
    setInvalidEmail(false);
    const toolName = currentToolFromPath();
    trackEvent('delivery_choice', { tool_name: toolName, choice: 'email', renamed });

    const isNew = isNewAddress(address, savedEmail);
    if (isNew) {
      // Marketing is opt-in only, and never holds up the file
      if (consent) {
        fetch('/api/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: address, locale: pageLocale() }),
        }).catch(() => {});
      }
      rememberEmail(address, consent);
      trackEvent('email_capture_submitted', { tool_name: toolName, marketing_consent: consent });
    }

    const seq = ++sendSeq.current;
    dispatch({ type: 'sendStart' });
    const ok = await sendFileByEmail(fileBlob, savedName, address);
    if (seq !== sendSeq.current) return; // the user downloaded (or the file changed) meanwhile
    // Updated only now, so the consent checkbox doesn't vanish mid-send
    if (isNew) setSavedEmail(address);
    dispatch({ type: 'sendResult', ok, to: address, askForReview: ok && shouldAskForReview() });
  };

  // The phone's share sheet (WhatsApp, Messages, Mail…) with the file itself, where the browser
  // can share this type of file: most phones, few desktops. Checked once per file.
  const [shareable, setShareable] = useState(false);
  useEffect(() => {
    if (!fileBlob || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
      setShareable(false);
      return;
    }
    try {
      setShareable(navigator.canShare({ files: [new File([fileBlob], filename, { type: shareType(fileBlob.type, filename) })] }));
    } catch {
      setShareable(false);
    }
  }, [fileBlob, filename]);

  const share = async () => {
    if (!fileBlob) return;
    const file = new File([fileBlob], savedName, { type: shareType(fileBlob.type, savedName) });
    try {
      await navigator.share({ files: [file] });
      trackEvent('delivery_choice', { tool_name: currentToolFromPath(), choice: 'share', renamed });
    } catch {
      // Closed the sheet (AbortError) or the share failed: Download is right above
    }
  };

  // Always available, even mid-send: the file is already in the browser
  const download = () => {
    if (!fileBlob) return;
    sendSeq.current++;
    trackEvent('delivery_choice', { tool_name: currentToolFromPath(), choice: 'download', renamed });
    onDownload(savedName);
    dispatch({ type: 'download', askForReview: shouldAskForReview() });
  };

  const finish = useCallback(() => onFinishRef.current(outcome), [outcome]);

  // The old two-step flow reported this as skipping the email capture; keep the event name for GA4
  const dismiss = () => {
    trackEvent('email_capture_skipped', { tool_name: currentToolFromPath() });
    onDismiss();
  };

  return {
    state,
    fileBlob,
    /** The name the file goes out under: ours, or the one typed in the panel. */
    filename: savedName,
    /** The name field: the name without its extension, which stays as produced. */
    name: typedName ?? base,
    setName: setTypedName,
    extension,
    email,
    setEmail: (value: string) => {
      setEmail(value);
      setInvalidEmail(false);
    },
    consent,
    setConsent,
    /** The consent box is only for an address we haven't stored. */
    showConsent: isNewAddress(email, savedEmail),
    invalidEmail,
    tooLarge,
    isSending,
    finished,
    send,
    download,
    /** Whether this browser can hand the file to the share sheet (most phones). */
    shareable,
    share,
    finish,
    dismiss,
  };
}

export type FileDelivery = ReturnType<typeof useFileDelivery>;
