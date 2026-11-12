import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'PDF to PDF/A Converter Online Free - Checked with veraPDF | BlendPDF',
      description: 'Convert PDF to PDF/A-1b, 2b or 3b for archiving or a thesis deposit. Every file is checked with veraPDF before you download it. Free, no sign-up.',
      keywords: 'pdf to pdf/a, convert pdf to pdf/a, pdf/a converter, pdf/a-1b, pdf/a-2b, pdf/a for thesis, verapdf, archive pdf',
    },
    ar: {
      title: 'تحويل PDF إلى PDF/A مجانًا - مع فحص veraPDF | BlendPDF',
      description: 'حوّل ملف PDF إلى PDF/A-1b أو 2b أو 3b للأرشفة أو لإيداع رسالتك الجامعية. نفحص كل ملف ببرنامج veraPDF قبل التنزيل. مجاني وبلا تسجيل.',
      keywords: 'تحويل pdf إلى pdf/a، صيغة pdf/a، أرشفة pdf، إيداع الرسالة الجامعية، verapdf',
    },
    fr: {
      title: 'Convertir un PDF en PDF/A gratuitement - vérifié par veraPDF | BlendPDF',
      description:
        'Convertissez un PDF en PDF/A-1b, 2b ou 3b pour l’archivage ou le dépôt d’une thèse. Chaque fichier est vérifié avec veraPDF avant le téléchargement. Gratuit, sans inscription.',
      keywords: 'convertir pdf en pdf/a, pdf/a, pdf/a-1b, pdf/a-2b, dépôt de thèse pdf/a, archivage pdf, verapdf, cines facile',
    },
    es: {
      title: 'Convertir PDF a PDF/A online gratis: verificado con veraPDF | BlendPDF',
      description:
        'Convierta un PDF a PDF/A-1b, 2b o 3b para archivarlo o depositar una tesis. Cada archivo se verifica con veraPDF antes de descargarlo. Gratis y sin registrarse.',
      keywords: 'pdf a pdf/a, convertir pdf a pdf/a, convertidor de pdf a pdf/a, pdf/a-1b, pdf/a-2b, pdf/a para tesis, verapdf, archivar pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-pdfa`;

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
      languages: languageAlternates(baseUrl, '/pdf-to-pdfa'),
    },
  };
}

export default function PdfToPdfaLayout({ children }: { children: React.ReactNode }) {
  return <PageMessages namespace="pdfToPdfa">{children}</PageMessages>;
}
