'use client';

/**
 * Crop (workspace-spec.md 4.6): a layer over the page that shades what the
 * crop hides, always (the canvas keeps drawing the whole page, so objects
 * outside the crop stay reachable), and, while the Crop tool is on, takes the
 * pointer: a drag draws what to keep, in fractions of the visual page before
 * the crop (EditorPage.crop). Below MIN_CROP_DRAG_PX (CropPDFPreview's
 * minimum) or MIN_CROP_PT either way, the visitor is told it's too small.
 *
 * CropPanel is the tool's side panel: what a drag applies to (this page, the
 * ticked pages, every page, with the same fractions on each, as crop-pdf
 * does), Remove crop, and the note that cropping only hides.
 */
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Crop, X } from 'lucide-react';
import { MIN_CROP_PT, type PagePoint, type PageSize, type VisualBox } from '@/lib/edit-pdf';
import { boxFromPoints, isDrag, pointerToFraction, type Rect } from './interaction';
import { cropShadeStyle } from './PageStrip';

/** A drawn crop narrower or shorter than this on screen (CSS px) is too small (CropPDFPreview). */
const MIN_CROP_DRAG_PX = 20;

export type CropTarget = 'page' | 'selected' | 'all';

interface CropLayerProps {
  /** The page's crop, if any. */
  crop: VisualBox | undefined;
  /** The Crop tool is on: the layer takes the pointer. */
  active: boolean;
  /** The visual page in points. */
  pageSize: PageSize;
  cssWidth: number;
  cssHeight: number;
  onCrop: (box: VisualBox) => void;
  onTooSmall: () => void;
}

export function CropLayer({ crop, active, pageSize, cssWidth, cssHeight, onCrop, onTooSmall }: CropLayerProps) {
  const [drag, setDrag] = useState<{ start: PagePoint; current: PagePoint; pointerId: number } | null>(null);
  const rectRef = useRef<Rect>({ left: 0, top: 0, width: 0, height: 0 });

  const toPoint = (e: ReactPointerEvent) => pointerToFraction(e.clientX, e.clientY, rectRef.current);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    rectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone.
    }
    const p = toPoint(e);
    setDrag({ start: p, current: p, pointerId: e.pointerId });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag({ ...drag, current: toPoint(e) });
  };

  const finish = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    setDrag(null);
    const end = toPoint(e);
    // A tap is not a crop.
    if (cancelled || !isDrag(drag.start, end, cssWidth, cssHeight)) return;
    const box = boxFromPoints(drag.start, end);
    const bigEnough =
      box.wPct * cssWidth >= MIN_CROP_DRAG_PX &&
      box.hPct * cssHeight >= MIN_CROP_DRAG_PX &&
      box.wPct * pageSize.width >= MIN_CROP_PT &&
      box.hPct * pageSize.height >= MIN_CROP_PT;
    if (bigEnough) onCrop(box);
    else onTooSmall();
  };

  const shown = drag ? boxFromPoints(drag.start, drag.current) : crop;
  if (!active && !shown) return null;

  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ pointerEvents: active ? 'auto' : 'none', touchAction: active ? 'none' : 'auto', cursor: active ? 'crosshair' : undefined }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      aria-hidden="true"
    >
      {shown && (
        <div
          className={`absolute ${active ? 'border-2 border-dashed border-[#FF6B35]' : 'border border-white/70'}`}
          style={cropShadeStyle(shown)}
        />
      )}
    </div>
  );
}

interface CropPanelProps {
  target: CropTarget;
  onTarget: (target: CropTarget) => void;
  selectedCount: number;
  /** The page on screen has a crop. */
  hasCrop: boolean;
  onRemove: () => void;
  onClose: () => void;
  onBlocked: (reason: string) => void;
}

export function CropPanel({ target, onTarget, selectedCount, hasCrop, onRemove, onClose, onBlocked }: CropPanelProps) {
  const t = useTranslations('workspace');
  const tCommon = useTranslations('common');
  const options: { value: CropTarget; label: string; blockedReason?: string }[] = [
    { value: 'page', label: t('crop.thisPage') },
    { value: 'selected', label: t('crop.selected'), blockedReason: selectedCount === 0 ? t('needs.selection') : undefined },
    { value: 'all', label: t('crop.all') },
  ];
  return (
    <section aria-label={t('crop.tool')} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Crop className="h-5 w-5 text-[#FF6B35]" aria-hidden="true" />
          {t('crop.tool')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={tCommon('dismiss')}
          className="-me-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-600">{t('crop.hint')}</p>

      <fieldset className="mt-3">
        <legend className="text-sm font-semibold text-gray-800">{t('crop.applyTo')}</legend>
        <div className="mt-1 space-y-0.5">
          {options.map((option) => {
            const blocked = option.blockedReason !== undefined;
            return (
              <label
                key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm ${
                  blocked ? 'text-gray-400' : 'text-gray-700 hover:bg-orange-50'
                }`}
              >
                <input
                  type="radio"
                  name="crop-target"
                  checked={target === option.value}
                  aria-disabled={blocked || undefined}
                  onChange={() => (blocked ? onBlocked(option.blockedReason!) : onTarget(option.value))}
                  className="h-4 w-4 accent-[#FF6B35]"
                />
                {option.label}
                {option.value === 'selected' && selectedCount > 0 && <span className="text-gray-500">({selectedCount})</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        aria-disabled={!hasCrop || undefined}
        onClick={() => (hasCrop ? onRemove() : onBlocked(t('needs.crop')))}
        className={`mt-2 min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
          hasCrop ? 'text-gray-700 hover:bg-red-50 hover:text-red-600' : 'cursor-not-allowed text-gray-300'
        }`}
      >
        {t('crop.remove')}
      </button>
      <p className="mt-2 text-xs text-gray-500">{t('crop.note')}</p>
    </section>
  );
}
