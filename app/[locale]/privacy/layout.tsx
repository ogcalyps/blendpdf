import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  const canonicalUrl = locale === 'en' ? `${baseUrl}/privacy` : `${baseUrl}/${locale}/privacy`;

  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: canonicalUrl,
      siteName: 'BlendPDF',
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'website',
    },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${baseUrl}/privacy`,
        ar: `${baseUrl}/ar/privacy`,
        'x-default': `${baseUrl}/privacy`,
      },
    },
  };
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
