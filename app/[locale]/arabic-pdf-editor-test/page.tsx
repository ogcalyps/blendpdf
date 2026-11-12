import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ArrowRight, Ban, Check, Download, FileText, X } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { CopyCitation } from '@/components/upload-limits/CopyCitation';
import { ToolFAQ } from '../components/ToolFAQ';
import {
  FILES,
  PUBLISHED,
  TESTED,
  TEST_SET_LOCALES,
  TEST_SET_PATH,
  ZIP,
  fileHref,
  fileNumber,
  resultOf,
  sizeLabel,
  tasksOf,
  testSetText,
  type TestTask,
} from '@/lib/arabic-pdf-test';
import { localizedUrl, longFormSeo, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';
const CONTACT = 'contact@blendpdf.com';

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = testSetText(locale);
  return {
    title: t.metaTitle,
    description: t.description,
    keywords: null,
    openGraph: { title: t.metaTitle, description: t.description, url: `${BASE_URL}${TEST_SET_PATH}`, siteName: 'BlendPDF', locale: ogLocale('en'), type: 'website', images: [{ url: `${BASE_URL}/og-image.jpg` }] },
    ...longFormSeo(BASE_URL, locale, TEST_SET_PATH, TEST_SET_LOCALES),
  };
}

/** Arabic inside an English sentence: its own direction, in the site's Arabic face. */
const Ar = ({ children }: { children: ReactNode }) => (
  <bdi dir="rtl" lang="ar" className="[font-family:var(--font-cairo),sans-serif]">
    {children}
  </bdi>
);

/** Text with `code` spans. */
const Code = ({ text }: { text: string }) => (
  <>
    {text.split('`').map((part, i) =>
      i % 2 ? (
        <code key={i} dir="ltr" className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.85em] text-gray-800">
          {part}
        </code>
      ) : (
        part
      ),
    )}
  </>
);

function TaskLine({ task, verbs }: { task: TestTask; verbs: { change: [string, string]; add: [string, string] } }) {
  if (task.do === 'add') {
    return (
      <>
        {verbs.add[0]} «<Ar>{task.text}</Ar>» {verbs.add[1]}
      </>
    );
  }
  return (
    <>
      {verbs.change[0]} «<Ar>{task.from}</Ar>» {verbs.change[1]} «<Ar>{task.to}</Ar>»
    </>
  );
}

export default async function ArabicPdfTestPage({ params }: Params) {
  const { locale } = await params;
  const t = testSetText(locale);

  // Google Dataset Search reads this: the zip holds the files, tasks and results
  const dataset = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: t.title,
    description: t.description,
    url: `${BASE_URL}${TEST_SET_PATH}`,
    inLanguage: ['en', 'ar'],
    license: 'https://creativecommons.org/licenses/by/4.0/',
    isAccessibleForFree: true,
    creator: { '@type': 'Organization', name: 'BlendPDF', url: BASE_URL },
    datePublished: PUBLISHED,
    dateModified: TESTED,
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/zip', contentUrl: `${BASE_URL}${ZIP.href}` }],
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema
        items={[
          { name: t.home, url: localizedUrl('', locale, '') || '/' },
          { name: t.title, url: localizedUrl('', locale, TEST_SET_PATH) },
        ]}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataset).replace(/</g, '\\u003c') }} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{t.title}</h1>
          <p className="mt-4 text-lg leading-relaxed text-gray-700">{t.intro}</p>

          <div className="mt-6">
            <a
              href={ZIP.href}
              download
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-coral"
            >
              <Download className="h-4 w-4" aria-hidden />
              {t.download.zip(sizeLabel(ZIP.bytes))}
            </a>
            <p className="mt-2 text-sm text-gray-500">{t.download.contents}</p>
          </div>

          <section className="mt-10 rounded-2xl border border-orange-100 bg-orange-50/40 p-6">
            <h2 className="text-xl font-bold text-gray-900">{t.summary.title}</h2>
            <ul className="mt-3 list-disc space-y-2 ps-5 text-base leading-relaxed text-gray-700">
              {t.summary.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-gray-500">{t.summary.tested}</p>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900">{t.run.title}</h2>
            <ol className="mt-4 list-decimal space-y-3 ps-5 text-base leading-relaxed text-gray-700">
              {t.run.steps.map((step) => (
                <li key={step}>
                  <Code text={step} />
                </li>
              ))}
            </ol>
            <pre dir="ltr" className="mt-3 overflow-x-auto rounded-xl bg-gray-900 px-4 py-3 text-sm text-gray-100">
              <code>{t.run.command}</code>
            </pre>
            <p className="mt-3 text-base leading-relaxed text-gray-700">
              <Code text={t.run.after} />
            </p>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900">{t.checks.title}</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-700">{t.checks.intro}</p>
            <dl className="mt-4 space-y-3">
              {Object.entries(t.checks.items).map(([id, item]) => (
                <div key={id}>
                  <dt className="font-semibold text-gray-900">{item.label}</dt>
                  <dd className="text-base leading-relaxed text-gray-700">{item.text}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-base leading-relaxed text-gray-700">{t.checks.notCovered}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-500">{t.checks.lamAlef}</p>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900">{t.files.title}</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-700">{t.files.intro}</p>

            <div className="mt-6 space-y-6">
              {FILES.map((file) => (
                <article key={file.file} id={`file-${fileNumber(file.file)}`} className="scroll-mt-24 rounded-2xl border border-gray-200 p-5">
                  <h3 className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-lg font-bold text-gray-900">{fileNumber(file.file)}</span>
                    <span className="break-all font-mono text-sm text-gray-600">{file.file}</span>
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {t.files.madeWith}: {file.madeWith} · {t.files.font}: {file.font}
                  </p>
                  <p className="mt-3 text-base leading-relaxed text-gray-700">{t.files.hard[fileNumber(file.file)]}</p>
                  <a href={fileHref(file.file)} download className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:text-primary-coral">
                    <FileText className="h-4 w-4" aria-hidden />
                    {t.files.open}
                  </a>

                  <ul className="mt-2 space-y-4">
                    {tasksOf(file.file).map((task) => {
                      const result = resultOf(task.id);
                      const note = t.files.notes[task.id];
                      return (
                        <li key={task.id} id={`task-${task.id}`} className="scroll-mt-24 border-t border-gray-100 pt-4">
                          <p className="text-base leading-relaxed text-gray-900">
                            <span className="me-2 inline-flex min-w-9 justify-center rounded-md bg-gray-100 px-1.5 py-0.5 text-sm font-semibold text-gray-700">{task.id}</span>
                            <TaskLine task={task} verbs={t.files} />
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="me-1 text-sm font-semibold text-gray-700">{t.files.blendpdf}:</span>
                            {result?.refused && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                                <Ban className="h-3.5 w-3.5" aria-hidden />
                                {t.files.refused}
                              </span>
                            )}
                            {result?.checks
                              ?.filter((c) => c.status !== 'n/a')
                              .map((c) => (
                                <span
                                  key={c.id}
                                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                                    c.status === 'pass' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
                                  }`}
                                >
                                  {c.status === 'pass' ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                                  {t.checks.items[c.id].label}
                                  <span className="sr-only"> {t.files.status[c.status as 'pass' | 'fail']}</span>
                                </span>
                              ))}
                          </div>
                          {note && <p className="mt-2 text-sm leading-relaxed text-gray-600">{note}</p>}
                          {result?.file && (
                            <a href={fileHref(result.file)} download className="mt-1 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:text-primary-coral">
                              <Download className="h-4 w-4" aria-hidden />
                              {t.files.saved}
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900">{t.others.title}</h2>
            <p className="mt-3 text-base leading-relaxed text-gray-700">{t.others.intro}</p>
            <ul className="mt-4 space-y-3">
              {t.others.items.map((item) => (
                <li key={`${item.name}-${item.task}`} className="text-base leading-relaxed text-gray-700">
                  <Link href={item.path} className="font-semibold text-primary hover:text-primary-coral">
                    {item.name}
                  </Link>
                  <span className="mx-1.5 rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-700">{item.task}</span>
                  {item.text}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-base leading-relaxed text-gray-700">{t.others.after}</p>
            <Link href="/compare" className="mt-2 inline-flex min-h-11 items-center gap-1 font-medium text-primary hover:text-primary-coral">
              {t.others.all}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden />
            </Link>
          </section>

          <section className="mt-12">
            <h2 className="text-2xl font-bold text-gray-900">{t.why.title}</h2>
            {t.why.paragraphs.map((p) => (
              <p key={p} className="mt-3 text-base leading-relaxed text-gray-700">
                {p}
              </p>
            ))}
          </section>

          <section className="mt-12 rounded-2xl border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900">{t.reuse.title}</h2>
            <p className="mt-2 text-base leading-relaxed text-gray-700">{t.reuse.text}</p>
            <CopyCitation text={t.reuse.citation} copy={t.reuse.copy} copied={t.reuse.copied} />
          </section>

          <p className="mt-6 text-sm leading-relaxed text-gray-500">
            {t.correction.before}
            <a href={`mailto:${CONTACT}`} dir="ltr" className="font-medium text-primary hover:text-primary-coral">
              {CONTACT}
            </a>
            {t.correction.after}
          </p>
        </div>

        <ToolFAQ questions={t.faq} />
      </main>

      <Footer />
    </div>
  );
}
