import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/word-to-pdf/faq`;

  return {
    title: 'Word to PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about converting Word documents to PDF online. Learn about supported formats, fonts, layout fidelity, limits, and privacy.',
    openGraph: {
      title: 'Word to PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about converting Word documents to PDF online. Learn about supported formats, fonts, layout fidelity, limits, and privacy.',
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

export default function WordToPdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
