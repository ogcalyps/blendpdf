'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = (newLocale: 'en' | 'ar') => {
    // Get pathname without locale prefix
    let pathnameWithoutLocale = pathname;
    
    // Remove locale prefix if present (/en or /ar)
    if (pathname.startsWith('/en/') || pathname.startsWith('/ar/')) {
      pathnameWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';
    } else if (pathname === '/en' || pathname === '/ar') {
      // Handle root paths with locale
      pathnameWithoutLocale = '/';
    } else if (pathname === '/') {
      // Already at root
      pathnameWithoutLocale = '/';
    }
    
    // Ensure pathnameWithoutLocale starts with /
    if (!pathnameWithoutLocale.startsWith('/')) {
      pathnameWithoutLocale = '/' + pathnameWithoutLocale;
    }
    
    // Construct new pathname
    // For default locale (en), use 'as-needed' - don't add locale prefix
    // For other locales (ar), add locale prefix
    let newPathname: string;
    if (newLocale === 'en') {
      // Default locale: no prefix
      newPathname = pathnameWithoutLocale;
    } else {
      // Other locales: add prefix
      newPathname = pathnameWithoutLocale === '/' 
        ? `/${newLocale}` 
        : `/${newLocale}${pathnameWithoutLocale}`;
    }
    
    router.push(newPathname);
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

