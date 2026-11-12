import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';
import { defaultLocale, locales } from './i18n';

const withNextIntl = createNextIntlPlugin();

/**
 * Tools switched off for now: batch fill (/fill-form) and the form templates
 * (/forms/*) served 6 people between them from 22 Sep to 12 Nov 2026. Their
 * code stays; nothing links to them, and their URLs go to the editor, where
 * you can type on any form. Temporary (307) so a tool comes back by deleting
 * it here and restoring its links (nav, footer, home, sitemap, llms.txt).
 */
const HIDDEN_TOOLS = ['fill-form', 'forms'];
const PREFIXED_LOCALES = locales.filter((l) => l !== defaultLocale).join('|');

const nextConfig: NextConfig = {
  // Enable standalone output for optimized deployment
  output: 'standalone',

  // Don't advertise the framework in response headers
  poweredByHeader: false,

  // The app never uses next/image, so turn the optimizer off: /_next/image then
  // 404s instead of exposing the endpoint behind GHSA-2xp9-vwfh-vxw4 and its SSRF siblings
  images: { unoptimized: true },

  // English lives at the root. next-intl's middleware strips a typed /en prefix
  // with a temporary 307, which keeps /en/... copies in Google's index; these
  // run before the middleware and say it permanently (308).
  async redirects() {
    return [
      { source: '/en', destination: '/', permanent: true },
      { source: '/en/:path*', destination: '/:path*', permanent: true },
      ...HIDDEN_TOOLS.flatMap((tool) => [
        { source: `/${tool}/:path*`, destination: '/edit-pdf', permanent: false },
        { source: `/:locale(${PREFIXED_LOCALES})/${tool}/:path*`, destination: '/:locale/edit-pdf', permanent: false },
      ]),
    ];
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Back-office job endpoints: never indexed, never cached
        source: '/api/internal/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      // Back office: never indexed, cached, framed or leaked in a Referer.
      // Listed after '/(.*)' so these values win where both set a header.
      ...['/admin/:path*', '/api/admin/:path*'].map((source) => ({
        source,
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      })),
    ];
  },

  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  
  // Externalize pdfjs-dist to prevent bundling issues in API routes
  serverExternalPackages: ['pdfjs-dist', 'canvas'],
  
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Server-side: externalize canvas to avoid bundling native bindings
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        // Externalize canvas (native module)
        config.externals.push('canvas');
        // Exclude pdf.js worker from webpack bundling
        config.externals.push({
          'pdfjs-dist/build/pdf.worker.js': 'commonjs pdfjs-dist/build/pdf.worker.js',
        });
      }
      
      // Alias canvas to use the project's version
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: require.resolve('canvas'),
        // Force pdfjs-dist to use the root canvas instead of its nested version
        'pdfjs-dist/node_modules/canvas': require.resolve('canvas'),
      };
    } else {
      // Client-side: disable canvas
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    return config;
  },
};

export default withNextIntl(nextConfig);
