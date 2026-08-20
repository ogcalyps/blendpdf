import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Crop PDF Pages Online Free - Trim PDF Margins Visually | BlendPDF',
      description: 'Crop PDF pages online for free. Drag to select the area to keep, trim margins, and cut PDF pages visually. 100% in your browser — your file never leaves your device. No sign-up.',
      keywords: 'crop pdf, crop pdf pages, trim pdf margins, cut pdf page, crop pdf online free, pdf cropper',
    },
    ar: {
      title: 'قص صفحات PDF مجاناً - اقتطاع الهوامش بصرياً | BlendPDF',
      description: 'قص صفحات PDF مجاناً عبر الإنترنت. اسحب لتحديد المنطقة التي تريد الاحتفاظ بها واقتطع الهوامش بصرياً. تتم المعالجة بالكامل في متصفحك — ملفك لا يغادر جهازك أبداً. بدون تسجيل.',
      keywords: 'قص pdf، قص صفحات pdf، اقتطاع هوامش pdf، قص صفحة pdf مجاناً',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/crop-pdf`;

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
        'en': `${baseUrl}/crop-pdf`,
        'ar': `${baseUrl}/ar/crop-pdf`,
        'x-default': `${baseUrl}/crop-pdf`,
      },
    },
  };
}

export default function CropPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
