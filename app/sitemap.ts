import { MetadataRoute } from 'next';
import { getAllStrapiArticleSlugs } from '@/lib/strapi';

// Bump this whenever site-wide content meaningfully changes (major copy,
// tool behavior, or structural updates). A frozen-in-the-past or
// build-timestamp value teaches Google to distrust lastmod.
const CONTENT_UPDATED = new Date('2026-08-13');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com').replace(/\/$/, '');

  // Helper for pages that exist in both locales — emits hreflang alternates.
  const bilingual = (
    path: string,
    opts: { changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number }
  ): MetadataRoute.Sitemap => {
    const en = path === '' ? baseUrl : `${baseUrl}${path}`;
    const ar = `${baseUrl}/ar${path}`;
    const alternates = { languages: { en, ar } };
    return [
      { url: en, lastModified: CONTENT_UPDATED, alternates, ...opts },
      { url: ar, lastModified: CONTENT_UPDATED, alternates, ...opts },
    ];
  };

  // Blog post URLs (from Strapi) with their real update dates.
  let blogPostEntries: MetadataRoute.Sitemap = [];
  try {
    const slugs = await getAllStrapiArticleSlugs();
    blogPostEntries = slugs.map(({ locale, slug, updatedAt }) => ({
      url: locale === 'en' ? `${baseUrl}/blog/${slug}` : `${baseUrl}/ar/blog/${slug}`,
      lastModified: updatedAt ? new Date(updatedAt) : CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    // Don't silently ship a sitemap without blog URLs — make it visible in logs.
    console.warn('[sitemap] Strapi unavailable, blog URLs omitted:', error instanceof Error ? error.message : error);
  }

  // Tool pages exist and are translated in both locales.
  const tools = [
    'merge-pdf',
    'compress-pdf',
    'split-pdf',
    'rotate-pdf',
    'reorder-pdf',
    'delete-pages',
    'images-to-pdf',
    'pdf-to-images',
    'pdf-to-word',
    'pdf-to-excel',
    'word-to-pdf',
    'repair-pdf',
    'protect-pdf',
    'unlock-pdf',
    'add-page-numbers',
    'watermark-pdf',
    'sign-pdf',
    'powerpoint-to-pdf',
    'excel-to-pdf',
    'pdf-to-text',
    'extract-pages',
    'extract-images',
    'crop-pdf',
    'flatten-pdf',
    'remove-metadata',
    'ocr-pdf',
  ];
  const toolPages = tools.flatMap((tool) =>
    bilingual(`/${tool}`, { changeFrequency: 'monthly', priority: 0.8 })
  );

  // Batch fill is currently English-only UI: EN URL only (ar canonicalizes to EN).
  const fillFormPage: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/fill-form`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
  ];

  // FAQ pages are long-form English-only content: list EN URLs only.
  // (The /ar variants canonicalize to EN and are deliberately excluded.)
  const faqTools = [
    'merge-pdf',
    'compress-pdf',
    'split-pdf',
    'rotate-pdf',
    'reorder-pdf',
    'delete-pages',
    'images-to-pdf',
    'pdf-to-images',
    'pdf-to-word',
    'pdf-to-excel',
    'word-to-pdf',
    'repair-pdf',
    'protect-pdf',
    'unlock-pdf',
    'add-page-numbers',
    'watermark-pdf',
    'sign-pdf',
    'powerpoint-to-pdf',
    'excel-to-pdf',
    'pdf-to-text',
    'remove-metadata',
    'flatten-pdf',
    'extract-pages',
    'extract-images',
    'crop-pdf',
    'ocr-pdf',
  ];
  const faqPages = faqTools.map((tool) => ({
    url: `${baseUrl}/${tool}/faq`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Comparison pages (English-only content): EN URLs only.
  const comparisonPages: MetadataRoute.Sitemap = ['blendpdf-vs-ilovepdf', 'blendpdf-vs-smallpdf'].map((slug) => ({
    url: `${baseUrl}/${slug}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  // Forms library is English-only content (US forms): EN URLs only.
  const formSlugs = ['w9', 'nda', 'i9', 'lease-agreement', 'patient-intake'];
  // Bilingual (English/Arabic) templates carry real Arabic content: both locales.
  const bilingualFormSlugs = ['bilingual-nda', 'bilingual-employment-contract', 'bilingual-lease-agreement'];
  const formsPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/forms`, lastModified: CONTENT_UPDATED, changeFrequency: 'monthly', priority: 0.8 },
    ...formSlugs.map((slug) => ({
      url: `${baseUrl}/forms/${slug}`,
      lastModified: CONTENT_UPDATED,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    ...bilingualFormSlugs.flatMap((slug) =>
      bilingual(`/forms/${slug}`, { changeFrequency: 'monthly', priority: 0.7 })
    ),
  ];

  return [
    ...bilingual('', { changeFrequency: 'weekly', priority: 1 }),
    ...bilingual('/blog', { changeFrequency: 'weekly', priority: 0.9 }),
    ...blogPostEntries,
    ...toolPages,
    ...fillFormPage,
    ...faqPages,
    ...comparisonPages,
    ...formsPages,
    ...bilingual('/privacy', { changeFrequency: 'monthly', priority: 0.5 }),
    ...bilingual('/terms', { changeFrequency: 'monthly', priority: 0.5 }),
  ];
}
