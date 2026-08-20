import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Extract Images from PDF Online Free - Save Pictures from PDF | BlendPDF',
      description: 'Extract embedded images from a PDF for free, right in your browser. Get pictures out of PDF files as PNG — your file never leaves your device. No sign-up required.',
      keywords: 'extract images from pdf, save pictures from pdf, get images out of pdf, pdf image extractor, download images from pdf, extract photos from pdf',
    },
    ar: {
      title: 'استخراج الصور من PDF مجاناً - حفظ الصور من ملفات PDF | BlendPDF',
      description: 'استخرج الصور المضمّنة من ملفات PDF مجاناً داخل متصفحك مباشرة. احصل على الصور بصيغة PNG — ملفك لا يغادر جهازك أبداً. لا حاجة للتسجيل.',
      keywords: 'استخراج الصور من pdf، حفظ الصور من pdf، سحب الصور من pdf، أداة استخراج صور pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/extract-images`;

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
        'en': `${baseUrl}/extract-images`,
        'ar': `${baseUrl}/ar/extract-images`,
        'x-default': `${baseUrl}/extract-images`,
      },
    },
  };
}

export default function ExtractImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
