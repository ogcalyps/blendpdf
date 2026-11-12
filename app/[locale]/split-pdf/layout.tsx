import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Split PDF Online Free - Divide PDF into Multiple Files | BlendPDF',
      description: 'Split PDF files online for free. Extract specific pages or divide PDF into multiple files. Visual page selection. No sign-up required.',
      keywords: 'split pdf, extract pdf pages, pdf splitter, separate pdf pages, split pdf online free, divide pdf files',
    },
    ar: {
      title: 'تقسيم PDF مجاناً - تقسيم PDF إلى عدة ملفات | BlendPDF',
      description: 'قم بتقسيم ملفات PDF مجاناً عبر الإنترنت. استخراج صفحات محددة أو تقسيم PDF إلى عدة ملفات. اختيار مرئي للصفحات. لا حاجة للتسجيل.',
      keywords: 'تقسيم pdf، استخراج صفحات pdf، مقسم pdf، تقسيم pdf مجاناً',
    },
    fr: {
      title: 'Diviser un PDF en ligne gratuitement - séparer en plusieurs fichiers | BlendPDF',
      description:
        'Divisez gratuitement un PDF en plusieurs fichiers ou extrayez certaines pages, avec une sélection visuelle des pages. Sans inscription.',
      keywords:
        'diviser pdf, séparer pdf, couper pdf, scinder pdf, séparer pages pdf, diviser pdf en ligne gratuit',
    },
    es: {
      title: 'Dividir PDF online gratis: separar un PDF en varios archivos | BlendPDF',
      description:
        'Divida un PDF online y gratis: extraiga páginas concretas o sepárelo en varios archivos, eligiendo las páginas en una vista previa. Sin registrarse.',
      keywords:
        'dividir pdf, separar pdf, separar páginas de un pdf, dividir un pdf en varios archivos, extraer páginas pdf, dividir pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/split-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/split-pdf'),
    },
  };
}

export default function SplitPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="splitPdf">{children}</PageMessages>;
}

