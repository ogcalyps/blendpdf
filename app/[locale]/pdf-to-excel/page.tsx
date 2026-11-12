'use client';

import { useTranslations } from 'next-intl';
import { Upload, Table, Download } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function PDFToExcelPage() {
  const t = useTranslations();
  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('pdfToExcel.steps.upload.title'), description: t('pdfToExcel.steps.upload.description') },
    { icon: <Table className="h-8 w-8 text-primary" />, title: t('pdfToExcel.steps.extract.title'), description: t('pdfToExcel.steps.extract.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('pdfToExcel.steps.download.title'), description: t('pdfToExcel.steps.download.description') },
  ];

  const faqData = useToolFaqs('pdfToExcel');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PDF to Excel', url: '/pdf-to-excel' }]} />
      <HowToSchema name="How to Convert PDF to Excel" description="Learn how to extract tables from PDF files and convert them to Excel format online for free" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('pdfToExcel.title')}</h1>
            <p className="mt-4 text-lg text-gray-600">{t('pdfToExcel.description')}</p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="excel" />

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/pdf-to-excel/faq" />
      <RelatedTools currentTool="pdf-to-excel" />
      <Footer />
    </div>
  );
}
