import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/pdf-to-text/faq`;

  return {
    title: 'PDF to Text FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about extracting text from PDFs online. Learn about in-browser extraction, scanned PDFs, Arabic text, and .txt downloads.',
    openGraph: {
      title: 'PDF to Text FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about extracting text from PDFs online. Learn about in-browser extraction, scanned PDFs, Arabic text, and .txt downloads.',
      url: enUrl,
      siteName: 'BlendPDF',
      type: 'website',
      images: [{ url: `${baseUrl}/og-image.jpg` }],
    },
    alternates: {
      // FAQ content is long-form English-only: self-canonical on EN,
      // and the /ar variant canonicalizes here and stays unindexed.
      canonical: enUrl,
    },
    robots: locale === 'en' ? undefined : { index: false, follow: true },
  };
}

export default function PdfToTextFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
