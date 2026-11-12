'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  Upload,
  FilePenLine,
  Download,
  Zap,
  Lock,
  ShieldCheck,
  Type,
  Signature,
  ImagePlus,
  Highlighter,
  EyeOff,
  CalendarDays,
  Files,
  Save,
} from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { useToolFaqs } from '@/lib/tool-faqs';
import { Link } from '@/i18n/routing';

export default function EditPdfPage() {
  const t = useTranslations();
  const locale = useLocale();
  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('editPdf.steps.upload.title'), description: t('editPdf.steps.upload.description') },
    { icon: <FilePenLine className="h-8 w-8 text-primary" />, title: t('editPdf.steps.edit.title'), description: t('editPdf.steps.edit.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('editPdf.steps.save.title'), description: t('editPdf.steps.save.description') },
  ];

  // What the editor does, answered on the page: ChatGPT sends more visitors to
  // /edit-pdf than to any other page, and the copy under the editor was thin.
  const features = [
    { icon: Type, title: t('editPdf.guide.features.items.text.title'), body: t('editPdf.guide.features.items.text.body') },
    { icon: FilePenLine, title: t('editPdf.guide.features.items.existing.title'), body: t('editPdf.guide.features.items.existing.body') },
    { icon: Signature, title: t('editPdf.guide.features.items.sign.title'), body: t('editPdf.guide.features.items.sign.body') },
    { icon: ImagePlus, title: t('editPdf.guide.features.items.image.title'), body: t('editPdf.guide.features.items.image.body') },
    { icon: Highlighter, title: t('editPdf.guide.features.items.draw.title'), body: t('editPdf.guide.features.items.draw.body') },
    { icon: EyeOff, title: t('editPdf.guide.features.items.cover.title'), body: t('editPdf.guide.features.items.cover.body') },
    { icon: CalendarDays, title: t('editPdf.guide.features.items.date.title'), body: t('editPdf.guide.features.items.date.body') },
    { icon: Files, title: t('editPdf.guide.features.items.pages.title'), body: t('editPdf.guide.features.items.pages.body') },
    { icon: Save, title: t('editPdf.guide.features.items.save.title'), body: t('editPdf.guide.features.items.save.body') },
  ];
  const howTo = [
    { question: t('editPdf.guide.howTo.items.addText.question'), answer: t('editPdf.guide.howTo.items.addText.answer') },
    { question: t('editPdf.guide.howTo.items.changeText.question'), answer: t('editPdf.guide.howTo.items.changeText.answer') },
    { question: t('editPdf.guide.howTo.items.sign.question'), answer: t('editPdf.guide.howTo.items.sign.answer') },
    { question: t('editPdf.guide.howTo.items.pages.question'), answer: t('editPdf.guide.howTo.items.pages.answer') },
  ];
  const rich = (href?: string) => ({
    b: (chunks: React.ReactNode) => <strong className="font-semibold text-dark">{chunks}</strong>,
    link: (chunks: React.ReactNode) =>
      href ? (
        <Link href={href} className="font-medium text-primary underline hover:text-primary-coral">
          {chunks}
        </Link>
      ) : (
        chunks
      ),
  });
  const limits = [
    t.rich('editPdf.guide.limits.items.paragraphs', rich('/pdf-to-word')),
    t.rich('editPdf.guide.limits.items.scanned', rich('/ocr-pdf')),
    t.rich('editPdf.guide.limits.items.effects', rich()),
  ];

  const faqData = useToolFaqs('editPdf');
  const localePrefix = locale === 'en' ? '' : `/${locale}`;

  return (
    <div className="flex min-h-screen flex-col">
      <BreadcrumbSchema
        items={[
          { name: 'BlendPDF', url: localePrefix || '/' },
          { name: t('nav.tools.editPdf.title'), url: `${localePrefix}/edit-pdf` },
        ]}
      />
      <HowToSchema
        name={t('editPdf.howToTitle')}
        description={t('editPdf.description')}
        steps={steps.map((step) => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      <section className="px-4 py-12">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('editPdf.title')}</h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg text-gray-600">{t('editPdf.answer')}</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-4 py-1.5 text-sm font-medium text-teal-700">
            <ShieldCheck className="h-4 w-4" />
            {t('editPdf.whyLocal.title')}
          </p>
        </div>
      </section>

      <ToolWorkspace mode="edit" />

      <HowItWorks steps={steps} title={t('editPdf.howToTitle')} />

      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="mb-4 text-center text-3xl font-bold text-dark">{t('editPdf.guide.features.title')}</h2>
          <p className="mx-auto mb-12 max-w-3xl text-center text-lg text-gray-600">{t('editPdf.guide.features.lead')}</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border-2 border-orange-100 bg-white p-6">
                <div className="mb-4 w-fit rounded-xl bg-orange-100 p-3">
                  <Icon className="h-6 w-6 text-primary" strokeWidth={2.5} />
                </div>
                <h3 className="mb-2 text-lg font-bold text-dark">{title}</h3>
                <p className="text-gray-600 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="mb-10 text-3xl font-bold text-dark">{t('editPdf.guide.howTo.title')}</h2>
          <div className="space-y-8">
            {howTo.map(({ question, answer }) => (
              <div key={question}>
                <h3 className="mb-2 text-xl font-semibold text-dark">{question}</h3>
                <p className="text-gray-600 leading-relaxed">{answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-gray-600 leading-relaxed">{t.rich('editPdf.guide.compare', rich('/compare'))}</p>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="mb-10 text-3xl font-bold text-dark">{t('editPdf.guide.limits.title')}</h2>
          <ul className="space-y-4">
            {limits.map((limit, index) => (
              <li key={index} className="rounded-xl border-2 border-orange-100 bg-white p-6 text-gray-600 leading-relaxed">
                {limit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <ToolFAQ questions={faqData} />

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
              <h3 className="text-xl font-bold text-dark mb-3">{t('editPdf.whyLocal.title')}</h3>
              <p className="text-gray-600 leading-relaxed">{t('editPdf.whyLocal.description')}</p>
            </div>
          </div>
        </div>
      </section>

      <RelatedTools currentTool="editPdf" />
      <Footer />
    </div>
  );
}
