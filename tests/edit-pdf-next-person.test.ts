/**
 * Fill the same form for someone else (2026-11-06: one visitor filled the
 * same 9-page form nine times, re-uploading it and re-placing every box each
 * time):
 *   - planNextPerson empties every typed box in place, keeps a box that reads
 *     today's date, takes signatures off and remembers where they were, keeps
 *     everything else, and offers nothing when nothing was typed;
 *   - the reducer applies it as one undoable step;
 *   - the delivery panel offers it only once the file went out, and only when
 *     the editor passed it;
 *   - the shell stops prefilling the previous person's email address, and the
 *     editor keeps an emptied box when it is tapped and left empty.
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
import { editorReducer, initialEditorState, planNextPerson } from '@/components/edit-pdf/state';
import type { EditorObject, SourcePageInfo } from '@/lib/edit-pdf';
import type { FileDelivery } from '@/hooks/useFileDelivery';
import { initialDeliveryState, type DeliveryState } from '@/lib/file-delivery';

vi.mock('next-intl', () => import('use-intl'));
vi.mock('@/i18n/routing', async () => {
  const { createElement: h } = await import('react');
  return {
    Link: ({ href, children, ...rest }: { href: string; children?: unknown }) => h('a', { href, ...rest }, children as never),
    usePathname: () => '/edit-pdf',
    useRouter: () => ({ push() {} }),
    redirect: () => undefined,
  };
});

const { FileDeliveryPanel } = await import('@/components/FileDeliveryPanel');

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const A4: SourcePageInfo = { width: 595, height: 842, rotate: 0 };
const box = (xPct: number, yPct: number) => ({ xPct, yPct, wPct: 0.3, hPct: 0.03 });
const TODAY = '11 November 2026';

const text = (id: string, pageId: string, value: string, y = 0.1): EditorObject => ({
  id,
  pageId,
  kind: 'text',
  box: box(0.1, y),
  text: value,
  size: 12,
  color: '#000000',
});
const signature = (id: string, pageId: string, y: number): EditorObject => ({
  id,
  pageId,
  kind: 'image',
  box: box(0.5, y),
  assetId: `asset-${id}`,
  signature: true,
});
const picture: EditorObject = { id: 'logo', pageId: 's0', kind: 'image', box: box(0.7, 0.05), assetId: 'asset-logo' };
const cover: EditorObject = { id: 'cover', pageId: 's1', kind: 'cover', box: box(0.2, 0.5) };

const docWith = (objects: EditorObject[]) => {
  const state = initialEditorState([A4, A4, A4]);
  return { ...state, doc: { ...state.doc, objects } };
};

describe('planNextPerson', () => {
  const filled = docWith([
    text('name', 's1', 'Amina Otieno', 0.2),
    signature('sig-late', 's2', 0.8),
    text('date', 's0', TODAY, 0.9),
    picture,
    text('id', 's0', '12345678', 0.3),
    signature('sig-early', 's0', 0.7),
    cover,
  ]);

  it('empties every typed box in place and keeps the boxes that read today', () => {
    const plan = planNextPerson(filled.doc, new Set([TODAY]))!;
    const byId = new Map(plan.objects.map((o) => [o.id, o]));
    expect(byId.get('name')).toEqual({ ...filled.doc.objects[0], text: '' });
    expect(byId.get('id')).toMatchObject({ kind: 'text', text: '', box: box(0.1, 0.3) });
    expect(byId.get('date')).toBe(filled.doc.objects[2]);
  });

  it('takes signatures off and gives their places in page order', () => {
    const plan = planNextPerson(filled.doc, new Set([TODAY]))!;
    expect(plan.objects.some((o) => o.kind === 'image' && o.signature)).toBe(false);
    expect(plan.signatureSlots).toEqual([
      { pageId: 's0', box: box(0.5, 0.7) },
      { pageId: 's2', box: box(0.5, 0.8) },
    ]);
  });

  it('keeps everything else as it was, in the same order', () => {
    const plan = planNextPerson(filled.doc, new Set([TODAY]))!;
    expect(plan.objects.map((o) => o.id)).toEqual(['name', 'date', 'logo', 'id', 'cover']);
    expect(plan.objects.find((o) => o.id === 'logo')).toBe(picture);
    expect(plan.objects.find((o) => o.id === 'cover')).toBe(cover);
  });

  it('starts the visitor on the first emptied box in page order', () => {
    expect(planNextPerson(filled.doc, new Set([TODAY]))!.firstEmpty).toEqual({ pageId: 's0', id: 'id' });
  });

  it('offers nothing when nothing was typed: a document that was only signed or dated', () => {
    expect(planNextPerson(docWith([signature('s', 's0', 0.5), text('d', 's0', TODAY)]).doc, new Set([TODAY]))).toBeNull();
    expect(planNextPerson(docWith([text('blank', 's0', '   ')]).doc, new Set())).toBeNull();
    expect(planNextPerson(docWith([]).doc, new Set())).toBeNull();
  });

  it('is one undoable step in the editor', () => {
    const plan = planNextPerson(filled.doc, new Set([TODAY]))!;
    const selected = { ...filled, selectedId: 'name' };
    const next = editorReducer(selected, { type: 'nextPerson', objects: plan.objects });
    expect(next.doc.objects).toEqual(plan.objects);
    expect(next.selectedId).toBeNull();
    expect(next.past).toHaveLength(1);
    expect(editorReducer(next, { type: 'undo' }).doc.objects).toEqual(filled.doc.objects);
  });
});

const fakeDelivery = (state: Partial<DeliveryState>, finish = () => undefined): FileDelivery =>
  ({
    state: { ...initialDeliveryState, askForReview: false, ...state },
    fileBlob: new Blob(['%PDF']),
    filename: 'form.pdf',
    name: 'form',
    setName: () => undefined,
    extension: '.pdf',
    email: '',
    setEmail: () => undefined,
    consent: false,
    setConsent: () => undefined,
    showConsent: false,
    invalidEmail: false,
    tooLarge: false,
    isSending: false,
    finished: state.downloaded === true || state.email === 'sent',
    send: async () => undefined,
    download: () => undefined,
    shareable: false,
    share: async () => undefined,
    finish,
    dismiss: () => undefined,
  }) as unknown as FileDelivery;

const panel = (state: Partial<DeliveryState>, onNextPerson?: () => void) =>
  renderToStaticMarkup(
    createElement(IntlProvider, {
      locale: 'en',
      messages: en,
      children: createElement(FileDeliveryPanel, { delivery: fakeDelivery(state), titleId: 't', onNextPerson }),
    }),
  );

describe('the offer in the delivery panel', () => {
  const offer = en.fileDelivery.nextPerson;

  it('shows once the file was downloaded or emailed', () => {
    expect(panel({ downloaded: true }, () => undefined)).toContain(offer);
    expect(panel({ email: 'sent', sentTo: 'a@example.com' }, () => undefined)).toContain(offer);
    expect(panel({ downloaded: true }, () => undefined)).toContain(en.fileDelivery.nextPersonHint);
  });

  it('never competes with Download or Send before the file went out', () => {
    expect(panel({}, () => undefined)).not.toContain(offer);
  });

  it('shows only when the editor offered it (a filled-in form)', () => {
    expect(panel({ downloaded: true })).not.toContain(offer);
  });

  it('closes the panel before clearing the boxes, and keeps the panel open while it is on offer', () => {
    const src = read('components/FileDeliveryPanel.tsx');
    expect(src).toMatch(/delivery\.finish\(\);\s*onNextPerson\(\);/);
    expect(read('components/FileDeliveryModal.tsx')).toMatch(/holdOpen: onNextPerson !== undefined/);
  });

  it('has its words in every language', () => {
    for (const messages of [en, fr, ar]) {
      expect(messages.fileDelivery.nextPerson.trim()).not.toBe('');
      expect(messages.fileDelivery.nextPersonHint.trim()).not.toBe('');
    }
    expect(fr.fileDelivery.nextPerson).not.toBe(en.fileDelivery.nextPerson);
    expect(ar.fileDelivery.nextPerson).not.toBe(en.fileDelivery.nextPerson);
  });
});

describe('the workspace around it', () => {
  it('stops offering the previous person\'s address once Fill again was used', () => {
    const shell = read('components/workspace/ToolWorkspace.tsx');
    expect(shell).toMatch(/onNextPerson=\{nextPerson\}/);
    expect(shell).toMatch(/prefillEmail=\{!severalPeople\}/);
    expect(shell).toMatch(/setSeveralPeople\(true\);\s*savedNextPerson\(\);/);
    expect(read('hooks/useFileDelivery.ts')).toMatch(/setEmail\(prefillRef\.current \? \(saved \?\? ''\) : ''\)/);
  });

  it('offers it only for a filled-in form, and counts each use', () => {
    const editor = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(editor).toMatch(/onSaved\(result, planNextPerson\(savedDoc, todayTexts\(\)\) \? startNextPerson : undefined\)/);
    expect(editor).toMatch(/trackEvent\('tool_pick', \{ tool_id: 'nextPerson', surface: 'delivery' \}\)/);
  });

  it('keeps an emptied box that is tapped and left empty, and types in it on the first tap', () => {
    const editor = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(editor).toMatch(/action = object\.text\.trim\(\) \? \{ type: 'deleteObject', id: object\.id \} : null/);
    expect(read('components/edit-pdf/ObjectLayer.tsx')).toMatch(/g\.wasSelected \|\| \(g\.original\.kind === 'text' && g\.original\.text === ''\)/);
  });
});
