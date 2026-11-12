'use client';

/**
 * "Save your file" (workspace-spec.md 4.9): what to get (cards) → which
 * pages → how many files (PDF) → extras → your changes, and a footer that
 * always shows what comes out (describeSave: the file name and count) and a
 * Save button that says the action. It edits a copy of the save plan; Save hands it back (the
 * primary button then reuses it). A choice that can't be picked says why
 * right under it (choiceProblems); Save says what stops it (planProblems).
 *
 * role="dialog" aria-modal: the editor's shortcuts pause while it is open.
 *
 * InlinePlanChoice: the one option compress-pdf and pdf-to-images are about
 * (the level, JPG or PNG), shown in the editor next to the primary button and
 * bound to the same plan.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  Check,
  Download,
  Eye,
  EyeOff,
  FileBadge,
  FileImage,
  FilePen,
  FileSpreadsheet,
  FileText,
  Images,
  LetterText,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import {
  choiceProblems,
  describePages,
  describeSave,
  maxEveryN,
  planProblems,
  saveButtonLabelKey,
  withFiles,
  withPages,
  type FilesChoice,
  type PlanContext,
  type PlanProblem,
  type SaveContext,
  type SaveDescription,
} from '@/lib/workspace/summary';
import type { CompressLevel, DocSummary, SaveFormat, SavePlan } from '@/lib/workspace/types';
import { PDFA_LEVELS, pdfaLabel } from '@/lib/pdfa';
import { ChangesPanel } from './ChangesPanel';
import { DEFAULT_LIMIT_MB, SizeLimitField } from './SizeLimitField';

/** The visitor's words for what stops a plan; undefined for 'onlyPdf', a notice that doesn't block. */
export function usePlanProblemText(): (problem: PlanProblem, plan: SavePlan, ctx: PlanContext) => string | undefined {
  const t = useTranslations('workspace');
  return (problem, plan, ctx) => {
    switch (problem) {
      case 'needsSelection':
        return t('save.needsSelection');
      case 'protectSplit':
        return t('save.protectSplit');
      case 'passwordEmpty':
        return t('needs.password');
      case 'nothingToDo':
        return t('needs.change');
      case 'runsNeedAll':
        return t('save.runsNeedAll');
      case 'everyN':
        return t('save.everyN', { max: maxEveryN(plan, ctx) });
      case 'sizeLimit':
        return t('save.sizeLimit');
      default:
        return undefined;
    }
  };
}

/**
 * saveButtonLabelKey names a full message key: the one message here whose key
 * is data, so the literal-key scan can't check it (tests/workspace-save-dialog
 * checks each one in both locales).
 */
function messageByKey(translate: ReturnType<typeof useTranslations>, key: string, values: Record<string, number>): string {
  return (translate as unknown as (key: string, values: Record<string, number>) => string)(key, values);
}

/** The Save button's words for what a save delivers ("Download 3 PDFs (ZIP)", "Convert to Word"). */
export function useSaveButtonLabel(): (d: SaveDescription) => string {
  const t = useTranslations();
  return (d) => {
    const { key, values } = saveButtonLabelKey(d);
    return messageByKey(t, key, values);
  };
}

interface SaveDialogProps {
  initialPlan: SavePlan;
  /** Protect PDF opens the dialog for its password. */
  focusPassword: boolean;
  ctx: PlanContext;
  /**
   * The names and the ticked pages for "You'll get" (describeSave). Optional
   * so the editor can pass it when ready: without it the names read
   * document.pdf and ranges count the selection from page 1.
   */
  saveContext?: SaveContext;
  summary: DocSummary;
  onClearCrops: () => void;
  onRemoveWatermark: () => void;
  onRemovePageNumbers: () => void;
  onRemoveLetterhead: () => void;
  onTurnBack: () => void;
  onSave: (plan: SavePlan) => void;
  onClose: () => void;
}

/** One radio or checkbox row. One that can't be picked says why under its label. */
function Choice({
  type,
  name,
  checked,
  label,
  hint,
  reason,
  onChange,
  children,
}: {
  type: 'radio' | 'checkbox';
  name?: string;
  checked: boolean;
  label: ReactNode;
  hint?: string;
  reason?: string;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) {
  const reasonId = useId();
  const blocked = reason !== undefined;
  return (
    <div>
      <label
        className={`flex min-h-11 items-center gap-3 rounded-lg px-2 py-1 text-sm ${
          blocked && !checked ? 'cursor-default text-gray-400' : 'cursor-pointer text-gray-800 hover:bg-orange-50'
        }`}
      >
        <input
          type={type}
          name={name}
          checked={checked}
          aria-disabled={blocked || undefined}
          aria-describedby={blocked ? reasonId : undefined}
          // Blocked: can't be picked, but one already on can still be turned off.
          onChange={(e) => (!blocked || checked) && onChange(e.target.checked)}
          className="h-4 w-4 shrink-0 accent-[#FF6B35]"
        />
        <span className="min-w-0 flex-1">
          <span className="block">{label}</span>
          {hint && <span className="block text-xs text-gray-500">{hint}</span>}
          {blocked && (
            <span id={reasonId} className="block text-xs text-gray-500">
              {reason}
            </span>
          )}
        </span>
      </label>
      {checked && children && <div className="ms-9 mb-1 space-y-1">{children}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-gray-100 pt-3">
      <legend className="mb-1 text-sm font-semibold text-gray-900">{title}</legend>
      <div className="space-y-0.5">{children}</div>
    </fieldset>
  );
}

/** A small segmented control; `value` null = none of them (the option is off). */
function Pills<T extends string>({ value, options, onChange, label }: { value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-gray-100 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
            value === o.value ? 'bg-white text-[#E85A2B] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** The page's own save option beside its primary button: the compression level, or JPG / PNG. */
export function InlinePlanChoice({
  kind,
  plan,
  onPlan,
  className = '',
}: {
  kind: 'compress' | 'imageType';
  plan: SavePlan;
  onPlan: (plan: SavePlan) => void;
  className?: string;
}) {
  const t = useTranslations('workspace');
  const label = kind === 'compress' ? t('inline.compress') : t('inline.imageType');
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-1 ${className}`}>
      <span className="text-sm font-medium text-gray-700" aria-hidden="true">
        {label}
      </span>
      {kind === 'compress' ? (
        <Pills
          label={label}
          value={plan.compress}
          options={[
            { value: 'medium', label: t('save.levelMedium') },
            { value: 'high', label: t('save.levelHigh') },
            { value: 'low', label: t('save.levelLow') },
          ]}
          onChange={(compress: CompressLevel) => onPlan({ ...plan, compress })}
        />
      ) : (
        <Pills
          label={label}
          value={plan.imageType}
          options={[
            { value: 'jpg', label: t('save.jpg') },
            { value: 'png', label: t('save.png') },
          ]}
          onChange={(imageType) => onPlan({ ...plan, imageType })}
        />
      )}
    </div>
  );
}

export function SaveDialog({ initialPlan, focusPassword, ctx, saveContext, summary, onClearCrops, onRemoveWatermark, onRemovePageNumbers, onRemoveLetterhead, onTurnBack, onSave, onClose }: SaveDialogProps) {
  const t = useTranslations('workspace');
  const tCommon = useTranslations('common');
  const problemText = usePlanProblemText();
  const buttonLabel = useSaveButtonLabel();
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const passwordRef = useRef<HTMLInputElement>(null);
  // After the trap's own first focus (its effect runs before this one): Protect PDF starts in the password field.
  useEffect(() => {
    if (focusPassword) passwordRef.current?.focus();
  }, [focusPassword]);
  const titleId = useId();
  const [plan, setPlan] = useState<SavePlan>(initialPlan);
  // "One PDF every [N] pages" holds what was typed; "One PDF per page" is the same split with N = 1.
  const initialEvery = initialPlan.split.kind === 'every' && initialPlan.split.n !== 1;
  const [everyBox, setEveryBox] = useState(initialEvery);
  const [everyDraft, setEveryDraft] = useState(String(initialEvery && initialPlan.split.kind === 'every' ? initialPlan.split.n : 2));
  const everyN = Number.parseInt(everyDraft, 10) || 0;
  const [showPassword, setShowPassword] = useState(false);

  const pdf = plan.format === 'pdf';
  const files: FilesChoice = plan.split.kind === 'none' ? 'one' : plan.split.kind === 'runs' ? 'runs' : everyBox ? 'every' : 'perPage';
  const pickFiles = (choice: FilesChoice) => {
    setEveryBox(choice === 'every');
    setPlan(withFiles(plan, choice, everyN));
  };

  const problems = planProblems(plan, ctx);
  const blocking = problems.map((p) => problemText(p, plan, ctx)).find((text) => text !== undefined);
  const unavailable = choiceProblems(plan, ctx);
  const selectFirst = t('export.selectFirst');
  const reason = {
    selectedPages: unavailable.selectedPages && selectFirst,
    alsoSelected: unavailable.alsoSelected && selectFirst,
    runs: unavailable.runs === 'needsSelection' ? selectFirst : unavailable.runs && t('export.notWithPassword'),
    perPage: unavailable.perPage && t('export.notWithPassword'),
    every: unavailable.every && t('export.notWithPassword'),
    password: unavailable.password && t('export.passwordNeedsOne'),
  };

  // What comes out, from the names and groups runSave uses.
  const describeCtx: SaveContext = saveContext ?? {
    pageCount: ctx.pages,
    selected: Array.from({ length: ctx.selected }, (_, i) => i),
    baseName: 'document',
    suffix: '',
    changed: ctx.changed,
  };
  const d = describeSave(plan, describeCtx);
  const pages = describePages(d, plan, describeCtx);
  const noPages = problems.includes('needsSelection');
  const fileName = (chunks: ReactNode) => <bdi className="font-semibold text-gray-900">{chunks}</bdi>;
  const youGet = (() => {
    const name = { filename: d.filename, name: fileName };
    switch (d.format) {
      case 'pdf':
        if (pages.also) return t.rich('export.get.pdfAlso', { ...name, count: pages.pages, list: pages.list });
        return d.zipped
          ? t.rich('export.get.pdfs', { ...name, files: d.files, list: pages.list })
          : t.rich('export.get.pdf', { ...name, count: pages.pages, list: pages.list });
      case 'word':
        return t.rich('export.get.word', name);
      case 'excel':
        return t.rich('export.get.excel', name);
      case 'images':
        return d.zipped
          ? t.rich('export.get.images', { ...name, count: d.files, type: plan.imageType.toUpperCase() })
          : t.rich('export.get.image', name);
      case 'text':
        return t.rich('export.get.text', name);
      case 'imagesInside':
        return t.rich('export.get.imagesInside', name);
      case 'pdfa':
        return t.rich('export.get.pdfa', { ...name, level: pdfaLabel(plan.pdfaLevel) });
    }
  })();
  const example = pages.also
    ? t('export.example.also', { count: pages.pages, list: pages.list })
    : t('export.example.files', { files: d.files, count: pages.pages, list: pages.list });
  const formats: { value: SaveFormat; icon: LucideIcon; title: string; text: string }[] = [
    { value: 'pdf', icon: FileText, title: t('export.format.pdf'), text: t('export.format.pdfHint') },
    { value: 'word', icon: FilePen, title: t('export.format.word'), text: t('export.format.wordHint') },
    { value: 'excel', icon: FileSpreadsheet, title: t('export.format.excel'), text: t('export.format.excelHint') },
    { value: 'images', icon: FileImage, title: t('export.format.images'), text: t('export.format.imagesHint') },
    { value: 'text', icon: LetterText, title: t('export.format.text'), text: t('export.format.textHint') },
    { value: 'imagesInside', icon: Images, title: t('export.format.imagesInside'), text: t('export.format.imagesInsideHint') },
    { value: 'pdfa', icon: FileBadge, title: t('export.format.pdfa'), text: t('export.format.pdfaHint') },
  ];
  const levels: { value: CompressLevel; label: string; hint: string }[] = [
    { value: 'medium', label: t('save.levelMedium'), hint: t('export.levelMediumHint') },
    { value: 'high', label: t('save.levelHigh'), hint: t('export.levelHighHint') },
    { value: 'low', label: t('save.levelLow'), hint: t('export.levelLowHint') },
  ];

  const pickLimit = () => setPlan({ ...plan, compress: plan.compress ?? 'medium', compressLimitMb: DEFAULT_LIMIT_MB });

  const save = () => {
    // What stops it is already on screen, above the button.
    if (!blocking) onSave(plan);
  };

  const flatten = (
    <Choice type="checkbox" checked={plan.flatten} label={t('export.flatten')} onChange={(on) => setPlan({ ...plan, flatten: on })} />
  );

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[92dvh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-2 px-4 pt-3 sm:px-5">
          <div className="min-w-0 pt-1.5">
            <h2 id={titleId} className="text-lg font-bold text-gray-900">
              {t('export.title')}
            </h2>
            <p className="text-sm text-gray-600">{t('export.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon('dismiss')}
            className="-me-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pt-3 pb-4 sm:px-5">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-gray-900">{t('export.getWhat')}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {formats.map((f) => {
                const checked = plan.format === f.value;
                return (
                  <div
                    key={f.value}
                    className={`flex flex-col rounded-xl border bg-white p-3 has-[>label>input:focus-visible]:ring-2 has-[>label>input:focus-visible]:ring-[#FF6B35] ${
                      checked ? 'border-[#FF6B35] shadow-sm' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <label className="flex min-h-11 flex-1 cursor-pointer flex-col items-start gap-1">
                      <input
                        type="radio"
                        name="save-format"
                        checked={checked}
                        onChange={() => setPlan({ ...plan, format: f.value })}
                        className="sr-only"
                      />
                      <span className="flex w-full items-center gap-2">
                        <f.icon className={`h-5 w-5 shrink-0 ${checked ? 'text-[#FF6B35]' : 'text-gray-500'}`} aria-hidden="true" />
                        <span className="text-sm font-semibold text-gray-900">{f.title}</span>
                        {checked && <Check className="ms-auto h-4 w-4 shrink-0 text-[#FF6B35]" aria-hidden="true" />}
                      </span>
                      <span className="text-xs leading-snug text-gray-600">{f.text}</span>
                    </label>
                    {checked && f.value === 'images' && (
                      <div className="mt-2">
                        <Pills
                          label={t('inline.imageType')}
                          value={plan.imageType}
                          options={[
                            { value: 'jpg', label: t('save.jpg') },
                            { value: 'png', label: t('save.png') },
                          ]}
                          onChange={(imageType) => setPlan({ ...plan, imageType })}
                        />
                      </div>
                    )}
                    {checked && f.value === 'pdfa' && (
                      <div className="mt-2" dir="ltr">
                        <Pills
                          label={t('card.pdfa.title')}
                          value={plan.pdfaLevel}
                          options={PDFA_LEVELS.map((level) => ({ value: level, label: level }))}
                          onChange={(pdfaLevel) => setPlan({ ...plan, pdfaLevel })}
                        />
                      </div>
                    )}
                    {checked && f.value === 'text' && (
                      <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs text-gray-800">
                        <input
                          type="checkbox"
                          checked={plan.pageSeparators}
                          onChange={(e) => setPlan({ ...plan, pageSeparators: e.target.checked })}
                          className="h-4 w-4 shrink-0 accent-[#FF6B35]"
                        />
                        {t('save.separators')}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* Every format: Word, the images and the text are made from the pages saved. */}
          <Section title={t('export.whichPages')}>
            <Choice type="radio" name="save-pages" checked={plan.pages === 'all'} label={t('export.allPages', { count: ctx.pages })} onChange={() => setPlan(withPages(plan, 'all'))} />
            <Choice
              type="radio"
              name="save-pages"
              checked={plan.pages === 'selected'}
              label={t('export.selectedPages', { count: ctx.selected })}
              reason={reason.selectedPages}
              onChange={() => setPlan(withPages(plan, 'selected'))}
            />
          </Section>

          {pdf && (
            <Section title={t('export.howManyFiles')}>
              <Choice type="radio" name="save-files" checked={files === 'one'} label={t('export.onePdf')} onChange={() => pickFiles('one')}>
                {plan.pages === 'all' && (
                  <Choice
                    type="checkbox"
                    checked={plan.alsoSelected}
                    label={t('save.alsoSelected')}
                    reason={reason.alsoSelected}
                    onChange={(alsoSelected) => setPlan({ ...plan, alsoSelected })}
                  />
                )}
                {!noPages && <Example text={example} />}
              </Choice>
              <Choice type="radio" name="save-files" checked={files === 'perPage'} label={t('export.perPage')} reason={reason.perPage} onChange={() => pickFiles('perPage')}>
                {!noPages && <Example text={example} />}
              </Choice>
              <Choice
                type="radio"
                name="save-files"
                checked={files === 'every'}
                reason={reason.every}
                label={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    {t('export.everyBefore')}
                    <input
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      aria-label={`${t('export.everyBefore')} … ${t('export.everyAfter', { count: everyN })}`}
                      value={everyDraft}
                      disabled={reason.every !== undefined}
                      onFocus={() => files !== 'every' && pickFiles('every')}
                      onChange={(e) => {
                        const draft = e.target.value.replace(/[^\d]/g, '').slice(0, 5);
                        setEveryDraft(draft);
                        setEveryBox(true);
                        setPlan(withFiles(plan, 'every', Number.parseInt(draft, 10) || 0));
                      }}
                      className="h-11 w-16 rounded-lg border border-gray-300 px-2 text-center text-sm focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30 disabled:bg-gray-50"
                    />
                    {t('export.everyAfter', { count: everyN })}
                  </span>
                }
                onChange={() => pickFiles('every')}
              >
                {problems.includes('everyN') ? (
                  <p className="text-xs font-medium text-amber-700">{t('save.everyN', { max: maxEveryN(plan, ctx) })}</p>
                ) : (
                  !noPages && <Example text={example} />
                )}
              </Choice>
              <Choice type="radio" name="save-files" checked={files === 'runs'} label={t('export.runs')} reason={reason.runs} onChange={() => pickFiles('runs')}>
                {!noPages && <Example text={example} />}
              </Choice>
            </Section>
          )}

          <Section title={t('export.extras')}>
            {pdf && (
              <>
                <Choice
                  type="checkbox"
                  checked={plan.compress !== null}
                  label={t('save.compress')}
                  onChange={(on) => setPlan({ ...plan, compress: on ? 'medium' : null, compressLimitMb: null })}
                >
                  {levels.map((level) => (
                    <Choice
                      key={level.value}
                      type="radio"
                      name="save-level"
                      checked={plan.compressLimitMb === null && plan.compress === level.value}
                      label={level.label}
                      hint={level.hint}
                      onChange={() => setPlan({ ...plan, compress: level.value, compressLimitMb: null })}
                    />
                  ))}
                  <Choice
                    type="radio"
                    name="save-level"
                    checked={plan.compressLimitMb !== null}
                    label={t('card.compress.limit')}
                    hint={t('card.compress.limitHint')}
                    onChange={pickLimit}
                  >
                    <SizeLimitField
                      value={plan.compressLimitMb}
                      onChange={(mb) => setPlan({ ...plan, compressLimitMb: mb })}
                      onFocus={() => plan.compressLimitMb === null && pickLimit()}
                    />
                  </Choice>
                </Choice>
                <Choice
                  type="checkbox"
                  checked={plan.password !== null}
                  label={t('export.password')}
                  reason={plan.password === null ? reason.password : undefined}
                  onChange={(on) => setPlan({ ...plan, password: on ? '' : null })}
                >
                  <div className="flex items-center gap-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      aria-label={t('save.passwordField')}
                      placeholder={t('save.passwordField')}
                      autoComplete="new-password"
                      maxLength={128}
                      ref={passwordRef}
                      value={plan.password ?? ''}
                      onChange={(e) => setPlan({ ...plan, password: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          save();
                        }
                      }}
                      className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? tCommon('hidePassword') : tCommon('showPassword')}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </Choice>
                <Choice type="checkbox" checked={plan.removeMetadata} label={t('export.metadata')} onChange={(removeMetadata) => setPlan({ ...plan, removeMetadata })} />
              </>
            )}
            {flatten}
          </Section>

          <ChangesPanel
            summary={summary}
            onClearCrops={onClearCrops}
            onRemoveWatermark={onRemoveWatermark}
            onRemovePageNumbers={onRemovePageNumbers}
            onRemoveLetterhead={onRemoveLetterhead}
            onTurnBack={onTurnBack}
          />
        </div>

        <div className="border-t border-gray-200 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          {!noPages && (
            <div className="text-sm text-gray-700 [overflow-wrap:anywhere]">
              <p className="text-xs font-medium text-gray-500">{t('export.youGet')}</p>
              <p>{youGet}</p>
            </div>
          )}
          <p role="status" aria-live="polite" className={blocking ? 'mt-2 text-sm font-medium text-amber-700' : 'sr-only'}>
            {blocking}
          </p>
          <button
            type="button"
            aria-disabled={blocking ? true : undefined}
            onClick={save}
            className={`mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B35] px-4 text-sm font-semibold text-white transition hover:bg-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2 ${
              blocking ? 'cursor-not-allowed opacity-50 hover:bg-[#FF6B35]' : ''
            }`}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {buttonLabel(d)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The live "3 PDFs: pages 1-2, 3-4, 5" under the chosen "How many files?". */
function Example({ text }: { text: string }) {
  return <p className="border-s-2 border-[#FF6B35] ps-2 text-xs font-medium text-gray-700">{text}</p>;
}
