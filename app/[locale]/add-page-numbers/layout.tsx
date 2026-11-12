import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Add Page Numbers to PDF Online, Free: Pick the Format and Spot | BlendPDF',
      description: 'Number every page of a PDF in seconds. Choose 1, 1 / 10, Page 1 or Page 1 of 10, put it in any of six spots and start from any number. Free, no sign-up, nothing to install.',
      keywords: 'add page numbers to pdf, pdf page numbers, number pdf pages, pdf pagination, add page numbers online free',
    },
    ar: {
      title: 'رقّم صفحات ملف PDF مجانًا واختر شكل الرقم ومكانه | BlendPDF',
      description: 'أضف أرقام الصفحات إلى ملف PDF في ثوانٍ. اختر الشكل الذي يناسبك مثل 1 أو 1 / 10 أو Page 1 of 10، وضعه في أحد ستة مواضع، وابدأ العدّ من أي رقم. مجاني وبلا تسجيل ولا يحتاج إلى تثبيت.',
      keywords: 'إضافة أرقام الصفحات إلى pdf، أرقام صفحات pdf، ترقيم صفحات pdf',
    },
    fr: {
      title: 'Numéroter les pages d’un PDF en ligne gratuitement | BlendPDF',
      description:
        'Ajoutez des numéros de page à un PDF, gratuitement et en ligne. Choisissez le format, la position et le style. Fonctionne dans toutes les langues, sans inscription.',
      keywords:
        'numéroter pages pdf, ajouter numéros de page pdf, pagination pdf, numérotation pdf, numéroter pdf en ligne gratuit',
    },
    es: {
      title: 'Numerar páginas de un PDF online gratis: formato y posición | BlendPDF',
      description:
        'Numere un PDF en segundos: elija 1, 1 / 10, Página 1 o Página 1 de 10, una de seis posiciones y el número inicial. Gratis, sin registrarse ni instalar nada.',
      keywords:
        'numerar páginas pdf, enumerar páginas pdf, poner número de página en un pdf, agregar números de página a un pdf, paginar pdf, numerar pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/add-page-numbers`;
  
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
      languages: languageAlternates(baseUrl, '/add-page-numbers'),
    },
  };
}

export default function AddPageNumbersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="addPageNumbers">{children}</PageMessages>;
}

