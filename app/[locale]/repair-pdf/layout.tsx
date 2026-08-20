import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Repair PDF Online Free - Fix Corrupted or Damaged PDF Files | BlendPDF',
      description: 'Fix corrupted or damaged PDF files online for free. Recover broken PDFs and restore file integrity. Works with all languages. No sign-up required.',
      keywords: 'repair pdf, fix pdf, corrupted pdf, damaged pdf, pdf repair tool, fix broken pdf online free',
    },
    ar: {
      title: 'إصلاح PDF مجاناً - إصلاح ملفات PDF التالفة أو المعطوبة | BlendPDF',
      description: 'قم بإصلاح ملفات PDF التالفة أو المعطوبة مجاناً عبر الإنترنت. استعادة ملفات PDF المكسورة. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'إصلاح pdf، إصلاح ملف pdf، ملف pdf تالف، أداة إصلاح pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/repair-pdf`;
  
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
        'en': `${baseUrl}/repair-pdf`,
        'ar': `${baseUrl}/ar/repair-pdf`,
        'x-default': `${baseUrl}/repair-pdf`,
      },
    },
  };
}

export default function RepairPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

