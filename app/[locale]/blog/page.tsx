import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { getStrapiArticles } from '@/lib/strapi';
import type { StrapiLocale } from '@/lib/strapi';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com';
  const path = locale === 'en' ? '/blog' : `/${locale}/blog`;
  const canonical = `${baseUrl}${path}`;

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: {
      canonical,
      languages: {
        en: `${baseUrl}/blog`,
        ar: `${baseUrl}/ar/blog`,
        'x-default': `${baseUrl}/blog`,
      },
    },
    openGraph: {
      title: t('meta.title'),
      description: t('meta.description'),
      url: canonical,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('meta.title'),
      description: t('meta.description'),
    },
  };
}

export default async function BlogIndexPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'blog' });
  const safeLocale = (locale === 'ar' ? 'ar' : 'en') as StrapiLocale;
  const page = Math.max(1, parseInt(String(pageParam), 10) || 1);

  let result: { posts: Array<{ id: string; title: string; slug: string; excerpt: string; featuredImageUrl?: string; publishedAt: number; readingTime?: number }>; hasMore: boolean; nextPage: number | null };
  try {
    result = await getStrapiArticles(safeLocale, { page, pageSize: 24 });
  } catch {
    result = { posts: [], hasMore: false, nextPage: null };
  }

  const basePath = locale === 'en' ? '/blog' : `/${locale}/blog`;

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="flex-1 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <Link href="/" className="text-primary hover:underline text-sm mb-6 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t('backToHome')}
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-dark mb-2">{t('title')}</h1>
          <p className="text-gray-600 mb-10">{t('subtitle')}</p>

          {result.posts.length === 0 ? (
            <p className="text-gray-500 py-8">{t('noPosts')}</p>
          ) : (
            <ul className="space-y-8">
              {result.posts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`${basePath}/${post.slug}`}
                    className="group block rounded-2xl border-2 border-orange-100 bg-white p-6 transition-all hover:border-primary hover:shadow-xl"
                  >
                    {post.featuredImageUrl && (
                      <div className="aspect-video rounded-xl overflow-hidden mb-4 bg-gray-100">
                        <img
                          src={post.featuredImageUrl}
                          alt={post.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-dark mb-2 group-hover:text-primary transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{post.excerpt}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(post.publishedAt).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {post.readingTime != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {post.readingTime} {t('minRead')}
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {result.hasMore && result.nextPage != null && (
            <div className="mt-10 text-center">
              <Link
                href={`${basePath}?page=${result.nextPage}`}
                className="inline-flex items-center px-6 py-3 rounded-lg bg-primary text-white font-medium hover:bg-primary-coral transition-colors"
              >
                {t('loadMore')}
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
