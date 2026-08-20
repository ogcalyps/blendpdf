import { Metadata } from 'next';

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
        'en': `${baseUrl}/pdf-to-excel`,
        'ar': `${baseUrl}/ar/pdf-to-excel`,
        'x-default': `${baseUrl}/pdf-to-excel`,
      },
    },
  };
}

export default function PDFToExcelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

