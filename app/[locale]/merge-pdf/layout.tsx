import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Merge PDF Files Online Free - Combine Multiple PDFs Instantly | BlendPDF',
      description: 'Merge PDF files online for free. Combine multiple PDFs into one document instantly. No sign-up required. Works with Arabic, Hebrew, and all languages.',
      keywords: 'merge pdf, combine pdf, join pdf, pdf merger online free, merge pdf files, combine pdf files online, merge multiple pdfs',
    },
    ar: {
      title: 'دمج ملفات PDF مجاناً - دمج عدة ملفات PDF فوراً | BlendPDF',
      description: 'قم بدمج ملفات PDF مجاناً عبر الإنترنت. دمج عدة ملفات PDF في مستند واحد فوراً. لا حاجة للتسجيل. يعمل مع العربية والعبرية وجميع اللغات.',
      keywords: 'دمج pdf، دمج ملفات pdf، دمج pdf مجاناً، دمج عدة ملفات pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/merge-pdf`;
  
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonicalUrl,
      siteName: 'BlendPDF',
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'website',
      images: [{ url: `${baseUrl}/og-image.jpg` }],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [`${baseUrl}/twitter-image.jpg`],
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        'en': `${baseUrl}/merge-pdf`,
        'ar': `${baseUrl}/ar/merge-pdf`,
        'x-default': `${baseUrl}/merge-pdf`,
      },
    },
  };
}

export default function MergePDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

