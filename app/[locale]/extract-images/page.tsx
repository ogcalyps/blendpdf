'use client';

import { useTranslations } from 'next-intl';
import { Upload, Images, Download, Zap, Lock } from 'lucide-react';
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

export default function ExtractImagesPage() {
  const t = useTranslations();
  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('extractImages.steps.upload.title'),
      description: t('extractImages.steps.upload.description'),
    },
    {
      icon: <Images className="h-8 w-8 text-primary" />,
      title: t('extractImages.steps.extract.title'),
      description: t('extractImages.steps.extract.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('extractImages.steps.download.title'),
      description: t('extractImages.steps.download.description'),
    },
  ];

  // The searches Google shows this page for (all of them, a few, one page's, high quality, scanned),
  // answered on the page, plus what the tool leaves to other tools.
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
  const howTo = [
    { question: t('extractImages.guide.howTo.items.allAtOnce.question'), answer: t.rich('extractImages.guide.howTo.items.allAtOnce.answer', rich()) },
    { question: t('extractImages.guide.howTo.items.onePage.question'), answer: t.rich('extractImages.guide.howTo.items.onePage.answer', rich('/extract-pages')) },
    { question: t('extractImages.guide.howTo.items.quality.question'), answer: t.rich('extractImages.guide.howTo.items.quality.answer', rich()) },
    { question: t('extractImages.guide.howTo.items.scanned.question'), answer: t.rich('extractImages.guide.howTo.items.scanned.answer', rich('/pdf-to-images')) },
  ];
  const limits = [
    t.rich('extractImages.guide.limits.items.vector', rich('/pdf-to-images')),
    t.rich('extractImages.guide.limits.items.jpeg', rich()),
    t.rich('extractImages.guide.limits.items.remove', rich('/edit-pdf')),
    t.rich('extractImages.guide.limits.items.large', rich('/split-pdf')),
  ];

  const faqData = useToolFaqs('extractImages');

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Extract Images from PDF', url: '/extract-images' }]} />
      <HowToSchema
        name={t('extractImages.howToTitle')}
        description="Learn how to extract embedded images from a PDF for free, directly in your browser"
        steps={steps.map((step) => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('extractImages.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('extractImages.answer')}
            </p>
          </div>
        </div>
      </section>

      <ToolWorkspace mode="imagesInside" />

      {/* How it works section */}
      <HowItWorks steps={steps} title={t('extractImages.howToTitle')} />

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="mb-10 text-3xl font-bold text-dark">{t('extractImages.guide.howTo.title')}</h2>
          <div className="space-y-8">
            {howTo.map(({ question, answer }) => (
              <div key={question}>
                <h3 className="mb-2 text-xl font-semibold text-dark">{question}</h3>
                <p className="text-gray-600 leading-relaxed">{answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="mb-10 text-3xl font-bold text-dark">{t('extractImages.guide.limits.title')}</h2>
          <ul className="space-y-4">
            {limits.map((limit, index) => (
              <li key={index} className="rounded-xl border-2 border-orange-100 bg-white p-6 text-gray-600 leading-relaxed">
                {limit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/extract-images/faq" />

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
                <Zap className="w-7 h-7 text-primary" strokeWidth={2.5} />
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
      <RelatedTools currentTool="extractImages" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
