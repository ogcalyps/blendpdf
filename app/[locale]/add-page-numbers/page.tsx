'use client';

import { useTranslations } from 'next-intl';
import { Upload, Hash, Download } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function AddPageNumbersPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('addPageNumbers.steps.upload.title'),
      description: t('addPageNumbers.steps.upload.description'),
    },
    {
      icon: <Hash className="h-8 w-8 text-primary" />,
      title: t('addPageNumbers.steps.customize.title'),
      description: t('addPageNumbers.steps.customize.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('addPageNumbers.steps.download.title'),
      description: t('addPageNumbers.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('addPageNumbers');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Add Page Numbers', url: '/add-page-numbers' },
      ]} />
      <HowToSchema
        name="How to Add Page Numbers to PDF"
        description="Learn how to add page numbers to PDF files online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('addPageNumbers.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('addPageNumbers.description')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="numbers" />

      {/* The options panel's copy, kept for search: the choices themselves are in the workspace */}
      <section className="px-4 pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border-2 border-orange-100 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-dark">{t('addPageNumbers.customize')}</h2>
          <ul className="grid gap-4 text-sm sm:grid-cols-2">
            <li>
              <span className="font-semibold text-gray-900">{t('addPageNumbers.positionLabel')}</span>
              <span className="mt-1 block text-gray-600">
                {[t('addPageNumbers.positions.topLeft'), t('addPageNumbers.positions.topCenter'), t('addPageNumbers.positions.topRight'), t('addPageNumbers.positions.bottomLeft'), t('addPageNumbers.positions.bottomCenter'), t('addPageNumbers.positions.bottomRight')].join(' · ')}
              </span>
            </li>
            <li>
              <span className="font-semibold text-gray-900">{t('addPageNumbers.formatLabel')}</span>
              <span className="mt-1 block text-gray-600">
                {[t('addPageNumbers.formats.number'), t('addPageNumbers.formats.numberOfTotal'), t('addPageNumbers.formats.pageNumber'), t('addPageNumbers.formats.pageOfTotal')].join(' · ')}
              </span>
            </li>
            <li>
              <span className="font-semibold text-gray-900">{t('addPageNumbers.startFromLabel')}</span>
            </li>
            <li>
              <span className="font-semibold text-gray-900">{t('addPageNumbers.fontSizeLabel')}</span>
            </li>
          </ul>
        </div>
      </section>

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/add-page-numbers/faq" />
      <RelatedTools currentTool="add-page-numbers" />
      <Footer />
    </div>
  );
}
