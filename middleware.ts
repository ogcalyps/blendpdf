import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';

export default createMiddleware({
  localePrefix: 'as-needed',
  locales,
  defaultLocale,
});

export const config = {
  matcher: [
    // Exclude API routes, static files, and Next.js internals
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};

