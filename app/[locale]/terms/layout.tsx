import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'terms' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  const canonicalUrl = locale === 'en' ? `${baseUrl}/terms` : `${baseUrl}/${locale}/terms`;

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
        en: `${baseUrl}/terms`,
        ar: `${baseUrl}/ar/terms`,
        'x-default': `${baseUrl}/terms`,
      },
    },
  };
}

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
