import { Inter, Cairo } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";
import { GoogleTagManager } from "@/components/GoogleTagManager";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

const inter = Inter({
  subsets: ["latin"],
  weight: ['400', '500', '600', '700', '800'],
  variable: "--font-inter",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get GTM and GA IDs from environment variables
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  // Resolve the locale server-side so crawlers and no-JS renders see
  // correct lang/dir (previously patched in via client-side script).
  const locale = await getLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo.svg" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={`${inter.variable} ${cairo.variable} font-sans antialiased`}>
        {/* Google Tag Manager - Scripts load in head via Script component */}
        <GoogleTagManager gtmId={gtmId} />
        {/* Google Analytics */}
        <GoogleAnalytics gaId={gaId} />
        {children}
      </body>
    </html>
  );
}

