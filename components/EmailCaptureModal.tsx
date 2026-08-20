'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Mail, CheckCircle2, Loader2, X } from 'lucide-react';
import { trackEvent, currentToolFromPath } from '@/lib/analytics';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onEmailSubmitted: (email: string) => void;
  onEmailCaptured?: (email: string) => void; // New callback for when email is captured (before delivery choice)
  onSkip?: () => void; // Skip the email step entirely and proceed straight to the download
}

const STORAGE_KEY = 'blendpdf_user_email';
const STORAGE_CONSENT_KEY = 'blendpdf_user_consent';

export function EmailCaptureModal({
  isOpen,
  onEmailSubmitted,
  onEmailCaptured,
  onSkip,
}: EmailCaptureModalProps) {
  const t = useTranslations('emailCapture');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSkip = () => {
    trackEvent('email_capture_skipped', { tool_name: currentToolFromPath() });
    if (onSkip) {
      onSkip();
    } else if (onEmailCaptured) {
      // Legacy callers: an empty email signals a skip (direct download, no email)
      onEmailCaptured('');
    } else {
      onEmailSubmitted('');
    }
  };

  const dialogRef = useFocusTrap<HTMLDivElement>(
    isOpen && !isSubmitted,
    isSubmitting ? undefined : handleSkip
  );

  // Load saved email from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem(STORAGE_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, []);

  // Check if user has already provided email - skip modal if saved
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem(STORAGE_KEY);

      // If email is saved, skip modal and proceed immediately
      if (savedEmail) {
        // Auto-submit with saved email (skip modal entirely)
        if (onEmailCaptured) {
          onEmailCaptured(savedEmail);
        } else {
          onEmailSubmitted(savedEmail);
        }
      }
    }
  }, [isOpen, onEmailSubmitted, onEmailCaptured]);

  if (!isOpen) return null;

  // Don't render modal if email is already saved
  if (typeof window !== 'undefined') {
    const savedEmail = localStorage.getItem(STORAGE_KEY);
    if (savedEmail) {
      return null; // Don't show modal, email already saved
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('invalidEmail'));
      return;
    }

    setIsSubmitting(true);

    // Marketing subscription is optional: only subscribe when the user opted in,
    // and never block the file delivery on it.
    if (consent) {
      try {
        await fetch('/api/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        });
      } catch {
        // Non-blocking: the user still gets their file
      }
    }

    // Save email and consent preference to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, email);
      localStorage.setItem(STORAGE_CONSENT_KEY, consent ? 'true' : 'false');
    }

    trackEvent('email_capture_submitted', {
      tool_name: currentToolFromPath(),
      marketing_consent: consent,
    });

    setIsSubmitted(true);
    // Call onEmailCaptured if provided (for delivery choice flow)
    if (onEmailCaptured) {
      setTimeout(() => {
        onEmailCaptured(email);
      }, 1000);
    } else {
      // Fallback to original flow
      setTimeout(() => {
        onEmailSubmitted(email);
      }, 1000);
    }
  };

  if (isSubmitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-capture-title"
          className="max-w-md w-full mx-4 bg-white rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <div className="text-center">
              <h3 id="email-capture-title" className="text-lg font-semibold text-gray-900">{t('success')}</h3>
              <p className="mt-2 text-sm text-gray-600">{t('successMessage')}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-capture-title"
        className="relative max-w-md w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleSkip}
          disabled={isSubmitting}
          aria-label={t('close')}
          className="absolute top-3 end-3 z-10 rounded-full p-1.5 text-gray-400 transition-colors hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-8">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="bg-orange-100 rounded-full p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 id="email-capture-title" className="text-2xl font-bold text-gray-900">{t('title')}</h2>
              <p className="mt-2 text-sm text-gray-600">{t('description')}</p>
            </div>
          </div>

          <form id="email-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                {t('emailLabel')}
              </label>
              <input
                type="email"
                id="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                disabled={isSubmitting}
                className="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="consent" className="text-xs text-gray-600">
                {t('consent')}
              </label>
            </div>
          </form>

          <p className="mt-4 text-xs text-center text-gray-500">
            {t('privacyNote')}
          </p>
        </div>

        {/* Fixed button at bottom - ALWAYS VISIBLE */}
        <div className="border-t border-gray-100 bg-white p-6 flex-shrink-0">
          <button
            type="submit"
            form="email-form"
            disabled={isSubmitting || !email}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-coral disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              minHeight: '48px',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('submitting')}
              </>
            ) : (
              t('submit')
            )}
          </button>

          {/* Skip link: the download must never be gated on an email */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="mt-3 w-full text-center text-sm text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-700 disabled:opacity-50"
          >
            {t('skipDownload')}
          </button>
        </div>
      </div>
    </div>
  );
}
