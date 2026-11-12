import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { RichText } from '@/components/guides/RichText';
import { IdCopyWorkspace } from '@/components/id-copy/IdCopyWorkspace';
import { ToolFAQ } from '../../components/ToolFAQ';
import { idCopyContent } from '@/lib/id-copy';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';
const PATH = '/watermark-pdf/id-copy';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const text = idCopyContent(locale);
  const url = localizedUrl(BASE_URL, locale, PATH);
  return {
    title: text.metaTitle,
    description: text.description,
    keywords: null,
    openGraph: {
      title: text.metaTitle,
      description: text.description,
      url,
      siteName: 'BlendPDF',
      locale: ogLocale(locale),
      type: 'website',
      images: [{ url: `${BASE_URL}/og-image.jpg` }],
    },
    twitter: { card: 'summary_large_image', title: text.metaTitle, description: text.description, images: [`${BASE_URL}/twitter-image.jpg`] },
    ...longFormSeo(BASE_URL, locale, PATH),
  };
}

export default async function IdCopyPage({ params }: Params) {
  const { locale } = await params;
  const text = idCopyContent(locale);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema
        items={[
          { name: text.home, url: localizedUrl('', locale, '') || '/' },
          { name: text.watermark, url: localizedUrl('', locale, '/watermark-pdf') },
          { name: text.title, url: localizedUrl('', locale, PATH) },
        ]}
      />
      <Navigation />

      <section className="px-4 pt-12 pb-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{text.title}</h1>
          <p className="mt-4 text-lg text-gray-600">{text.intro}</p>
        </div>
        {/* The answer first */}
        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-base leading-relaxed text-gray-800">
          <RichText text={text.summary} />
        </div>
      </section>

      <IdCopyWorkspace
        whoLabel={text.whoLabel}
        whoPlaceholder={text.whoPlaceholder}
        whatLabel={text.whatLabel}
        whatPlaceholder={text.whatPlaceholder}
        preview={text.preview}
      />

      <section className="px-4 pt-8">
        <div className="mx-auto max-w-3xl text-sm text-gray-600">
          {text.photos.text}{' '}
          <Link href="/images-to-pdf" className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-coral">
            {text.photos.link}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <ToolFAQ questions={text.faq} />

      <Footer />
    </div>
  );
}
