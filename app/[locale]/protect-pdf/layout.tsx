import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Protect PDF Online Free - Add Password Protection & Encryption | BlendPDF',
      description: 'Add password protection to PDF files online for free. Secure your PDFs with encryption. Works with all languages. No sign-up required.',
      keywords: 'protect pdf, password protect pdf, encrypt pdf, secure pdf, pdf password, pdf encryption online free',
    },
    ar: {
      title: 'حماية PDF مجاناً - إضافة حماية بكلمة مرور وتشفير | BlendPDF',
      description: 'قم بإضافة حماية بكلمة مرور لملفات PDF مجاناً عبر الإنترنت. تأمين ملفات PDF الخاصة بك بالتشفير. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'حماية pdf، حماية pdf بكلمة مرور، تشفير pdf، تأمين pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/protect-pdf`;
  
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
        'en': `${baseUrl}/protect-pdf`,
        'ar': `${baseUrl}/ar/protect-pdf`,
        'x-default': `${baseUrl}/protect-pdf`,
      },
    },
  };
}

export default function ProtectPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

