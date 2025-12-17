'use client';

import { useTranslations } from 'next-intl';
import { X, Check } from 'lucide-react';

export function ProofSection() {
  const t = useTranslations('technical');

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 md:grid-cols-2">
        {/* Most Tools - Broken RTL */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-600">{t('mostTools')}</p>
          <div className="rounded-xl border-2 border-red-300 bg-white p-6">
            <div className="mb-4 text-center">
              <p className="text-2xl font-medium text-gray-900">???????</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-red-600">
              <X className="h-5 w-5" />
              <span className="text-sm font-medium">{t('brokenRTL')}</span>
            </div>
          </div>
        </div>

        {/* Blend PDF - Perfect RTL */}
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-gray-600">{t('fluxpdf')}</p>
          <div className="rounded-xl border-2 border-green-300 bg-white p-6">
            <div className="mb-4 text-center" dir="rtl">
              <p className="text-2xl font-medium text-gray-900">
                مرحباً بك في بلند PDF
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <span className="text-sm font-medium">{t('perfectRTL')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Supported Languages */}
      <div className="text-center">
        <p className="text-sm text-gray-600">{t('languages')}</p>
      </div>
    </div>
  );
}

