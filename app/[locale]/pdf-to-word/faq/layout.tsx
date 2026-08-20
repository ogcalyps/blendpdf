import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/pdf-to-word/faq`;

  return {
    title: 'PDF to Word FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about converting PDF to Word online. Learn about conversion accuracy, scanned PDFs, file limits, privacy, and troubleshooting.',
    openGraph: {
      title: 'PDF to Word FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about converting PDF to Word online. Learn about conversion accuracy, scanned PDFs, file limits, privacy, and troubleshooting.',
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

export default function PdfToWordFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
