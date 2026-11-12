import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Excel to PDF Converter Online Free - Convert XLSX to PDF | BlendPDF',
      description: 'Convert Excel spreadsheets (XLS, XLSX, ODS, CSV) to PDF online for free. Tables, numbers, and cell formatting carry over to a clean, printable PDF. No sign-up, files deleted within 1 hour.',
      keywords: 'excel to pdf, xlsx to pdf, xls to pdf, convert excel to pdf, excel to pdf converter, spreadsheet to pdf, csv to pdf, ods to pdf, excel to pdf online free',
    },
    ar: {
      title: 'تحويل Excel إلى PDF مجاناً - تحويل XLSX إلى PDF | BlendPDF',
      description: 'قم بتحويل جداول بيانات Excel (XLS، XLSX، ODS، CSV) إلى PDF مجاناً عبر الإنترنت. تنتقل الجداول والأرقام وتنسيق الخلايا إلى ملف PDF نظيف وقابل للطباعة. لا حاجة للتسجيل، وتُحذف الملفات خلال ساعة.',
      keywords: 'excel إلى pdf، xlsx إلى pdf، xls إلى pdf، تحويل excel إلى pdf',
    },
    fr: {
      title: 'Convertir Excel en PDF en ligne gratuitement - XLSX en PDF | BlendPDF',
      description:
        'Convertissez vos feuilles de calcul Excel (XLS, XLSX, ODS, CSV) en PDF gratuitement. Tableaux, nombres et mise en forme des cellules sont conservés dans un PDF propre, prêt à imprimer. Sans inscription, fichiers supprimés dans l’heure.',
      keywords:
        'excel en pdf, xlsx en pdf, xls en pdf, convertir excel en pdf, convertisseur excel pdf, tableur en pdf, csv en pdf, ods en pdf',
    },
    es: {
      title: 'Excel a PDF online gratis: convertir XLSX, XLS y CSV a PDF | BlendPDF',
      description:
        'Convierta hojas de Excel (XLS, XLSX, ODS, CSV) a PDF gratis, con sus tablas, números y formato de celdas. Sin registrarse; se borran en menos de 1 hora.',
      keywords:
        'excel a pdf, convertir excel a pdf, pasar excel a pdf, xlsx a pdf, xls a pdf, hoja de cálculo a pdf, csv a pdf, ods a pdf, excel a pdf online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/excel-to-pdf`;

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
      languages: languageAlternates(baseUrl, '/excel-to-pdf'),
    },
  };
}

export default function ExcelToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="excelToPdf">{children}</PageMessages>;
}
