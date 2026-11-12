/**
 * /edit-pdf (Phase B): the document model and the contracts between the
 * editor UI (components/edit-pdf), the engine (lib/edit-pdf) and the page
 * (app/[locale]/edit-pdf/page.tsx). The spec is phase-b-spec.md in the editor
 * research folder; change this file only through the integrator.
 *
 * COORDINATES
 * Every position is a fraction (0..1) of the VISUAL page: the page as the
 * editor shows it, i.e. its visible box (CropBox ∩ MediaBox) turned by its own
 * /Rotate PLUS the quarter turns added in the editor. Origin top-left, x to
 * the right, y down. This is lib/pdf-geometry's VisualBox convention, read on
 * the page after its final rotation has been set, so export maps a box with
 * geometryOfPage(page) + visualBoxToPdf / visualBoxToPdfRect and nothing else.
 *
 * Sizes that must not depend on the page (font size, stroke width) are in PDF
 * points.
 *
 * Exception, "Replace text" (Phase C, phase-c-spec.md): the LINE a replace
 * object removes is kept in SOURCE PDF user space (LineGeometry), because the
 * removal engine (PDFium) works on the original page, before any page op.
 *
 * "Keep the font" (keep-font-spec.md): a replacement is drawn in the line's
 * ORIGINAL font when that font can draw every character, else in the closest
 * look-alike we ship, else in Cairo (see LineFont, ReplaceFontChoice).
 *
 * No runtime imports: UI code imports this (through ./index) statically.
 */
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import type { PdfRect, VisualBox } from '@/lib/pdf-geometry';
import type { LineFontData } from './keep-font/types';
import type { SaveInput, SaveOutput, SavePlan, SourceFixes, WorkspaceMode } from '@/lib/workspace/types';
import type { EditorState } from '@/components/edit-pdf/state';

export type { PdfRect, VisualBox };

export type PageId = string;
export type ObjectId = string;
export type AssetId = string;

/** Clockwise, like /Rotate and pdf.js getViewport({ rotation }). */
export type QuarterTurn = 0 | 90 | 180 | 270;
export type Direction = 'ltr' | 'rtl';

// ── Fixed choices (the owner's "keep it lean" rule: no other options) ──────

/** The six colours offered for text, shapes, lines and drawing. */
export const PALETTE = ['#000000', '#1D4ED8', '#DC2626', '#15803D', '#FF6B35', '#FFFFFF'] as const;
export type PaletteColor = (typeof PALETTE)[number];

/** Highlight: this yellow, drawn with blend mode Multiply (CSS mix-blend-mode: multiply in the preview). */
export const HIGHLIGHT_COLOR = '#FDE047';
/** Cover: opaque white. It hides, it does not remove. */
export const COVER_COLOR = '#FFFFFF';

/** Text size stepper, in points. */
export const TEXT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72] as const;
/** Stroke width stepper for shapes, lines and drawing, in points. */
export const STROKE_WIDTHS = [1, 2, 3, 4, 6, 8, 12] as const;
export const DEFAULT_TEXT_SIZE = 14;
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_TEXT_COLOR: PaletteColor = '#000000';
export const DEFAULT_STROKE_COLOR: PaletteColor = '#DC2626';

/** Zoom, as a multiple of fit-to-width. */
export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3] as const;
export const HISTORY_LIMIT = 100;

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Longest side of an embedded image, in pixels; larger ones are scaled down. */
export const IMAGE_MAX_SIDE = 2400;
/** Canvas backing-store cap (iOS Safari refuses canvases above ~16.7 MP). */
export const MAX_CANVAS_PIXELS = 16_000_000;
/** Minimum hit area for handles and buttons, in CSS pixels. */
export const MIN_TOUCH_TARGET = 44;
/** FontFace family the UI registers from the engine's Cairo bytes (TextEngine.fontBytes). */
export const EDITOR_FONT_FAMILY = 'BlendPDF Editor Cairo';

// ── Pages ───────────────────────────────────────────────────────────────────

/** What pdf.js reports for a page of the uploaded file (fixed for the session). */
export interface SourcePageInfo {
  /** Visible box (CropBox ∩ MediaBox, pdf.js page.view) in points, before any rotation. */
  width: number;
  height: number;
  /** The page's own /Rotate, normalised (pdf.js page.rotate). */
  rotate: QuarterTurn;
}

export type PageSource =
  /** A page of the uploaded PDF, by 0-based index. */
  | { kind: 'source'; index: number }
  /** A page added in the editor: a blank page this many points wide and high (before `rotation`). */
  | { kind: 'blank'; width: number; height: number };

/**
 * One page of the result, in output order. A deleted page is simply absent
 * from EditorDoc.pages (undo brings it back from the snapshot).
 */
export interface EditorPage {
  id: PageId;
  source: PageSource;
  /** Quarter turns added in the editor, on top of the source page's /Rotate. */
  rotation: QuarterTurn;
  /**
   * What stays visible, in fractions of the visual page BEFORE this crop (the
   * page as pageVisualSize gives it, editor turns included). Objects keep their
   * coordinates on that same pre-crop page. Absent = not cropped. Export sets
   * /CropBox = visualBoxToPdfRect(g, crop) after drawing objects; turning the
   * page turns the crop with it (rotateCropClockwise).
   */
  crop?: VisualBox;
}

/** Smallest crop side, in points. */
export const MIN_CROP_PT = 18;

// ── Objects ─────────────────────────────────────────────────────────────────

/** A point in fractions of the visual page. */
export interface PagePoint {
  x: number;
  y: number;
}

interface ObjectBase {
  id: ObjectId;
  pageId: PageId;
}

/**
 * Vector text through lib/pdf-text in Cairo. box.wPct is the wrap width the
 * visitor set; box.hPct is DERIVED from the engine layout (UI keeps it in
 * sync) and is only used for selection, bounds and overlap warnings. Each
 * paragraph takes its own direction (UAX #9 P2-P3) and aligns to its start.
 */
export interface TextObject extends ObjectBase {
  kind: 'text';
  box: VisualBox;
  text: string;
  /** Font size in points. */
  size: number;
  color: PaletteColor;
}

/** A picture, uploaded or a signature from SignaturePad. Drawn stretched to `box` (the UI keeps the aspect). */
export interface ImageObject extends ObjectBase {
  kind: 'image';
  box: VisualBox;
  assetId: AssetId;
  /** Came from the signature dialog (only changes labels). */
  signature?: true;
}

/** Outline only, no fill. The stroke is centred on the box edge, as in SVG and pdf-lib. */
export interface ShapeObject extends ObjectBase {
  kind: 'shape';
  shape: 'rectangle' | 'ellipse';
  box: VisualBox;
  color: PaletteColor;
  /** Points. */
  strokeWidth: number;
}

/** A straight line, with an arrowhead at `to` when `arrow` is true. */
export interface LineObject extends ObjectBase {
  kind: 'line';
  from: PagePoint;
  to: PagePoint;
  arrow: boolean;
  color: PaletteColor;
  /** Points. */
  strokeWidth: number;
}

/** One freehand stroke: [x0, y0, x1, y1, ...] in page fractions, drawn with round caps and joins. */
export interface InkObject extends ObjectBase {
  kind: 'ink';
  points: readonly number[];
  color: PaletteColor;
  /** Points. */
  strokeWidth: number;
}

/** HIGHLIGHT_COLOR rectangle, blend mode Multiply. */
export interface HighlightObject extends ObjectBase {
  kind: 'highlight';
  box: VisualBox;
}

/** COVER_COLOR opaque rectangle. Label: "Hides it on the page. What's underneath is still in the file." */
export interface CoverObject extends ObjectBase {
  kind: 'cover';
  box: VisualBox;
}

// ── Replace text (Phase C, beta) ────────────────────────────────────────────

/** '#RRGGBB'. Every PaletteColor is one. */
export type HexColor = `#${string}`;

/** Size range of a replacement, in points; Smaller/Bigger move by REPLACE_SIZE_STEP. */
export const REPLACE_MIN_SIZE = 4;
export const REPLACE_MAX_SIZE = 72;
export const REPLACE_SIZE_STEP = 0.5;
/**
 * Default size = line size x (old line width / Cairo width of the prefill at
 * the line size), clamped to this range: Cairo draws about 15-20% larger than
 * Amiri, Arial or Naskh at the same point size. REPLACE_FIT_UNSURE when the
 * prefill was flagged as unreliable (there is nothing to measure).
 */
export const REPLACE_FIT_MIN = 0.6;
export const REPLACE_FIT_MAX = 1.15;
export const REPLACE_FIT_UNSURE = 0.85;

/**
 * Where a detected line sits on its SOURCE page, in PDF user space (the
 * unrotated page, origin bottom-left, y up: what PDFium sees). Along the
 * baseline s = x*ux + y*uy; across it p = -x*uy + y*ux.
 */
export interface LineGeometry {
  /** Ink box of the line (baseline - descent .. baseline + ascent, start .. end). Display only: on exact line spacing it overlaps its neighbours, so removal never goes by this rect. */
  rect: PdfRect;
  /** Unit vector of the glyph advance direction (left to right of the line as drawn). */
  ux: number;
  uy: number;
  /** p of the baseline. */
  baseline: number;
  /** s of the line's first and last ink. */
  start: number;
  end: number;
  /** Largest font size on the line, and its ascent and descent, in points (descent positive). */
  size: number;
  ascent: number;
  descent: number;
  /** Baselines (p) of the page's other lines on the same axis that overlap this one along s. A text object belongs to this line only if it is nearer this baseline than any of these. */
  neighbours: readonly number[];
}

/** One line of existing text that detectTextLines found on a source page. Immutable for the session. */
export interface SourceTextLine {
  /** `${pageIndex}:${n}`, n in detection order. Stable for the file, so one replace per line can be enforced. */
  id: string;
  /** 0-based page of the uploaded file. */
  pageIndex: number;
  /** Prefill for the edit field: logical order, NFKC, controls stripped. '' when `textUnsure`. */
  text: string;
  /** The prefill sanity check failed (dots drawn as separate glyphs, doubled glyphs, controls): start the field empty. */
  textUnsure: boolean;
  /** Paragraph direction of the line; the replacement keeps this line's start edge (left for 'ltr', right for 'rtl'). */
  direction: Direction;
  /** Fill colour of most of the line's glyphs. */
  color: HexColor;
  /** The line's box on the visual page at editor rotation 0 (the page turned by its own /Rotate only). */
  box: VisualBox;
  /**
   * Clockwise quarter turn of the line's reading direction on that visual
   * page (0 = reads normally), or null when it is not a quarter turn
   * (a slanted stamp): such a line is never offered.
   */
  turn: QuarterTurn | null;
  /** Every glyph is invisible (render mode 3 or 7): the OCR layer of a scan. Never offered: the picture would still show the old words. */
  invisible: boolean;
  geometry: LineGeometry;
}

/** detectTextLines' result for one source page. */
export interface DetectedTextPage {
  pageIndex: number;
  /** In reading order of the page (top to bottom, then by start). */
  lines: SourceTextLine[];
}

/** The parts of a pdf.js page line detection reads (the editor passes its PDFPageProxy). */
export type LineDetectionPage = Pick<PDFPageProxy, 'view' | 'rotate' | 'getTextContent' | 'getOperatorList' | 'commonObjs'>;

export interface LineDetectionOptions {
  /** pdf.js OPS table. Default: (await getPdfJs()).OPS; Node tests pass the legacy build's. */
  ops?: Readonly<Record<string, number>>;
}

/**
 * "Edit text (beta)": the visitor's new wording for one existing line. On
 * export the line's original text objects are REMOVED from the file (PDFium,
 * on the original bytes, before any page op), then `text` is drawn on the
 * old baseline, from the old start edge, along the line's own axis: in the
 * line's original font when it can draw every character, else in the closest
 * look-alike, else in Cairo (keep-font-spec.md section 3). `text` may be ''
 * (the line is removed, nothing drawn).
 *
 * Anchored: it cannot be moved or resized, and its page cannot be turned
 * while it exists (the reducer refuses), so `box` never changes after
 * creation. One replace object per SourceTextLine.id.
 */
export interface ReplaceObject extends ObjectBase {
  kind: 'replace';
  /** The line being replaced, exactly as detected. Its prefill is `line.text`. */
  line: SourceTextLine;
  /** lineBoxAt(line, page.rotation) at creation: what is highlighted, hit-tested, masked in the preview and checked for annotation overlaps. */
  box: VisualBox;
  /** One line, no line breaks. */
  text: string;
  /**
   * Points, REPLACE_MIN_SIZE..REPLACE_MAX_SIZE, when `autoSize` is absent.
   * With `autoSize` it is only a valid placeholder (the rounded line size):
   * the engine resolves the real size (ReplacePreview.size).
   */
  size: number;
  /** Starts as line.color; the mini-bar offers the PALETTE. */
  color: HexColor;
  /**
   * The line's font analysis (analyzeLineFont), attached when the box opens.
   * Absent when the analysis failed or was never run: the text is drawn in
   * Cairo exactly as in Phase C. Shared by reference, never mutated.
   */
  font?: LineFont;
  /**
   * The engine chooses the size: the original size when the line is drawn
   * in its own font, the Phase C width fit in a look-alike or Cairo. Set when
   * the box opens with a `font`; Smaller or Bigger drop it (and set `size`).
   */
  autoSize?: true;
}

// ── Keep the font (keep-font-spec.md) ────────────────────────────────────────

/**
 * Engine analysis of the font(s) one detected line is drawn with: the line's
 * glyphs (pdf.js font id, content-stream code, position), the PDF font
 * objects they resolve to, and what each face can draw (harvested from the
 * whole document, Arabic joining forms included). Plain data, immutable;
 * the UI stores it on the ReplaceObject and reads only `lineId` and `size`.
 */
export interface LineFont {
  /** The SourceTextLine.id it was computed for. */
  readonly lineId: string;
  /** Effective size in points of the line's main font (median over its glyphs): the size of a replacement drawn in that font. */
  readonly size: number;
  /** Engine-private (lib/edit-pdf/keep-font/types.ts). */
  readonly data: LineFontData;
}

/** How a replacement line is drawn, best first. */
export type ReplaceFontMode =
  /** The line's own font objects, referenced by the new text: looks like the original, copy and search keep working. */
  | 'original'
  /** A shipped open-licence font matched by name and style (public/fonts). */
  | 'lookalike'
  /** The bundled Cairo, the last font: what Phase C always did. */
  | 'cairo'
  /** Even Cairo lacks a character: the line is saved as a picture (warning TEXT_AS_IMAGE). */
  | 'image';

export interface ReplaceFontChoice {
  mode: ReplaceFontMode;
  /** Family named in the note ("Liberation Sans", "Noto Sans Arabic", "Cairo"); null for 'original' and 'image'. */
  font: string | null;
  /**
   * Why it is not the original font, null for 'original':
   * 'letters' = the original lacks some typed letter (or its joined form, a
   * lam-alef, a vowel mark's placement); 'font' = the original can't be
   * reused for new text at all (unsupported font type, unresolved, no
   * analysis).
   */
  reason: 'letters' | 'font' | null;
  /** The look-alike IS the original's family (a Carlito line drawn in Carlito): show no note. */
  sameFamily: boolean;
}

/** What previewReplacement needs to draw at the page's current zoom. */
export interface ReplacePreviewRequest {
  /** CSS pixels per PDF point on the page as shown. */
  pxPerPt: number;
  /** window.devicePixelRatio: the canvas is drawn at pxPerPt * pixelRatio. */
  pixelRatio: number;
}

/**
 * The new line drawn by the export's own code into a one-line PDF and
 * rendered by pdf.js (keep-font-spec.md section 8), so the preview is the
 * output. Upright: the line's reading direction runs left to right on it.
 */
export interface ReplacePreview {
  choice: ReplaceFontChoice;
  /** The size the export will use, in points (autoSize resolved). Smaller and Bigger step from this. */
  size: number;
  /** Transparent canvas with the glyphs; null when there is nothing to draw (empty text). */
  canvas: HTMLCanvasElement | null;
  /** Points from the line's LEFT ink edge (geometry.start) to the canvas' left edge; negative = further left. */
  left: number;
  /** Points from the baseline UP to the canvas' top edge. */
  top: number;
  /** Canvas size in points (CSS size = points * pxPerPt). */
  width: number;
  height: number;
  /** A fallback because a look-alike font did not load: shown, but not kept (the save fetches the font again). */
  transient?: true;
}

/** The pdf.js document the font analysis harvests from (the editor's own PDFDocumentProxy). */
export type FontSourceDocument = Pick<PDFDocumentProxy, 'numPages' | 'getPage'>;

/** Why one line can't be replaced, found before the box opens (checkLineRemoval). */
export type LineRefusal =
  /** Rewriting this page would change something besides the line (PDFium 2.15.1 drops soft masks: CSS shadows, Word shape effects). */
  | 'PAGE_EFFECTS'
  /** A text object runs from this line into another and the glyph-level split failed. */
  | 'CANT_ISOLATE';

export type LineRemovalCheck =
  | { ok: true }
  | {
      ok: false;
      reason: LineRefusal;
      /** Set when every line of this page gets the same answer (the page itself changes when rewritten). */
      wholePage?: true;
    };

export type EditorObject =
  | TextObject
  | ImageObject
  | ShapeObject
  | LineObject
  | InkObject
  | HighlightObject
  | CoverObject
  | ReplaceObject;

export type ObjectKind = EditorObject['kind'];

/**
 * What undo/redo snapshots and what export receives. Immutable: every change
 * makes a new array and replaces only the objects it touches. Array order of
 * `objects` is z-order (later = on top), per page.
 */
// ── Document stamps (workspace: watermark, page numbers) ───────────────────

export type StampPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
/** Same four values as lib/pdf-ops PageNumberFormat, for parity with /add-page-numbers. */
export type PageNumberFormat = '1' | '1 / 10' | 'Page 1' | 'Page 1 of 10';

export interface PageNumberStamp {
  position: StampPosition;
  format: PageNumberFormat;
  /**
   * The format in the visitor's language with literal {n} and {total}, made by
   * the UI from i18n (e.g. "Page {n} of {total}", "صفحة {n} من {total}"). No line breaks.
   */
  template: string;
  /** Integer, 1..99999. The first saved page shows this number. */
  startFrom: number;
  /** Points, PAGE_NUMBER_SIZE_MIN..MAX. */
  size: number;
}
export const PAGE_NUMBER_SIZE_MIN = 8;
export const PAGE_NUMBER_SIZE_MAX = 36;
export const DEFAULT_PAGE_NUMBER_SIZE = 12;

export interface WatermarkStamp {
  type: 'text' | 'image';
  /** type 'text': the words (one or more lines), drawn in Cairo through lib/pdf-text. */
  text: string;
  /** type 'image': an ImageAsset of the editor's store (prepareImage output). */
  assetId?: AssetId;
  position: 'center' | 'diagonal' | 'tiled';
  /** 0.1..1, step 0.1. */
  opacity: number;
  /** Text size in points, WATERMARK_SIZE_MIN..MAX. Ignored for images. */
  size: number;
}
export const WATERMARK_SIZE_MIN = 12;
export const WATERMARK_SIZE_MAX = 120;
export const DEFAULT_WATERMARK: Omit<WatermarkStamp, 'text'> = { type: 'text', position: 'diagonal', opacity: 0.3, size: 48 };
/** Fixed grey, like lib/pdf-ops (rgb 0.7): no colour option (parity, lean). */
export const WATERMARK_COLOR = '#B3B3B3';

/**
 * A letterhead: text at the top left and top right (often the name in a
 * Latin script and in Arabic), a logo between them, a rule under them, and
 * small centred lines at the bottom. Saved on the visitor's device and
 * reused (lib/letterhead-store.ts).
 */
export interface LetterheadStamp {
  /** One or more lines, top left. May be empty. */
  left: string;
  /** One or more lines, top right. May be empty. */
  right: string;
  /** An ImageAsset of the editor's store, centred at the top. */
  logoAssetId?: AssetId;
  /** One or more small lines, centred at the bottom. May be empty. */
  footer: string;
  pages: 'all' | 'first';
}
/**
 * Points. Each side's first line is the name, at LETTERHEAD_NAME_SIZE; the
 * lines under it at LETTERHEAD_TEXT_SIZE. Text wraps to its side's width; a
 * word still too wide makes the block smaller, down to LETTERHEAD_MIN_SCALE.
 */
export const LETTERHEAD_NAME_SIZE = 12;
export const LETTERHEAD_TEXT_SIZE = 9;
export const LETTERHEAD_FOOTER_SIZE = 8;
export const LETTERHEAD_MIN_SCALE = 0.75;
export const LETTERHEAD_MAX_CHARS = 300;
/** Rules under the header and over the footer. */
export const LETTERHEAD_RULE_COLOR = '#9CA3AF';

/** The topmost and bottommost text on a page, in points from the visible box's top (y down). */
export interface TextExtent {
  top: number;
  bottom: number;
}

export interface DocStamps {
  watermark?: WatermarkStamp;
  pageNumbers?: PageNumberStamp;
  letterhead?: LetterheadStamp;
}

export interface EditorDoc {
  pages: readonly EditorPage[];
  objects: readonly EditorObject[];
  /** Drawn on every saved page, above everything, inside each page's visible (crop-aware, rotation-aware) box. */
  stamps?: DocStamps;
}

// ── Images ──────────────────────────────────────────────────────────────────

/** Bytes ready for pdf-lib: embedJpg for 'jpg', embedPng for 'png'. */
export interface PreparedImage {
  format: 'jpg' | 'png';
  bytes: Uint8Array;
  /** Pixels. */
  width: number;
  height: number;
}

/** A PreparedImage the editor holds. Assets live outside undo history and are never mutated. */
export interface ImageAsset extends PreparedImage {
  id: AssetId;
}

export interface PrepareImageOptions {
  /** Cut fully transparent margins (signatures). */
  trim?: boolean;
}

// ── Export ──────────────────────────────────────────────────────────────────

export interface ExportRequest {
  /** Output pages, in order. Source pages missing from this list are deleted from the file. */
  pages: readonly EditorPage[];
  /** Objects whose pageId is not in `pages` are ignored. */
  objects: readonly EditorObject[];
  assets: Readonly<Record<AssetId, ImageAsset>>;
  /** Direction for a text box with no strong character at all: the UI locale's ('rtl' on /ar). */
  fallbackDirection: Direction;
  /** Watermark, page numbers and letterhead; assets must include stamps.watermark.assetId and stamps.letterhead.logoAssetId. */
  stamps?: DocStamps;
  /**
   * Where each page's own text sits (pdf.js, textExtentOf), for the
   * letterhead: a page whose text would sit under it has its content
   * shrunk and moved into the space left (letterheadRoom). Pages missing
   * here keep their content where it is.
   */
  textExtents?: Readonly<Record<PageId, TextExtent>>;
  /**
   * true (default, Phase B behaviour): flatten every form field it can.
   * false: leave the form interactive; only fields whose widgets are all on
   * deleted pages are removed. The UI passes plan.flatten || objects on saved pages.
   */
  flattenForm?: boolean;
}

export type ExportWarning =
  /** The object overlaps an annotation that stays on the page; viewers draw annotations on top of page content. */
  | { code: 'OVERLAPS_ANNOTATION'; objectId: ObjectId; pageNumber: number }
  /** The text uses characters Cairo lacks (and, for a replaced line, its original font and look-alike too), so the box was saved as a picture (lib/text-to-image). */
  | { code: 'TEXT_AS_IMAGE'; objectId: ObjectId; pageNumber: number }
  /** Some form fields could not be flattened and stay interactive (on top of the additions). */
  | { code: 'FORM_NOT_FLATTENED'; fields: number };

export interface ExportResult {
  bytes: Uint8Array;
  warnings: ExportWarning[];
  /**
   * Replace objects whose original line was removed AND verified gone (the
   * reopened page selects no text object on that line). Equals the number of
   * replace objects on kept pages, or the export rejects: it never returns
   * with an old line still on its page. A bookmark reading exactly like the
   * line follows it; other copies of the words (the document title, the
   * /ActualText of a tag spanning several lines) are not checked.
   */
  removedLines: number;
}

/** Input for the image fallback of a text box (sizes in points; `scale` = pixels per point). */
export interface RasterTextInput {
  text: string;
  size: number;
  width: number;
  color: HexColor;
  fallbackDirection: Direction;
  scale: number;
}

/** Injection points for tests (Node has no fetch of /fonts and no canvas). */
export interface ExportOptions {
  /** Cairo TTF bytes; default: fetch(CAIRO_FONT_URL). */
  fontBytes?: Uint8Array;
  /** Bytes of a shipped font by its URL (look-alikes under /fonts); default: fetch, cached per session. Node tests read public/fonts. */
  loadFont?: (url: string) => Promise<Uint8Array>;
  /** Default: lib/text-to-image's multi-line renderer (browser only). */
  rasterizeText?: (input: RasterTextInput) => Promise<PreparedImage>;
  /** PDFium's wasm bytes. Default: the package fetches its own Turbopack-emitted /_next/static/media file; Node tests read node_modules. */
  pdfiumWasm?: Uint8Array;
}

export interface PdfInspection {
  /** The trailer has /Encrypt. pdf-lib cannot write such a file: point the visitor to /unlock-pdf. */
  encrypted: boolean;
  /** 0 when the file is encrypted and its page tree can't be read without the password. */
  pageCount: number;
}

export type EditPdfErrorCode =
  /** Password-protected (or owner-password restricted) PDF. UI: errors.encryptedPdfHint + link to /unlock-pdf. */
  | 'ENCRYPTED'
  /** pdf-lib could not parse the file. */
  | 'UNREADABLE'
  /** The request does not fit the file (unknown source page, missing asset, no pages). A bug, not the visitor's fault. */
  | 'INVALID_REQUEST'
  /** The removal engine (PDFium wasm) could not load: no WebAssembly, network, memory. Nothing was saved. */
  | 'REPLACE_UNAVAILABLE'
  /** A page's rewrite failed the render-compare safety check, or a line could not be isolated. `objectIds` / `pageNumbers` say where. Nothing was saved. */
  | 'REPLACE_REFUSED'
  /** Removal ran but could not be verified (a text object still sits on the line), page counts disagree, or PDFium failed to open or save. Nothing was saved. */
  | 'REPLACE_FAILED';

export interface EditPdfErrorDetails {
  /** REPLACE_REFUSED / REPLACE_FAILED: the replace objects concerned. */
  objectIds?: readonly ObjectId[];
  /** REPLACE_REFUSED / REPLACE_FAILED: their 1-based OUTPUT page numbers, ascending. */
  pageNumbers?: readonly number[];
}

/**
 * Codes that mean "we looked at this file and correctly declined it", not "we
 * broke". They carry a 4xx-style status so trackToolError files them as
 * tool_input_rejected and the edit_pdf error rate counts only real failures.
 */
const DECLINED_STATUS: Partial<Record<EditPdfErrorCode, number>> = {
  ENCRYPTED: 422,
  UNREADABLE: 422,
  REPLACE_REFUSED: 422,
};

/** The engine's only error type. `errorCode` mirrors `code` so trackToolError reports it as error_code. */
export class EditPdfError extends Error {
  readonly code: EditPdfErrorCode;
  readonly errorCode: EditPdfErrorCode;
  /** Set only for declined input (see DECLINED_STATUS); absent means the tool failed. */
  readonly status?: number;
  readonly objectIds: readonly ObjectId[];
  readonly pageNumbers: readonly number[];
  constructor(code: EditPdfErrorCode, message?: string, details: EditPdfErrorDetails = {}) {
    super(message ?? code);
    this.name = 'EditPdfError';
    this.code = code;
    this.errorCode = code;
    this.status = DECLINED_STATUS[code];
    this.objectIds = details.objectIds ?? [];
    this.pageNumbers = details.pageNumbers ?? [];
  }
}

export function isEditPdfError(error: unknown, code?: EditPdfErrorCode): error is EditPdfError {
  return error instanceof EditPdfError && (code === undefined || error.code === code);
}

// ── Text preview ────────────────────────────────────────────────────────────

/** One laid-out line, for the on-screen preview. Positions in points from the box's top-left. */
export interface TextPreviewLine {
  /** Logical text of the line; render it with white-space: pre and dir={direction}. */
  text: string;
  /** Its paragraph's direction. */
  direction: Direction;
  /** Left edge of the line inside the box (start alignment already applied). */
  x: number;
  width: number;
}

export interface TextBoxLayout {
  lines: TextPreviewLine[];
  /** Baseline-to-baseline distance in points (size * DEFAULT_LINE_HEIGHT). */
  lineHeight: number;
  /** Total height in points (lines.length * lineHeight); hPct = height / visual page height. */
  height: number;
  /** Characters Cairo cannot draw. Not empty: show the editPdf.textAsImage note; export saves the box as a picture. */
  missing: string[];
}

export interface TextLayoutRequest {
  /** Points. */
  size: number;
  /** Wrap width in points (box.wPct * visual page width). */
  width: number;
  fallbackDirection: Direction;
}

/**
 * The same layout the PDF writer uses, for the preview. Loaded lazily
 * (fontkit + bidi-js + Cairo), once per session.
 */
export interface TextEngine {
  /** The Cairo TTF the PDF embeds. Register it: new FontFace(EDITOR_FONT_FAMILY, fontBytes, overrides). */
  fontBytes: Uint8Array;
  /**
   * Font metrics as fractions of the em, for the FontFace descriptors
   * ascentOverride / descentOverride (with lineGapOverride '0%'), so the
   * browser puts each baseline where the PDF does.
   */
  ascent: number;
  descent: number;
  layout(text: string, request: TextLayoutRequest): TextBoxLayout;
}

// ── Insert PDF (workspace: merge) ───────────────────────────────────────────

export interface AppendResult {
  /** The working source with the new pages appended (existing page indexes and object numbers unchanged). */
  bytes: Uint8Array;
  /** Per added file, in order: how many pages it added. */
  added: { name: string; pages: number }[];
  /** Files left out. */
  skipped: { name: string; reason: 'ENCRYPTED' | 'UNREADABLE' }[];
}
/** Largest working source the workspace builds by inserting (100 MB, the cap the old server merge had). */
export const WORKSPACE_MAX_BYTES = 100 * 1024 * 1024;
export const MAX_MERGE_FILES = 20;

// ── Page <-> workspace ──────────────────────────────────────────────────────

/**
 * Props of components/edit-pdf/EditorWorkspace, mounted by
 * components/workspace/ToolWorkspace through next/dynamic (ssr: false).
 * Analytics stays outside components/edit-pdf: saves and fixes arrive as props.
 */
export interface EditorWorkspaceProps {
  /** files[0] opens; files[1..] are inserted at the end once it is open (merge). Type and size already checked. */
  files: readonly File[];
  mode: WorkspaceMode;
  /** On top of the mode's preset (ToolWorkspace's planPreset). */
  planPreset?: Partial<SavePlan>;
  /**
   * On top of the default watermark the watermark mode opens with (ToolWorkspace's watermarkPreset).
   * A later `text` replaces the watermark's text while it still reads the previous one.
   */
  watermarkPreset?: Partial<WatermarkStamp>;
  /** One save; rejects with EditPdfError, ApiError (status, errorCode) or anything else on a real failure. */
  runSave: (input: SaveInput) => Promise<SaveOutput>;
  /** Server fixes for the working source (unlock, repair, OCR), tracked by the shell. */
  fixes: SourceFixes;
  /**
   * A finished save: the shell opens FileDeliveryModal. `nextPerson` is set
   * when the saved doc is a filled-in form: it clears the typed boxes for
   * someone else (EditorWorkspace's startNextPerson).
   */
  onSaved: (output: SaveOutput, nextPerson?: () => void) => void;
  /** "Choose another PDF": the shell unmounts the workspace and shows its dropzone again. */
  onClose: () => void;
  /** The editor as it was before a language switch (lib/workspace/carry-over): it opens on this instead. */
  resume?: { workingFile: File; state: EditorState } | null;
}
