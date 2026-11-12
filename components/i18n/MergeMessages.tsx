'use client';

import { useMemo } from 'react';
import { NextIntlClientProvider, useLocale, useMessages, useTimeZone, type AbstractIntlMessages } from 'next-intl';

/**
 * Layers extra namespaces over the messages already in context. Only the extra
 * ones cross from the server, so the shared messages are not sent twice.
 */
export function MergeMessages({ messages, children }: { messages: AbstractIntlMessages; children: React.ReactNode }) {
  const inherited = useMessages();
  const locale = useLocale();
  const timeZone = useTimeZone();
  const merged = useMemo(() => ({ ...inherited, ...messages }), [inherited, messages]);

  return (
    <NextIntlClientProvider locale={locale} timeZone={timeZone} messages={merged}>
      {children}
    </NextIntlClientProvider>
  );
}
