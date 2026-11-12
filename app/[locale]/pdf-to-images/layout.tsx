import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'PDF to Images Converter Online Free - Convert PDF to JPG PNG | BlendPDF',
      description: 'Convert PDF pages to high-quality images (JPG, PNG) online for free. Choose DPI quality. Works with Arabic, Hebrew, and all languages. No sign-up required.',
      keywords: 'pdf to jpg, pdf to png, pdf to images, convert pdf to image, pdf to jpg online free, pdf to png converter',
    },
    ar: {
      title: 'تحويل PDF إلى صور مجاناً - تحويل PDF إلى JPG PNG | BlendPDF',
      description: 'قم بتحويل صفحات PDF إلى صور عالية الجودة (JPG، PNG) مجاناً عبر الإنترنت. اختر جودة DPI. يعمل مع العربية والعبرية وجميع اللغات. لا حاجة للتسجيل.',
      keywords: 'pdf إلى jpg، pdf إلى png، pdf إلى صور، تحويل pdf إلى صورة',
    },
    fr: {
      title: 'Convertir un PDF en images en ligne gratuitement - PDF en JPG, PNG | BlendPDF',
      description:
        'Convertissez les pages d’un PDF en images de haute qualité (JPG, PNG) gratuitement, à la résolution de votre choix (DPI). Fonctionne avec l’arabe, l’hébreu et toutes les langues. Sans inscription.',
      keywords:
        'pdf en jpg, pdf en png, pdf en image, convertir pdf en image, convertir pdf en jpg gratuit, convertisseur pdf png',
    },
    es: {
      title: 'PDF a JPG online gratis: convertir un PDF en imágenes JPG o PNG | BlendPDF',
      description:
        'Pase gratis las páginas de un PDF a imágenes JPG o PNG de alta calidad y elija la resolución (DPI). Funciona con árabe, hebreo y cualquier idioma. Sin registro.',
      keywords:
        'pdf a jpg, pdf a png, pdf a imagen, convertir pdf a imagen, convertir pdf a jpg, pasar pdf a jpg, pdf a jpg online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-images`;
  
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
      languages: languageAlternates(baseUrl, '/pdf-to-images'),
    },
  };
}

export default function PDFToImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="pdfToImages">{children}</PageMessages>;
}

