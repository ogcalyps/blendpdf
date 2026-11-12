/**
 * The home page drop zone starts one file. Dropping several used to say
 * "That file type isn't supported"; it now says one file starts here and
 * links to Merge PDF for several.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import type { FileRejection } from 'react-dropzone';
import { describe, expect, it, vi } from 'vitest';
import en from '../messages/en.json';
import ar from '../messages/ar.json';

// The component's locale-aware Link is built on next/navigation, which only resolves inside Next
vi.mock('@/i18n/routing', () => ({ Link: () => null, useRouter: () => ({ push() {} }) }));
const { startProblem } = await import('../components/HomeDropZone');

const pdf = (name = 'a.pdf') => new File(['%PDF'], name, { type: 'application/pdf' });
const rejection = (file: File, code: string): FileRejection => ({ file, errors: [{ code, message: code }] });

describe('home drop zone', () => {
  it('two PDFs at once: one file starts here, not "unsupported"', () => {
    const [a, b] = [pdf('a.pdf'), pdf('b.pdf')];
    expect(startProblem([], [rejection(a, 'too-many-files'), rejection(b, 'too-many-files')])).toBe('oneFile');
  });

  it('a type no tool takes is still unsupported; one PDF starts', () => {
    const zip = new File(['PK'], 'a.zip', { type: 'application/zip' });
    expect(startProblem([], [rejection(zip, 'file-invalid-type')])).toBe('unsupported');
    expect(startProblem([pdf()], [])).toBeNull();
  });

  it('says so in both locales, with Merge PDF as the link', () => {
    for (const [locale, messages] of [['en', en], ['ar', ar]] as const) {
      const t = createTranslator({ locale, messages, namespace: 'hero.start' });
      const linked: string[] = [];
      t.rich('oneFile', { link: (chunks) => (linked.push(String(chunks)), '') });
      expect(linked, locale).toEqual([messages.nav.tools.mergePdf.title]);
    }
    const src = readFileSync(join(__dirname, '..', 'components/HomeDropZone.tsx'), 'utf8');
    expect(src).toMatch(/t\.rich\('oneFile', \{\s*link: \(chunks\) => \(\s*<Link href="\/merge-pdf"/);
  });
});
