import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'PowerPoint to PDF Converter Online Free - Convert PPT to PDF | BlendPDF',
      description: 'Convert PowerPoint presentations (PPT, PPTX, ODP) to PDF online for free. Each slide becomes a PDF page with fonts and images preserved. No sign-up, files deleted within 1 hour.',
      keywords: 'powerpoint to pdf, ppt to pdf, pptx to pdf, convert powerpoint to pdf, powerpoint to pdf converter, odp to pdf, ppt to pdf online free, presentation to pdf',
    },
    ar: {
      title: 'تحويل PowerPoint إلى PDF مجاناً - تحويل PPT إلى PDF | BlendPDF',
      description: 'قم بتحويل عروض PowerPoint التقديمية (PPT، PPTX، ODP) إلى PDF مجاناً عبر الإنترنت. تتحول كل شريحة إلى صفحة PDF مع الحفاظ على الخطوط والصور. لا حاجة للتسجيل، وتُحذف الملفات خلال ساعة.',
      keywords: 'powerpoint إلى pdf، ppt إلى pdf، pptx إلى pdf، تحويل powerpoint إلى pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/powerpoint-to-pdf`;

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
        'en': `${baseUrl}/powerpoint-to-pdf`,
        'ar': `${baseUrl}/ar/powerpoint-to-pdf`,
        'x-default': `${baseUrl}/powerpoint-to-pdf`,
      },
    },
  };
}

export default function PowerPointToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
