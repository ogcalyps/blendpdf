import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'PowerPoint to PDF Converter Online Free - Convert PPT to PDF | BlendPDF',
      description: 'Convert PowerPoint presentations (PPT, PPTX, ODP) to PDF online for free. Each slide becomes a PDF page with fonts and images preserved. No sign-up, files deleted within 1 hour.',
      keywords: 'powerpoint to pdf, ppt to pdf, pptx to pdf, convert powerpoint to pdf, powerpoint to pdf converter, odp to pdf, ppt to pdf online free, presentation to pdf',
    },
    ar: {
      title: 'تحويل PowerPoint إلى PDF مجاناً - تحويل PPT إلى PDF | BlendPDF',
      description: 'قم بتحويل عروض PowerPoint التقديمية (PPT، PPTX، ODP) إلى PDF مجاناً عبر الإنترنت. تتحول كل شريحة إلى صفحة PDF مع الحفاظ على الخطوط والصور. لا حاجة للتسجيل، وتُحذف الملفات خلال ساعة.',
      keywords: 'powerpoint إلى pdf، ppt إلى pdf، pptx إلى pdf، تحويل powerpoint إلى pdf',
    },
    fr: {
      title: 'Convertir un PowerPoint en PDF en ligne gratuitement - PPT en PDF | BlendPDF',
      description:
        'Convertissez vos présentations PowerPoint (PPT, PPTX, ODP) en PDF gratuitement. Chaque diapositive devient une page PDF, polices et images comprises. Sans inscription, fichiers supprimés dans l’heure.',
      keywords:
        'powerpoint en pdf, ppt en pdf, pptx en pdf, convertir powerpoint en pdf, odp en pdf, présentation en pdf',
    },
    es: {
      title: 'PowerPoint a PDF online gratis: convertir PPT y PPTX a PDF | BlendPDF',
      description:
        'Convierta su PowerPoint (PPT, PPTX, ODP) a PDF gratis: cada diapositiva será una página, con sus fuentes e imágenes. Sin registro; se borra en menos de 1 hora.',
      keywords:
        'powerpoint a pdf, ppt a pdf, pptx a pdf, convertir powerpoint a pdf, pasar powerpoint a pdf, odp a pdf, presentación a pdf, ppt a pdf online gratis',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/powerpoint-to-pdf`;

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
      languages: languageAlternates(baseUrl, '/powerpoint-to-pdf'),
    },
  };
}

export default function PowerPointToPDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="powerpointToPdf">{children}</PageMessages>;
}
