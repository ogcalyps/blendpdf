import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Add Watermark to PDF Online Free - Text & Image Watermarks | BlendPDF',
      description: 'Add text or image watermarks to PDF files online for free. Brand your PDFs with custom watermarks. Works with all languages. No sign-up required.',
      keywords: 'watermark pdf, add watermark to pdf, pdf watermark, brand pdf, add watermark online free',
    },
    ar: {
      title: 'إضافة علامة مائية إلى PDF مجاناً - علامات مائية نصية وصورية | BlendPDF',
      description: 'قم بإضافة علامات مائية نصية أو صورية إلى ملفات PDF مجاناً عبر الإنترنت. وضع علامة على ملفات PDF الخاصة بك. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'علامة مائية pdf، إضافة علامة مائية إلى pdf، علامة مائية pdf',
    },
    fr: {
      title: 'Ajouter un filigrane à un PDF en ligne gratuitement - texte ou image | BlendPDF',
      description:
        'Ajoutez gratuitement un filigrane texte ou image à vos PDF, par exemple « Confidentiel » ou votre logo. Fonctionne dans toutes les langues, sans inscription.',
      keywords:
        'filigrane pdf, ajouter filigrane pdf, mettre un filigrane sur un pdf, tampon pdf, filigrane pdf gratuit',
    },
    es: {
      title: 'Agregar marca de agua a un PDF online gratis: texto o imagen | BlendPDF',
      description:
        'Agregue a sus PDF una marca de agua de texto o de imagen, como “Confidencial” o su logotipo. Online y gratis, en todos los idiomas y sin registrarse.',
      keywords:
        'marca de agua pdf, agregar marca de agua a un pdf, poner marca de agua en un pdf, marca de agua en pdf online gratis, poner logo en un pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/watermark-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/watermark-pdf'),
    },
  };
}

export default function WatermarkPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="watermarkPdf">{children}</PageMessages>;
}

