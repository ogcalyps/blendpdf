/**
 * The Save dialog's logic (components/edit-pdf/SaveDialog.tsx), pure and in
 * Node: what each choice does to the plan, which choices can't be picked and
 * why, the page lists under "How many files?" and in "You'll get", and the
 * Save button's words. That describeSave matches runSave's real output is
 * tests/workspace-save.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import {
  SAVE_LABEL_KEYS,
  choiceProblems,
  describePages,
  describeSave,
  pageRanges,
  planContextOf,
  planProblems,
  saveButtonLabelKey,
  withFiles,
  withPages,
  type SaveContext,
} from '@/lib/workspace/summary';
import { DEFAULT_SAVE_PLAN, type SavePlan } from '@/lib/workspace/types';

const plan = (over: Partial<SavePlan> = {}): SavePlan => ({ ...DEFAULT_SAVE_PLAN, ...over });
const ctxOf = (over: Partial<SaveContext> = {}): SaveContext => ({ pageCount: 5, selected: [], baseName: 'Report', suffix: 'edited', changed: true, ...over });

describe('what each choice does to the plan', () => {
  it('"selected pages only" drops ranges and "also selected" (both are cut from all the pages)', () => {
    expect(withPages(plan({ split: { kind: 'runs' }, alsoSelected: true }), 'selected')).toMatchObject({ pages: 'selected', split: { kind: 'none' }, alsoSelected: false });
    expect(withPages(plan({ split: { kind: 'every', n: 2 } }), 'selected').split).toEqual({ kind: 'every', n: 2 });
    expect(withPages(plan({ pages: 'selected' }), 'all').pages).toBe('all');
  });

  it('"How many files?" sets the split; ranges need all the pages', () => {
    expect(withFiles(plan({ alsoSelected: true }), 'one')).toMatchObject({ split: { kind: 'none' }, alsoSelected: true });
    expect(withFiles(plan({ alsoSelected: true }), 'perPage')).toMatchObject({ split: { kind: 'every', n: 1 }, alsoSelected: false });
    expect(withFiles(plan(), 'every', 3).split).toEqual({ kind: 'every', n: 3 });
    expect(withFiles(plan({ pages: 'selected' }), 'runs')).toMatchObject({ split: { kind: 'runs' }, pages: 'all' });
  });

  it('never leaves a plan that planProblems refuses for its own shape', () => {
    const ctx = { selected: 2, pages: 5, changed: true };
    for (const start of [plan(), plan({ pages: 'selected' }), plan({ split: { kind: 'runs' } })]) {
      for (const next of [withPages(start, 'selected'), withFiles(start, 'runs'), withFiles(withPages(start, 'selected'), 'runs')]) {
        expect(planProblems(next, ctx)).not.toContain('runsNeedAll');
      }
    }
  });
});

describe('which choices are unavailable, and why', () => {
  it.each<[string, Partial<SavePlan>, number, Partial<ReturnType<typeof choiceProblems>>]>([
    ['a plain save, pages selected: everything is open', {}, 2, {}],
    ['nothing selected: the choices that need a selection', {}, 0, { selectedPages: 'needsSelection', runs: 'needsSelection', alsoSelected: 'needsSelection' }],
    // split-pdf opens on "selected pages only": the split choices aren't the ones short of a selection.
    ['split-pdf, nothing selected', { pages: 'selected' }, 0, { selectedPages: 'needsSelection', runs: 'needsSelection', alsoSelected: 'needsSelection' }],
    ['a password: no split', { password: 'pw' }, 2, { perPage: 'protectSplit', every: 'protectSplit', runs: 'protectSplit' }],
    ['an empty password field still blocks the splits', { password: '' }, 2, { perPage: 'protectSplit', every: 'protectSplit', runs: 'protectSplit' }],
    ['a split: no password', { split: { kind: 'every', n: 2 } }, 2, { password: 'protectSplit' }],
    ['ranges: no password', { split: { kind: 'runs' } }, 2, { password: 'protectSplit' }],
    ['Word keeps the PDF choices as they would be', { format: 'word', password: 'pw' }, 2, { perPage: 'protectSplit', every: 'protectSplit', runs: 'protectSplit' }],
  ])('%s', (_, over, selected, expected) => {
    const none = { selectedPages: undefined, perPage: undefined, every: undefined, runs: undefined, alsoSelected: undefined, password: undefined };
    expect(choiceProblems(plan(over), { selected, pages: 5, changed: true })).toEqual({ ...none, ...expected });
  });

  it('a choice is unavailable exactly when picking it makes planProblems refuse for that reason', () => {
    const ctx = { selected: 0, pages: 5, changed: true };
    expect(choiceProblems(plan(), ctx).runs).toBe('needsSelection');
    expect(planProblems(withFiles(plan(), 'runs'), ctx)).toContain('needsSelection');
    expect(choiceProblems(plan(), { ...ctx, selected: 1 }).runs).toBeUndefined();
    expect(planProblems(withFiles(plan(), 'runs'), { ...ctx, selected: 1 })).toEqual([]);
  });
});

describe('page lists', () => {
  it('pageRanges writes pages the way the range box takes them', () => {
    expect(pageRanges([1, 2, 3, 5, 8, 9, 10])).toBe('1-3, 5, 8-10');
    expect(pageRanges([4, 2, 2])).toBe('2, 4');
    expect(pageRanges([7])).toBe('7');
    expect(pageRanges([])).toBe('');
  });

  it.each<[string, Partial<SavePlan>, Partial<SaveContext>, ReturnType<typeof describePages>]>([
    ['one PDF', {}, {}, { also: false, pages: 5, list: '1-5' }],
    ['the selected pages, by their numbers in the strip', { pages: 'selected' }, { selected: [4, 1, 2] }, { also: false, pages: 3, list: '2-3, 5' }],
    ['every 2', { split: { kind: 'every', n: 2 } }, {}, { also: false, pages: 5, list: '1-2, 3-4, 5' }],
    ['every 2 of the selected pages', { pages: 'selected', split: { kind: 'every', n: 2 } }, { selected: [0, 2, 5] }, { also: false, pages: 3, list: '(1, 3), 6' }],
    ['ranges of selected pages', { split: { kind: 'runs' } }, { selected: [0, 1, 3] }, { also: false, pages: 3, list: '1-2, 4' }],
    ['also the selected pages', { alsoSelected: true }, { selected: [2, 0] }, { also: true, pages: 2, list: '1, 3' }],
    ['a PDF per page of 10: the first three and the last', { split: { kind: 'every', n: 1 } }, { pageCount: 10 }, { also: false, pages: 10, list: '1, 2, 3, …, 10' }],
    ['not a PDF', { format: 'word' }, {}, { also: false, pages: 0, list: '' }],
  ])('%s', (_, over, ctx, expected) => {
    const p = plan(over);
    expect(describePages(describeSave(p, ctxOf(ctx)), p, ctxOf(ctx))).toEqual(expected);
  });

  it('planContextOf counts each selected page once', () => {
    expect(planContextOf(ctxOf({ selected: [1, 1, 3] }))).toEqual({ selected: 2, pages: 5, changed: true });
  });
});

describe('the Save button says what it delivers', () => {
  const label = (over: Partial<SavePlan>, ctx: Partial<SaveContext> = {}) => saveButtonLabelKey(describeSave(plan(over), ctxOf(ctx)));

  it.each<[string, Partial<SavePlan>, Partial<SaveContext>, string, number]>([
    ['one PDF', {}, {}, 'workspace.export.button.pdf', 1],
    ['a PDF with a password', { password: 'pw' }, {}, 'workspace.export.button.pdf', 1],
    ['3 PDFs', { split: { kind: 'every', n: 2 } }, {}, 'workspace.export.button.pdfs', 3],
    ['Word', { format: 'word' }, {}, 'workspace.export.button.word', 1],
    ['Excel', { format: 'excel' }, {}, 'workspace.export.button.excel', 1],
    ['images of 5 pages', { format: 'images' }, {}, 'workspace.export.button.images', 5],
    ['the image of 1 page', { format: 'images' }, { pageCount: 1 }, 'workspace.export.button.images', 1],
    ['text', { format: 'text' }, {}, 'workspace.export.button.text', 1],
    ['the pictures inside', { format: 'imagesInside' }, {}, 'workspace.export.button.imagesInside', 0],
  ])('%s', (_, over, ctx, key, count) => {
    expect(label(over, ctx)).toEqual({ key, values: { count } });
    expect(SAVE_LABEL_KEYS).toContain(key);
  });

  const ROOT = join(__dirname, '..');

  it.each(['en', 'ar'])('every label is a message in %s, for any count', (locale) => {
    const messages = JSON.parse(readFileSync(join(ROOT, `messages/${locale}.json`), 'utf8')) as Record<string, unknown>;
    const errors: string[] = [];
    const t = createTranslator({ locale, messages, onError: (e) => errors.push(e.message) });
    for (const key of SAVE_LABEL_KEYS) {
      for (const count of [1, 2, 3, 11, 100]) {
        const text = (t as unknown as (key: string, values: { count: number }) => string)(key, { count });
        expect(text, key).not.toBe(key);
        expect(text, key).not.toMatch(/[{}]/);
      }
    }
    expect(errors).toEqual([]);
  });
});
