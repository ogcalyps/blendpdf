'use client';

import { useTranslations } from 'next-intl';
import { Upload, PenTool, Download, Lock, Zap, ShieldCheck } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

export default function SignPDFPage() {
  const t = useTranslations();
  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('signPdf.steps.upload.title'), description: t('signPdf.steps.upload.description') },
    { icon: <PenTool className="h-8 w-8 text-primary" />, title: t('signPdf.steps.sign.title'), description: t('signPdf.steps.sign.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('signPdf.steps.download.title'), description: t('signPdf.steps.download.description') },
  ];

  const faqData = useToolFaqs('signPdf');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Sign PDF', url: '/sign-pdf' }]} />
      <HowToSchema name="How to Sign PDF" description="Learn how to add electronic signatures to PDF files online for free — draw, type, or upload a signature and drag it anywhere on any page" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('signPdf.title')}</h1>
            <p className="mt-4 text-lg text-gray-600">{t('signPdf.description')}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 text-sm font-medium text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              {t('signPdf.whyLocal.title')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="sign" />
      <p className="px-4 pb-4 text-center text-sm">
        <Link href="/edit-pdf" className="inline-flex min-h-11 items-center font-medium text-primary underline hover:no-underline">
          {t('signPdf.needText')}
        </Link>
      </p>

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/sign-pdf/faq" />

      {/* Why Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-dark mb-12">{t('why.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-orange-100 rounded-xl p-3 w-fit mb-4">
                <Zap className="w-7 h-7 text-primary" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">{t('why.noSignup.title')}</h3>
              <p className="text-gray-600 leading-relaxed">{t('why.noSignup.description')}</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-teal-100 rounded-xl p-3 w-fit mb-4">
                <Lock className="w-7 h-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">{t('signPdf.whyLocal.title')}</h3>
              <p className="text-gray-600 leading-relaxed">{t('signPdf.whyLocal.description')}</p>
            </div>
          </div>
        </div>
      </section>

      <RelatedTools currentTool="sign" />
      <Footer />
    </div>
  );
}
