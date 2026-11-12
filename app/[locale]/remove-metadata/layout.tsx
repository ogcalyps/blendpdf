import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Remove PDF Metadata Online Free - Clean Hidden Data | BlendPDF',
      description: 'Remove hidden author names, software traces and timestamps from PDF files before sharing. 100% in your browser - your file never leaves your device.',
      keywords: 'remove pdf metadata, clean pdf metadata, pdf privacy, strip pdf metadata, delete pdf author, pdf metadata remover, remove hidden data from pdf',
    },
    ar: {
      title: 'إزالة البيانات الوصفية من PDF مجاناً - احمِ خصوصيتك | BlendPDF',
      description: 'أزل أسماء المؤلفين المخفية وآثار البرامج والطوابع الزمنية من ملفات PDF قبل مشاركتها. تتم المعالجة بالكامل في متصفحك — ملفك لا يغادر جهازك أبداً.',
      keywords: 'إزالة البيانات الوصفية من pdf، تنظيف بيانات pdf، خصوصية pdf، حذف اسم المؤلف من pdf، إزالة البيانات المخفية من pdf',
    },
    fr: {
      title: 'Supprimer les métadonnées d’un PDF en ligne gratuitement | BlendPDF',
      description:
        'Effacez d’un PDF le nom de l’auteur, les traces du logiciel et les dates cachées avant de le partager. Tout se passe dans votre navigateur, votre fichier ne quitte pas votre appareil.',
      keywords:
        'supprimer métadonnées pdf, nettoyer métadonnées pdf, confidentialité pdf, effacer auteur pdf, données cachées pdf',
    },
    es: {
      title: 'Eliminar metadatos de un PDF online gratis: borrar datos ocultos | BlendPDF',
      description:
        'Borre de sus PDF el nombre del autor, los rastros del programa y las fechas ocultas antes de compartirlos. Todo ocurre en su navegador, sin subir el archivo.',
      keywords:
        'eliminar metadatos pdf, borrar metadatos de un pdf, limpiar metadatos pdf, privacidad pdf, quitar el autor de un pdf, datos ocultos pdf, eliminar metadatos pdf online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/remove-metadata`;

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
      languages: languageAlternates(baseUrl, '/remove-metadata'),
    },
  };
}

export default function RemoveMetadataLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="removeMetadata">{children}</PageMessages>;
}
