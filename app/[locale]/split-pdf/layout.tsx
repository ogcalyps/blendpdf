import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Split PDF Online Free - Divide PDF into Multiple Files | BlendPDF',
      description: 'Split PDF files online for free. Extract specific pages or divide PDF into multiple files. Visual page selection. No sign-up required.',
      keywords: 'split pdf, extract pdf pages, pdf splitter, separate pdf pages, split pdf online free, divide pdf files',
    },
    ar: {
      title: 'تقسيم PDF مجاناً - تقسيم PDF إلى عدة ملفات | BlendPDF',
      description: 'قم بتقسيم ملفات PDF مجاناً عبر الإنترنت. استخراج صفحات محددة أو تقسيم PDF إلى عدة ملفات. اختيار مرئي للصفحات. لا حاجة للتسجيل.',
      keywords: 'تقسيم pdf، استخراج صفحات pdf، مقسم pdf، تقسيم pdf مجاناً',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/split-pdf`;
  
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
        'en': `${baseUrl}/split-pdf`,
        'ar': `${baseUrl}/ar/split-pdf`,
        'x-default': `${baseUrl}/split-pdf`,
      },
    },
  };
}

export default function SplitPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

