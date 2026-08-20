'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = (newLocale: 'en' | 'ar') => {
    // Optimistically update HTML attributes immediately for instant RTL/LTR switch
    const newDir = newLocale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLocale;
    document.documentElement.dir = newDir;
    
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
            ? 'bg-primary text-white'
            : 'text-gray-700 hover:text-gray-900'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => switchLanguage('ar')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          locale === 'ar'
            ? 'bg-primary text-white'
            : 'text-gray-700 hover:text-gray-900'
        }`}
      >
        العربية
      </button>
    </div>
  );
}

