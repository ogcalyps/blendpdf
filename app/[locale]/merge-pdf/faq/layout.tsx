import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/merge-pdf/faq`;

  return {
    title: 'Merge PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about merging PDF files online. Learn how to combine PDFs, safety, privacy, and RTL language support.',
    openGraph: {
      title: 'Merge PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about merging PDF files online. Learn how to combine PDFs, safety, privacy, and RTL language support.',
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

export default function MergePdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
