'use client';

import { useTranslations } from 'next-intl';
import { Upload, Download, Zap, Lock, Eraser, ShieldCheck } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function RemoveMetadataPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('removeMetadata.steps.upload.title'),
      description: t('removeMetadata.steps.upload.description'),
    },
    {
      icon: <Eraser className="h-8 w-8 text-primary" />,
      title: t('removeMetadata.steps.remove.title'),
      description: t('removeMetadata.steps.remove.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('removeMetadata.steps.download.title'),
      description: t('removeMetadata.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('removeMetadata');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Remove Metadata', url: '/remove-metadata' }]} />
      <HowToSchema
        name={t('removeMetadata.howToTitle')}
        description="Learn how to strip hidden author names, software traces and timestamps from a PDF before sharing it, entirely in your browser"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('removeMetadata.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('removeMetadata.answer')}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 text-sm font-medium text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              {t('removeMetadata.privacyBadge')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="metadata" />

      {/* How it works section */}
      <HowItWorks steps={steps} title={t('removeMetadata.howToTitle')} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/remove-metadata/faq" />

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

            {/* In-browser Privacy Card */}
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-teal-100 rounded-xl p-3 w-fit mb-4">
                <Lock className="w-7 h-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">
                {t('removeMetadata.whyLocal.title')}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {t('removeMetadata.whyLocal.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Tools */}
      <RelatedTools currentTool="removeMetadata" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
