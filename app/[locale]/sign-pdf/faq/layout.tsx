import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/sign-pdf/faq`;

  return {
    title: 'Sign PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about signing PDF files online. Typed and image signatures, legality of visual signatures, privacy, and limits.',
    openGraph: {
      title: 'Sign PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about signing PDF files online. Typed and image signatures, legality of visual signatures, privacy, and limits.',
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

export default function SignPdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
