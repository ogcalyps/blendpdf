import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Rotate PDF Pages Online Free - 90° 180° 270° Rotation | BlendPDF',
      description: 'Rotate PDF pages 90, 180, or 270 degrees online for free. Visual preview included. Works with all languages including Arabic. No sign-up required.',
      keywords: 'rotate pdf, rotate pdf pages, pdf rotator, turn pdf pages, rotate pdf online free, pdf page rotation',
    },
    ar: {
      title: 'تدوير صفحات PDF مجاناً - 90° 180° 270° | BlendPDF',
      description: 'قم بتدوير صفحات PDF بزوايا 90 أو 180 أو 270 درجة مجاناً عبر الإنترنت. معاينة مرئية. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'تدوير pdf، تدوير صفحات pdf، أداة تدوير pdf، تدوير صفحات pdf مجاناً',
    },
    fr: {
      title: 'Faire pivoter un PDF en ligne gratuitement - rotation 90°, 180°, 270° | BlendPDF',
      description:
        'Faites pivoter les pages d’un PDF de 90, 180 ou 270 degrés, gratuitement et en ligne, avec aperçu visuel. Fonctionne dans toutes les langues, y compris l’arabe. Sans inscription.',
      keywords:
        'pivoter pdf, faire pivoter pdf, tourner pdf, rotation pdf, tourner page pdf en ligne gratuit',
    },
    es: {
      title: 'Rotar PDF online gratis: girar páginas 90°, 180° o 270° | BlendPDF',
      description:
        'Gire las páginas de un PDF 90, 180 o 270 grados, online y gratis, con vista previa. Funciona en todos los idiomas, incluido el árabe. Sin registrarse.',
      keywords:
        'rotar pdf, girar pdf, girar páginas de un pdf, rotar páginas pdf, girar pdf y guardar, rotar pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/rotate-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/rotate-pdf'),
    },
  };
}

export default function RotatePDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="rotatePdf">{children}</PageMessages>;
}

