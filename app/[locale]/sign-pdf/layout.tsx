import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  
  const metadataByLocale = {
    en: {
      title: 'Sign PDF Online Free - Add Electronic & Digital Signatures | BlendPDF',
      description: 'Add electronic signatures to PDF files online for free. Sign documents digitally with ease. Works with all languages. No sign-up required.',
      keywords: 'sign pdf, pdf signature, electronic signature, digital signature, sign pdf online free',
    },
    ar: {
      title: 'توقيع PDF مجاناً - إضافة توقيعات إلكترونية ورقمية | BlendPDF',
      description: 'قم بإضافة توقيعات إلكترونية إلى ملفات PDF مجاناً عبر الإنترنت. توقيع المستندات رقمياً بسهولة. يعمل مع جميع اللغات. لا حاجة للتسجيل.',
      keywords: 'توقيع pdf، توقيع pdf إلكتروني، توقيع رقمي، توقيع pdf مجاناً',
    },
    fr: {
      title: 'Signer un PDF en ligne gratuitement - ajouter votre signature | BlendPDF',
      description:
        'Ajoutez gratuitement votre signature à un PDF : dessinée, saisie au clavier ou importée en image. Fonctionne dans toutes les langues, sans inscription.',
      keywords:
        'signer pdf, signature pdf, signer un document pdf, ajouter signature pdf, signer pdf en ligne gratuit',
    },
    es: {
      title: 'Firmar PDF online gratis: agregar su firma electrónica | BlendPDF',
      description:
        'Agregue su firma electrónica a archivos PDF, online y gratis, y firme documentos sin imprimirlos. Funciona en todos los idiomas y no hace falta registrarse.',
      keywords:
        'firmar pdf, firmar un pdf, firma electrónica pdf, firma digital pdf, poner firma en un pdf, firmar pdf online gratis',
    },
  };
  
  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/sign-pdf`;
  
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
      languages: languageAlternates(baseUrl, '/sign-pdf'),
    },
  };
}

export default function SignPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="signPdf">{children}</PageMessages>;
}

