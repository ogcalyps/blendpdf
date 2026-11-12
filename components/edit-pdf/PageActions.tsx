'use client';

/**
 * Page navigation and page tools for the current page: previous / next,
 * "Page 3 of 12", rotate, move earlier, move later, add a blank page after,
 * delete. Below the canvas on desktop, at the top of the Pages sheet on
 * phones. Controls that can't act stay tappable and say why.
 */
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FilePlus2, RotateCw, Trash2 } from 'lucide-react';

interface PageActionsProps {
  index: number;
  count: number;
  onGo: (delta: -1 | 1) => void;
  onRotate: () => void;
  onMove: (delta: -1 | 1) => void;
  onAddBlank: () => void;
  onDelete: () => void;
  /** A tap on a control that can't act: show this reason in the status line. */
  onBlocked: (reason: string) => void;
  /** Hide previous / next and the page count (the phone bottom bar has them). */
  hideNavigation?: boolean;
  /** Set when the page can't be turned (it holds a changed line): why. */
  rotateBlockedReason?: string;
}

interface ActionButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Set when the control can't act: why, shown on tap. */
  blockedReason?: string;
  onBlocked?: (reason: string) => void;
  danger?: boolean;
}

export function ActionButton({ label, icon, onClick, blockedReason, onBlocked, danger }: ActionButtonProps) {
  const blocked = blockedReason !== undefined;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-disabled={blocked || undefined}
      onClick={() => (blocked ? onBlocked?.(blockedReason) : onClick())}
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-lg px-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
        blocked
          ? 'cursor-not-allowed text-gray-300'
          : danger
            ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
            : 'text-gray-700 hover:bg-orange-50 hover:text-[#E85A2B]'
      }`}
    >
      {icon}
    </button>
  );
}

export function PageActions({
  index,
  count,
  onGo,
  onRotate,
  onMove,
  onAddBlank,
  onDelete,
  onBlocked,
  hideNavigation,
  rotateBlockedReason,
}: PageActionsProps) {
  const t = useTranslations('editPdf');
  const first = index <= 0;
  const last = index >= count - 1;
  // Arrows follow the reading direction; in RTL the CSS flips the row, so flip the icons too.
  const flip = 'rtl:-scale-x-100';

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
      {!hideNavigation && (
        <div className="flex items-center gap-1">
          <ActionButton
            label={t('pages.prev')}
            icon={<ChevronLeft className={`h-5 w-5 ${flip}`} />}
            onClick={() => onGo(-1)}
            blockedReason={first ? t('disabled.moveEarlier') : undefined}
            onBlocked={onBlocked}
          />
          <span className="min-w-[7rem] text-center text-sm font-medium text-gray-700" aria-live="polite">
            {t('pages.pageOf', { current: index + 1, total: count })}
          </span>
          <ActionButton
            label={t('pages.next')}
            icon={<ChevronRight className={`h-5 w-5 ${flip}`} />}
            onClick={() => onGo(1)}
            blockedReason={last ? t('disabled.moveLater') : undefined}
            onBlocked={onBlocked}
          />
        </div>
      )}
      <div className="flex items-center gap-1">
        <ActionButton
          label={t('pages.rotate')}
          icon={<RotateCw className="h-5 w-5" />}
          onClick={onRotate}
          blockedReason={rotateBlockedReason}
          onBlocked={onBlocked}
        />
        <ActionButton
          label={t('pages.moveEarlier')}
          icon={<ChevronUp className="h-5 w-5" />}
          onClick={() => onMove(-1)}
          blockedReason={first ? t('disabled.moveEarlier') : undefined}
          onBlocked={onBlocked}
        />
        <ActionButton
          label={t('pages.moveLater')}
          icon={<ChevronDown className="h-5 w-5" />}
          onClick={() => onMove(1)}
          blockedReason={last ? t('disabled.moveLater') : undefined}
          onBlocked={onBlocked}
        />
        <ActionButton label={t('pages.addBlank')} icon={<FilePlus2 className="h-5 w-5" />} onClick={onAddBlank} />
        <ActionButton
          label={t('pages.delete')}
          icon={<Trash2 className="h-5 w-5" />}
          onClick={onDelete}
          blockedReason={count <= 1 ? t('disabled.deletePage') : undefined}
          onBlocked={onBlocked}
          danger
        />
      </div>
    </div>
  );
}
