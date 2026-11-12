import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { RichText } from '@/components/guides/RichText';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { ToolFAQ } from '../../components/ToolFAQ';
import {
  SIZE_TARGETS,
  portalTarget,
  portalText,
  portalsIn,
  sizeChrome,
  sizePageText,
  sizeTarget,
  type PortalTarget,
  type PortalText,
  type SizeLimit,
  type SizePageText,
} from '@/lib/size-limits';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';
import { UPLOAD_LIMITS_PATH } from '@/lib/upload-limits';

const BASE_URL = 'https://blendpdf.com';

// Rendered on request like the guides: an unknown target is notFound() below.
// (dynamicParams = false with target-only params would 404 every page in production.)

type Params = { params: Promise<{ locale: string; target: string }> };

/** A size page (/compress-pdf/to-1mb) or a site's page (/compress-pdf/for-ants, only in its languages). */
function resolve(locale: string, target: string): { slug: string; limit: SizeLimit; text: SizePageText; portal?: { target: PortalTarget; text: PortalText } } | null {
  const size = sizeTarget(target);
  if (size) return { slug: size.slug, limit: size, text: sizePageText(locale, size.slug) };
  const portal = portalTarget(target, locale);
  if (!portal) return null;
  const text = portalText(locale, portal.slug);
  return { slug: portal.slug, limit: portal, text, portal: { target: portal, text } };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, target } = await params;
  const page = resolve(locale, target);
  if (!page) return {};
  const { text } = page;
  const path = `/compress-pdf/${page.slug}`;
  const url = localizedUrl(BASE_URL, locale, path);
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
    twitter: {
      card: 'summary_large_image',
      title: text.metaTitle,
      description: text.description,
      images: [`${BASE_URL}/twitter-image.jpg`],
    },
    ...longFormSeo(BASE_URL, locale, path, page.portal?.target.locales),
  };
}

const chip =
  'inline-flex min-h-11 items-center rounded-full border-2 border-orange-100 px-4 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary';

export default async function CompressToSizePage({ params }: Params) {
  const { locale, target } = await params;
  const page = resolve(locale, target);
  if (!page) notFound();
  const { limit, text, portal } = page;
  const chrome = sizeChrome(locale);
  const sites = portalsIn(locale).filter((p) => p.slug !== page.slug);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: chrome.compress, url: localizedUrl('', locale, '/compress-pdf') },
          { name: text.title, url: localizedUrl('', locale, `/compress-pdf/${page.slug}`) },
        ]}
      />
      <Navigation />

      <section className="px-4 pt-12 pb-6">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{text.title}</h1>
          <p className="mt-4 text-lg text-gray-600">{text.whoAsks}</p>
        </div>
        {/* The answer first */}
        <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-base leading-relaxed text-gray-800">
          <RichText text={chrome.summary(limit)} />
        </div>
      </section>

      <ToolWorkspace mode="compress" planPreset={{ compress: 'medium', compressLimitMb: limit.limitMb }} />

      <section className="px-4 py-12">
        <div className="mx-auto max-w-3xl">
          {portal && (
            <div className="mb-12">
              <h2 className="text-2xl font-bold text-dark">{chrome.rulesTitle(portal.text.name)}</h2>
              <ul className="mt-4 list-disc space-y-2 ps-5 text-base leading-relaxed text-gray-700">
                {portal.text.rules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              {portal.text.link && (
                <Link href={portal.text.link.href} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-coral">
                  {portal.text.link.text}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                </Link>
              )}
              <p className="mt-4 text-sm text-gray-500">
                <a href={portal.target.sourceUrl} rel="noopener" className="underline hover:text-primary">
                  {chrome.source(portal.text.sourceName, portal.target.checked)}
                </a>
              </p>
            </div>
          )}

          <h2 className="text-2xl font-bold text-dark">{chrome.fitsTitle}</h2>
          <p className="mt-3 text-base leading-relaxed text-gray-700">{chrome.fits(limit)}</p>

          <h2 className="mt-12 text-2xl font-bold text-dark">{chrome.tooBigTitle}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {chrome.tooBig.map((tip) => (
              <li key={tip.title} className="rounded-2xl border-2 border-orange-100 p-5">
                <h3 className="font-semibold text-gray-900">{tip.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{tip.text}</p>
                {tip.link && (
                  <Link href={tip.link.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-coral">
                    {tip.link.text}
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ToolFAQ questions={chrome.faq(limit)} />

      <section className="px-4 pb-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{chrome.otherSizes}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SIZE_TARGETS.filter((t) => t.slug !== page.slug).map((t) => (
              <li key={t.slug}>
                <Link href={`/compress-pdf/${t.slug}`} className={chip}>
                  {chrome.label(t)}
                </Link>
              </li>
            ))}
          </ul>
          {sites.length > 0 && (
            <>
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-gray-500">{chrome.otherSites}</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {sites.map((site) => (
                  <li key={site.slug}>
                    <Link href={`/compress-pdf/${site.slug}`} className={chip}>
                      {portalText(locale, site.slug).short}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link
            href="/guides/compress-pdf-under-size-limit"
            className="mt-8 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-coral"
          >
            {chrome.guide}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
          <Link
            href={UPLOAD_LIMITS_PATH}
            className="mt-3 flex w-fit items-center gap-1 text-sm font-medium text-primary hover:text-primary-coral"
          >
            {chrome.allLimits}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
