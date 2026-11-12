/**
 * The editor's state and reducer. Pure: no React, no DOM, so the tests run it
 * in Node (tests/edit-pdf-ui-state.test.ts).
 *
 * Undo is a stack of EditorDoc snapshots (HISTORY_LIMIT each way). One entry
 * per committed gesture: drags, resizes and text edits keep a transient copy
 * in the components and dispatch once when the gesture ends.
 *
 * "Edit text (beta)" (phase-c-spec.md): a replace object is anchored to the
 * line it removes, so the reducer keeps one per line and refuses to turn a
 * page that holds one (the line's box can't follow a turn).
 *
 * "Keep the font" (keep-font-spec.md section 7): a line whose font analysis
 * came back opens with `autoSize`, so the engine picks the size (the
 * original size in the line's own font, a width fit in a look-alike) and
 * keeps picking it when the font changes; Smaller or Bigger step from the
 * size on screen and hand the size over to the visitor.
 *
 * Workspace (workspace-spec.md 4.1): pages can be ticked (selectedPageIds,
 * UI state like the current page, never in history) and acted on together;
 * a page may carry a crop and the doc two stamps (watermark, page numbers),
 * both in history. Insert PDF grows `sourcePages` (the working source got
 * pages appended); `basePageCount` stays the count the doc started from, so
 * Undo of an insert is "no changes" again.
 */
import {
  DEFAULT_STROKE_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  HISTORY_LIMIT,
  REPLACE_MAX_SIZE,
  REPLACE_MIN_SIZE,
  ZOOM_STEPS,
  defaultReplaceSize,
  pageVisualSize,
  rotateCropClockwise,
  rotateObjectClockwise,
  replaceSizeMax,
  stepReplaceSize,
  type DocStamps,
  type EditorDoc,
  type EditorObject,
  type EditorPage,
  type LineFont,
  type ObjectId,
  type PageId,
  type PaletteColor,
  type QuarterTurn,
  type ReplaceObject,
  type SourcePageInfo,
  type SourceTextLine,
  type VisualBox,
} from '@/lib/edit-pdf';
import type { ModeConfig } from '@/lib/workspace/types';

export type EditorTool =
  | 'select'
  | 'text'
  | 'draw'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'highlight'
  | 'cover'
  | 'replace'
  | 'crop';

/** Tools that turn back into Select after one object (Draw, Highlight, Cover and Edit text stay on). */
export const ONE_SHOT_TOOLS: readonly EditorTool[] = ['text', 'rectangle', 'ellipse', 'line', 'arrow'];
export const SHAPE_TOOLS: readonly EditorTool[] = ['rectangle', 'ellipse', 'line', 'arrow'];

/** Last used colour and size. Not part of history. */
export interface EditorStyle {
  textColor: PaletteColor;
  textSize: number;
  strokeColor: PaletteColor;
  strokeWidth: number;
}

export interface EditorState {
  doc: EditorDoc;
  past: EditorDoc[];
  future: EditorDoc[];
  sourcePages: SourcePageInfo[];
  currentPageId: PageId;
  selectedId: ObjectId | null;
  tool: EditorTool;
  zoom: number;
  style: EditorStyle;
  /** Pages the visitor ticked, in doc order. UI state: not in history. */
  selectedPageIds: readonly PageId[];
  /** The page a shift-click range starts from: the last one ticked or unticked. */
  selectionAnchor: PageId | null;
  view: 'page' | 'grid';
  /** Page count of the working source when the doc started (or was reset). hasChanges compares against it. */
  basePageCount: number;
}

export type EditorAction =
  | { type: 'addObject'; object: EditorObject }
  | { type: 'replaceObject'; object: EditorObject }
  | { type: 'deleteObject'; id: ObjectId }
  /** Fill again for the next person: the objects planNextPerson gives, as one undoable step. */
  | { type: 'nextPerson'; objects: readonly EditorObject[] }
  | { type: 'syncTextHeights'; heights: Record<ObjectId, number> }
  | { type: 'rotatePage'; pageId: PageId }
  | { type: 'deletePage'; pageId: PageId }
  | { type: 'movePage'; pageId: PageId; delta: -1 | 1 }
  | { type: 'insertBlankPage'; afterPageId: PageId }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'select'; id: ObjectId | null }
  | { type: 'setTool'; tool: EditorTool }
  | { type: 'goToPage'; pageId: PageId }
  | { type: 'setZoom'; zoom: number }
  | { type: 'setStyle'; patch: Partial<EditorStyle> }
  // ── Workspace ──
  /** One history entry for all of `pageIds`; null removes their crop. */
  | { type: 'setCrop'; pageIds: readonly PageId[]; crop: VisualBox | null }
  | { type: 'clearCrops' }
  /** Replaces doc.stamps (an empty one is dropped). */
  | { type: 'setStamps'; stamps: DocStamps }
  /**
   * The text a page put in the watermark changed (/watermark-pdf/id-copy's answers, typed
   * after the file opened): `from` becomes `to` in the doc and every history snapshot, so it
   * makes no Undo step of its own. Ignored once the visitor changed or removed that text.
   */
  | { type: 'retextPresetWatermark'; from: string; to: string }
  /** 1 = a quarter turn clockwise, 3 = counter-clockwise. Pages with a changed line are skipped. */
  | { type: 'rotatePages'; pageIds: readonly PageId[]; turns: 1 | 3 }
  /** Every turned page back upright (pages with a changed line are skipped). */
  | { type: 'resetRotations' }
  /** Refused when no page would remain. */
  | { type: 'deletePages'; pageIds: readonly PageId[] }
  | { type: 'movePageTo'; pageId: PageId; index: number }
  /** Pages appended to the working source: `sourcePages` is its new list, `indices` the pages to add (after `afterPageId`, the end when null). */
  | { type: 'insertSourcePages'; sourcePages: readonly SourcePageInfo[]; indices: readonly number[]; afterPageId: PageId | null }
  /** The working source was swapped (OCR, unlock, repair): keepDoc keeps the doc and history, else everything starts over. */
  | { type: 'replaceSource'; sourcePages: SourcePageInfo[]; keepDoc: boolean }
  | { type: 'togglePageSelection'; pageId: PageId; range?: boolean }
  | { type: 'setPageSelection'; pageIds: readonly PageId[] }
  | { type: 'setView'; view: 'page' | 'grid' };

export function initialDoc(sourcePages: readonly SourcePageInfo[]): EditorDoc {
  return {
    pages: sourcePages.map((_, i) => ({ id: `s${i}`, source: { kind: 'source', index: i }, rotation: 0 })),
    objects: [],
  };
}

/**
 * The editor as a file opens: the mode's view and tool (ModeConfig), and
 * `stamps` (the watermark and page numbers modes open with a default) as the
 * first history entry, so Undo takes it off and Save works at once.
 */
export function initialEditorState(
  sourcePages: SourcePageInfo[],
  mode?: Pick<ModeConfig, 'view' | 'tool'>,
  stamps?: DocStamps,
): EditorState {
  const doc = initialDoc(sourcePages);
  const state: EditorState = {
    doc,
    past: [],
    future: [],
    sourcePages,
    currentPageId: doc.pages[0]?.id ?? 's0',
    selectedId: null,
    tool: mode?.tool ?? 'select',
    zoom: 1,
    style: {
      textColor: DEFAULT_TEXT_COLOR,
      textSize: DEFAULT_TEXT_SIZE,
      strokeColor: DEFAULT_STROKE_COLOR,
      strokeWidth: DEFAULT_STROKE_WIDTH,
    },
    selectedPageIds: [],
    selectionAnchor: null,
    view: mode?.view ?? 'page',
    basePageCount: sourcePages.length,
  };
  return stamps ? editorReducer(state, { type: 'setStamps', stamps }) : state;
}

/**
 * True when the doc differs from the working source's first `basePageCount`
 * pages as they opened: any object, crop or stamp, or a page added, removed,
 * moved or turned. With the source's current page count instead, it says
 * whether the source bytes ARE the result (the save's pass-through).
 */
export function hasChanges(doc: EditorDoc, basePageCount: number): boolean {
  if (doc.objects.length > 0) return true;
  if (doc.stamps?.watermark || doc.stamps?.pageNumbers || doc.stamps?.letterhead) return true;
  if (doc.pages.length !== basePageCount) return true;
  return doc.pages.some(
    (page, i) => page.rotation !== 0 || page.crop !== undefined || page.source.kind !== 'source' || page.source.index !== i,
  );
}

/** The ZOOM_STEPS value closest to `zoom`. */
export function nearestZoom(zoom: number): number {
  let best: number = ZOOM_STEPS[0];
  for (const step of ZOOM_STEPS) if (Math.abs(step - zoom) < Math.abs(best - zoom)) best = step;
  return best;
}

/** True when the page holds a replace object: its lines are anchored, so the page can't be turned. */
export function pageHasReplace(doc: EditorDoc, pageId: PageId): boolean {
  return doc.objects.some((o) => o.pageId === pageId && o.kind === 'replace');
}

/** The replace object already standing in for this detected line, if any (one per line). */
export function replaceForLine(doc: EditorDoc, lineId: string): ReplaceObject | undefined {
  for (const o of doc.objects) if (o.kind === 'replace' && o.line.id === lineId) return o;
  return undefined;
}

/** The new wording of a line: one line, no outer spaces. */
export const cleanReplaceText = (value: string): string => value.replace(/[\r\n]+/g, ' ').trim();

/**
 * What finishing the typing of a changed line does (`value` as typed).
 *   - A draft becomes one addObject, but only once its text differs from the
 *     line's prefill: leaving the prefill as it was (Enter, or clicking
 *     away) changes nothing, so a mis-tap never rewrites a line in Cairo.
 *   - An existing changed line gets a replaceObject when its text changed.
 *   - An empty field takes the line out only on Enter: leaving an empty
 *     field changes nothing. (An unsure line starts empty, with no prefill:
 *     Enter on it still takes it out.)
 */
export function replaceCommitAction(
  doc: EditorDoc,
  editing: { object: ReplaceObject; draft: boolean },
  value: string,
  viaEnter: boolean,
): EditorAction | null {
  const text = cleanReplaceText(value);
  if (!text && !viaEnter) return null;
  if (editing.draft) {
    const prefill = cleanReplaceText(editing.object.line.text);
    if (prefill && text === prefill) return null;
    return { type: 'addObject', object: { ...editing.object, text } };
  }
  const object = doc.objects.find((o) => o.id === editing.object.id);
  return object?.kind === 'replace' && text !== object.text ? { type: 'replaceObject', object: { ...object, text } } : null;
}

// ── Keep the font: the size of a changed line ─────────────────────────────

/**
 * The size an autoSize object carries until the engine resolves the real one:
 * the line's own size, rounded to 0.1 pt and clamped into the replace range
 * (the original font may draw larger than REPLACE_MAX_SIZE; the object's
 * `size` never does).
 */
export function autoSizePlaceholder(font: LineFont, line: SourceTextLine): number {
  const raw = Number.isFinite(font.size) && font.size > 0 ? font.size : line.geometry.size;
  const size = Number.isFinite(raw) && raw > 0 ? raw : REPLACE_MIN_SIZE;
  return Math.round(Math.min(REPLACE_MAX_SIZE, Math.max(REPLACE_MIN_SIZE, size)) * 10) / 10;
}

export interface NewReplaceInput {
  id: ObjectId;
  pageId: PageId;
  line: SourceTextLine;
  /** lineBoxAt(line, page.rotation). */
  box: VisualBox;
  /** analyzeLineFont's result for this line; null when it failed or did not run. */
  font: LineFont | null;
  /** Width in points of line.text in Cairo at the line size (defaultReplaceSize); only read without a font. */
  prefillWidth: number;
}

/**
 * The replace object a picked line opens with. With the line's font
 * analysis it carries the analysis and autoSize; without it (or with an
 * analysis made for another line) it is the Phase C object bit for bit:
 * Cairo, sized by defaultReplaceSize.
 */
export function newReplaceObject({ id, pageId, line, box, font, prefillWidth }: NewReplaceInput): ReplaceObject {
  const base = { id, pageId, kind: 'replace' as const, line, box, text: line.text, color: line.color };
  if (font && font.lineId === line.id) return { ...base, size: autoSizePlaceholder(font, line), font, autoSize: true };
  return { ...base, size: defaultReplaceSize(line, prefillWidth) };
}

/**
 * The size a changed line shows at: the size the engine resolved for the
 * preview while autoSize is on (`previewSize`, null until a preview came
 * back), else the object's own size.
 */
export function shownReplaceSize(object: ReplaceObject, previewSize: number | null): number {
  return object.autoSize && previewSize !== null && Number.isFinite(previewSize) && previewSize > 0 ? previewSize : object.size;
}

/**
 * Smaller (-1) or Bigger (+1) on a changed line, from the size on screen.
 * The result has the new size and no autoSize (from now on the visitor's
 * size wins, whatever font the line ends up in). Null when the step would not
 * move the size that way: at either end of the range. The range ends at the
 * line's own size when it is above REPLACE_MAX_SIZE (replaceSizeMax), so
 * Smaller on a 96 pt title gives 95.5 and Bigger stops at 96.
 */
export function stepReplaceObjectSize(object: ReplaceObject, direction: 1 | -1, shownSize: number): ReplaceObject | null {
  const from = object.autoSize ? shownSize : object.size;
  const size = stepReplaceSize(from, direction, replaceSizeMax(object));
  if (direction > 0 ? !(size > from) : !(size < from)) return null;
  const { autoSize: _resolvedByEngine, ...rest } = object;
  void _resolvedByEngine;
  return { ...rest, size };
}

/** Whether Smaller and Bigger can move a changed line's size, for the mini-bar. */
export function replaceSizeLimits(object: ReplaceObject, shownSize: number): [canShrink: boolean, canGrow: boolean] {
  return [stepReplaceObjectSize(object, -1, shownSize) !== null, stepReplaceObjectSize(object, 1, shownSize) !== null];
}

export interface NextPersonPlan {
  objects: EditorObject[];
  /** The first emptied box, in page order: where the visitor starts typing. */
  firstEmpty: { pageId: PageId; id: ObjectId } | null;
  /** Where the removed signatures were, in page order: the next signatures land there. */
  signatureSlots: { pageId: PageId; box: VisualBox }[];
}

/**
 * Fill the same form for someone else: every typed box stays where it is with
 * its text cleared, except one that reads today's date (`keepText`), and
 * signatures come off. Everything else (pictures, shapes, changed lines,
 * stamps, page changes) stays. Null when nothing was typed, so the offer only
 * shows for a filled-in form, not a document that was only signed.
 */
export function planNextPerson(doc: EditorDoc, keepText: ReadonlySet<string>): NextPersonPlan | null {
  const typed = (o: EditorObject) => o.kind === 'text' && o.text.trim() !== '' && !keepText.has(o.text);
  if (!doc.objects.some(typed)) return null;
  const pageIndex = new Map(doc.pages.map((p, i) => [p.id, i]));
  const inPageOrder = (a: { pageId: PageId; box: VisualBox }, b: { pageId: PageId; box: VisualBox }) =>
    (pageIndex.get(a.pageId) ?? 0) - (pageIndex.get(b.pageId) ?? 0) || a.box.yPct - b.box.yPct || a.box.xPct - b.box.xPct;
  const emptied: { pageId: PageId; id: ObjectId; box: VisualBox }[] = [];
  const signatureSlots: { pageId: PageId; box: VisualBox }[] = [];
  const objects = doc.objects.flatMap((o): EditorObject[] => {
    if (o.kind === 'text' && typed(o)) {
      emptied.push({ pageId: o.pageId, id: o.id, box: o.box });
      return [{ ...o, text: '' }];
    }
    if (o.kind === 'image' && o.signature) {
      signatureSlots.push({ pageId: o.pageId, box: o.box });
      return [];
    }
    return [o];
  });
  const first = emptied.sort(inPageOrder)[0];
  return { objects, firstEmpty: first ? { pageId: first.pageId, id: first.id } : null, signatureSlots: signatureSlots.sort(inPageOrder) };
}

/** A new history entry: the current doc goes on `past` (oldest dropped past the cap), `future` is cleared. */
function commit(state: EditorState, doc: EditorDoc): EditorState {
  if (doc === state.doc) return state;
  const past = [...state.past, state.doc];
  if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
  return { ...state, doc, past, future: [] };
}

/** The next unused blank-page id (b1, b2…) across the doc and every snapshot, so undo never sees two pages share one. */
function nextBlankId(state: EditorState): PageId {
  let max = 0;
  for (const doc of [state.doc, ...state.past, ...state.future]) {
    for (const page of doc.pages) {
      const m = /^b(\d+)$/.exec(page.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }
  return `b${max + 1}`;
}

/**
 * The single page an undo or redo step changed, when there is exactly one, so
 * the editor can show it. Null when nothing on a page changed or several did.
 */
export function changedPageId(before: EditorDoc, after: EditorDoc): PageId | null {
  const pages = new Set<PageId>();
  const beforeObjects = new Map(before.objects.map((o) => [o.id, o]));
  const afterObjects = new Map(after.objects.map((o) => [o.id, o]));
  for (const [id, object] of afterObjects) if (beforeObjects.get(id) !== object) pages.add(object.pageId);
  for (const [id, object] of beforeObjects) if (!afterObjects.has(id)) pages.add(object.pageId);
  const beforePages = new Map(before.pages.map((p) => [p.id, p]));
  const afterIds = after.pages.map((p) => p.id);
  const beforeIds = before.pages.map((p) => p.id);
  for (const page of after.pages) {
    const old = beforePages.get(page.id);
    if (!old || old.rotation !== page.rotation) pages.add(page.id);
  }
  if (afterIds.length === beforeIds.length && afterIds.join() !== beforeIds.join()) {
    afterIds.forEach((id, i) => {
      if (beforeIds[i] !== id) pages.add(id);
    });
  }
  const shown = [...pages].filter((id) => afterIds.includes(id));
  return shown.length === 1 ? shown[0] : null;
}

/** `ids` that are pages of `doc`, in doc order. */
function inDocOrder(doc: EditorDoc, ids: readonly PageId[]): PageId[] {
  const wanted = new Set(ids);
  return doc.pages.flatMap((p) => (wanted.has(p.id) ? [p.id] : []));
}

const sameIds = (a: readonly PageId[], b: readonly PageId[]) => a.length === b.length && a.every((id, i) => id === b[i]);

/** Selection, ticked pages and current page after the doc changed under them (undo, redo, page deletion, moves). */
function fixUp(state: EditorState, previousDoc: EditorDoc): EditorState {
  let { selectedId, currentPageId, selectionAnchor } = state;
  if (selectedId && !state.doc.objects.some((o) => o.id === selectedId)) selectedId = null;
  if (!state.doc.pages.some((p) => p.id === currentPageId)) {
    const oldIndex = Math.max(0, previousDoc.pages.findIndex((p) => p.id === currentPageId));
    const index = Math.min(oldIndex, state.doc.pages.length - 1);
    currentPageId = state.doc.pages[index].id;
  }
  const ticked = inDocOrder(state.doc, state.selectedPageIds);
  const selectedPageIds = sameIds(ticked, state.selectedPageIds) ? state.selectedPageIds : ticked;
  if (selectionAnchor && !state.doc.pages.some((p) => p.id === selectionAnchor)) selectionAnchor = null;
  if (
    selectedId === state.selectedId &&
    currentPageId === state.currentPageId &&
    selectedPageIds === state.selectedPageIds &&
    selectionAnchor === state.selectionAnchor
  ) {
    return state;
  }
  return { ...state, selectedId, currentPageId, selectedPageIds, selectionAnchor };
}

/** The page and its objects after `turns` quarter turns clockwise; its crop turns with it. */
function turnPage(page: EditorPage, objects: readonly EditorObject[], sourcePages: readonly SourcePageInfo[], turns: number) {
  let turned = page;
  let moved = objects;
  for (let i = 0; i < turns; i++) {
    const before = pageVisualSize(turned, sourcePages);
    moved = moved.map((o) => (o.pageId === page.id ? rotateObjectClockwise(o, before) : o));
    turned = {
      ...turned,
      rotation: ((turned.rotation + 90) % 360) as QuarterTurn,
      ...(turned.crop ? { crop: rotateCropClockwise(turned.crop) } : {}),
    };
  }
  return { page: turned, objects: moved };
}

/** Turn every page in `pageIds` (`turnsOf` quarter turns each), skipping pages with a changed line. One history entry. */
function turnPages(state: EditorState, pageIds: ReadonlySet<PageId>, turnsOf: (page: EditorPage) => number): EditorState {
  const { doc } = state;
  let objects = doc.objects;
  let changed = false;
  const pages = doc.pages.map((page) => {
    const turns = turnsOf(page) % 4;
    if (!pageIds.has(page.id) || turns === 0 || pageHasReplace(doc, page.id)) return page;
    changed = true;
    const result = turnPage(page, objects, state.sourcePages, turns);
    objects = result.objects;
    return result.page;
  });
  return changed ? commit(state, { ...doc, pages, objects }) : state;
}

const sameBox = (a: VisualBox | undefined, b: VisualBox | undefined) =>
  a === b || (!!a && !!b && a.xPct === b.xPct && a.yPct === b.yPct && a.wPct === b.wPct && a.hPct === b.hPct);

/** The stamps as stored: undefined when neither is set, so an emptied doc compares as unchanged. */
function cleanStamps(stamps: DocStamps): DocStamps | undefined {
  const out: DocStamps = {};
  if (stamps.watermark) out.watermark = stamps.watermark;
  if (stamps.pageNumbers) out.pageNumbers = stamps.pageNumbers;
  if (stamps.letterhead) out.letterhead = stamps.letterhead;
  return out.watermark || out.pageNumbers || out.letterhead ? out : undefined;
}

/** Set (or drop, with undefined) the doc's stamps without touching anything else. */
function withStamps(doc: EditorDoc, stamps: DocStamps | undefined): EditorDoc {
  const { stamps: _old, ...rest } = doc;
  void _old;
  return stamps ? { ...rest, stamps } : rest;
}

function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  const copy = list.slice();
  copy[index] = item;
  return copy;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { doc } = state;
  switch (action.type) {
    case 'addObject': {
      if (doc.objects.some((o) => o.id === action.object.id)) return state;
      if (!doc.pages.some((p) => p.id === action.object.pageId)) return state;
      // One replace per line: the UI selects the existing one instead.
      if (action.object.kind === 'replace' && replaceForLine(doc, action.object.line.id)) return state;
      const next = commit(state, { ...doc, objects: [...doc.objects, action.object] });
      return { ...next, selectedId: action.object.id };
    }

    case 'replaceObject': {
      const index = doc.objects.findIndex((o) => o.id === action.object.id);
      if (index < 0 || doc.objects[index] === action.object) return state;
      return commit(state, { ...doc, objects: replaceAt(doc.objects, index, action.object) });
    }

    case 'deleteObject': {
      if (!doc.objects.some((o) => o.id === action.id)) return state;
      const next = commit(state, { ...doc, objects: doc.objects.filter((o) => o.id !== action.id) });
      return next.selectedId === action.id ? { ...next, selectedId: null } : next;
    }

    case 'nextPerson': {
      const next = commit(state, { ...doc, objects: [...action.objects] });
      return { ...next, selectedId: null };
    }

    case 'syncTextHeights': {
      // Derived data (the text layout), so it never makes a history entry.
      let changed = false;
      const objects = doc.objects.map((o) => {
        const h = action.heights[o.id];
        if (o.kind !== 'text' || h === undefined || !Number.isFinite(h) || Math.abs(o.box.hPct - h) < 1e-6) return o;
        changed = true;
        return { ...o, box: { ...o.box, hPct: h } };
      });
      return changed ? { ...state, doc: { ...doc, objects } } : state;
    }

    case 'rotatePage': {
      const index = doc.pages.findIndex((p) => p.id === action.pageId);
      if (index < 0) return state;
      const page = doc.pages[index];
      // Changed lines are anchored to the page as it is; Rotate shows disabled.rotateReplaced.
      if (pageHasReplace(doc, page.id)) return state;
      const turned = turnPage(page, doc.objects, state.sourcePages, 1);
      return commit(state, { ...doc, pages: replaceAt(doc.pages, index, turned.page), objects: turned.objects });
    }

    case 'deletePage':
      return editorReducer(state, { type: 'deletePages', pageIds: [action.pageId] });

    case 'movePage': {
      const index = doc.pages.findIndex((p) => p.id === action.pageId);
      const target = index + action.delta;
      if (index < 0 || target < 0 || target >= doc.pages.length) return state;
      const pages = doc.pages.slice();
      [pages[index], pages[target]] = [pages[target], pages[index]];
      return fixUp(commit(state, { ...doc, pages }), doc);
    }

    case 'insertBlankPage': {
      const index = doc.pages.findIndex((p) => p.id === action.afterPageId);
      if (index < 0) return state;
      const size = pageVisualSize(doc.pages[index], state.sourcePages);
      const blank: EditorPage = {
        id: nextBlankId(state),
        source: { kind: 'blank', width: size.width, height: size.height },
        rotation: 0,
      };
      const pages = [...doc.pages.slice(0, index + 1), blank, ...doc.pages.slice(index + 1)];
      const next = commit(state, { ...doc, pages });
      return { ...next, currentPageId: blank.id, selectedId: null };
    }

    case 'undo': {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const future = [doc, ...state.future].slice(0, HISTORY_LIMIT);
      const next = fixUp({ ...state, doc: previous, past: state.past.slice(0, -1), future }, doc);
      const shown = changedPageId(doc, previous);
      return shown && shown !== next.currentPageId ? { ...next, currentPageId: shown, selectedId: null } : next;
    }

    case 'redo': {
      if (state.future.length === 0) return state;
      const following = state.future[0];
      const past = [...state.past, doc];
      if (past.length > HISTORY_LIMIT) past.splice(0, past.length - HISTORY_LIMIT);
      const next = fixUp({ ...state, doc: following, past, future: state.future.slice(1) }, doc);
      const shown = changedPageId(doc, following);
      return shown && shown !== next.currentPageId ? { ...next, currentPageId: shown, selectedId: null } : next;
    }

    case 'select': {
      if (action.id !== null && !doc.objects.some((o) => o.id === action.id)) return state;
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };
    }

    case 'setTool':
      return { ...state, tool: action.tool, selectedId: null };

    case 'goToPage': {
      if (!doc.pages.some((p) => p.id === action.pageId) || action.pageId === state.currentPageId) return state;
      return { ...state, currentPageId: action.pageId, selectedId: null };
    }

    case 'setZoom': {
      const zoom = nearestZoom(action.zoom);
      return zoom === state.zoom ? state : { ...state, zoom };
    }

    case 'setStyle':
      return { ...state, style: { ...state.style, ...action.patch } };

    // ── Workspace ──

    case 'setCrop': {
      const ids = new Set(action.pageIds);
      const crop = action.crop ?? undefined;
      let changed = false;
      const pages = doc.pages.map((page) => {
        if (!ids.has(page.id) || sameBox(page.crop, crop)) return page;
        changed = true;
        if (crop) return { ...page, crop };
        const { crop: _gone, ...rest } = page;
        void _gone;
        return rest;
      });
      return changed ? commit(state, { ...doc, pages }) : state;
    }

    case 'clearCrops':
      return editorReducer(state, { type: 'setCrop', pageIds: doc.pages.map((p) => p.id), crop: null });

    case 'setStamps': {
      const stamps = cleanStamps(action.stamps);
      const now = doc.stamps;
      if (JSON.stringify(stamps ?? null) === JSON.stringify(now ?? null)) return state;
      return commit(state, withStamps(doc, stamps));
    }

    case 'retextPresetWatermark': {
      const retext = (d: EditorDoc): EditorDoc => {
        const watermark = d.stamps?.watermark;
        return watermark?.type === 'text' && watermark.text === action.from
          ? withStamps(d, { ...d.stamps, watermark: { ...watermark, text: action.to } })
          : d;
      };
      const next = retext(doc);
      if (next === doc) return state;
      return { ...state, doc: next, past: state.past.map(retext), future: state.future.map(retext) };
    }

    case 'rotatePages':
      return turnPages(state, new Set(action.pageIds), () => action.turns);

    case 'resetRotations':
      // Turning on to a full turn brings the objects and the crop back with the page.
      return turnPages(state, new Set(doc.pages.map((p) => p.id)), (page) => (360 - page.rotation) / 90);

    case 'deletePages': {
      const ids = new Set(action.pageIds);
      const pages = doc.pages.filter((p) => !ids.has(p.id));
      if (pages.length === doc.pages.length || pages.length === 0) return state;
      const next = commit(state, { ...doc, pages, objects: doc.objects.filter((o) => !ids.has(o.pageId)) });
      return fixUp(next, doc);
    }

    case 'movePageTo': {
      const from = doc.pages.findIndex((p) => p.id === action.pageId);
      const to = Math.min(Math.max(0, Math.round(action.index)), doc.pages.length - 1);
      if (from < 0 || from === to) return state;
      const pages = doc.pages.slice();
      const [page] = pages.splice(from, 1);
      pages.splice(to, 0, page);
      return fixUp(commit(state, { ...doc, pages }), doc);
    }

    case 'insertSourcePages': {
      // The working source only grows (pages are appended), so every index already in use stays valid.
      if (action.sourcePages.length < state.sourcePages.length) return state;
      const taken = new Set(doc.pages.map((p) => p.id));
      const added: EditorPage[] = action.indices
        .filter((index) => Number.isInteger(index) && index >= 0 && index < action.sourcePages.length && !taken.has(`s${index}`))
        .map((index) => ({ id: `s${index}`, source: { kind: 'source', index }, rotation: 0 }));
      const grown = { ...state, sourcePages: action.sourcePages.slice() };
      if (added.length === 0) return grown;
      const at = action.afterPageId === null ? -1 : doc.pages.findIndex((p) => p.id === action.afterPageId);
      const cut = at < 0 ? doc.pages.length : at + 1;
      const pages = [...doc.pages.slice(0, cut), ...added, ...doc.pages.slice(cut)];
      const next = commit(grown, { ...doc, pages });
      return { ...next, currentPageId: added[0].id, selectedId: null };
    }

    case 'replaceSource': {
      if (action.keepDoc) return { ...state, sourcePages: action.sourcePages };
      const fresh = initialEditorState(action.sourcePages);
      return { ...fresh, view: state.view, zoom: state.zoom, style: state.style };
    }

    case 'togglePageSelection': {
      if (!doc.pages.some((p) => p.id === action.pageId)) return state;
      const ticked = new Set(state.selectedPageIds);
      const anchor = state.selectionAnchor ?? state.currentPageId;
      const from = doc.pages.findIndex((p) => p.id === anchor);
      const to = doc.pages.findIndex((p) => p.id === action.pageId);
      if (action.range && from >= 0) {
        // Shift: every page from the anchor to this one is ticked.
        for (let i = Math.min(from, to); i <= Math.max(from, to); i++) ticked.add(doc.pages[i].id);
      } else if (ticked.has(action.pageId)) {
        ticked.delete(action.pageId);
      } else {
        ticked.add(action.pageId);
      }
      return { ...state, selectedPageIds: inDocOrder(doc, [...ticked]), selectionAnchor: action.pageId };
    }

    case 'setPageSelection': {
      const ticked = inDocOrder(doc, action.pageIds);
      if (sameIds(ticked, state.selectedPageIds)) return state;
      return { ...state, selectedPageIds: ticked, selectionAnchor: ticked.length > 0 ? state.selectionAnchor : null };
    }

    case 'setView':
      return state.view === action.view ? state : { ...state, view: action.view };

    default:
      return state;
  }
}
