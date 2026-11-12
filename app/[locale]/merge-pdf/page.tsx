'use client';

import { useTranslations } from 'next-intl';
import { Upload, Zap, Download } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { useToolFaqs } from '@/lib/tool-faqs';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';

export default function MergePDFPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('mergePdf.steps.upload.title'),
      description: t('mergePdf.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('mergePdf.steps.reorder.title'),
      description: t('mergePdf.steps.reorder.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('mergePdf.steps.download.title'),
      description: t('mergePdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('mergePdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Merge PDF', url: '/merge-pdf' },
      ]} />
      <HowToSchema 
        name={t('mergePdf.howToTitle')}
        description="Learn how to combine multiple PDF files into one document online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('mergePdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('mergePdf.answer')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="merge" />

      {/* How it works section */}
      <HowItWorks steps={steps} title={t('mergePdf.howToTitle')} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/merge-pdf/faq" />

      {/* Related Tools */}
      <RelatedTools currentTool="merge" />

      {/* Footer */}
      <Footer />
    </div>
  );
}

