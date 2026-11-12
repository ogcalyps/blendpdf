import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Reorder PDF Pages Online Free - Rearrange Pages by Drag & Drop | BlendPDF',
      description: 'Rearrange PDF pages by drag and drop. Free online PDF page organizer with visual preview. Works with all languages including Arabic. No sign-up required.',
      keywords: 'reorder pdf pages, rearrange pdf, organize pdf pages, reorder pdf online free, pdf page organizer',
    },
    ar: {
      title: 'إعادة ترتيب صفحات PDF مجاناً - ترتيب الصفحات بالسحب والإفلات | BlendPDF',
      description: 'قم بإعادة ترتيب صفحات PDF بالسحب والإفلات. منظم صفحات PDF مجاني مع معاينة مرئية. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'إعادة ترتيب صفحات pdf، ترتيب pdf، تنظيم صفحات pdf',
    },
    fr: {
      title: 'Réorganiser les pages d’un PDF en ligne gratuitement - glisser-déposer | BlendPDF',
      description:
        'Changez l’ordre des pages d’un PDF par glisser-déposer, avec un aperçu visuel. Gratuit, fonctionne dans toutes les langues, y compris l’arabe. Sans inscription.',
      keywords:
        'réorganiser pages pdf, changer ordre pages pdf, déplacer pages pdf, organiser pdf, réorganiser pdf en ligne gratuit',
    },
    es: {
      title: 'Ordenar páginas de un PDF online gratis: arrastrar y soltar | BlendPDF',
      description:
        'Cambie el orden de las páginas de un PDF arrastrándolas, con vista previa. Gratis y online, en todos los idiomas, incluido el árabe. Sin registrarse.',
      keywords:
        'ordenar páginas pdf, reordenar páginas pdf, ordenar páginas de un pdf, cambiar el orden de las páginas de un pdf, organizar pdf, mover páginas pdf, ordenar pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/reorder-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/reorder-pdf'),
    },
  };
}

export default function ReorderPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="reorderPdf">{children}</PageMessages>;
}

