/**
 * Strapi API client for blog (articles).
 * Fetches from STRAPI_URL (e.g. http://localhost:1337 in dev, https://blendpdf.com/api/cms in prod).
 */

export type StrapiLocale = 'en' | 'ar';

const STRAPI_URL = process.env.STRAPI_URL || process.env.NEXT_PUBLIC_STRAPI_URL || 'http://localhost:1337';

function getStrapiUrl(): string {
  return STRAPI_URL.replace(/\/$/, '');
}

function getStrapiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = process.env.STRAPI_API_TOKEN;
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface StrapiArticle {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  readingTime: number | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  locale: string;
  featuredImage?: {
    url: string;
    alternativeText?: string;
    formats?: Record<string, { url: string }>;
  } | null;
}

export interface StrapiArticleListResponse {
  data: Array<{
    id: number;
    documentId?: string;
    attributes: {
      title: string;
      slug: string;
      content?: string | null;
      excerpt: string | null;
      metaTitle: string | null;
      metaDescription: string | null;
      readingTime: number | null;
      publishedAt: string | null;
      createdAt: string;
      updatedAt: string;
      locale: string;
      featuredImage?: {
        data: {
          attributes: {
            url: string;
            alternativeText?: string;
            formats?: Record<string, { url: string }>;
          };
        } | null;
      };
    };
  }>;
  meta?: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}


function buildImageUrl(url: string): string {
  if (url.startsWith('http')) return url;
  const base = getStrapiUrl();
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

function normalizeArticleFromList(
  item: StrapiArticleListResponse['data'][0],
  includeContent = false
): {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  featuredImageUrl?: string;
  publishedAt: number;
  readingTime?: number;
  metaTitle?: string;
  metaDescription?: string;
} {
  const attrs = item.attributes as StrapiArticleListResponse['data'][0]['attributes'] & { content?: string };
  const img = attrs.featuredImage?.data?.attributes;
  const out: {
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    content?: string;
    featuredImageUrl?: string;
    featuredImageAlt?: string;
    publishedAt: number;
    updatedAt?: number;
    readingTime?: number;
    metaTitle?: string;
    metaDescription?: string;
  } = {
    id: String(item.id),
    title: attrs.title,
    slug: attrs.slug,
    excerpt: attrs.excerpt || '',
    featuredImageUrl: img ? buildImageUrl(img.url) : undefined,
    featuredImageAlt: img?.alternativeText || undefined,
    publishedAt: attrs.publishedAt ? new Date(attrs.publishedAt).getTime() : 0,
    updatedAt: attrs.updatedAt ? new Date(attrs.updatedAt).getTime() : undefined,
    readingTime: attrs.readingTime ?? undefined,
    metaTitle: attrs.metaTitle ?? undefined,
    metaDescription: attrs.metaDescription ?? undefined,
  };
  if (includeContent && 'content' in attrs) out.content = attrs.content ?? '';
  return out;
}

/**
 * Wraps fetch so an unreachable CMS degrades to "no content" instead of throwing.
 *
 * Most call sites already guard with their own try/catch, so this is largely
 * defence in depth. The exception is the blog post route, where both
 * generateMetadata and the page component call getStrapiArticleBySlug
 * unguarded — there a network error surfaced as a 500 rather than the intended
 * notFound().
 *
 * Failures are logged rather than swallowed, matching the convention in
 * app/sitemap.ts: an unreachable CMS should be visible in logs, not silent.
 */
async function strapiFetch(url: URL): Promise<Response | null> {
  try {
    return await fetch(url.toString(), {
      next: { revalidate: 3600 },
      headers: getStrapiHeaders(),
    });
  } catch (error) {
    console.warn(
      '[strapi] request failed, treating as no content:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Fetch published articles for a locale (paginated).
 * Strapi v4 REST: GET /api/articles?locale=en&publicationState=live&pagination[page]=1&pagination[pageSize]=24
 */
export async function getStrapiArticles(
  locale: StrapiLocale,
  options: { page?: number; pageSize?: number } = {}
): Promise<{
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string;
    featuredImageUrl?: string;
    publishedAt: number;
    readingTime?: number;
    metaTitle?: string;
    metaDescription?: string;
  }>;
  hasMore: boolean;
  nextPage: number | null;
}> {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 24;
  const url = new URL(`${getStrapiUrl()}/api/articles`);
  url.searchParams.set('locale', locale);
  url.searchParams.set('publicationState', 'live');
  url.searchParams.set('pagination[page]', String(page));
  url.searchParams.set('pagination[pageSize]', String(pageSize));
  url.searchParams.set('sort', 'publishedAt:desc');
  url.searchParams.set('populate', 'featuredImage');

  const res = await strapiFetch(url);
  if (!res) return { posts: [], hasMore: false, nextPage: null };
  if (!res.ok) {
    if (res.status === 404 || res.status >= 500) return { posts: [], hasMore: false, nextPage: null };
    throw new Error(`Strapi articles failed: ${res.status}`);
  }
  const json: StrapiArticleListResponse = await res.json();
  const list = Array.isArray(json.data) ? json.data : [];
  const posts = list.map((item) => normalizeArticleFromList(item, false));
  const meta = json.meta?.pagination;
  const hasMore = meta ? meta.page < meta.pageCount : false;
  const nextPage = hasMore && meta ? meta.page + 1 : null;
  return { posts, hasMore, nextPage };
}

/**
 * Fetch a single published article by slug and locale.
 * Strapi v4 REST: GET /api/articles?filters[slug][$eq]=xxx&locale=en&publicationState=live
 */
export async function getStrapiArticleBySlug(
  locale: StrapiLocale,
  slug: string
): Promise<{
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  featuredImageUrl?: string;
  featuredImageAlt?: string;
  publishedAt: number;
  updatedAt?: number;
  readingTime?: number;
  metaTitle?: string;
  metaDescription?: string;
} | null> {
  const url = new URL(`${getStrapiUrl()}/api/articles`);
  url.searchParams.set('locale', locale);
  url.searchParams.set('publicationState', 'live');
  url.searchParams.set('filters[slug][$eq]', slug);
  url.searchParams.set('populate', 'featuredImage');

  const res = await strapiFetch(url);
  if (!res) return null;
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Strapi article failed: ${res.status}`);
  }
  const json: StrapiArticleListResponse = await res.json();
  const list = Array.isArray(json.data) ? json.data : [];
  const first = list[0];
  if (!first) return null;
  const normalized = normalizeArticleFromList(first, true);
  return {
    ...normalized,
    content: normalized.content ?? '',
  };
}

/**
 * Fetch all published article slugs for all locales (for sitemap).
 */
export async function getAllStrapiArticleSlugs(): Promise<{ locale: StrapiLocale; slug: string; updatedAt?: string }[]> {
  const out: { locale: StrapiLocale; slug: string; updatedAt?: string }[] = [];
  for (const locale of ['en', 'ar'] as StrapiLocale[]) {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const url = new URL(`${getStrapiUrl()}/api/articles`);
      url.searchParams.set('locale', locale);
      url.searchParams.set('publicationState', 'live');
      url.searchParams.set('pagination[page]', String(page));
      url.searchParams.set('pagination[pageSize]', '100');
      url.searchParams.set('fields[0]', 'slug');
      url.searchParams.set('fields[1]', 'updatedAt');
      const res = await strapiFetch(url);
      if (!res || !res.ok) break;
      const json: StrapiArticleListResponse = await res.json();
      const list = Array.isArray(json.data) ? json.data : [];
      for (const item of list) {
        const slug = item.attributes?.slug;
        const updatedAt = (item.attributes as { updatedAt?: string } | undefined)?.updatedAt;
        if (slug) out.push({ locale, slug, updatedAt });
      }
      const meta = json.meta?.pagination;
      hasMore = meta ? meta.page < meta.pageCount : false;
      page += 1;
    }
  }
  return out;
}
