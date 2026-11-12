'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { trackPageView } from '@/lib/page-view';

/**
 * The first-party page_view (lib/page-view.ts): on load and on every client
 * navigation, for every visitor. Mounted once, in the root layout. Reads the
 * pathname only: the search-params hook would push the pages into client
 * rendering (utm_source is read from location, once).
 */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) trackPageView(pathname);
  }, [pathname]);
  return null;
}
