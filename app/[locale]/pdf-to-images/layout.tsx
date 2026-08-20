import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'PDF to Images Converter Online Free - Convert PDF to JPG PNG | BlendPDF',
      description: 'Convert PDF pages to high-quality images (JPG, PNG) online for free. Choose DPI quality. Works with Arabic, Hebrew, and all languages. No sign-up required.',
      keywords: 'pdf to jpg, pdf to png, pdf to images, convert pdf to image, pdf to jpg online free, pdf to png converter',
    },
    ar: {
      title: 'تحويل PDF إلى صور مجاناً - تحويل PDF إلى JPG PNG | BlendPDF',
      description: 'قم بتحويل صفحات PDF إلى صور عالية الجودة (JPG، PNG) مجاناً عبر الإنترنت. اختر جودة DPI. يعمل مع العربية والعبرية وجميع اللغات. لا حاجة للتسجيل.',
      keywords: 'pdf إلى jpg، pdf إلى png، pdf إلى صور، تحويل pdf إلى صورة',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-images`;
  
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
        'en': `${baseUrl}/pdf-to-images`,
        'ar': `${baseUrl}/ar/pdf-to-images`,
        'x-default': `${baseUrl}/pdf-to-images`,
      },
    },
  };
}

export default function PDFToImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

