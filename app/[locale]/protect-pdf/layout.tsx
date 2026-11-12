import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Protect PDF Online Free - Add Password Protection & Encryption | BlendPDF',
      description: 'Add password protection to PDF files online for free. Secure your PDFs with encryption. Works with all languages. No sign-up required.',
      keywords: 'protect pdf, password protect pdf, encrypt pdf, secure pdf, pdf password, pdf encryption online free',
    },
    ar: {
      title: 'حماية PDF مجاناً - إضافة حماية بكلمة مرور وتشفير | BlendPDF',
      description: 'قم بإضافة حماية بكلمة مرور لملفات PDF مجاناً عبر الإنترنت. تأمين ملفات PDF الخاصة بك بالتشفير. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'حماية pdf، حماية pdf بكلمة مرور، تشفير pdf، تأمين pdf',
    },
    fr: {
      title: 'Protéger un PDF par mot de passe en ligne gratuitement | BlendPDF',
      description:
        'Protégez vos fichiers PDF par un mot de passe, gratuitement et en ligne, grâce au chiffrement. Fonctionne dans toutes les langues, sans inscription.',
      keywords:
        'protéger pdf, protéger pdf mot de passe, chiffrer pdf, sécuriser pdf, mot de passe pdf, chiffrement pdf',
    },
    es: {
      title: 'Proteger PDF con contraseña online gratis: cifrar un PDF | BlendPDF',
      description:
        'Ponga una contraseña a sus PDF, online y gratis, y protéjalos con cifrado para que solo quien la conozca pueda abrirlos. En cualquier idioma y sin registrarse.',
      keywords:
        'proteger pdf, proteger pdf con contraseña, poner contraseña a un pdf, cifrar pdf, pdf con contraseña, cifrar pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/protect-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/protect-pdf'),
    },
  };
}

export default function ProtectPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="protectPdf">{children}</PageMessages>;
}

