import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/extract-images/faq`;

  return {
    title: 'Extract Images from PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about extracting images from a PDF online. Learn about PNG output, duplicates, limits, and how files stay private in your browser.',
    openGraph: {
      title: 'Extract Images from PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about extracting images from a PDF online. Learn about PNG output, duplicates, limits, and how files stay private in your browser.',
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

export default function ExtractImagesFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
