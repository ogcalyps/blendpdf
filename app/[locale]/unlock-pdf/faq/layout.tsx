import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/unlock-pdf/faq`;

  return {
    title: 'Unlock PDF FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about unlocking PDF files online. Removing restrictions, open passwords, legality, security, and troubleshooting.',
    openGraph: {
      title: 'Unlock PDF FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about unlocking PDF files online. Removing restrictions, open passwords, legality, security, and troubleshooting.',
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

export default function UnlockPdfFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
