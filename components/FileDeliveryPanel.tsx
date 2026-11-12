'use client';

import { useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { BadgeCheck, Check, CheckCircle2, Download, FileText, Loader2, Mail, Share2, UserPlus } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import type { FileDelivery } from '@/hooks/useFileDelivery';
import { ReviewPrompt } from './ReviewPrompt';
import { KeepWorking } from './KeepWorking';

export type NoticeTone = 'warn' | 'ok';

interface FileDeliveryPanelProps {
  delivery: FileDelivery;
  /** id for the heading, so the owning dialog can point aria-labelledby at it. */
  titleId: string;
  /** Replaces "Your file is ready", for runs that succeeded but did nothing. */
  title?: string | null;
  /** Explains an unusual but successful outcome. */
  notice?: string | null;
  /** ok: the notice is good news (a PDF/A that passed its check), shown in green. Default: a caution. */
  noticeTone?: NoticeTone;
  /** Once the file went out: fill the same form for someone else (the PDF editor, after a filled-in form). */
  onNextPerson?: () => void;
}

/** Keeps an address readable inside right-to-left text. */
const isolate = (text: string) => `⁨${text}⁩`;

/** The green tick both views open with. */
function DoneMark() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50" aria-hidden="true">
      <Check className="h-6 w-6 text-green-600" strokeWidth={2.5} />
    </div>
  );
}

/**
 * "Your file is ready": Download and an inline email row in one panel, so
 * getting the file by email is a single step. State lives in useFileDelivery.
 */
export function FileDeliveryPanel({ delivery, titleId, title, notice, noticeTone = 'warn', onNextPerson }: FileDeliveryPanelProps) {
  const t = useTranslations('fileDelivery');
  const tReview = useTranslations('reviewPrompt');
  const locale = useLocale();
  const { state, fileBlob, filename, isSending, finished, tooLarge } = delivery;
  const downloadRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const downloadedTitleRef = useRef<HTMLHeadingElement>(null);
  const showReview = finished && state.askForReview === true;

  // Land on Download when the panel appears
  useEffect(() => {
    downloadRef.current?.focus();
  }, []);

  // Move focus to what is still there: Send is disabled mid-send and gone once sent, and the
  // Download view has no Download button. With the review ask, start on Done rather than the
  // Trustpilot link, so a repeated Enter can't count as "reviewed".
  useEffect(() => {
    if (showReview) doneRef.current?.focus();
    else if (state.downloaded) downloadedTitleRef.current?.focus();
    else if (state.email === 'failed' || state.email === 'sent') downloadRef.current?.focus();
  }, [state.email, state.downloaded, showReview]);

  // Keyed so React keeps the same ReviewPrompt when the email view turns into the Download
  // view: a remount would log review_prompt_shown a second time
  const reviewBlock = showReview && (
    <div key="review" className="w-full">
      <ReviewPrompt onAction={delivery.finish} />
      <button
        ref={doneRef}
        type="button"
        onClick={delivery.finish}
        className="mt-3 w-full text-center text-sm text-gray-500 transition-colors hover:text-gray-700"
      >
        {tReview('done')}
      </button>
    </div>
  );

  // Only once this person's copy went out, so it never competes with Download or Send
  const nextPersonBlock = finished && onNextPerson && (
    <div className="w-full">
      <button
        type="button"
        onClick={() => {
          delivery.finish();
          onNextPerson();
        }}
        aria-describedby="file-delivery-next-person"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary bg-white px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-orange-50"
        style={{ minHeight: '48px' }}
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {t('nextPerson')}
      </button>
      <p id="file-delivery-next-person" className="mt-1.5 text-center text-xs text-gray-500">
        {t('nextPersonHint')}
      </p>
    </div>
  );

  if (state.downloaded) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <DoneMark />
        <div>
          <h2 id={titleId} ref={downloadedTitleRef} tabIndex={-1} className="text-lg font-semibold text-gray-900 outline-none">
            {t('downloadedTitle')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{t('downloadedBody')}</p>
        </div>
        {nextPersonBlock}
        <KeepWorking fileBlob={fileBlob} filename={filename} />
        {/* With Keep working on offer the panel no longer closes by itself, so it needs a way out */}
        {showReview ? (
          reviewBlock
        ) : (
          <button
            type="button"
            onClick={delivery.finish}
            className="w-full text-center text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            {t('close')}
          </button>
        )}
      </div>
    );
  }

  const emailDisabled = tooLarge || !fileBlob;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex w-full flex-col items-center text-center">
        <DoneMark />
        <h2 id={titleId} className="mt-3 text-xl font-semibold text-gray-900">
          {title || t('title')}
        </h2>
        {notice &&
          (noticeTone === 'ok' ? (
            <p className="mt-3 flex w-full items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-start text-sm text-green-800">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden="true" />
              <span>{notice}</span>
            </p>
          ) : (
            <p className="mt-3 w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{notice}</p>
          ))}
        {filename && (
          // Filled in with our name, so most people just press Download; the extension stays as produced
          <div className="mt-5 w-full text-start">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <label htmlFor="file-delivery-name" className="text-sm font-medium text-gray-700">
                {t('nameLabel')}
              </label>
              {fileBlob && (
                <span id="file-delivery-size" className="text-xs text-gray-400">
                  {formatFileSize(fileBlob.size, locale)}
                </span>
              )}
            </div>
            <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300 focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary">
              <FileText className="ms-3 h-4 w-4 flex-shrink-0 self-center text-gray-400" aria-hidden="true" />
              <input
                id="file-delivery-name"
                type="text"
                dir="auto"
                autoComplete="off"
                spellCheck={false}
                value={delivery.name}
                onChange={(e) => delivery.setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') delivery.download();
                }}
                disabled={isSending}
                aria-describedby={fileBlob ? 'file-delivery-size' : undefined}
                className="min-w-0 flex-1 bg-transparent px-2 py-2.5 text-sm text-gray-900 outline-none disabled:opacity-60"
              />
              {delivery.extension && (
                // Attached to the name, so it reads as the end of it rather than floating apart
                <span className="flex flex-shrink-0 items-center border-s border-gray-200 bg-gray-50 px-3 text-sm text-gray-500" dir="ltr">{delivery.extension}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-2">
        {/* Enabled even mid-send (the file is already in the browser); only a missing file disables it */}
        <button
          ref={downloadRef}
          type="button"
          onClick={delivery.download}
          disabled={!fileBlob}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-coral disabled:cursor-not-allowed disabled:opacity-50"
          style={{ minHeight: '48px' }}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          {t('download')}
        </button>

        {/* Only where the browser can share files (most phones): no dead button on a desktop */}
        {delivery.shareable && (
          <button
            type="button"
            onClick={() => void delivery.share()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            style={{ minHeight: '48px' }}
          >
            <Share2 className="h-4 w-4" aria-hidden="true" />
            {t('share')}
          </button>
        )}
      </div>

      {state.email === 'sent' && state.sentTo ? (
        <div role="status" className="w-full rounded-lg border border-green-200 bg-green-50 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-semibold text-green-800">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t('sentTitle')}
          </p>
          <p className="mt-1 text-sm text-gray-700">{t('sentTo', { email: isolate(state.sentTo) })}</p>
          <p className="mt-2 text-xs text-gray-500">{t('spamHint')}</p>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void delivery.send();
          }}
          className="w-full space-y-3"
        >
          <div>
            <label htmlFor="file-delivery-email" className="mb-1.5 block text-sm text-gray-600">
              {t('orEmail')}
            </label>
            {/* One row, field and Send together: still a single step, without a second full-width button */}
            <div
              className={`flex items-stretch overflow-hidden rounded-lg border focus-within:border-transparent focus-within:ring-2 focus-within:ring-primary ${
                delivery.invalidEmail ? 'border-red-300' : 'border-gray-300'
              } ${emailDisabled ? 'bg-gray-50 opacity-60' : ''}`}
            >
              <input
                id="file-delivery-email"
                type="email"
                dir="ltr"
                autoComplete="email"
                value={delivery.email}
                onChange={(e) => delivery.setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                disabled={emailDisabled || isSending}
                aria-invalid={delivery.invalidEmail || undefined}
                aria-describedby={
                  delivery.invalidEmail ? 'file-delivery-email-error' : tooLarge ? 'file-delivery-too-large' : undefined
                }
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-gray-900 outline-none disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={emailDisabled || isSending || !delivery.email.trim()}
                className="flex flex-shrink-0 items-center gap-1.5 border-s border-gray-200 px-4 text-sm font-semibold text-primary transition-colors hover:bg-orange-50 focus-visible:bg-orange-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:hover:bg-gray-50"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Mail className="h-4 w-4" aria-hidden="true" />
                )}
                {isSending ? t('sending') : t('send')}
              </button>
            </div>
            {delivery.invalidEmail && (
              <p id="file-delivery-email-error" className="mt-1.5 text-sm text-red-600">
                {t('invalidEmail')}
              </p>
            )}
          </div>

          {delivery.showConsent && !emailDisabled && (
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="file-delivery-consent"
                checked={delivery.consent}
                onChange={(e) => delivery.setConsent(e.target.checked)}
                disabled={isSending}
                className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="file-delivery-consent" className="text-xs text-gray-600">
                {t('consent')}
              </label>
            </div>
          )}

          {tooLarge && (
            <p id="file-delivery-too-large" className="text-center text-xs text-amber-700">
              {t('tooLarge')}
            </p>
          )}

          {state.email === 'failed' && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-sm text-amber-800">
              {t('failed')}
            </p>
          )}
        </form>
      )}

      {nextPersonBlock}
      <KeepWorking fileBlob={fileBlob} filename={filename} />

      {showReview
        ? reviewBlock
        : (
          <button
            type="button"
            onClick={finished ? delivery.finish : delivery.dismiss}
            disabled={isSending}
            className="w-full text-center text-sm text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50"
          >
            {t('close')}
          </button>
        )}
    </div>
  );
}
