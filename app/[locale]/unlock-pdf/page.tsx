'use client';

import { useTranslations } from 'next-intl';
import { Upload, Unlock, Download, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { HowItWorks } from '../components/HowItWorks';
import { FAQSchema } from '@/components/FAQSchema';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function UnlockPDFPage() {
  const t = useTranslations();
  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('unlockPdf.steps.upload.title'), description: t('unlockPdf.steps.upload.description') },
    { icon: <Unlock className="h-8 w-8 text-primary" />, title: t('unlockPdf.steps.choose.title'), description: t('unlockPdf.steps.choose.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('unlockPdf.steps.download.title'), description: t('unlockPdf.steps.download.description') },
  ];

  const faqData = useToolFaqs('unlockPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Unlock PDF', url: '/unlock-pdf' }]} />
      <HowToSchema name="How to Unlock PDF" description="Learn how to remove password protection from PDF files online for free" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('unlockPdf.heroTitle')}</h1>
            <p className="mt-4 text-lg text-gray-600">{t('unlockPdf.heroDescription')}</p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="unlock" />

      <HowItWorks steps={steps} />
      {/* We use FAQ component directly on page instead of linking away, matching the new requirements */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* This page renders its own FAQ layout rather than using ToolFAQ,
              so it has to emit the FAQPage schema itself. */}
          <FAQSchema faqs={faqData} />
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">{t('faq.title')}</h2>
          <div className="space-y-6">
            {faqData.map((faq, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
          {/* Same link ToolFAQ gives every other tool: the full FAQ page is otherwise orphaned */}
          <div className="mt-8 text-center">
            <Link
              href="/unlock-pdf/faq"
              className="inline-flex items-center gap-2 text-primary hover:text-primary-coral font-medium"
            >
              {t('faq.viewComplete')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </section>

      <RelatedTools currentTool="unlock" />
      <Footer />
    </div>
  );
}
