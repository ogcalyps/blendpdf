import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Remove PDF Metadata Online Free - Clean Hidden Data | BlendPDF',
      description: 'Remove hidden author names, software traces and timestamps from PDF files before sharing. 100% in your browser - your file never leaves your device.',
      keywords: 'remove pdf metadata, clean pdf metadata, pdf privacy, strip pdf metadata, delete pdf author, pdf metadata remover, remove hidden data from pdf',
    },
    ar: {
      title: 'إزالة البيانات الوصفية من PDF مجاناً - احمِ خصوصيتك | BlendPDF',
      description: 'أزل أسماء المؤلفين المخفية وآثار البرامج والطوابع الزمنية من ملفات PDF قبل مشاركتها. تتم المعالجة بالكامل في متصفحك — ملفك لا يغادر جهازك أبداً.',
      keywords: 'إزالة البيانات الوصفية من pdf، تنظيف بيانات pdf، خصوصية pdf، حذف اسم المؤلف من pdf، إزالة البيانات المخفية من pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/remove-metadata`;

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
        'en': `${baseUrl}/remove-metadata`,
        'ar': `${baseUrl}/ar/remove-metadata`,
        'x-default': `${baseUrl}/remove-metadata`,
      },
    },
  };
}

export default function RemoveMetadataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
