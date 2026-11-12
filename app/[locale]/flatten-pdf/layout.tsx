import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Flatten PDF Online Free - Make PDF Forms Non-Editable | BlendPDF',
      description: 'Flatten PDF form fields online for free. Make filled forms non-editable so answers can\'t be changed. 100% in your browser — files never leave your device. No sign-up.',
      keywords: 'flatten pdf, flatten pdf form, make pdf non editable, lock pdf form fields, flatten pdf online free, non editable pdf',
    },
    ar: {
      title: 'تسطيح PDF مجاناً - جعل نماذج PDF غير قابلة للتعديل | BlendPDF',
      description: 'قم بتسطيح حقول نماذج PDF مجاناً عبر الإنترنت. اجعل النماذج المعبأة غير قابلة للتعديل. المعالجة تتم بالكامل في متصفحك — ملفاتك لا تغادر جهازك. لا حاجة للتسجيل.',
      keywords: 'تسطيح pdf، تسطيح نموذج pdf، جعل pdf غير قابل للتعديل، قفل حقول نموذج pdf',
    },
    fr: {
      title: 'Aplatir un PDF en ligne gratuitement - formulaires non modifiables | BlendPDF',
      description:
        'Aplatissez les champs d’un formulaire PDF gratuitement : les réponses saisies ne peuvent plus être modifiées. Tout se passe dans votre navigateur, vos fichiers ne quittent pas votre appareil. Sans inscription.',
      keywords:
        'aplatir pdf, aplatir formulaire pdf, pdf non modifiable, verrouiller champs pdf, aplatir pdf en ligne gratuit',
    },
    es: {
      title: 'Aplanar PDF online gratis: hacer un formulario PDF no editable | BlendPDF',
      description:
        'Aplane los campos de un formulario PDF gratis para que las respuestas ya no se puedan cambiar. Todo ocurre en su navegador, sin subir el archivo ni registrarse.',
      keywords:
        'aplanar pdf, aplanar formulario pdf, hacer un pdf no editable, pdf no editable, bloquear campos de un pdf, aplanar pdf online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/flatten-pdf`;

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
      languages: languageAlternates(baseUrl, '/flatten-pdf'),
    },
  };
}

export default function FlattenPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="flattenPdf">{children}</PageMessages>;
}
