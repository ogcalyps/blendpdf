import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = 'https://blendpdf.com';
  const enUrl = `${baseUrl}/delete-pages/faq`;

  return {
    title: 'Delete PDF Pages FAQ - Frequently Asked Questions | BlendPDF',
    description: 'Frequently asked questions about deleting PDF pages online. Learn how to remove pages, visual selection, and RTL language support.',
    openGraph: {
      title: 'Delete PDF Pages FAQ - Frequently Asked Questions | BlendPDF',
      description: 'Frequently asked questions about deleting PDF pages online. Learn how to remove pages, visual selection, and RTL language support.',
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

export default function DeletePagesFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
