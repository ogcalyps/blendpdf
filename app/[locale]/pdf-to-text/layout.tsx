import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'PDF to Text Converter - Extract Text from PDF Free | BlendPDF',
      description: 'Extract and copy text from PDF files for free, right in your browser. Your file never leaves your device. No upload, no sign-up, instant results.',
      keywords: 'pdf to text converter, extract text from pdf, copy text from pdf, pdf to txt, pdf text extractor, convert pdf to text online free',
    },
    ar: {
      title: 'تحويل PDF إلى نص - استخراج النص من PDF مجاناً | BlendPDF',
      description: 'استخرج النص من ملفات PDF وانسخه مجاناً داخل متصفحك مباشرة. ملفك لا يغادر جهازك أبداً. بدون رفع، بدون تسجيل، ونتائج فورية.',
      keywords: 'تحويل pdf إلى نص، استخراج النص من pdf، نسخ النص من pdf، pdf إلى txt، محول pdf إلى نص مجاناً',
    },
    fr: {
      title: 'Convertir un PDF en texte - extraire le texte d’un PDF gratuitement | BlendPDF',
      description:
        'Extrayez et copiez gratuitement le texte d’un PDF, directement dans votre navigateur. Votre fichier ne quitte pas votre appareil : aucun envoi, aucune inscription, résultat immédiat.',
      keywords:
        'pdf en texte, extraire texte pdf, copier texte pdf, pdf en txt, extracteur texte pdf, convertir pdf en texte gratuit',
    },
    es: {
      title: 'PDF a texto gratis: extraer y copiar el texto de un PDF | BlendPDF',
      description:
        'Extraiga y copie gratis el texto de un PDF, directamente en su navegador. Su archivo no sale de su dispositivo: sin subir nada, sin registro y al instante.',
      keywords:
        'pdf a texto, extraer texto de un pdf, copiar texto de un pdf, pdf a txt, sacar el texto de un pdf, convertir pdf a texto online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-text`;

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
      languages: languageAlternates(baseUrl, '/pdf-to-text'),
    },
  };
}

export default function PdfToTextLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="pdfToText">{children}</PageMessages>;
}
