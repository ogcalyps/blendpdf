'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import type { CompressionLevel } from '@/types';

interface CompressDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCompress: (level: CompressionLevel) => void;
}

export function CompressDialog({ isOpen, onClose, onCompress }: CompressDialogProps) {
  const t = useTranslations('compressDialog');
  const [level, setLevel] = useState<CompressionLevel>('medium');

  if (!isOpen) return null;

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

        {/* Radio Options */}
        <div className="space-y-3 mb-6">
          {/* Low Quality */}
          <label
            className={`flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
              level === 'low' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="compression"
              value="low"
              checked={level === 'low'}
              onChange={() => setLevel('low')}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">{t('low')}</div>
              <div className="text-sm text-gray-500">{t('lowDesc')}</div>
            </div>
          </label>

          {/* Medium Quality */}
          <label
            className={`flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
              level === 'medium' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="compression"
              value="medium"
              checked={level === 'medium'}
              onChange={() => setLevel('medium')}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">{t('medium')}</div>
              <div className="text-sm text-gray-500">{t('mediumDesc')}</div>
            </div>
          </label>

          {/* High Quality */}
          <label
            className={`flex items-center gap-3 cursor-pointer p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
              level === 'high' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="compression"
              value="high"
              checked={level === 'high'}
              onChange={() => setLevel('high')}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">{t('high')}</div>
              <div className="text-sm text-gray-500">{t('highDesc')}</div>
            </div>
          </label>
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
            onClick={() => {
              onCompress(level);
              onClose();
            }}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {t('compress')}
          </button>
        </div>
      </div>
    </div>
  );
}

