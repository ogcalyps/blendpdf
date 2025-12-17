'use client';

import { useTranslations } from 'next-intl';
import { XCircle, CheckCircle2, Loader2, Download } from 'lucide-react';
import type { ToolType } from '@/types';
import { downloadBlob } from '@/lib/utils';
import { useFileStore } from '@/store/use-file-store';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  currentTool: ToolType | null;
  error: string | null;
  onClose: () => void;
}

export function ProcessingModal({
  isOpen,
  progress,
  currentTool,
  error,
  onClose,
}: ProcessingModalProps) {
  const t = useTranslations('processing');
  const { processing, resetProcessing } = useFileStore();
  // Use processing.progress from store for consistency
  const isComplete = processing.progress === 100 && !error && processing.result !== null;
  const isProcessing = !error && processing.progress < 100 && processing.isProcessing;

  const handleDownload = () => {
    if (processing.result && processing.resultFilename) {
      downloadBlob(processing.result, processing.resultFilename);
      resetProcessing();
      onClose();
    }
  };

  if (!isOpen) return null;

  const getToolName = (tool: ToolType | null): string => {
    if (!tool) return '';
    const names: Record<ToolType, string> = {
      merge: t('processing'), // Will be translated
      compress: t('processing'),
      convert: t('processing'),
      split: t('processing'),
    };
    return names[tool];
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50">
      <div className="max-w-md mx-auto mt-32 bg-white rounded-2xl p-8 shadow-2xl">
        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-16 w-16 text-red-600" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{t('error')}</p>
              <p className="mt-2 text-sm text-gray-600">{error}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-white font-medium hover:bg-gray-800 transition-colors"
            >
              {t('close')}
            </button>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <div className="w-full">
              <p className="mb-2 text-center text-sm font-medium text-gray-700">
                {t('processing')} {getToolName(currentTool)}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-out"
                  style={{ width: `${processing.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {isComplete && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900">{t('success')}</h3>
              <p className="mt-2 text-sm text-gray-600">{t('readyToDownload')}</p>
            </div>
            <div className="flex w-full gap-3">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                {t('close')}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t('download')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

