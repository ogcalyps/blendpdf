import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/crop-pdf/faq`;

  return {
    title: 'Crop PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about cropping PDF pages online. Learn how cropping works, whether it removes content, and how files stay private in your browser.',
    openGraph: {
      title: 'Crop PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about cropping PDF pages online. Learn how cropping works, whether it removes content, and how files stay private in your browser.',
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

export default function CropPdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
