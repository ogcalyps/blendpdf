/**
 * The "Your file is ready" panel lets the visitor rename the file before it
 * goes out: a field filled in with our name, the extension fixed. Whatever is
 * in the field is the name of the download and of the emailed attachment.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntlProvider } from 'use-intl';
import { describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import ar from '../messages/ar.json';
import { chosenFilename, splitFilename } from '../lib/file-delivery';
import { FileDeliveryModal } from '../components/FileDeliveryModal';

vi.mock('next-intl', () => import('use-intl'));
vi.mock('@/i18n/routing', async () => {
  const { createElement: h } = await import('react');
  return {
    Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => h('a', { href, ...rest }, children as never),
    usePathname: () => '/pdf-to-word',
    useRouter: () => ({ push() {} }),
    redirect: () => undefined,
  };
});

const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

describe('the name a file goes out under', () => {
  it('splits off the extension the tool produced', () => {
    expect(splitFilename('Brochure été.docx')).toEqual({ base: 'Brochure été', extension: '.docx' });
    expect(splitFilename('Rapport.final.pdf')).toEqual({ base: 'Rapport.final', extension: '.pdf' });
    expect(splitFilename('README')).toEqual({ base: 'README', extension: '' });
    expect(splitFilename('.pdf')).toEqual({ base: '.pdf', extension: '' });
  });

  it('keeps the typed name with our extension, Arabic and accents included', () => {
    expect(chosenFilename('Contrat signé', 'Brochure.pdf')).toBe('Contrat signé.pdf');
    expect(chosenFilename('عقد العمل', 'document.docx')).toBe('عقد العمل.docx');
  });

  it('does not double an extension typed in the field', () => {
    expect(chosenFilename('Contrat.pdf', 'Brochure.pdf')).toBe('Contrat.pdf');
    expect(chosenFilename('Contrat.PDF', 'Brochure.pdf')).toBe('Contrat.pdf');
  });

  it('drops what file systems refuse, and keeps ours when nothing is left', () => {
    expect(chosenFilename('2026/11: devis "final"?', 'a.pdf')).toBe('2026 11 devis final.pdf');
    expect(chosenFilename('   ', 'Brochure.pdf')).toBe('Brochure.pdf');
    expect(chosenFilename('...', 'Brochure.pdf')).toBe('Brochure.pdf');
  });
});

describe('the name field in the panel', () => {
  const open = (filename: string) =>
    renderToStaticMarkup(
      createElement(IntlProvider, {
        locale: 'en',
        messages: en,
        children: createElement(FileDeliveryModal, {
          isOpen: true,
          fileBlob: new Blob(['%PDF']),
          filename,
          onDownload: () => undefined,
          onClose: () => undefined,
        }),
      }),
    );

  it('is labelled, filled in with our name, and shows the extension apart', () => {
    const html = open('Brochure été.pdf');
    expect(html).toContain(`<label for="file-delivery-name"`);
    expect(html).toContain(en.fileDelivery.nameLabel);
    expect(html).toMatch(/<input id="file-delivery-name"[^>]*value="Brochure été"/);
    expect(html).toContain('>.pdf</span>');
  });

  it('keeps email to one labelled row, the field with Send attached, and no heavy borders', () => {
    const html = open('Brochure été.pdf');
    expect(html).toMatch(/<label for="file-delivery-email"[^>]*>Or we can email it to you<\/label>/);
    // Field then Send inside the same row, nothing between them
    expect(html).toMatch(/<input id="file-delivery-email"[^>]*\/><button type="submit"[^>]*>(?:(?!<\/button>).)*Send<\/button><\/div>/);
    expect(read('components/FileDeliveryPanel.tsx')).not.toMatch(/\bborder-2\b/);
    for (const messages of [en, fr, ar]) expect(messages.fileDelivery.send.length, messages.fileDelivery.send).toBeLessThanOrEqual(10);
  });

  it('still opens on Download: the dialog keeps the focus the panel gives, not its first field', () => {
    expect(read('components/FileDeliveryPanel.tsx')).toMatch(/downloadRef\.current\?\.focus\(\)/);
    expect(read('hooks/useFocusTrap.ts')).toMatch(/if \(container\.contains\(document\.activeElement\)\) \{\s*\/\/ keep it\s*\} else if \(focusables\.length > 0\)/);
  });

  it('has its label in every locale', () => {
    for (const messages of [en, fr, ar]) expect(messages.fileDelivery.nameLabel).toBeTruthy();
  });

  it('is the name of the download and of the emailed file', () => {
    const hook = read('hooks/useFileDelivery.ts');
    expect(hook).toMatch(/onDownload\(savedName\)/);
    expect(hook).toMatch(/sendFileByEmail\(fileBlob, savedName, address\)/);
    // The workspace saves under the name it is handed, not the one it suggested
    expect(read('components/workspace/ToolWorkspace.tsx')).toMatch(/onDownload: \(filename\) => \{\s*if \(result\) downloadBlob\(result\.blob, filename\);/);
  });

  it('Images to PDF suggests the first picture\'s name, not "images.pdf" for everyone', () => {
    expect(read('app/[locale]/images-to-pdf/page.tsx')).toMatch(/splitFilename\(images\[0\]\.file\.name\)\.base/);
  });
});
