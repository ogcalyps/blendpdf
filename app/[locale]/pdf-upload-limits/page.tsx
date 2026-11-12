import type { Metadata } from 'next';
import { ArrowRight, Download } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { CopyCitation } from '@/components/upload-limits/CopyCitation';
import { ToolFAQ } from '../components/ToolFAQ';
import { sizeLabel } from '@/lib/size-limits/targets';
import { LAST_CHECKED, LICENSE, UPLOAD_LIMITS_PATH, compressLink, limitsByCountry, limitsLocale, uploadLimitsChrome } from '@/lib/upload-limits';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';
const CONTACT = 'contact@blendpdf.com';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const chrome = uploadLimitsChrome(locale);
  const url = localizedUrl(BASE_URL, locale, UPLOAD_LIMITS_PATH);
  return {
    title: chrome.metaTitle,
    description: chrome.description,
    keywords: null,
    openGraph: { title: chrome.metaTitle, description: chrome.description, url, siteName: 'BlendPDF', locale: ogLocale(locale), type: 'website', images: [{ url: `${BASE_URL}/og-image.jpg` }] },
    ...longFormSeo(BASE_URL, locale, UPLOAD_LIMITS_PATH),
  };
}

/** "ircc.canada.ca": what the source link shows. */
const host = (url: string) => new URL(url).host.replace(/^www\./, '');

const cell = 'block align-top sm:table-cell sm:py-4 sm:pe-4';

export default async function UploadLimitsPage({ params }: Params) {
  const { locale } = await params;
  const loc = limitsLocale(locale);
  const chrome = uploadLimitsChrome(locale);
  const groups = limitsByCountry(locale);
  const url = localizedUrl(BASE_URL, locale, UPLOAD_LIMITS_PATH);

  // Google Dataset Search reads this; the downloads are the same rows as the table.
  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: chrome.title,
    description: chrome.description,
    url,
    inLanguage: loc,
    license: LICENSE.url,
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'BlendPDF', url: BASE_URL },
    dateModified: LAST_CHECKED,
    distribution: [
      { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${BASE_URL}${UPLOAD_LIMITS_PATH}.csv` },
      { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${BASE_URL}${UPLOAD_LIMITS_PATH}.json` },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema
        items={[
          { name: chrome.home, url: localizedUrl('', locale, '') || '/' },
          { name: chrome.title, url: localizedUrl('', locale, UPLOAD_LIMITS_PATH) },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset).replace(/</g, '\\u003c') }} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{chrome.title}</h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-gray-700">{chrome.intro}</p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-500">{chrome.method}</p>

          <nav aria-label={chrome.jumpTo} className="mt-8">
            <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{chrome.jumpTo}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {groups.map((group) => (
                <li key={group.country}>
                  <a
                    href={`#country-${group.country.toLowerCase()}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-orange-100 px-4 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary"
                  >
                    {group.name}
                    <span className="text-xs text-gray-400">{group.rows.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {groups.map((group) => (
            <section key={group.country} id={`country-${group.country.toLowerCase()}`} className="mt-12 scroll-mt-24">
              <h2 className="text-2xl font-bold text-gray-900">{group.name}</h2>
              <table className="mt-4 w-full text-start text-sm">
                <thead className="hidden border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 sm:table-header-group">
                  <tr>
                    <th scope="col" className="py-2 pe-4 text-start font-semibold">{chrome.columns.portal}</th>
                    <th scope="col" className="py-2 pe-4 text-start font-semibold">{chrome.columns.what}</th>
                    <th scope="col" className="py-2 pe-4 text-start font-semibold">{chrome.columns.limit}</th>
                    <th scope="col" className="py-2 text-start font-semibold">{chrome.columns.source}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => {
                    const link = compressLink(row, locale);
                    return (
                      <tr key={row.id} id={row.id} className="block scroll-mt-24 space-y-2 border-b border-gray-100 py-5 sm:table-row sm:space-y-0 sm:py-0">
                        <td className={cell}>
                          <span className="font-semibold text-gray-900">{row.portal}</span>
                          <span className="block text-xs text-gray-500">{chrome.categories[row.category]}</span>
                        </td>
                        <td className={`${cell} leading-relaxed text-gray-700`}>{row.what[loc]}</td>
                        <td className={`${cell} sm:w-48`}>
                          <span className="text-lg font-bold text-gray-900">{sizeLabel(row.limitMb, loc)}</span>{' '}
                          <span className="text-xs text-gray-500">{chrome.per[row.per]}</span>
                          <Link href={link.href} className="mt-1 flex items-center gap-1 font-medium text-primary hover:text-primary-coral">
                            {link.label}
                            <ArrowRight className="h-4 w-4 shrink-0 rtl:rotate-180" aria-hidden />
                          </Link>
                          {link.hint && <span className="mt-1 block text-xs leading-relaxed text-gray-500">{link.hint}</span>}
                        </td>
                        <td className={`${cell} sm:pe-0`}>
                          <q cite={row.sourceUrl} dir="auto" className="block leading-relaxed text-gray-700 [quotes:none]">
                            {chrome.marks[0]}
                            {row.quote}
                            {chrome.marks[1]}
                          </q>
                          <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" dir="ltr" className="mt-1 inline-block break-all text-xs font-medium text-primary hover:text-primary-coral">
                            {host(row.sourceUrl)}
                          </a>
                          <span className="block text-xs text-gray-500">{chrome.checked(row.checked)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}

          <section className="mt-14 rounded-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900">{chrome.reuse.title}</h2>
            <p className="mt-2 text-base leading-relaxed text-gray-700">{chrome.reuse.text}</p>
            <CopyCitation text={chrome.reuse.citation} copy={chrome.reuse.copy} copied={chrome.reuse.copied} />
            <div className="mt-4 flex flex-wrap gap-3">
              {(['csv', 'json'] as const).map((format) => (
                <a
                  key={format}
                  href={`${UPLOAD_LIMITS_PATH}.${format}`}
                  download
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-coral"
                >
                  <Download className="h-4 w-4" aria-hidden />
                  {chrome.reuse[format]}
                </a>
              ))}
            </div>
          </section>

          <p className="mt-6 text-sm leading-relaxed text-gray-500">
            {chrome.report.before}
            <a href={`mailto:${CONTACT}`} dir="ltr" className="font-medium text-primary hover:text-primary-coral">
              {CONTACT}
            </a>
            {chrome.report.after}
          </p>
        </div>

        <ToolFAQ questions={chrome.faq} />
      </main>

      <Footer />
    </div>
  );
}
