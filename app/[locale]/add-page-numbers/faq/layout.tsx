import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/add-page-numbers/faq`;

  return {
    title: 'Add Page Numbers FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about adding page numbers to a PDF online. Positions, number formats, starting values, limits, privacy, and troubleshooting.',
    openGraph: {
      title: 'Add Page Numbers FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about adding page numbers to a PDF online. Positions, number formats, starting values, limits, privacy, and troubleshooting.',
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

export default function AddPageNumbersFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
