import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Extract Pages from PDF Online Free - Save Certain Pages | BlendPDF',
      description: 'Extract pages from a PDF online for free. Save certain pages of a PDF as a new file or one file per page. 100% in your browser — files never leave your device. No sign-up.',
      keywords: 'extract pages from pdf, save certain pages of pdf, pdf page extractor, extract pdf pages online free, pull pages from pdf',
    },
    ar: {
      title: 'استخراج صفحات من PDF مجاناً - حفظ صفحات محددة | BlendPDF',
      description: 'استخرج صفحات من ملف PDF مجاناً عبر الإنترنت. احفظ صفحات محددة كملف جديد أو ملف لكل صفحة. المعالجة تتم بالكامل في متصفحك — ملفاتك لا تغادر جهازك. لا حاجة للتسجيل.',
      keywords: 'استخراج صفحات من pdf، حفظ صفحات محددة من pdf، استخراج صفحات pdf مجاناً، أداة استخراج صفحات pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/extract-pages`;

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
        'en': `${baseUrl}/extract-pages`,
        'ar': `${baseUrl}/ar/extract-pages`,
        'x-default': `${baseUrl}/extract-pages`,
      },
    },
  };
}

export default function ExtractPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
