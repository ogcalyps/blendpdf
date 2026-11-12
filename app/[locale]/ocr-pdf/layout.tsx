import { Metadata } from 'next';
import { languageAlternates, ogLocale } from '@/lib/i18n/seo';
import { PageMessages } from '@/components/i18n/PageMessages';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';

  const metadataByLocale = {
    en: {
      title: 'OCR PDF Online Free - Make Scanned PDFs Searchable | BlendPDF',
      description: 'Make scanned PDFs searchable with OCR, free and online. First-class Arabic OCR plus English, French and Spanish. Turns scanned pages into selectable, copyable text. No sign-up required.',
      keywords: 'ocr pdf, make pdf searchable, scanned pdf to text, pdf ocr online free, searchable pdf, arabic ocr pdf, ocr arabic pdf, recognize text in pdf',
    },
    ar: {
      title: 'التعرف الضوئي على الحروف العربية في PDF - OCR عربي مجاني | BlendPDF',
      description: 'أداة OCR مجانية تدعم العربية بشكل كامل: حوّل ملفات PDF الممسوحة ضوئياً إلى نصوص قابلة للبحث والنسخ. تدعم العربية والإنجليزية والفرنسية والإسبانية. بدون تسجيل.',
      keywords: 'التعرف الضوئي على الحروف العربية، OCR عربي، تحويل PDF ممسوح ضوئيا إلى نص، PDF قابل للبحث، استخراج نص من PDF، OCR PDF مجاني',
    },
    fr: {
      title: 'OCR PDF en ligne gratuit - rendre un PDF numérisé recherchable | BlendPDF',
      description:
        'Rendez vos PDF numérisés recherchables grâce à la reconnaissance de texte (OCR), gratuitement et en ligne. Français, anglais, espagnol et arabe : le texte des pages numérisées devient sélectionnable et copiable. Sans inscription.',
      keywords:
        'ocr pdf, ocr pdf gratuit, pdf recherchable, pdf numérisé en texte, reconnaissance de texte pdf, ocr français, ocr arabe',
    },
    es: {
      title: 'OCR PDF online gratis: reconocer el texto de un PDF escaneado | BlendPDF',
      description:
        'Con OCR, el texto de un PDF escaneado se puede buscar y copiar. OCR de primer nivel en árabe, y también en español, inglés y francés. Gratis y sin registrarse.',
      keywords:
        'ocr pdf, ocr pdf online gratis, pdf escaneado a texto, reconocimiento de texto pdf, hacer un pdf buscable, pdf con texto seleccionable, ocr árabe pdf, ocr en árabe',
    },
  };

  const meta = metadataByLocale[locale as keyof typeof metadataByLocale] || metadataByLocale.en;
  const canonicalUrl = `${baseUrl}${locale === 'en' ? '' : `/${locale}`}/ocr-pdf`;

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
      languages: languageAlternates(baseUrl, '/ocr-pdf'),
    },
  };
}

export default function OcrPdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageMessages namespace="ocrPdf">{children}</PageMessages>;
}
