'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Type declaration for gtag
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

interface GoogleAnalyticsProps {
  gaId?: string;
}

export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps) {
  const pathname = usePathname();
  // The back office is never tracked: no tag, no page_view.
  const isAdmin = pathname === '/admin' || (pathname?.startsWith('/admin/') ?? false);

  // Track page views on route changes (Next.js App Router).
  // The inline config below uses send_page_view: false, so this effect is
  // the single source of page_view events (initial load + SPA navigations).
  useEffect(() => {
    if (!gaId || isAdmin) return;
    if (typeof window !== 'undefined' && window.gtag) {
      // Get search params from window.location to avoid Suspense boundary requirement
      const searchParams = window.location.search;
      window.gtag('event', 'page_view', {
        page_path: pathname + searchParams,
        page_location: window.location.href,
        page_title: document.title,
      });
    }
  }, [pathname, gaId, isAdmin]);

  // Only render if GA ID is provided, and never in the back office
  if (!gaId || isAdmin) {
    return null;
  }

  return (
    <>
      {/* Google Analytics - gtag.js. The library (~180 KB) waits until the page
          has loaded so it doesn't compete with the first paint; the inline
          snippet below defines gtag() now, and calls queue in dataLayer until
          the library arrives. */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="lazyOnload"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            // Consent Mode v2: default to denied until the user opts in via the
            // consent banner (stored choice is replayed here on later visits).
            (function() {
              var stored = null;
              try { stored = localStorage.getItem('blendpdf-consent'); } catch (e) {}
              gtag('consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                analytics_storage: stored === 'granted' ? 'granted' : 'denied',
              });
            })();
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              send_page_view: false, // page_view is sent by the route-change effect to avoid double counting
              transport_type: 'beacon', // Use sendBeacon for better reliability
            });
          `,
        }}
      />
    </>
  );
}

