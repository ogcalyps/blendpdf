import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/flatten-pdf/faq`;

  return {
    title: 'Flatten PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about flattening PDF forms online. Learn how form fields are made non-editable, which fields flatten, and in-browser privacy.',
    openGraph: {
      title: 'Flatten PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about flattening PDF forms online. Learn how form fields are made non-editable, which fields flatten, and in-browser privacy.',
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

export default function FlattenPdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
