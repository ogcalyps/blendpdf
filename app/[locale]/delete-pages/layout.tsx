import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Delete PDF Pages Online Free - Remove Unwanted Pages | BlendPDF',
      description: 'Remove unwanted pages from PDF files online for free. Visual page selection. Works with all languages including Arabic. No sign-up required.',
      keywords: 'delete pdf pages, remove pdf pages, pdf page remover, delete pages from pdf online free',
    },
    ar: {
      title: 'حذف صفحات PDF مجاناً - إزالة الصفحات غير المرغوب فيها | BlendPDF',
      description: 'قم بإزالة الصفحات غير المرغوب فيها من ملفات PDF مجاناً عبر الإنترنت. اختيار مرئي للصفحات. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'حذف صفحات pdf، إزالة صفحات pdf، أداة حذف صفحات pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/delete-pages`;
  
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
        'en': `${baseUrl}/delete-pages`,
        'ar': `${baseUrl}/ar/delete-pages`,
        'x-default': `${baseUrl}/delete-pages`,
      },
    },
  };
}

export default function DeletePagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

