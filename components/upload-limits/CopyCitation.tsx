'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** The credit line, with a button that copies it. */
export function CopyCitation({ text, copy, copied }: { text: string; copy: string; copied: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="mt-4">
      <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-800">{text}</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(
            () => {
              setDone(true);
              window.setTimeout(() => setDone(false), 2000);
            },
            () => setDone(false),
          );
        }}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-orange-100 px-4 text-sm font-medium text-gray-700 hover:border-primary hover:text-primary"
      >
        {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        <span aria-live="polite">{done ? copied : copy}</span>
      </button>
    </div>
  );
}
