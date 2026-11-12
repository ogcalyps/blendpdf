import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Edit PDF Online Free - Write in Arabic or English | BlendPDF',
      description:
        'Edit a PDF online for free: add text in Arabic or English, images, signatures, drawings and highlights, change a line of the existing text (beta), and rotate, reorder or delete pages. It all runs in your browser, with no sign-up.',
      keywords:
        'edit pdf, edit pdf online free, pdf editor, add text to pdf, write on pdf, edit pdf text, arabic pdf editor, write arabic on pdf, highlight pdf',
    },
    ar: {
      title: 'تعديل ملف PDF والكتابة عليه بالعربي مجانًا | BlendPDF',
      description:
        'عدّل ملف PDF مجانًا: اكتب عليه بالعربية أو الإنجليزية، وأضف الصور وتوقيعك، وارسم وظلّل ما تريد، وغيّر سطرًا من نصه الأصلي (ميزة تجريبية)، ودوّر الصفحات أو رتّبها أو احذفها. يعمل في متصفحك مباشرة وبلا تسجيل.',
      keywords:
        'تعديل pdf، تعديل ملف pdf، الكتابة على ملف pdf، الكتابة على pdf بالعربي، تعديل نص pdf، محرر pdf عربي، إضافة نص إلى pdf، تعديل pdf مجانا',
    },
    fr: {
      title: 'Modifier un PDF en ligne gratuitement - texte, signature, pages | BlendPDF',
      description:
        'Modifiez un PDF gratuitement : ajoutez du texte (y compris en arabe), des images, des signatures, des dessins et du surlignage, corrigez une ligne du texte existant (bêta), et faites pivoter, réorganisez ou supprimez des pages. Tout se fait dans votre navigateur, sans inscription.',
      keywords:
        'modifier pdf, modifier pdf en ligne gratuit, éditeur pdf, ajouter texte pdf, écrire sur un pdf, modifier texte pdf, surligner pdf, écrire en arabe sur un pdf',
    },
    es: {
      title: 'Editar PDF online gratis: escribir en español o en árabe | BlendPDF',
      description:
        'Edite un PDF gratis: escriba en español o árabe, agregue imágenes y firmas, resalte, corrija una línea (beta) y organice páginas. En su navegador, sin registro.',
      keywords:
        'editar pdf, editar pdf online gratis, editor de pdf, modificar pdf, escribir en un pdf, agregar texto a un pdf, editar el texto de un pdf, escribir en árabe en un pdf, editor de pdf en árabe, resaltar pdf',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/edit-pdf`;

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
      languages: languageAlternates(baseUrl, '/edit-pdf'),
    },
  };
}

export default function EditPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="editPdf">{children}</PageMessages>;
}
