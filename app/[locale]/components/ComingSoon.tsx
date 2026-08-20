'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowLeft } from 'lucide-react';

interface ComingSoonProps {
  featureName?: string;
}

export function ComingSoon({ featureName }: ComingSoonProps) {
  const t = useTranslations('comingSoon');
  
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <div className="flex-1 flex items-center justify-center px-4 py-16 bg-white">
        <div className="max-w-2xl mx-auto text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
              <svg
                className="w-10 h-10 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {t('title')}
          </h1>
          
          {featureName && (
            <p className="text-xl text-gray-600 mb-2">
              {featureName}
            </p>
          )}
          
          <p className="text-lg text-gray-600 mb-8">
            {t('description')}
          </p>
          
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
            {t('backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}

