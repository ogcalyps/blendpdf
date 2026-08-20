import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Add Watermark to PDF Online Free - Text & Image Watermarks | BlendPDF',
      description: 'Add text or image watermarks to PDF files online for free. Brand your PDFs with custom watermarks. Works with all languages. No sign-up required.',
      keywords: 'watermark pdf, add watermark to pdf, pdf watermark, brand pdf, add watermark online free',
    },
    ar: {
      title: 'إضافة علامة مائية إلى PDF مجاناً - علامات مائية نصية وصورية | BlendPDF',
      description: 'قم بإضافة علامات مائية نصية أو صورية إلى ملفات PDF مجاناً عبر الإنترنت. وضع علامة على ملفات PDF الخاصة بك. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'علامة مائية pdf، إضافة علامة مائية إلى pdf، علامة مائية pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/watermark-pdf`;
  
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
        'en': `${baseUrl}/watermark-pdf`,
        'ar': `${baseUrl}/ar/watermark-pdf`,
        'x-default': `${baseUrl}/watermark-pdf`,
      },
    },
  };
}

export default function WatermarkPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

