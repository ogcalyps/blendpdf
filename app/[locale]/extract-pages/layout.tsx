import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Extract Pages from PDF Online, Free, No Upload | BlendPDF',
      description: 'Type the pages you want, like 1-3, 5, and download them as a new PDF or one file per page. Free, no sign-up, no watermark, and your PDF never leaves your device.',
      keywords: 'extract pages from pdf, save certain pages of pdf, pdf page extractor, extract pdf pages online free, pull pages from pdf',
    },
    ar: {
      title: 'استخرج صفحات من ملف PDF واحفظها في ملف جديد مجانًا | BlendPDF',
      description: 'اختر الصفحات التي تحتاجها واحفظها في ملف PDF جديد، أو اجعل كل صفحة في ملف مستقل. مجاني وبلا تسجيل، ويعمل داخل متصفحك فلا يغادر ملفك جهازك.',
      keywords: 'استخراج صفحات من pdf، حفظ صفحات محددة من pdf، استخراج صفحات pdf مجاناً، أداة استخراج صفحات pdf',
    },
    fr: {
      title: 'Extraire des pages d’un PDF en ligne gratuitement | BlendPDF',
      description:
        'Enregistrez gratuitement certaines pages d’un PDF dans un nouveau fichier, ou une page par fichier. Tout se passe dans votre navigateur, vos fichiers ne quittent pas votre appareil. Sans inscription.',
      keywords:
        'extraire pages pdf, extraire une page pdf, enregistrer certaines pages pdf, séparer pages pdf, extraire pages pdf en ligne gratuit',
    },
    es: {
      title: 'Extraer páginas de un PDF online gratis, sin subir el archivo | BlendPDF',
      description:
        'Escriba las páginas que quiere, como 1-3, 5, y guárdelas en un PDF nuevo o en un archivo por página. Gratis, sin registro ni marca de agua, y sin subir su PDF.',
      keywords:
        'extraer páginas de un pdf, extraer páginas pdf, guardar algunas páginas de un pdf, separar páginas de un pdf, extraer hojas de un pdf, extraer páginas pdf online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/extract-pages`;

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
      languages: languageAlternates(baseUrl, '/extract-pages'),
    },
  };
}

export default function ExtractPagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="extractPages">{children}</PageMessages>;
}
