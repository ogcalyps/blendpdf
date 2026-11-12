'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight as ArrowRightIcon } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Upload, Droplets, Download } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function WatermarkPDFPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('watermarkPdf.steps.upload.title'),
      description: t('watermarkPdf.steps.upload.description'),
    },
    {
      icon: <Droplets className="h-8 w-8 text-primary" />,
      title: t('watermarkPdf.steps.customize.title'),
      description: t('watermarkPdf.steps.customize.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('watermarkPdf.steps.download.title'),
      description: t('watermarkPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('watermarkPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Watermark PDF', url: '/watermark-pdf' }]} />
      <HowToSchema
        name="How to Add Watermark to PDF"
        description="Learn how to add text or image watermarks to PDF files online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('watermarkPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">{t('watermarkPdf.description')}</p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="watermark" />

      {/* The ID-copy page: the same mode with "who it's for, what for, the date" tiled */}
      <p className="px-4 pb-8 text-center text-sm text-gray-600">
        <Link href="/watermark-pdf/id-copy" className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary-coral">
          {t('watermarkPdf.idCopyLink')}
          <ArrowRightIcon className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </p>

      {/* The options panel's copy, kept for search: the choices themselves are in the workspace */}
      <section className="px-4 pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border-2 border-orange-100 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-dark">{t('watermarkPdf.customize')}</h2>
          <ul className="grid gap-4 text-sm sm:grid-cols-2">
            <li>
              <span className="font-semibold text-gray-900">{t('watermarkPdf.typeLabel')}</span>
              <span className="mt-1 block text-gray-600">{[t('watermarkPdf.types.text'), t('watermarkPdf.types.image')].join(' · ')}</span>
            </li>
            <li>
              <span className="font-semibold text-gray-900">{t('watermarkPdf.positionLabel')}</span>
              <span className="mt-1 block text-gray-600">
                {[t('watermarkPdf.positions.center'), t('watermarkPdf.positions.diagonal'), t('watermarkPdf.positions.tiled')].join(' · ')}
              </span>
            </li>
            <li>
              <span className="font-semibold text-gray-900">{t('watermarkPdf.textLabel')}</span>
            </li>
            <li>
              <span className="font-semibold text-gray-900">{t('watermarkPdf.opacityLabel')}</span>
            </li>
            <li>
              <span className="font-semibold text-gray-900">{t('watermarkPdf.fontSizeLabel')}</span>
            </li>
          </ul>
        </div>
      </section>

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/watermark-pdf/faq" />
      <RelatedTools currentTool="watermark" />
      <Footer />
    </div>
  );
}
