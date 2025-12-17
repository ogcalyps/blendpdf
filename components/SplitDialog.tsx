'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';

interface SplitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSplit: (ranges: string) => void;
  pageCount: number;
}

export function SplitDialog({ isOpen, onClose, onSplit, pageCount }: SplitDialogProps) {
  const t = useTranslations('splitDialog');
  const [ranges, setRanges] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSplit = () => {
    if (!ranges.trim()) {
      setError('Invalid format');
      return;
    }

    // Basic validation: contains numbers
    if (!/\d/.test(ranges)) {
      setError('Invalid format');
      return;
    }

    setError(null);
    onSplit(ranges);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="max-w-md mx-auto mt-20 bg-white rounded-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{t('title')}</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Total Pages */}
        <p className="mb-4 text-sm text-gray-600">{t('totalPages')}: {pageCount}</p>

        {/* Input Field */}
        <div className="mb-4">
          <label htmlFor="ranges" className="block mb-2 text-sm font-medium text-gray-700">
            {t('pageRanges')}
          </label>
          <input
            id="ranges"
            type="text"
            value={ranges}
            onChange={(e) => setRanges(e.target.value)}
            placeholder={t('placeholder')}
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-2 text-sm text-gray-500">
            {t('helper')}
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSplit}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {t('split')}
          </button>
        </div>
      </div>
    </div>
  );
}

