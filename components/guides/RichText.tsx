import type { ReactNode } from 'react';

/** Guide text: **label** is a UI label, shown in bold. Nothing else is markup. */
export function RichText({ text }: { text: string }): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-gray-900">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** The same text without the markers, for meta tags and structured data. */
export const plainText = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '$1');
