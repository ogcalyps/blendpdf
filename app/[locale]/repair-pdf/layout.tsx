import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Repair PDF Online Free - Fix Corrupted or Damaged PDF Files | BlendPDF',
      description: 'Fix corrupted or damaged PDF files online for free. Recover broken PDFs and restore file integrity. Works with all languages. No sign-up required.',
      keywords: 'repair pdf, fix pdf, corrupted pdf, damaged pdf, pdf repair tool, fix broken pdf online free',
    },
    ar: {
      title: 'إصلاح PDF مجاناً - إصلاح ملفات PDF التالفة أو المعطوبة | BlendPDF',
      description: 'قم بإصلاح ملفات PDF التالفة أو المعطوبة مجاناً عبر الإنترنت. استعادة ملفات PDF المكسورة. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'إصلاح pdf، إصلاح ملف pdf، ملف pdf تالف، أداة إصلاح pdf',
    },
    fr: {
      title: 'Réparer un PDF en ligne gratuitement - fichier endommagé ou corrompu | BlendPDF',
      description:
        'Réparez gratuitement un fichier PDF endommagé ou corrompu et récupérez les PDF qui ne s’ouvrent plus. Fonctionne dans toutes les langues, sans inscription.',
      keywords:
        'réparer pdf, pdf corrompu, pdf endommagé, réparer pdf endommagé, outil réparation pdf, pdf qui ne s’ouvre pas',
    },
    es: {
      title: 'Reparar PDF online gratis: recuperar archivos PDF dañados | BlendPDF',
      description:
        'Repare gratis archivos PDF dañados o corruptos y recupere los PDF que ya no se abren, para que vuelvan a funcionar. En cualquier idioma y sin registrarse.',
      keywords:
        'reparar pdf, reparar pdf dañado, pdf dañado, pdf corrupto, recuperar pdf dañado, pdf no se abre, reparar pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/repair-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/repair-pdf'),
    },
  };
}

export default function RepairPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="repairPdf">{children}</PageMessages>;
}

