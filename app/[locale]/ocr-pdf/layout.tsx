import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'OCR PDF Online Free - Make Scanned PDFs Searchable | BlendPDF',
      description: 'Make scanned PDFs searchable with OCR, free and online. First-class Arabic OCR plus English and French. Turns scanned pages into selectable, copyable text. No sign-up required.',
      keywords: 'ocr pdf, make pdf searchable, scanned pdf to text, pdf ocr online free, searchable pdf, arabic ocr pdf, ocr arabic pdf, recognize text in pdf',
    },
    ar: {
      title: 'التعرف الضوئي على الحروف العربية في PDF - OCR عربي مجاني | BlendPDF',
      description: 'أداة OCR مجانية تدعم العربية بشكل كامل: حوّل ملفات PDF الممسوحة ضوئياً إلى نصوص قابلة للبحث والنسخ. تدعم العربية والإنجليزية والفرنسية. بدون تسجيل.',
      keywords: 'التعرف الضوئي على الحروف العربية، OCR عربي، تحويل PDF ممسوح ضوئيا إلى نص، PDF قابل للبحث، استخراج نص من PDF، OCR PDF مجاني',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/ocr-pdf`;

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
        'en': `${baseUrl}/ocr-pdf`,
        'ar': `${baseUrl}/ar/ocr-pdf`,
        'x-default': `${baseUrl}/ocr-pdf`,
      },
    },
  };
}

export default function OcrPdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
