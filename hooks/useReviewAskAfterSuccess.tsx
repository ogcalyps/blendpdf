'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { ReviewPrompt } from '@/components/ReviewPrompt';
import { inlineReviewAskAfterSuccess, shouldAskForReview, type InlineReviewAsk } from '@/lib/review-prompt';

/**
 * The Trustpilot review ask for tools that download straight away instead of
 * going through the FileDeliveryPanel success screen. Call markSuccess() once a
 * download has actually gone out, and render reviewAsk next to the download button.
 */
export function useReviewAskAfterSuccess(): { markSuccess: () => void; reviewAsk: ReactNode } {
  const [state, setState] = useState<InlineReviewAsk>('undecided');

  const markSuccess = useCallback(() => {
    // Read storage here, once per success, so a re-render never changes the decision
    const eligible = shouldAskForReview();
    setState((current) => inlineReviewAskAfterSuccess(current, eligible));
  }, []);

  const handleAction = useCallback(() => setState('acted'), []);

  const reviewAsk =
    state === 'asking' ? (
      <div className="mx-auto mt-6 w-full max-w-md">
        <ReviewPrompt onAction={handleAction} />
      </div>
    ) : null;

  return { markSuccess, reviewAsk };
}
