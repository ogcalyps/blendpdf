'use client';

/**
 * Fixes on open (workspace-spec.md 4.8), all through the shell's `fixes`
 * (the server's unlock, repair and OCR; tracked there, never here):
 *
 *  - FixPanel, instead of the editor, for a file it can't open yet: a
 *    password (type it, Unlock and open), restrictions (Remove
 *    restrictions), or a damaged file (Try to repair it). The fixed file
 *    then opens as the working source.
 *  - OcrBanner, above the toolbar, for a scan: languages, Make text
 *    searchable, Not now (on /ocr-pdf it is the page's tool and also offers
 *    to read the text again).
 *  - FixNotice: /unlock-pdf with a file that has nothing to unlock, and
 *    /repair-pdf with one that opens fine (Repair anyway).
 *  - FixFirstPrompt, above the toolbar, for a file the editor opened but
 *    pdf-lib can't write yet (restrictions only, or damaged): asked when a
 *    step needs it (a save that writes or uploads it, Edit text, Insert PDF,
 *    OCR), which then carries on with the fixed file.
 *
 * Errors come back as the server's ApiError (status, errorCode) and are said in the visitor's words here.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Eye, EyeOff, Info, Loader2, LockOpen, ScanText, Wrench, X } from 'lucide-react';
import type { OcrLanguage } from '@/lib/workspace/types';

export type FixKind = 'unlock' | 'repair' | 'ocr';

/** The server's answer, as lib/api-client's ApiError carries it. */
function serverCode(error: unknown): { status?: number; errorCode?: string } {
  const e = error as { status?: unknown; errorCode?: unknown } | null;
  return {
    status: typeof e?.status === 'number' ? e.status : undefined,
    errorCode: typeof e?.errorCode === 'string' ? e.errorCode : undefined,
  };
}

/** What to tell the visitor when a fix failed. `withPassword`: the unlock sent a password (UNLOCK_REJECTED = it was wrong). */
export function useFixErrorText(): (kind: FixKind, error: unknown, withPassword?: boolean) => string {
  const t = useTranslations('workspace');
  const tOcr = useTranslations('ocrPdf');
  return (kind, error, withPassword = false) => {
    const { status, errorCode } = serverCode(error);
    // Refused before the upload (lib/workspace/fixes: over the server's 50 MB)
    if (errorCode === 'tooBig') return t('save.errors.tooBig');
    if (kind === 'unlock' && withPassword && errorCode === 'UNLOCK_REJECTED') return t('fix.wrongPassword');
    if (kind === 'repair') return t('fix.repairFailed');
    if (kind === 'ocr') {
      if (errorCode === 'PAGE_LIMIT') return tOcr('errors.pageLimit');
      if (errorCode === 'ALREADY_HAS_TEXT') return tOcr('errors.alreadyHasText');
      // Retrying the same file would time out again: say to split it.
      if (errorCode === 'OCR_TIMEOUT') return tOcr('errors.timeout');
      if (errorCode === 'ENGINE_UNAVAILABLE') return tOcr('errors.engineUnavailable');
      if (errorCode === 'BUSY' || status === 429) return tOcr('errors.busy');
    }
    if (status === 429) return t('save.errors.busy');
    return t('fix.failed');
  };
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {text}
    </p>
  );
}

const PRIMARY =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#FF6B35] px-4 text-sm font-semibold text-white transition hover:bg-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2';
const QUIET =
  'inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]';

function Working() {
  const t = useTranslations('workspace');
  return (
    <>
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {t('fix.working')}
    </>
  );
}

// ── Before the editor: a file it can't open yet ───────────────────────────

interface FixPanelProps {
  variant: 'locked' | 'restricted' | 'broken';
  /** Run the fix (password only for 'locked') and open its result as the working source. */
  onFix: (password: string | null) => Promise<void>;
  onClose: () => void;
}

export function FixPanel({ variant, onFix, onClose }: FixPanelProps) {
  const t = useTranslations('workspace');
  const tEdit = useTranslations('editPdf');
  const tCommon = useTranslations('common');
  const errorText = useFixErrorText();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (busy) return;
    if (variant === 'locked' && !password) {
      setError(t('needs.password'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onFix(variant === 'locked' ? password : null);
    } catch (err) {
      console.warn('edit-pdf: the fix did not work', err);
      setError(errorText(variant === 'broken' ? 'repair' : 'unlock', err, variant === 'locked'));
      setBusy(false);
    }
  };

  const title = variant === 'locked' ? t('fix.lockedTitle') : variant === 'restricted' ? t('fix.restrictedTitle') : t('fix.brokenTitle');
  const body = variant === 'locked' ? t('fix.lockedBody') : variant === 'restricted' ? t('fix.restrictedBody') : t('fix.brokenBody');
  const action = variant === 'locked' ? t('fix.unlock') : variant === 'restricted' ? t('fix.removeRestrictions') : t('fix.repair');

  return (
    <div data-edit-pdf-workspace="" className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-600">{body}</p>
      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        {variant === 'locked' && (
          <div className="mb-3 flex items-center gap-1">
            <input
              type={showPassword ? 'text' : 'password'}
              aria-label={t('fix.passwordField')}
              placeholder={t('fix.passwordField')}
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" aria-busy={busy || undefined} className={`${PRIMARY} ${busy ? 'cursor-wait' : ''}`}>
            {busy ? <Working /> : action}
          </button>
          <button type="button" onClick={onClose} className={QUIET}>
            {tEdit('chooseAnother')}
          </button>
        </div>
      </form>
      <ErrorLine text={error} />
    </div>
  );
}

// ── In the editor: a fix the next step needs first ───────────────────────

interface FixFirstPromptProps {
  /** unlock: restrictions (an owner password) only; repair: pdf-lib can't read it. */
  kind: 'unlock' | 'repair';
  busy: boolean;
  error: string | null;
  onRun: () => void;
  onCancel: () => void;
}

export function FixFirstPrompt({ kind, busy, error, onRun, onCancel }: FixFirstPromptProps) {
  const t = useTranslations('workspace');
  const ref = useRef<HTMLElement>(null);
  // Asked from the phone's bottom bar too: bring it into view (clear of the sticky header and toolbar), on its button.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
  }, [kind]);
  const unlock = kind === 'unlock';
  const title = unlock ? t('fix.restrictedTitle') : t('fix.damagedTitle');
  return (
    <section ref={ref} aria-label={title} className="mb-2 scroll-mt-36 rounded-xl border border-amber-200 bg-amber-50/70 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        {unlock ? (
          <LockOpen className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        ) : (
          <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-700">{unlock ? t('fix.firstUnlockBody') : t('fix.firstRepairBody')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-busy={busy || undefined}
              onClick={() => !busy && onRun()}
              className={`${PRIMARY} ${busy ? 'cursor-wait' : ''}`}
            >
              {busy ? <Working /> : unlock ? t('fix.removeRestrictions') : t('fix.repair')}
            </button>
            <button type="button" onClick={onCancel} className={QUIET}>
              {t('fix.notNow')}
            </button>
          </div>
          <ErrorLine text={error} />
        </div>
      </div>
    </section>
  );
}

// ── In the editor: a scan ─────────────────────────────────────────────────

const LANGUAGES: OcrLanguage[] = ['ara', 'eng', 'fra', 'spa'];

/** eng, ara + eng on /ar, fra on /fr, spa on /es (ocr-pdf's defaults). */
export function defaultOcrLanguages(locale: string): OcrLanguage[] {
  if (locale === 'ar') return ['ara', 'eng'];
  if (locale === 'es') return ['spa'];
  return locale === 'fr' ? ['fra'] : ['eng'];
}

interface OcrBannerProps {
  /** /ocr-pdf: the page's tool, with the redo option. */
  expanded: boolean;
  /** The file has no text layer. Opened from All tools on a file that has one, it says "make searchable", not "this looks like a scan". */
  scanned: boolean;
  languages: readonly OcrLanguage[];
  onLanguages: (languages: OcrLanguage[]) => void;
  redo: boolean;
  onRedo: (redo: boolean) => void;
  /** Set when OCR can't run now (changed lines in the doc): why. */
  blockedReason?: string;
  busy: boolean;
  error: string | null;
  onRun: () => void;
  onDismiss: () => void;
  onBlocked: (reason: string) => void;
}

export function OcrBanner({ expanded, scanned, languages, onLanguages, redo, onRedo, blockedReason, busy, error, onRun, onDismiss, onBlocked }: OcrBannerProps) {
  const t = useTranslations('workspace');
  const tOcr = useTranslations('ocrPdf');
  const labels: Record<OcrLanguage, string> = {
    ara: tOcr('languages.arabic'),
    eng: tOcr('languages.english'),
    fra: tOcr('languages.french'),
    spa: tOcr('languages.spanish'),
  };
  // Fixed order keeps the server's language string canonical.
  const toggle = (lang: OcrLanguage, on: boolean) => {
    const next = LANGUAGES.filter((l) => (l === lang ? on : languages.includes(l)));
    if (next.length === 0) onBlocked(tOcr('languagesRequired'));
    else onLanguages(next);
  };
  const blocked = blockedReason !== undefined;
  return (
    <section
      aria-label={scanned ? t('fix.scannedTitle') : t('fix.ocrTitle')}
      className="mb-2 rounded-xl border border-sky-200 bg-sky-50/70 p-3 sm:p-4"
    >
      <div className="flex items-start gap-3">
        <ScanText className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-gray-900">{scanned ? t('fix.scannedTitle') : t('fix.ocrTitle')}</h2>
          <p className="text-sm text-gray-700">{scanned ? t('fix.scannedBody') : t('fix.ocrBody')}</p>
          <fieldset className="mt-2">
            <legend className="text-sm font-semibold text-gray-800">{t('fix.languages')}</legend>
            <div className="flex flex-wrap gap-x-1">
              {LANGUAGES.map((lang) => (
                <label key={lang} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-gray-800 hover:bg-sky-100">
                  <input
                    type="checkbox"
                    checked={languages.includes(lang)}
                    onChange={(e) => toggle(lang, e.target.checked)}
                    className="h-4 w-4 accent-[#FF6B35]"
                  />
                  {labels[lang]}
                </label>
              ))}
            </div>
          </fieldset>
          {expanded && (
            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-gray-800 hover:bg-sky-100">
              <input type="checkbox" checked={redo} onChange={(e) => onRedo(e.target.checked)} className="h-4 w-4 accent-[#FF6B35]" />
              {t('fix.redo')}
            </label>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-disabled={blocked || busy || undefined}
              aria-busy={busy || undefined}
              onClick={() => {
                if (busy) return;
                if (blocked) onBlocked(blockedReason);
                else onRun();
              }}
              className={`${PRIMARY} ${blocked ? 'cursor-not-allowed opacity-50 hover:bg-[#FF6B35]' : ''} ${busy ? 'cursor-wait' : ''}`}
            >
              {busy ? <Working /> : t('fix.ocr')}
            </button>
            {!expanded && (
              <button type="button" onClick={onDismiss} className={QUIET}>
                {t('fix.notNow')}
              </button>
            )}
          </div>
          {blocked && !error && <p className="mt-2 text-sm text-gray-600">{blockedReason}</p>}
          <ErrorLine text={error} />
        </div>
        {!expanded && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('fix.notNow')}
            className="-me-2 -mt-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>
    </section>
  );
}

// ── In the editor: nothing to fix ─────────────────────────────────────────

interface FixNoticeProps {
  kind: 'notLocked' | 'opensFine';
  /** opensFine: Repair anyway. */
  onRepair?: () => void;
  busy?: boolean;
  error?: string | null;
}

export function FixNotice({ kind, onRepair, busy = false, error = null }: FixNoticeProps) {
  const t = useTranslations('workspace');
  let action: ReactNode = null;
  if (kind === 'opensFine' && onRepair) {
    action = (
      <button type="button" aria-busy={busy || undefined} onClick={() => !busy && onRepair()} className={`${QUIET} gap-2 text-[#E85A2B]`}>
        {busy ? <Working /> : (
          <>
            <Wrench className="h-4 w-4" aria-hidden="true" />
            {t('fix.repairAnyway')}
          </>
        )}
      </button>
    );
  }
  return (
    <div className="mb-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-700">
        <Info className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
        <span className="flex-1">{kind === 'notLocked' ? t('fix.notLocked') : t('fix.opensFine')}</span>
        {action}
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-2 text-sm text-red-700" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
