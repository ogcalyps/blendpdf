import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'PDF to Word Converter Online Free - Convert PDF to DOCX | BlendPDF',
      description: 'Convert PDF to Word DOCX format online for free. Preserves formatting and text. No sign-up required. Works with all languages including Arabic.',
      keywords: 'pdf to word, pdf to docx, convert pdf to word, pdf word converter, pdf to word online free, extract text from pdf',
    },
    ar: {
      title: 'تحويل PDF إلى Word مجاناً - تحويل PDF إلى DOCX | BlendPDF',
      description: 'قم بتحويل PDF إلى تنسيق Word DOCX مجاناً عبر الإنترنت. يحافظ على التنسيق والنص. لا حاجة للتسجيل. يعمل مع جميع اللغات بما في ذلك العربية.',
      keywords: 'pdf إلى word، pdf إلى docx، تحويل pdf إلى word، محول pdf إلى word',
    },
    fr: {
      title: 'Convertir un PDF en Word en ligne gratuitement - PDF en DOCX | BlendPDF',
      description:
        'Convertissez un PDF en document Word (DOCX) gratuitement, en conservant le texte et la mise en forme. Sans inscription. Fonctionne dans toutes les langues, y compris l’arabe.',
      keywords:
        'pdf en word, pdf en docx, convertir pdf en word, convertisseur pdf word, pdf en word gratuit, transformer pdf en word',
    },
    es: {
      title: 'PDF a Word online gratis: convertir PDF a DOCX editable | BlendPDF',
      description:
        'Convierta un PDF a Word (DOCX) gratis y conserve el texto y el formato para seguir editándolo. Sin registro. Funciona en todos los idiomas, incluido el árabe.',
      keywords:
        'pdf a word, convertir pdf a word, pasar pdf a word, pdf a word editable, pdf a docx, convertidor de pdf a word, pdf a word online gratis, extraer texto de un pdf',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-word`;
  
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
      languages: languageAlternates(baseUrl, '/pdf-to-word'),
    },
  };
}

export default function PDFToWordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="pdfToWord">{children}</PageMessages>;
}

