'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { trackEvent, currentToolFromPath } from '@/lib/analytics';
import { TRUSTPILOT_REVIEW_URL, markReviewPromptShown, markReviewed } from '@/lib/review-prompt';

interface ReviewPromptProps {
  /** Called after the user acts on the ask, so the success screen can close. */
  onAction: () => void;
}

/**
 * Trustpilot review ask, rendered inside a success screen. Whether to render it
 * at all is decided by shouldAskForReview() in the component that owns the
 * screen, so the screen knows not to auto-close.
 */
export function ReviewPrompt({ onAction }: ReviewPromptProps) {
  const t = useTranslations('reviewPrompt');

  useEffect(() => {
    markReviewPromptShown();
    trackEvent('review_prompt_shown', { tool_name: currentToolFromPath() });
  }, []);

  const handleReview = () => {
    markReviewed('clicked');
    trackEvent('review_prompt_clicked', { tool_name: currentToolFromPath(), action: 'review' });
    onAction();
  };

  const handleAlreadyReviewed = () => {
    markReviewed('already');
    trackEvent('review_prompt_clicked', { tool_name: currentToolFromPath(), action: 'already' });
    onAction();
  };

  return (
    <div className="w-full rounded-xl border-2 border-orange-100 bg-orange-50 p-4 text-center">
      {/* A neutral icon, not stars: stars beside "Trustpilot" read as a rating we haven't earned */}
      <div className="mx-auto mb-2 w-fit rounded-full bg-orange-100 p-2" aria-hidden="true">
        <MessageSquare className="h-5 w-5 text-primary" />
      </div>
      <p className="text-base font-semibold text-gray-900">{t('title')}</p>
      <p className="mt-1 text-sm text-gray-600">{t('body')}</p>
      <a
        href={TRUSTPILOT_REVIEW_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleReview}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-coral"
        style={{ minHeight: '44px' }}
      >
        {t('cta')}
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        <span className="sr-only">{t('opensInNewTab')}</span>
      </a>
      <button
        type="button"
        onClick={handleAlreadyReviewed}
        className="mt-2 text-xs text-gray-500 underline underline-offset-2 transition-colors hover:text-gray-700"
      >
        {t('alreadyReviewed')}
      </button>
    </div>
  );
}
