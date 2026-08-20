import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/repair-pdf/faq`;

  return {
    title: 'Repair PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about repairing corrupted PDF files online. What can be recovered, what cannot, file limits, privacy, and troubleshooting.',
    openGraph: {
      title: 'Repair PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about repairing corrupted PDF files online. What can be recovered, what cannot, file limits, privacy, and troubleshooting.',
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

export default function RepairPdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
