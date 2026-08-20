import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Unlock PDF Online - Remove Restrictions & Passwords Free | BlendPDF',
      description: 'Remove PDF restrictions like printing and copying locks without a password, or unlock password-protected PDFs. Free online tool, no sign-up.',
      keywords: 'unlock pdf, remove pdf restrictions, remove pdf password, decrypt pdf, unlock encrypted pdf, remove pdf password online free',
    },
    ar: {
      title: 'إلغاء قفل PDF مجاناً - إزالة حماية كلمة المرور | BlendPDF',
      description: 'قم بإزالة حماية كلمة المرور من ملفات PDF مجاناً عبر الإنترنت. إلغاء قفل ملفات PDF المشفرة. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'إلغاء قفل pdf، إزالة كلمة مرور pdf، فك تشفير pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/unlock-pdf`;

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
        'en': `${baseUrl}/unlock-pdf`,
        'ar': `${baseUrl}/ar/unlock-pdf`,
        'x-default': `${baseUrl}/unlock-pdf`,
      },
    },
  };
}

export default function UnlockPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

