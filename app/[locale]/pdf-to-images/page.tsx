'use client';

import { useTranslations } from 'next-intl';
import { Upload, Zap, Download, Image as ImageIcon } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function PDFToImagesPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('pdfToImages.steps.upload.title'),
      description: t('pdfToImages.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('pdfToImages.steps.convert.title'),
      description: t('pdfToImages.steps.convert.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('pdfToImages.steps.download.title'),
      description: t('pdfToImages.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('pdfToImages');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PDF to Images', url: '/pdf-to-images' }]} />
      <HowToSchema
        name="How to Convert PDF to Images"
        description="Learn how to convert PDF pages to high-quality images (JPG, PNG) online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('pdfToImages.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('pdfToImages.description')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="images" />

      <HowItWorks steps={steps} />

      {/* Why BlendPDF Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-dark mb-8">
            {t('why.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <Zap className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.noSignup.title')}</h3>
                <p className="text-gray-700">{t('why.noSignup.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <ImageIcon className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.autoDelete.title')}</h3>
                <p className="text-gray-700">{t('why.autoDelete.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/pdf-to-images/faq" />

      {/* Related Tools Section */}
      <RelatedTools currentTool="pdf-to-images" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
