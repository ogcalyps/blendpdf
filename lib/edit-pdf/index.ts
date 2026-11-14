/**
 * lib/edit-pdf: the /edit-pdf engine (Phase B). This file is the ONLY entry
 * point the UI and the page import, and it must stay light: it may import
 * ./types and ./model statically and nothing else. pdf-lib, lib/pdf-text
 * (fontkit, bidi-js) and the export code are reached through import() inside
 * the functions below, so they load when the visitor first needs them, never
 * with the page (tests/pdf-text-lazy-load.test.ts walks static imports from
 * components/ and fails if one reaches lib/pdf-text).
 *
 * Owner: ENGINE builder. The signatures below are the contract with the UI
 * and the page; tests/edit-pdf-facade.test.ts keeps this file's static
 * imports to ./types and ./model.
 *
 * Phase C ("Edit text (beta)", phase-c-spec.md): detectTextLines (pdf.js,
 * ./lines), loadTextReplacer / checkLineRemoval / releaseTextReplacer
 * (PDFium wasm, ./replace). @embedpdf/pdfium is imported ONLY with import()
 * inside lib/edit-pdf/pdfium.ts, so neither its JS nor its 4.6 MB wasm loads
 * before the visitor picks Edit text (or saves a doc that has replace objects).
 *
 * Keep the font (keep-font-spec.md): analyzeLineFont and previewReplacement
 * (./keep-font, loaded with import()); releaseTextReplacer frees both.
 *
 * Workspace (workspace-spec.md 3): crop and stamps ride in ExportRequest; the
 * pure placement helpers come from ./model; appendPdfs (./insert, pdf-lib)
 * and hasTextLayer (./text-layer) load with import().
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { EditPdfError } from './types';
import type {
  AppendResult,
  DetectedTextPage,
  ExportOptions,
  ExportRequest,
  ExportResult,
  FontSourceDocument,
  LineDetectionOptions,
  LineDetectionPage,
  LineFont,
  LineRemovalCheck,
  ObjectId,
  PdfInspection,
  PreparedImage,
  PrepareImageOptions,
  ReplaceObject,
  ReplacePreview,
  ReplacePreviewRequest,
  SourceTextLine,
  TextEngine,
  TextExtent,
} from './types';

export * from './types';
export {
  LETTERHEAD_GAP_PT,
  LETTERHEAD_LOGO_MAX_W_PT,
  LETTERHEAD_LOGO_PT,
  LETTERHEAD_MARGIN_PT,
  LETTERHEAD_ROOM_MIN_SCALE,
  letterheadFooterWidth,
  letterheadHasContent,
  letterheadLogoBox,
  letterheadPlacement,
  letterheadRoom,
  letterheadScale,
  letterheadSideWidth,
  splitLetterheadText,
  STAMP_MARGIN_PT,
  WATERMARK_ANGLE,
  WATERMARK_IMAGE_MAX,
  WATERMARK_IMAGE_SCALE,
  WATERMARK_IMAGE_TILE_GAP_PT,
  WATERMARK_TILE_GAP_PT,
  arrowHeadArms,
  defaultReplaceSize,
  isUprightObject,
  lineBlock,
  lineBoxAt,
  objectBounds,
  pageNumberOrigin,
  pageNumberText,
  pageVisualSize,
  replaceAnchor,
  replaceSizeMax,
  rotateCropClockwise,
  rotateObjectClockwise,
  stepReplaceSize,
  visibleSize,
  watermarkImageSize,
  watermarkPlacements,
} from './model';
export type { BoxPt, LetterheadPlacement, LetterheadRoom, LetterheadSizes, MeasuredBlock, LineBlock, PageSize, PointPt, ReplaceAnchor, WatermarkPlacement } from './model';

/**
 * Open the file with pdf-lib (ignoreEncryption) right after upload, so an
 * encrypted file is caught before the visitor spends time editing it.
 * Rejects with EditPdfError('UNREADABLE') when pdf-lib cannot parse it.
 * Implementation: ./load.ts (loaded with import()).
 */
export async function inspectPdf(source: Uint8Array): Promise<PdfInspection> {
  const { inspectPdf: inspect } = await import('./load');
  return inspect(source);
}

/**
 * Apply the edits to the original bytes: flatten the AcroForm, set rotations,
 * delete/reorder/insert pages in place, draw every object, drop unreachable
 * objects, save. Rejects with EditPdfError('ENCRYPTED' | 'UNREADABLE' |
 * 'INVALID_REQUEST'). Implementation: ./export.ts (loaded with import()).
 */
export async function exportEditedPdf(
  source: Uint8Array,
  request: ExportRequest,
  options?: ExportOptions,
): Promise<ExportResult> {
  if (request.objects.some((object) => object.kind === 'replace')) replacerTouched = true;
  const { exportEditedPdf: run } = await import('./export');
  return run(source, request, options);
}

/**
 * Insert PDF: the pages of `files` appended, in order, to the END of the
 * working source. Existing page indexes and object numbers stay as they are,
 * so the session's detected lines and font analyses stay valid. Encrypted or
 * unreadable files are skipped and listed; when nothing was added, `bytes`
 * is `source` itself. Rejects with EditPdfError('ENCRYPTED' | 'UNREADABLE')
 * only for the source. Implementation: ./insert.ts (loaded with import()).
 */
export async function appendPdfs(source: Uint8Array, files: readonly { name: string; bytes: Uint8Array }[]): Promise<AppendResult> {
  const { appendPdfs: append } = await import('./insert');
  return append(source, files);
}

/**
 * False when none of the first `pages` pages (default 3) has any text, OCR
 * layers included: the workspace then offers "Make text searchable". Runs on
 * the editor's own pdf.js document. Implementation: ./text-layer.ts (loaded
 * with import()).
 */
export async function hasTextLayer(pdf: Pick<PDFDocumentProxy, 'numPages' | 'getPage'>, pages?: number): Promise<boolean> {
  const { hasTextLayer: check } = await import('./text-layer');
  return check(pdf, pages);
}

/**
 * The text layout the PDF writer uses, for the preview. Fetches CAIRO_FONT_URL
 * once and caches the engine for the session; with `fallback`, Liberation
 * Sans too, for boxes with letters Cairo lacks. Implementation:
 * ./text-engine.ts (loaded with import()).
 */
export async function loadTextEngine(options: { fallback?: boolean } = {}): Promise<TextEngine> {
  const { loadTextEngine: load } = await import('./text-engine');
  return load(options);
}

/**
 * Turn an uploaded image (or a SignaturePad PNG, as a Blob) into embeddable
 * bytes: JPEG passthrough when it is upright (no EXIF turn) and within
 * IMAGE_MAX_SIDE, otherwise drawn on a canvas, scaled down, and saved as PNG
 * when it has transparency or JPEG when it is opaque. Browser only.
 * Implementation: ./images.ts.
 */
export async function prepareImage(input: Blob, options?: PrepareImageOptions): Promise<PreparedImage> {
  const { prepareImage: prepare } = await import('./images');
  return prepare(input, options);
}

// ── Replace text (Phase C, beta) ───────────────────────────────────────────

/** ./replace (and through it PDFium) is reached from one place only. */
const replacer = () => import('./replace');
/** Set once anything may have loaded PDFium, so releaseTextReplacer() never loads it just to free it. */
let replacerTouched = false;

/**
 * True when this browser can run the removal engine at all (WebAssembly is
 * there). Sync and cheap: the toolbar uses it for the "needs a newer browser"
 * disabled reason before anything loads.
 */
export function isTextReplaceSupported(): boolean {
  return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';
}

/**
 * The lines of existing text on one source page, with a prefill for each,
 * from the editor's own pdf.js page (no second copy of the file). Pure
 * pdf.js work, no PDFium: 1-55 ms a page. The UI caches the result per
 * pageIndex for the session (lines belong to the source page, not to edits).
 * Implementation: ./lines.ts (loaded with import()).
 */
/** Where a page's text sits (./text-extent), for the letterhead's room. */
export async function textExtentOf(page: Pick<PDFPageProxy, 'getViewport' | 'getTextContent'>): Promise<TextExtent | null> {
  const { textExtentOf: extent } = await import('./text-extent');
  return extent(page);
}

export async function detectTextLines(
  page: LineDetectionPage,
  pageIndex: number,
  options?: LineDetectionOptions,
): Promise<DetectedTextPage> {
  const { detectTextLines: detect } = await import('./lines');
  return detect(page, pageIndex, options);
}

/**
 * Load PDFium (JS chunk + self-hosted wasm) once per session. The UI calls it
 * when the visitor picks Edit text, so a failure shows as the tool's disabled
 * reason before anyone types. A failed load clears the cache, so a later call
 * retries. Rejects with EditPdfError('REPLACE_UNAVAILABLE').
 * Implementation: ./replace.ts -> ./pdfium.ts.
 */
export async function loadTextReplacer(options?: Pick<ExportOptions, 'pdfiumWasm'>): Promise<void> {
  replacerTouched = true;
  try {
    const { loadTextReplacer: load } = await replacer();
    await load(options);
  } catch (error) {
    // The chunk itself did not arrive (offline, blocked): the same "couldn't load" for the visitor.
    if (error instanceof EditPdfError) throw error;
    throw new EditPdfError('REPLACE_UNAVAILABLE', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Before the box opens: can this line be removed cleanly? Runs the real
 * removal for this one line on the file held in PDFium (opened once per File
 * and kept until releaseTextReplacer), then the render-compare safety check;
 * the file itself is never changed. A PAGE_EFFECTS verdict is cached per
 * page. Advisory only: the export runs the full check again on the real
 * combination of lines. Rejects with EditPdfError('REPLACE_UNAVAILABLE' |
 * 'UNREADABLE').
 */
export async function checkLineRemoval(file: Blob, line: SourceTextLine): Promise<LineRemovalCheck> {
  replacerTouched = true;
  let check: (file: Blob, line: SourceTextLine) => Promise<LineRemovalCheck>;
  try {
    ({ checkLineRemoval: check } = await replacer());
  } catch (error) {
    throw new EditPdfError('REPLACE_UNAVAILABLE', error instanceof Error ? error.message : String(error));
  }
  return check(file, line);
}

/**
 * Free the file copy and the documents PDFium holds, and drop the module so
 * its heap can be collected (workspace unmount, another file). Safe to call
 * when nothing was loaded: then it loads nothing.
 */
export async function releaseTextReplacer(): Promise<void> {
  if (fontsTouched) {
    fontsTouched = false;
    const { releaseLineFonts } = await fontAnalysis();
    releaseLineFonts();
  }
  if (!replacerTouched) return;
  replacerTouched = false;
  const { releaseTextReplacer: release } = await replacer();
  await release();
}

// ── Keep the font (keep-font-spec.md) ──────────────────────────────────────

/** ./keep-font/analyze is reached from one place only. */
const fontAnalysis = () => import('./keep-font/analyze');
/** Set once the font analysis may hold a copy of the file, so releaseTextReplacer() frees it. */
let fontsTouched = false;

/**
 * When a line is clicked (in parallel with checkLineRemoval): what fonts the
 * line is drawn with and what they can draw, for ReplaceObject.font. The
 * first call per File loads the file with pdf-lib and harvests up to 30
 * pages through the editor's pdf.js document; later calls reuse that.
 * When pdf-lib can't read the file, the analysis only names the closest
 * match (from pdf.js's font name); null when not even that can run (the
 * replacement is then drawn in Cairo, as before). Rejects only when the
 * chunk did not load.
 * Implementation: ./keep-font/analyze.ts (loaded with import()).
 */
export async function analyzeLineFont(file: Blob, pdf: FontSourceDocument, line: SourceTextLine, options?: LineDetectionOptions): Promise<LineFont | null> {
  fontsTouched = true;
  const { analyzeLineFont: analyze } = await fontAnalysis();
  return analyze(file, pdf, line, options);
}

/**
 * The replacement line exactly as the export will draw it (original font,
 * look-alike, Cairo or picture), rendered by pdf.js on a transparent canvas,
 * with the font choice for the note and the resolved size. `text` is the
 * field's value while typing. Call it debounced; a newer call supersedes an
 * older one for the same object. Resolves null when no preview can be made
 * (the UI then shows the Phase C Cairo text). Implementation:
 * ./keep-font/preview.ts (loaded with import()).
 */
export async function previewReplacement(file: Blob, object: ReplaceObject, text: string, request: ReplacePreviewRequest): Promise<ReplacePreview | null> {
  fontsTouched = true;
  previewsTouched = true;
  const { previewReplacement: preview } = await fontPreview();
  return preview(file, object, text, request);
}

/** ./keep-font/preview is reached from one place only. */
const fontPreview = () => import('./keep-font/preview');
/** Set once a preview was asked for, so releasing previews never loads the module just to find nothing. */
let previewsTouched = false;

/**
 * Free the preview documents (each holds copies of the line's original
 * fonts) of every replace object not in `keep`: call it when objects go
 * (deleted, undone). Implementation: ./keep-font/preview.ts.
 */
export async function releaseReplacePreviews(keep: ReadonlySet<ObjectId>): Promise<void> {
  if (!previewsTouched) return;
  const { dropReplacePreviews } = await fontPreview();
  dropReplacePreviews(keep);
}
