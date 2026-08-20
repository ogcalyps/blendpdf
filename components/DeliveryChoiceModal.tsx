'use client';

import { useTranslations } from 'next-intl';
import { Mail, Download, Loader2, CheckCircle } from 'lucide-react';
import { trackEvent, currentToolFromPath } from '@/lib/analytics';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { MAX_EMAIL_FILE_SIZE } from '@/hooks/useDeliveryChoice';

interface DeliveryChoiceModalProps {
  isOpen: boolean;
  email: string;
  filename: string;
  fileBlob: Blob | null;
  onSendViaEmail: () => void;
  onDownloadDirectly: () => void;
  isSending?: boolean;
  successType?: 'email' | 'download' | null;
  onClose?: () => void; // Optional: enables Escape-to-close when it is safe to dismiss
}

export function DeliveryChoiceModal({
  isOpen,
  email,
  filename,
  fileBlob,
  onSendViaEmail,
  onDownloadDirectly,
  isSending = false,
  successType = null,
  onClose,
}: DeliveryChoiceModalProps) {
  const t = useTranslations('deliveryChoice');
  const tEmailDelivery = useTranslations('emailDelivery');

  const dialogRef = useFocusTrap<HTMLDivElement>(
    isOpen && !successType,
    onClose && !isSending ? onClose : undefined
  );

  if (!isOpen) return null;

  // Emailing very large files is refused — direct download is the only option
  const isTooLargeForEmail = fileBlob !== null && fileBlob.size > MAX_EMAIL_FILE_SIZE;

  if (successType) {
    const isEmailSuccess = successType === 'email';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delivery-choice-title"
          className="max-w-md w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '90vh' }}
        >
          <div className="p-8 flex flex-col items-center text-center">
            <div className="bg-green-100 rounded-full p-3 mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <h2 id="delivery-choice-title" className="text-2xl font-bold text-gray-900 mb-2">
              {isEmailSuccess ? t('successTitle') : t('downloadSuccessTitle')}
            </h2>
            <p className="text-gray-600">
              {isEmailSuccess
                ? t('successDescription', { email })
                : t('downloadSuccessDescription')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delivery-choice-title"
        className="max-w-md w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        <div className="p-8">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="bg-orange-100 rounded-full p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h2 id="delivery-choice-title" className="text-2xl font-bold text-gray-900">{t('title')}</h2>
              <p className="mt-2 text-sm text-gray-600">
                {t('description', { email })}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                trackEvent('delivery_choice', { tool_name: currentToolFromPath(), choice: 'email' });
                onSendViaEmail();
              }}
              disabled={isSending || !fileBlob || isTooLargeForEmail}
              className="w-full rounded-lg bg-[#FF6B35] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#FF8B68] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ minHeight: '48px' }}
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('sending')}
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {t('sendViaEmail')}
                </>
              )}
            </button>

            {isTooLargeForEmail && (
              <p className="text-xs text-center text-amber-700">
                {tEmailDelivery('tooLarge')}
              </p>
            )}

            <button
              onClick={() => {
                trackEvent('delivery_choice', { tool_name: currentToolFromPath(), choice: 'download' });
                onDownloadDirectly();
              }}
              disabled={isSending}
              className="w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ minHeight: '48px' }}
            >
              <Download className="h-4 w-4" />
              {t('downloadDirectly')}
            </button>
          </div>

          <p className="mt-4 text-xs text-center text-gray-500">
            {t('note')}
          </p>
        </div>
      </div>
    </div>
  );
}
