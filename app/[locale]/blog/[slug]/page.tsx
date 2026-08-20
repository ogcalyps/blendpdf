import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { getStrapiArticleBySlug, getAllStrapiArticleSlugs } from '@/lib/strapi';
import type { StrapiLocale } from '@/lib/strapi';
import { Calendar, Clock } from 'lucide-react';

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Pre-generate paths for known blog slugs (improves SEO, enables static generation when Strapi is available at build time) */
export async function generateStaticParams() {
  try {
    const slugs = await getAllStrapiArticleSlugs();
    return slugs.map(({ locale, slug }) => ({ locale, slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const safeLocale = (locale === 'ar' ? 'ar' : 'en') as StrapiLocale;
  const post = await getStrapiArticleBySlug(safeLocale, slug);
  if (!post) return { title: 'Post not found' };

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  const path = locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
  const canonical = `${baseUrl}${path}`;
  const alternateEn = `${baseUrl}/blog/${slug}`;
  const alternateAr = `${baseUrl}/ar/blog/${slug}`;

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt,
    alternates: {
      canonical,
      languages: {
        en: alternateEn,
        ar: alternateAr,
        'x-default': alternateEn,
      },
    },
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      url: canonical,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'article',
      publishedTime: new Date(post.publishedAt).toISOString(),
      images: post.featuredImageUrl ? [{ url: post.featuredImageUrl }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt,
      images: post.featuredImageUrl ? [post.featuredImageUrl] : undefined,
    },
  };
}

function ArticleJsonLd({
  post,
  locale,
  canonical,
}: {
  post: { title: string; excerpt: string; featuredImageUrl?: string; publishedAt: number; updatedAt?: number; metaDescription?: string };
  locale: string;
  canonical: string;
}) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription || post.excerpt,
    image: post.featuredImageUrl ? [post.featuredImageUrl] : undefined,
    datePublished: new Date(post.publishedAt).toISOString(),
    dateModified: new Date(post.updatedAt || post.publishedAt).toISOString(),
    author: { '@type': 'Organization', name: 'BlendPDF', url: process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com' },
    publisher: {
      '@type': 'Organization',
      name: 'BlendPDF',
      logo: { '@type': 'ImageObject', url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com'}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    inLanguage: locale === 'ar' ? 'ar' : 'en',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const safeLocale = (locale === 'ar' ? 'ar' : 'en') as StrapiLocale;

  const post = await getStrapiArticleBySlug(safeLocale, slug);
  if (!post) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  const path = locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`;
  const canonical = `${baseUrl}${path}`;
  const blogPath = locale === 'en' ? '/blog' : `/${locale}/blog`;

  return (
    <div className="flex min-h-screen flex-col">
      <ArticleJsonLd post={post} locale={locale} canonical={canonical} />
      <Navigation />
      <main className="flex-1 py-12 px-4">
        <article className="max-w-3xl mx-auto">
          <nav className="mb-6" aria-label={t('breadcrumb')}>
            <ol className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <li>
                <Link href="/" className="text-primary hover:underline">
                  {t('backToHome')}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href={blogPath} className="text-primary hover:underline">
                  {t('title')}
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-dark font-medium" aria-current="page">
                {post.title}
              </li>
            </ol>
          </nav>

          <header className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-dark mb-4">{post.title}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(post.publishedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              {post.readingTime != null && (
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {post.readingTime} {t('minRead')}
                </span>
              )}
            </div>
          </header>

          {post.featuredImageUrl && (
            <div className="aspect-video rounded-xl overflow-hidden mb-8 bg-gray-100">
              <img
                src={post.featuredImageUrl}
                alt={post.featuredImageAlt || post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div
            className="prose prose-lg max-w-none prose-headings:text-dark prose-a:text-primary prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
