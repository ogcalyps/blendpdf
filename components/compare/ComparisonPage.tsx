import type { Metadata } from 'next';
import { ArrowRight, Download, FlaskConical } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { RichText } from '@/components/guides/RichText';
import { ToolFAQ } from '@/app/[locale]/components/ToolFAQ';
import { comparison, comparisonChrome, comparisonText } from '@/lib/comparisons';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';
const TEST_PAGE = '/compare/arabic-test-page.pdf';
const CONTACT = 'contact@blendpdf.com';

export function comparisonMetadata(slug: string, locale: string): Metadata {
  const page = comparison(slug);
  const text = comparisonText(page, locale);
  const url = localizedUrl(BASE_URL, locale, page.path);
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
      type: 'article',
      images: [{ url: `${BASE_URL}/og-image.jpg` }],
    },
    twitter: { card: 'summary_large_image', title: text.metaTitle, description: text.description, images: [`${BASE_URL}/twitter-image.jpg`] },
    ...longFormSeo(BASE_URL, locale, page.path),
  };
}

export function CtaButton({ href = '/edit-pdf', label }: { href?: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {label}
      <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
    </Link>
  );
}

/** How to report something out of date: a dated comparison has to be kept true. */
export function Correction({ locale }: { locale: string }) {
  const { correction } = comparisonChrome(locale);
  return (
    <p className="mt-3 text-sm leading-relaxed text-gray-500">
      {correction.before}
      <a href={`mailto:${CONTACT}`} dir="ltr" className="font-medium text-primary hover:text-primary-coral">
        {CONTACT}
      </a>
      {correction.after}
    </p>
  );
}

/** "www.ilovepdf.com/edit-pdf" for https://www.ilovepdf.com/edit-pdf: what the source line shows. */
const shortUrl = (url: string) => {
  const { host, pathname } = new URL(url);
  return `${host.replace(/^www\./, '')}${pathname === '/' ? '' : pathname}`;
};

export function ComparisonPage({ slug, locale }: { slug: string; locale: string }) {
  const page = comparison(slug);
  const text = comparisonText(page, locale);
  const chrome = comparisonChrome(locale);
  const howTo = chrome.howTo[page.howTo];
  const shots = page.shots.filter((shot) => text.evidence?.shots[shot.key]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: text.breadcrumb, url: localizedUrl('', locale, page.path) },
        ]}
      />
      <Navigation />

      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{text.title}</h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-gray-500">
            <FlaskConical className="h-4 w-4" aria-hidden="true" />
            {text.tested}
          </p>

          {/* The answer first */}
          <div className="mt-6 rounded-2xl border border-orange-100 bg-orange-50/60 p-5 text-lg leading-relaxed text-gray-800">
            <RichText text={text.summary} />
          </div>

          <div className="mt-6">
            <CtaButton label={text.cta} />
          </div>

          {text.evidence && shots.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-gray-900">{text.evidence.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-700">{text.evidence.intro}</p>
              <div className="mt-6 space-y-6">
                {shots.map((shot) => {
                  const words = text.evidence!.shots[shot.key]!;
                  return (
                    <figure key={shot.key}>
                      <figcaption className="mb-2 text-sm text-gray-700">
                        <span className="me-2 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-900">
                          {words.label}
                        </span>
                        {words.caption}
                      </figcaption>
                      {/* Opens the whole render, which phones may show only part of */}
                      <a href={shot.src} className="block">
                        <picture>
                          {shot.phone && (
                            <source media="(max-width: 639px)" srcSet={shot.phone.src} width={shot.phone.width} height={shot.phone.height} />
                          )}
                          {/* eslint-disable-next-line @next/next/no-img-element -- already sized WebP, no optimizer needed */}
                          <img
                            src={shot.src}
                            width={shot.width}
                            height={shot.height}
                            alt={words.alt}
                            loading="lazy"
                            decoding="async"
                            // A phone crop's left side is a cut, not the edge of the page
                            className={`h-auto w-full border border-gray-300 bg-white ${shot.phone ? 'border-l-0 sm:border-l' : ''}`}
                          />
                        </picture>
                      </a>
                    </figure>
                  );
                })}
              </div>
            </section>
          )}

          {text.quotes && page.quotes.length > 0 && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-gray-900">{text.quotes.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-700">{text.quotes.intro}</p>
              <ul className="mt-4 space-y-3">
                {page.quotes.map((quote, i) => (
                  <li key={quote.text}>
                    {/* Their words exactly, in their language; words from an editor's UI in monospace */}
                    <blockquote
                      lang={quote.lang}
                      dir={quote.lang === 'ar' ? 'rtl' : 'ltr'}
                      cite={quote.source}
                      className={`rounded-lg border-s-4 border-gray-400 bg-gray-50 px-4 py-3 text-sm text-gray-800 ${quote.source ? '' : 'font-mono'}`}
                    >
                      {quote.text}
                    </blockquote>
                    {text.quotes!.glosses?.[i] && <p className="mt-1 ps-5 text-sm text-gray-600">{text.quotes!.glosses[i]}</p>}
                    {quote.source && (
                      <p className="mt-1 ps-5 text-xs text-gray-500">
                        {chrome.source.before}
                        <a href={quote.source} dir="ltr" rel="nofollow noopener noreferrer" target="_blank" className="underline hover:text-gray-700">
                          {shortUrl(quote.source)}
                        </a>
                        {chrome.source.after}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {text.quotes.after && (
                <p className="mt-4 text-base leading-relaxed text-gray-700">
                  <RichText text={text.quotes.after} />
                </p>
              )}
            </section>
          )}

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-gray-900">{text.table.title}</h2>
            {/* Phones: one card per row, so the other service's column isn't off-screen */}
            <div className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 sm:hidden">
              {text.table.rows.map((row) => (
                <div key={row.label} className="p-4 text-sm">
                  <p className="font-semibold text-gray-900">{row.label}</p>
                  <dl className="mt-2 space-y-2 text-gray-700">
                    <div>
                      <dt className="font-medium text-gray-900">{text.table.head[1]}</dt>
                      <dd>{row.blendpdf}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-gray-900">{text.table.head[2]}</dt>
                      <dd>{row.them}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-gray-200 sm:block">
              <table className="w-full text-start text-sm">
                <thead className="bg-gray-50 text-gray-900">
                  <tr>
                    {text.table.head.map((cell) => (
                      <th key={cell} scope="col" className="px-4 py-3 text-start font-semibold">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-gray-700">
                  {text.table.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row" className="px-4 py-3 text-start font-medium text-gray-900">
                        {row.label}
                      </th>
                      <td className="px-4 py-3">{row.blendpdf}</td>
                      <td className="px-4 py-3">{row.them}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">{text.table.note}</p>
          </section>

          {page.checkable !== false && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-gray-900">{chrome.method.title}</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-700">{chrome.method.intro}</p>
              <ol className="mt-4 list-decimal space-y-2 ps-5 text-base leading-relaxed text-gray-700">
                {chrome.method.steps[page.howTo].map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {/* The same page we tested, with made-up details, so anyone can repeat the test */}
              <a
                href={TEST_PAGE}
                download
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {chrome.method.download}
              </a>
            </section>
          )}

          {text.strengths && (
            <section className="mt-14">
              <h2 className="text-2xl font-bold text-gray-900">{text.strengths.title}</h2>
              <ul className="mt-4 list-disc space-y-2 ps-5 text-base leading-relaxed text-gray-700">
                {text.strengths.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-14">
            <h2 className="text-2xl font-bold text-gray-900">{howTo.title}</h2>
            <ol className="mt-4 space-y-3">
              {howTo.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-base leading-relaxed text-gray-700">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">
                    <RichText text={step} />
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-6">
              <CtaButton label={text.cta} />
            </div>
          </section>

          <section className="mt-14 rounded-2xl bg-gray-50 p-6">
            <h2 className="text-xl font-bold text-gray-900">{chrome.limits.title}</h2>
            <p className="mt-2 text-base text-gray-700">
              <RichText text={chrome.limits.intro} />
            </p>
            <dl className="mt-4 space-y-4">
              {chrome.limits.items.map((item) => (
                <div key={item.title}>
                  <dt className="font-semibold text-gray-900">{item.title}</dt>
                  <dd className="mt-1 text-gray-700">
                    <RichText text={item.text} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </article>

        <ToolFAQ questions={text.faq} />

        <div className="mx-auto max-w-3xl px-4 pb-14 sm:px-6">
          <p className="text-sm leading-relaxed text-gray-500">{text.disclaimer}</p>
          <Correction locale={locale} />
          <nav aria-label={chrome.more.title} className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{chrome.more.title}</h2>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {chrome.more.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="font-medium text-primary hover:text-primary-coral">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>

      <Footer />
    </div>
  );
}
