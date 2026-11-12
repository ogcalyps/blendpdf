import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, Languages } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Block, Inline } from '@/components/blog/Prose';
import { blogChrome, blogPath, blogPost, postLangs } from '@/lib/blog';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';

// Rendered on request like the other [locale] pages (none pre-builds its params): an unknown slug is notFound() below.

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = blogPost(slug, locale);
  if (!post) return {};
  const path = blogPath(post.slug);
  const langs = postLangs(post.slug);
  // Each language a post is written in is indexed with hreflang pairs; any other locale gets a noindex copy of the English.
  const url = localizedUrl(BASE_URL, post.lang, path);
  return {
    title: post.metaTitle,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: 'BlendPDF',
      locale: ogLocale(post.lang),
      alternateLocale: langs.filter((l) => l !== post.lang).map(ogLocale),
      type: 'article',
      publishedTime: post.published,
      ...(post.updated ? { modifiedTime: post.updated } : {}),
      images: [{ url: `${BASE_URL}${post.cover.src}`, width: post.cover.width, height: post.cover.height }],
    },
    ...longFormSeo(BASE_URL, locale, path, langs),
  };
}

export default async function BlogPostPage({ params }: Params) {
  const { locale, slug } = await params;
  const post = blogPost(slug, locale);
  if (!post) notFound();
  const chrome = blogChrome(locale);
  // Dates and minutes in the post's own language, whatever the site language
  const own = blogChrome(post.lang);
  const path = blogPath(post.slug);
  const rtl = post.lang === 'ar';
  // The same post in the other languages it is written in, linked from each written version
  const otherLangs = post.lang === locale ? postLangs(post.slug).filter((l) => l !== post.lang) : [];

  const article = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    inLanguage: post.lang,
    datePublished: post.published,
    dateModified: post.updated ?? post.published,
    image: `${BASE_URL}${post.cover.src}`,
    mainEntityOfPage: localizedUrl(BASE_URL, post.lang, path),
    author: { '@type': 'Organization', name: 'BlendPDF', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'BlendPDF', logo: { '@type': 'ImageObject', url: `${BASE_URL}/logo.png` } },
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(article) }} />
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: chrome.blog, url: localizedUrl('', locale, '/blog') },
          { name: post.title, url: localizedUrl('', locale, path) },
        ]}
      />
      <Navigation />

      <main className="flex-1">
        <article lang={post.lang} dir={rtl ? 'rtl' : 'ltr'} className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <nav aria-label={chrome.blog} className="mb-6 text-sm text-gray-500">
            <Link href="/blog" className="hover:text-primary">
              {chrome.blog}
            </Link>
          </nav>

          {post.lang !== locale && chrome.englishOnly && (
            <p lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className="mb-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
              {chrome.englishOnly}
            </p>
          )}

          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{post.title}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" aria-hidden="true" />
            <time dateTime={post.published}>{own.published(post.published)}</time> · {own.minutes(post.minutes)}
          </p>
          {otherLangs.map((l) => (
            <p key={l} className="mt-2 flex items-center gap-2 text-sm">
              <Languages className="h-4 w-4 text-gray-500" aria-hidden="true" />
              <Link href={path} locale={l} className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
                {own.readIn[l]}
              </Link>
            </p>
          ))}

          {post.lead.map((text, i) => (
            <p key={i} className={`${i === 0 ? 'mt-8 text-xl text-gray-800' : 'mt-5 text-lg text-gray-700'} leading-relaxed`}>
              <Inline text={text} lang={post.lang} />
            </p>
          ))}

          {post.body.map((block, i) => (
            <Block key={i} block={block} first={i === 0} lang={post.lang} />
          ))}
        </article>
      </main>

      <Footer />
    </div>
  );
}

