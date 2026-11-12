'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { SIZE_TARGETS, sizeLabel } from '@/lib/size-limits/targets';
import { Upload, Zap, Download, Lock } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function CompressPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('compressPdf.steps.upload.title'),
      description: t('compressPdf.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('compressPdf.steps.choose.title'),
      description: t('compressPdf.steps.choose.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('compressPdf.steps.download.title'),
      description: t('compressPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('compressPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Compress PDF', url: '/compress-pdf' },
      ]} />
      <HowToSchema 
        name={t('compressPdf.howToTitle')}
        description="Learn how to reduce PDF file size online for free while maintaining quality"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('compressPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('compressPdf.answer')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="compress" />

      {/* The size pages: the same tool with "Under a size limit" already set */}
      <nav aria-labelledby="compress-to-size" className="px-4 pb-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2">
          <h2 id="compress-to-size" className="me-1 text-sm font-medium text-gray-600">
            {t('compressPdf.toSize')}
          </h2>
          {SIZE_TARGETS.map((size) => (
            <Link
              key={size.slug}
              href={`/compress-pdf/${size.slug}`}
              className="inline-flex min-h-11 items-center rounded-full border-2 border-orange-100 px-4 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary"
            >
              {sizeLabel(size.limitMb, locale)}
            </Link>
          ))}
        </div>
      </nav>

      {/* The options panel's copy, kept for search: the choices themselves are in the workspace */}
      <section className="px-4 pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border-2 border-orange-100 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-dark">{t('compressPdf.compressionSettings')}</h2>
          <ul className="space-y-3">
            <li className="rounded-xl border-2 border-orange-100 p-4">
              <span className="font-medium text-dark">{t('compressPdf.highQuality')}</span>
              <span className="mt-1 block text-sm text-gray-600">{t('compressPdf.highQualityDesc')}</span>
            </li>
            <li className="rounded-xl border-2 border-orange-100 p-4">
              <span className="flex items-center gap-2">
                <span className="font-medium text-dark">{t('compressPdf.mediumQuality')}</span>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-primary">{t('compressPdf.recommended')}</span>
              </span>
              <span className="mt-1 block text-sm text-gray-600">{t('compressPdf.mediumQualityDesc')}</span>
            </li>
            <li className="rounded-xl border-2 border-orange-100 p-4">
              <span className="font-medium text-dark">{t('compressPdf.lowQuality')}</span>
              <span className="mt-1 block text-sm text-gray-600">{t('compressPdf.lowQualityDesc')}</span>
            </li>
          </ul>
          <div className="mt-6 rounded-lg bg-orange-50 p-4 text-sm text-gray-700">
            <p className="mb-1 font-medium">💡 {t('compressPdf.howCompressionWorks')}:</p>
            <p className="text-gray-600">{t('compressPdf.howCompressionWorksDesc')}</p>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} title={t('compressPdf.howToTitle')} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/compress-pdf/faq" />

      {/* Why Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-dark mb-12">
            {t('why.title')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* No Sign-up Card */}
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-orange-100 rounded-xl p-3 w-fit mb-4">
                <Zap className="w-7 h-7 text-primary" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">
                {t('why.noSignup.title')}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {t('why.noSignup.description')}
              </p>
            </div>

            {/* Auto-delete Card */}
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-teal-100 rounded-xl p-3 w-fit mb-4">
                <Lock className="w-7 h-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">
                {t('why.autoDelete.title')}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {t('why.autoDelete.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Tools */}
      <RelatedTools currentTool="compress" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
