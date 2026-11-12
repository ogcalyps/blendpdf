import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'PDF to Excel Converter Online Free - Extract Tables to XLSX | BlendPDF',
      description: 'Convert PDF tables to Excel XLSX format online for free. Extract tables and data from PDFs accurately. Works with all languages. No sign-up required.',
      keywords: 'pdf to excel, pdf to xlsx, convert pdf to excel, pdf excel converter, extract tables from pdf, pdf to excel online free',
    },
    ar: {
      title: 'تحويل PDF إلى Excel مجاناً - استخراج الجداول إلى XLSX | BlendPDF',
      description: 'قم بتحويل جداول PDF إلى تنسيق Excel XLSX مجاناً عبر الإنترنت. استخراج الجداول والبيانات من ملفات PDF بدقة. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'pdf إلى excel، pdf إلى xlsx، تحويل pdf إلى excel، استخراج جداول من pdf',
    },
    fr: {
      title: 'Convertir un PDF en Excel en ligne gratuitement - tableaux en XLSX | BlendPDF',
      description:
        'Convertissez les tableaux d’un PDF en fichier Excel (XLSX) gratuitement. Extrayez tableaux et données avec précision. Fonctionne dans toutes les langues, sans inscription.',
      keywords:
        'pdf en excel, pdf en xlsx, convertir pdf en excel, convertisseur pdf excel, extraire tableau pdf, pdf en excel gratuit',
    },
    es: {
      title: 'PDF a Excel online gratis: pasar las tablas de un PDF a XLSX | BlendPDF',
      description:
        'Convierta las tablas de un PDF en una hoja de Excel (XLSX), online y gratis. Extraiga tablas y datos con precisión. En cualquier idioma y sin registrarse.',
      keywords:
        'pdf a excel, convertir pdf a excel, pasar pdf a excel, pdf a xlsx, extraer tablas de un pdf, convertidor de pdf a excel, pdf a excel online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/pdf-to-excel`;
  
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
      languages: languageAlternates(baseUrl, '/pdf-to-excel'),
    },
  };
}

export default function PDFToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="pdfToExcel">{children}</PageMessages>;
}

