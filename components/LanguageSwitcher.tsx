'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { localeDir, type Locale } from '@/i18n';
import { stashForLocaleSwitch } from '@/lib/workspace/carry-over';

/** Each language is named in itself, and marked with its own lang so screen readers pronounce it right. */
const LANGUAGES: { locale: Locale; label: string; name: string }[] = [
  { locale: 'en', label: 'EN', name: 'English' },
  { locale: 'es', label: 'ES', name: 'Español' },
  { locale: 'fr', label: 'FR', name: 'Français' },
  { locale: 'ar', label: 'العربية', name: 'العربية' },
];

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');

  const switchLanguage = (newLocale: Locale) => {
    // Optimistically update HTML attributes immediately for instant RTL/LTR switch
    document.documentElement.lang = newLocale;
    document.documentElement.dir = localeDir(newLocale);
    // The tool page mounts again under the new locale: the open file and edits go with it
    stashForLocaleSwitch(window.location.pathname);

    // Use the locale-aware router which handles 'as-needed' strategy correctly
    // pathname from next-intl already excludes the locale prefix
    router.push(pathname, { locale: newLocale });
  };

  return (
    <div className="flex gap-1 sm:gap-2" role="group" aria-label={t('language')}>
      {LANGUAGES.map(({ locale: l, label, name }) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-label={name === label ? undefined : name}
          aria-pressed={locale === l}
          onClick={() => switchLanguage(l)}
          className={`px-2 sm:px-3 lg:px-2 xl:px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            locale === l
              ? 'bg-primary text-white'
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
