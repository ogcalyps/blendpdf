'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Image, ImageIcon, FileImage } from 'lucide-react';
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

        {/* Compression Options */}
        <div className="space-y-3 mb-6">
          {/* Low Compression - Best Quality */}
          <label
            className={`flex items-start gap-4 cursor-pointer p-4 border-2 rounded-xl hover:bg-gray-50 transition-all ${
              level === 'low' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="compression"
              value="low"
              checked={level === 'low'}
              onChange={() => setLevel('low')}
              className="h-5 w-5 text-blue-600 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Image className="h-4 w-4 text-green-600" />
                <div className="font-semibold text-gray-900">{t('low')}</div>
              </div>
              <div className="text-sm text-gray-600">{t('lowDesc')}</div>
              <div className="mt-2 flex gap-1">
                <div className="h-1.5 w-full bg-green-500 rounded-full"></div>
                <div className="h-1.5 w-full bg-green-500 rounded-full"></div>
                <div className="h-1.5 w-full bg-gray-300 rounded-full"></div>
              </div>
            </div>
          </label>

          {/* Medium Compression - Balanced */}
          <label
            className={`flex items-start gap-4 cursor-pointer p-4 border-2 rounded-xl hover:bg-gray-50 transition-all ${
              level === 'medium' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="compression"
              value="medium"
              checked={level === 'medium'}
              onChange={() => setLevel('medium')}
              className="h-5 w-5 text-blue-600 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="h-4 w-4 text-yellow-600" />
                <div className="font-semibold text-gray-900">{t('medium')}</div>
                <span className="ml-auto text-xs font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                  {t('recommended')}
                </span>
              </div>
              <div className="text-sm text-gray-600">{t('mediumDesc')}</div>
              <div className="mt-2 flex gap-1">
                <div className="h-1.5 w-full bg-yellow-500 rounded-full"></div>
                <div className="h-1.5 w-full bg-yellow-500 rounded-full"></div>
                <div className="h-1.5 w-full bg-yellow-500 rounded-full"></div>
              </div>
            </div>
          </label>

          {/* High Compression - Smallest Size */}
          <label
            className={`flex items-start gap-4 cursor-pointer p-4 border-2 rounded-xl hover:bg-gray-50 transition-all ${
              level === 'high' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200'
            }`}
          >
            <input
              type="radio"
              name="compression"
              value="high"
              checked={level === 'high'}
              onChange={() => setLevel('high')}
              className="h-5 w-5 text-blue-600 mt-0.5"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FileImage className="h-4 w-4 text-orange-600" />
                <div className="font-semibold text-gray-900">{t('high')}</div>
              </div>
              <div className="text-sm text-gray-600">{t('highDesc')}</div>
              <div className="mt-2 flex gap-1">
                <div className="h-1.5 w-full bg-orange-500 rounded-full"></div>
                <div className="h-1.5 w-full bg-gray-300 rounded-full"></div>
                <div className="h-1.5 w-full bg-gray-300 rounded-full"></div>
              </div>
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

