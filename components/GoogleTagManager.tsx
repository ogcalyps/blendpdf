'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

interface GoogleTagManagerProps {
  gtmId?: string;
}

export function GoogleTagManager({ gtmId }: GoogleTagManagerProps) {
  const pathname = usePathname();
  // Only render if GTM ID is provided, and never in the back office: a tag
  // loader could inject any script into pages that show subscriber addresses.
  const isAdmin = pathname === '/admin' || (pathname?.startsWith('/admin/') ?? false);
  if (!gtmId || isAdmin) {
    return null;
  }

  return (
    <>
      {/* GTM Script - Loads in head automatically with afterInteractive strategy */}
      <Script
        id="google-tag-manager"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId}');
          `,
        }}
      />
      {/* GTM Noscript - Must be in body (immediately after opening body tag) */}
      <noscript>
        <iframe
          src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
          title="Google Tag Manager"
        />
      </noscript>
    </>
  );
}

