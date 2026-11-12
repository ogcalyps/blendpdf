import { describe, expect, it } from 'vitest';
import {
  ONE_SHOT_TOOLS,
  changedPageId,
  editorReducer,
  hasChanges,
  initialEditorState,
  pageHasReplace,
  replaceCommitAction,
  replaceForLine,
  type EditorAction,
  type EditorState,
} from '@/components/edit-pdf/state';
import {
  HISTORY_LIMIT,
  pageVisualSize,
  rotateObjectClockwise,
  type CoverObject,
  type EditorObject,
  type ReplaceObject,
  type SourcePageInfo,
  type SourceTextLine,
  type TextObject,
} from '@/lib/edit-pdf';

const A4: SourcePageInfo = { width: 595, height: 842, rotate: 0 };
const LANDSCAPE: SourcePageInfo = { width: 842, height: 595, rotate: 90 };

const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);

const cover = (id: string, pageId = 's0', xPct = 0.1): CoverObject => ({
  id,
  pageId,
  kind: 'cover',
  box: { xPct, yPct: 0.2, wPct: 0.3, hPct: 0.1 },
});

const text = (id: string, pageId = 's0'): TextObject => ({
  id,
  pageId,
  kind: 'text',
  box: { xPct: 0.1, yPct: 0.1, wPct: 0.4, hPct: 0.02 },
  text: 'مرحبا Hello',
  size: 14,
  color: '#000000',
});

const fresh = () => initialEditorState([A4, LANDSCAPE, A4]);

describe('edit-pdf editor state: objects and history', () => {
  it('starts with one page per source page, nothing to undo and no changes', () => {
    const s = fresh();
    expect(s.doc.pages.map((p) => p.id)).toEqual(['s0', 's1', 's2']);
    expect(s.currentPageId).toBe('s0');
    expect(s.past).toEqual([]);
    expect(hasChanges(s.doc, 3)).toBe(false);
  });

  it('adds, replaces and deletes objects, one history entry each, and selects what it adds', () => {
    let s = run(fresh(), { type: 'addObject', object: cover('o1') });
    expect(s.doc.objects).toHaveLength(1);
    expect(s.selectedId).toBe('o1');
    expect(s.past).toHaveLength(1);

    s = run(s, { type: 'replaceObject', object: cover('o1', 's0', 0.5) });
    expect((s.doc.objects[0] as CoverObject).box.xPct).toBe(0.5);
    expect(s.past).toHaveLength(2);

    s = run(s, { type: 'deleteObject', id: 'o1' });
    expect(s.doc.objects).toEqual([]);
    expect(s.selectedId).toBeNull();
    expect(s.past).toHaveLength(3);
  });

  it('ignores an add with a duplicate id or an unknown page, and a replace of an unknown object', () => {
    const s = run(fresh(), { type: 'addObject', object: cover('o1') });
    expect(run(s, { type: 'addObject', object: cover('o1') })).toBe(s);
    expect(run(s, { type: 'addObject', object: cover('o2', 'nope') })).toBe(s);
    expect(run(s, { type: 'replaceObject', object: cover('o9') })).toBe(s);
    expect(run(s, { type: 'replaceObject', object: s.doc.objects[0] })).toBe(s);
  });

  it('undo and redo round-trip, and a new change clears redo', () => {
    const s0 = fresh();
    const s1 = run(s0, { type: 'addObject', object: cover('o1') });
    const s2 = run(s1, { type: 'replaceObject', object: cover('o1', 's0', 0.6) });

    const u1 = run(s2, { type: 'undo' });
    expect(u1.doc).toBe(s1.doc);
    expect(u1.future).toHaveLength(1);
    const u2 = run(u1, { type: 'undo' });
    expect(u2.doc).toBe(s0.doc);
    expect(run(u2, { type: 'undo' })).toBe(u2);

    const r = run(u2, { type: 'redo' }, { type: 'redo' });
    expect(r.doc).toBe(s2.doc);
    expect(run(r, { type: 'redo' })).toBe(r);

    const branched = run(u1, { type: 'addObject', object: cover('o2') });
    expect(branched.future).toEqual([]);
    expect(run(branched, { type: 'redo' })).toBe(branched);
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps, dropping the oldest`, () => {
    let s = run(fresh(), { type: 'addObject', object: cover('o1') });
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) {
      s = run(s, { type: 'replaceObject', object: cover('o1', 's0', i / 1000) });
    }
    expect(s.past).toHaveLength(HISTORY_LIMIT);
    // The oldest kept snapshot is 20 steps after the add: the add itself was dropped.
    expect((s.past[0].objects[0] as CoverObject).box.xPct).toBeCloseTo(20 / 1000);
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) s = run(s, { type: 'undo' });
    expect(s.past).toHaveLength(0);
    expect(s.doc.objects).toHaveLength(1);
    expect(s.future).toHaveLength(HISTORY_LIMIT);
  });

  it('syncTextHeights updates derived heights without a history entry', () => {
    const s1 = run(fresh(), { type: 'addObject', object: text('o1') });
    const s2 = run(s1, { type: 'syncTextHeights', heights: { o1: 0.07 } });
    expect((s2.doc.objects[0] as TextObject).box.hPct).toBe(0.07);
    expect(s2.past).toBe(s1.past);
    expect(s2.future).toBe(s1.future);
    // Same heights again: nothing changes, so nothing re-renders.
    expect(run(s2, { type: 'syncTextHeights', heights: { o1: 0.07 } })).toBe(s2);
  });

  it('fixes the selection after an undo removes the selected object', () => {
    const s = run(fresh(), { type: 'addObject', object: cover('o1') });
    expect(s.selectedId).toBe('o1');
    expect(run(s, { type: 'undo' }).selectedId).toBeNull();
  });

  it('hasChanges is false again after undoing everything', () => {
    const s = run(
      fresh(),
      { type: 'addObject', object: cover('o1') },
      { type: 'rotatePage', pageId: 's1' },
      { type: 'movePage', pageId: 's0', delta: 1 },
      { type: 'insertBlankPage', afterPageId: 's2' },
      { type: 'deletePage', pageId: 's2' },
    );
    expect(hasChanges(s.doc, 3)).toBe(true);
    const undone = run(s, ...Array.from({ length: 5 }, () => ({ type: 'undo' }) as const));
    expect(hasChanges(undone.doc, 3)).toBe(false);
  });
});

describe('edit-pdf editor state: pages', () => {
  it('deletes a page with its objects, moves to a neighbour, and refuses the last page', () => {
    let s = run(
      fresh(),
      { type: 'addObject', object: cover('o1', 's1') },
      { type: 'addObject', object: cover('o2', 's0') },
      { type: 'goToPage', pageId: 's1' },
      { type: 'deletePage', pageId: 's1' },
    );
    expect(s.doc.pages.map((p) => p.id)).toEqual(['s0', 's2']);
    expect(s.doc.objects.map((o) => o.id)).toEqual(['o2']);
    expect(s.currentPageId).toBe('s2');

    s = run(s, { type: 'deletePage', pageId: 's0' }, { type: 'deletePage', pageId: 's2' });
    expect(s.doc.pages.map((p) => p.id)).toEqual(['s2']);
    expect(run(s, { type: 'deletePage', pageId: 's2' })).toBe(s);

    // Undo brings the pages and their objects back.
    const back = run(s, { type: 'undo' });
    expect(back.doc.pages.map((p) => p.id)).toEqual(['s0', 's2']);
    const all = run(back, { type: 'undo' });
    expect(all.doc.pages.map((p) => p.id)).toEqual(['s0', 's1', 's2']);
    expect(all.doc.objects.map((o) => o.id)).toEqual(['o1', 'o2']);
  });

  it('moves pages and ignores moves past either end', () => {
    const s = fresh();
    expect(run(s, { type: 'movePage', pageId: 's0', delta: -1 })).toBe(s);
    expect(run(s, { type: 'movePage', pageId: 's2', delta: 1 })).toBe(s);
    expect(run(s, { type: 'movePage', pageId: 's0', delta: 1 }).doc.pages.map((p) => p.id)).toEqual(['s1', 's0', 's2']);
    expect(run(s, { type: 'movePage', pageId: 's2', delta: -1 }).doc.pages.map((p) => p.id)).toEqual(['s0', 's2', 's1']);
  });

  it('rotates a page a quarter turn and remaps its objects through rotateObjectClockwise', () => {
    const before = run(
      fresh(),
      { type: 'addObject', object: cover('o1', 's1') },
      { type: 'addObject', object: text('o2', 's1') },
      { type: 'addObject', object: cover('o3', 's0') },
    );
    const size = pageVisualSize(before.doc.pages[1], before.sourcePages);
    const after = run(before, { type: 'rotatePage', pageId: 's1' });
    expect(after.doc.pages[1].rotation).toBe(90);
    expect(after.doc.objects[0]).toEqual(rotateObjectClockwise(before.doc.objects[0], size));
    expect(after.doc.objects[1]).toEqual(rotateObjectClockwise(before.doc.objects[1], size));
    expect(after.doc.objects[2]).toBe(before.doc.objects[2]);
    const fourTurns = run(after, ...Array.from({ length: 3 }, () => ({ type: 'rotatePage', pageId: 's1' }) as const));
    expect(fourTurns.doc.pages[1].rotation).toBe(0);
  });

  it('inserts a blank page the visual size of the page before it, and goes to it', () => {
    // s1 is 842 x 595 with /Rotate 90, so it shows as 595 x 842.
    const s = run(fresh(), { type: 'rotatePage', pageId: 's1' }, { type: 'insertBlankPage', afterPageId: 's1' });
    const blank = s.doc.pages[2];
    expect(blank.id).toBe('b1');
    // After the editor's turn s1 shows as 842 x 595.
    expect(blank.source).toEqual({ kind: 'blank', width: 842, height: 595 });
    expect(blank.rotation).toBe(0);
    expect(s.currentPageId).toBe('b1');
  });

  it('never reuses a blank page id that a snapshot still holds', () => {
    let s = run(fresh(), { type: 'insertBlankPage', afterPageId: 's0' }, { type: 'deletePage', pageId: 'b1' });
    s = run(s, { type: 'insertBlankPage', afterPageId: 's0' });
    expect(s.doc.pages[1].id).toBe('b2');
  });

  it('after undo the current page is clamped when it disappears, or moves to the page the step changed', () => {
    const inserted = run(fresh(), { type: 'goToPage', pageId: 's2' }, { type: 'insertBlankPage', afterPageId: 's2' });
    expect(inserted.currentPageId).toBe('b1');
    expect(run(inserted, { type: 'undo' }).currentPageId).toBe('s2');

    const drawn = run(fresh(), { type: 'addObject', object: cover('o1', 's2') }, { type: 'goToPage', pageId: 's0' });
    expect(run(drawn, { type: 'undo' }).currentPageId).toBe('s2');
  });
});

describe('edit-pdf editor state: view', () => {
  it('setTool clears the selection, goToPage ignores unknown pages, setZoom snaps to a step', () => {
    const s = run(fresh(), { type: 'addObject', object: cover('o1') });
    expect(run(s, { type: 'setTool', tool: 'draw' }).selectedId).toBeNull();
    expect(run(s, { type: 'goToPage', pageId: 'nope' })).toBe(s);
    expect(run(s, { type: 'setZoom', zoom: 1.3 }).zoom).toBe(1.25);
    expect(run(s, { type: 'setZoom', zoom: 9 }).zoom).toBe(3);
    expect(run(s, { type: 'setStyle', patch: { strokeWidth: 8 } }).style.strokeWidth).toBe(8);
  });

  it('changedPageId names the one page a step touched', () => {
    const s0 = fresh();
    const s1 = run(s0, { type: 'addObject', object: cover('o1', 's1') });
    expect(changedPageId(s0.doc, s1.doc)).toBe('s1');
    const s2 = run(s1, { type: 'addObject', object: cover('o2', 's2') });
    expect(changedPageId(s0.doc, s2.doc)).toBeNull();
    const objects: EditorObject[] = [];
    expect(changedPageId(s0.doc, { ...s0.doc, objects })).toBeNull();
  });
});

// ── Edit text (beta) ───────────────────────────────────────────────────────

const sourceLine = (pageIndex: number, n: number): SourceTextLine => ({
  id: `${pageIndex}:${n}`,
  pageIndex,
  text: 'فاتورة رقم 12',
  textUnsure: false,
  direction: 'rtl',
  color: '#1A1A1A',
  box: { xPct: 0.5, yPct: 0.1 + n * 0.03, wPct: 0.4, hPct: 0.02 },
  turn: 0,
  invisible: false,
  geometry: { rect: { x: 300, y: 700, width: 240, height: 14 }, ux: 1, uy: 0, baseline: 703, start: 300, end: 540, size: 12, ascent: 10, descent: 3, neighbours: [] },
});

const replacement = (id: string, pageId = 's0', line = sourceLine(0, 0)): ReplaceObject => ({
  id,
  pageId,
  kind: 'replace',
  line,
  box: line.box,
  text: 'فاتورة رقم 13',
  size: 11.5,
  color: line.color,
});

describe('edit-pdf editor state: Edit text (beta)', () => {
  it('keeps the Edit text tool on after a line is changed, so several lines can be done in a row', () => {
    expect(ONE_SHOT_TOOLS).not.toContain('replace');
    const s = run(fresh(), { type: 'setTool', tool: 'replace' }, { type: 'addObject', object: replacement('o1') });
    expect(s.tool).toBe('replace');
    expect(s.selectedId).toBe('o1');
    expect(hasChanges(s.doc, 3)).toBe(true);
  });

  it('allows one changed line per detected line: a second replace on the same line is refused', () => {
    const s = run(fresh(), { type: 'addObject', object: replacement('o1') });
    expect(run(s, { type: 'addObject', object: replacement('o2') })).toBe(s);
    expect(replaceForLine(s.doc, '0:0')?.id).toBe('o1');
    // Another line on the same page is fine.
    const two = run(s, { type: 'addObject', object: replacement('o2', 's0', sourceLine(0, 1)) });
    expect(two.doc.objects.map((o) => o.id)).toEqual(['o1', 'o2']);
    // Once the first is undone, its line can be changed again.
    const undone = run(s, { type: 'undo' });
    expect(run(undone, { type: 'addObject', object: replacement('o3') }).doc.objects.map((o) => o.id)).toEqual(['o3']);
  });

  it('finishing a line: the prefill left as it was changes nothing; a new wording, or Enter on an empty field, does', () => {
    const doc = fresh().doc;
    const line = { ...sourceLine(0, 0), text: 'فاتورة رقم 12' };
    const draft = { object: { ...replacement('o1', 's0', line), text: line.text }, draft: true };
    // A mis-tap, then a click away or Enter: nothing.
    expect(replaceCommitAction(doc, draft, 'فاتورة رقم 12', false)).toBeNull();
    expect(replaceCommitAction(doc, draft, ' فاتورة رقم 12 ', true)).toBeNull();
    // Retyped: one addObject with the clean text.
    expect(replaceCommitAction(doc, draft, 'فاتورة رقم 13\n', false)).toEqual({ type: 'addObject', object: { ...draft.object, text: 'فاتورة رقم 13' } });
    // Emptied: only Enter takes the line out.
    expect(replaceCommitAction(doc, draft, '  ', false)).toBeNull();
    expect(replaceCommitAction(doc, draft, '', true)).toEqual({ type: 'addObject', object: { ...draft.object, text: '' } });
    // An unsure line has no prefill: whatever is typed counts, and Enter on the empty field takes it out.
    const unsure = { object: { ...replacement('o2', 's0', { ...line, text: '', textUnsure: true }), text: '' }, draft: true };
    expect(replaceCommitAction(doc, unsure, '', false)).toBeNull();
    expect(replaceCommitAction(doc, unsure, '', true)?.type).toBe('addObject');
    // An existing changed line: a replaceObject only when its text changed.
    const s = run(fresh(), { type: 'addObject', object: replacement('o3', 's0', line) });
    const existing = { object: replacement('o3', 's0', line), draft: false };
    expect(replaceCommitAction(s.doc, existing, 'فاتورة رقم 13', true)).toBeNull();
    expect(replaceCommitAction(s.doc, existing, 'فاتورة رقم 14', false)).toEqual({ type: 'replaceObject', object: { ...replacement('o3', 's0', line), text: 'فاتورة رقم 14' } });
  });

  it('refuses to turn a page that holds a changed line, and allows it again once that is undone', () => {
    const s = run(fresh(), { type: 'addObject', object: replacement('o1') });
    expect(pageHasReplace(s.doc, 's0')).toBe(true);
    expect(run(s, { type: 'rotatePage', pageId: 's0' })).toBe(s);
    // Other pages still turn.
    expect(run(s, { type: 'rotatePage', pageId: 's1' }).doc.pages[1].rotation).toBe(90);
    const undone = run(s, { type: 'undo' });
    expect(pageHasReplace(undone.doc, 's0')).toBe(false);
    expect(run(undone, { type: 'rotatePage', pageId: 's0' }).doc.pages[0].rotation).toBe(90);
    // Keep the original (delete) frees the page too.
    const kept = run(s, { type: 'deleteObject', id: 'o1' });
    expect(run(kept, { type: 'rotatePage', pageId: 's0' }).doc.pages[0].rotation).toBe(90);
  });

  it('deleting the page takes the changed line with it, and undo brings both back', () => {
    const s = run(fresh(), { type: 'addObject', object: replacement('o1') }, { type: 'deletePage', pageId: 's0' });
    expect(s.doc.pages.map((p) => p.id)).toEqual(['s1', 's2']);
    expect(s.doc.objects).toEqual([]);
    const back = run(s, { type: 'undo' });
    expect(back.doc.pages.map((p) => p.id)).toEqual(['s0', 's1', 's2']);
    expect(back.doc.objects.map((o) => o.id)).toEqual(['o1']);
    expect(run(back, { type: 'redo' }).doc.objects).toEqual([]);
  });

  it('moving the page keeps the changed line exactly as it was (removal is keyed by the source page)', () => {
    const s = run(fresh(), { type: 'addObject', object: replacement('o1') });
    const moved = run(s, { type: 'movePage', pageId: 's0', delta: 1 });
    expect(moved.doc.pages.map((p) => p.id)).toEqual(['s1', 's0', 's2']);
    expect(moved.doc.objects[0]).toBe(s.doc.objects[0]);
  });

  it('restyling and retyping a changed line are one history entry each', () => {
    const s = run(fresh(), { type: 'addObject', object: replacement('o1') });
    const object = s.doc.objects[0] as ReplaceObject;
    const bigger = run(s, { type: 'replaceObject', object: { ...object, size: 12 } });
    const blue = run(bigger, { type: 'replaceObject', object: { ...(bigger.doc.objects[0] as ReplaceObject), color: '#1D4ED8' } });
    const retyped = run(blue, { type: 'replaceObject', object: { ...(blue.doc.objects[0] as ReplaceObject), text: '' } });
    expect(retyped.past).toHaveLength(4);
    expect(retyped.doc.objects[0]).toMatchObject({ size: 12, color: '#1D4ED8', text: '' });
  });
});
