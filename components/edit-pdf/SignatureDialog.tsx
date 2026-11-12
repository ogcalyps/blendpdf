'use client';

/**
 * "Add your signature or stamp": the shared SignaturePad (draw, type or
 * upload; an upload on paper has its paper cleared) in a dialog. Place hands
 * the pad's PNG data URL to the workspace, which turns it into an image
 * object (trimmed to the ink) on the current page.
 *
 * Kept on this device (lib/saved-marks): ticking "Keep it on this device"
 * saves what is placed; the saved ones show first, one tap places one, and
 * each can be removed (a shared office computer).
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { SignaturePad } from '@/components/forms/SignaturePad';
import { Button } from '@/components/ui/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { loadSavedMarks, smallMark, storeSavedMarks, withMark, type SavedMark } from '@/lib/saved-marks';

interface SignatureDialogProps {
  /** The last signature placed in this session, offered again. */
  initialValue?: string;
  onCancel: () => void;
  onPlace: (dataUrl: string) => void;
}

export function SignatureDialog({ initialValue, onCancel, onPlace }: SignatureDialogProps) {
  const t = useTranslations('editPdf');
  const tCommon = useTranslations('common');
  const [value, setValue] = useState(initialValue ?? '');
  const [reason, setReason] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true, onCancel);
  const ready = value.startsWith('data:image');
  const [saved, setSaved] = useState<SavedMark[]>(() => loadSavedMarks());
  const [keep, setKeep] = useState(false);
  const forget = (id: string) => {
    const next = saved.filter((m) => m.id !== id);
    setSaved(next);
    storeSavedMarks(next);
  };
  // Placed at once; keeping it (a smaller copy) finishes after, and never holds the placing up
  const place = () => {
    if (keep) {
      const kept = saved;
      void smallMark(value)
        .then((small) => storeSavedMarks(withMark(kept, small, `m${Date.now().toString(36)}`)))
        .catch(() => undefined);
    }
    onPlace(value);
  };

  // Portalled so no ancestor's transform or filter can become the dialog's containing block.
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-pdf-signature-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="edit-pdf-signature-title" className="text-lg font-bold text-gray-900">
            {t('signatureDialog.title')}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label={tCommon('cancel')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {saved.length > 0 && (
          <section aria-labelledby="edit-pdf-saved-marks" className="mb-4 border-b border-gray-100 pb-4">
            <h3 id="edit-pdf-saved-marks" className="text-sm font-semibold text-gray-800">
              {t('signatureDialog.saved')}
            </h3>
            <ul className="mt-2 flex flex-wrap gap-3">
              {saved.map((mark) => (
                <li key={mark.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onPlace(mark.dataUrl)}
                    aria-label={t('signatureDialog.useSaved')}
                    title={t('signatureDialog.useSaved')}
                    className="flex h-16 w-28 items-center justify-center rounded-lg border border-gray-200 bg-white p-1.5 hover:border-[#FF6B35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mark.dataUrl} alt="" className="max-h-full max-w-full object-contain" />
                  </button>
                  <button
                    type="button"
                    onClick={() => forget(mark.id)}
                    aria-label={t('signatureDialog.forget')}
                    title={t('signatureDialog.forget')}
                    className="group absolute -end-4 -top-4 flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm group-hover:text-red-600 group-focus-visible:ring-2 group-focus-visible:ring-[#FF6B35]">
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* No second heading under the dialog's own: the pad's header row stays for its Clear button */}
        <SignaturePad
          title=""
          initialValue={initialValue}
          onSave={(dataUrl) => {
            setValue(dataUrl);
            setReason(false);
          }}
          onClear={() => setValue('')}
        />

        {reason && !ready && (
          <p className="mt-3 text-sm text-gray-500" role="status">
            {t('disabled.place')}
          </p>
        )}

        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="h-4 w-4 shrink-0 accent-[#FF6B35]" />
          {t('signatureDialog.keep')}
        </label>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" size="sm" className="min-h-11" onClick={onCancel}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            aria-disabled={!ready || undefined}
            className={`min-h-11 ${ready ? '' : 'cursor-not-allowed opacity-50 hover:scale-100! hover:bg-[#FF6B35]!'}`}
            onClick={() => (ready ? place() : setReason(true))}
          >
            {t('signatureDialog.place')}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
