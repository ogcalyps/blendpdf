import type { Metadata } from 'next';
import { Clock } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { plainText } from '@/components/guides/RichText';
import { GUIDES, guideChrome, guideContent, guideShot } from '@/lib/guides';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const chrome = guideChrome(locale);
  const url = localizedUrl(BASE_URL, locale, '/guides');
  return {
    title: chrome.hubMetaTitle,
    description: chrome.hubDescription,
    openGraph: { title: chrome.hubMetaTitle, description: chrome.hubDescription, url, siteName: 'BlendPDF', locale: ogLocale(locale), type: 'website' },
    ...longFormSeo(BASE_URL, locale, '/guides'),
  };
}

export default async function GuidesPage({ params }: Params) {
  const { locale } = await params;
  const chrome = guideChrome(locale);
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: chrome.hubTitle,
    itemListElement: GUIDES.map((g, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: localizedUrl(BASE_URL, locale, `/guides/${g.slug}`),
      name: guideContent(locale, g.slug).title,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: chrome.guides, url: localizedUrl('', locale, '/guides') },
        ]}
      />
      <Navigation />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{chrome.hubTitle}</h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-gray-600">{chrome.hubIntro}</p>

          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {GUIDES.map((g, i) => {
              const guide = guideContent(locale, g.slug);
              const shot = guideShot(locale, g.slug, g.cover);
              return (
                <li key={g.slug}>
                  <Link
                    href={`/guides/${g.slug}`}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {shot && (
                      <div className="aspect-[16/9] overflow-hidden border-b border-gray-100 bg-gray-50">
                        {/* eslint-disable-next-line @next/next/no-img-element -- already sized WebP */}
                        <img
                          src={shot.src}
                          width={shot.width}
                          height={shot.height}
                          alt=""
                          loading={i < 2 ? 'eager' : 'lazy'}
                          decoding="async"
                          className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.02]"
                        />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <h2 className="text-lg font-bold text-gray-900 group-hover:text-primary">{guide.title}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-600">{plainText(guide.summary)}</p>
                      <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-gray-500">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {chrome.minutes(g.minutes)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
