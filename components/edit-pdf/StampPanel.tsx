'use client';

/**
 * The document stamps' panel (workspace-spec.md 4.7): the watermark (text or
 * image, position, see-through, size), the page numbers (position, format,
 * start, size) or the letterhead (top left, top right, logo, bottom line,
 * which pages; kept on this device and shared as a file by the workspace).
 * Beside the page on desktop, under it on a phone.
 *
 * The panel keeps a form; every change commits it as ONE setStamps (one
 * history entry): option clicks at once, the typed fields on blur or Enter.
 * A form the export couldn't draw (no text, no image yet) takes the stamp off
 * instead, so the primary button says what is missing.
 *
 * Page numbers are stored with a template in the visitor's language with
 * literal {n} and {total} (t(key, { n: '{n}', total: '{total}' })), so
 * "صفحة 3 من 12" is written in Arabic on /ar.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Hash, ImagePlus, PanelTop, Stamp, X } from 'lucide-react';
import {
  DEFAULT_PAGE_NUMBER_SIZE,
  DEFAULT_WATERMARK,
  LETTERHEAD_MAX_CHARS,
  PAGE_NUMBER_SIZE_MAX,
  PAGE_NUMBER_SIZE_MIN,
  WATERMARK_SIZE_MAX,
  WATERMARK_SIZE_MIN,
  letterheadHasContent,
  type DocStamps,
  type LetterheadStamp,
  type PageNumberFormat,
  type PageNumberStamp,
  type StampPosition,
  type WatermarkStamp,
} from '@/lib/edit-pdf';

const WATERMARK_SIZES = [12, 16, 20, 24, 32, 40, 48, 60, 72, 96, 120].filter((n) => n >= WATERMARK_SIZE_MIN && n <= WATERMARK_SIZE_MAX);
const PAGE_NUMBER_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36].filter((n) => n >= PAGE_NUMBER_SIZE_MIN && n <= PAGE_NUMBER_SIZE_MAX);
/** Opacity 1..0.1; shown as how see-through it is (0.3 opaque = 70% see-through). */
const OPACITIES = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
const POSITIONS: StampPosition[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
const FORMATS: PageNumberFormat[] = ['1', '1 / 10', 'Page 1', 'Page 1 of 10'];
const MAX_START = 99999;
/** The letterhead's text shows on the page this long after the last keystroke. */
const LETTERHEAD_TYPING_PAUSE_MS = 400;

/** The page number template for a format, in the visitor's language. */
export function usePageNumberTemplate(): (format: PageNumberFormat) => string {
  const t = useTranslations('workspace');
  return (format) => {
    switch (format) {
      case '1':
        return '{n}';
      case '1 / 10':
        return '{n} / {total}';
      case 'Page 1':
        return t('numbers.page', { n: '{n}' });
      default:
        return t('numbers.pageOf', { n: '{n}', total: '{total}' });
    }
  };
}

/** What the watermark and page numbers modes open with (parity with /watermark-pdf and /add-page-numbers). */
export function useDefaultStamps(): { watermark: () => WatermarkStamp; pageNumbers: () => PageNumberStamp } {
  const t = useTranslations('workspace');
  const template = usePageNumberTemplate();
  return {
    watermark: () => ({ ...DEFAULT_WATERMARK, text: t('watermark.defaultText') }),
    pageNumbers: () => ({ position: 'bottom-center', format: '1', template: template('1'), startFrom: 1, size: DEFAULT_PAGE_NUMBER_SIZE }),
  };
}

/** The export can draw it: text with something to write, or an image. */
const drawable = (w: WatermarkStamp) => (w.type === 'text' ? w.text.trim().length > 0 : !!w.assetId);

export const EMPTY_LETTERHEAD: LetterheadStamp = { left: '', right: '', footer: '', pages: 'all' };

interface StampPanelProps {
  kind: 'watermark' | 'numbers' | 'letterhead';
  stamps: DocStamps | undefined;
  onChange: (stamps: DocStamps) => void;
  /** Open the image picker; the chosen image becomes `form`'s image. */
  onChooseImage: (form: WatermarkStamp) => void;
  /** The chosen image, for the panel's thumbnail. */
  imageUrl?: string;
  /** Open the image picker; the chosen image becomes `form`'s logo. */
  onChooseLogo: (form: LetterheadStamp) => void;
  logoUrl?: string;
  /** The letterhead as a file to send to someone, and one received. */
  onSaveFile: () => void;
  onOpenFile: () => void;
  onClose: () => void;
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-gray-100 p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-11 flex-1 rounded-md px-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
            value === option.value ? 'bg-white text-[#E85A2B] shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children, id }: { label: string; children: ReactNode; id?: string }) {
  return (
    <div className="mt-3">
      {id ? (
        <label htmlFor={id} className="mb-1 block text-sm font-semibold text-gray-800">
          {label}
        </label>
      ) : (
        <p className="mb-1 text-sm font-semibold text-gray-800">{label}</p>
      )}
      {children}
    </div>
  );
}

const SELECT =
  'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30';

export function StampPanel({ kind, stamps, onChange, onChooseImage, imageUrl, onChooseLogo, logoUrl, onSaveFile, onOpenFile, onClose }: StampPanelProps) {
  const t = useTranslations('workspace');
  const tCommon = useTranslations('common');
  const tFormats = useTranslations('addPageNumbers');
  const template = usePageNumberTemplate();
  const defaults = useDefaultStamps();

  // ── Watermark form ──
  const [watermark, setWatermark] = useState<WatermarkStamp>(() => stamps?.watermark ?? defaults.watermark());
  // Undo, redo, an image chosen: the forms show what the doc has (adjusted while rendering, not in an effect).
  const stored = stamps?.watermark;
  const [seenWatermark, setSeenWatermark] = useState(stored);
  if (stored !== seenWatermark) {
    setSeenWatermark(stored);
    if (stored) setWatermark(stored);
  }
  const commitWatermark = (next: WatermarkStamp) => {
    setWatermark(next);
    onChange({ ...stamps, watermark: drawable(next) ? next : undefined });
  };

  // ── Page numbers form (Start at keeps a draft until blur or Enter) ──
  const [numbers, setNumbers] = useState<PageNumberStamp>(() => stamps?.pageNumbers ?? defaults.pageNumbers());
  const storedNumbers = stamps?.pageNumbers;
  const [startDraft, setStartDraft] = useState(String(numbers.startFrom));
  const [seenNumbers, setSeenNumbers] = useState(storedNumbers);
  if (storedNumbers !== seenNumbers) {
    setSeenNumbers(storedNumbers);
    if (storedNumbers) {
      setNumbers(storedNumbers);
      setStartDraft(String(storedNumbers.startFrom));
    }
  }
  const commitNumbers = (next: PageNumberStamp) => {
    setNumbers(next);
    onChange({ ...stamps, pageNumbers: next });
  };
  const commitStart = () => {
    const n = Number.parseInt(startDraft, 10);
    if (!Number.isInteger(n) || n < 1 || n > MAX_START) {
      setStartDraft(String(numbers.startFrom));
      return;
    }
    setStartDraft(String(n));
    if (n !== numbers.startFrom) commitNumbers({ ...numbers, startFrom: n });
  };

  // ── Letterhead form (the text fields keep a draft until blur) ──
  const [letterhead, setLetterhead] = useState<LetterheadStamp>(() => stamps?.letterhead ?? EMPTY_LETTERHEAD);
  const storedLetterhead = stamps?.letterhead;
  const [seenLetterhead, setSeenLetterhead] = useState(storedLetterhead);
  if (storedLetterhead !== seenLetterhead) {
    setSeenLetterhead(storedLetterhead);
    if (storedLetterhead) setLetterhead(storedLetterhead);
  }
  // The doc's stamps when a paused commit fires, not when it was scheduled
  const stampsRef = useRef(stamps);
  useEffect(() => {
    stampsRef.current = stamps;
  }, [stamps]);
  const commitLetterhead = (next: LetterheadStamp) => {
    window.clearTimeout(letterheadTimer.current);
    setLetterhead(next);
    onChange({ ...stampsRef.current, letterhead: letterheadHasContent(next) ? next : undefined });
  };
  // Typing shows on the page once the visitor pauses (one undo step per pause), and at once on leaving the field
  const letterheadTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(letterheadTimer.current), []);
  const typeLetterhead = (next: LetterheadStamp) => {
    setLetterhead(next);
    window.clearTimeout(letterheadTimer.current);
    letterheadTimer.current = window.setTimeout(() => commitLetterhead(next), LETTERHEAD_TYPING_PAUSE_MS);
  };
  const letterheadWords = {
    left: [t('letterhead.left'), t('letterhead.leftExample')],
    right: [t('letterhead.right'), t('letterhead.rightExample')],
    footer: [t('letterhead.footer'), t('letterhead.footerExample')],
  };
  const letterheadText = (field: 'left' | 'right' | 'footer', rows: number) => (
    <Field label={letterheadWords[field][0]} id={`stamp-letterhead-${field}`}>
      <textarea
        id={`stamp-letterhead-${field}`}
        dir="auto"
        rows={rows}
        value={letterhead[field]}
        maxLength={LETTERHEAD_MAX_CHARS}
        placeholder={letterheadWords[field][1]}
        onChange={(e) => typeLetterhead({ ...letterhead, [field]: e.target.value })}
        onBlur={(e) => commitLetterhead({ ...letterhead, [field]: e.target.value })}
        className={`${SELECT} py-2 leading-snug`}
      />
    </Field>
  );

  const positionLabel: Record<StampPosition, string> = {
    'top-left': t('numbers.topLeft'),
    'top-center': t('numbers.topCenter'),
    'top-right': t('numbers.topRight'),
    'bottom-left': t('numbers.bottomLeft'),
    'bottom-center': t('numbers.bottomCenter'),
    'bottom-right': t('numbers.bottomRight'),
  };
  const formatLabel: Record<PageNumberFormat, string> = {
    '1': tFormats('formats.number'),
    '1 / 10': tFormats('formats.numberOfTotal'),
    'Page 1': tFormats('formats.pageNumber'),
    'Page 1 of 10': tFormats('formats.pageOfTotal'),
  };

  const title = kind === 'watermark' ? t('watermark.title') : kind === 'numbers' ? t('numbers.title') : t('letterhead.title');
  const icon =
    kind === 'watermark' ? <Stamp className="h-5 w-5 text-[#FF6B35]" aria-hidden="true" /> : kind === 'numbers' ? <Hash className="h-5 w-5 text-[#FF6B35]" aria-hidden="true" /> : <PanelTop className="h-5 w-5 text-[#FF6B35]" aria-hidden="true" />;
  const LINK = 'min-h-11 rounded-lg px-2 text-sm font-medium text-[#E85A2B] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]';
  return (
    <section aria-label={title} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          {icon}
          {title}
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

      {kind === 'letterhead' ? (
        <>
          {letterheadText('left', 2)}
          {letterheadText('right', 2)}

          <Field label={t('letterhead.logo')}>
            <div className="flex flex-wrap items-center gap-3">
              {logoUrl && letterhead.logoAssetId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded border border-gray-200 object-contain" />
              )}
              <button
                type="button"
                onClick={() => onChooseLogo(letterhead)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-orange-200 px-3 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
              >
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
                {letterhead.logoAssetId ? t('letterhead.changeLogo') : t('letterhead.chooseLogo')}
              </button>
              {letterhead.logoAssetId && (
                <button type="button" onClick={() => commitLetterhead({ ...letterhead, logoAssetId: undefined })} className={LINK}>
                  {t('letterhead.removeLogo')}
                </button>
              )}
            </div>
          </Field>

          {letterheadText('footer', 2)}

          <Field label={t('letterhead.pages')}>
            <Segmented
              label={t('letterhead.pages')}
              value={letterhead.pages}
              options={[
                { value: 'all', label: t('letterhead.allPages') },
                { value: 'first', label: t('letterhead.firstPage') },
              ]}
              onChange={(pages) => commitLetterhead({ ...letterhead, pages })}
            />
          </Field>

          <button
            type="button"
            onClick={() => {
              onChange({ ...stamps, letterhead: undefined });
              onClose();
            }}
            className="mt-3 min-h-11 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            {t('letterhead.remove')}
          </button>

          <div className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">{t('letterhead.kept')}</p>
            <div className="mt-1 flex flex-wrap gap-x-2">
              {letterheadHasContent(letterhead) && (
                <button type="button" onClick={onSaveFile} className={LINK}>
                  {t('letterhead.saveFile')}
                </button>
              )}
              <button type="button" onClick={onOpenFile} className={LINK}>
                {t('letterhead.openFile')}
              </button>
            </div>
          </div>
        </>
      ) : kind === 'watermark' ? (
        <>
          <div className="mt-3">
            <Segmented
              label={t('watermark.title')}
              value={watermark.type}
              options={[
                { value: 'text', label: t('watermark.text') },
                { value: 'image', label: t('watermark.image') },
              ]}
              onChange={(type) => commitWatermark({ ...watermark, type })}
            />
          </div>

          {watermark.type === 'text' ? (
            <Field label={t('watermark.text')} id="stamp-watermark-text">
              <input
                id="stamp-watermark-text"
                type="text"
                dir="auto"
                value={watermark.text}
                maxLength={200}
                onChange={(e) => setWatermark({ ...watermark, text: e.target.value })}
                onBlur={() => commitWatermark(watermark)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitWatermark(watermark);
                  }
                }}
                className={SELECT}
              />
            </Field>
          ) : (
            <div className="mt-3 flex items-center gap-3">
              {imageUrl && watermark.assetId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="h-11 w-11 shrink-0 rounded border border-gray-200 object-contain" />
              )}
              <button
                type="button"
                onClick={() => onChooseImage(watermark)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-orange-200 px-3 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
              >
                <ImagePlus className="h-5 w-5" aria-hidden="true" />
                {t('watermark.chooseImage')}
              </button>
            </div>
          )}

          <Field label={t('watermark.position')}>
            <Segmented
              label={t('watermark.position')}
              value={watermark.position}
              options={[
                { value: 'center', label: t('watermark.center') },
                { value: 'diagonal', label: t('watermark.diagonal') },
                { value: 'tiled', label: t('watermark.tiled') },
              ]}
              onChange={(position) => commitWatermark({ ...watermark, position })}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('watermark.opacity')} id="stamp-watermark-opacity">
              <select
                id="stamp-watermark-opacity"
                value={watermark.opacity}
                onChange={(e) => commitWatermark({ ...watermark, opacity: Number(e.target.value) })}
                className={SELECT}
              >
                {OPACITIES.map((o) => (
                  <option key={o} value={o}>
                    {Math.round((1 - o) * 100)}%
                  </option>
                ))}
              </select>
            </Field>
            {watermark.type === 'text' && (
              <Field label={t('watermark.size')} id="stamp-watermark-size">
                <select
                  id="stamp-watermark-size"
                  value={watermark.size}
                  onChange={(e) => commitWatermark({ ...watermark, size: Number(e.target.value) })}
                  className={SELECT}
                >
                  {WATERMARK_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n} pt
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange({ ...stamps, watermark: undefined });
              onClose();
            }}
            className="mt-3 min-h-11 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            {t('watermark.remove')}
          </button>
        </>
      ) : (
        <>
          <Field label={t('numbers.position')}>
            {/* Laid out as the page is, left to right, in both languages */}
            <div role="radiogroup" aria-label={t('numbers.position')} dir="ltr" className="grid grid-cols-3 gap-1">
              {POSITIONS.map((position) => (
                <button
                  key={position}
                  type="button"
                  role="radio"
                  aria-checked={numbers.position === position}
                  aria-label={positionLabel[position]}
                  title={positionLabel[position]}
                  onClick={() => commitNumbers({ ...numbers, position })}
                  className={`flex min-h-11 items-center rounded-lg border px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
                    position.startsWith('top') ? 'items-start pt-1.5' : 'items-end pb-1.5'
                  } ${position.endsWith('left') ? 'justify-start' : position.endsWith('right') ? 'justify-end' : 'justify-center'} ${
                    numbers.position === position ? 'border-[#FF6B35] bg-orange-50' : 'border-gray-200 hover:border-[#FF8B68]'
                  }`}
                >
                  <span className={`block h-1.5 w-4 rounded-full ${numbers.position === position ? 'bg-[#FF6B35]' : 'bg-gray-300'}`} />
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('numbers.format')} id="stamp-numbers-format">
            <select
              id="stamp-numbers-format"
              value={numbers.format}
              onChange={(e) => {
                const format = e.target.value as PageNumberFormat;
                commitNumbers({ ...numbers, format, template: template(format) });
              }}
              className={SELECT}
            >
              {FORMATS.map((format) => (
                <option key={format} value={format}>
                  {formatLabel[format]}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t('numbers.start')} id="stamp-numbers-start">
              <input
                id="stamp-numbers-start"
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={startDraft}
                onChange={(e) => setStartDraft(e.target.value.replace(/[^\d]/g, '').slice(0, 5))}
                onBlur={commitStart}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitStart();
                  }
                }}
                className={SELECT}
              />
            </Field>
            <Field label={t('numbers.size')} id="stamp-numbers-size">
              <select
                id="stamp-numbers-size"
                value={numbers.size}
                onChange={(e) => commitNumbers({ ...numbers, size: Number(e.target.value) })}
                className={SELECT}
              >
                {PAGE_NUMBER_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} pt
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="button"
            onClick={() => {
              onChange({ ...stamps, pageNumbers: undefined });
              onClose();
            }}
            className="mt-3 min-h-11 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            {t('numbers.remove')}
          </button>
        </>
      )}
    </section>
  );
}
