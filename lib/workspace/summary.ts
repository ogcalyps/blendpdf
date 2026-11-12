/**
 * Pure helpers over the editor's doc and the save plan (workspace-spec.md
 * 5.4): what changed (Changes panel, analytics), which tools a save runs,
 * what stops a plan from saving, and what a save will deliver. The only
 * runtime imports are the pure ./names and ./cut (cut loads pdf-lib with
 * import()): the editor UI imports this file statically, the save pipeline
 * (./save, loaded with import()) too.
 */
import type { EditorDoc } from '@/lib/edit-pdf/types';
import { everyGroups, runGroups } from './cut';
import { outputName, partName, runName, selectedName } from './names';
import type { DocSummary, SaveFormat, SavePlan, SaveStep, WorkspaceMode } from './types';

export function summarizeDoc(doc: EditorDoc, basePageCount: number): DocSummary {
  const objects: DocSummary['objects'] = { text: 0, image: 0, shape: 0, line: 0, ink: 0, highlight: 0, cover: 0 };
  let signatures = 0;
  let changedLines = 0;
  for (const object of doc.objects) {
    if (object.kind === 'replace') {
      changedLines++;
      continue;
    }
    objects[object.kind]++;
    if (object.kind === 'image' && object.signature) signatures++;
  }

  let kept = 0;
  let lastIndex = -1;
  let moved = false;
  let turnedPages = 0;
  let croppedPages = 0;
  let blankPages = 0;
  let insertedPages = 0;
  for (const page of doc.pages) {
    if (page.rotation !== 0) turnedPages++;
    if (page.crop) croppedPages++;
    if (page.source.kind === 'blank') {
      blankPages++;
    } else if (page.source.index >= basePageCount) {
      insertedPages++;
    } else {
      kept++;
      if (page.source.index < lastIndex) moved = true;
      lastIndex = page.source.index;
    }
  }

  return {
    deletedPages: basePageCount - kept,
    turnedPages,
    moved,
    blankPages,
    insertedPages,
    croppedPages,
    watermark: Boolean(doc.stamps?.watermark),
    pageNumbers: Boolean(doc.stamps?.pageNumbers),
    letterhead: Boolean(doc.stamps?.letterhead),
    objects,
    signatures,
    changedLines,
  };
}

/**
 * The plan as runSave applies it: PDF-only options are dropped for other
 * formats, "also selected" needs all pages and no split, "runs" needs all
 * pages, and an empty password adds none.
 */
export function effectivePlan(plan: SavePlan): SavePlan {
  const pdf = plan.format === 'pdf';
  const split = !pdf || (plan.split.kind === 'runs' && plan.pages !== 'all') ? { kind: 'none' as const } : plan.split;
  return {
    ...plan,
    compress: pdf ? plan.compress : null,
    compressLimitMb: pdf && plan.compress ? plan.compressLimitMb : null,
    password: pdf && plan.password ? plan.password : null,
    removeMetadata: pdf && plan.removeMetadata,
    split,
    alsoSelected: pdf && plan.alsoSelected && plan.pages === 'all' && split.kind === 'none',
  };
}

/**
 * GA tool names this save performs, client-side and server-side (one analytics
 * run each). On /split-pdf, keeping the selected pages is the split itself
 * (split_pdf), not extract_pages.
 */
export function opsForSave(summary: DocSummary, plan: SavePlan, mode?: WorkspaceMode): { client: string[]; server: string[] } {
  const p = effectivePlan(plan);
  const objects = Object.values(summary.objects).reduce((sum, n) => sum + n, 0);
  const pick = (rows: [boolean, string][]) => rows.filter(([on]) => on).map(([, tool]) => tool);
  const usesSelection = p.pages === 'selected' || p.alsoSelected;
  const splitPage = mode === 'split';
  return {
    client: pick([
      [objects - summary.signatures > 0 || summary.changedLines > 0 || summary.blankPages > 0 || summary.letterhead, 'edit_pdf'],
      [summary.signatures > 0, 'sign_pdf'],
      [summary.croppedPages > 0, 'crop_pdf'],
      [summary.turnedPages > 0, 'rotate_pdf'],
      [summary.moved, 'reorder_pdf'],
      [summary.deletedPages > 0, 'delete_pages'],
      [summary.insertedPages > 0, 'merge_pdf'],
      [summary.watermark, 'watermark_pdf'],
      [summary.pageNumbers, 'add_page_numbers'],
      [p.flatten, 'flatten_pdf'],
      [p.removeMetadata, 'remove_metadata'],
      [usesSelection && !splitPage, 'extract_pages'],
      [p.split.kind !== 'none' || (usesSelection && splitPage), 'split_pdf'],
      [p.format === 'text', 'pdf_to_text'],
      [p.format === 'imagesInside', 'extract_images'],
    ]),
    server: pick([
      [p.compress !== null, 'compress_pdf'],
      [p.password !== null, 'protect_pdf'],
      [p.format === 'word', 'pdf_to_word'],
      [p.format === 'excel', 'pdf_to_excel'],
      [p.format === 'images', 'pdf_to_images'],
      [p.format === 'pdfa', 'pdf_to_pdfa'],
    ]),
  };
}

/**
 * Why the Save dialog can't save this plan (workspace.save.<problem>, and
 * workspace.needs.password for passwordEmpty). 'onlyPdf' is the one notice
 * that doesn't block: PDF-only options set while saving another format are
 * ignored (effectivePlan).
 */
export type PlanProblem = 'needsSelection' | 'onlyPdf' | 'protectSplit' | 'passwordEmpty' | 'nothingToDo' | 'runsNeedAll' | 'everyN' | 'sizeLimit';

export interface PlanContext {
  /** Pages selected in the editor. */
  selected: number;
  /** Pages in the doc. */
  pages: number;
  /** hasChanges(doc, base). */
  changed: boolean;
}

/** The largest "a PDF every N pages" ({max} of workspace.save.everyN): the pages the save keeps. */
export function maxEveryN(plan: SavePlan, ctx: PlanContext): number {
  return plan.pages === 'selected' ? ctx.selected : ctx.pages;
}

/** The size limits the compress route takes, in MB. */
export const MIN_LIMIT_MB = 0.1;
export const MAX_LIMIT_MB = 50;
export function validLimitMb(mb: number): boolean {
  return mb >= MIN_LIMIT_MB && mb <= MAX_LIMIT_MB;
}

export function planProblems(plan: SavePlan, ctx: PlanContext): PlanProblem[] {
  const problems: PlanProblem[] = [];
  const pdf = plan.format === 'pdf';
  const usesSelection = plan.pages === 'selected' || (pdf && (plan.alsoSelected || plan.split.kind === 'runs'));
  if (usesSelection && ctx.selected === 0) problems.push('needsSelection');
  if (!pdf && (plan.compress !== null || plan.password !== null || plan.removeMetadata || plan.split.kind !== 'none' || plan.alsoSelected)) {
    problems.push('onlyPdf');
  }
  if (pdf && plan.password !== null && plan.split.kind !== 'none') problems.push('protectSplit');
  if (pdf && plan.password === '') problems.push('passwordEmpty');
  if (pdf && plan.compress !== null && plan.compressLimitMb !== null && !validLimitMb(plan.compressLimitMb)) problems.push('sizeLimit');
  if (pdf && plan.split.kind === 'runs' && plan.pages !== 'all') problems.push('runsNeedAll');
  if (pdf && plan.split.kind === 'every') {
    const n = plan.split.n;
    if (!Number.isInteger(n) || n < 1 || n > maxEveryN(plan, ctx)) problems.push('everyN');
  }
  const p = effectivePlan(plan);
  const plain =
    p.format === 'pdf' && p.compress === null && p.password === null && !p.removeMetadata && !p.flatten &&
    p.pages === 'all' && p.split.kind === 'none' && !p.alsoSelected;
  if (!ctx.changed && plain) problems.push('nothingToDo');
  return problems;
}

// ── What a save delivers ────────────────────────────────────────────────────

/**
 * What describeSave needs. pageCount and selected are the doc's (all its
 * pages, the 0-based positions ticked): for "selected pages only" it keeps
 * the selection itself, as the editor builds SaveInput (SaveInput's own
 * pageCount and selected give the same answer).
 */
export interface SaveContext {
  pageCount: number;
  selected: readonly number[];
  /** SaveInput.baseName. */
  baseName: string;
  /** MODES[mode].suffix. */
  suffix: string;
  /** PlanContext.changed, so one context also feeds planProblems (planContextOf). */
  changed: boolean;
}

export interface SaveDescription {
  format: SaveFormat;
  /** Files delivered (1 unless zipped). 0 for the pictures inside: not known until the PDF is read. */
  files: number;
  zipped: boolean;
  /** What downloads. The pictures inside: the ZIP, though one picture alone comes as `${base}_image_1.png`. */
  filename: string;
  /** PDF only ([] otherwise): each file and its 1-based pages in the saved PDF. */
  parts: { filename: string; pages: number[] }[];
}

export function planContextOf(ctx: SaveContext): PlanContext {
  return { selected: new Set(ctx.selected).size, pages: ctx.pageCount, changed: ctx.changed };
}

/**
 * What runSave will deliver for this plan, from the same names and groups it
 * uses (tests/workspace-save.test.ts runs both over a table of plans).
 */
export function describeSave(plan: SavePlan, ctx: SaveContext): SaveDescription {
  const p = effectivePlan(plan);
  const base = ctx.baseName;
  const ticked = [...new Set(ctx.selected)].sort((a, b) => a - b);
  // "Selected pages only" exports just those: they are the saved PDF's pages, all selected.
  const pageCount = p.pages === 'selected' ? ticked.length : ctx.pageCount;
  const selected = p.pages === 'selected' ? ticked.map((_, i) => i) : ticked;
  const zipName = outputName(base, ctx.suffix, 'zip');
  const single = (filename: string): SaveDescription => ({ format: p.format, files: 1, zipped: false, filename, parts: [] });
  const zipped = (files: number): SaveDescription => ({ format: p.format, files, zipped: true, filename: zipName, parts: [] });

  switch (p.format) {
    case 'word':
      return single(outputName(base, ctx.suffix, 'docx'));
    case 'excel':
      return single(outputName(base, ctx.suffix, 'xlsx'));
    case 'pdfa':
      return single(outputName(base, ctx.suffix, 'pdf'));
    case 'text':
      return single(outputName(base, ctx.suffix, 'txt'));
    case 'images':
      return pageCount === 1 ? single(`${base}_page-1.${p.imageType}`) : zipped(pageCount);
    case 'imagesInside':
      return zipped(0);
  }

  const whole = { filename: outputName(base, ctx.suffix, 'pdf'), pages: Array.from({ length: pageCount }, (_, i) => i) };
  let groups = [whole];
  if (p.split.kind === 'every') {
    const every = everyGroups(pageCount, p.split.n);
    if (every.length > 1) groups = every.map((pages, i) => ({ filename: partName(base, i + 1), pages }));
  } else if (p.split.kind === 'runs') {
    groups = runGroups(selected).map((pages) => ({ filename: runName(base, pages[0] + 1, pages[pages.length - 1] + 1), pages }));
  } else if (p.alsoSelected) {
    groups = [whole, { filename: selectedName(base), pages: selected }];
  }
  const parts = groups.map((group) => ({ filename: group.filename, pages: group.pages.map((i) => i + 1) }));
  return parts.length === 1
    ? { format: 'pdf', files: 1, zipped: false, filename: parts[0].filename, parts }
    : { format: 'pdf', files: parts.length, zipped: true, filename: zipName, parts };
}

/** Every message saveButtonLabelKey can name (tests check each in both locales). */
export const SAVE_LABEL_KEYS = [
  'workspace.export.button.pdf',
  'workspace.export.button.pdfs',
  'workspace.export.button.word',
  'workspace.export.button.excel',
  'workspace.export.button.images',
  'workspace.export.button.text',
  'workspace.export.button.imagesInside',
  'workspace.export.button.pdfa',
] as const;

/** The Save button's words for what it delivers ("Download 3 PDFs (ZIP)", "Convert to Word"): a full message key and its values. */
export function saveButtonLabelKey(d: SaveDescription): { key: (typeof SAVE_LABEL_KEYS)[number]; values: { count: number } } {
  const values = { count: d.files };
  switch (d.format) {
    case 'pdf':
      return { key: d.zipped ? 'workspace.export.button.pdfs' : 'workspace.export.button.pdf', values };
    case 'images':
      return { key: 'workspace.export.button.images', values };
    default:
      return { key: `workspace.export.button.${d.format}`, values };
  }
}

// ── The Save dialog's choices ───────────────────────────────────────────────

/** "How many files?" in the Save dialog: "every" is "One PDF every [N] pages", "perPage" is N = 1. */
export type FilesChoice = 'one' | 'perPage' | 'every' | 'runs';

/** The plan after "Which pages?": ranges and "also selected" are cut from all the pages, so "selected only" drops them. */
export function withPages(plan: SavePlan, pages: SavePlan['pages']): SavePlan {
  if (pages === 'all') return { ...plan, pages };
  return { ...plan, pages, alsoSelected: false, split: plan.split.kind === 'runs' ? { kind: 'none' } : plan.split };
}

/** The plan after "How many files?" (n: the number in the "every" box). */
export function withFiles(plan: SavePlan, files: FilesChoice, n = 2): SavePlan {
  switch (files) {
    case 'one':
      return { ...plan, split: { kind: 'none' } };
    case 'perPage':
      return { ...plan, split: { kind: 'every', n: 1 }, alsoSelected: false };
    case 'every':
      return { ...plan, split: { kind: 'every', n }, alsoSelected: false };
    case 'runs':
      // Each range is cut from all the pages.
      return { ...plan, split: { kind: 'runs' }, pages: 'all', alsoSelected: false };
  }
}

/** The choices the dialog shows unavailable, each with its reason inline. */
export type SaveChoice = 'selectedPages' | 'perPage' | 'every' | 'runs' | 'alsoSelected' | 'password';

/**
 * Why picking each choice would stop the save (undefined = it can be picked):
 * planProblems of the plan with it picked, keeping only the problems that
 * choice brings (the others belong to choices made elsewhere).
 */
export function choiceProblems(plan: SavePlan, ctx: PlanContext): Record<SaveChoice, PlanProblem | undefined> {
  const pdf = { ...plan, format: 'pdf' as const };
  const brings = (next: SavePlan, kinds: readonly PlanProblem[]) => planProblems(next, ctx).find((p) => kinds.includes(p));
  return {
    selectedPages: brings(withPages(pdf, 'selected'), ['needsSelection']),
    perPage: brings(withFiles(pdf, 'perPage'), ['protectSplit']),
    every: brings(withFiles(pdf, 'every'), ['protectSplit']),
    runs: brings(withFiles(pdf, 'runs'), ['needsSelection', 'protectSplit']),
    alsoSelected: brings(withFiles({ ...pdf, alsoSelected: true }, 'one'), ['needsSelection']),
    password: brings({ ...pdf, password: plan.password ?? '' }, ['protectSplit']),
  };
}

/** "1-3, 5, 8-10" (as the page range box takes them), from 1-based page numbers. */
export function pageRanges(pages: readonly number[]): string {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    while (sorted[i + 1] === sorted[i] + 1) i++;
    out.push(first === sorted[i] ? `${first}` : `${first}-${sorted[i]}`);
  }
  return out.join(', ');
}

/**
 * The pages of describeSave's PDF files as the visitor numbers them (the
 * page strip's numbers, not the saved file's): `also` = "also selected",
 * whose second file `list` names; otherwise every file's pages, in order,
 * long lists shortened to the first three and the last. Empty for other formats.
 */
export function describePages(d: SaveDescription, plan: SavePlan, ctx: SaveContext): { also: boolean; pages: number; list: string } {
  const ticked = [...new Set(ctx.selected)].sort((a, b) => a - b);
  const inDoc = (n: number) => (effectivePlan(plan).pages === 'selected' ? ticked[n - 1] + 1 : n);
  const ranges = (pages: number[]) => pageRanges(pages.map(inDoc));
  if (d.format !== 'pdf') return { also: false, pages: 0, list: '' };
  if (effectivePlan(plan).alsoSelected && d.parts.length === 2) {
    return { also: true, pages: d.parts[1].pages.length, list: ranges(d.parts[1].pages) };
  }
  const lists = d.parts.map((part) => ranges(part.pages)).map((list) => (d.parts.length > 1 && list.includes(',') ? `(${list})` : list));
  const shown = lists.length > 6 ? [...lists.slice(0, 3), '…', lists[lists.length - 1]] : lists;
  return { also: false, pages: d.parts.reduce((sum, part) => sum + part.pages.length, 0), list: shown.join(', ') };
}

// ── Save errors ─────────────────────────────────────────────────────────────

/** workspace.save.errors.<code>. */
export type SaveErrorCode = 'tooBig' | 'wordPages' | 'imagePages' | 'busy' | 'server' | 'noText' | 'noImages' | 'noTables';
/** The source fixes (./fixes) decline a file over the server's cap with the same error. */
export type FixStep = 'unlock' | 'repair' | 'ocr';

/**
 * What runSave rejects with, besides EditPdfError from the export (handled
 * by the editor as before) and plain errors of the browser steps
 * (editPdf.saveError). Lives here so the UI can test `instanceof` without
 * loading the pipeline. `status`/`errorCode` feed trackToolError: the
 * server's own answer, or 422 for a file we decline before uploading.
 */
export class SaveError extends Error {
  readonly code: SaveErrorCode;
  readonly step: SaveStep | FixStep;
  readonly status?: number;
  readonly errorCode?: string;
  constructor(code: SaveErrorCode, step: SaveStep | FixStep, cause?: { message?: string; status?: number; errorCode?: string }) {
    super(cause?.message || code);
    this.name = 'SaveError';
    this.code = code;
    this.step = step;
    this.status = cause ? cause.status : 422;
    this.errorCode = cause ? cause.errorCode : code;
  }
}
