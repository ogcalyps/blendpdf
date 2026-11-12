import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowRight, Clock } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { RichText, plainText } from '@/components/guides/RichText';
import { guideChrome, guideContent, guideMeta, guideShot } from '@/lib/guides';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';

// Rendered on request like the other [locale] pages (none pre-builds its params): an unknown slug is notFound() below.
// (dynamicParams = false with slug-only params 404'd every guide in production.)

type Params = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale, slug } = await params;
  const meta = guideMeta(slug);
  if (!meta) return {};
  const guide = guideContent(locale, meta.slug);
  const path = `/guides/${meta.slug}`;
  const url = localizedUrl(BASE_URL, locale, path);
  const image = guideShot(locale, meta.slug, meta.cover);
  return {
    title: guide.metaTitle,
    description: guide.description,
    openGraph: {
      title: guide.metaTitle,
      description: guide.description,
      url,
      siteName: 'BlendPDF',
      locale: ogLocale(locale),
      type: 'article',
      images: [{ url: image ? `${BASE_URL}${image.src}` : `${BASE_URL}/og-image.jpg` }],
    },
    ...longFormSeo(BASE_URL, locale, path),
  };
}

export default async function GuidePage({ params }: Params) {
  const { locale, slug } = await params;
  const meta = guideMeta(slug);
  if (!meta) notFound();
  const guide = guideContent(locale, meta.slug);
  const chrome = guideChrome(locale);
  const pageUrl = localizedUrl(BASE_URL, locale, `/guides/${meta.slug}`);

  const howTo = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.title,
    description: plainText(guide.summary),
    inLanguage: locale,
    totalTime: `PT${meta.minutes}M`,
    tool: { '@type': 'HowToTool', name: 'BlendPDF' },
    step: guide.steps.map((step, i) => {
      const shot = step.shot ? guideShot(locale, meta.slug, step.shot) : null;
      return {
        '@type': 'HowToStep',
        position: i + 1,
        name: step.title,
        text: plainText(step.text),
        url: `${pageUrl}#step-${i + 1}`,
        ...(shot ? { image: `${BASE_URL}${shot.src}` } : {}),
      };
    }),
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }} />
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: chrome.guides, url: localizedUrl('', locale, '/guides') },
          { name: guide.title, url: localizedUrl('', locale, `/guides/${meta.slug}`) },
        ]}
      />
      <Navigation />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <nav aria-label={chrome.guides} className="mb-6 text-sm text-gray-500">
            <Link href="/guides" className="hover:text-primary">
              {chrome.guides}
            </Link>
          </nav>

          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{guide.title}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" aria-hidden="true" />
            {chrome.minutes(meta.minutes)} · {chrome.updated}
          </p>

          {/* The answer first */}
          <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-lg leading-relaxed text-gray-800">
            <RichText text={guide.summary} />
          </div>

          <Link
            href={meta.tool}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {guide.cta}
            <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
          </Link>

          <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-gray-500">{chrome.steps}</h2>
          <ol className="mt-4 space-y-12">
            {guide.steps.map((step, i) => {
              const shot = step.shot ? guideShot(locale, meta.slug, step.shot) : null;
              return (
                <li key={i} id={`step-${i + 1}`} className="scroll-mt-24">
                  <h3 className="flex items-start gap-3 text-xl font-bold text-gray-900">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white" aria-hidden="true">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step.title}</span>
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-gray-700 sm:ps-11">
                    <RichText text={step.text} />
                  </p>
                  {shot && (
                    <figure className="mt-5 sm:ps-11">
                      {/* eslint-disable-next-line @next/next/no-img-element -- already sized WebP, no optimizer needed */}
                      <img
                        src={shot.src}
                        width={shot.width}
                        height={shot.height}
                        alt={step.alt ?? step.title}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="h-auto w-full rounded-xl border border-gray-200 shadow-sm"
                        // Taken at 2x: no bigger than its real size on screen
                        style={{ maxWidth: Math.round(shot.width / 2) }}
                      />
                    </figure>
                  )}
                </li>
              );
            })}
          </ol>

          <section className="mt-14 rounded-2xl bg-gray-50 p-6">
            <h2 className="text-xl font-bold text-gray-900">{chrome.goodToKnow}</h2>
            <dl className="mt-4 space-y-4">
              {guide.tips.map((tip) => (
                <div key={tip.title}>
                  <dt className="font-semibold text-gray-900">{tip.title}</dt>
                  <dd className="mt-1 leading-relaxed text-gray-700">
                    <RichText text={tip.text} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-10">
            <Link
              href={meta.tool}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {guide.cta}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          </div>

          <section className="mt-14 border-t border-gray-100 pt-8">
            <h2 className="text-lg font-bold text-gray-900">{chrome.moreGuides}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {meta.related.map((related) => (
                <li key={related}>
                  <Link
                    href={`/guides/${related}`}
                    className="block min-h-11 rounded-xl border border-gray-200 p-4 text-gray-800 transition-colors hover:border-primary hover:text-primary"
                  >
                    {guideContent(locale, related).title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </article>
      </main>

      <Footer />
    </div>
  );
}
