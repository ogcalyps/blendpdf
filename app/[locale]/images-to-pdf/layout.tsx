import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Images to PDF Converter Online Free - JPG PNG to PDF | BlendPDF',
      description: 'Convert JPG, PNG, and other images to PDF online for free. Combine multiple images into one PDF. Works with all languages. No sign-up required.',
      keywords: 'jpg to pdf, png to pdf, image to pdf, convert images to pdf, jpg to pdf online free, images to pdf converter',
    },
    ar: {
      title: 'تحويل الصور إلى PDF مجاناً - JPG PNG إلى PDF | BlendPDF',
      description: 'قم بتحويل صور JPG و PNG وصور أخرى إلى PDF مجاناً عبر الإنترنت. دمج عدة صور في ملف PDF واحد. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'jpg إلى pdf، png إلى pdf، صورة إلى pdf، تحويل الصور إلى pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/images-to-pdf`;
  
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
        'en': `${baseUrl}/images-to-pdf`,
        'ar': `${baseUrl}/ar/images-to-pdf`,
        'x-default': `${baseUrl}/images-to-pdf`,
      },
    },
  };
}

export default function ImagesToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

