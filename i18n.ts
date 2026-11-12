export const locales = ['en', 'ar', 'fr', 'es'] as const;

export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

/** Text direction for a locale: Arabic is the only right-to-left one. */
export function localeDir(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
