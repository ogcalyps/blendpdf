import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Add Page Numbers to PDF Online Free - Custom Format & Position | BlendPDF',
      description: 'Add page numbers to PDF files online for free. Customize page number format, position, and style. Works with all languages. No sign-up required.',
      keywords: 'add page numbers to pdf, pdf page numbers, number pdf pages, pdf pagination, add page numbers online free',
    },
    ar: {
      title: 'إضافة أرقام الصفحات إلى PDF مجاناً - تنسيق وموضع مخصص | BlendPDF',
      description: 'قم بإضافة أرقام الصفحات إلى ملفات PDF مجاناً عبر الإنترنت. تخصيص تنسيق وموضع أرقام الصفحات. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'إضافة أرقام الصفحات إلى pdf، أرقام صفحات pdf، ترقيم صفحات pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/add-page-numbers`;
  
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
        'en': `${baseUrl}/add-page-numbers`,
        'ar': `${baseUrl}/ar/add-page-numbers`,
        'x-default': `${baseUrl}/add-page-numbers`,
      },
    },
  };
}

export default function AddPageNumbersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

