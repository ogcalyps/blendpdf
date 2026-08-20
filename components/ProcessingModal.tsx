'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { XCircle, CheckCircle2, Loader2, Download, FileText, RefreshCw, Mail } from 'lucide-react';
import type { ToolType } from '@/types';
import { downloadBlob, formatFileSize } from '@/lib/utils';
import { useFileStore } from '@/store/use-file-store';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { blobToBase64, MAX_EMAIL_FILE_SIZE } from '@/hooks/useDeliveryChoice';
import { EmailCaptureModal } from './EmailCaptureModal';
import { DeliveryChoiceModal } from './DeliveryChoiceModal';

interface ProcessingModalProps {
  isOpen: boolean;
  progress: number;
  currentTool: ToolType | null;
  error: string | null;
  onClose: () => void;
  onRetry?: () => void;
}

type DownloadStatus = 'idle' | 'downloading' | 'completed';

export function ProcessingModal({
  isOpen,
  progress,
  currentTool,
  error,
  onClose,
  onRetry,
}: ProcessingModalProps) {
  const t = useTranslations('processing');
  const tEmailDelivery = useTranslations('emailDelivery');
  const { processing, resetProcessing } = useFileStore();
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [showDeliveryChoice, setShowDeliveryChoice] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [successType, setSuccessType] = useState<'email' | 'download' | null>(null);
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle');
  const [displayProgress, setDisplayProgress] = useState(0);

  // Surface errors even when the caller's isOpen expression collapses on failure
  // (pages compute isOpen from isProcessing/result, both falsy after setError).
  const effectiveError = error ?? processing.error;

  // Use processing.progress from store for consistency
  const isComplete = processing.progress === 100 && !effectiveError && processing.result !== null;
  const isProcessing = !effectiveError && processing.progress < 100 && processing.isProcessing;
  const shouldRender = isOpen || effectiveError !== null;
  // Only show main modal if it's visible AND sub-modals are closed
  const showMainModal = shouldRender && !showEmailCapture && !showDeliveryChoice;

  const dialogRef = useFocusTrap<HTMLDivElement>(
    showMainModal,
    isProcessing ? undefined : onClose
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

  // Reset transient state when the modal closes or processing resets
  useEffect(() => {
    if (!isOpen || !isComplete) {
      setDownloadStatus('idle');
    }
  }, [isOpen, isComplete]);

  const proceedWithDownload = () => {
    if (processing.result && processing.resultFilename) {
      setDownloadStatus('downloading');

      // Trigger download - downloadBlob infers MIME type from filename
      downloadBlob(processing.result, processing.resultFilename);

      // Show completion status briefly
      setDownloadStatus('completed');

      // Reset after a short delay
      setTimeout(() => {
        resetProcessing();
        onClose();
        setDownloadStatus('idle');
      }, 1500);
    }
  };

  // Secondary path: user explicitly asks for an email copy
  const handleEmailMeCopy = () => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('blendpdf_user_email');
      if (savedEmail) {
        setCapturedEmail(savedEmail);
        setShowDeliveryChoice(true);
        return;
      }
    }
    setShowEmailCapture(true);
  };

  const handleSkipEmailCapture = () => {
    setShowEmailCapture(false);
    proceedWithDownload();
  };

  const handleEmailCaptured = (email: string) => {
    if (!email) {
      handleSkipEmailCapture();
      return;
    }
    // After email is captured, show delivery choice
    setCapturedEmail(email);
    setShowEmailCapture(false);
    setShowDeliveryChoice(true);
  };

  const handleEmailSubmitted = () => {
    // Fallback: if no delivery choice, proceed with download
    setShowEmailCapture(false);
    proceedWithDownload();
  };

  const handleSendViaEmail = async () => {
    if (!processing.result || !processing.resultFilename || !capturedEmail) return;

    // Refuse email delivery for large files — direct download is the only sane path
    if (processing.result.size > MAX_EMAIL_FILE_SIZE) {
      alert(tEmailDelivery('tooLarge'));
      return;
    }

    setIsSendingEmail(true);

    try {
      // Convert blob to base64 in chunks (avoids O(n^2) string concatenation)
      const base64 = await blobToBase64(processing.result);

      const response = await fetch('/api/send-file-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: capturedEmail,
          filename: processing.resultFilename,
          fileData: base64,
          fileType: processing.result.type || 'application/pdf',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || tEmailDelivery('sendFailed'));
      }

      // Show success and close
      setIsSendingEmail(false);
      setSuccessType('email');

      setTimeout(() => {
        setSuccessType(null);
        resetProcessing();
        onClose();
        setShowDeliveryChoice(false);
      }, 3000);
    } catch (error: any) {
      setIsSendingEmail(false);
      alert(error.message || tEmailDelivery('sendFailed'));
    }
  };

  const handleDownloadDirectly = () => {
    if (processing.result && processing.resultFilename) {
      downloadBlob(processing.result, processing.resultFilename);
      setSuccessType('download');

      setTimeout(() => {
        setSuccessType(null);
        setShowDeliveryChoice(false);
        resetProcessing();
        onClose();
      }, 3000);
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
      setDownloadStatus('idle');
    }
  };

  if (!shouldRender) return null;

  // Get file size from blob if available
  const fileSize = processing.result ? formatFileSize(processing.result.size) : null;
  const resultTooLargeForEmail =
    processing.result !== null && processing.result.size > MAX_EMAIL_FILE_SIZE;
  const roundedProgress = Math.round(displayProgress);

  return (
    <>
      {showMainModal && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="processing-modal-title"
            className="max-w-md mx-auto mt-32 bg-white rounded-2xl p-8 shadow-2xl"
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

            {/* Success State */}
            {isComplete && downloadStatus === 'idle' && (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <div className="text-center">
                  <h3 id="processing-modal-title" className="text-lg font-semibold text-gray-900">{t('success')}</h3>
                  <p className="mt-2 text-sm text-gray-600">{t('readyToDownload')}</p>
                  {processing.resultFilename && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-500">
                      <FileText className="h-4 w-4" />
                      <span className="truncate max-w-[200px]">{processing.resultFilename}</span>
                      {fileSize && <span className="text-gray-400">• {fileSize}</span>}
                    </div>
                  )}
                </div>
                <div className="flex w-full flex-col gap-3">
                  <button
                    onClick={proceedWithDownload}
                    className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-coral flex items-center justify-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {t('download')}
                  </button>
                  <button
                    onClick={handleEmailMeCopy}
                    disabled={resultTooLargeForEmail}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    {t('emailMeCopy')}
                  </button>
                  {resultTooLargeForEmail && (
                    <p className="text-center text-xs text-amber-700">
                      {tEmailDelivery('tooLarge')}
                    </p>
                  )}
                  <button
                    onClick={onClose}
                    className="w-full text-center text-sm text-gray-500 transition-colors hover:text-gray-700"
                  >
                    {t('close')}
                  </button>
                </div>
              </div>
            )}

            {/* Downloading State */}
            {downloadStatus === 'downloading' && (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="text-center">
                  <p id="processing-modal-title" className="text-lg font-semibold text-gray-900">{t('downloading')}</p>
                  <p className="mt-2 text-sm text-gray-600">{t('preparingDownload')}</p>
                </div>
              </div>
            )}

            {/* Download Completed State */}
            {downloadStatus === 'completed' && (
              <div className="flex flex-col items-center gap-4">
                <CheckCircle2 className="h-16 w-16 text-green-600" />
                <div className="text-center">
                  <h3 id="processing-modal-title" className="text-lg font-semibold text-gray-900">{t('downloadComplete')}</h3>
                  <p className="mt-2 text-sm text-gray-600">{t('fileDownloaded')}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Capture Modal */}
      <EmailCaptureModal
        isOpen={showEmailCapture}
        onEmailSubmitted={handleEmailSubmitted}
        onEmailCaptured={handleEmailCaptured}
        onSkip={handleSkipEmailCapture}
      />

      {/* Delivery Choice Modal */}
      <DeliveryChoiceModal
        isOpen={showDeliveryChoice}
        email={capturedEmail}
        filename={processing.resultFilename || 'file.pdf'}
        fileBlob={processing.result}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
        onClose={() => setShowDeliveryChoice(false)}
      />
    </>
  );
}
