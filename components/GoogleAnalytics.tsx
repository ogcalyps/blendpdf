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

  // Only render if GA ID is provided
  if (!gaId) {
    return null;
  }

  // Track page views on route changes (Next.js App Router)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      // Get search params from window.location to avoid Suspense boundary requirement
      const searchParams = typeof window !== 'undefined' ? window.location.search : '';
      const url = pathname + searchParams;
      window.gtag('config', gaId, {
        page_path: url,
        send_page_view: true,
      });
    }
  }, [pathname, gaId]);

  return (
    <>
      {/* Google Analytics - gtag.js */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
              send_page_view: true,
              transport_type: 'beacon', // Use sendBeacon for better reliability
            });
          `,
        }}
      />
    </>
  );
}

