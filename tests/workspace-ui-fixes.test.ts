import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { editorReducer, type EditorAction, type EditorState } from '@/components/edit-pdf/state';
import {
  cropTooSmallOn,
  fixBeforeSave,
  fixForSource,
  fixRefusal,
  gridHint,
  openingState,
  pagesFromRanges,
  showsScanBanner,
} from '@/components/edit-pdf/workspace-rules';
import type { CoverObject, ReplaceObject, SourcePageInfo, VisualBox } from '@/lib/edit-pdf';
import { DEFAULT_SAVE_PLAN, type SavePlan, type WorkspaceMode } from '@/lib/workspace/types';

/**
 * The workspace UI after the first review round (workspace-rules.ts and its
 * wiring): restricted and pdf-lib-unreadable files open and only the steps
 * that need pdf-lib (or, restricted, our server) ask for the fix; a fix that
 * rewrites the file waits for changed lines; rotate-pdf opens ticked; the
 * page-range field; the crop's minimum on every page it goes on.
 */
const ROOT = join(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const A4: SourcePageInfo = { width: 595, height: 842, rotate: 0 };
/** A receipt strip: 30 pt tall. */
const STRIP: SourcePageInfo = { width: 595, height: 30, rotate: 0 };

const plan = (patch: Partial<SavePlan> = {}): SavePlan => ({ ...DEFAULT_SAVE_PLAN, ...patch });
const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);

const cover = (id: string, pageId: string): CoverObject => ({
  id,
  pageId,
  kind: 'cover',
  box: { xPct: 0.1, yPct: 0.1, wPct: 0.2, hPct: 0.1 },
});
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

describe('a file pdf.js opens without a password', () => {
  it('needs restrictions removed when encrypted (either engine says so), a repair when pdf-lib cannot read it', () => {
    expect(fixForSource('encrypted', false)).toBe('unlock');
    expect(fixForSource('ok', true)).toBe('unlock');
    expect(fixForSource('unknown', true)).toBe('unlock');
    expect(fixForSource('unreadable', false)).toBe('repair');
    expect(fixForSource('ok', false)).toBeNull();
    // The engine not loading never blocks on its own
    expect(fixForSource('unknown', false)).toBeNull();
  });

  it('opens in the editor: the ready path carries needsFix and no longer turns into a locked state', () => {
    const source = read('components/edit-pdf/useWorkingSource.ts');
    expect(source).toMatch(/return \{ status: 'ready', handle, sourcePages, scanned, needsFix: fixForSource\(verdict, Boolean\(info\?\.EncryptFilterName\)\) \};/);
    // Locked only where pdf.js itself failed (the catch): once it has the document, the file opens
    const opened = /const pdf = await task\.promise;([\s\S]*?)\} catch \(error\) \{/.exec(source)?.[1] ?? '';
    expect(opened).toMatch(/status: 'ready'/);
    expect(opened).not.toMatch(/status: 'locked'/);
  });
});

describe('restricted: which saves ask to remove the restrictions first', () => {
  it('the text and the pictures inside come out of pdf.js as is, with no upload', () => {
    expect(fixBeforeSave('unlock', plan({ format: 'text' }), false)).toBeNull();
    expect(fixBeforeSave('unlock', plan({ format: 'imagesInside' }), false)).toBeNull();
    // PDF-only options are ignored for them (effectivePlan), so they don't ask either
    expect(fixBeforeSave('unlock', plan({ format: 'text', compress: 'low', removeMetadata: true }), false)).toBeNull();
  });

  it("anything pdf-lib writes asks: the doc's changes, a cut, removing metadata", () => {
    expect(fixBeforeSave('unlock', plan({ format: 'text' }), true)).toBe('unlock');
    expect(fixBeforeSave('unlock', plan(), true)).toBe('unlock');
    expect(fixBeforeSave('unlock', plan({ split: { kind: 'every', n: 2 } }), false)).toBe('unlock');
    expect(fixBeforeSave('unlock', plan({ alsoSelected: true }), false)).toBe('unlock');
    expect(fixBeforeSave('unlock', plan({ removeMetadata: true }), false)).toBe('unlock');
  });

  it('every server step asks: compress, password, Word, Excel, images', () => {
    for (const patch of [
      { compress: 'medium' as const },
      { password: 'secret' },
      { format: 'word' as const },
      { format: 'excel' as const },
      { format: 'images' as const },
    ]) {
      expect(fixBeforeSave('unlock', plan(patch), false), JSON.stringify(patch)).toBe('unlock');
    }
  });

  it('a file pdf-lib cannot read asks for a repair only where pdf-lib writes; the server takes it as it is', () => {
    expect(fixBeforeSave('repair', plan({ compress: 'medium' }), false)).toBeNull();
    expect(fixBeforeSave('repair', plan({ format: 'word' }), false)).toBeNull();
    expect(fixBeforeSave('repair', plan({ format: 'text' }), false)).toBeNull();
    expect(fixBeforeSave('repair', plan(), true)).toBe('repair');
    expect(fixBeforeSave('repair', plan({ removeMetadata: true }), false)).toBe('repair');
  });

  it('a file that needs nothing never asks', () => {
    expect(fixBeforeSave(null, plan({ compress: 'low', removeMetadata: true }), true)).toBeNull();
  });

  it('the save asks before it changes anything, and carries on with the same plan after the fix', () => {
    const source = read('components/edit-pdf/EditorWorkspace.tsx');
    const save = /const save = useCallback\(([\s\S]*?)\n {2}\);/.exec(source)?.[1] ?? '';
    const ask = save.indexOf("askFix(fix, { then: 'save', plan, pre });");
    expect(ask).toBeGreaterThan(save.indexOf('const fix = fixBeforeSave(working.needsFix, plan, !asIs);'));
    expect(ask).toBeLessThan(save.indexOf('if (pre) dispatch(pre);'));
    expect(ask).toBeLessThan(save.indexOf('await runSave(input)'));
    expect(source).toMatch(/if \(after\.then === 'save'\) void save\(after\.plan, after\.pre\);/);
    // Edit text, Insert PDF and OCR ask too
    expect(source).toMatch(/if \(next === 'replace' && needsFix\) \{\s+askFix\(needsFix, \{ then: 'replaceTool' \}\);/);
    expect(source).toMatch(/if \(working\.needsFix\) \{\s+askFix\(working\.needsFix, \{ then: 'insert', files: picked, afterPageId \}\);/);
    expect(source).toMatch(/if \(kind === 'ocr' && sourceRef\.current\.needsFix === 'unlock'\) \{\s+askFix\('unlock', \{ then: 'ocr' \}\);/);
    // Only a fix that kept the pages (and so the doc) carries on
    expect(source).toMatch(/if \(swapped !== 'kept'\) return;/);
  });
});

describe('a fix that rewrites the file waits for changed lines', () => {
  const base = openingState('edit', [A4, A4]);

  it('OCR, repair and unlock are all refused while a changed line exists, and allowed without one', () => {
    const changed = run(base, { type: 'addObject', object: changedLine('r1', 's1') });
    for (const fix of ['ocr', 'repair', 'unlock'] as const) {
      expect(fixRefusal(changed.doc, fix), fix).toBe('replaced');
      expect(fixRefusal(base.doc, fix), fix).toBeNull();
    }
    // Other objects keep no object numbers
    expect(fixRefusal(run(base, { type: 'addObject', object: cover('c1', 's0') }).doc, 'repair')).toBeNull();
  });

  it('runFix and the fix-first prompt refuse through it, for every kind', () => {
    const source = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(source).toMatch(/const runFix = useCallback\(\s+async \(kind: 'ocr' \| 'repair'\) => \{\s+if \(fixing \|\| savingRef\.current \|\| inserting\) return;\s+settle\(\);\s+const refused = refusalText\(kind, stateRef\.current\.doc\);\s+if \(refused\) \{/);
    expect(source).toMatch(/fixRefusal\(d, kind\) \? \(kind === 'ocr' \? tWorkspace\('fix\.ocrReplaced'\) : tWorkspace\('fix\.rebuildReplaced'\)\) : undefined/);
    expect(source).toMatch(/const refused = refusalText\(asked\.fix, stateRef\.current\.doc\);/);
    expect(source).toMatch(/if \(!primaryBlocked && primary\.action === 'repair' && repairBlocked\) primaryBlocked = repairBlocked;/);
  });
});

describe('what a mode opens with and shows', () => {
  it('rotate-pdf opens in the grid with every page ticked; the other grid modes with none', () => {
    const rotate = openingState('rotate', [A4, A4, A4]);
    expect(rotate.view).toBe('grid');
    expect(rotate.selectedPageIds).toEqual(['s0', 's1', 's2']);
    expect(rotate.past).toHaveLength(0);
    for (const mode of ['delete', 'extract', 'split', 'reorder', 'merge'] as const) {
      expect(openingState(mode, [A4, A4]).selectedPageIds, mode).toEqual([]);
    }
    // A turn of the ticked pages is then one tap away, and Save rotated PDF has its change
    const turned = run(rotate, { type: 'rotatePages', pageIds: rotate.selectedPageIds, turns: 1 });
    expect(turned.doc.pages.every((p) => p.rotation === 90)).toBe(true);
  });

  it('keeps the default stamp as the first undoable entry', () => {
    const s = openingState('watermark', [A4], { watermark: { type: 'text', text: 'DRAFT', position: 'diagonal', opacity: 0.3, size: 48 } });
    expect(s.past).toHaveLength(1);
    expect(s.doc.stamps?.watermark).toBeDefined();
  });

  it('offers OCR on a scan only on the pages about its text', () => {
    const shown: WorkspaceMode[] = ['edit', 'ocr', 'text', 'word', 'excel'];
    for (const mode of shown) expect(showsScanBanner(mode), mode).toBe(true);
    for (const mode of ['compress', 'images', 'protect', 'rotate', 'merge', 'imagesInside', 'sign'] as const) {
      expect(showsScanBanner(mode), mode).toBe(false);
    }
  });

  it('the grid says what it is for', () => {
    expect(gridHint('reorder')).toBe('drag');
    expect(gridHint('merge')).toBe('drag');
    expect(gridHint('delete')).toBe('tick');
    expect(gridHint('extract')).toBe('tick');
    expect(gridHint('split')).toBe('tick');
    // split-pdf's default, a PDF per page, needs no ticks
    expect(gridHint('split', false)).toBe('drag');
    expect(gridHint('rotate')).toBe('turn');
  });

  it('the phone bar shows the primary label at every width', () => {
    const toolbar = read('components/edit-pdf/Toolbar.tsx');
    expect(toolbar).not.toMatch(/hidden min-\[400px\]:inline/);
    const workspace = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(workspace).toMatch(/<PrimaryButton \{\.\.\.primaryProps\} wide \/>/);
  });
});

describe('page ranges', () => {
  it('ticks "1-3, 5, 8-10" as 0-based pages, in order, without duplicates', () => {
    expect(pagesFromRanges('1-3, 5, 8-10', 61)).toEqual({ indices: [0, 1, 2, 4, 7, 8, 9] });
    expect(pagesFromRanges('3, 1-2, 2', 5)).toEqual({ indices: [0, 1, 2] });
    expect(pagesFromRanges(' 61 ', 61)).toEqual({ indices: [60] });
    // A trailing comma or an empty part is fine
    expect(pagesFromRanges('1, 2,', 5)).toEqual({ indices: [0, 1] });
  });

  it('reads Arabic-Indic digits, the Arabic comma and an en dash', () => {
    expect(pagesFromRanges('١-٣، ٥', 10)).toEqual({ indices: [0, 1, 2, 4] });
    expect(pagesFromRanges('2–4', 10)).toEqual({ indices: [1, 2, 3] });
  });

  it('says what is wrong, naming the part at fault', () => {
    expect(pagesFromRanges('  ', 10)).toEqual({ problem: 'empty' });
    expect(pagesFromRanges('1-3, abc', 10)).toEqual({ problem: 'format', part: 'abc' });
    expect(pagesFromRanges('0', 10)).toEqual({ problem: 'format', part: '0' });
    expect(pagesFromRanges('1--3', 10)).toEqual({ problem: 'format', part: '1--3' });
    expect(pagesFromRanges('5-2', 10)).toEqual({ problem: 'reversed', part: '5-2' });
    expect(pagesFromRanges('1-70', 61)).toEqual({ problem: 'outOfRange' });
    expect(pagesFromRanges('62', 61)).toEqual({ problem: 'outOfRange' });
  });
});

describe('the crop fits every page it goes on', () => {
  const BOX: VisualBox = { xPct: 0.1, yPct: 0.1, wPct: 0.5, hPct: 0.5 };
  const state = openingState('crop', [A4, STRIP, A4]);

  it('names the first page where it would keep less than MIN_CROP_PT, measured on that page', () => {
    // Half of 30 pt is 15 pt: too short on the strip, fine on A4
    expect(cropTooSmallOn(state.doc, state.sourcePages, ['s0', 's1', 's2'], BOX)).toBe(2);
    expect(cropTooSmallOn(state.doc, state.sourcePages, ['s0', 's2'], BOX)).toBeNull();
    expect(cropTooSmallOn(state.doc, state.sourcePages, ['s0'], { ...BOX, hPct: 0.02 })).toBe(1);
  });

  it('measures each page as it shows: a turned strip is 30 pt wide', () => {
    const turned = run(state, { type: 'rotatePage', pageId: 's1' });
    expect(cropTooSmallOn(turned.doc, turned.sourcePages, ['s1'], { xPct: 0, yPct: 0, wPct: 0.5, hPct: 1 })).toBe(2);
    expect(cropTooSmallOn(turned.doc, turned.sourcePages, ['s1'], { xPct: 0, yPct: 0, wPct: 1, hPct: 0.5 })).toBeNull();
  });

  it('page numbers follow the doc order after a move', () => {
    const moved = run(state, { type: 'movePageTo', pageId: 's1', index: 0 });
    expect(cropTooSmallOn(moved.doc, moved.sourcePages, ['s1', 's2'], BOX)).toBe(1);
  });

  it('applying to selected or all pages checks them all before anything changes', () => {
    const source = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(source).toMatch(/const tooSmall = box \? cropTooSmallOn\(s\.doc, s\.sourcePages, pageIds, box\) : null;\s+if \(tooSmall !== null\) \{\s+block\(tWorkspace\('crop\.tooSmallOn', \{ number: tooSmall \}\), LONG_NOTICE_MS\);\s+return false;/);
    expect(source).toMatch(/\(box: VisualBox \| null\) => void cropPages\(cropTargetIds\(cropTarget\), box\)/);
  });
});
