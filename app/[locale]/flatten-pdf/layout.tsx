import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Flatten PDF Online Free - Make PDF Forms Non-Editable | BlendPDF',
      description: 'Flatten PDF form fields online for free. Make filled forms non-editable so answers can\'t be changed. 100% in your browser — files never leave your device. No sign-up.',
      keywords: 'flatten pdf, flatten pdf form, make pdf non editable, lock pdf form fields, flatten pdf online free, non editable pdf',
    },
    ar: {
      title: 'تسطيح PDF مجاناً - جعل نماذج PDF غير قابلة للتعديل | BlendPDF',
      description: 'قم بتسطيح حقول نماذج PDF مجاناً عبر الإنترنت. اجعل النماذج المعبأة غير قابلة للتعديل. المعالجة تتم بالكامل في متصفحك — ملفاتك لا تغادر جهازك. لا حاجة للتسجيل.',
      keywords: 'تسطيح pdf، تسطيح نموذج pdf، جعل pdf غير قابل للتعديل، قفل حقول نموذج pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/flatten-pdf`;

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
        'en': `${baseUrl}/flatten-pdf`,
        'ar': `${baseUrl}/ar/flatten-pdf`,
        'x-default': `${baseUrl}/flatten-pdf`,
      },
    },
  };
}

export default function FlattenPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
