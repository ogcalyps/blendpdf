import { Inter, Cairo } from "next/font/google";
import "./globals.css";
import { GoogleTagManager } from "@/components/GoogleTagManager";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get GTM and GA IDs from environment variables
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID;
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="en" dir="ltr">
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

