import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { locales } from "@/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StructuredData } from "@/components/StructuredData";
import { LocaleSync } from "@/components/LocaleSync";
import { ConsentBanner } from "@/components/ConsentBanner";

// Generate metadata based on locale
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  // Normalized base URL with NO trailing slash — every URL built from it
  // appends its own path. A trailing slash here previously produced
  // "//og-image.jpg" and a canonical of /ar/ (which 308-redirects to /ar).
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com').replace(/\/$/, '');
  
  // Locale-specific metadata
  const metadataByLocale = {
    en: {
      title: "BlendPDF - Free PDF Tools | No Sign-up Required",
      description: "Free online PDF tools. Merge, compress, split PDFs. Works in any language. No sign-up required.",
      keywords: ["PDF tools", "merge PDF", "compress PDF", "split PDF", "PDF converter", "free PDF tools", "online PDF editor"],
    },
    ar: {
      title: "BlendPDF - أدوات PDF مجانية | بدون تسجيل",
      description: "أدوات PDF مجانية على الإنترنت. دمج، ضغط، تقسيم ملفات PDF. يعمل بأي لغة. لا حاجة للتسجيل.",
      keywords: ["أدوات PDF", "دمج PDF", "ضغط PDF", "تقسيم PDF", "محول PDF", "أدوات PDF مجانية"],
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  // en lives at the unprefixed root; other locales at /<locale> (no trailing slash).
  const canonicalUrl = locale === 'en' ? baseUrl : `${baseUrl}/${locale}`;
  
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    applicationName: "BlendPDF",
    authors: [{ name: "BlendPDF" }],
    creator: "BlendPDF",
    publisher: "BlendPDF",
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'en': baseUrl,
        'ar': `${baseUrl}/ar`,
        'x-default': baseUrl,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      siteName: "BlendPDF",
      type: "website",
      url: canonicalUrl,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_SA',
      images: [{ url: `${baseUrl}/og-image.jpg` }],
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

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
  const messages = await getMessages({ locale });

  return (
    <>
      <StructuredData locale={locale} />
      <ErrorBoundary>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <LocaleSync />
          {children}
          <ConsentBanner />
        </NextIntlClientProvider>
      </ErrorBoundary>
    </>
  );
}

