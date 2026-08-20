import { Metadata } from 'next';

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
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
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
      languages: {
        'en': `${baseUrl}/excel-to-pdf`,
        'ar': `${baseUrl}/ar/excel-to-pdf`,
        'x-default': `${baseUrl}/excel-to-pdf`,
      },
    },
  };
}

export default function ExcelToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
