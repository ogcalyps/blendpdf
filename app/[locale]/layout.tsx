import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { locales } from "@/i18n";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StructuredData } from "@/components/StructuredData";
import { LocaleSync } from "@/components/LocaleSync";
import { ConsentBanner } from "@/components/ConsentBanner";
import { sharedClientMessages } from "@/lib/i18n/client-messages";
import { languageAlternates, ogAlternateLocales, ogLocale } from "@/lib/i18n/seo";

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
      title: "أدوات PDF مجانية تدعم العربية: دمج وضغط وتحويل إلى Word | BlendPDF",
      description: "ادمج ملفات PDF وصغّر حجمها وحوّلها إلى Word مجانًا ودون حساب، واستخرج النص من الملفات العربية الممسوحة ضوئيًا، وعدّل النص العربي داخل الملف دون أن تنفصل حروفه.",
      keywords: ["أدوات PDF", "أدوات PDF مجانية", "أدوات PDF بالعربي", "دمج PDF", "ضغط PDF", "تحويل PDF إلى Word", "تعديل PDF عربي", "OCR عربي"],
    },
    fr: {
      title: "BlendPDF - Outils PDF gratuits, sans inscription",
      description: "Outils PDF gratuits en ligne : fusionner, compresser, diviser, convertir et signer vos PDF. Fonctionne dans toutes les langues, sans inscription.",
      keywords: ["outils PDF", "fusionner PDF", "compresser PDF", "diviser PDF", "convertisseur PDF", "outils PDF gratuits", "modifier un PDF en ligne"],
    },
    es: {
      title: "BlendPDF - Herramientas PDF gratis, sin registrarse",
      description: "Herramientas PDF online y gratis para unir, comprimir, dividir, convertir, editar y firmar sus PDF. Funcionan en cualquier idioma y no hace falta registrarse.",
      keywords: ["herramientas PDF", "unir PDF", "comprimir PDF", "dividir PDF", "convertir PDF", "herramientas PDF gratis", "editar PDF online"],
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
      languages: languageAlternates(baseUrl, ''),
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      siteName: "BlendPDF",
      type: "website",
      url: canonicalUrl,
      locale: ogLocale(locale),
      alternateLocale: ogAlternateLocales(locale),
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
        {/* Tool pages add their own namespace (PageMessages in their layout). */}
        <NextIntlClientProvider messages={sharedClientMessages(messages)} locale={locale}>
          <LocaleSync />
          {children}
          <ConsentBanner />
        </NextIntlClientProvider>
      </ErrorBoundary>
    </>
  );
}

