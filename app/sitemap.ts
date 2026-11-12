import { MetadataRoute } from 'next';
import { CONTENT_UPDATED } from '@/lib/content-updated';
import { locales } from '@/i18n';
import { LONG_FORM_LOCALES, localizedUrl } from '@/lib/i18n/seo';
import { GUIDES } from '@/lib/guides';
import { PORTALS, SIZE_TARGETS } from '@/lib/size-limits/targets';
import { COMPARE_PATH, COMPARISONS } from '@/lib/comparisons';
import { UPLOAD_LIMITS_PATH } from '@/lib/upload-limits';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com').replace(/\/$/, '');

  // Helper for pages translated into every locale — one entry per locale, each with hreflang alternates.
  const translated = (
    path: string,
    opts: { changeFrequency: 'daily' | 'weekly' | 'monthly'; priority: number },
    pageLocales: readonly string[] = locales
  ): MetadataRoute.Sitemap => {
    const languages = Object.fromEntries(pageLocales.map((l) => [l, localizedUrl(baseUrl, l, path)]));
    return pageLocales.map((l) => ({ url: languages[l], lastModified: CONTENT_UPDATED, alternates: { languages }, ...opts }));
  };

  // Tool pages exist and are translated in every locale.
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
    'edit-pdf',
    'pdf-to-pdfa',
  ];
  const toolPages = tools.flatMap((tool) =>
    translated(`/${tool}`, { changeFrequency: 'monthly', priority: 0.8 })
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

  // BlendPDF vs X, tested and written in each long-form locale, and the hub that lists them
  const comparisonPages: MetadataRoute.Sitemap = [COMPARE_PATH, ...COMPARISONS.map((c) => c.path)].flatMap((path) =>
    translated(path, { changeFrequency: 'monthly', priority: 0.7 }, LONG_FORM_LOCALES)
  );

  // Forms library is English-only content (US forms): EN URLs only.
  const formSlugs = ['w9', 'nda', 'i9', 'lease-agreement', 'patient-intake'];
  // Bilingual (English/Arabic) templates carry real Arabic content: en and ar only.
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
      translated(`/forms/${slug}`, { changeFrequency: 'monthly', priority: 0.7 }, ['en', 'ar'])
    ),
  ];

  // Step-by-step guides: written in each long-form locale, each with its own screenshots.
  const guidePages: MetadataRoute.Sitemap = [
    ...translated('/guides', { changeFrequency: 'monthly', priority: 0.7 }, LONG_FORM_LOCALES),
    ...GUIDES.flatMap((g) => translated(`/guides/${g.slug}`, { changeFrequency: 'monthly', priority: 0.7 }, LONG_FORM_LOCALES)),
  ];

  // The upload limits reference: every portal's limit with its source, in each long-form locale.
  const uploadLimitPages = translated(UPLOAD_LIMITS_PATH, { changeFrequency: 'monthly', priority: 0.7 }, LONG_FORM_LOCALES);

  // Compress to a size (/compress-pdf/to-1mb): the compress tool with the limit already set.
  const sizePages: MetadataRoute.Sitemap = [
    ...SIZE_TARGETS.flatMap((t) => translated(`/compress-pdf/${t.slug}`, { changeFrequency: 'monthly', priority: 0.7 }, LONG_FORM_LOCALES)),
    // One site's limit (/compress-pdf/for-ants), only in the languages its users search in
    ...PORTALS.flatMap((p) => translated(`/compress-pdf/${p.slug}`, { changeFrequency: 'monthly', priority: 0.7 }, p.locales)),
  ];

  return [
    ...translated('', { changeFrequency: 'weekly', priority: 1 }),
    ...toolPages,
    ...guidePages,
    ...sizePages,
    ...uploadLimitPages,
    // A copy of an ID, watermarked with who it's for
    ...translated('/watermark-pdf/id-copy', { changeFrequency: 'monthly', priority: 0.7 }, LONG_FORM_LOCALES),
    ...fillFormPage,
    ...faqPages,
    ...comparisonPages,
    ...formsPages,
    ...translated('/privacy', { changeFrequency: 'monthly', priority: 0.5 }),
    ...translated('/terms', { changeFrequency: 'monthly', priority: 0.5 }),
  ];
}
