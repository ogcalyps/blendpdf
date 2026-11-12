import type { Metadata } from 'next';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { POSTS, blogChrome, blogPath, blogPost } from '@/lib/blog';
import { languageAlternatesFor, localizedUrl, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const chrome = blogChrome(locale);
  // Most posts are English only, so the hub is indexed in English only.
  const url = `${BASE_URL}/blog`;
  return {
    title: chrome.hubMetaTitle,
    description: chrome.hubDescription,
    openGraph: { title: chrome.hubMetaTitle, description: chrome.hubDescription, url, siteName: 'BlendPDF', locale: ogLocale(locale), type: 'website' },
    alternates: { canonical: url, languages: languageAlternatesFor(BASE_URL, '/blog', ['en']) },
    robots: locale === 'en' ? undefined : { index: false, follow: true },
  };
}

export default async function BlogPage({ params }: Params) {
  const { locale } = await params;
  const chrome = blogChrome(locale);
  // Each post in the reader's language where it is written in it, else in English
  const posts = POSTS.map((p) => blogPost(p.slug, locale) ?? p);
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: chrome.hubTitle,
    itemListElement: posts.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: localizedUrl(BASE_URL, p.lang, blogPath(p.slug)),
      name: p.title,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: chrome.blog, url: localizedUrl('', locale, '/blog') },
        ]}
      />
      <Navigation />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{chrome.hubTitle}</h1>
          <p className="mt-3 text-lg leading-relaxed text-gray-600">{chrome.hubIntro}</p>
          {chrome.englishOnly && posts.some((p) => p.lang !== locale) && <p className="mt-2 text-sm text-gray-500">{chrome.englishOnly}</p>}

          <ul className="mt-10 space-y-6">
            {posts.map((post, i) => (
              <li key={post.slug}>
                <Link
                  href={blogPath(post.slug)}
                  className="group block overflow-hidden rounded-2xl border border-gray-200 bg-white transition-shadow hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="border-b border-gray-100 bg-white px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- already sized WebP */}
                    <img
                      src={post.cover.src}
                      width={post.cover.width}
                      height={post.cover.height}
                      alt=""
                      loading={i === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      className="h-auto w-full"
                    />
                  </div>
                  <div lang={post.lang} dir={post.lang === 'ar' ? 'rtl' : 'ltr'} className="p-5">
                    <h2 className="text-xl font-bold leading-snug text-gray-900 group-hover:text-primary">{post.title}</h2>
                    <p className="mt-2 leading-relaxed text-gray-600">{post.description}</p>
                    <p className="mt-3 text-sm text-gray-500">
                      <time dateTime={post.published}>{blogChrome(post.lang).published(post.published)}</time> ·{' '}
                      {blogChrome(post.lang).minutes(post.minutes)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
