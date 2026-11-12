/**
 * The workspace (every tool page opens the PDF editor): the contracts between
 * the tool pages (components/workspace/ToolWorkspace), the editor
 * (components/edit-pdf) and the save pipeline (lib/workspace/save.ts).
 * Spec: workspace-spec.md. Types and constants only: no runtime imports.
 */
import type { ExportRequest, ExportWarning, ObjectKind } from '@/lib/edit-pdf/types';
import type { PdfaCheck, PdfaLevel } from '@/lib/pdfa';

export type WorkspaceMode =
  | 'edit' | 'sign' | 'crop' | 'rotate' | 'delete' | 'reorder' | 'extract' | 'split' | 'merge'
  | 'watermark' | 'numbers' | 'compress' | 'protect' | 'unlock' | 'repair' | 'ocr'
  | 'flatten' | 'metadata' | 'word' | 'excel' | 'images' | 'text' | 'imagesInside' | 'pdfa' | 'converted';

/** pdfa: a PDF/A made and checked on the server (/pdf-to-pdfa); like the converters, nothing runs after it. */
export type SaveFormat = 'pdf' | 'word' | 'excel' | 'images' | 'text' | 'imagesInside' | 'pdfa';
/** = lib/api-client CompressionLevel: high = /prepress, medium = /ebook, low = /screen. */
export type CompressLevel = 'high' | 'medium' | 'low';
export type SaveSplit = { kind: 'none' } | { kind: 'every'; n: number } | { kind: 'runs' };

export interface SavePlan {
  format: SaveFormat;
  /** format 'images'. */
  imageType: 'jpg' | 'png';
  /** format 'text'. */
  pageSeparators: boolean;
  /** format 'pdfa'. */
  pdfaLevel: PdfaLevel;
  /** PDF only. */
  compress: CompressLevel | null;
  /**
   * PDF only, with compress on: get it under this many MB instead of using
   * the level (NaN while the field holds no number). 1 MB = 1,000,000 bytes,
   * the smaller reading, so the file passes forms that count either way.
   */
  compressLimitMb: number | null;
  /** PDF only, 1..128 characters (protect-pdf route limits). */
  password: string | null;
  /** PDF only. */
  removeMetadata: boolean;
  /** Any format. */
  flatten: boolean;
  pages: 'all' | 'selected';
  /** PDF only; 'runs' needs pages 'all' and a selection. */
  split: SaveSplit;
  /** PDF only; pages 'all' and split none. */
  alsoSelected: boolean;
}

export const DEFAULT_SAVE_PLAN: SavePlan = {
  format: 'pdf',
  imageType: 'jpg',
  pageSeparators: true,
  pdfaLevel: '2b',
  compress: null,
  compressLimitMb: null,
  password: null,
  removeMetadata: false,
  flatten: false,
  pages: 'all',
  split: { kind: 'none' },
  alsoSelected: false,
};

/** Server routes take up to this much (compress/protect/unlock/ocr check 50 MB; word/images/repair don't, so we check for them). */
export const MAX_SERVER_BYTES = 50 * 1024 * 1024;
/** pdf-to-word refuses more pages (lib/pdf-to-word-limits.ts). */
export const MAX_WORD_PAGES = 500;
/** pdf-to-images refuses more pages (app/api/pdf-to-images/route.ts). */
export const MAX_IMAGE_PAGES = 100;

export type SaveStep = 'export' | 'convert' | 'compress' | 'cut' | 'metadata' | 'protect' | 'zip';

export interface SaveInput {
  mode: WorkspaceMode;
  /** The working source (what pdf.js shows). */
  source: File;
  /** null = nothing to apply: the source is saved/converted as it is (no pdf-lib rewrite, forms stay live). */
  request: ExportRequest | null;
  plan: SavePlan;
  /** 0-based positions, in saved-page order, of the selected pages (positions in request.pages, or in the source when request is null). */
  selected: readonly number[];
  /** Page count of what step 1 produces (request.pages.length, or the source's page count when request is null). */
  pageCount: number;
  /** Visitor's file name without .pdf (case-insensitive). */
  baseName: string;
  /** summarizeDoc(doc, basePageCount), for analytics. */
  summary: DocSummary;
  onStep?: (step: SaveStep) => void;
}

export interface SaveOutput {
  /** The one thing delivered: a PDF, .docx, .xlsx, .txt, .png or a .zip. */
  blob: Blob;
  filename: string;
  /** Files inside (1 unless zipped). */
  files: number;
  warnings: ExportWarning[];
  removedLines: number;
  /** compress: 0 when the server returned the original (already optimized). */
  reductionPercent?: number;
  /** compress with compressLimitMb: whether the file got under it, and its size. */
  sizeLimit?: { mb: number; met: boolean; bytes: number; untouched: boolean };
  /** pdf-to-word answered with X-Conversion-Method: libreoffice. */
  compatibility?: true;
  /** imagesInside: the scan stopped at a limit (pages read, or pictures found). */
  imageLimit?: { pages?: number; images?: number };
  /** pdfa: veraPDF's verdict on the file. */
  pdfa?: PdfaCheck;
}

export type OcrLanguage = 'ara' | 'eng' | 'fra' | 'spa';

export interface SourceFixes {
  /** password null = remove restrictions (owner password only). Rejects ApiError status 400 errorCode UNLOCK_REJECTED on a wrong password. */
  unlock(file: File, password: string | null): Promise<File>;
  repair(file: File): Promise<File>;
  ocr(file: File, languages: readonly OcrLanguage[], redo: boolean): Promise<File>;
}

export interface DocSummary {
  /** Opened pages (source index < basePageCount) not in doc.pages. */
  deletedPages: number;
  turnedPages: number;
  /** Kept opened pages not in ascending source order. */
  moved: boolean;
  blankPages: number;
  /** Source index >= basePageCount (Insert PDF / merge). */
  insertedPages: number;
  croppedPages: number;
  watermark: boolean;
  pageNumbers: boolean;
  letterhead: boolean;
  objects: Record<Exclude<ObjectKind, 'replace'>, number>;
  /** Image objects with signature: true (also counted in objects.image). */
  signatures: number;
  /** Replace objects. */
  changedLines: number;
}

export type PrimaryAction = 'save' | 'saveDialog' | 'deleteSelectedThenSave' | 'ocr' | 'repair';
export type ModeNeed =
  | 'change' | 'objects' | 'crop' | 'turn' | 'order' | 'selection' | 'secondFile' | 'watermark' | 'pageNumbers' | null;

export interface ModeConfig {
  /** Tool page slug, e.g. 'crop-pdf'. */
  slug: string;
  view: 'page' | 'grid';
  tool?: 'select' | 'crop';
  panel?: 'watermark' | 'numbers' | 'signature' | 'ocr';
  preset: Partial<SavePlan>;
  primary: { labelKey: string; action: PrimaryAction; needs: ModeNeed };
  /** merge: the dropzone takes up to MAX_MERGE_FILES. */
  multiple?: true;
  /** Output `${base}_${suffix}.<ext>`; '' keeps the name. */
  suffix: string;
}
