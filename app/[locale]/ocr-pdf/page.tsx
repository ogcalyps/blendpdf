'use client';

import { useTranslations } from 'next-intl';
import { Upload, ScanText, Download, Zap as ZapIcon, Lock } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function OcrPdfPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('ocrPdf.steps.upload.title'),
      description: t('ocrPdf.steps.upload.description'),
    },
    {
      icon: <ScanText className="h-8 w-8 text-primary" />,
      title: t('ocrPdf.steps.ocr.title'),
      description: t('ocrPdf.steps.ocr.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('ocrPdf.steps.download.title'),
      description: t('ocrPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('ocrPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'OCR PDF', url: '/ocr-pdf' }]} />
      <HowToSchema
        name="How to OCR a PDF"
        description="Learn how to make a scanned PDF searchable with OCR online for free, with support for Arabic, English, French, and Spanish"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('ocrPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('ocrPdf.description')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="ocr" />

      {/* The options panel's copy, kept for search: the choices themselves are in the workspace */}
      <section className="px-4 pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border-2 border-orange-100 bg-white p-6">
          <p className="text-sm text-gray-700">{t('ocrPdf.howItWorksDesc')}</p>
          <p className="mt-3 text-sm text-gray-500">{t('ocrPdf.supportedFormats')}</p>
        </div>
      </section>

      <HowItWorks steps={steps} />

      {/* Why BlendPDF Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-dark mb-8">
            {t('why.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <ZapIcon className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.noSignup.title')}</h3>
                <p className="text-gray-700">{t('why.noSignup.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <Lock className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.autoDelete.title')}</h3>
                <p className="text-gray-700">{t('why.autoDelete.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/ocr-pdf/faq" />

      {/* Related Tools Section */}
      <RelatedTools currentTool="ocrPdf" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
