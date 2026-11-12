/**
 * "Keep the font": the on-screen preview of changed lines and the note under
 * the field (keep-font-spec.md sections 8 and 9). Pure: no React, no DOM (the
 * canvas is the engine's), so tests/edit-pdf-ui-keep-font.test.ts runs it in
 * Node with fake timers.
 *
 * The engine draws the new line with the export's own code into a one-line
 * PDF and pdf.js renders it on a transparent canvas (previewReplacement), so
 * what the visitor sees is what the save writes, in whatever font it chose.
 * This store asks for those renders and remembers them:
 *   - one request per change of (object, text, size or autoSize, colour,
 *     zoom, pixel ratio), 80 ms after the last change; the first preview of
 *     an object goes at once;
 *   - a newer request supersedes an older one: a late answer to an older
 *     request is dropped and never cached (the engine may answer it with the
 *     newer line);
 *   - finished renders are cached by that key, so a draft that becomes a
 *     changed line, an undo, or a return to the same zoom shows at once;
 *   - while a newer render is on its way, the last one stays on screen;
 *   - a canvas nothing can show again (dropped from the cache, replaced on
 *     screen, the store reset) gives its pixels back at once (width and
 *     height 0): iOS caps the canvas memory of a page and frees it only on
 *     collection, as PageCanvas and PageStrip do for theirs;
 *   - a render in ANOTHER font (original to closest match or back, or
 *     another look-alike) waits while the field is still changing: a
 *     half-typed Arabic word ends in a letter form the font never used, so
 *     the line would flip font, size and note on and off mid-word. It shows
 *     once the field has been quiet for PREVIEW_SETTLE_MS, and is dropped
 *     when a newer change comes first.
 */
import type { ObjectId, ReplaceFontChoice, ReplaceObject, ReplacePreview, ReplacePreviewRequest } from '@/lib/edit-pdf';
import { cleanReplaceText } from './state';

/** Quiet time after the last change before a preview is asked for. */
export const PREVIEW_DEBOUNCE_MS = 80;
/** Quiet time after the last change before a render in another font replaces the one on screen. */
export const PREVIEW_SETTLE_MS = 500;
/** Finished previews kept (each a one-line canvas). */
export const PREVIEW_CACHE_LIMIT = 48;
/** Device pixel ratio cap for preview canvases. */
export const MAX_PREVIEW_PIXEL_RATIO = 3;

export type PreviewRenderer = (
  object: ReplaceObject,
  text: string,
  request: ReplacePreviewRequest,
) => Promise<ReplacePreview | null>;

export interface PreviewTimers {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
}

const browserTimers: PreviewTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * What a changed line shows:
 *   waiting  no preview of this object has come back yet;
 *   canvas   the engine's render; `current` is false while a newer one is on its way;
 *   css      the engine could not make one: the Phase C Cairo text (rare path).
 */
export type PreviewView =
  | { kind: 'waiting' }
  | { kind: 'canvas'; preview: ReplacePreview; current: boolean }
  | { kind: 'css' };

/** window.devicePixelRatio for a preview canvas: at least 1, at most MAX_PREVIEW_PIXEL_RATIO. */
export function previewPixelRatio(devicePixelRatio: number | undefined): number {
  const ratio = typeof devicePixelRatio === 'number' && Number.isFinite(devicePixelRatio) ? devicePixelRatio : 1;
  return Math.min(MAX_PREVIEW_PIXEL_RATIO, Math.max(1, ratio));
}

/**
 * Everything that changes the picture. The object id stands for its line and
 * its font analysis (both fixed when the object is made); the size counts
 * only once the visitor has set it.
 */
export function previewKey(object: ReplaceObject, text: string, request: ReplacePreviewRequest): string {
  const size = object.autoSize ? 'auto' : String(object.size);
  return [object.id, size, object.color, request.pxPerPt.toFixed(4), String(request.pixelRatio), cleanReplaceText(text)].join('|');
}

interface Slot {
  /** The newest key asked for this object, and its request number. */
  key: string | null;
  seq: number;
  timer: unknown;
  /** The newest answer that came back for this object, for any key: on screen until a newer one arrives. */
  last: { key: string; preview: ReplacePreview | null } | null;
  /** A change came less than PREVIEW_SETTLE_MS ago; `quiet` ends it. */
  settling: boolean;
  quiet: unknown;
  /** An answer in another font than the one on screen, waiting for the field to settle (`cache`: file it then). */
  held: { key: string; preview: ReplacePreview | null; cache: boolean } | null;
}

/** Two renders in different fonts (the original, a look-alike, Cairo, a picture): showing one after the other flips the line's look. */
function flips(shown: ReplacePreview | null, next: ReplacePreview | null): boolean {
  return !!shown && !!next && (shown.choice.mode !== next.choice.mode || shown.choice.font !== next.choice.font);
}

export class ReplacePreviewStore {
  private readonly cache = new Map<string, ReplacePreview | null>();
  private readonly slots = new Map<ObjectId, Slot>();
  private readonly listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private readonly render: PreviewRenderer,
    private readonly timers: PreviewTimers = browserTimers,
  ) {}

  /** For useSyncExternalStore. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Changes whenever a view may have changed (useSyncExternalStore's snapshot). */
  readonly getVersion = (): number => this.version;

  /**
   * Ask for the preview of `object` showing `text` at this zoom. Call it after
   * render (an effect); asking again for the key already asked does nothing.
   */
  want(object: ReplaceObject, text: string, request: ReplacePreviewRequest): void {
    const clean = cleanReplaceText(text);
    const key = previewKey(object, clean, request);
    const slot = this.slotOf(object.id);
    if (slot.key === key) return;
    slot.key = key;
    slot.seq += 1;
    this.timers.clear(slot.timer);
    slot.timer = undefined;
    // A newer change: what was held is stale, and the field is changing again.
    const stale = slot.held;
    slot.held = null;
    this.free(stale?.preview);
    this.settleLater(slot);
    if (this.cache.has(key)) {
      const preview = this.cache.get(key) ?? null;
      if (slot.last && flips(slot.last.preview, preview)) {
        slot.held = { key, preview, cache: true };
        return;
      }
      this.touch(key, preview);
      this.show(slot, key, preview);
      this.emit();
      return;
    }
    const seq = slot.seq;
    const run = () => {
      slot.timer = undefined;
      void this.run(slot, object, clean, request, key, seq);
    };
    if (seq === 1) run();
    else slot.timer = this.timers.set(run, PREVIEW_DEBOUNCE_MS);
  }

  /** What `object` showing `text` at this zoom looks like right now. Pure: call it during render. */
  view(object: ReplaceObject, text: string, request: ReplacePreviewRequest): PreviewView {
    const key = previewKey(object, text, request);
    const slot = this.slots.get(object.id);
    const last = slot?.last;
    if (this.cache.has(key)) {
      const cached = this.cache.get(key) ?? null;
      // Another font while the field is changing (held, or a change want() has not seen yet): the last render stays.
      const changing = !!slot && (slot.held?.key === key || slot.key !== key);
      if (last && last.key !== key && changing && flips(last.preview, cached)) return toView(last.preview, false);
      return toView(cached, true);
    }
    if (!last) return { kind: 'waiting' };
    return toView(last.preview, last.key === key);
  }

  /** Drop every pending request and cached render (the editor is going away). The store stays usable. */
  reset(): void {
    const previews = [...this.cache.values()];
    for (const slot of this.slots.values()) {
      this.timers.clear(slot.timer);
      this.timers.clear(slot.quiet);
      previews.push(slot.last?.preview ?? null, slot.held?.preview ?? null);
    }
    this.slots.clear();
    this.cache.clear();
    for (const preview of previews) this.free(preview);
    this.emit();
  }

  private async run(slot: Slot, object: ReplaceObject, text: string, request: ReplacePreviewRequest, key: string, seq: number) {
    let preview: ReplacePreview | null = null;
    let failed = false;
    try {
      preview = await this.render(object, text, request);
    } catch (error) {
      console.warn('edit-pdf: the line preview failed', error);
      failed = true;
    }
    // Superseded (or reset): the answer may even belong to the newer request, so it is neither shown nor cached.
    if (this.slots.get(object.id) !== slot || slot.seq !== seq) return;
    // A failure, or a fallback because a font did not load, is not cached: the next change asks again.
    const keep = !failed && !preview?.transient;
    // Another font while the field is still changing: wait for it to settle.
    if (slot.settling && slot.last && flips(slot.last.preview, preview)) {
      slot.held = { key, preview, cache: keep };
      return;
    }
    if (keep) this.touch(key, preview);
    this.show(slot, key, preview);
    this.emit();
  }

  /** Put an answer on screen for this object; the one it replaces gives its canvas back unless it is still kept. */
  private show(slot: Slot, key: string, preview: ReplacePreview | null) {
    const previous = slot.last?.preview;
    slot.last = { key, preview };
    if (previous !== preview) this.free(previous);
  }

  /** Is this canvas still the source of something the store may show (cached, on screen, held)? */
  private inUse(canvas: HTMLCanvasElement): boolean {
    for (const preview of this.cache.values()) if (preview?.canvas === canvas) return true;
    for (const slot of this.slots.values()) if (slot.last?.preview?.canvas === canvas || slot.held?.preview?.canvas === canvas) return true;
    return false;
  }

  /** Give a canvas's pixels back now when nothing can show it again (the boxes on the page draw their own copies). */
  private free(preview: ReplacePreview | null | undefined) {
    const canvas = preview?.canvas;
    if (!canvas || this.inUse(canvas)) return;
    canvas.width = 0;
    canvas.height = 0;
  }

  /** (Re)start the quiet period after a change; when it ends, a held render is shown. */
  private settleLater(slot: Slot) {
    this.timers.clear(slot.quiet);
    slot.settling = true;
    slot.quiet = this.timers.set(() => {
      slot.quiet = undefined;
      slot.settling = false;
      const held = slot.held;
      if (!held) return;
      slot.held = null;
      if (held.cache) this.touch(held.key, held.preview);
      this.show(slot, held.key, held.preview);
      this.emit();
    }, PREVIEW_SETTLE_MS);
  }

  private slotOf(id: ObjectId): Slot {
    let slot = this.slots.get(id);
    if (!slot) {
      slot = { key: null, seq: 0, timer: undefined, last: null, settling: false, quiet: undefined, held: null };
      this.slots.set(id, slot);
    }
    return slot;
  }

  /** Insert or refresh a cache entry as the most recent, dropping the oldest past the limit. */
  private touch(key: string, preview: ReplacePreview | null) {
    this.cache.delete(key);
    this.cache.set(key, preview);
    while (this.cache.size > PREVIEW_CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      const evicted = this.cache.get(oldest);
      this.cache.delete(oldest);
      this.free(evicted);
    }
  }

  private emit() {
    this.version += 1;
    for (const listener of [...this.listeners]) listener();
  }
}

function toView(preview: ReplacePreview | null, current: boolean): PreviewView {
  return preview ? { kind: 'canvas', preview, current } : { kind: 'css' };
}

/** The size the engine resolved for what is on screen, or null when no render is shown. */
export function previewSize(view: PreviewView): number | null {
  return view.kind === 'canvas' ? view.preview.size : null;
}

/** What the Phase C path saves when Cairo lacks a character: a picture. */
const CAIRO_PICTURE: ReplaceFontChoice = { mode: 'image', font: null, reason: 'letters', sameFamily: false };

/**
 * The font choice the field's note speaks for: the engine's, from the render
 * on screen; on the CSS path only what Phase C knew (Cairo lacks a character,
 * so the line becomes a picture); nothing while the first render is on its way.
 */
export function fieldChoice(view: PreviewView, cairoMissing: boolean): ReplaceFontChoice | null {
  if (view.kind === 'canvas') return view.preview.choice;
  if (view.kind === 'css') return cairoMissing ? CAIRO_PICTURE : null;
  return null;
}

/**
 * The note under the field, from the font choice (keep-font-spec.md section 9):
 *   image                       -> editPdf.textAsImage (saved as a picture);
 *   look-alike or Cairo         -> replace.closestMatch (some letters missing) or
 *                                  replace.closestMatchFont (the font can't be reused),
 *                                  unless it is the line's own family (a Carlito line in Carlito);
 *   original, nothing typed     -> no note.
 */
export type FontNote = { kind: 'image' } | { kind: 'letters' | 'font'; font: string } | null;

export function fontNote(choice: ReplaceFontChoice | null): FontNote {
  if (!choice) return null;
  if (choice.mode === 'image') return { kind: 'image' };
  if (choice.mode === 'original' || choice.sameFamily || !choice.font) return null;
  return { kind: choice.reason === 'font' ? 'font' : 'letters', font: choice.font };
}

/**
 * A font name inside a sentence: first-strong isolated (U+2068 … U+2069), so
 * "Noto Sans Arabic" reads right in the Arabic note, with no-break spaces, so
 * a phone-width note never splits the name across two lines.
 */
export function isolateName(name: string): string {
  return `\u2068${name.replace(/ /g, '\u00A0')}\u2069`;
}
