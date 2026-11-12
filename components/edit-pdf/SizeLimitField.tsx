'use client';

/**
 * "Under [2] MB": the number for compress's size-limit choice, in the
 * compress-pdf task card and the Save dialog. Takes 1,5 and Arabic digits;
 * anything that isn't a number becomes NaN, which planProblems reports.
 */
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { formatLimitMb } from '@/lib/utils';

export const DEFAULT_LIMIT_MB = 2;

const ARABIC_DIGITS = /[٠-٩]/g;

export function parseLimitMb(draft: string): number {
  const ascii = draft.replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[,٫]/g, '.').trim();
  return /^\d+(\.\d+)?$/.test(ascii) ? Number(ascii) : Number.NaN;
}

export function SizeLimitField({
  value,
  onChange,
  onFocus,
}: {
  value: number | null;
  onChange: (mb: number) => void;
  /** Focusing the field picks the size-limit choice. */
  onFocus: () => void;
}) {
  const t = useTranslations('workspace');
  const locale = useLocale();
  const [draft, setDraft] = useState(() => formatLimitMb(value !== null && !Number.isNaN(value) ? value : DEFAULT_LIMIT_MB, locale));
  // Picking the choice again resets the plan to the default: show that, not the old draft
  const [seen, setSeen] = useState(value);
  if (!Object.is(value, seen)) {
    setSeen(value);
    if (value !== null && !Number.isNaN(value) && value !== parseLimitMb(draft)) setDraft(formatLimitMb(value, locale));
  }
  return (
    <span className="inline-flex items-center gap-2">
      {t('card.compress.limitBefore')}
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        aria-label={t('card.compress.limitLabel')}
        value={draft}
        onFocus={onFocus}
        onChange={(e) => {
          const next = e.target.value.slice(0, 6);
          setDraft(next);
          onChange(parseLimitMb(next));
        }}
        className="h-9 w-16 rounded-lg border border-gray-300 px-2 text-center text-sm focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30"
      />
      {t('card.compress.limitUnit')}
    </span>
  );
}
