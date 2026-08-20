import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Reorder PDF Pages Online Free - Rearrange Pages by Drag & Drop | BlendPDF',
      description: 'Rearrange PDF pages by drag and drop. Free online PDF page organizer with visual preview. Works with all languages including Arabic. No sign-up required.',
      keywords: 'reorder pdf pages, rearrange pdf, organize pdf pages, reorder pdf online free, pdf page organizer',
    },
    ar: {
      title: 'إعادة ترتيب صفحات PDF مجاناً - ترتيب الصفحات بالسحب والإفلات | BlendPDF',
      description: 'قم بإعادة ترتيب صفحات PDF بالسحب والإفلات. منظم صفحات PDF مجاني مع معاينة مرئية. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'إعادة ترتيب صفحات pdf، ترتيب pdf، تنظيم صفحات pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/reorder-pdf`;
  
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
        'en': `${baseUrl}/reorder-pdf`,
        'ar': `${baseUrl}/ar/reorder-pdf`,
        'x-default': `${baseUrl}/reorder-pdf`,
      },
    },
  };
}

export default function ReorderPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

