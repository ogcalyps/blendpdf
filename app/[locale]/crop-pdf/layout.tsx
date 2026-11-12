import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Crop PDF Pages Online Free - Trim PDF Margins Visually | BlendPDF',
      description: 'Crop PDF pages online for free. Drag to select the area to keep, trim margins, and cut PDF pages visually. 100% in your browser — your file never leaves your device. No sign-up.',
      keywords: 'crop pdf, crop pdf pages, trim pdf margins, cut pdf page, crop pdf online free, pdf cropper',
    },
    ar: {
      title: 'قص صفحات PDF مجاناً - اقتطاع الهوامش بصرياً | BlendPDF',
      description: 'قص صفحات PDF مجاناً عبر الإنترنت. اسحب لتحديد المنطقة التي تريد الاحتفاظ بها واقتطع الهوامش بصرياً. تتم المعالجة بالكامل في متصفحك — ملفك لا يغادر جهازك أبداً. بدون تسجيل.',
      keywords: 'قص pdf، قص صفحات pdf، اقتطاع هوامش pdf، قص صفحة pdf مجاناً',
    },
    fr: {
      title: 'Recadrer un PDF en ligne gratuitement - rogner les marges | BlendPDF',
      description:
        'Recadrez les pages d’un PDF gratuitement : sélectionnez la zone à garder et supprimez les marges. Tout se passe dans votre navigateur, votre fichier ne quitte pas votre appareil. Sans inscription.',
      keywords:
        'recadrer pdf, rogner pdf, couper marges pdf, recadrer page pdf, recadrer pdf en ligne gratuit',
    },
    es: {
      title: 'Recortar PDF online gratis: quitar los márgenes de las páginas | BlendPDF',
      description:
        'Recorte un PDF gratis: arrastre para marcar la zona que quiere conservar y quite los márgenes. Todo ocurre en su navegador, sin subir el archivo ni registrarse.',
      keywords:
        'recortar pdf, recortar páginas pdf, recortar márgenes pdf, quitar márgenes de un pdf, cortar página pdf, recortar pdf online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/crop-pdf`;

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
      languages: languageAlternates(baseUrl, '/crop-pdf'),
    },
  };
}

export default function CropPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="cropPdf">{children}</PageMessages>;
}
