'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowLeft } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';

// Real last-revision date of this policy text — update when the policy changes.
const POLICY_UPDATED = new Date('2026-10-29');

const SECTION_KEYS = ['dataWeCollect', 'cookies', 'runCounter', 'googleDrive', 'retention', 'yourRights', 'contact'] as const;

export default function PrivacyPage() {
  const t = useTranslations('privacy');
  const locale = useLocale();

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <main className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-primary hover:underline text-sm mb-6 inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            Back to home
          </Link>
          <h1 className="text-3xl font-bold text-dark mb-2">{t('title')}</h1>
          <p className="text-gray-600 text-sm mb-8">
            {t('lastUpdated')} {POLICY_UPDATED.toLocaleDateString(locale === 'en' ? 'en-GB' : locale, { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-gray-700 leading-relaxed mb-8">{t('intro')}</p>
          <div className="space-y-8">
            {SECTION_KEYS.map((key) => (
              <section key={key}>
                <h2 className="text-xl font-semibold text-dark mb-3">{t(`${key}.title`)}</h2>
                <p className="text-gray-700 leading-relaxed">{t(`${key}.body`)}</p>
              </section>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
