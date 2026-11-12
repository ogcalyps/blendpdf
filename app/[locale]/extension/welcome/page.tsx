import type { Metadata } from 'next';
import { Check, MousePointerClick, Pin, ShieldCheck, Upload } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { welcomeContent, welcomeShot } from '@/lib/extension-welcome';
import { localizedUrl, ogLocale } from '@/lib/i18n/seo';

const BASE_URL = 'https://blendpdf.com';
const STEP_ICONS = [Pin, Upload, MousePointerClick];

type Params = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const content = welcomeContent(locale);
  const url = localizedUrl(BASE_URL, locale, '/extension/welcome');
  return {
    title: content.metaTitle,
    description: content.description,
    // Only useful right after installing the extension, so it stays out of
    // search results; links from it still count.
    robots: { index: false, follow: true },
    openGraph: { title: content.metaTitle, description: content.description, url, siteName: 'BlendPDF', locale: ogLocale(locale), type: 'website' },
    alternates: { canonical: url },
  };
}

export default async function ExtensionWelcomePage({ params }: Params) {
  const { locale } = await params;
  const content = welcomeContent(locale);
  const shot = welcomeShot(locale);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navigation />
      <main className="flex-1">
        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 sm:px-6 sm:py-14 md:grid-cols-[minmax(0,1fr)_320px] md:items-start">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
              <Check className="h-4 w-4" aria-hidden="true" />
              {content.badge}
            </p>
            <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">{content.title}</h1>
            <p className="mt-3 max-w-2xl text-lg leading-relaxed text-gray-600">{content.intro}</p>

            <ol className="mt-8 space-y-4">
              {content.steps.map((step, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={step.title} className="flex gap-4 rounded-2xl border border-gray-200 p-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-50 text-primary">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 className="font-semibold text-gray-900">
                        <span className="text-primary">{i + 1}.</span> {step.title}
                      </h2>
                      <p className="mt-1 leading-relaxed text-gray-600">{step.text}</p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                {content.allTools}
              </Link>
              {/* A static file outside the locale routes, so a plain link: the
                  locale-aware Link would send French and Arabic to a 404. */}
              <a href="/extension/privacy.html" className="text-sm font-medium text-gray-700 underline-offset-4 hover:text-primary hover:underline">
                {content.privacy}
              </a>
            </div>

            <p className="mt-8 flex items-start gap-2 text-sm text-gray-500">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-teal" aria-hidden="true" />
              {content.note}
            </p>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element -- already sized WebP */}
          <img
            src={shot.src}
            width={shot.width}
            height={shot.height}
            alt={content.shotAlt}
            decoding="async"
            className="mx-auto w-full max-w-[320px] rounded-2xl border border-gray-200 shadow-lg"
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}
