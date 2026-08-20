import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'PDF to Text Converter - Extract Text from PDF Free | BlendPDF',
      description: 'Extract and copy text from PDF files for free, right in your browser. Your file never leaves your device. No upload, no sign-up, instant results.',
      keywords: 'pdf to text converter, extract text from pdf, copy text from pdf, pdf to txt, pdf text extractor, convert pdf to text online free',
    },
    ar: {
      title: 'تحويل PDF إلى نص - استخراج النص من PDF مجاناً | BlendPDF',
      description: 'استخرج النص من ملفات PDF وانسخه مجاناً داخل متصفحك مباشرة. ملفك لا يغادر جهازك أبداً. بدون رفع، بدون تسجيل، ونتائج فورية.',
      keywords: 'تحويل pdf إلى نص، استخراج النص من pdf، نسخ النص من pdf، pdf إلى txt، محول pdf إلى نص مجاناً',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-text`;

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
        'en': `${baseUrl}/pdf-to-text`,
        'ar': `${baseUrl}/ar/pdf-to-text`,
        'x-default': `${baseUrl}/pdf-to-text`,
      },
    },
  };
}

export default function PdfToTextLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
