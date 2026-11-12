import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import { editorReducer, hasChanges, initialEditorState, type EditorAction, type EditorState } from '@/components/edit-pdf/state';
import {
  pageNumberText,
  rotateCropClockwise,
  type CoverObject,
  type DocStamps,
  type ReplaceObject,
  type SourcePageInfo,
  type VisualBox,
} from '@/lib/edit-pdf';
import { MODES } from '@/lib/workspace/modes';

/**
 * The workspace's editor state (workspace-spec.md 4.1, 12 "UI state"): page
 * selection, crops, stamps, turning and deleting several pages, the grid's
 * move, Insert PDF's grown source and a swapped source. Pure reducer, Node.
 */
const A4: SourcePageInfo = { width: 595, height: 842, rotate: 0 };
const LANDSCAPE: SourcePageInfo = { width: 842, height: 595, rotate: 90 };

const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);
const fresh = () => initialEditorState([A4, LANDSCAPE, A4, A4]);
const ids = (s: EditorState) => s.doc.pages.map((p) => p.id);

const CROP: VisualBox = { xPct: 0.1, yPct: 0.2, wPct: 0.5, hPct: 0.4 };

const cover = (id: string, pageId: string): CoverObject => ({
  id,
  pageId,
  kind: 'cover',
  box: { xPct: 0.1, yPct: 0.1, wPct: 0.2, hPct: 0.1 },
});

/** A changed line on a page: such a page can't be turned. */
const changedLine = (id: string, pageId: string): ReplaceObject =>
  ({
    id,
    pageId,
    kind: 'replace',
    line: { id: `line-${id}`, pageIndex: 0, text: 'Old', box: { xPct: 0.1, yPct: 0.1, wPct: 0.3, hPct: 0.02 } },
    box: { xPct: 0.1, yPct: 0.1, wPct: 0.3, hPct: 0.02 },
    text: 'New',
    size: 12,
    color: '#000000',
  }) as unknown as ReplaceObject;

const STAMPS: DocStamps = {
  watermark: { type: 'text', text: 'DRAFT', position: 'diagonal', opacity: 0.3, size: 48 },
};

describe('workspace state: opening', () => {
  it('opens in the mode view and tool, with the base page count', () => {
    const grid = initialEditorState([A4, A4], MODES.rotate);
    expect(grid.view).toBe('grid');
    expect(grid.tool).toBe('select');
    expect(grid.basePageCount).toBe(2);
    const crop = initialEditorState([A4], MODES.crop);
    expect(crop.view).toBe('page');
    expect(crop.tool).toBe('crop');
    expect(crop.selectedPageIds).toEqual([]);
  });

  it('applies a default stamp as the first undoable entry: Save works at once, Undo takes it off', () => {
    const s = initialEditorState([A4, A4], MODES.watermark, STAMPS);
    expect(s.doc.stamps).toEqual(STAMPS);
    expect(s.past).toHaveLength(1);
    expect(hasChanges(s.doc, s.basePageCount)).toBe(true);
    const undone = run(s, { type: 'undo' });
    expect(undone.doc.stamps).toBeUndefined();
    expect(hasChanges(undone.doc, undone.basePageCount)).toBe(false);
  });
});

describe('workspace state: hasChanges', () => {
  it('is true for a crop-only doc and a stamp-only doc, false once they are taken off', () => {
    const cropped = run(fresh(), { type: 'setCrop', pageIds: ['s1'], crop: CROP });
    expect(hasChanges(cropped.doc, 4)).toBe(true);
    expect(hasChanges(run(cropped, { type: 'clearCrops' }).doc, 4)).toBe(false);

    const stamped = run(fresh(), { type: 'setStamps', stamps: STAMPS });
    expect(hasChanges(stamped.doc, 4)).toBe(true);
    const cleared = run(stamped, { type: 'setStamps', stamps: {} });
    expect(cleared.doc.stamps).toBeUndefined();
    expect(hasChanges(cleared.doc, 4)).toBe(false);
  });

  it('keeps the stamps through page and object actions', () => {
    const s = run(
      fresh(),
      { type: 'setStamps', stamps: STAMPS },
      { type: 'rotatePage', pageId: 's0' },
      { type: 'deletePage', pageId: 's3' },
      { type: 'addObject', object: cover('o1', 's0') },
      { type: 'movePageTo', pageId: 's2', index: 0 },
    );
    expect(s.doc.stamps).toEqual(STAMPS);
  });

  it('a same-stamp setStamps makes no history entry', () => {
    const s = run(fresh(), { type: 'setStamps', stamps: STAMPS });
    expect(run(s, { type: 'setStamps', stamps: { ...STAMPS } })).toBe(s);
  });
});

describe('workspace state: a page-set watermark text that changes after the file opens', () => {
  // /watermark-pdf/id-copy opens with its answers' text; answers typed after the file opened must reach the saved file
  const ANSWERS = 'Copy for the letting agency only, 08/11/2026';
  const opened = () => initialEditorState([A4, A4], MODES.watermark, { watermark: { type: 'text', text: 'Copy, 08/11/2026', position: 'tiled', opacity: 0.7, size: 20 } });
  const retext = { type: 'retextPresetWatermark', from: 'Copy, 08/11/2026', to: ANSWERS } as const;

  it('follows the new text without an Undo step of its own', () => {
    const s = run(opened(), retext);
    expect(s.doc.stamps?.watermark?.text).toBe(ANSWERS);
    expect(s.past).toHaveLength(1);
    expect(run(s, { type: 'undo' }).doc.stamps).toBeUndefined();
    expect(run(s, { type: 'undo' }, { type: 'redo' }).doc.stamps?.watermark?.text).toBe(ANSWERS);
  });

  it('rewrites the history too, so undoing a later change keeps the new text', () => {
    const s = run(opened(), { type: 'addObject', object: cover('o1', 's0') }, retext);
    expect(s.doc.stamps?.watermark?.text).toBe(ANSWERS);
    expect(run(s, { type: 'undo' }).doc.stamps?.watermark?.text).toBe(ANSWERS);
  });

  it('leaves alone a watermark the visitor changed or removed', () => {
    const watermark = opened().doc.stamps!.watermark!;
    const changed = run(opened(), { type: 'setStamps', stamps: { watermark: { ...watermark, text: 'Mine' } } });
    expect(run(changed, retext)).toBe(changed);
    const removed = run(opened(), { type: 'setStamps', stamps: {} });
    expect(run(removed, retext)).toBe(removed);
  });

  it('the editor sends the new text as the page passes it', () => {
    const editor = readFileSync(join(__dirname, '..', 'components/edit-pdf/EditorWorkspace.tsx'), 'utf8');
    expect(editor).toMatch(/const presetText = watermarkPreset\?\.text;/);
    expect(editor).toMatch(/dispatch\(\{ type: 'retextPresetWatermark', from, to: presetText \}\)/);
  });
});

describe('workspace state: crops', () => {
  it('setCrop is one history entry for all its pages, and null removes it', () => {
    const s = run(fresh(), { type: 'setCrop', pageIds: ['s0', 's2', 's3'], crop: CROP });
    expect(s.past).toHaveLength(1);
    expect(s.doc.pages.map((p) => p.crop ?? null)).toEqual([CROP, null, CROP, CROP]);
    const removed = run(s, { type: 'setCrop', pageIds: ['s2'], crop: null });
    expect(removed.doc.pages[2].crop).toBeUndefined();
    expect('crop' in removed.doc.pages[2]).toBe(false);
    expect(run(removed, { type: 'setCrop', pageIds: ['s2'], crop: null })).toBe(removed);
  });

  it('turning a page turns its crop with it; four turns give the same crop', () => {
    let s = run(fresh(), { type: 'setCrop', pageIds: ['s1'], crop: CROP }, { type: 'rotatePage', pageId: 's1' });
    expect(s.doc.pages[1].crop).toEqual(rotateCropClockwise(CROP));
    s = run(s, { type: 'rotatePage', pageId: 's1' }, { type: 'rotatePage', pageId: 's1' }, { type: 'rotatePage', pageId: 's1' });
    const back = s.doc.pages[1].crop!;
    for (const key of ['xPct', 'yPct', 'wPct', 'hPct'] as const) expect(back[key]).toBeCloseTo(CROP[key], 9);
    expect(s.doc.pages[1].rotation).toBe(0);
  });

  it('rotatePages left (3 turns) is the inverse of one right turn, crop and objects included', () => {
    const start = run(fresh(), { type: 'setCrop', pageIds: ['s0'], crop: CROP }, { type: 'addObject', object: cover('o1', 's0') });
    const s = run(start, { type: 'rotatePages', pageIds: ['s0'], turns: 1 }, { type: 'rotatePages', pageIds: ['s0'], turns: 3 });
    expect(s.doc.pages[0].rotation).toBe(0);
    const crop = s.doc.pages[0].crop!;
    for (const key of ['xPct', 'yPct', 'wPct', 'hPct'] as const) expect(crop[key]).toBeCloseTo(CROP[key], 9);
    const box = (s.doc.objects[0] as CoverObject).box;
    expect(box.xPct).toBeCloseTo(0.1, 9);
    expect(box.yPct).toBeCloseTo(0.1, 9);
  });
});

describe('workspace state: several pages at once', () => {
  it('rotatePages turns every listed page in one entry and skips pages with a changed line', () => {
    const start = run(fresh(), { type: 'addObject', object: changedLine('r1', 's2') });
    const s = run(start, { type: 'rotatePages', pageIds: ['s0', 's1', 's2'], turns: 1 });
    expect(s.doc.pages.map((p) => p.rotation)).toEqual([90, 90, 0, 0]);
    expect(s.past).toHaveLength(start.past.length + 1);
    // Only pages that can't turn: nothing happens.
    expect(run(start, { type: 'rotatePages', pageIds: ['s2'], turns: 1 })).toBe(start);
  });

  it('resetRotations turns every page back upright in one entry, skipping changed-line pages', () => {
    const s = run(
      fresh(),
      { type: 'rotatePages', pageIds: ['s0', 's1'], turns: 1 },
      { type: 'rotatePages', pageIds: ['s1'], turns: 1 },
      { type: 'setCrop', pageIds: ['s1'], crop: CROP },
    );
    const back = run(s, { type: 'resetRotations' });
    expect(back.doc.pages.map((p) => p.rotation)).toEqual([0, 0, 0, 0]);
    expect(back.past).toHaveLength(s.past.length + 1);
    // The crop was drawn on the turned page: it turns back with it, onto the same content.
    expect(back.doc.pages[1].crop).toEqual(rotateCropClockwise(rotateCropClockwise(CROP)));
  });

  it('deletePages removes the pages and their objects, and refuses to remove every page', () => {
    const start = run(fresh(), { type: 'addObject', object: cover('o1', 's1') });
    const s = run(start, { type: 'deletePages', pageIds: ['s1', 's3'] });
    expect(ids(s)).toEqual(['s0', 's2']);
    expect(s.doc.objects).toEqual([]);
    expect(run(s, { type: 'deletePages', pageIds: ['s0', 's2'] })).toBe(s);
  });

  it('movePageTo moves one page to a place, clamped, one entry', () => {
    const s = run(fresh(), { type: 'movePageTo', pageId: 's3', index: 0 });
    expect(ids(s)).toEqual(['s3', 's0', 's1', 's2']);
    expect(s.past).toHaveLength(1);
    expect(ids(run(s, { type: 'movePageTo', pageId: 's3', index: 99 }))).toEqual(['s0', 's1', 's2', 's3']);
    expect(run(s, { type: 'movePageTo', pageId: 's3', index: 0 })).toBe(s);
    expect(hasChanges(s.doc, 4)).toBe(true);
  });
});

describe('workspace state: selection', () => {
  it('toggles pages, keeps them in doc order, and shift extends from the last one ticked', () => {
    let s = run(fresh(), { type: 'togglePageSelection', pageId: 's2' }, { type: 'togglePageSelection', pageId: 's0' });
    expect(s.selectedPageIds).toEqual(['s0', 's2']);
    s = run(s, { type: 'togglePageSelection', pageId: 's0' });
    expect(s.selectedPageIds).toEqual(['s2']);
    s = run(fresh(), { type: 'togglePageSelection', pageId: 's1' }, { type: 'togglePageSelection', pageId: 's3', range: true });
    expect(s.selectedPageIds).toEqual(['s1', 's2', 's3']);
    // Selection is UI state: no history.
    expect(s.past).toEqual([]);
  });

  it('setPageSelection takes only pages of the doc, in doc order', () => {
    const s = run(fresh(), { type: 'setPageSelection', pageIds: ['s3', 'nope', 's1'] });
    expect(s.selectedPageIds).toEqual(['s1', 's3']);
  });

  it('is filtered after a delete and after an undo, and follows a move', () => {
    let s = run(fresh(), { type: 'setPageSelection', pageIds: ['s1', 's2'] }, { type: 'deletePages', pageIds: ['s1'] });
    expect(s.selectedPageIds).toEqual(['s2']);
    s = run(fresh(), { type: 'insertBlankPage', afterPageId: 's0' });
    s = run(s, { type: 'setPageSelection', pageIds: ['b1', 's0'] }, { type: 'undo' });
    expect(s.selectedPageIds).toEqual(['s0']);
    s = run(fresh(), { type: 'setPageSelection', pageIds: ['s0', 's3'] }, { type: 'movePageTo', pageId: 's3', index: 0 });
    expect(s.selectedPageIds).toEqual(['s3', 's0']);
  });

  it('setView switches between the page and the grid', () => {
    const s = run(fresh(), { type: 'setView', view: 'grid' });
    expect(s.view).toBe('grid');
    expect(run(s, { type: 'setView', view: 'grid' })).toBe(s);
  });
});

describe('workspace state: Insert PDF and a swapped source', () => {
  const grown = [A4, LANDSCAPE, A4, A4, A4, LANDSCAPE];

  it('insertSourcePages grows sourcePages, adds the pages in one entry, and one Undo is "no changes" again', () => {
    const start = fresh();
    const s = run(start, { type: 'insertSourcePages', sourcePages: grown, indices: [4, 5], afterPageId: null });
    expect(s.sourcePages).toHaveLength(6);
    expect(ids(s)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5']);
    expect(s.currentPageId).toBe('s4');
    expect(s.past).toHaveLength(1);
    expect(hasChanges(s.doc, s.basePageCount)).toBe(true);
    // The appended pages ARE the source now: nothing for the export to apply.
    expect(hasChanges(s.doc, s.sourcePages.length)).toBe(false);

    const undone = run(s, { type: 'undo' });
    expect(ids(undone)).toEqual(['s0', 's1', 's2', 's3']);
    expect(undone.sourcePages).toHaveLength(6);
    expect(undone.basePageCount).toBe(4);
    expect(hasChanges(undone.doc, undone.basePageCount)).toBe(false);
    // ...but the source has pages the doc doesn't: no pass-through.
    expect(hasChanges(undone.doc, undone.sourcePages.length)).toBe(true);
  });

  it('inserts after a page, and refuses a source that shrank', () => {
    const s = run(fresh(), { type: 'insertSourcePages', sourcePages: grown, indices: [4], afterPageId: 's0' });
    expect(ids(s)).toEqual(['s0', 's4', 's1', 's2', 's3']);
    const start = fresh();
    expect(run(start, { type: 'insertSourcePages', sourcePages: [A4], indices: [0], afterPageId: null })).toBe(start);
  });

  it('replaceSource keepDoc keeps the doc and history; otherwise everything starts over', () => {
    const start = run(fresh(), { type: 'addObject', object: cover('o1', 's0') }, { type: 'setView', view: 'grid' });
    const ocr = [A4, LANDSCAPE, A4, A4];
    const kept = run(start, { type: 'replaceSource', sourcePages: ocr, keepDoc: true });
    expect(kept.doc).toBe(start.doc);
    expect(kept.past).toBe(start.past);
    expect(kept.sourcePages).toBe(ocr);

    const reset = run(start, { type: 'replaceSource', sourcePages: [A4, A4], keepDoc: false });
    expect(ids(reset)).toEqual(['s0', 's1']);
    expect(reset.doc.objects).toEqual([]);
    expect(reset.past).toEqual([]);
    expect(reset.basePageCount).toBe(2);
    expect(reset.view).toBe('grid');
  });
});

describe('workspace: the page number template', () => {
  // StampPanel stores t('workspace.numbers.pageOf', { n: '{n}', total: '{total}' }): the placeholders must come through literally.
  it.each(['en', 'ar'])('keeps {n} and {total} literal in %s, and numbers fill them', (locale) => {
    const messages = JSON.parse(readFileSync(join(__dirname, '..', 'messages', `${locale}.json`), 'utf8'));
    const t = createTranslator({ locale, messages, namespace: 'workspace' });
    const template = t('numbers.pageOf', { n: '{n}', total: '{total}' });
    expect(template).toContain('{n}');
    expect(template).toContain('{total}');
    expect(t('numbers.page', { n: '{n}' })).toContain('{n}');
    const text = pageNumberText({ template, startFrom: 3 }, 1, 4);
    expect(text).toContain('4');
    expect(text).toContain('6');
    expect(text).not.toMatch(/[{}]/);
  });
});

describe('workspace: the primary button labels', () => {
  // EditorWorkspace reads ModeConfig.primary.labelKey as data (messageByKey), out of reach of the literal-key scan.
  it.each(['en', 'ar'])('every mode has its primary label in %s, with {count} where it takes one', (locale) => {
    const messages = JSON.parse(readFileSync(join(__dirname, '..', 'messages', `${locale}.json`), 'utf8'));
    const errors: string[] = [];
    const t = createTranslator({ locale, messages, onError: (e) => errors.push(e.message) });
    for (const [mode, config] of Object.entries(MODES)) {
      const label = t(config.primary.labelKey as never, { count: 2 } as never) as string;
      expect(label, mode).not.toBe(config.primary.labelKey);
      expect(label.trim(), mode).not.toBe('');
    }
    expect(errors).toEqual([]);
  });
});
