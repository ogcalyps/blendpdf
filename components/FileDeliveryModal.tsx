'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useFileDelivery, type DeliveryOutcome } from '@/hooks/useFileDelivery';
import { FileDeliveryPanel, type NoticeTone } from './FileDeliveryPanel';

export interface FileDeliveryModalProps {
  isOpen: boolean;
  fileBlob: Blob | null;
  filename: string;
  onDownload: (filename: string) => void;
  /** Called with how the file went out, or null when the user closed without delivering. */
  onClose: (outcome: DeliveryOutcome | null) => void;
  /** Explains an unusual but successful outcome (e.g. "40% smaller"), shown in the panel. */
  notice?: string | null;
  /** ok shows the notice as good news (green); default a caution (amber). */
  noticeTone?: NoticeTone;
  /** Closed without delivering on a page that shows no result of its own: offer a way back. */
  parked?: boolean;
  onReopen?: () => void;
  /** The PDF editor is open: on phones its toolbar is pinned to the bottom, so the way back sits above it. */
  aboveEditorBar?: boolean;
  /** A filled-in form was saved: once it went out, offer to fill the same form for someone else. */
  onNextPerson?: () => void;
  /** Start the email field with the last address used (default true). */
  prefillEmail?: boolean;
}

/** The single delivery step for tool pages that keep the result on the page (via useDeliveryChoice). */
export function FileDeliveryModal(props: FileDeliveryModalProps) {
  // Mounted per opening, so every result starts from a clean panel
  if (props.isOpen) return <FileDeliveryDialog {...props} />;
  if (props.parked && props.fileBlob && props.onReopen) return <ReopenBar onReopen={props.onReopen} aboveEditorBar={props.aboveEditorBar} />;
  return null;
}

function FileDeliveryDialog({ fileBlob, filename, onDownload, onClose, notice, noticeTone, onNextPerson, prefillEmail }: FileDeliveryModalProps) {
  const delivery = useFileDelivery({
    fileBlob,
    filename,
    onDownload,
    onFinish: onClose,
    onDismiss: () => onClose(null),
    holdOpen: onNextPerson !== undefined,
    prefillEmail,
  });

  const dialogRef = useFocusTrap<HTMLDivElement>(
    true,
    delivery.isSending ? undefined : delivery.finished ? delivery.finish : delivery.dismiss
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-delivery-title"
        className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <FileDeliveryPanel delivery={delivery} titleId="file-delivery-title" notice={notice} noticeTone={noticeTone} onNextPerson={onNextPerson} />
      </div>
    </div>
  );
}

/**
 * Pinned to the bottom of the page so a result closed by mistake is one click
 * away, not a re-run. Over the editor on phones it clears the editor's own
 * bottom toolbar (z-40, rendered later): above it in both height and z-index.
 */
function ReopenBar({ onReopen, aboveEditorBar = false }: { onReopen: () => void; aboveEditorBar?: boolean }) {
  const t = useTranslations('fileDelivery');
  const place = aboveEditorBar ? 'bottom-32 z-[45] md:bottom-0' : 'bottom-0 z-40';
  return (
    <div className={`pointer-events-none fixed inset-x-0 ${place} flex justify-center p-4`}>
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl"
      >
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" aria-hidden="true" />
        <p className="flex-1 text-sm font-medium text-gray-900">{t('title')}</p>
        <button
          type="button"
          onClick={onReopen}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-coral"
        >
          {t('reopen')}
        </button>
      </div>
    </div>
  );
}
