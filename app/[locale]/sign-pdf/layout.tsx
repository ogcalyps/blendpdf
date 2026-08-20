import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Sign PDF Online Free - Add Electronic & Digital Signatures | BlendPDF',
      description: 'Add electronic signatures to PDF files online for free. Sign documents digitally with ease. Works with all languages. No sign-up required.',
      keywords: 'sign pdf, pdf signature, electronic signature, digital signature, sign pdf online free',
    },
    ar: {
      title: 'توقيع PDF مجاناً - إضافة توقيعات إلكترونية ورقمية | BlendPDF',
      description: 'قم بإضافة توقيعات إلكترونية إلى ملفات PDF مجاناً عبر الإنترنت. توقيع المستندات رقمياً بسهولة. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'توقيع pdf، توقيع pdf إلكتروني، توقيع رقمي، توقيع pdf مجاناً',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/sign-pdf`;
  
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
        'en': `${baseUrl}/sign-pdf`,
        'ar': `${baseUrl}/ar/sign-pdf`,
        'x-default': `${baseUrl}/sign-pdf`,
      },
    },
  };
}

export default function SignPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

