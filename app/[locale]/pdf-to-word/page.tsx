'use client';

import { useTranslations } from 'next-intl';
import { Upload, Zap, Download, Zap as ZapIcon, Lock } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function PDFToWordPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('pdfToWord.steps.upload.title'),
      description: t('pdfToWord.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('pdfToWord.steps.convert.title'),
      description: t('pdfToWord.steps.convert.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('pdfToWord.steps.download.title'),
      description: t('pdfToWord.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('pdfToWord');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PDF to Word', url: '/pdf-to-word' }]} />
      <HowToSchema
        name={t('pdfToWord.howToTitle')}
        description="Learn how to convert PDF files to Word DOCX format online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('pdfToWord.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('pdfToWord.answer')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="word" />

      {/* How it works */}
      <HowItWorks steps={steps} title={t('pdfToWord.howToTitle')} />

      {/* FAQ */}
      <ToolFAQ questions={faqData} faqPagePath="/pdf-to-word/faq" />

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
                <ZapIcon className="w-7 h-7 text-primary" strokeWidth={2.5} />
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
      <RelatedTools currentTool="pdf-to-word" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
