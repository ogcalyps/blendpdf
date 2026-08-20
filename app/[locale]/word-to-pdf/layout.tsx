import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Word to PDF Converter Online Free - Convert DOCX to PDF | BlendPDF',
      description: 'Convert Word documents (DOC, DOCX, ODT, RTF) to PDF format online for free. Preserves formatting and layout. No sign-up required. Works with all languages.',
      keywords: 'word to pdf, docx to pdf, doc to pdf, convert word to pdf, word pdf converter, odt to pdf, rtf to pdf, word to pdf online free',
    },
    ar: {
      title: 'تحويل Word إلى PDF مجاناً - تحويل DOCX إلى PDF | BlendPDF',
      description: 'قم بتحويل مستندات Word (DOC، DOCX، ODT، RTF) إلى تنسيق PDF مجاناً عبر الإنترنت. يحافظ على التنسيق والتخطيط. لا حاجة للتسجيل. يعمل مع جميع اللغات.',
      keywords: 'word إلى pdf، docx إلى pdf، doc إلى pdf، تحويل word إلى pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/word-to-pdf`;
  
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
        'en': `${baseUrl}/word-to-pdf`,
        'ar': `${baseUrl}/ar/word-to-pdf`,
        'x-default': `${baseUrl}/word-to-pdf`,
      },
    },
  };
}

export default function WordToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
