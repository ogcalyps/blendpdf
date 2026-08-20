'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface AddMoreCardProps {
  onClick: () => void;
}

export function AddMoreCard({ onClick }: AddMoreCardProps) {
  const t = useTranslations('fileList');

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-3 hover:border-primary hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-all cursor-pointer flex items-center justify-center aspect-[8.5/11]"
    >
      <div className="text-center">
        <Plus className="w-12 h-12 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-600">{t('addMore')}</p>
      </div>
    </button>
  );
}
