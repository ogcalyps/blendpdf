'use client';

import { useTranslations } from 'next-intl';
import { Upload, Wrench, Download } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function RepairPDFPage() {
  const t = useTranslations();
  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('repairPdf.steps.upload.title'), description: t('repairPdf.steps.upload.description') },
    { icon: <Wrench className="h-8 w-8 text-primary" />, title: t('repairPdf.steps.repair.title'), description: t('repairPdf.steps.repair.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('repairPdf.steps.download.title'), description: t('repairPdf.steps.download.description') },
  ];

  const faqData = useToolFaqs('repairPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Repair PDF', url: '/repair-pdf' }]} />
      <HowToSchema name={t('repairPdf.howToTitle')} description="Learn how to fix corrupted or damaged PDF files online for free" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('repairPdf.title')}</h1>
            <p className="mt-4 text-lg text-gray-600">{t('repairPdf.answer')}</p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="repair" />

      <HowItWorks steps={steps} title={t('repairPdf.howToTitle')} />
      <ToolFAQ questions={faqData} faqPagePath="/repair-pdf/faq" />
      <RelatedTools currentTool="repair" />
      <Footer />
    </div>
  );
}
