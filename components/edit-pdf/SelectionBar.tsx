'use client';

/**
 * What can be done to the ticked pages at once (workspace-spec.md 4.5),
 * shown while at least one is ticked: "3 pages selected", Select all, Clear,
 * Turn left, Turn right, Delete. Controls that can't act stay tappable and
 * say why (PageActions' ActionButton pattern).
 *
 * PageRangeField, in the All pages grid: "1-3, 5, 8-10" ticks those pages
 * (pagesFromRanges), and says what is wrong with anything else.
 */
import { useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { CheckSquare, RotateCcw, RotateCw, Trash2, X } from 'lucide-react';
import { pagesFromRanges } from './workspace-rules';

interface SelectionBarProps {
  count: number;
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  /** 1 = clockwise (Turn right), 3 = counter-clockwise (Turn left). */
  onTurn: (turns: 1 | 3) => void;
  onDelete: () => void;
  onBlocked: (reason: string) => void;
  /** Set when none of the ticked pages can be turned (they hold changed lines): why. */
  turnBlockedReason?: string;
}

function BarButton({
  label,
  icon,
  onClick,
  blockedReason,
  onBlocked,
  danger,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  blockedReason?: string;
  onBlocked: (reason: string) => void;
  danger?: boolean;
}) {
  const blocked = blockedReason !== undefined;
  return (
    <button
      type="button"
      title={label}
      aria-disabled={blocked || undefined}
      onClick={() => (blocked ? onBlocked(blockedReason) : onClick())}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
        blocked
          ? 'cursor-not-allowed text-gray-300'
          : danger
            ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
            : 'text-gray-700 hover:bg-orange-50 hover:text-[#E85A2B]'
      }`}
    >
      {icon}
      <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

export function SelectionBar({ count, total, onSelectAll, onClear, onTurn, onDelete, onBlocked, turnBlockedReason }: SelectionBarProps) {
  const t = useTranslations('workspace');
  const tEdit = useTranslations('editPdf');
  const icon = 'h-5 w-5 shrink-0';
  return (
    <div
      role="toolbar"
      aria-label={t('pages.selected', { count })}
      className="flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-xl border border-orange-200 bg-orange-50/80 px-2 py-0.5"
    >
      <span className="px-2 text-sm font-semibold text-gray-800" aria-live="polite">
        {t('pages.selected', { count })}
      </span>
      <BarButton label={t('pages.selectAll')} icon={<CheckSquare className={icon} />} onClick={onSelectAll} onBlocked={onBlocked} />
      <BarButton label={t('pages.clear')} icon={<X className={icon} />} onClick={onClear} onBlocked={onBlocked} />
      <span className="mx-1 hidden h-6 w-px bg-orange-200 sm:block" aria-hidden="true" />
      <BarButton
        label={t('pages.turnLeft')}
        icon={<RotateCcw className={icon} />}
        onClick={() => onTurn(3)}
        blockedReason={turnBlockedReason}
        onBlocked={onBlocked}
      />
      <BarButton
        label={t('pages.turnRight')}
        icon={<RotateCw className={icon} />}
        onClick={() => onTurn(1)}
        blockedReason={turnBlockedReason}
        onBlocked={onBlocked}
      />
      <BarButton
        label={t('pages.delete')}
        icon={<Trash2 className={icon} />}
        onClick={onDelete}
        blockedReason={count >= total ? tEdit('disabled.deletePage') : undefined}
        onBlocked={onBlocked}
        danger
      />
    </div>
  );
}

/** Tick pages by number: Enter or Select applies it (the selection is replaced). */
export function PageRangeField({ pageCount, onSelect }: { pageCount: number; onSelect: (indices: number[]) => void }) {
  const t = useTranslations('workspace');
  const id = useId();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const result = pagesFromRanges(value, pageCount);
    if ('indices' in result) {
      setError(null);
      onSelect(result.indices);
      return;
    }
    switch (result.problem) {
      case 'empty':
        setError(t('range.empty'));
        break;
      case 'format':
        setError(t('range.format', { part: result.part }));
        break;
      case 'reversed':
        setError(t('range.reversed', { part: result.part }));
        break;
      default:
        setError(t('range.outOfRange', { count: pageCount }));
    }
  };

  return (
    <form
      className="flex max-w-full flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
    >
      <label htmlFor={`${id}-pages`} className="text-sm text-gray-700">
        {t('range.label')}
      </label>
      <input
        id={`${id}-pages`}
        // Page numbers read left to right in both languages ("1-3", not "3-1")
        dir="ltr"
        inputMode="text"
        autoComplete="off"
        placeholder={t('range.placeholder')}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        className={`h-11 w-36 min-w-0 rounded-lg border px-3 text-sm focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 ${
          error ? 'border-red-300' : 'border-gray-300'
        }`}
      />
      <button
        type="submit"
        className="min-h-11 rounded-lg border border-orange-200 px-3 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
      >
        {t('range.apply')}
      </button>
      {error && (
        <p id={`${id}-error`} role="alert" className="w-full text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}
