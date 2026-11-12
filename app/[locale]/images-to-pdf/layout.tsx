import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Images to PDF Converter Online Free - JPG PNG to PDF | BlendPDF',
      description: 'Convert JPG, PNG, and other images to PDF online for free. Combine multiple images into one PDF. Works with all languages. No sign-up required.',
      keywords: 'jpg to pdf, png to pdf, image to pdf, convert images to pdf, jpg to pdf online free, images to pdf converter',
    },
    ar: {
      title: 'تحويل الصور إلى PDF مجاناً - JPG PNG إلى PDF | BlendPDF',
      description: 'قم بتحويل صور JPG و PNG وصور أخرى إلى PDF مجاناً عبر الإنترنت. دمج عدة صور في ملف PDF واحد. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'jpg إلى pdf، png إلى pdf، صورة إلى pdf، تحويل الصور إلى pdf',
    },
    fr: {
      title: 'Convertir des images en PDF en ligne gratuitement - JPG, PNG en PDF | BlendPDF',
      description:
        'Convertissez vos images JPG, PNG et autres en PDF gratuitement, et réunissez plusieurs images dans un seul PDF. Fonctionne dans toutes les langues, sans inscription.',
      keywords:
        'jpg en pdf, png en pdf, image en pdf, convertir images en pdf, photo en pdf, jpg en pdf gratuit',
    },
    es: {
      title: 'JPG a PDF online gratis: convertir imágenes y fotos a PDF | BlendPDF',
      description:
        'Convierta imágenes JPG, PNG y de otros formatos a PDF, online y gratis, y junte varias fotos en un solo PDF. En cualquier idioma y sin registrarse.',
      keywords:
        'jpg a pdf, png a pdf, imagen a pdf, foto a pdf, convertir imágenes a pdf, convertir jpg a pdf, juntar fotos en un pdf, jpg a pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/images-to-pdf`;
  
  return {
    title: meta.title,
    description: meta.description,
    keywords: meta.keywords,
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: canonicalUrl,
      siteName: 'BlendPDF',
      locale: ogLocale(locale),
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
      languages: languageAlternates(baseUrl, '/images-to-pdf'),
    },
  };
}

export default function ImagesToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="imagesToPdf">{children}</PageMessages>;
}

