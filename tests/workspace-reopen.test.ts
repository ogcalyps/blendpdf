/**
 * Every workspace save leaves a way back to its result once the delivery
 * panel is closed (offerReopen), and on phones that "Your file is ready" bar
 * sits above the editor's own bottom toolbar (fixed, z-40, rendered later in
 * the DOM), which would otherwise cover it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import { FileDeliveryModal, type FileDeliveryModalProps } from '../components/FileDeliveryModal';

// next-intl's client entry imports next/navigation, which only resolves inside Next: its hooks are use-intl's
vi.mock('next-intl', () => import('use-intl'));
// Keep working links through the locale-aware Link, built on next/navigation too
vi.mock('@/i18n/routing', async () => {
  const { createElement: h } = await import('react');
  return {
    Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => h('a', { href, ...rest }, children as never),
    usePathname: () => '/compress-pdf',
    useRouter: () => ({ push() {} }),
    redirect: () => undefined,
  };
});

const shell = readFileSync(join(__dirname, '..', 'components/workspace/ToolWorkspace.tsx'), 'utf8');

const parked = (over: Partial<FileDeliveryModalProps> = {}) =>
  renderToStaticMarkup(
    createElement(IntlProvider, {
      locale: 'en',
      messages: en,
      children: createElement(FileDeliveryModal, {
        isOpen: false,
        parked: true,
        fileBlob: new Blob(['%PDF']),
        filename: 'a.pdf',
        onDownload: () => undefined,
        onClose: () => undefined,
        onReopen: () => undefined,
        ...over,
      }),
    }),
  );

/** The classes of the bar's outer, fixed element. */
const barClasses = (html: string) => (/<div class="([^"]*\bfixed\b[^"]*)"/.exec(html)?.[1] ?? '').split(/\s+/);

describe('the way back to a workspace result', () => {
  it('is offered after every save, not only a converter\'s', () => {
    expect(shell).toMatch(/useDeliveryChoice\(\{[\s\S]*?\bofferReopen: true,/);
  });

  it('is lifted above the editor\'s bottom toolbar while the editor is open', () => {
    expect(shell).toMatch(/<FileDeliveryModal \{\.\.\.deliveryModalProps\}[^>]*\baboveEditorBar=\{files !== null\}/);
    const lifted = barClasses(parked({ aboveEditorBar: true }));
    expect(lifted).toEqual(expect.arrayContaining(['fixed', 'bottom-32', 'z-[45]', 'md:bottom-0']));
    expect(lifted).not.toContain('z-40');
  });

  it('stays at the bottom of the page otherwise', () => {
    const html = parked();
    expect(html).toContain(en.fileDelivery.reopen);
    expect(barClasses(html)).toEqual(expect.arrayContaining(['fixed', 'bottom-0', 'z-40']));
    expect(barClasses(html)).not.toContain('bottom-32');
  });
});
