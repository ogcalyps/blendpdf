'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const STORAGE_KEY = 'blendpdf-consent';

/**
 * Minimal analytics-consent banner (Consent Mode v2).
 * GA loads with analytics_storage denied by default (see GoogleAnalytics.tsx);
 * accepting here upgrades consent, declining records the refusal so the
 * banner doesn't reappear. Only analytics cookies are involved — the site
 * sets no advertising cookies.
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
    try {
      localStorage.setItem(STORAGE_KEY, granted ? 'granted' : 'denied');
    } catch {
      // Ignore storage failures; the choice still applies for this page view.
    }
    if (granted && typeof window !== 'undefined' && window.gtag) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
    }
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
