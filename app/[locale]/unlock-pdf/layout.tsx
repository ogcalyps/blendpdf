import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'Unlock PDF Online - Remove Restrictions & Passwords Free | BlendPDF',
      description: 'Remove PDF restrictions like printing and copying locks without a password, or unlock password-protected PDFs. Free online tool, no sign-up.',
      keywords: 'unlock pdf, remove pdf restrictions, remove pdf password, decrypt pdf, unlock encrypted pdf, remove pdf password online free',
    },
    ar: {
      title: 'إلغاء قفل PDF مجاناً - إزالة حماية كلمة المرور | BlendPDF',
      description: 'قم بإزالة حماية كلمة المرور من ملفات PDF مجاناً عبر الإنترنت. إلغاء قفل ملفات PDF المشفرة. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'إلغاء قفل pdf، إزالة كلمة مرور pdf، فك تشفير pdf',
    },
    fr: {
      title: 'Déverrouiller un PDF en ligne - supprimer restrictions et mot de passe | BlendPDF',
      description:
        'Levez les restrictions d’un PDF (impression, copie) sans mot de passe, ou déverrouillez un PDF protégé dont vous connaissez le mot de passe. Outil gratuit en ligne, sans inscription.',
      keywords:
        'déverrouiller pdf, supprimer restrictions pdf, enlever mot de passe pdf, déchiffrer pdf, débloquer pdf',
    },
    es: {
      title: 'Desbloquear PDF online gratis: quitar restricciones y contraseña | BlendPDF',
      description:
        'Quite las restricciones de impresión o copia de un PDF sin contraseña, o desbloquee un PDF protegido si conoce la contraseña. Gratis, online y sin registrarse.',
      keywords:
        'desbloquear pdf, quitar contraseña pdf, quitar la contraseña a un pdf, quitar restricciones pdf, desproteger pdf, descifrar pdf, desbloquear pdf online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/unlock-pdf`;

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
      languages: languageAlternates(baseUrl, '/unlock-pdf'),
    },
  };
}

export default function UnlockPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="unlockPdf">{children}</PageMessages>;
}

