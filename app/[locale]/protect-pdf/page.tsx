'use client';

import { useTranslations } from 'next-intl';
import { Upload, Lock, Download } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function ProtectPDFPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('protectPdf.steps.upload.title'),
      description: t('protectPdf.steps.upload.description'),
    },
    {
      icon: <Lock className="h-8 w-8 text-primary" />,
      title: t('protectPdf.steps.password.title'),
      description: t('protectPdf.steps.password.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('protectPdf.steps.download.title'),
      description: t('protectPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('protectPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Protect PDF', url: '/protect-pdf' },
      ]} />
      <HowToSchema 
        name={t('protectPdf.howToTitle')}
        description="Learn how to add password protection to PDF files online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('protectPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('protectPdf.answer')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="protect" />

      {/* The options panel's copy, kept for search: the choices themselves are in the workspace */}
      <section className="px-4 pb-4">
        <div className="mx-auto max-w-3xl rounded-2xl border-2 border-orange-100 bg-white p-6">
          <h2 className="mb-2 text-lg font-bold text-dark">{t('protectPdf.setPassword')}</h2>
          <p className="text-sm text-gray-600">{t('protectPdf.passwordHint')}</p>
          <div className="mt-6 rounded-lg bg-orange-50 p-4 text-sm text-gray-700">
            <p className="mb-1 font-medium">🔒 {t('protectPdf.securityInfo')}:</p>
            <p className="text-gray-600">{t('protectPdf.securityInfoDesc')}</p>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} title={t('protectPdf.howToTitle')} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/protect-pdf/faq" />

      {/* Related Tools */}
      <RelatedTools currentTool="protect" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
