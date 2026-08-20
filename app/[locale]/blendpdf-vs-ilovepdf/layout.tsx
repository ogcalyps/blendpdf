import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/blendpdf-vs-ilovepdf`;

  return {
    title: 'BlendPDF vs iLovePDF: Free Alternative, No Sign-Up Needed',
    description:
      'Looking for an iLovePDF free alternative with no sign-up? An honest comparison of free limits, watermarks, accounts, file sizes, and Arabic/RTL support.',
    openGraph: {
      title: 'BlendPDF vs iLovePDF: Free Alternative, No Sign-Up Needed',
      description:
        'Looking for an iLovePDF free alternative with no sign-up? An honest comparison of free limits, watermarks, accounts, file sizes, and Arabic/RTL support.',
      url: enUrl,
      siteName: 'BlendPDF',
      type: 'website',
      images: [{ url: `${baseUrl}/og-image.jpg` }],
    },
    alternates: {
      // Comparison content is long-form English-only: self-canonical on EN,
      // and the /ar variant canonicalizes here and stays unindexed.
      canonical: enUrl,
    },
    robots: locale === 'en' ? undefined : { index: false, follow: true },
  };
}

export default function BlendPDFVsILovePDFLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
