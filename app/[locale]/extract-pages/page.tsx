'use client';

import { useTranslations } from 'next-intl';
import { Upload, Download, Zap, Lock, FileOutput } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function ExtractPagesPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('extractPages.steps.upload.title'),
      description: t('extractPages.steps.upload.description'),
    },
    {
      icon: <FileOutput className="h-8 w-8 text-primary" />,
      title: t('extractPages.steps.extract.title'),
      description: t('extractPages.steps.extract.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('extractPages.steps.download.title'),
      description: t('extractPages.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('extractPages');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Extract Pages', url: '/extract-pages' }]} />
      <HowToSchema
        name={t('extractPages.howToTitle')}
        description="Learn how to save certain pages of a PDF as a new file online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('extractPages.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('extractPages.answer')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="extract" />

      {/* How it works section */}
      <HowItWorks steps={steps} title={t('extractPages.howToTitle')} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/extract-pages/faq" />

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
      <RelatedTools currentTool="extractPages" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
