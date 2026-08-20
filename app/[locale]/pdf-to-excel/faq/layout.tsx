import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/pdf-to-excel/faq`;

  return {
    title: 'PDF to Excel FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about converting PDF tables to Excel online. Learn how table extraction works, its limits, accuracy, privacy, and fixes.',
    openGraph: {
      title: 'PDF to Excel FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about converting PDF tables to Excel online. Learn how table extraction works, its limits, accuracy, privacy, and fixes.',
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

export default function PdfToExcelFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
