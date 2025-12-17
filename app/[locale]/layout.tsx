import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { locales } from "@/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Script from "next/script";

export const metadata: Metadata = {
  title: "BlendPDF - Free PDF Tools | No Sign-up Required",
  description: "Free online PDF tools. Merge, compress, split PDFs. Works in any language. No sign-up required.",
  applicationName: "BlendPDF",
  keywords: ["PDF tools", "merge PDF", "compress PDF", "split PDF", "PDF converter", "free PDF tools"],
  authors: [{ name: "BlendPDF" }],
  creator: "BlendPDF",
  publisher: "BlendPDF",
  openGraph: {
    title: "BlendPDF - Free PDF Tools",
    description: "Free online PDF tools. Merge, compress, split PDFs. No sign-up required.",
    siteName: "BlendPDF",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BlendPDF - Free PDF Tools",
    description: "Free online PDF tools. Merge, compress, split PDFs. No sign-up required.",
  },
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  // Await params (Next.js 15+ requirement)
  const { locale: localeParam } = await params;
  
  // Validate locale
  if (!locales.includes(localeParam as any)) {
    notFound();
  }

  const locale = localeParam;
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const messages = await getMessages({ locale });

  return (
    <>
      <Script
        id="set-html-attributes"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            document.documentElement.lang = '${locale}';
            document.documentElement.dir = '${dir}';
          `,
        }}
      />
      <ErrorBoundary>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </ErrorBoundary>
    </>
  );
}

