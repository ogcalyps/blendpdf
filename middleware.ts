import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  localePrefix: 'as-needed',
  locales,
  defaultLocale,
});

export default function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const hostname = request.headers.get('host') || '';
  
  // Skip HTTPS redirects for localhost/development
  const isLocalhost = hostname.includes('localhost') || hostname.includes('127.0.0.1') || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.includes('.local');

  // Redirect HTTP to HTTPS (301 permanent redirect) - only in production
  if (!isLocalhost && request.nextUrl.protocol === 'http:') {
    url.protocol = 'https:';
    return NextResponse.redirect(url, 301);
  }

  // Redirect www to non-www (301 permanent redirect) - only in production
  if (!isLocalhost && hostname.startsWith('www.')) {
    url.hostname = hostname.replace('www.', '');
    url.protocol = 'https:'; // Ensure HTTPS
    return NextResponse.redirect(url, 301);
  }

  // Handle the internationalization middleware
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // Exclude API routes, static files, and Next.js internals
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};

