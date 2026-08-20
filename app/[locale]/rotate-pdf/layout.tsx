import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Rotate PDF Pages Online Free - 90° 180° 270° Rotation | BlendPDF',
      description: 'Rotate PDF pages 90, 180, or 270 degrees online for free. Visual preview included. Works with all languages including Arabic. No sign-up required.',
      keywords: 'rotate pdf, rotate pdf pages, pdf rotator, turn pdf pages, rotate pdf online free, pdf page rotation',
    },
    ar: {
      title: 'تدوير صفحات PDF مجاناً - 90° 180° 270° | BlendPDF',
      description: 'قم بتدوير صفحات PDF بزوايا 90 أو 180 أو 270 درجة مجاناً عبر الإنترنت. معاينة مرئية. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'تدوير pdf، تدوير صفحات pdf، أداة تدوير pdf، تدوير صفحات pdf مجاناً',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/rotate-pdf`;
  
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
        'en': `${baseUrl}/rotate-pdf`,
        'ar': `${baseUrl}/ar/rotate-pdf`,
        'x-default': `${baseUrl}/rotate-pdf`,
      },
    },
  };
}

export default function RotatePDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

