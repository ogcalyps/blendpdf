'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { idCopyText } from '@/lib/id-copy';

interface IdCopyWorkspaceProps {
  whoLabel: string;
  whoPlaceholder: string;
  whatLabel: string;
  whatPlaceholder: string;
  preview: string;
}

/**
 * The two answers, a live preview of the watermark they make, then the
 * watermark mode opened with it tiled across every page. Answers typed after
 * the PDF opens still reach the watermark, until the visitor changes its text
 * in the Watermark panel; from then on the panel holds the text.
 */
export function IdCopyWorkspace({ whoLabel, whoPlaceholder, whatLabel, whatPlaceholder, preview }: IdCopyWorkspaceProps) {
  const locale = useLocale();
  const [who, setWho] = useState('');
  const [what, setWhat] = useState('');
  const text = idCopyText(locale, who, what, new Date());
  const preset = useMemo(() => ({ type: 'text' as const, text, position: 'tiled' as const, opacity: 0.7, size: 20 }), [text]);

  return (
    <>
      <div className="px-4 pb-6">
        <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="id-copy-who" className="mb-1.5 block text-sm font-medium text-gray-700">
              {whoLabel}
            </label>
            <input
              id="id-copy-who"
              type="text"
              dir="auto"
              maxLength={60}
              value={who}
              onChange={(e) => setWho(e.target.value)}
              placeholder={whoPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label htmlFor="id-copy-what" className="mb-1.5 block text-sm font-medium text-gray-700">
              {whatLabel}
            </label>
            <input
              id="id-copy-what"
              type="text"
              dir="auto"
              maxLength={60}
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder={whatPlaceholder}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-transparent focus:ring-2 focus:ring-primary"
            />
          </div>
          <p className="text-sm text-gray-500 sm:col-span-2" aria-live="polite">
            {preview}{' '}{/* Today's date: the server's day can differ from the visitor's around midnight */}
            <span className="font-medium text-gray-800" dir="auto" suppressHydrationWarning>
              {text}
            </span>
          </p>
        </div>
      </div>
      <ToolWorkspace mode="watermark" watermarkPreset={preset} />
    </>
  );
}
