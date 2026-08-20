import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/blendpdf-vs-smallpdf`;

  return {
    title: 'Is Smallpdf Free? BlendPDF vs Smallpdf Honest Comparison',
    description:
      "Is Smallpdf free? An honest look at Smallpdf's free plan vs BlendPDF: daily task limits, watermarks, account requirements, file sizes, and Arabic support.",
    openGraph: {
      title: 'Is Smallpdf Free? BlendPDF vs Smallpdf Honest Comparison',
      description:
        "Is Smallpdf free? An honest look at Smallpdf's free plan vs BlendPDF: daily task limits, watermarks, account requirements, file sizes, and Arabic support.",
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

export default function BlendPDFVsSmallpdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
