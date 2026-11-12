/**
 * "Keep the font": the on-screen preview of a replaced line
 * (keep-font-spec.md section 8). The line is drawn by the export's own code
 * (./choose planReplacement, then ./draw drawPlan: ./write, lib/pdf-text or
 * the picture fallback) into a one-page PDF just big enough for it, upright,
 * and that page is rendered by pdf.js (through lib/pdfjs-init, with
 * import()) on a transparent canvas. What the visitor sees is what the
 * export writes, whatever the mode.
 *
 * Per replace object one pdf-lib document is kept with its fonts copied (or
 * embedded) once (dropped when the object goes: dropReplacePreviews); each
 * render swaps its single page, saves, renders, and destroys the pdf.js
 * document. Renders of one object run one at a time; a
 * request that is overtaken by a newer one before it starts resolves with
 * the newer one's result.
 *
 * Owner: ENGINE. Reached only through import() from ../index.
 */
import { PDFArray, PDFDocument, PDFName, PDFRef } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { PdfTextFont } from '@/lib/pdf-text';
import { renderTextBlockToImage } from '@/lib/text-to-image';
import { loadFontFile } from '../font';
import { loadSource } from '../load';
import { pruneUnreachable } from '../prune';
import { EDITOR_FONT_FAMILY } from '../types';
import type { PreparedImage, RasterTextInput, ReplaceObject, ReplacePreview, ReplacePreviewRequest } from '../types';
import { existingSession, onLineFontsReleased } from './analyze';
import { planReplacement } from './choose';
import { drawPlan } from './draw';
import type { DrawContext } from './draw';
import type { ReplacementPlan } from './types';
import { copyFontResolver } from './write';
import type { FontRefResolver } from './write';

/** Margins of the preview page around the drawn line, in em of the resolved size. */
const SIDE_EM = 0.5;
const ABOVE_BELOW_EM = 0.3;

/** What buildPreviewPdf needs besides the object (Node tests inject fonts and the source document). */
export interface PreviewDeps {
  loadFont: (url: string) => Promise<Uint8Array>;
  /** The ORIGINAL file in pdf-lib (original-font plans copy their font objects from it). */
  source: () => Promise<PDFDocument>;
  rasterize: (input: RasterTextInput) => Promise<PreparedImage>;
}

/** The one-line PDF of a preview and where its page sits on the line (line space: s along the baseline, p across). */
export interface PreviewPdf {
  plan: ReplacementPlan;
  /** Null when nothing is drawn (empty text). */
  bytes: Uint8Array | null;
  /** The page's MediaBox in line space: s0..s1 along the baseline, p0..p1 across it (absolute, the baseline inside). */
  box: { s0: number; s1: number; p0: number; p1: number } | null;
}

/** One object's preview document, reused from render to render. */
interface PreviewDoc {
  doc: PDFDocument;
  page: PDFPage | null;
  embedded: Map<string, Promise<PdfTextFont>>;
  fonts: (FontRefResolver & { copies(): PDFRef[] }) | null;
}

/** Previews documents by object id. Dropped with the font session. */
const docs = new Map<string, Promise<PreviewDoc>>();
onLineFontsReleased(() => {
  docs.clear();
  queues.clear();
  sourceCache = null;
});

/**
 * Drop the preview documents (and their copies of the original fonts) of
 * every object not in `keep`: lines deleted or no longer being edited.
 * An object that comes back (undo) gets a new one on its next render.
 */
export function dropReplacePreviews(keep: ReadonlySet<string>): void {
  for (const id of [...docs.keys()]) {
    if (keep.has(id)) continue;
    docs.delete(id);
    queues.delete(id);
  }
}

/** Objects that hold a preview document now (tests). */
export function previewDocumentIds(): string[] {
  return [...docs.keys()];
}

function previewDoc(object: ReplaceObject): Promise<PreviewDoc> {
  let entry = docs.get(object.id);
  if (!entry) {
    entry = PDFDocument.create({ updateMetadata: false }).then((doc) => ({ doc, page: null, embedded: new Map(), fonts: null }));
    docs.set(object.id, entry);
  }
  return entry;
}

/** Take the previous page out of the document, objects and all, so the file does not grow render after render. */
function dropPage(state: PreviewDoc): void {
  const { page, doc } = state;
  if (!page) return;
  const refs: PDFRef[] = [];
  const raw = page.node.get(PDFName.of('Contents'));
  if (raw instanceof PDFRef) refs.push(raw);
  const list = raw instanceof PDFArray ? raw : doc.context.lookup(raw);
  if (list instanceof PDFArray) for (const item of list.asArray()) if (item instanceof PDFRef) refs.push(item);
  doc.removePage(0);
  for (const ref of refs) doc.context.delete(ref);
  doc.context.delete(page.ref);
  state.page = null;
}

/**
 * Draw `text` for `object` the way the export will, into a one-page PDF
 * whose page is just the line (upright: s runs left to right, p bottom to
 * top). The seam the Node tests compare with the export.
 */
export async function buildPreviewPdf(object: ReplaceObject, text: string, deps: PreviewDeps): Promise<PreviewPdf> {
  const plan = await planReplacement(object, text, { loadFont: deps.loadFont });
  if (plan.kind === 'empty') return { plan, bytes: null, box: null };
  const state = await previewDoc(object);
  dropPage(state);
  const page = state.doc.addPage([10, 10]);
  state.page = page;
  const { line } = object;
  const g = line.geometry;
  const ctx: DrawContext = {
    doc: state.doc,
    embedded: state.embedded,
    loadFont: deps.loadFont,
    rasterize: deps.rasterize,
    fonts: {
      refFor(font) {
        if (!state.fonts) throw new Error('keep-font: the preview has no source document');
        return state.fonts.refFor(font);
      },
    },
  };
  if (plan.kind === 'original' && !state.fonts) state.fonts = copyFontResolver(await deps.source(), state.doc);
  const drawn = await drawPlan(page, object, text, plan, { ux: 1, uy: 0, baseline: g.baseline }, ctx);
  if (!drawn) return { plan, bytes: null, box: null };
  const em = plan.size;
  const scale = g.size > 0 ? plan.size / g.size : 1;
  const ascent = Math.max(drawn.ascent, g.ascent * scale);
  const descent = Math.max(drawn.descent, g.descent * scale);
  const s0 = Math.min(g.start, drawn.start) - SIDE_EM * em;
  const s1 = Math.max(g.end, drawn.end) + SIDE_EM * em;
  const p0 = g.baseline - descent - ABOVE_BELOW_EM * em;
  const p1 = g.baseline + ascent + ABOVE_BELOW_EM * em;
  page.setMediaBox(s0, p0, s1 - s0, p1 - p0);
  // pdf-lib rewrites an embedded subset font as new objects on every save: drop the old ones (and the
  // last page's), keeping the fonts this document will point at again.
  await state.doc.flush();
  const embedded = await Promise.all([...state.embedded.values()]);
  pruneUnreachable(state.doc.context, [...(state.fonts?.copies() ?? []), ...embedded.map((font) => font.pdfFont.ref)]);
  const bytes = await state.doc.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false });
  return { plan, bytes, box: { s0, s1, p0, p1 } };
}

// ── Browser: render with pdf.js ────────────────────────────────────────────

let sourceCache: { file: Blob; doc: Promise<PDFDocument> } | null = null;

/** The session's pdf-lib document of the original file, or one loaded for the preview (and kept for the file). */
function sourceOf(file: Blob): Promise<PDFDocument> {
  const session = existingSession(file);
  if (session) return session.then((s) => s.doc);
  if (!sourceCache || sourceCache.file !== file) sourceCache = { file, doc: file.arrayBuffer().then((buffer) => loadSource(new Uint8Array(buffer))) };
  return sourceCache.doc;
}

async function defaultRasterize(input: RasterTextInput): Promise<PreparedImage> {
  const picture = await renderTextBlockToImage({ ...input, fontFamily: `"${EDITOR_FONT_FAMILY}", Cairo, sans-serif` });
  return { format: 'png', bytes: new Uint8Array(picture.bytes), width: picture.width, height: picture.height };
}

/** The parts of pdf.js the preview render uses (the browser passes lib/pdfjs-init's module; Node tests the legacy build). */
export interface PreviewPdfJs {
  getDocument(src: { data: Uint8Array }): {
    promise: Promise<{
      getPage(n: number): Promise<{
        getViewport(params: { scale: number }): { width: number; height: number };
        render(params: { canvasContext: unknown; viewport: unknown; background?: string }): { promise: Promise<void> };
      }>;
    }>;
    destroy(): Promise<void>;
  };
}

/**
 * Page 1 of a preview PDF on a transparent canvas, `scale` device pixels per
 * point. Exported for the Node test (legacy pdf.js + node-canvas).
 */
export async function renderPreviewCanvas<C extends { width: number; height: number; getContext(kind: '2d'): unknown }>(
  pdfjs: PreviewPdfJs,
  bytes: Uint8Array,
  scale: number,
  makeCanvas: (width: number, height: number) => C,
): Promise<C> {
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = makeCanvas(Math.max(1, Math.ceil(viewport.width)), Math.max(1, Math.ceil(viewport.height)));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('no 2d context');
    await page.render({ canvasContext: context, viewport, background: 'rgba(0,0,0,0)' }).promise;
    return canvas;
  } finally {
    await task.destroy();
  }
}

async function renderPage(bytes: Uint8Array, scale: number): Promise<HTMLCanvasElement> {
  const pdfjs = (await (await import('@/lib/pdfjs-init')).getPdfJs()) as unknown as PreviewPdfJs;
  return renderPreviewCanvas(pdfjs, bytes, scale, (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  });
}

interface Queue {
  /** Request number of the newest call. */
  newest: number;
  /** The newest call's result, which an overtaken call resolves with. */
  latest: Promise<ReplacePreview | null>;
  /** Renders of this object, one after another (they share one pdf-lib document). */
  chain: Promise<unknown>;
}
const queues = new Map<string, Queue>();

async function renderOnce(file: Blob, object: ReplaceObject, text: string, request: ReplacePreviewRequest): Promise<ReplacePreview | null> {
  const built = await buildPreviewPdf(object, text, {
    loadFont: loadFontFile,
    source: () => sourceOf(file),
    rasterize: defaultRasterize,
  });
  const { plan, bytes } = built;
  const canvas = bytes ? await renderPage(bytes, request.pxPerPt * request.pixelRatio) : null;
  return { choice: plan.choice, size: plan.size, canvas, ...previewPlacement(object, built), ...('transient' in plan && plan.transient ? { transient: true as const } : {}) };
}

/** Where the preview page sits, in points: from the line's left ink edge (geometry.start) and from its baseline up (ReplacePreview). */
export function previewPlacement(object: ReplaceObject, built: PreviewPdf): Pick<ReplacePreview, 'left' | 'top' | 'width' | 'height'> {
  const { box } = built;
  if (!box) return { left: 0, top: 0, width: 0, height: 0 };
  const g = object.line.geometry;
  return { left: box.s0 - g.start, top: box.p1 - g.baseline, width: box.s1 - box.s0, height: box.p1 - box.p0 };
}

/**
 * The replacement line exactly as the export will draw it, on a transparent
 * canvas. Null when no preview can be made (the UI keeps the Phase C Cairo text).
 */
export async function previewReplacement(file: Blob, object: ReplaceObject, text: string, request: ReplacePreviewRequest): Promise<ReplacePreview | null> {
  let queue = queues.get(object.id);
  if (!queue) {
    queue = { newest: 0, latest: Promise.resolve(null), chain: Promise.resolve() };
    queues.set(object.id, queue);
  }
  const q = queue;
  const ticket = ++q.newest;
  const run = q.chain.then(async (): Promise<ReplacePreview | null | typeof OVERTAKEN> => {
    if (ticket !== q.newest) return OVERTAKEN;
    try {
      return await renderOnce(file, object, text, request);
    } catch (error) {
      console.warn('keep-font: the preview failed', error);
      return null;
    }
  });
  q.chain = run.catch(() => undefined);
  // Overtaken before it started: the newest request's answer is this one's too.
  const result = run.then((value) => (value === OVERTAKEN ? q.latest : value));
  q.latest = result;
  return result;
}

const OVERTAKEN = Symbol('overtaken');
