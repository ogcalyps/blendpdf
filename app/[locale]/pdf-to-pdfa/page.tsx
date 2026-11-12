'use client';

import { useTranslations } from 'next-intl';
import { Upload, FileBadge, Download } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function PdfToPdfaPage() {
  const t = useTranslations();
  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('pdfToPdfa.steps.upload.title'), description: t('pdfToPdfa.steps.upload.description') },
    { icon: <FileBadge className="h-8 w-8 text-primary" />, title: t('pdfToPdfa.steps.convert.title'), description: t('pdfToPdfa.steps.convert.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('pdfToPdfa.steps.download.title'), description: t('pdfToPdfa.steps.download.description') },
  ];

  const faqData = useToolFaqs('pdfToPdfa');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PDF to PDF/A', url: '/pdf-to-pdfa' }]} />
      <HowToSchema name={t('pdfToPdfa.howToTitle')} description="Convert a PDF to PDF/A-1b, 2b or 3b online for free and check it with veraPDF" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('pdfToPdfa.title')}</h1>
            <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600">{t('pdfToPdfa.answer')}</p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="pdfa" />

      <HowItWorks steps={steps} title={t('pdfToPdfa.howToTitle')} />
      <ToolFAQ questions={faqData} />
      <RelatedTools currentTool="pdfa" />
      <Footer />
    </div>
  );
}
