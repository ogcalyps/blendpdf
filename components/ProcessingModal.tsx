'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { XCircle, Loader2, RefreshCw } from 'lucide-react';
import type { ToolType } from '@/types';
import { downloadBlob } from '@/lib/utils';
import { useFileStore } from '@/store/use-file-store';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useFileDelivery } from '@/hooks/useFileDelivery';
import { FileDeliveryPanel } from './FileDeliveryPanel';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  currentTool: ToolType | null;
  error: string | null;
  onClose: () => void;
  onRetry?: () => void;
  /** Replaces the generic success heading, for runs that succeeded but did nothing. */
  noticeTitle?: string | null;
  /** Shown instead of "ready to download" to explain an unusual but successful outcome. */
  notice?: string | null;
}

export function ProcessingModal({
  isOpen,
  progress,
  currentTool,
  error,
  onClose,
  onRetry,
  noticeTitle,
  notice,
}: ProcessingModalProps) {
  const t = useTranslations('processing');
  const { processing, resetProcessing } = useFileStore();
  const [displayProgress, setDisplayProgress] = useState(0);

  // Surface errors even when the caller's isOpen expression collapses on failure
  // (pages compute isOpen from isProcessing/result, both falsy after setError).
  const effectiveError = error ?? processing.error;

  // Use processing.progress from store for consistency
  const isComplete = processing.progress === 100 && !effectiveError && processing.result !== null;
  const isProcessing = !effectiveError && processing.progress < 100 && processing.isProcessing;
  const shouldRender = isOpen || effectiveError !== null;

  // Download and email live in one panel on the success screen: no second dialog
  const delivery = useFileDelivery({
    fileBlob: processing.result,
    filename: processing.resultFilename || 'file.pdf',
    onDownload: (filename) => {
      if (processing.result) {
        downloadBlob(processing.result, filename);
      }
    },
    onFinish: () => {
      resetProcessing();
      onClose();
    },
    onDismiss: onClose,
  });

  const dialogRef = useFocusTrap<HTMLDivElement>(
    shouldRender,
    isProcessing || delivery.isSending
      ? undefined
      : isComplete
        ? delivery.finished
          ? delivery.finish
          : delivery.dismiss
        : onClose
  );

  // Keep the displayed progress in sync with the real progress: never move
  // backwards mid-run, reset when a new run starts, snap to 100 on completion.
  useEffect(() => {
    setDisplayProgress((prev) => {
      if (processing.progress >= prev) return processing.progress;
      return processing.progress <= 5 ? processing.progress : prev;
    });
  }, [processing.progress]);

  // Honest-feeling progress: if the real progress sits below 90 for ~1.5s,
  // creep the displayed value gradually toward 90 (capped) until completion.
  useEffect(() => {
    if (!isProcessing) return;

    let interval: ReturnType<typeof setInterval> | undefined;
    const delay = setTimeout(() => {
      interval = setInterval(() => {
        setDisplayProgress((prev) =>
          prev >= 90 ? prev : Math.min(90, prev + Math.max(0.4, (90 - prev) * 0.04))
        );
      }, 250);
    }, 1500);

    return () => {
      clearTimeout(delay);
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, processing.progress]);

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
  };

  if (!shouldRender) return null;

  const roundedProgress = Math.round(displayProgress);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="processing-modal-title"
        className="mx-auto mt-12 max-h-[calc(100dvh-4rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:mt-32 sm:max-h-[calc(100dvh-10rem)] sm:p-8"
      >
        {/* Error State */}
        {effectiveError && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-16 w-16 text-red-600" />
            <div className="text-center">
              <p id="processing-modal-title" className="text-lg font-semibold text-gray-900">{t('error')}</p>
              <p className="mt-2 text-sm text-gray-600">{effectiveError}</p>
            </div>
            <div className="flex w-full gap-3">
              {onRetry && (
                <button
                  onClick={handleRetry}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('retry')}
                </button>
              )}
              <button
                onClick={onClose}
                className={`${onRetry ? 'flex-1' : 'w-full'} rounded-lg bg-gray-900 px-4 py-2.5 text-white font-medium hover:bg-gray-800 transition-colors`}
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}

        {/* Processing State */}
        {isProcessing && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <div className="w-full">
              <p id="processing-modal-title" className="mb-2 text-center text-sm font-medium text-gray-700">
                {t('processing')}
              </p>
              <div
                role="progressbar"
                aria-valuenow={roundedProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
              >
                <div
                  className="h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
              <p className="mt-2 text-center text-xs text-gray-500">
                {roundedProgress}%
              </p>
            </div>
          </div>
        )}

        {/* Success State: download, or send it by email, in one step */}
        {isComplete && (
          <FileDeliveryPanel
            delivery={delivery}
            titleId="processing-modal-title"
            title={noticeTitle}
            notice={notice}
          />
        )}
      </div>
    </div>
  );
}
