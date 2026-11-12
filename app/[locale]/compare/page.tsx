import type { Metadata } from 'next';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Correction, CtaButton } from '@/components/compare/ComparisonPage';
import { COMPARE_PATH, COMPARISONS, comparisonChrome, comparisonText } from '@/lib/comparisons';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const { hub } = comparisonChrome(locale);
  const url = localizedUrl(BASE_URL, locale, COMPARE_PATH);
  return {
    title: hub.metaTitle,
    description: hub.description,
    keywords: null,
    openGraph: { title: hub.metaTitle, description: hub.description, url, siteName: 'BlendPDF', locale: ogLocale(locale), type: 'website', images: [{ url: `${BASE_URL}/og-image.jpg` }] },
    ...longFormSeo(BASE_URL, locale, COMPARE_PATH),
  };
}

export default async function ComparePage({ params }: Params) {
  const { locale } = await params;
  const chrome = comparisonChrome(locale);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: chrome.hub.title, url: localizedUrl('', locale, COMPARE_PATH) },
        ]}
      />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{chrome.hub.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-700">{chrome.hub.intro}</p>

          <ul className="mt-10 space-y-4">
            {COMPARISONS.map((page) => {
              const text = comparisonText(page, locale);
              return (
                <li key={page.slug} className="rounded-2xl border border-gray-200 p-5">
                  <h2 className="text-xl font-bold text-gray-900">{text.breadcrumb}</h2>
                  <p className="mt-2 text-base leading-relaxed text-gray-700">{text.card}</p>
                  <div className="mt-4">
                    <CtaButton href={page.path} label={chrome.hub.cta} />
                  </div>
                </li>
              );
            })}
          </ul>
          <Correction locale={locale} />
        </div>
      </main>

      <Footer />
    </div>
  );
}
