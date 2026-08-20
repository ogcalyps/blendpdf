'use client';

import { useTranslations } from 'next-intl';

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface HowItWorksProps {
  steps: Step[];
}

export function HowItWorks({ steps }: HowItWorksProps) {
  const t = useTranslations('howItWorks');

  return (
    <section className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="mb-12 text-center text-3xl font-bold text-dark">
          {t('title')}
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
                {step.icon}
              </div>
              <h3 className="mb-2 text-xl font-semibold text-dark">
                {step.title}
              </h3>
              <p className="text-gray-600">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

