'use client';

import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { UploadZone } from '@/components/UploadZone';
import { FileList } from '@/components/FileList';
import { HowItWorks } from './HowItWorks';
import { ToolFAQ } from './ToolFAQ';
import { RelatedTools } from './RelatedTools';
import { useFileStore } from '@/store/use-file-store';

interface ToolPageLayoutProps {
  toolType: string;
  toolTitle: string;
  toolDescription: string;
  steps: Array<{
    icon: ReactNode;
    title: string;
    description: string;
  }>;
  faqData: Array<{
    question: string;
    answer: string;
  }>;
  optionsPanel?: ReactNode;
}

export function ToolPageLayout({
  toolType,
  toolTitle,
  toolDescription,
  steps,
  faqData,
  optionsPanel,
}: ToolPageLayoutProps) {
  const t = useTranslations();
  const files = useFileStore((state) => state.files);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Tool-specific hero */}
      <section className="bg-gradient-to-b from-blue-50 via-white to-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {toolTitle}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {toolDescription}
            </p>
          </div>
        </div>
      </section>

      {/* Upload zone and options */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              {files.length === 0 && <UploadZone />}
              {files.length > 0 && <FileList showGrid={false} showAddMore={false} />}
            </div>
            {optionsPanel && (
              <div className="flex flex-col gap-4">
                {optionsPanel}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <HowItWorks steps={steps} />

      {/* FAQ */}
      <ToolFAQ questions={faqData} />

      {/* Why Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            {t('why.title')}
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <h3 className="mb-3 text-xl font-semibold text-gray-900">
                {t('why.noSignup.title')}
              </h3>
              <p className="text-gray-600">
                {t('why.noSignup.description')}
              </p>
            </div>
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <h3 className="mb-3 text-xl font-semibold text-gray-900">
                {t('why.autoDelete.title')}
              </h3>
              <p className="text-gray-600">
                {t('why.autoDelete.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related tools */}
      <RelatedTools currentTool={toolType} />
    </div>
  );
}

