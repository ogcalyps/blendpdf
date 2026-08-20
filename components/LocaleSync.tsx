'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

/**
 * Client component that syncs the HTML lang and dir attributes
 * with the current locale. This ensures RTL/LTR switching works
 * immediately without requiring a page refresh.
 */
export function LocaleSync() {
  const locale = useLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    // Update HTML attributes immediately when locale changes
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  // This component doesn't render anything
  return null;
}

