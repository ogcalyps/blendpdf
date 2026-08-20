import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'PDF to Word Converter Online Free - Convert PDF to DOCX | BlendPDF',
      description: 'Convert PDF to Word DOCX format online for free. Preserves formatting and text. No sign-up required. Works with all languages including Arabic.',
      keywords: 'pdf to word, pdf to docx, convert pdf to word, pdf word converter, pdf to word online free, extract text from pdf',
    },
    ar: {
      title: 'تحويل PDF إلى Word مجاناً - تحويل PDF إلى DOCX | BlendPDF',
      description: 'قم بتحويل PDF إلى تنسيق Word DOCX مجاناً عبر الإنترنت. يحافظ على التنسيق والنص. لا حاجة للتسجيل. يعمل مع جميع اللغات بما في ذلك العربية.',
      keywords: 'pdf إلى word، pdf إلى docx، تحويل pdf إلى word، محول pdf إلى word',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-word`;
  
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
        'en': `${baseUrl}/pdf-to-word`,
        'ar': `${baseUrl}/ar/pdf-to-word`,
        'x-default': `${baseUrl}/pdf-to-word`,
      },
    },
  };
}

export default function PDFToWordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

