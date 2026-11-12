import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Compress PDF Online Free - Reduce File Size Up to 90% | BlendPDF',
      description: 'Compress PDF files online for free. Reduce PDF file size by up to 90% while maintaining quality. No sign-up required. Works with all languages.',
      keywords: 'compress pdf, reduce pdf size, pdf compressor, shrink pdf, make pdf smaller, compress pdf online free, reduce pdf file size',
    },
    ar: {
      title: 'ضغط PDF مجاناً - تقليل حجم الملف حتى 90% | BlendPDF',
      description: 'قم بضغط ملفات PDF مجاناً عبر الإنترنت. تقليل حجم ملف PDF حتى 90% مع الحفاظ على الجودة. لا حاجة للتسجيل. يعمل مع جميع اللغات.',
      keywords: 'ضغط pdf، تقليل حجم pdf، ضاغط pdf، ضغط pdf مجاناً',
    },
    fr: {
      title: 'Compresser un PDF en ligne gratuitement - jusqu’à 90 % plus léger | BlendPDF',
      description:
        'Réduisez la taille de vos fichiers PDF jusqu’à 90 % tout en préservant la qualité. Gratuit, sans inscription, fonctionne dans toutes les langues.',
      keywords:
        'compresser pdf, réduire taille pdf, compresseur pdf, alléger pdf, réduire poids pdf, compresser pdf en ligne gratuit',
    },
    es: {
      title: 'Comprimir PDF online gratis: reducir el peso hasta un 90 % | BlendPDF',
      description:
        'Comprima archivos PDF online y gratis: reduzca su tamaño hasta un 90 % manteniendo la calidad. Funciona en cualquier idioma y no hace falta registrarse.',
      keywords:
        'comprimir pdf, reducir tamaño pdf, reducir peso pdf, comprimir un pdf, hacer un pdf más pequeño, compresor de pdf, comprimir pdf online gratis, reducir el tamaño de un pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/compress-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/compress-pdf'),
    },
  };
}

export default function CompressPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="compressPdf">{children}</PageMessages>;
}

