import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Word to PDF Converter Online Free - Convert DOCX to PDF | BlendPDF',
      description: 'Convert Word documents (DOC, DOCX, ODT, RTF) to PDF format online for free. Preserves formatting and layout. No sign-up required. Works with all languages.',
      keywords: 'word to pdf, docx to pdf, doc to pdf, convert word to pdf, word pdf converter, odt to pdf, rtf to pdf, word to pdf online free',
    },
    ar: {
      title: 'تحويل Word إلى PDF مجاناً - تحويل DOCX إلى PDF | BlendPDF',
      description: 'قم بتحويل مستندات Word (DOC، DOCX، ODT، RTF) إلى تنسيق PDF مجاناً عبر الإنترنت. يحافظ على التنسيق والتخطيط. لا حاجة للتسجيل. يعمل مع جميع اللغات.',
      keywords: 'word إلى pdf، docx إلى pdf، doc إلى pdf، تحويل word إلى pdf',
    },
    fr: {
      title: 'Convertir Word en PDF en ligne gratuitement - DOCX en PDF | BlendPDF',
      description:
        'Convertissez vos documents Word (DOC, DOCX, ODT, RTF) en PDF gratuitement, en conservant la mise en forme et la mise en page. Sans inscription, fonctionne dans toutes les langues.',
      keywords:
        'word en pdf, docx en pdf, doc en pdf, convertir word en pdf, odt en pdf, rtf en pdf, word en pdf gratuit',
    },
    es: {
      title: 'Word a PDF online gratis: convertir DOCX y DOC a PDF | BlendPDF',
      description:
        'Convierta documentos de Word (DOC, DOCX, ODT, RTF) a PDF gratis, sin perder el formato ni el diseño de página. Funciona en cualquier idioma y sin registrarse.',
      keywords:
        'word a pdf, convertir word a pdf, pasar word a pdf, docx a pdf, doc a pdf, odt a pdf, rtf a pdf, word a pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/word-to-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/word-to-pdf'),
    },
  };
}

export default function WordToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="wordToPdf">{children}</PageMessages>;
}
