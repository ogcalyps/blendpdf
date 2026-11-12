/**
 * "Keep the font" in the editor UI (keep-font-spec.md sections 7 to 9):
 *   - a picked line opens with its font analysis and autoSize, or exactly as
 *     in Phase C without one; Smaller/Bigger step from the size on screen and
 *     hand the size to the visitor (autoSize dropped, one history entry, undo
 *     brings autoSize back);
 *   - the preview store asks the engine once per change, 80 ms after the last
 *     one, drops late answers to superseded requests, caches finished renders
 *     and keeps the last one on screen while a newer one is on its way;
 *   - the note under the field names the closest match only when the line is
 *     not drawn in its own font (or its own family);
 *   - the copy no longer says replaced text is always written in our font,
 *     and the workspace really runs the analysis with the removal check.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTranslator } from 'next-intl';
import {
  autoSizePlaceholder,
  editorReducer,
  initialEditorState,
  newReplaceObject,
  replaceCommitAction,
  replaceSizeLimits,
  shownReplaceSize,
  stepReplaceObjectSize,
  type EditorAction,
  type EditorState,
} from '@/components/edit-pdf/state';
import {
  MAX_PREVIEW_PIXEL_RATIO,
  PREVIEW_CACHE_LIMIT,
  PREVIEW_DEBOUNCE_MS,
  PREVIEW_SETTLE_MS,
  ReplacePreviewStore,
  fieldChoice,
  fontNote,
  isolateName,
  previewKey,
  previewPixelRatio,
  previewSize,
  type PreviewView,
} from '@/components/edit-pdf/replace-preview';
import {
  REPLACE_MAX_SIZE,
  defaultReplaceSize,
  replaceSizeMax,
  type LineFont,
  type ReplaceFontChoice,
  type ReplaceObject,
  type ReplacePreview,
  type ReplacePreviewRequest,
  type SourcePageInfo,
  type SourceTextLine,
} from '@/lib/edit-pdf';

const ROOT = join(__dirname, '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const A4: SourcePageInfo = { width: 595, height: 842, rotate: 0 };
const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);

const sourceLine = (n = 0, size = 12): SourceTextLine => ({
  id: `0:${n}`,
  pageIndex: 0,
  text: 'Invoice 12',
  textUnsure: false,
  direction: 'ltr',
  color: '#1A1A1A',
  box: { xPct: 0.1, yPct: 0.1 + n * 0.03, wPct: 0.4, hPct: 0.02 },
  turn: 0,
  invisible: false,
  geometry: { rect: { x: 60, y: 700, width: 240, height: 14 }, ux: 1, uy: 0, baseline: 703, start: 60, end: 300, size, ascent: 10, descent: 3, neighbours: [] },
});

/** The UI never reads LineFont.data. */
const lineFont = (lineId: string, size: number): LineFont => ({ lineId, size, data: {} as unknown as LineFont['data'] });

const choice = (mode: ReplaceFontChoice['mode'], font: string | null, reason: ReplaceFontChoice['reason'], sameFamily = false): ReplaceFontChoice => ({
  mode,
  font,
  reason,
  sameFamily,
});
const ORIGINAL = choice('original', null, null);

const preview = (size: number, c: ReplaceFontChoice = ORIGINAL): ReplacePreview => ({
  choice: c,
  size,
  canvas: null,
  left: -1,
  top: 12,
  width: 250,
  height: 16,
});

const REQUEST: ReplacePreviewRequest = { pxPerPt: 1.5, pixelRatio: 2 };

const autoObject = (overrides: Partial<ReplaceObject> = {}): ReplaceObject => ({
  ...newReplaceObject({ id: 'o1', pageId: 's0', line: sourceLine(), box: sourceLine().box, font: lineFont('0:0', 11.04), prefillWidth: 0 }),
  ...overrides,
});

// ── Opening a line, and its size ───────────────────────────────────────────

describe('keep the font: opening a line and its size', () => {
  it('without a font analysis the box is the Phase C object, bit for bit', () => {
    const line = sourceLine();
    const object = newReplaceObject({ id: 'o1', pageId: 's0', line, box: line.box, font: null, prefillWidth: 200 });
    expect(object).toEqual({
      id: 'o1',
      pageId: 's0',
      kind: 'replace',
      line,
      box: line.box,
      text: line.text,
      size: defaultReplaceSize(line, 200),
      color: line.color,
    });
    expect('font' in object).toBe(false);
    expect('autoSize' in object).toBe(false);
  });

  it('with the analysis of that line it carries the analysis and autoSize, with the rounded line size as placeholder', () => {
    const line = sourceLine();
    const font = lineFont(line.id, 11.04);
    const object = newReplaceObject({ id: 'o1', pageId: 's0', line, box: line.box, font, prefillWidth: 200 });
    expect(object.font).toBe(font);
    expect(object.autoSize).toBe(true);
    expect(object.size).toBe(11);
    // An analysis made for another line is ignored.
    const other = newReplaceObject({ id: 'o2', pageId: 's0', line, box: line.box, font: lineFont('0:7', 11), prefillWidth: 200 });
    expect(other.font).toBeUndefined();
    expect(other.size).toBe(defaultReplaceSize(line, 200));
  });

  it('keeps the placeholder inside the replace range, whatever the original size', () => {
    expect(autoSizePlaceholder(lineFont('0:0', 96), sourceLine())).toBe(REPLACE_MAX_SIZE);
    expect(autoSizePlaceholder(lineFont('0:0', 2.2), sourceLine())).toBe(4);
    expect(autoSizePlaceholder(lineFont('0:0', 9.96), sourceLine())).toBe(10);
    // A broken analysis size falls back to the line's own.
    expect(autoSizePlaceholder(lineFont('0:0', Number.NaN), sourceLine(0, 14.2))).toBe(14.2);
  });

  it('shows the engine size while autoSize is on, the object size otherwise', () => {
    const auto = autoObject();
    expect(shownReplaceSize(auto, 11.04)).toBe(11.04);
    expect(shownReplaceSize(auto, null)).toBe(auto.size);
    const { autoSize: _a, ...fixed } = auto;
    void _a;
    expect(shownReplaceSize({ ...fixed, size: 13 }, 11.04)).toBe(13);
  });

  it('Smaller and Bigger step from the size on screen and drop autoSize', () => {
    const auto = autoObject();
    const smaller = stepReplaceObjectSize(auto, -1, 11.04);
    expect(smaller).toMatchObject({ size: 10.5, font: auto.font });
    expect(smaller && 'autoSize' in smaller).toBe(false);
    expect(stepReplaceObjectSize(auto, 1, 11.04)?.size).toBe(11.5);
    // A size the visitor set steps from itself; the engine's size no longer counts.
    const { autoSize: _a, ...fixed } = auto;
    void _a;
    expect(stepReplaceObjectSize({ ...fixed, size: 12 }, 1, 30)?.size).toBe(12.5);
  });

  it('never steps the wrong way at the ends of the range, nor Bigger on an original size above it', () => {
    const auto = autoObject();
    expect(stepReplaceObjectSize(auto, 1, 96)).toBeNull();
    expect(stepReplaceObjectSize(auto, -1, 96)?.size).toBe(REPLACE_MAX_SIZE);
    expect(stepReplaceObjectSize(auto, -1, 3.2)).toBeNull();
    expect(stepReplaceObjectSize(auto, 1, 3.2)?.size).toBe(4);
    expect(replaceSizeLimits(auto, 96)).toEqual([true, false]);
    expect(replaceSizeLimits(auto, 3.2)).toEqual([false, true]);
    expect(replaceSizeLimits(auto, 11.04)).toEqual([true, true]);
    const { autoSize: _a, ...fixed } = auto;
    void _a;
    expect(replaceSizeLimits({ ...fixed, size: REPLACE_MAX_SIZE }, 11)).toEqual([true, false]);
  });

  it('a title above the range steps half a point from its own size, and Bigger stops there', () => {
    const title = autoObject({ font: lineFont('0:0', 96), size: REPLACE_MAX_SIZE });
    expect(replaceSizeMax(title)).toBe(96);
    const smaller = stepReplaceObjectSize(title, -1, 96)!;
    expect(smaller.size).toBe(95.5);
    expect(stepReplaceObjectSize(title, 1, 96)).toBeNull();
    expect(replaceSizeLimits(title, 96)).toEqual([true, false]);
    expect(stepReplaceObjectSize(smaller, 1, 95.5)?.size).toBe(96);
    expect(stepReplaceObjectSize({ ...smaller, size: 96 }, 1, 96)).toBeNull();
    // Only the analysis of this very line counts, and a line inside the range keeps the range's own end.
    expect(replaceSizeMax({ ...title, font: lineFont('0:7', 96) })).toBe(REPLACE_MAX_SIZE);
    expect(replaceSizeMax(autoObject())).toBe(REPLACE_MAX_SIZE);
  });

  it('a step is one history entry, and undo gives the size back to the engine', () => {
    const auto = autoObject();
    const added = run(initialEditorState([A4]), { type: 'addObject', object: auto });
    const stepped = stepReplaceObjectSize(auto, -1, 11.04)!;
    const after = run(added, { type: 'replaceObject', object: stepped });
    expect(after.past.length).toBe(added.past.length + 1);
    expect(after.doc.objects[0]).toMatchObject({ size: 10.5 });
    expect((after.doc.objects[0] as ReplaceObject).autoSize).toBeUndefined();
    const undone = run(after, { type: 'undo' });
    expect((undone.doc.objects[0] as ReplaceObject).autoSize).toBe(true);
    expect((undone.doc.objects[0] as ReplaceObject).font).toBe(auto.font);
  });

  it('finishing the typing keeps the font analysis and autoSize, on a draft and on a changed line', () => {
    const auto = autoObject();
    const doc = initialEditorState([A4]).doc;
    const add = replaceCommitAction(doc, { object: auto, draft: true }, 'Invoice 13', true);
    expect(add).toMatchObject({ type: 'addObject', object: { text: 'Invoice 13', autoSize: true, font: auto.font } });
    const withIt = run(initialEditorState([A4]), { type: 'addObject', object: { ...auto, text: 'Invoice 13' } });
    const retype = replaceCommitAction(withIt.doc, { object: withIt.doc.objects[0] as ReplaceObject, draft: false }, 'Invoice 14', false);
    expect(retype).toMatchObject({ type: 'replaceObject', object: { text: 'Invoice 14', autoSize: true, font: auto.font } });
  });
});

// ── The preview store ──────────────────────────────────────────────────────

interface Deferred {
  object: ReplaceObject;
  text: string;
  request: ReplacePreviewRequest;
  resolve: (value: ReplacePreview | null) => void;
  reject: (error: unknown) => void;
}

function harness() {
  const calls: Deferred[] = [];
  const store = new ReplacePreviewStore(
    (object, text, request) =>
      new Promise<ReplacePreview | null>((resolve, reject) => {
        calls.push({ object, text, request, resolve, reject });
      }),
  );
  let notified = 0;
  store.subscribe(() => {
    notified += 1;
  });
  return { store, calls, notified: () => notified };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('keep the font: the preview store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('asks for the first preview of a line at once, and the same key only once', async () => {
    const { store, calls } = harness();
    const object = autoObject();
    expect(store.view(object, 'Invoice 12', REQUEST)).toEqual({ kind: 'waiting' });
    store.want(object, 'Invoice 12', REQUEST);
    expect(calls.length).toBe(1);
    expect(calls[0]).toMatchObject({ object, text: 'Invoice 12', request: REQUEST });
    store.want(object, ' Invoice 12 ', REQUEST);
    store.want(object, 'Invoice 12', REQUEST);
    await vi.advanceTimersByTimeAsync(500);
    expect(calls.length).toBe(1);
    calls[0].resolve(preview(11.04));
    await settle();
    expect(store.view(object, 'Invoice 12', REQUEST)).toEqual({ kind: 'canvas', preview: preview(11.04), current: true });
  });

  it(`waits ${PREVIEW_DEBOUNCE_MS} ms after the last change while typing, then asks once, for the last text`, async () => {
    const { store, calls } = harness();
    const object = autoObject();
    store.want(object, 'Invoice 12', REQUEST);
    calls[0].resolve(preview(11));
    await settle();
    store.want(object, 'Invoice 1', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS - 10);
    store.want(object, 'Invoice 13', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS - 1);
    expect(calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls.length).toBe(2);
    expect(calls[1].text).toBe('Invoice 13');
  });

  it('keeps the last render on screen while a newer one is on its way', async () => {
    const { store, calls } = harness();
    const object = autoObject();
    store.want(object, 'Invoice 12', REQUEST);
    calls[0].resolve(preview(11));
    await settle();
    store.want(object, 'Invoice 13', REQUEST);
    expect(store.view(object, 'Invoice 13', REQUEST)).toEqual({ kind: 'canvas', preview: preview(11), current: false });
    // A new zoom: the last render, scaled, until the sharp one arrives.
    expect(store.view(object, 'Invoice 12', { pxPerPt: 3, pixelRatio: 2 })).toMatchObject({ kind: 'canvas', current: false });
  });

  it('drops a late answer to a superseded request and never caches it', async () => {
    const { store, calls } = harness();
    const object = autoObject();
    store.want(object, 'Invoice 12', REQUEST);
    store.want(object, 'Invoice 13', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    expect(calls.map((c) => c.text)).toEqual(['Invoice 12', 'Invoice 13']);
    // The engine may answer the older request with the newer line: it must not be filed under the older text.
    calls[0].resolve(preview(99));
    await settle();
    expect(store.view(object, 'Invoice 12', REQUEST)).toEqual({ kind: 'waiting' });
    expect(store.view(object, 'Invoice 13', REQUEST)).toEqual({ kind: 'waiting' });
    calls[1].resolve(preview(10));
    await settle();
    expect(store.view(object, 'Invoice 13', REQUEST)).toEqual({ kind: 'canvas', preview: preview(10), current: true });
    expect(store.view(object, 'Invoice 12', REQUEST)).toEqual({ kind: 'canvas', preview: preview(10), current: false });
  });

  it('shows a cached render at once (back to an earlier text, undo), without asking again', async () => {
    const { store, calls, notified } = harness();
    const object = autoObject();
    store.want(object, 'Invoice 12', REQUEST);
    calls[0].resolve(preview(11));
    await settle();
    store.want(object, 'Invoice 13', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    calls[1].resolve(preview(10));
    await settle();
    const before = notified();
    store.want(object, 'Invoice 12', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS * 2);
    expect(calls.length).toBe(2);
    expect(notified()).toBe(before + 1);
    expect(store.view(object, 'Invoice 12', REQUEST)).toEqual({ kind: 'canvas', preview: preview(11), current: true });
    // A draft and the changed line it becomes share the object id: the committed box shows the render at once.
    expect(store.view({ ...object, text: 'Invoice 12' }, 'Invoice 12', REQUEST).kind).toBe('canvas');
  });

  it(`keeps at most ${PREVIEW_CACHE_LIMIT} renders, dropping the least recently used`, async () => {
    const { store, calls } = harness();
    const object = autoObject();
    for (let i = 0; i <= PREVIEW_CACHE_LIMIT; i++) {
      store.want(object, `Line ${i}`, REQUEST);
      await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
      calls[calls.length - 1].resolve(preview(10 + i / 100));
      await settle();
    }
    expect(store.view(object, `Line ${PREVIEW_CACHE_LIMIT}`, REQUEST)).toMatchObject({ current: true });
    expect(store.view(object, 'Line 1', REQUEST)).toMatchObject({ current: true });
    // Line 0 was the oldest: gone from the cache (only the last render stands in for it).
    expect(store.view(object, 'Line 0', REQUEST)).toMatchObject({ current: false });
  });

  it('falls back to the CSS text when the engine has no preview, and asks again after a failure', async () => {
    const { store, calls } = harness();
    const object = autoObject();
    store.want(object, 'Invoice 12', REQUEST);
    calls[0].resolve(null);
    await settle();
    expect(store.view(object, 'Invoice 12', REQUEST)).toEqual({ kind: 'css' });
    // While the next one is on its way the CSS text stays (a null render has no canvas to keep).
    store.want(object, 'Invoice 13', REQUEST);
    expect(store.view(object, 'Invoice 13', REQUEST)).toEqual({ kind: 'css' });
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    calls[1].reject(new Error('render failed'));
    await settle();
    expect(store.view(object, 'Invoice 13', REQUEST)).toEqual({ kind: 'css' });
    // A failure is not cached: coming back to that text asks again.
    store.want(object, 'Invoice 12', REQUEST);
    store.want(object, 'Invoice 13', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    expect(calls.length).toBe(3);
    expect(calls[2].text).toBe('Invoice 13');
  });

  it(`a render in another font waits until the field has been quiet ${PREVIEW_SETTLE_MS} ms; a newer change drops it`, async () => {
    const { store, calls, notified } = harness();
    const object = autoObject();
    const NOTO = choice('lookalike', 'Noto Sans Arabic', 'letters');
    // At rest in the original font.
    store.want(object, 'أ', REQUEST);
    calls[0].resolve(preview(11));
    await settle();
    await vi.advanceTimersByTimeAsync(PREVIEW_SETTLE_MS);
    // "أح" ends in a form the font never used: its render would flip to the closest match. It waits.
    store.want(object, 'أح', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    const before = notified();
    calls[1].resolve(preview(9.4, NOTO));
    await settle();
    expect(notified()).toBe(before);
    expect(store.view(object, 'أح', REQUEST)).toEqual({ kind: 'canvas', preview: preview(11), current: false });
    // The next letter comes 220 ms after the previous one: "أحم" is back in the original, shown at once; Noto never was.
    await vi.advanceTimersByTimeAsync(220 - PREVIEW_DEBOUNCE_MS);
    store.want(object, 'أحم', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    calls[2].resolve(preview(11));
    await settle();
    expect(store.view(object, 'أحم', REQUEST)).toEqual({ kind: 'canvas', preview: preview(11), current: true });
    await vi.advanceTimersByTimeAsync(PREVIEW_SETTLE_MS * 2);
    expect(store.view(object, 'أحم', REQUEST)).toMatchObject({ preview: { choice: ORIGINAL } });
    // A word the font really can't draw: the closest match shows once the field has been quiet long enough.
    store.want(object, 'أحمz', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    calls[3].resolve(preview(9.4, NOTO));
    await settle();
    expect(store.view(object, 'أحمz', REQUEST)).toMatchObject({ current: false, preview: { choice: ORIGINAL } });
    await vi.advanceTimersByTimeAsync(PREVIEW_SETTLE_MS - PREVIEW_DEBOUNCE_MS - 1);
    expect(store.view(object, 'أحمz', REQUEST)).toMatchObject({ current: false });
    await vi.advanceTimersByTimeAsync(1);
    expect(store.view(object, 'أحمz', REQUEST)).toEqual({ kind: 'canvas', preview: preview(9.4, NOTO), current: true });
    // Back to a text cached in the other font (a backspace): held the same way, even before the store hears of it.
    expect(store.view(object, 'أحم', REQUEST)).toMatchObject({ current: false, preview: { choice: NOTO } });
    store.want(object, 'أحم', REQUEST);
    expect(store.view(object, 'أحم', REQUEST)).toMatchObject({ current: false, preview: { choice: NOTO } });
    await vi.advanceTimersByTimeAsync(PREVIEW_SETTLE_MS);
    expect(store.view(object, 'أحم', REQUEST)).toEqual({ kind: 'canvas', preview: preview(11), current: true });
    expect(calls.length).toBe(4);
  });

  it('shows a fallback made because a font did not load, but does not keep it: coming back asks again', async () => {
    const { store, calls } = harness();
    const object = autoObject();
    const CAIRO_FOR_NOW: ReplacePreview = { ...preview(10, choice('cairo', 'Cairo', 'letters')), transient: true };
    store.want(object, 'Invoice Z', REQUEST);
    calls[0].resolve(CAIRO_FOR_NOW);
    await settle();
    expect(store.view(object, 'Invoice Z', REQUEST)).toEqual({ kind: 'canvas', preview: CAIRO_FOR_NOW, current: true });
    store.want(object, 'Invoice', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    calls[1].resolve(preview(10, choice('cairo', 'Cairo', 'letters')));
    await settle();
    store.want(object, 'Invoice Z', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    expect(calls.map((c) => c.text)).toEqual(['Invoice Z', 'Invoice', 'Invoice Z']);
  });

  it('asks again for what changes the picture: text, colour, zoom, pixel ratio, and size once the visitor set it', () => {
    const auto = autoObject();
    const key = previewKey(auto, 'Invoice 12', REQUEST);
    expect(previewKey(auto, ' Invoice 12 ', REQUEST)).toBe(key);
    // autoSize: the placeholder size is not what is drawn.
    expect(previewKey({ ...auto, size: 30 }, 'Invoice 12', REQUEST)).toBe(key);
    expect(previewKey(auto, 'Invoice 13', REQUEST)).not.toBe(key);
    expect(previewKey({ ...auto, color: '#DC2626' }, 'Invoice 12', REQUEST)).not.toBe(key);
    expect(previewKey(auto, 'Invoice 12', { ...REQUEST, pxPerPt: 2 })).not.toBe(key);
    expect(previewKey(auto, 'Invoice 12', { ...REQUEST, pixelRatio: 3 })).not.toBe(key);
    const { autoSize: _a, ...fixed } = auto;
    void _a;
    expect(previewKey(fixed, 'Invoice 12', REQUEST)).not.toBe(key);
    expect(previewKey({ ...fixed, size: 12 }, 'Invoice 12', REQUEST)).not.toBe(previewKey({ ...fixed, size: 12.5 }, 'Invoice 12', REQUEST));
    expect(previewKey({ ...auto, id: 'o2' }, 'Invoice 12', REQUEST)).not.toBe(key);
  });

  it('reset drops pending requests, cached renders and late answers, and the store still works', async () => {
    const { store, calls } = harness();
    const object = autoObject();
    store.want(object, 'Invoice 12', REQUEST);
    store.want(object, 'Invoice 13', REQUEST);
    store.reset();
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS * 2);
    expect(calls.length).toBe(1);
    calls[0].resolve(preview(11));
    await settle();
    expect(store.view(object, 'Invoice 12', REQUEST)).toEqual({ kind: 'waiting' });
    store.want(object, 'Invoice 12', REQUEST);
    expect(calls.length).toBe(2);
  });

  it('gives a canvas its pixels back once nothing can show it again, and never one that still can', async () => {
    const { store, calls } = harness();
    const canvasOf = () => ({ width: 300, height: 40 }) as unknown as HTMLCanvasElement;
    const drawn = (size: number, c: ReplaceFontChoice = ORIGINAL): ReplacePreview => ({ ...preview(size, c), canvas: canvasOf() });
    const freed = (p: ReplacePreview) => p.canvas!.width === 0 && p.canvas!.height === 0;
    const a = autoObject();
    const b = autoObject({ id: 'o2' });
    // Object a at rest: cached and on screen.
    const kept = drawn(11);
    store.want(a, 'Invoice 12', REQUEST);
    calls[0].resolve(kept);
    await settle();
    // Object b fills the cache past its limit: a's render is evicted, but a still shows it.
    const renders: ReplacePreview[] = [];
    for (let i = 0; i <= PREVIEW_CACHE_LIMIT; i++) {
      store.want(b, `Line ${i}`, REQUEST);
      await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
      renders.push(drawn(10));
      calls[calls.length - 1].resolve(renders[i]);
      await settle();
    }
    expect(store.view(a, 'Invoice 13', REQUEST)).toMatchObject({ current: false, preview: kept });
    expect(freed(kept)).toBe(false);
    // b's evicted renders that are off screen are freed; the cached ones and the one on screen are not.
    expect(freed(renders[0])).toBe(true);
    expect(renders.slice(1).some(freed)).toBe(false);
    // A render that is not cached (a font did not load) is freed when the next one replaces it on screen.
    const transient: ReplacePreview = { ...drawn(10, choice('cairo', 'Cairo', 'letters')), transient: true };
    store.want(a, 'Invoice Z', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS + PREVIEW_SETTLE_MS);
    calls[calls.length - 1].resolve(transient);
    await settle();
    expect(freed(kept)).toBe(true);
    store.want(a, 'Invoice', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS + PREVIEW_SETTLE_MS);
    calls[calls.length - 1].resolve(drawn(10, choice('cairo', 'Cairo', 'letters')));
    await settle();
    expect(freed(transient)).toBe(true);
    // A render held back (another font while typing) and dropped by a newer change is freed.
    store.want(a, 'Invoice 7', REQUEST);
    await vi.advanceTimersByTimeAsync(PREVIEW_DEBOUNCE_MS);
    const held = drawn(11);
    calls[calls.length - 1].resolve(held);
    await settle();
    store.want(a, 'Invoice 8', REQUEST);
    expect(freed(held)).toBe(true);
    // Reset frees everything left.
    store.reset();
    expect(renders.every(freed)).toBe(true);
  });

  it('caps the pixel ratio and reads the resolved size off the render', () => {
    expect(previewPixelRatio(undefined)).toBe(1);
    expect(previewPixelRatio(0.5)).toBe(1);
    expect(previewPixelRatio(2.625)).toBe(2.625);
    expect(previewPixelRatio(4)).toBe(MAX_PREVIEW_PIXEL_RATIO);
    expect(previewSize({ kind: 'canvas', preview: preview(11.04), current: false })).toBe(11.04);
    expect(previewSize({ kind: 'css' })).toBeNull();
    expect(previewSize({ kind: 'waiting' })).toBeNull();
  });
});

// ── The note under the field ───────────────────────────────────────────────

describe('keep the font: the note under the field', () => {
  const canvas = (c: ReplaceFontChoice): PreviewView => ({ kind: 'canvas', preview: preview(11, c), current: true });

  it('says nothing when the line keeps its own font, or its own family', () => {
    expect(fontNote(ORIGINAL)).toBeNull();
    expect(fontNote(choice('lookalike', 'Carlito', 'letters', true))).toBeNull();
    expect(fontNote(null)).toBeNull();
  });

  it('names the closest match and why, when it is not the original', () => {
    expect(fontNote(choice('lookalike', 'Liberation Sans', 'letters'))).toEqual({ kind: 'letters', font: 'Liberation Sans' });
    expect(fontNote(choice('lookalike', 'Noto Sans Arabic', 'font'))).toEqual({ kind: 'font', font: 'Noto Sans Arabic' });
    expect(fontNote(choice('cairo', 'Cairo', 'letters'))).toEqual({ kind: 'letters', font: 'Cairo' });
    expect(fontNote(choice('cairo', 'Cairo', 'font'))).toEqual({ kind: 'font', font: 'Cairo' });
  });

  it('says the line becomes a picture when even Cairo lacks a character', () => {
    expect(fontNote(choice('image', null, 'letters'))).toEqual({ kind: 'image' });
  });

  it('speaks for the render on screen; on the CSS path only for what Phase C knew; nothing while waiting', () => {
    const lookalike = choice('lookalike', 'Liberation Serif', 'letters');
    expect(fieldChoice(canvas(lookalike), true)).toBe(lookalike);
    expect(fieldChoice({ kind: 'css' }, true)).toMatchObject({ mode: 'image' });
    expect(fieldChoice({ kind: 'css' }, false)).toBeNull();
    expect(fieldChoice({ kind: 'waiting' }, true)).toBeNull();
  });

  it('isolates the font name and keeps it on one line, so it reads right inside the Arabic sentence', () => {
    expect(isolateName('Noto Sans Arabic')).toBe('\u2068Noto\u00A0Sans\u00A0Arabic\u2069');
    const messages = JSON.parse(read('messages/ar.json'));
    const t = createTranslator({ locale: 'ar', messages, namespace: 'editPdf' });
    const note = t('replace.closestMatch', { font: isolateName('Liberation Sans') });
    expect(note).toContain('\u2068Liberation\u00A0Sans\u2069');
    expect(note.trim().endsWith('.')).toBe(true);
  });

  it('has both notes in both locales, with the font placeholder', () => {
    for (const locale of ['en', 'ar']) {
      const messages = JSON.parse(read(`messages/${locale}.json`));
      for (const key of ['closestMatch', 'closestMatchFont']) {
        const value = messages.editPdf.replace[key];
        expect(typeof value, `${locale} ${key}`).toBe('string');
        expect(value, `${locale} ${key}`).toContain('{font}');
      }
    }
    const en = JSON.parse(read('messages/en.json'));
    expect(en.editPdf.replace.closestMatch).toBe("Closest match: {font}. The original font doesn't have some of these letters.");
    expect(en.editPdf.replace.closestMatchFont).toBe("Closest match: {font}. The original font can't be used for new text.");
  });
});

// ── Copy and wiring ────────────────────────────────────────────────────────

describe('keep the font: copy and wiring', () => {
  /** Every place that describes Edit text to visitors or to assistants. */
  const COPY_FILES = [
    'messages/en.json',
    'messages/ar.json',
    'public/llms.txt',
    'public/llms-full.txt',
    'app/[locale]/edit-pdf/layout.tsx',
    'lib/comparisons/smallpdf.ts',
    'lib/comparisons/ilovepdf.ts',
    'lib/comparisons/chrome.ts',
    'app/[locale]/word-to-pdf/faq/page.tsx',
  ];
  const ALWAYS_OUR_FONT = /written in our (own )?font|in our own font|بخطنا|بخط BlendPDF|in Cairo/i;

  it('no longer says replaced text is always written in our own font', () => {
    const offenders = COPY_FILES.filter((file) => ALWAYS_OUR_FONT.test(read(file).replace(/\s+/g, ' ')));
    expect(offenders).toEqual([]);
  });

  it('the FAQ says the line keeps its own font, and that we say so when it can not', () => {
    const en = JSON.parse(read('messages/en.json')).editPdf.faq.existingText.answer as string;
    const ar = JSON.parse(read('messages/ar.json')).editPdf.faq.existingText.answer as string;
    expect(en).toMatch(/keeps its own font/);
    expect(en).toMatch(/closest font we have and tell you/);
    expect(ar).toContain('ويبقى خط السطر كما هو');
    expect(ar).toContain('بأقرب خط لدينا');
  });

  it('the workspace runs the font analysis with the removal check and opens the box with it', () => {
    const source = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(source).toMatch(/const fontAnalysis = analyzeLineFont\(file, pdf, line\)\.catch\(/);
    expect(source).toMatch(/const \[verdict, font\] = await Promise\.all\(\[checkLineRemoval\(file, line\), fontAnalysis\]\)/);
    expect(source).toMatch(/openReplaceDraft\(line, target\.id, target\.rotation, font\)/);
    expect(source).toMatch(/newReplaceObject\(\{[^}]*\bfont\b[^}]*\}\)/);
  });

  it('the workspace frees the preview of a changed line that is gone, keeping the one being typed', () => {
    const source = read('components/edit-pdf/EditorWorkspace.tsx');
    expect(source).toMatch(/const keep = new Set<ObjectId>\(doc\.objects\.filter\(\(o\) => o\.kind === 'replace'\)\.map\(\(o\) => o\.id\)\);/);
    expect(source).toMatch(/if \(replaceEditing\) keep\.add\(replaceEditing\.object\.id\);\s+void releaseReplacePreviews\(keep\)/);
  });

  it("a box's own copy of the preview gives its pixels back when the box goes", () => {
    const box = read('components/edit-pdf/ReplaceBox.tsx');
    expect(box).toMatch(/useLayoutEffect\(\(\) => \{\s+const target = ref\.current;\s+return \(\) => \{\s+if \(!target\) return;\s+target\.width = 0;\s+target\.height = 0;\s+\};\s+\}, \[\]\);/);
  });

  it('the field takes the font choice and the size buttons the resolved size', () => {
    const layer = read('components/edit-pdf/ObjectLayer.tsx');
    expect(layer).toMatch(/choice=\{typedView \? fieldChoice\(typedView,/);
    expect(layer).toMatch(/stepReplaceObjectSize\(object, patch\.direction, shownSizeOf\(object\)\)/);
    expect(layer).toMatch(/replaceSizeLimits\(object, shownSizeOf\(object\)\)/);
    expect(layer).not.toMatch(/stepReplaceSize\(/);
    const field = read('components/edit-pdf/ReplaceField.tsx');
    expect(field).not.toMatch(/\bmissing\b/);
    expect(field).toMatch(/t\('replace\.closestMatch', \{ font: isolateName\(note\.font\) \}\)/);
    expect(field).toMatch(/t\('replace\.closestMatchFont', \{ font: isolateName\(note\.font\) \}\)/);
  });
});
