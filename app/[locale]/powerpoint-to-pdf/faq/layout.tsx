import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/powerpoint-to-pdf/faq`;

  return {
    title: 'PowerPoint to PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about converting PowerPoint presentations (PPT, PPTX, ODP) to PDF online. Learn about supported formats, slide fidelity, animations, and file limits.',
    openGraph: {
      title: 'PowerPoint to PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about converting PowerPoint presentations (PPT, PPTX, ODP) to PDF online. Learn about supported formats, slide fidelity, animations, and file limits.',
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

export default function PowerPointToPdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
