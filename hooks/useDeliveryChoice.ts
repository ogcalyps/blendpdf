import { useState } from 'react';
import { useTranslations } from 'next-intl';

/** Files above this size must be downloaded directly — emailing them as base64 JSON is not viable. */
export const MAX_EMAIL_FILE_SIZE = 15 * 1024 * 1024; // 15MB

/**
 * Convert a Blob to base64 using chunked conversion (0x8000-byte slices).
 * Avoids the O(n^2) string concatenation of byte-by-byte reduce, which
 * freezes the tab on large files.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(i, i + CHUNK_SIZE))));
  }
  return btoa(chunks.join(''));
}

interface UseDeliveryChoiceOptions {
  fileBlob: Blob | null;
  filename: string;
  onDownload: () => void;
  onReset?: () => void;
}

export function useDeliveryChoice({ fileBlob, filename, onDownload, onReset }: UseDeliveryChoiceOptions) {
  const t = useTranslations('emailDelivery');
  const [showEmailCapture, setShowEmailCapture] = useState(false);
  const [showDeliveryChoice, setShowDeliveryChoice] = useState(false);
  const [capturedEmail, setCapturedEmail] = useState<string>('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [successType, setSuccessType] = useState<'email' | 'download' | null>(null);

  // Skip path: user declined to share an email — download directly, no email involved
  const handleSkipEmail = () => {
    setShowEmailCapture(false);
    setShowDeliveryChoice(false);
    onDownload();
  };

  const handleEmailCaptured = (email: string) => {
    if (!email) {
      // Legacy callers signal a skip with an empty email
      handleSkipEmail();
      return;
    }
    setCapturedEmail(email);
    setShowEmailCapture(false);
    setShowDeliveryChoice(true);
  };

  const handleSendViaEmail = async () => {
    if (!fileBlob || !capturedEmail) return;

    // Refuse email delivery for large files — direct download is the only sane path
    if (fileBlob.size > MAX_EMAIL_FILE_SIZE) {
      alert(t('tooLarge'));
      return;
    }

    setIsSendingEmail(true);

    try {
      const base64 = await blobToBase64(fileBlob);

      const response = await fetch('/api/send-file-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: capturedEmail,
          filename,
          fileData: base64,
          fileType: fileBlob.type || 'application/pdf',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || t('sendFailed'));
      }

      setIsSendingEmail(false);
      setSuccessType('email');

      setTimeout(() => {
        setSuccessType(null);
        setShowDeliveryChoice(false);
        if (onReset) onReset();
      }, 3000);
    } catch (error: any) {
      setIsSendingEmail(false);
      alert(error.message || t('sendFailed'));
    }
  };

  const handleDownloadDirectly = () => {
    onDownload();
    setSuccessType('download');
    setTimeout(() => {
      setSuccessType(null);
      setShowDeliveryChoice(false);
    }, 3000);
  };

  const triggerEmailCapture = () => {
    setShowEmailCapture(true);
  };

  const closeDeliveryChoice = () => {
    setShowDeliveryChoice(false);
  };

  return {
    showEmailCapture,
    showDeliveryChoice,
    capturedEmail,
    isSendingEmail,
    successType,
    handleEmailCaptured,
    handleSendViaEmail,
    handleDownloadDirectly,
    handleSkipEmail,
    closeDeliveryChoice,
    triggerEmailCapture,
  };
}
