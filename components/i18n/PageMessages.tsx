import { getLocale, getMessages } from 'next-intl/server';
import { pageClientMessages, type ToolNamespace } from '@/lib/i18n/client-messages';
import { MergeMessages } from './MergeMessages';

/** Adds a tool's own namespace to the client messages, on that tool's route only. */
export async function PageMessages({ namespace, children }: { namespace: ToolNamespace; children: React.ReactNode }) {
  const messages = await getMessages({ locale: await getLocale() });
  return <MergeMessages messages={pageClientMessages(messages, namespace)}>{children}</MergeMessages>;
}
