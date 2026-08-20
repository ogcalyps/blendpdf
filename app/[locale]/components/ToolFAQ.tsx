'use client';

import { ChevronDown, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { FAQSchema } from '@/components/FAQSchema';

interface FAQItem {
  question: string;
  answer: string;
}

interface ToolFAQProps {
  questions: FAQItem[];
  faqPagePath?: string; // Optional path to full FAQ page, e.g., '/merge-pdf/faq'
}

export function ToolFAQ({ questions, faqPagePath }: ToolFAQProps) {
  const t = useTranslations('faq');

  return (
    <section className="py-12 px-4">
      <FAQSchema faqs={questions} />
      <div className="max-w-3xl mx-auto">
        <div className="mb-12 flex items-center justify-between gap-4">
          <h2 className="text-3xl font-bold text-dark">
            {t('title')}
          </h2>
          {faqPagePath && (
            <Link
              href={faqPagePath}
              className="inline-flex items-center gap-1 text-primary hover:text-primary-coral font-medium text-sm shrink-0"
            >
              {t('viewFull')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          )}
        </div>
        <div className="space-y-4">
          {questions.map((item, index) => (
            <details
              key={index}
              className="group rounded-xl border-2 border-orange-100 bg-white"
            >
              <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-6 text-start hover:bg-orange-50 transition-colors [&::-webkit-details-marker]:hidden">
                <span className="font-semibold text-dark">
                  {item.question}
                </span>
                <ChevronDown className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-orange-100 p-6">
                <p className="text-gray-600">{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
        {faqPagePath && (
          <div className="mt-8 text-center">
            <Link
              href={faqPagePath}
              className="inline-flex items-center gap-2 text-primary hover:text-primary-coral font-medium"
            >
              {t('viewComplete')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
