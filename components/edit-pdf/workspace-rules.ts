/**
 * Rules the workspace UI follows per mode and per working source. Pure: no
 * React, no DOM, so tests/workspace-ui-fixes.test.ts runs them in Node.
 *
 *  - A file pdf.js opens without a password is shown and read as it is.
 *    pdf-lib may still be unable to write it: encrypted (an owner password,
 *    restrictions only) or unreadable to it. `needsFix` says so, and only a
 *    step that writes with pdf-lib (or, for restrictions, uploads) asks for
 *    the fix first: getting the text or the pictures in it never does.
 *  - A fix that rewrites the whole file (OCR, repair, unlock) renumbers its
 *    objects, so it waits until no changed line points at a font object.
 *  - What a grid page opens with and says, the scan banner's modes, the
 *    task card's choices (split, extract), what the All tools panel lists,
 *    the page-range field and the crop's minimum size on every page it goes on.
 */
import { MIN_CROP_PT, pageVisualSize, type DocStamps, type EditorDoc, type PageId, type SourcePageInfo, type VisualBox } from '@/lib/edit-pdf';
import { parsePageRanges } from '@/lib/utils';
import { MODES } from '@/lib/workspace/modes';
import { effectivePlan } from '@/lib/workspace/summary';
import type { SavePlan, WorkspaceMode } from '@/lib/workspace/types';
import { editorReducer, initialEditorState, type EditorState } from './state';

// ── A source pdf-lib can't write yet ──────────────────────────────────────

/** What a source needs before pdf-lib can write it: its restrictions removed, or a repair. */
export type SourceFix = 'unlock' | 'repair';

/**
 * For a file pdf.js opened without a password: what pdf-lib needs first.
 * `inspection` is inspectPdf's verdict ('unknown' = the engine didn't load,
 * which never blocks on its own); `encryptFilter` is pdf.js's EncryptFilterName.
 */
export function fixForSource(inspection: 'encrypted' | 'unreadable' | 'ok' | 'unknown', encryptFilter: boolean): SourceFix | null {
  if (inspection === 'encrypted' || encryptFilter) return 'unlock';
  return inspection === 'unreadable' ? 'repair' : null;
}

/**
 * The fix a save has to run first, or null. `exports`: the doc's changes are
 * applied (request !== null). pdf-lib also cuts files and removes metadata;
 * the server's steps can't take an encrypted file, but take a damaged one.
 * Text and the pictures inside come out of pdf.js, so as is they need nothing.
 */
export function fixBeforeSave(needsFix: SourceFix | null, plan: SavePlan, exports: boolean): SourceFix | null {
  if (!needsFix) return null;
  const p = effectivePlan(plan);
  if (exports || p.split.kind !== 'none' || p.alsoSelected || p.removeMetadata) return needsFix;
  const uploads = p.compress !== null || p.password !== null || p.format === 'word' || p.format === 'excel' || p.format === 'images' || p.format === 'pdfa';
  return uploads && needsFix === 'unlock' ? 'unlock' : null;
}

/**
 * Why a fix that rewrites the file can't run now: 'replaced' while a changed
 * line exists (its font is an object number, which the rewrite changes).
 */
export function fixRefusal(doc: EditorDoc, fix: SourceFix | 'ocr'): 'replaced' | null {
  void fix; // every one of them rewrites the file
  return doc.objects.some((o) => o.kind === 'replace') ? 'replaced' : null;
}

// ── What a mode opens with and shows ──────────────────────────────────────

/** The editor as a file opens in `mode`: rotate-pdf opens with every page ticked, so Turn left and right show at once. */
export function openingState(mode: WorkspaceMode, sourcePages: SourcePageInfo[], stamps?: DocStamps): EditorState {
  const state = initialEditorState(sourcePages, MODES[mode], stamps);
  return mode === 'rotate' ? editorReducer(state, { type: 'setPageSelection', pageIds: state.doc.pages.map((p) => p.id) }) : state;
}

/** Modes where a scan gets the "Make text searchable" banner: the ones about its text. */
const SCAN_BANNER_MODES: ReadonlySet<WorkspaceMode> = new Set<WorkspaceMode>(['edit', 'ocr', 'text', 'word', 'excel']);
export const showsScanBanner = (mode: WorkspaceMode): boolean => SCAN_BANNER_MODES.has(mode);

/**
 * What the All pages grid says it is for: tick pages, pick pages then turn
 * them, or drag them. `selecting`: the save uses the ticked pages (split-pdf's
 * default, a PDF per page, doesn't).
 */
export function gridHint(mode: WorkspaceMode, selecting = true): 'tick' | 'turn' | 'drag' {
  if (mode === 'delete' || mode === 'extract' || (mode === 'split' && selecting)) return 'tick';
  return mode === 'rotate' ? 'turn' : 'drag';
}

/** The save works on the ticked pages: only those, a PDF per group of them, or a second file of them. */
export function planUsesSelection(plan: SavePlan): boolean {
  const p = effectivePlan(plan);
  return plan.pages === 'selected' || p.split.kind === 'runs' || p.alsoSelected;
}

// ── The task card under the toolbar ───────────────────────────────────────

/** The plan saves one plain PDF of all the pages: nothing the card has to say. */
function plainPlan(plan: SavePlan): boolean {
  const p = effectivePlan(plan);
  return (
    p.format === 'pdf' && p.compress === null && p.password === null && !p.removeMetadata && !p.flatten &&
    p.pages === 'all' && p.split.kind === 'none' && !p.alsoSelected
  );
}

export type TaskCard = 'split' | 'extract' | 'protect' | 'compress' | 'imageType' | 'pdfaLevel' | 'result';

/**
 * The page's own choices, up front under the toolbar, while the plan still
 * has them; else just what the save gives ('result'). The pages that save as
 * they open (flatten, metadata, the converters) say what comes out; the other
 * pages only once the plan was changed from the Save dialog. OCR and repair
 * have their own banner.
 */
export function taskCard(mode: WorkspaceMode, plan: SavePlan): TaskCard | null {
  const pdf = plan.format === 'pdf';
  switch (mode) {
    case 'split':
    case 'extract':
    case 'protect':
    case 'compress':
      return pdf ? mode : 'result';
    case 'images':
      return plan.format === 'images' ? 'imageType' : 'result';
    case 'pdfa':
      return plan.format === 'pdfa' ? 'pdfaLevel' : 'result';
    case 'word':
    case 'excel':
    case 'text':
    case 'imagesInside':
    case 'flatten':
    case 'metadata':
      return 'result';
    case 'ocr':
    case 'repair':
      return null;
    default:
      return plainPlan(plan) ? null : 'result';
  }
}

/** The pages whose output is the point: their primary button names what the save gives. */
const OUTPUT_MODES: ReadonlySet<WorkspaceMode> = new Set<WorkspaceMode>(['split', 'extract', 'word', 'excel', 'images', 'text', 'imagesInside', 'pdfa']);

/**
 * The primary button says what the save delivers (saveButtonLabelKey: "Download
 * 3 PDFs (ZIP)", "Convert to Word") instead of the page's own label: on the
 * pages about their output, and on any page once the save gives something
 * other than one PDF. A primary that isn't a plain save (delete then save,
 * OCR, repair) keeps its label.
 */
export function labelsFromSave(mode: WorkspaceMode, save: { format: SavePlan['format']; zipped: boolean }): boolean {
  if (MODES[mode].primary.action !== 'save') return false;
  return OUTPUT_MODES.has(mode) || save.format !== 'pdf' || save.zipped;
}

/** split-pdf's four ways (null: a mix only the Save dialog makes). */
export type SplitChoice = 'perPage' | 'everyN' | 'ranges' | 'selected';

export function splitChoice(plan: SavePlan): SplitChoice | null {
  if (plan.alsoSelected) return null;
  if (plan.split.kind === 'runs') return 'ranges';
  if (plan.split.kind === 'every') return plan.pages === 'all' ? (plan.split.n === 1 ? 'perPage' : 'everyN') : null;
  return plan.pages === 'selected' ? 'selected' : null;
}

export function splitPatch(choice: SplitChoice, n: number): Partial<SavePlan> {
  switch (choice) {
    case 'perPage':
      return { pages: 'all', split: { kind: 'every', n: 1 }, alsoSelected: false };
    case 'everyN':
      return { pages: 'all', split: { kind: 'every', n }, alsoSelected: false };
    case 'ranges':
      return { pages: 'all', split: { kind: 'runs' }, alsoSelected: false };
    case 'selected':
      return { pages: 'selected', split: { kind: 'none' }, alsoSelected: false };
  }
}

/** extract-pages: the selected pages in one PDF, or each one as its own. */
export type ExtractChoice = 'together' | 'each';

export function extractChoice(plan: SavePlan): ExtractChoice | null {
  if (plan.pages !== 'selected' || plan.alsoSelected) return null;
  if (plan.split.kind === 'none') return 'together';
  return plan.split.kind === 'every' && plan.split.n === 1 ? 'each' : null;
}

export function extractPatch(choice: ExtractChoice): Partial<SavePlan> {
  return { pages: 'selected', alsoSelected: false, split: choice === 'each' ? { kind: 'every', n: 1 } : { kind: 'none' } };
}

// ── All tools: every feature in one place ─────────────────────────────────

export type AllToolsGroup = 'pages' | 'add' | 'text' | 'file' | 'fix';
export type AllToolId =
  | 'turn' | 'delete' | 'reorder' | 'addPdf' | 'addBlank' | 'crop'
  | 'text' | 'signature' | 'image' | 'date' | 'dateHijri' | 'watermark' | 'numbers' | 'letterhead' | 'draw' | 'shapes' | 'highlight' | 'cover'
  | 'replace'
  | 'split' | 'word' | 'excel' | 'images' | 'plainText' | 'imagesInside' | 'pdfa' | 'compress' | 'password' | 'metadata' | 'flatten'
  | 'ocr' | 'repair';

/** Grouped by goal, in the order the panel lists them. */
export const ALL_TOOLS: readonly { group: AllToolsGroup; items: readonly AllToolId[] }[] = [
  { group: 'pages', items: ['turn', 'delete', 'reorder', 'addPdf', 'addBlank', 'crop'] },
  { group: 'add', items: ['text', 'signature', 'image', 'date', 'dateHijri', 'watermark', 'numbers', 'letterhead', 'draw', 'shapes', 'highlight', 'cover'] },
  { group: 'text', items: ['replace'] },
  { group: 'file', items: ['split', 'word', 'excel', 'images', 'plainText', 'imagesInside', 'pdfa', 'compress', 'password', 'metadata', 'flatten'] },
  { group: 'fix', items: ['ocr', 'repair'] },
];

/**
 * "Get a different file": the Save dialog opens on the current plan with
 * this choice made (null for the other groups). A password and a split don't
 * go together, so locking ends a split.
 */
export function toolPlanPatch(id: AllToolId, plan: SavePlan): Partial<SavePlan> | null {
  switch (id) {
    case 'split':
      return { format: 'pdf', password: null, ...splitPatch('perPage', 1) };
    case 'word':
      return { format: 'word' };
    case 'excel':
      return { format: 'excel' };
    case 'images':
      return { format: 'images' };
    case 'plainText':
      return { format: 'text' };
    case 'imagesInside':
      return { format: 'imagesInside' };
    case 'pdfa':
      return { format: 'pdfa' };
    case 'compress':
      return { format: 'pdf', compress: plan.compress ?? 'medium' };
    case 'password':
      return { format: 'pdf', password: plan.password ?? '', split: { kind: 'none' } };
    case 'metadata':
      return { format: 'pdf', removeMetadata: true };
    case 'flatten':
      return { flatten: true };
    default:
      return null;
  }
}

// ── "1-3, 5, 8-10" ────────────────────────────────────────────────────────

export type RangeResult = { indices: number[] } | { problem: 'empty' } | { problem: 'format' | 'reversed'; part: string } | { problem: 'outOfRange' };

/** Arabic-Indic and Persian digits, the Arabic comma and dashes, as parsePageRanges reads them. */
function normalizeRanges(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[،;]/g, ',')
    .replace(/[‐-―−]/g, '-');
}

/**
 * The 0-based pages "1-3, 5, 8-10" names in a doc of `pageCount` pages, or
 * what is wrong with it (the first part at fault). Empty parts ("1, 2,") are
 * skipped. The parsing itself is parsePageRanges', as on the old tool pages.
 */
export function pagesFromRanges(text: string, pageCount: number): RangeResult {
  const parts = normalizeRanges(text)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { problem: 'empty' };
  for (const part of parts) {
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) return { problem: 'format', part };
    const start = Number(m[1]);
    const end = m[2] === undefined ? start : Number(m[2]);
    if (start < 1) return { problem: 'format', part };
    if (start > end) return { problem: 'reversed', part };
    if (end > pageCount) return { problem: 'outOfRange' };
  }
  return { indices: parsePageRanges(parts.join(','), pageCount) };
}

// ── Crop ──────────────────────────────────────────────────────────────────

/**
 * The 1-based number of the first page in `pageIds` (doc order) on which
 * `box` keeps less than MIN_CROP_PT either way, measured on that page as it
 * shows; null when it fits on all of them. The export refuses such a crop.
 */
export function cropTooSmallOn(
  doc: EditorDoc,
  sourcePages: readonly SourcePageInfo[],
  pageIds: readonly PageId[],
  box: VisualBox,
): number | null {
  const ids = new Set(pageIds);
  for (let i = 0; i < doc.pages.length; i++) {
    const page = doc.pages[i];
    if (!ids.has(page.id)) continue;
    const size = pageVisualSize(page, sourcePages);
    if (box.wPct * size.width < MIN_CROP_PT || box.hPct * size.height < MIN_CROP_PT) return i + 1;
  }
  return null;
}
