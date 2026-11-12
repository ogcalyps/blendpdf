import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Extract Images from PDF Online Free - Save Pictures from PDF | BlendPDF',
      description: 'Extract embedded images from a PDF for free, right in your browser. Get pictures out of PDF files as PNG — your file never leaves your device. No sign-up required.',
      keywords: 'extract images from pdf, save pictures from pdf, get images out of pdf, pdf image extractor, download images from pdf, extract photos from pdf',
    },
    ar: {
      title: 'استخراج الصور من PDF مجاناً - حفظ الصور من ملفات PDF | BlendPDF',
      description: 'استخرج الصور المضمّنة من ملفات PDF مجاناً داخل متصفحك مباشرة. احصل على الصور بصيغة PNG — ملفك لا يغادر جهازك أبداً. لا حاجة للتسجيل.',
      keywords: 'استخراج الصور من pdf، حفظ الصور من pdf، سحب الصور من pdf، أداة استخراج صور pdf',
    },
    fr: {
      title: 'Extraire les images d’un PDF en ligne gratuitement | BlendPDF',
      description:
        'Récupérez gratuitement les images contenues dans un PDF, au format PNG, directement dans votre navigateur. Votre fichier ne quitte pas votre appareil. Sans inscription.',
      keywords:
        'extraire images pdf, récupérer images pdf, enregistrer images pdf, extracteur images pdf, extraire photos pdf',
    },
    es: {
      title: 'Extraer imágenes de un PDF online gratis: guardarlas en PNG | BlendPDF',
      description:
        'Saque gratis las imágenes de un PDF y guárdelas en PNG, directamente en su navegador. Su archivo no sale de su dispositivo y no hace falta registrarse.',
      keywords:
        'extraer imágenes de pdf, extraer imágenes de un pdf, sacar imágenes de un pdf, guardar imágenes de un pdf, descargar imágenes de un pdf, extraer fotos de un pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/extract-images`;

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
      languages: languageAlternates(baseUrl, '/extract-images'),
    },
  };
}

export default function ExtractImagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="extractImages">{children}</PageMessages>;
}
