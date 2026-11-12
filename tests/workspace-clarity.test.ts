import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTranslator } from 'next-intl';
import { IntlProvider } from 'use-intl';
import { ModeTaskCard } from '@/components/edit-pdf/ModeTaskCard';
import { TaskHeader } from '@/components/edit-pdf/TaskHeader';
import {
  ALL_TOOLS,
  extractChoice,
  extractPatch,
  gridHint,
  labelsFromSave,
  planUsesSelection,
  splitChoice,
  splitPatch,
  taskCard,
  toolPlanPatch,
  type AllToolId,
} from '@/components/edit-pdf/workspace-rules';
import { MODES } from '@/lib/workspace/modes';
import { describeSave, planProblems, type SaveContext } from '@/lib/workspace/summary';
import { DEFAULT_SAVE_PLAN, type SavePlan, type WorkspaceMode } from '@/lib/workspace/types';

/**
 * The clarity pass on the workspace: what each page says it does, the task
 * card's choices (split-pdf's promise is its default), the primary button's
 * words, and the All tools panel listing every feature once.
 */
// next-intl's client entry imports next/navigation, which only resolves inside Next: its hooks are use-intl's
vi.mock('next-intl', () => import('use-intl'));

const ROOT = join(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

const plan = (over: Partial<SavePlan> = {}): SavePlan => ({ ...DEFAULT_SAVE_PLAN, ...over });
const presetOf = (mode: WorkspaceMode) => plan(MODES[mode].preset);
const ctx = (over: Partial<SaveContext> = {}): SaveContext => ({ pageCount: 3, selected: [], baseName: 'report', suffix: 'split', changed: false, ...over });
const planCtx = (c: SaveContext) => ({ selected: c.selected.length, pages: c.pageCount, changed: c.changed });
const MODE_LIST = Object.keys(MODES) as WorkspaceMode[];

describe('split-pdf keeps its promise in one click', () => {
  it('opens on one PDF per page, with nothing to pick first', () => {
    const p = presetOf('split');
    expect(MODES.split.primary).toMatchObject({ action: 'save', needs: null });
    expect(splitChoice(p)).toBe('perPage');
    expect(planProblems(p, planCtx(ctx()))).toEqual([]);
    expect(describeSave(p, ctx())).toMatchObject({ files: 3, zipped: true, filename: 'report_split.zip' });
    // Its grid doesn't ask for ticks until a choice uses them
    expect(planUsesSelection(p)).toBe(false);
    expect(gridHint('split', planUsesSelection(p))).toBe('drag');
  });

  it('offers every N pages, a PDF per group of selected pages and the selected pages in one PDF', () => {
    const base = presetOf('split');
    const every = plan({ ...base, ...splitPatch('everyN', 2) });
    expect(splitChoice(every)).toBe('everyN');
    expect(describeSave(every, ctx({ pageCount: 5 })).files).toBe(3);

    const ranges = plan({ ...base, ...splitPatch('ranges', 2) });
    expect(splitChoice(ranges)).toBe('ranges');
    expect(planProblems(ranges, planCtx(ctx()))).toEqual(['needsSelection']);
    expect(describeSave(ranges, ctx({ pageCount: 6, selected: [0, 1, 4] })).files).toBe(2);

    const selected = plan({ ...base, ...splitPatch('selected', 2) });
    expect(splitChoice(selected)).toBe('selected');
    expect(describeSave(selected, ctx({ selected: [0, 2] }))).toMatchObject({ files: 1, zipped: false });
    for (const p of [ranges, selected]) expect(planUsesSelection(p)).toBe(true);
    // A mix only the Save dialog makes picks none of the four
    expect(splitChoice(plan({ pages: 'selected', split: { kind: 'every', n: 2 } }))).toBeNull();
  });

  it('extract-pages: the selected pages in one PDF, or each as its own', () => {
    const p = presetOf('extract');
    expect(extractChoice(p)).toBe('together');
    const each = plan({ ...p, ...extractPatch('each') });
    expect(extractChoice(each)).toBe('each');
    expect(describeSave(each, ctx({ selected: [0, 2], suffix: 'extracted' }))).toMatchObject({ files: 2, zipped: true });
    expect(extractChoice(plan({ ...each, ...extractPatch('together') }))).toBe('together');
  });
});

describe('the task card', () => {
  it('protect-pdf saves from the card once the password is typed (no dialog)', () => {
    expect(MODES.protect.primary.action).toBe('save');
    expect(taskCard('protect', presetOf('protect'))).toBe('protect');
    // The first problem is what the blocked button says: "Type a password first"
    expect(planProblems(presetOf('protect'), planCtx(ctx()))[0]).toBe('passwordEmpty');
    expect(planProblems(plan({ password: 'pw' }), planCtx(ctx()))).toEqual([]);
  });

  it('shows each page its own choices, while the plan still has them', () => {
    expect(taskCard('split', presetOf('split'))).toBe('split');
    expect(taskCard('extract', presetOf('extract'))).toBe('extract');
    expect(taskCard('compress', presetOf('compress'))).toBe('compress');
    expect(taskCard('images', presetOf('images'))).toBe('imageType');
    // Saved as Word from the dialog: only what comes out
    expect(taskCard('compress', plan({ format: 'word' }))).toBe('result');
    expect(taskCard('images', plan())).toBe('result');
    for (const mode of ['word', 'excel', 'text', 'imagesInside', 'flatten', 'metadata'] as const) {
      expect(taskCard(mode, presetOf(mode)), mode).toBe('result');
    }
  });

  it('stays out of the way on the one-click and editing pages until the plan changes', () => {
    for (const mode of ['edit', 'sign', 'crop', 'rotate', 'delete', 'reorder', 'merge', 'watermark', 'numbers', 'unlock', 'converted'] as const) {
      expect(taskCard(mode, presetOf(mode)), mode).toBeNull();
      expect(taskCard(mode, plan({ compress: 'medium' })), mode).toBe('result');
    }
    // OCR and repair have their own banner
    expect(taskCard('ocr', plan({ format: 'word' }))).toBeNull();
    expect(taskCard('repair', plan())).toBeNull();
  });
});

describe('the primary button and the header say what happens', () => {
  it('names the output on the pages about it, and when a save gives more than one PDF', () => {
    const d = (p: SavePlan, c = ctx()) => describeSave(p, c);
    expect(labelsFromSave('split', d(presetOf('split')))).toBe(true);
    expect(labelsFromSave('word', d(presetOf('word')))).toBe(true);
    expect(labelsFromSave('compress', d(presetOf('compress')))).toBe(false);
    expect(labelsFromSave('protect', d(plan({ password: 'pw' })))).toBe(false);
    expect(labelsFromSave('edit', d(plan()))).toBe(false);
    expect(labelsFromSave('edit', d(plan({ format: 'excel' })))).toBe(true);
    expect(labelsFromSave('edit', d(plan({ split: { kind: 'every', n: 1 } })))).toBe(true);
    // "Delete 2 pages", OCR and repair keep their own words
    expect(labelsFromSave('delete', d(plan({ split: { kind: 'every', n: 1 } })))).toBe(false);
    expect(labelsFromSave('ocr', d(plan({ format: 'word' })))).toBe(false);
  });
});

describe('All tools lists every feature once', () => {
  const ids = ALL_TOOLS.flatMap((g) => g.items);

  it('has each row once, in the five goals', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ALL_TOOLS.map((g) => g.group)).toEqual(['pages', 'add', 'text', 'file', 'fix']);
  });

  it('covers every toolbar tool, every Insert item and every format the Save dialog offers', () => {
    // Shapes opens on the rectangle; the toolbar's Shapes menu has the others
    const tools: Record<string, AllToolId> = { text: 'text', draw: 'draw', rectangle: 'shapes', ellipse: 'shapes', line: 'shapes', arrow: 'shapes', highlight: 'highlight', cover: 'cover', replace: 'replace', crop: 'crop' };
    const inserts: Record<string, AllToolId> = { image: 'image', signature: 'signature', date: 'date', dateHijri: 'dateHijri', watermark: 'watermark', numbers: 'numbers', pdf: 'addPdf' };
    for (const id of [...Object.values(tools), ...Object.values(inserts)]) expect(ids).toContain(id);
    const formats = new Set(ids.map((id) => toolPlanPatch(id, plan())?.format).filter(Boolean));
    expect([...formats].sort()).toEqual(['excel', 'images', 'imagesInside', 'pdf', 'pdfa', 'text', 'word']);
  });

  it('opens the Save dialog with each "Get a different file" choice made, and nothing else', () => {
    for (const { group, items } of ALL_TOOLS) {
      for (const id of items) expect(toolPlanPatch(id, plan()) !== null, id).toBe(group === 'file');
    }
    // A password ends a split (they don't go together); a split drops the password
    expect(planProblems(plan({ split: { kind: 'every', n: 1 }, ...toolPlanPatch('password', plan()), password: 'pw' }), planCtx(ctx()))).toEqual([]);
    expect(planProblems(plan({ password: 'pw', ...toolPlanPatch('split', plan()) }), planCtx(ctx()))).toEqual([]);
  });
});

// ── Copy: both locales ──

function messages(locale: 'en' | 'ar'): Record<string, unknown> {
  return JSON.parse(read(`messages/${locale}.json`)) as Record<string, unknown>;
}

describe.each(['en', 'ar'] as const)('the clarity copy in %s', (locale) => {
  const errors: string[] = [];
  const t = createTranslator({ locale, messages: messages(locale), onError: (e) => errors.push(e.message) }) as unknown as (key: string, values?: Record<string, unknown>) => string;

  it('has a sentence for every mode', () => {
    for (const mode of MODE_LIST) expect(t(`workspace.task.${mode}`).trim(), mode).not.toBe('');
    expect(t('workspace.task.pages', { count: 2 })).toMatch(/2|٢|صفحتان/);
    expect(errors).toEqual([]);
  });

  it('names every All tools row and group, and every card line, with its placeholders kept', () => {
    for (const { group, items } of ALL_TOOLS) {
      expect(t(`workspace.all.groups.${group}`)).not.toMatch(/^workspace\./);
      for (const id of items) {
        expect(t(`workspace.all.items.${id}.name`), id).not.toMatch(/^workspace\./);
        expect(t(`workspace.all.items.${id}.line`), id).not.toMatch(/^workspace\./);
      }
    }
    for (const key of ['pdfs', 'images']) expect(t(`workspace.card.result.${key}`, { name: 'a.zip', count: 3 })).toContain('a.zip');
    for (const key of ['pdf', 'word', 'excel', 'text', 'image', 'imagesInside']) expect(t(`workspace.card.result.${key}`, { name: 'a.x' })).toContain('a.x');
    expect(errors).toEqual([]);
  });

  it('uses no em-dash', () => {
    expect(JSON.stringify(messages(locale).workspace)).not.toContain('—');
  });
});

describe('the editor wires it', () => {
  const source = read('components/edit-pdf/EditorWorkspace.tsx');

  it('opens with the task header, and Choose another PDF lives only there', () => {
    expect(source.indexOf('<TaskHeader')).toBeGreaterThan(-1);
    expect(source.indexOf('<TaskHeader')).toBeLessThan(source.indexOf('<Toolbar'));
    expect(source).not.toMatch(/onClick=\{chooseAnother\}/);
    expect(source).toMatch(/onChooseAnother=\{chooseAnother\}/);
  });

  it('runs each All tools row through the editor and opens the Save dialog on a plan', () => {
    // pickAllTool counts the pick (tool_pick), then runs it
    expect(source).toMatch(/<AllToolsPanel place=\{allTools\} blocked=\{toolBlocked\} onPick=\{pickAllTool\}/);
    expect(source).toMatch(/const pickAllTool = \(id: AllToolId\) => \{\s+trackEvent\('tool_pick', \{ tool_id: id, surface: 'all_tools' \}\);\s+runTool\(id\);\s+\};/);
    expect(source).toMatch(/initialPlan=\{dialog\.plan\}/);
    expect(source).toMatch(/<ModeTaskCard[\s\S]*?result=\{saveDescription\}/);
  });
});

describe('the header and the card render what they say', () => {
  const html = (locale: 'en' | 'ar', node: ReturnType<typeof createElement>) =>
    renderToStaticMarkup(createElement(IntlProvider, { locale, messages: messages(locale), children: node }));

  it.each(['en', 'ar'] as const)('the header names the file, its pages and size, and what the page does in %s', (locale) => {
    const out = html(
      locale,
      createElement(TaskHeader, {
        mode: 'compress',
        fileName: 'report.pdf',
        pageCount: 3,
        bytes: 36 * 1024,
        allToolsOpen: false,
        onAllTools: () => undefined,
        onChooseAnother: () => undefined,
      }),
    );
    const t = createTranslator({ locale, messages: messages(locale) }) as unknown as (key: string) => string;
    expect(out).toContain('report.pdf');
    expect(out).toContain(t('workspace.task.compress'));
    // Nothing about where it runs: no browser or server talk
    expect(out).not.toMatch(/server|browser|خادم|متصفح/);
    expect(out).toContain(t('workspace.all.button'));
  });

  it('split-pdf\'s card has its four ways, the default ticked, and says what comes out', () => {
    const p = presetOf('split');
    const out = html(
      'en',
      createElement(ModeTaskCard, {
        card: 'split',
        plan: p,
        onPlan: () => undefined,
        result: describeSave(p, ctx()),
        selectedCount: 0,
        pageCount: 3,
        onSelectPages: () => undefined,
        onSubmit: () => undefined,
      }),
    );
    expect(out.match(/type="radio"/g)).toHaveLength(4);
    expect(out).toMatch(/<input type="radio"[^>]*checked=""[^>]*>[^]*?One PDF per page/);
    expect(out).toContain('a ZIP with 3 PDFs');
    expect(out).toContain('report_split.zip');
  });
});
