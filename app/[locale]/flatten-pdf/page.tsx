'use client';

import { useTranslations } from 'next-intl';
import { Upload, Layers, Download, Zap, Lock } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function FlattenPDFPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('flattenPdf.steps.upload.title'),
      description: t('flattenPdf.steps.upload.description'),
    },
    {
      icon: <Layers className="h-8 w-8 text-primary" />,
      title: t('flattenPdf.steps.flatten.title'),
      description: t('flattenPdf.steps.flatten.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('flattenPdf.steps.download.title'),
      description: t('flattenPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('flattenPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Flatten PDF', url: '/flatten-pdf' }]} />
      <HowToSchema
        name={t('flattenPdf.howToTitle')}
        description="Learn how to flatten PDF form fields and make a filled form non-editable online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('flattenPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('flattenPdf.answer')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="flatten" />

      {/* How it works section */}
      <HowItWorks steps={steps} title={t('flattenPdf.howToTitle')} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/flatten-pdf/faq" />

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
      <RelatedTools currentTool="flattenPdf" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
