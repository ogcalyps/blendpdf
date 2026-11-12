import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Delete PDF Pages Online Free - Remove Unwanted Pages | BlendPDF',
      description: 'Remove unwanted pages from PDF files online for free. Visual page selection. Works with all languages including Arabic. No sign-up required.',
      keywords: 'delete pdf pages, remove pdf pages, pdf page remover, delete pages from pdf online free',
    },
    ar: {
      title: 'حذف صفحات PDF مجاناً - إزالة الصفحات غير المرغوب فيها | BlendPDF',
      description: 'قم بإزالة الصفحات غير المرغوب فيها من ملفات PDF مجاناً عبر الإنترنت. اختيار مرئي للصفحات. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'حذف صفحات pdf، إزالة صفحات pdf، أداة حذف صفحات pdf',
    },
    fr: {
      title: 'Supprimer des pages d’un PDF en ligne gratuitement | BlendPDF',
      description:
        'Retirez les pages inutiles d’un PDF, gratuitement et en ligne, en les sélectionnant visuellement. Fonctionne dans toutes les langues, y compris l’arabe. Sans inscription.',
      keywords:
        'supprimer pages pdf, retirer pages pdf, enlever page pdf, supprimer page pdf en ligne gratuit',
    },
    es: {
      title: 'Eliminar páginas de un PDF online gratis: quitar las que sobran | BlendPDF',
      description:
        'Quite de su PDF las páginas que sobran, online y gratis, eligiéndolas en una vista previa. Funciona en todos los idiomas, incluido el árabe. Sin registrarse.',
      keywords:
        'eliminar páginas pdf, eliminar páginas de un pdf, borrar páginas pdf, quitar páginas de un pdf, eliminar hojas de un pdf, eliminar páginas pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/delete-pages`;
  
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
      languages: languageAlternates(baseUrl, '/delete-pages'),
    },
  };
}

export default function DeletePagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="deletePages">{children}</PageMessages>;
}

