'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = (newLocale: 'en' | 'ar') => {
    // Use the locale-aware router which handles 'as-needed' strategy correctly
    // pathname from next-intl already excludes the locale prefix
    router.push(pathname, { locale: newLocale });
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => switchLanguage('en')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          locale === 'en'
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 hover:text-gray-900'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => switchLanguage('ar')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          locale === 'ar'
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 hover:text-gray-900'
        }`}
      >
        عربي
      </button>
    </div>
  );
}

