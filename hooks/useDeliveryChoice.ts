import { useCallback, useState } from 'react';
import type { FileDeliveryModalProps } from '@/components/FileDeliveryModal';
import type { DeliveryOutcome } from '@/hooks/useFileDelivery';

export { MAX_EMAIL_FILE_SIZE, blobToBase64 } from '@/lib/send-file-by-email';

interface UseDeliveryChoiceOptions {
  fileBlob: Blob | null;
  filename: string;
  /** Saves the file under the name from the panel (the visitor may have changed it). */
  onDownload: (filename: string) => void;
  /** Clears the page's result; runs only after the file went out by email. */
  onReset?: () => void;
  /**
   * For pages that never show the result themselves: after Close or Escape, keep a
   * small "Your file is ready" bar up so the file isn't lost (a re-run can mean a
   * server round trip).
   */
  offerReopen?: boolean;
}

/**
 * Opens the single "Your file is ready" step (FileDeliveryModal) for a tool page:
 *   const { openDelivery, deliveryModalProps } = useDeliveryChoice({ ... });
 *   <FileDeliveryModal {...deliveryModalProps} />
 */
export function useDeliveryChoice({ fileBlob, filename, onDownload, onReset, offerReopen = false }: UseDeliveryChoiceOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [parked, setParked] = useState(false);

  const openDelivery = useCallback(() => {
    setParked(false);
    setIsOpen(true);
  }, []);

  const onClose = (outcome: DeliveryOutcome | null) => {
    setIsOpen(false);
    setParked(offerReopen && outcome === null);
    // A downloader may want the file again, so only an emailed result clears the page
    if (outcome === 'email') onReset?.();
  };

  const deliveryModalProps: FileDeliveryModalProps = {
    isOpen,
    fileBlob,
    filename,
    onDownload,
    onClose,
    parked,
    onReopen: openDelivery,
  };

  return { openDelivery, deliveryModalProps };
}
