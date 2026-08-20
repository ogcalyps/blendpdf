import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Compress PDF Online Free - Reduce File Size Up to 90% | BlendPDF',
      description: 'Compress PDF files online for free. Reduce PDF file size by up to 90% while maintaining quality. No sign-up required. Works with all languages.',
      keywords: 'compress pdf, reduce pdf size, pdf compressor, shrink pdf, make pdf smaller, compress pdf online free, reduce pdf file size',
    },
    ar: {
      title: 'ضغط PDF مجاناً - تقليل حجم الملف حتى 90% | BlendPDF',
      description: 'قم بضغط ملفات PDF مجاناً عبر الإنترنت. تقليل حجم ملف PDF حتى 90% مع الحفاظ على الجودة. لا حاجة للتسجيل. يعمل مع جميع اللغات.',
      keywords: 'ضغط pdf، تقليل حجم pdf، ضاغط pdf، ضغط pdf مجاناً',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/compress-pdf`;
  
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
        'en': `${baseUrl}/compress-pdf`,
        'ar': `${baseUrl}/ar/compress-pdf`,
        'x-default': `${baseUrl}/compress-pdf`,
      },
    },
  };
}

export default function CompressPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

