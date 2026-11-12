'use client';

/**
 * Under the toolbar: the page's own choices up front (taskCard in
 * workspace-rules), bound to the same plan as the primary button and the
 * Save dialog, and one line saying what the save gives (describeSave):
 *
 *  - split-pdf: one PDF per page (its default), every N pages, a PDF per
 *    group of selected pages, or the selected pages in one PDF;
 *  - extract-pages: which pages (by number too), in one PDF or one each;
 *  - protect-pdf: the password, shown or hidden;
 *  - compress-pdf: the level, each with what it does, or a size limit in MB;
 *    pdf-to-images: JPG or PNG; pdf-to-pdfa: the PDF/A level;
 *  - the converters and one-click pages: just what comes out.
 */
import { useId, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Eye, EyeOff, FileDown } from 'lucide-react';
import type { SaveDescription } from '@/lib/workspace/summary';
import type { CompressLevel, SavePlan } from '@/lib/workspace/types';
import { PDFA_LEVELS, pdfaLabel } from '@/lib/pdfa';
import { PageRangeField } from './SelectionBar';
import { DEFAULT_LIMIT_MB, SizeLimitField } from './SizeLimitField';
import { extractChoice, extractPatch, planUsesSelection, splitChoice, splitPatch, type SplitChoice, type TaskCard } from './workspace-rules';

interface ModeTaskCardProps {
  card: TaskCard;
  plan: SavePlan;
  onPlan: (plan: SavePlan) => void;
  /** describeSave of the plan. */
  result: SaveDescription;
  selectedCount: number;
  pageCount: number;
  /** Tick these 0-based pages (the selection is replaced). */
  onSelectPages: (indices: number[]) => void;
  /** Enter in the password field: what the primary button does. */
  onSubmit: () => void;
}

/** A file name inside a sentence of either direction stays one piece (FSI ... PDI). */
const isolate = (name: string) => `⁨${name}⁩`;

/** "You'll get report.docx, a Word document." */
function useResultText(): (d: SaveDescription, plan: SavePlan) => string {
  const t = useTranslations('workspace');
  return (d, plan) => {
    const name = isolate(d.filename);
    switch (d.format) {
      case 'pdf':
        return d.zipped ? t('card.result.pdfs', { name, count: d.files }) : t('card.result.pdf', { name });
      case 'word':
        return t('card.result.word', { name });
      case 'excel':
        return t('card.result.excel', { name });
      case 'text':
        return t('card.result.text', { name });
      case 'images':
        return d.zipped ? t('card.result.images', { name, count: d.files }) : t('card.result.image', { name });
      case 'imagesInside':
        return t('card.result.imagesInside', { name });
      case 'pdfa':
        return t('card.result.pdfa', { name, level: pdfaLabel(plan.pdfaLevel) });
    }
  };
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-gray-800 hover:bg-orange-50">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-[#FF6B35]" />
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function Legend({ children }: { children: ReactNode }) {
  return <legend className="px-2 text-sm font-semibold text-gray-900">{children}</legend>;
}

export function ModeTaskCard({ card, plan, onPlan, result, selectedCount, pageCount, onSelectPages, onSubmit }: ModeTaskCardProps) {
  const t = useTranslations('workspace');
  const tCommon = useTranslations('common');
  const resultText = useResultText();
  const name = useId();
  const [everyDraft, setEveryDraft] = useState(() => String(plan.split.kind === 'every' && plan.split.n > 1 ? plan.split.n : 2));
  const [showPassword, setShowPassword] = useState(false);
  const patch = (next: Partial<SavePlan>) => onPlan({ ...plan, ...next });
  const everyN = Number.parseInt(everyDraft, 10) || 0;

  // The pages a choice works on: by number here, or ticked in the grid
  const pagePicker = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pt-1">
      <PageRangeField pageCount={pageCount} onSelect={onSelectPages} />
      <span className="text-sm text-gray-600" aria-live="polite">
        {selectedCount > 0 ? t('pages.selected', { count: selectedCount }) : t('pages.tickHint')}
      </span>
    </div>
  );

  let choices: ReactNode = null;
  if (card === 'split') {
    const choice = splitChoice(plan);
    const pick = (next: SplitChoice) => patch(splitPatch(next, everyN));
    choices = (
      <fieldset>
        <Legend>{t('card.split.title')}</Legend>
        <div className="flex flex-wrap gap-x-2">
          <Radio name={name} checked={choice === 'perPage'} onChange={() => pick('perPage')}>
            {t('card.split.perPage')}
          </Radio>
          <Radio name={name} checked={choice === 'everyN'} onChange={() => pick('everyN')}>
            <span className="inline-flex flex-wrap items-center gap-2">
              {t('card.split.everyBefore')}
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                aria-label={`${t('card.split.everyBefore')} … ${t('card.split.everyAfter', { count: everyN })}`}
                value={everyDraft}
                onFocus={() => choice !== 'everyN' && pick('everyN')}
                onChange={(e) => {
                  const draft = e.target.value.replace(/[^\d]/g, '').slice(0, 5);
                  setEveryDraft(draft);
                  patch(splitPatch('everyN', Number.parseInt(draft, 10) || 0));
                }}
                className="h-11 w-16 rounded-lg border border-gray-300 px-2 text-center text-sm focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30"
              />
              {t('card.split.everyAfter', { count: everyN })}
            </span>
          </Radio>
          <Radio name={name} checked={choice === 'ranges'} onChange={() => pick('ranges')}>
            {t('card.split.ranges')}
          </Radio>
          <Radio name={name} checked={choice === 'selected'} onChange={() => pick('selected')}>
            {t('card.split.selected')}
          </Radio>
        </div>
        {planUsesSelection(plan) && pagePicker}
      </fieldset>
    );
  } else if (card === 'extract') {
    const choice = extractChoice(plan);
    choices = (
      <fieldset>
        <Legend>{t('card.extract.title')}</Legend>
        {pagePicker}
        <div className="flex flex-wrap gap-x-2">
          <Radio name={name} checked={choice === 'together'} onChange={() => patch(extractPatch('together'))}>
            {t('card.extract.together')}
          </Radio>
          <Radio name={name} checked={choice === 'each'} onChange={() => patch(extractPatch('each'))}>
            {t('card.extract.each')}
          </Radio>
        </div>
      </fieldset>
    );
  } else if (card === 'protect') {
    choices = (
      <div className="px-2">
        <label htmlFor={`${name}-password`} className="text-sm font-semibold text-gray-900">
          {t('card.protect.title')}
        </label>
        <div className="mt-1 flex max-w-sm items-center gap-1">
          <input
            id={`${name}-password`}
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            maxLength={128}
            placeholder={t('save.passwordField')}
            value={plan.password ?? ''}
            aria-describedby={`${name}-hint`}
            onChange={(e) => patch({ password: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onSubmit();
              }
            }}
            className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? tCommon('hidePassword') : tCommon('showPassword')}
            aria-pressed={showPassword}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
        <p id={`${name}-hint`} className="mt-1 text-xs text-gray-500">
          {t('card.protect.hint')}
        </p>
      </div>
    );
  } else if (card === 'compress') {
    const levels: { value: CompressLevel; label: string; hint: string }[] = [
      { value: 'medium', label: t('save.levelMedium'), hint: t('card.compress.medium') },
      { value: 'high', label: t('save.levelHigh'), hint: t('card.compress.high') },
      { value: 'low', label: t('save.levelLow'), hint: t('card.compress.low') },
    ];
    const pickLimit = () => patch({ compress: plan.compress ?? 'medium', compressLimitMb: DEFAULT_LIMIT_MB });
    choices = (
      <fieldset>
        <Legend>{t('card.compress.title')}</Legend>
        <div className="grid gap-x-2 sm:grid-cols-2">
          {levels.map((level) => (
            <Radio
              key={level.value}
              name={name}
              checked={plan.compressLimitMb === null && plan.compress === level.value}
              onChange={() => patch({ compress: level.value, compressLimitMb: null })}
            >
              <span className="block font-medium">{level.label}</span>
              <span className="block text-xs text-gray-500">{level.hint}</span>
            </Radio>
          ))}
          <Radio name={name} checked={plan.compressLimitMb !== null} onChange={pickLimit}>
            <span className="block font-medium">{t('card.compress.limit')}</span>
            <span className="block py-1">
              <SizeLimitField value={plan.compressLimitMb} onChange={(mb) => patch({ compressLimitMb: mb })} onFocus={() => plan.compressLimitMb === null && pickLimit()} />
            </span>
            <span className="block text-xs text-gray-500">{t('card.compress.limitHint')}</span>
          </Radio>
        </div>
      </fieldset>
    );
  } else if (card === 'pdfaLevel') {
    const hints = { '2b': t('card.pdfa.hint2b'), '1b': t('card.pdfa.hint1b'), '3b': t('card.pdfa.hint3b') };
    choices = (
      <fieldset>
        <Legend>{t('card.pdfa.title')}</Legend>
        <div className="grid gap-x-2 sm:grid-cols-3">
          {PDFA_LEVELS.map((level) => (
            <Radio key={level} name={name} checked={plan.pdfaLevel === level} onChange={() => patch({ pdfaLevel: level })}>
              <span className="block font-medium" dir="ltr">
                {pdfaLabel(level)}
              </span>
              <span className="block text-xs text-gray-500">{hints[level]}</span>
            </Radio>
          ))}
        </div>
      </fieldset>
    );
  } else if (card === 'imageType') {
    choices = (
      <fieldset>
        <Legend>{t('inline.imageType')}</Legend>
        <div className="flex flex-wrap gap-x-2">
          <Radio name={name} checked={plan.imageType === 'jpg'} onChange={() => patch({ imageType: 'jpg' })}>
            {t('save.jpg')}
          </Radio>
          <Radio name={name} checked={plan.imageType === 'png'} onChange={() => patch({ imageType: 'png' })}>
            {t('save.png')}
          </Radio>
        </div>
      </fieldset>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-orange-100 bg-white px-1 py-2">
      {choices}
      <p className={`flex items-start gap-2 px-2 text-sm text-gray-700 ${choices ? 'mt-1 border-t border-gray-100 pt-2' : ''}`} aria-live="polite">
        <FileDown className="mt-0.5 h-4 w-4 shrink-0 text-[#E85A2B]" aria-hidden="true" />
        <span>{resultText(result, plan)}</span>
      </p>
    </div>
  );
}
