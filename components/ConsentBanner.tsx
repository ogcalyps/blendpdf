'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CONSENT_STORAGE_KEY as STORAGE_KEY, recordConsentChoice } from '@/lib/consent';
import { trackEvent } from '@/lib/analytics';

/**
 * Minimal analytics-consent banner (Consent Mode v2).
 * GA loads with analytics_storage denied by default (see GoogleAnalytics.tsx);
 * accepting here upgrades consent, declining records the refusal so the
 * banner doesn't reappear. Only analytics cookies are involved — the site
 * sets no advertising cookies. The choice governs GA only: the first-party
 * counts (lib/analytics.ts sendEvent) carry no cookie or stored ID and
 * count every visitor, this click included (consent_choice).
 */
export function ConsentBanner() {
  const t = useTranslations('consent');
  const locale = useLocale();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage unavailable (private mode) — keep analytics denied, skip the banner.
    }
  }, []);

  const decide = (granted: boolean) => {
    // Never throws.
    recordConsentChoice(granted);
    if (granted && typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
    // After the update, so GA gets an Accept with its new consent. The first-party copy is sent either way.
    trackEvent('consent_choice', { action: granted ? 'accept' : 'decline' });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label={t('ariaLabel')}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 sm:max-w-sm z-50 rounded-xl border border-gray-200 bg-white shadow-lg p-4"
    >
      <p className="text-sm text-gray-700 mb-3">{t('message')}</p>
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => decide(false)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
        >
          {t('decline')}
        </button>
        <button
          type="button"
          onClick={() => decide(true)}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-orange-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500"
          style={{ backgroundColor: '#FF6B35' }}
        >
          {t('accept')}
        </button>
      </div>
    </div>
  );
}
