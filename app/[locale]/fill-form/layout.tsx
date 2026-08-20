import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/fill-form`;

  const metadataByLocale = {
    en: {
      title: 'Fill PDF Forms Online Free - Batch Fill from Excel or CSV | BlendPDF',
      description:
        'Fill any PDF form online for free. Upload a form, map fields visually, and batch-fill dozens of copies from an Excel or CSV file. No sign-up required.',
    },
    ar: {
      title: 'تعبئة نماذج PDF مجاناً - تعبئة جماعية من Excel أو CSV | BlendPDF',
      description:
        'املأ أي نموذج PDF مجاناً عبر الإنترنت. ارفع النموذج، وعيّن الحقول بصرياً، واملأ عشرات النسخ دفعة واحدة من ملف Excel أو CSV.',
    },
  };
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: enUrl,
      siteName: 'BlendPDF',
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
      // The tool UI is currently English-only, so the ar variant canonicalizes
      // to the EN URL and stays out of the index until translated.
      canonical: enUrl,
    },
    robots: locale === 'en' ? undefined : { index: false, follow: true },
  };
}

export default function FillFormLayout({ children }: { children: React.ReactNode }) {
  return children;
}
