'use client';

/**
 * The PDF workspace every tool page opens (workspace-spec.md): toolbar, page
 * canvas with the object overlay, page thumbnails and page tools.
 * components/workspace/ToolWorkspace loads it with
 *   dynamic(() => import('@/components/edit-pdf/EditorWorkspace'), { ssr: false })
 * and renders it only once a PDF has been chosen, so none of this (or pdf.js,
 * pdf-lib, fontkit) is in the page's first load. The page's `mode`
 * (lib/workspace/modes.ts) picks the view, tool or panel it opens with and
 * the one primary button.
 *
 * What it says before any click: TaskHeader (the file, what this page does
 * with it and where that runs, All tools, Choose another PDF), ModeTaskCard
 * under the toolbar (the page's own choices and "You'll get ...", from
 * describeSave) and the primary button's words for what the save gives.
 * AllToolsPanel lists every feature once and runs the editor's own action
 * for it (runTool); "Get a different file" opens the Save dialog with that
 * choice made.
 *
 * Delivery and run tracking stay in the shell: this component only counts
 * its own clicks (trackEvent: tool_pick, all_tools_open, save_open,
 * save_plan, choose_another). Saves go through the shell's `runSave` (the pipeline in
 * lib/workspace/save.ts, which tracks each operation) and come back through
 * `onSaved`; unlock, repair and OCR through `fixes`. The only uploads
 * tracked here are an inserted picture, a watermark image and inserted
 * PDFs, through useTrackedDropzone.
 *
 * The working source (useWorkingSource) is what pdf.js shows and what every
 * save, line check and font analysis reads. A fix or Insert PDF swaps it in
 * place: the Editor is not rebuilt, so the doc and its history stay, and
 * everything that reads the file reads `sourceRef.current`, never a copy
 * captured when the editor opened.
 *
 * Edit text (beta, phase-c-spec.md section 7): picking the tool loads the
 * removal engine (loadTextReplacer: PDFium wasm, fetched only now) and finds
 * the lines of the current page with the editor's own pdf.js page
 * (detectTextLines, cached per page of the file). A tap on a line runs
 * checkLineRemoval before its box opens, so a page that can't be rewritten
 * cleanly is said up front. What the save reports about removed lines comes
 * only from the export's verified count.
 *
 * Keep the font (keep-font-spec.md): the same tap runs the line's font
 * analysis (analyzeLineFont) alongside that check, and the box opens with it
 * and autoSize, so the new words are drawn in the line's own font when it can
 * draw them, at its size. Changed lines show the engine's render of exactly
 * what the save writes (previewReplacement, through ReplacePreviewStore).
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale, useTranslations } from 'next-intl';
import { useInView } from 'react-intersection-observer';
import { AlertTriangle, ChevronLeft, ChevronRight, LayoutGrid, Loader2, Redo2, Undo2, X } from 'lucide-react';
import { useTrackedDropzone } from '@/hooks/useTrackedDropzone';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { formatGregorianDate, todayHijri } from '@/lib/hijri';
import { DEFAULT_LINE_HEIGHT } from '@/lib/pdf-text/constants';
import {
  EDITOR_FALLBACK_FAMILY,
  EDITOR_FONT_FAMILY,
  MAX_IMAGE_BYTES,
  MAX_MERGE_FILES,
  MAX_PDF_BYTES,
  WORKSPACE_MAX_BYTES,
  analyzeLineFont,
  appendPdfs,
  checkLineRemoval,
  detectTextLines,
  isEditPdfError,
  isTextReplaceSupported,
  lineBlock,
  lineBoxAt,
  loadTextEngine,
  loadTextReplacer,
  pageVisualSize,
  letterheadHasContent,
  letterheadRoom,
  textExtentOf,
  prepareImage,
  previewReplacement,
  releaseReplacePreviews,
  releaseTextReplacer,
  type AssetId,
  type DetectedTextPage,
  type Direction,
  type EditorDoc,
  type EditorObject,
  type EditorPage,
  type EditorWorkspaceProps,
  type ExportRequest,
  type ExportWarning,
  type ImageAsset,
  type LetterheadStamp,
  type TextExtent,
  type LineFont,
  type ObjectId,
  type PageId,
  type PagePoint,
  type PageSize,
  type PreparedImage,
  type ReplaceObject,
  type SourceTextLine,
  type TextBoxLayout,
  type TextEngine,
  type TextObject,
  type VisualBox,
  type WatermarkStamp,
} from '@/lib/edit-pdf';
import {
  editorReducer,
  hasChanges,
  newReplaceObject,
  pageHasReplace,
  planNextPerson,
  replaceCommitAction,
  replaceForLine,
  type EditorAction,
  type EditorTool,
} from './state';
import { ReplacePreviewStore } from './replace-preview';
import { MIN_TEXT_WIDTH_PT, boxAround, canZoom, cssPageSize, imageBoxFor, stepZoom, translateObject, visibleCenter } from './interaction';
import { useWorkingSource, type ReplaceOptions, type WorkingSource } from './useWorkingSource';
import {
  cropTooSmallOn,
  fixBeforeSave,
  fixRefusal,
  gridHint,
  labelsFromSave,
  openingState,
  planUsesSelection,
  showsScanBanner,
  taskCard,
  toolPlanPatch,
  type AllToolId,
  type SourceFix,
} from './workspace-rules';
import { PageCanvas } from './PageCanvas';
import { ObjectLayer, type LinePick, type ReplaceEditingState, type TextEditingState } from './ObjectLayer';
import { PageStrip, ThumbnailRenderer } from './PageStrip';
import { ActionButton, PageActions } from './PageActions';
import { PrimaryButton, Toolbar, type InsertKind, type PrimaryButtonProps } from './Toolbar';
import { SaveDialog, usePlanProblemText } from './SaveDialog';
import { TaskHeader } from './TaskHeader';
import { AllToolsPanel, allToolsPlace, type AllToolsPlace } from './AllToolsPanel';
import { ModeTaskCard } from './ModeTaskCard';
import { FixFirstPrompt, FixNotice, FixPanel, OcrBanner, defaultOcrLanguages, useFixErrorText, type FixKind } from './FixPanel';
import { PageRangeField, SelectionBar } from './SelectionBar';
import { CropLayer, CropPanel, type CropTarget } from './CropLayer';
import { EMPTY_LETTERHEAD, StampPanel, useDefaultStamps } from './StampPanel';
import { LETTERHEAD_FILE_NAME, letterheadFileText, loadLetterhead, parseLetterheadFile, smallLogo, storeLetterhead, type SavedLetterhead } from '@/lib/letterhead-store';
import { downloadBlob } from '@/lib/utils';
import { StampPreview, previewLetterhead } from './StampPreview';
import { SignatureDialog } from './SignatureDialog';
import { MODES } from '@/lib/workspace/modes';
import { DEFAULT_SAVE_PLAN, type OcrLanguage, type SaveInput, type SavePlan, type SaveStep } from '@/lib/workspace/types';
import { SaveError, describeSave, planProblems, saveButtonLabelKey, summarizeDoc, type SaveContext } from '@/lib/workspace/summary';
import { baseName } from '@/lib/workspace/names';
import { savePlanParams } from '@/lib/workspace/track';
import { trackEvent } from '@/lib/analytics';
import { registerEditor } from '@/lib/workspace/carry-over';
import { OCR_MAX_PAGES } from '@/lib/ocr-limits';

export type { EditorWorkspaceProps };

// ── Text engine (lazy: fontkit, bidi-js and Cairo load after the PDF opens) ──

let editorFontPromise: Promise<boolean> | null = null;

/** Register the engine's Cairo bytes as EDITOR_FONT_FAMILY once per session, with the engine's metrics. */
function registerEditorFont(engine: TextEngine): Promise<boolean> {
  if (!editorFontPromise) {
    editorFontPromise = (async () => {
      try {
        const face = new FontFace(EDITOR_FONT_FAMILY, new Uint8Array(engine.fontBytes), {
          ascentOverride: `${engine.ascent * 100}%`,
          descentOverride: `${engine.descent * 100}%`,
          lineGapOverride: '0%',
        });
        await face.load();
        document.fonts.add(face);
        return true;
      } catch (error) {
        console.warn('edit-pdf: could not register the editor font', error);
        editorFontPromise = null;
        return false;
      }
    })();
  }
  return editorFontPromise;
}

let fallbackFontPromise: Promise<boolean> | null = null;

/** Register the engine's Liberation Sans as EDITOR_FALLBACK_FAMILY once per session, with Cairo's metrics so line boxes don't move. */
function registerFallbackFont(engine: TextEngine): Promise<boolean> {
  if (!engine.fallbackBytes) return Promise.resolve(false);
  if (!fallbackFontPromise) {
    const bytes = engine.fallbackBytes;
    fallbackFontPromise = (async () => {
      try {
        const face = new FontFace(EDITOR_FALLBACK_FAMILY, new Uint8Array(bytes), {
          ascentOverride: `${engine.ascent * 100}%`,
          descentOverride: `${engine.descent * 100}%`,
          lineGapOverride: '0%',
        });
        await face.load();
        document.fonts.add(face);
        return true;
      } catch (error) {
        console.warn('edit-pdf: could not register the fallback font', error);
        fallbackFontPromise = null;
        return false;
      }
    })();
  }
  return fallbackFontPromise;
}

/**
 * The text engine, Cairo only at first. `needFallback` (a box has letters Cairo lacks: Hebrew,
 * Cyrillic, Greek) fetches Liberation Sans once and swaps in the engine that lays out with it.
 * It may be called while rendering: state changes only when the fetch settles.
 */
function useTextEngine(): { engine: TextEngine | null; fontReady: boolean; needFallback: () => void; fallbackFailed: boolean } {
  const [state, setState] = useState<{ engine: TextEngine | null; fontReady: boolean }>({ engine: null, fontReady: false });
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const fallbackStarted = useRef(false);
  useEffect(() => {
    let live = true;
    loadTextEngine()
      .then(async (engine) => {
        const fontReady = await registerEditorFont(engine);
        if (live) setState((current) => (current.engine?.fallbackBytes ? current : { engine, fontReady }));
      })
      .catch((error) => console.warn('edit-pdf: text engine unavailable', error));
    return () => {
      live = false;
    };
  }, []);
  const needFallback = useCallback(() => {
    if (fallbackStarted.current) return;
    fallbackStarted.current = true;
    loadTextEngine({ fallback: true })
      .then(async (engine) => {
        const fontReady = await registerEditorFont(engine);
        await registerFallbackFont(engine); // without it the preview draws those letters in a system font; layout and save are unaffected
        setState({ engine, fontReady });
      })
      .catch((error) => {
        console.warn('edit-pdf: fallback font unavailable', error);
        setFallbackFailed(true);
      });
  }, []);
  return { ...state, needFallback, fallbackFailed };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',');
  const type = /data:([^;,]+)/.exec(head)?.[1] ?? 'image/png';
  if (!/;base64/.test(head)) return new Blob([decodeURIComponent(body)], { type });
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** Edit text's removal engine, outside undo history. */
type ReplaceEngineState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'unsupported';

/** What the status line says after a save failed. */
type SaveFailure =
  | { kind: 'save' | 'image' | 'replaceFailed' | 'replaceUnavailable' }
  | { kind: 'replaceRefused'; page: number }
  | { kind: 'server'; code: SaveError['code'] };

const NO_IDS: ReadonlySet<ObjectId> = new Set();
/** Status messages that end with "Use Cover and Text instead." get longer on screen. */
const LONG_NOTICE_MS = 6000;

const IMAGE_ACCEPT = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

/**
 * A message whose key is data: ModeConfig.primary.labelKey (lib/workspace/modes.ts)
 * or saveButtonLabelKey's (lib/workspace/summary.ts). They are the keys here
 * that can't be literals, so the literal-key scan can't check them;
 * tests/workspace-ui-state.test.ts checks every mode's key, and
 * SAVE_LABEL_KEYS is checked in both locales, instead.
 */
function messageByKey(translate: ReturnType<typeof useTranslations>, key: string, values: Record<string, number>): string {
  return (translate as unknown as (key: string, values: Record<string, number>) => string)(key, values);
}

// ── The workspace ────────────────────────────────────────────────────────

export function EditorWorkspace(props: EditorWorkspaceProps) {
  const t = useTranslations('editPdf');
  const { state: working, replace } = useWorkingSource(props.resume?.workingFile ?? props.files[0]);
  /** The fix the file needed before it could open (the Editor delivers it at once on /unlock-pdf and /repair-pdf). */
  const [fixedBy, setFixedBy] = useState<'unlock' | 'repair' | null>(null);

  if (working.status === 'loading') {
    return (
      <div data-edit-pdf-workspace="" className="flex min-h-[60vh] flex-col items-center justify-center gap-3 rounded-2xl bg-white p-8 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-[#FF6B35]" aria-hidden="true" />
        <p className="text-gray-600" role="status">
          {t('opening')}
        </p>
      </div>
    );
  }

  /** Run a fix on `file` and open its result in its place (a result that still can't open shows its own state). */
  const fixThenOpen = async (kind: 'unlock' | 'repair', fix: () => Promise<File>) => {
    const fixed = await fix();
    setFixedBy(kind);
    try {
      await replace(fixed);
    } catch (error) {
      setFixedBy(null);
      throw error;
    }
  };

  // A file pdf.js opened that still needs a fix opens in the editor (it asks when a step needs the fix),
  // except on the page whose job is that fix: there the fix comes first, and its result is delivered.
  const pageFix =
    working.status === 'ready' &&
    ((props.mode === 'unlock' && working.source.needsFix === 'unlock') || (props.mode === 'repair' && working.source.needsFix === 'repair'))
      ? working.source.needsFix
      : null;
  /** The file a fix panel works on. */
  const file = working.status === 'ready' ? working.source.file : working.file;

  if (working.status === 'locked' || pageFix === 'unlock') {
    const needsPassword = working.status === 'locked' && working.needsPassword;
    return (
      <FixPanel
        key={`${needsPassword}`}
        variant={needsPassword ? 'locked' : 'restricted'}
        onFix={(password) => fixThenOpen('unlock', () => props.fixes.unlock(file, password))}
        onClose={props.onClose}
      />
    );
  }

  if (working.status === 'unreadable' || pageFix === 'repair') {
    return <FixPanel variant="broken" onFix={() => fixThenOpen('repair', () => props.fixes.repair(file))} onClose={props.onClose} />;
  }

  const { source, scanned } = working;
  return <Editor {...props} source={source} scanned={scanned} fixedBy={fixedBy} replaceSource={replace} />;
}

export default EditorWorkspace;

interface EditorProps extends EditorWorkspaceProps {
  /** The working source as it is now; it changes in place (fixes, Insert PDF) without the Editor being rebuilt. */
  source: WorkingSource;
  /** The first pages have no text (useWorkingSource): offer OCR. */
  scanned: boolean;
  /** The fix the file needed before it opened, if any. */
  fixedBy: 'unlock' | 'repair' | null;
  /** Open another file as the working source (useWorkingSource.replace). */
  replaceSource: (next: File, options?: ReplaceOptions) => Promise<WorkingSource>;
}

/** What a fix asked for first (FixFirstPrompt) carries on with once the fixed file is the working source. */
type AfterFix =
  | { then: 'save'; plan: SavePlan; pre?: EditorAction }
  | { then: 'insert'; files: readonly File[]; afterPageId: PageId | null }
  | { then: 'replaceTool' }
  | { then: 'ocr' };

function Editor({ source, scanned, fixedBy, files, mode, planPreset, watermarkPreset, runSave, fixes, onSaved, onClose, replaceSource, resume }: EditorProps) {
  const t = useTranslations('editPdf');
  const tCommon = useTranslations('common');
  const tWorkspace = useTranslations('workspace');
  const tAll = useTranslations();
  const tErrors = useTranslations('errors');
  const fixErrorText = useFixErrorText();
  const problemText = usePlanProblemText();
  const locale = useLocale();
  const rtl = locale === 'ar';
  const fallbackDirection: Direction = rtl ? 'rtl' : 'ltr';
  const modeConfig = MODES[mode];
  const { pdf } = source;

  const defaultStamps = useDefaultStamps();
  // The watermark and page numbers pages open with their default stamp, as the first undoable change;
  // rotate-pdf with every page ticked (openingState).
  // After a language switch: the doc, history and view as they were (same file, so the same pages)
  const [state, dispatch] = useReducer(editorReducer, null, () =>
    resume && resume.state.sourcePages.length === source.sourcePages.length
      ? resume.state
      : openingState(
      mode,
      source.sourcePages,
      modeConfig.panel === 'watermark'
        ? { watermark: { ...defaultStamps.watermark(), ...watermarkPreset } }
        : modeConfig.panel === 'numbers'
          ? { pageNumbers: defaultStamps.pageNumbers() }
          : undefined,
    ),
  );
  const stateRef = useRef(state);
  /** The working source for event handlers and engine closures: never a file captured when the editor opened. */
  const sourceRef = useRef(source);
  useLayoutEffect(() => {
    stateRef.current = state;
    sourceRef.current = source;
  });
  useEffect(() => registerEditor(() => ({ workingFile: sourceRef.current.file, state: stateRef.current })), []);
  const { doc, tool, zoom, selectedId, currentPageId, style, sourcePages } = state;

  // /watermark-pdf/id-copy: the answers above the editor can still change after the file opens.
  // The watermark follows them for as long as it says what they last wrote.
  const presetText = watermarkPreset?.text;
  const followedText = useRef(presetText);
  useEffect(() => {
    const from = followedText.current;
    followedText.current = presetText;
    if (from !== undefined && presetText !== undefined && from !== presetText) {
      dispatch({ type: 'retextPresetWatermark', from, to: presetText });
    }
  }, [presetText]);

  const idSeq = useRef(0);
  const newId = useCallback((prefix: 'o' | 'a') => `${prefix}${++idSeq.current}`, []);
  const newObjectId = useCallback(() => newId('o'), [newId]);

  const sizeOfPage = useCallback(
    (d: EditorDoc, pageId: PageId): PageSize => {
      const page = d.pages.find((p) => p.id === pageId) ?? d.pages[0];
      return pageVisualSize(page, sourcePages);
    },
    [sourcePages],
  );

  // ── Text layout ──
  const { engine, fontReady, needFallback, fallbackFailed } = useTextEngine();
  const layoutCache = useRef(new Map<string, TextBoxLayout>());
  const layoutText = useCallback(
    (text: string, size: number, width: number, fallback: Direction = fallbackDirection): TextBoxLayout | null => {
      if (!engine) return null;
      const key = `${engine.fallbackBytes ? 'f' : 'c'}|${size}|${Math.round(width * 100)}|${fallback}|${text}`;
      let layout = layoutCache.current.get(key);
      if (!layout) {
        try {
          layout = engine.layout(text, { size, width, fallbackDirection: fallback });
        } catch (error) {
          console.warn('edit-pdf: text layout failed', error);
          return null;
        }
        if (layoutCache.current.size > 400) layoutCache.current.clear();
        layoutCache.current.set(key, layout);
      }
      // Letters Cairo lacks: fetch the fallback (the next engine lays them out); no picture note unless that fails.
      if (layout.missing.length > 0 && !engine.fallbackBytes && !fallbackFailed) {
        needFallback();
        return { ...layout, missing: [] };
      }
      return layout;
    },
    [engine, fallbackDirection, needFallback, fallbackFailed],
  );

  /** box.hPct of a text object on a page of this size (points). */
  const textHeightOn = useCallback(
    (page: PageSize, object: TextObject): number => {
      const layout = layoutText(object.text || ' ', object.size, object.box.wPct * page.width);
      const line = object.size * DEFAULT_LINE_HEIGHT;
      const height = layout
        ? Math.max(layout.height, layout.lineHeight)
        : Math.max(1, object.text.split('\n').length) * line;
      return height / page.height;
    },
    [layoutText],
  );
  const textHeightIn = useCallback(
    (d: EditorDoc, object: TextObject) => textHeightOn(sizeOfPage(d, object.pageId), object),
    [sizeOfPage, textHeightOn],
  );
  /** For event handlers: the doc as of the last render. */
  const withTextHeight = useCallback(
    <T extends EditorObject>(object: T): T =>
      object.kind === 'text' ? { ...object, box: { ...object.box, hPct: textHeightIn(stateRef.current.doc, object) } } : object,
    [textHeightIn],
  );

  // Text heights are derived from the layout: refresh them once the engine is in, and after undo/redo.
  useEffect(() => {
    if (!engine) return;
    const heights: Record<ObjectId, number> = {};
    for (const object of doc.objects) {
      if (object.kind !== 'text') continue;
      const h = textHeightIn(doc, object);
      if (Math.abs(h - object.box.hPct) > 1e-6) heights[object.id] = h;
    }
    if (Object.keys(heights).length > 0) dispatch({ type: 'syncTextHeights', heights });
  }, [engine, doc, textHeightIn]);

  // ── Pictures ──
  const assetsRef = useRef<Record<AssetId, ImageAsset>>({});
  const [assetUrls, setAssetUrls] = useState<Record<AssetId, string>>({});
  /** Pixel sizes, for the image watermark's preview (the assets themselves stay in assetsRef). */
  const [assetSizes, setAssetSizes] = useState<Record<AssetId, { width: number; height: number }>>({});
  const assetUrlsRef = useRef(assetUrls);
  useEffect(
    () => () => {
      Object.values(assetUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );
  const addAsset = useCallback(
    (prepared: PreparedImage): ImageAsset => {
      const asset: ImageAsset = { ...prepared, id: newId('a') };
      assetsRef.current = { ...assetsRef.current, [asset.id]: asset };
      const url = URL.createObjectURL(
        new Blob([prepared.bytes as unknown as BlobPart], { type: prepared.format === 'jpg' ? 'image/jpeg' : 'image/png' }),
      );
      assetUrlsRef.current = { ...assetUrlsRef.current, [asset.id]: url };
      setAssetUrls(assetUrlsRef.current);
      setAssetSizes((sizes) => ({ ...sizes, [asset.id]: { width: asset.width, height: asset.height } }));
      return asset;
    },
    [newId],
  );

  // ── Status line ──
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<number | undefined>(undefined);
  const block = useCallback((reason: string, ms = 3000) => {
    if (!reason) return;
    setNotice(reason);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), ms);
  }, []);
  useEffect(() => () => window.clearTimeout(noticeTimer.current), []);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const setError = useCallback((kind: 'save' | 'image' | null) => setFailure(kind ? { kind } : null), []);
  /** Changed lines the last save refused (red outline), until the doc changes. */
  const [refused, setRefused] = useState<{ doc: EditorDoc; ids: ReadonlySet<ObjectId> } | null>(null);
  /** The verified count of removed lines from the last save, until the doc changes. */
  const [removed, setRemoved] = useState<{ doc: EditorDoc; count: number } | null>(null);
  const [warnings, setWarnings] = useState<{ doc: EditorDoc; list: ExportWarning[] } | null>(null);
  const [exportedDoc, setExportedDoc] = useState<EditorDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // ── Text editing (a draft lives here until its first blur with text) ──
  const [editing, setEditing] = useState<{ object: TextObject; draft: boolean } | null>(null);
  const [editValue, setEditValue] = useState('');
  const editingRef = useRef<{ object: TextObject; draft: boolean } | null>(null);
  const editValueRef = useRef('');

  const beginEditing = useCallback((object: TextObject, draft: boolean) => {
    editingRef.current = { object, draft };
    editValueRef.current = object.text;
    setEditing(editingRef.current);
    setEditValue(object.text);
  }, []);

  const changeEditValue = useCallback((value: string) => {
    editValueRef.current = value;
    setEditValue(value);
  }, []);

  /** Finish typing: add the draft, or replace / delete the edited box. Returns what it dispatched. */
  const commitEditing = useCallback((): EditorAction | null => {
    const current = editingRef.current;
    if (!current) return null;
    editingRef.current = null;
    setEditing(null);
    const text = editValueRef.current.replace(/\s+$/u, '');
    let action: EditorAction | null = null;
    if (current.draft) {
      if (text.trim()) action = { type: 'addObject', object: withTextHeight({ ...current.object, text }) };
    } else {
      const object = stateRef.current.doc.objects.find((o) => o.id === current.object.id);
      if (object?.kind === 'text') {
        // Clearing a box deletes it; a box left empty for the next person keeps its place
        if (!text.trim()) action = object.text.trim() ? { type: 'deleteObject', id: object.id } : null;
        else if (text !== object.text) action = { type: 'replaceObject', object: withTextHeight({ ...object, text }) };
      }
    }
    if (action) dispatch(action);
    return action;
  }, [withTextHeight]);

  // ── Edit text: the changed line being typed (a draft lives here until Enter or blur) ──
  const [replaceEditing, setReplaceEditing] = useState<{ object: ReplaceObject; draft: boolean } | null>(null);
  const [replaceValue, setReplaceValue] = useState('');
  const replaceEditingRef = useRef<{ object: ReplaceObject; draft: boolean } | null>(null);
  const replaceValueRef = useRef('');

  const beginReplace = useCallback((object: ReplaceObject, draft: boolean) => {
    replaceEditingRef.current = { object, draft };
    replaceValueRef.current = object.text;
    setReplaceEditing(replaceEditingRef.current);
    setReplaceValue(object.text);
  }, []);

  const changeReplaceValue = useCallback((value: string) => {
    replaceValueRef.current = value;
    setReplaceValue(value);
  }, []);

  /** Finish typing a line (what that does: replaceCommitAction). Returns what it dispatched. */
  const commitReplace = useCallback((viaEnter = false): EditorAction | null => {
    const current = replaceEditingRef.current;
    if (!current) return null;
    replaceEditingRef.current = null;
    setReplaceEditing(null);
    const action = replaceCommitAction(stateRef.current.doc, current, replaceValueRef.current, viaEnter);
    if (action) dispatch(action);
    return action;
  }, []);

  const cancelReplace = useCallback(() => {
    replaceEditingRef.current = null;
    setReplaceEditing(null);
  }, []);

  // ── Arrow-key nudge: one history entry when the key is released ──
  const [nudge, setNudge] = useState<EditorObject | null>(null);
  const nudgeRef = useRef<EditorObject | null>(null);
  const commitNudge = useCallback((): EditorAction | null => {
    const moved = nudgeRef.current;
    if (!moved) return null;
    nudgeRef.current = null;
    setNudge(null);
    const action: EditorAction = { type: 'replaceObject', object: moved };
    dispatch(action);
    return action;
  }, []);

  /** Everything that ends pending input before another action. */
  const settle = useCallback(() => {
    commitNudge();
    commitEditing();
    commitReplace();
  }, [commitEditing, commitNudge, commitReplace]);

  // ── Edit text: the removal engine and the lines of each page ──
  const [replaceEngine, setReplaceEngine] = useState<ReplaceEngineState>(() =>
    isTextReplaceSupported() ? 'idle' : 'unsupported',
  );
  const replacerPromise = useRef<Promise<boolean> | null>(null);
  /** Load PDFium once; false when it couldn't load (the tool then shows disabled.replace). */
  const ensureReplacer = useCallback((): Promise<boolean> => {
    if (!replacerPromise.current) {
      setReplaceEngine('loading');
      replacerPromise.current = loadTextReplacer().then(
        () => {
          setReplaceEngine('ready');
          return true;
        },
        (err: unknown) => {
          console.warn('edit-pdf: Edit text could not load', err);
          replacerPromise.current = null;
          setReplaceEngine('unavailable');
          return false;
        },
      );
    }
    return replacerPromise.current;
  }, []);
  // PDFium's copy of the file and its documents go when the editor does (another file, or leaving).
  useEffect(
    () => () => {
      void releaseTextReplacer().catch(() => undefined);
    },
    [],
  );
  /** The engine's renders of changed lines, kept across pages (keep-font-spec.md section 8). */
  const [previews] = useState(
    () => new ReplacePreviewStore((object, text, request) => previewReplacement(sourceRef.current.file, object, text, request)),
  );
  useEffect(() => () => previews.reset(), [previews]);
  // A changed line that is gone (deleted, undone) frees the engine's preview document and its font copies.
  useEffect(() => {
    const keep = new Set<ObjectId>(doc.objects.filter((o) => o.kind === 'replace').map((o) => o.id));
    if (replaceEditing) keep.add(replaceEditing.object.id);
    void releaseReplacePreviews(keep).catch(() => undefined);
  }, [doc.objects, replaceEditing]);

  const [detected, setDetected] = useState<ReadonlyMap<number, DetectedTextPage | 'failed'>>(() => new Map());
  const detecting = useRef(new Set<number>());
  const detectPage = useCallback(
    (index: number) => {
      if (detecting.current.has(index)) return;
      detecting.current.add(index);
      void (async () => {
        let result: DetectedTextPage | 'failed';
        try {
          result = await detectTextLines(await pdf.getPage(index + 1), index);
        } catch (err) {
          console.warn('edit-pdf: could not find the lines of a page', err);
          result = 'failed';
        }
        setDetected((map) => new Map(map).set(index, result));
      })();
    },
    [pdf],
  );

  /** Edit text gave up (engine missing): back to Select, and say why. */
  const replaceUnavailable = useCallback(() => {
    setReplaceEngine('unavailable');
    if (stateRef.current.tool === 'replace') dispatch({ type: 'setTool', tool: 'select' });
    block(t('disabled.replace'), LONG_NOTICE_MS);
  }, [block, t]);

  // ── A source pdf-lib can't write yet (source.needsFix): the step that needs it asks for the fix first ──
  const [fixFirst, setFixFirst] = useState<{ fix: SourceFix; after: AfterFix; busy: boolean; error: string | null } | null>(null);
  const askFix = useCallback((fix: SourceFix, after: AfterFix) => setFixFirst({ fix, after, busy: false, error: null }), []);

  // ── Actions ──
  const checkToken = useRef(0);
  const [pendingLineId, setPendingLineId] = useState<string | null>(null);
  /** Source pages whose rewrite would change them (checkLineRemoval said wholePage): no line there is offered. */
  const [effectsPages, setEffectsPages] = useState<ReadonlySet<number>>(() => new Set());

  const setTool = useCallback(
    (next: EditorTool) => {
      settle();
      // Edit text reads the file with PDFium and pdf-lib, and a fix after a changed line would renumber its font: fix first.
      const needsFix = sourceRef.current.needsFix;
      if (next === 'replace' && needsFix) {
        askFix(needsFix, { then: 'replaceTool' });
        return;
      }
      checkToken.current += 1;
      setPendingLineId(null);
      // The tools work on one page: picking one leaves the All pages grid.
      if (stateRef.current.view === 'grid') dispatch({ type: 'setView', view: 'page' });
      dispatch({ type: 'setTool', tool: next });
      if (next === 'replace') {
        void ensureReplacer().then((ok) => {
          if (!ok) replaceUnavailable();
        });
      }
    },
    [askFix, ensureReplacer, replaceUnavailable, settle],
  );

  const goToPage = useCallback(
    (pageId: PageId) => {
      settle();
      dispatch({ type: 'goToPage', pageId });
    },
    [settle],
  );

  const add = useCallback(
    (object: EditorObject, toolAfter: EditorTool) => {
      if (toolAfter !== stateRef.current.tool) dispatch({ type: 'setTool', tool: toolAfter });
      dispatch({ type: 'addObject', object: withTextHeight(object) });
    },
    [withTextHeight],
  );

  const replace = useCallback(
    (object: EditorObject) => dispatch({ type: 'replaceObject', object: withTextHeight(object) }),
    [withTextHeight],
  );

  const startText = useCallback(
    (box: VisualBox) => {
      const s = stateRef.current;
      dispatch({ type: 'setTool', tool: 'select' });
      beginEditing(
        { id: newObjectId(), pageId: s.currentPageId, kind: 'text', box, text: '', size: s.style.textSize, color: s.style.textColor },
        true,
      );
    },
    [beginEditing, newObjectId],
  );

  /** Type in a text box, or retype a changed line. */
  const editText = useCallback(
    (id: ObjectId) => {
      const object = stateRef.current.doc.objects.find((o) => o.id === id);
      if (object?.kind !== 'text' && object?.kind !== 'replace') return;
      if (editingRef.current?.object.id === id || replaceEditingRef.current?.object.id === id) return;
      commitNudge();
      commitEditing();
      commitReplace();
      dispatch({ type: 'select', id });
      if (object.kind === 'text') beginEditing(object, false);
      else beginReplace(object, false);
    },
    [beginEditing, beginReplace, commitEditing, commitNudge, commitReplace],
  );

  const undo = useCallback(() => {
    settle();
    dispatch({ type: 'undo' });
  }, [settle]);
  const redo = useCallback(() => {
    settle();
    dispatch({ type: 'redo' });
  }, [settle]);

  // ── Layout refs (the canvas area and the page in it) ──
  const areaRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  /** Where an inserted object goes: the middle of the part of the page on screen, not of the whole page. */
  const visiblePagePoint = useCallback((): PagePoint => {
    const pageEl = pageRef.current;
    const area = areaRef.current;
    if (!pageEl || !area) return { x: 0.5, y: 0.5 };
    const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    return visibleCenter(pageEl.getBoundingClientRect(), [area.getBoundingClientRect(), viewport]);
  }, []);

  /** Add an object (already placed on the current page) and select it. */
  const placeAndSelect = useCallback(
    (object: EditorObject) => {
      settle();
      add(object, 'select');
    },
    [add, settle],
  );

  // Pictures
  /** Where the previous person's signatures were (startNextPerson): the next signatures land there. */
  const signatureSlotsRef = useRef<{ pageId: PageId; box: VisualBox }[]>([]);
  const insertPicture = useCallback(
    async (input: Blob, signature: boolean) => {
      setError(null);
      try {
        const prepared = await prepareImage(input, signature ? { trim: true } : undefined);
        const asset = addAsset(prepared);
        const s = stateRef.current;
        // After Fill again for the next person, a signature goes where the previous person's was
        const slots = signatureSlotsRef.current;
        while (slots.length > 0 && !s.doc.pages.some((p) => p.id === slots[0].pageId)) slots.shift();
        const slot = signature ? slots.shift() : undefined;
        const pageId = slot ? slot.pageId : s.currentPageId;
        const page = sizeOfPage(s.doc, pageId);
        const box = slot
          ? imageBoxFor(prepared.width, prepared.height, page, slot.box.wPct, false, {
              x: slot.box.xPct + slot.box.wPct / 2,
              y: slot.box.yPct + slot.box.hPct / 2,
            })
          : signature
            ? imageBoxFor(prepared.width, prepared.height, page, 0.3, false, visiblePagePoint())
            : imageBoxFor(prepared.width, prepared.height, page, 0.4, true, visiblePagePoint());
        if (pageId !== s.currentPageId) dispatch({ type: 'goToPage', pageId });
        placeAndSelect({
          id: newObjectId(),
          pageId,
          kind: 'image',
          box,
          assetId: asset.id,
          ...(signature ? { signature: true as const } : {}),
        });
      } catch (err) {
        console.error('edit-pdf: picture could not be added', err);
        setError('image');
      }
    },
    [addAsset, newObjectId, placeAndSelect, setError, sizeOfPage, visiblePagePoint],
  );

  // ── Fill again for the next person (offered by the delivery panel after a filled-in form is saved) ──
  /** Boxes that read today's date stay filled: it is the same date for the next person. */
  const todayTexts = useCallback((): ReadonlySet<string> => {
    const now = new Date();
    const texts = new Set([formatGregorianDate(now, locale)]);
    try {
      texts.add(todayHijri(locale));
    } catch {
      // No Hijri calendar in this browser: only the Gregorian date stays
    }
    return texts;
  }, [locale]);
  const startNextPerson = useCallback(() => {
    settle();
    const plan = planNextPerson(stateRef.current.doc, todayTexts());
    if (!plan) return;
    trackEvent('tool_pick', { tool_id: 'nextPerson', surface: 'delivery' });
    signatureSlotsRef.current = plan.signatureSlots;
    if (stateRef.current.tool !== 'select') dispatch({ type: 'setTool', tool: 'select' });
    if (stateRef.current.view === 'grid') dispatch({ type: 'setView', view: 'page' });
    dispatch({ type: 'nextPerson', objects: plan.objects });
    if (plan.firstEmpty) dispatch({ type: 'goToPage', pageId: plan.firstEmpty.pageId });
  }, [settle, todayTexts]);

  const { getInputProps, open: openImagePicker } = useTrackedDropzone({
    uploadRole: 'image',
    accept: IMAGE_ACCEPT,
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_IMAGE_BYTES,
    noClick: true,
    noKeyboard: true,
    noDrag: true,
    onDrop: (accepted, rejected) => {
      if (accepted[0]) void insertPicture(accepted[0], false);
      else if (rejected.length > 0) setError('image');
    },
  });

  // ── Stamps: the panel, and the watermark's image ──
  const [stampPanel, setStampPanel] = useState<'watermark' | 'numbers' | 'letterhead' | null>(
    modeConfig.panel === 'watermark' || modeConfig.panel === 'numbers' ? modeConfig.panel : null,
  );
  const setStamps = useCallback(
    (stamps: EditorDoc['stamps']) => {
      settle();
      dispatch({ type: 'setStamps', stamps: stamps ?? {} });
    },
    [settle],
  );
  /** The panel's watermark form when the image picker opened: the chosen image goes into it. */
  const watermarkForm = useRef<WatermarkStamp | null>(null);
  const { getInputProps: getWatermarkInputProps, open: openWatermarkPicker } = useTrackedDropzone({
    uploadRole: 'watermark_image',
    accept: IMAGE_ACCEPT,
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_IMAGE_BYTES,
    noClick: true,
    noKeyboard: true,
    noDrag: true,
    onDrop: (accepted, rejected) => {
      if (!accepted[0]) {
        if (rejected.length > 0) setError('image');
        return;
      }
      void (async () => {
        setError(null);
        try {
          const asset = addAsset(await prepareImage(accepted[0]));
          const s = stateRef.current;
          const form = watermarkForm.current ?? s.doc.stamps?.watermark ?? defaultStamps.watermark();
          dispatch({ type: 'setStamps', stamps: { ...s.doc.stamps, watermark: { ...form, type: 'image', assetId: asset.id } } });
        } catch (err) {
          console.error('edit-pdf: the watermark image could not be added', err);
          setError('image');
        }
      })();
    },
  });

  // ── The letterhead: its logo, the copy kept on this device, the shared file ──
  /** The panel's letterhead form when the logo picker opened: the chosen logo goes into it. */
  const letterheadForm = useRef<LetterheadStamp | null>(null);
  const { getInputProps: getLogoInputProps, open: openLogoPicker } = useTrackedDropzone({
    uploadRole: 'letterhead_logo',
    accept: IMAGE_ACCEPT,
    maxFiles: 1,
    multiple: false,
    maxSize: MAX_IMAGE_BYTES,
    noClick: true,
    noKeyboard: true,
    noDrag: true,
    onDrop: (accepted, rejected) => {
      if (!accepted[0]) {
        if (rejected.length > 0) setError('image');
        return;
      }
      void (async () => {
        setError(null);
        try {
          const asset = addAsset(await prepareImage(await smallLogo(accepted[0])));
          const s = stateRef.current;
          const form = letterheadForm.current ?? s.doc.stamps?.letterhead ?? EMPTY_LETTERHEAD;
          dispatch({ type: 'setStamps', stamps: { ...s.doc.stamps, letterhead: { ...form, logoAssetId: asset.id } } });
        } catch (err) {
          console.error('edit-pdf: the logo could not be added', err);
          setError('image');
        }
      })();
    },
  });
  /** A saved letterhead onto the doc: its logo becomes an asset. */
  const applyLetterhead = useCallback(
    (saved: SavedLetterhead) => {
      const logo = saved.logo ? addAsset({ format: saved.logo.format, bytes: saved.logo.bytes, width: saved.logo.width, height: saved.logo.height }) : null;
      const letterhead: LetterheadStamp = { left: saved.left, right: saved.right, footer: saved.footer, pages: saved.pages, ...(logo ? { logoAssetId: logo.id } : {}) };
      const s = stateRef.current;
      dispatch({ type: 'setStamps', stamps: { ...s.doc.stamps, letterhead: letterheadHasContent(letterhead) ? letterhead : undefined } });
    },
    [addAsset],
  );
  const savedLetterheadOf = useCallback((letterhead: LetterheadStamp): SavedLetterhead => {
    const asset = letterhead.logoAssetId ? assetsRef.current[letterhead.logoAssetId] : undefined;
    return {
      left: letterhead.left,
      right: letterhead.right,
      footer: letterhead.footer,
      pages: letterhead.pages,
      ...(asset ? { logo: { format: asset.format, width: asset.width, height: asset.height, bytes: asset.bytes } } : {}),
    };
  }, []);
  // Kept for next time, as it changes; taking it off this document doesn't forget it.
  const docLetterhead = state.doc.stamps?.letterhead;
  useEffect(() => {
    if (docLetterhead) storeLetterhead(savedLetterheadOf(docLetterhead));
  }, [docLetterhead, savedLetterheadOf]);
  // Where each page of the file has its text, read once a letterhead is on (the room it needs: letterheadRoom)
  const [textExtents, setTextExtents] = useState<{ pdf: unknown; byIndex: ReadonlyMap<number, TextExtent | null> }>(() => ({ pdf, byIndex: new Map() }));
  const extentsFor = textExtents.pdf === pdf ? textExtents.byIndex : null;
  useEffect(() => {
    if (!docLetterhead) return;
    const known = extentsFor ?? new Map<number, TextExtent | null>();
    const missing = [...new Set(state.doc.pages.flatMap((p) => (p.source.kind === 'source' && !known.has(p.source.index) ? [p.source.index] : [])))];
    if (missing.length === 0) return;
    let live = true;
    void (async () => {
      const found = new Map(known);
      for (const index of missing) {
        try {
          found.set(index, await textExtentOf(await pdf.getPage(index + 1)));
        } catch {
          found.set(index, null);
        }
      }
      if (live) setTextExtents({ pdf, byIndex: found });
    })();
    return () => {
      live = false;
    };
  }, [docLetterhead, extentsFor, pdf, state.doc.pages]);
  /** The text extent the room may use for a page: upright, uncropped, no replaced line (as the export checks). */
  const roomExtentOf = useCallback(
    (page: EditorPage, objects: readonly EditorObject[]): TextExtent | undefined => {
      if (page.source.kind !== 'source' || page.rotation !== 0 || page.crop || sourcePages[page.source.index]?.rotate !== 0) return undefined;
      if (objects.some((o) => o.pageId === page.id && o.kind === 'replace')) return undefined;
      return extentsFor?.get(page.source.index) ?? undefined;
    },
    [extentsFor, sourcePages],
  );
  const letterheadFileInput = useRef<HTMLInputElement>(null);
  const saveLetterheadFile = () => {
    const letterhead = stateRef.current.doc.stamps?.letterhead;
    if (!letterhead) return;
    downloadBlob(new Blob([letterheadFileText(savedLetterheadOf(letterhead))], { type: 'application/json' }), LETTERHEAD_FILE_NAME);
  };
  const openLetterheadFile = async (file: File) => {
    const saved = parseLetterheadFile(await file.text().catch(() => ''));
    if (!saved) {
      block(tWorkspace('letterhead.badFile'), 5000);
      return;
    }
    settle();
    applyLetterhead(saved);
  };

  // /sign-pdf opens with the signature dialog.
  const [signatureOpen, setSignatureOpen] = useState(modeConfig.panel === 'signature');
  const [lastSignature, setLastSignature] = useState<string | undefined>(undefined);

  const insertDate = useCallback(
    (hijri: boolean) => {
      const now = new Date();
      let text: string;
      try {
        text = hijri ? todayHijri(locale) : formatGregorianDate(now, locale);
      } catch {
        text = formatGregorianDate(now, locale);
      }
      const s = stateRef.current;
      const page = sizeOfPage(s.doc, s.currentPageId);
      const size = s.style.textSize;
      const layout = layoutText(text, size, page.width * 10);
      const widest = layout ? Math.max(0, ...layout.lines.map((l) => l.width)) : text.length * size * 0.6;
      const wPt = Math.max(MIN_TEXT_WIDTH_PT, widest + size * 0.75);
      const box = boxAround(visiblePagePoint(), Math.min(1, wPt / page.width), 0);
      placeAndSelect({ id: newObjectId(), pageId: s.currentPageId, kind: 'text', box, text, size, color: s.style.textColor });
    },
    [layoutText, locale, newObjectId, placeAndSelect, sizeOfPage, visiblePagePoint],
  );

  /** Insert ▸ PDF pages opens this picker (set up with Insert PDF, below). */
  const openPdfPicker = useRef<() => void>(() => undefined);
  const onInsert = useCallback(
    (kind: InsertKind) => {
      settle();
      if (stateRef.current.tool !== 'select') dispatch({ type: 'setTool', tool: 'select' });
      if (kind === 'letterhead') {
        // The one kept on this device goes on at once; the panel opens to change it or start one
        const s = stateRef.current;
        if (!s.doc.stamps?.letterhead) {
          const saved = loadLetterhead();
          if (saved) applyLetterhead(saved);
        }
        if (s.view === 'grid') dispatch({ type: 'setView', view: 'page' });
        setStampPanel('letterhead');
        return;
      }
      if (kind === 'watermark' || kind === 'numbers') {
        // A stamp goes on every page at once, with its defaults, and its panel opens to change them.
        const s = stateRef.current;
        if (kind === 'watermark' && !s.doc.stamps?.watermark) {
          dispatch({ type: 'setStamps', stamps: { ...s.doc.stamps, watermark: defaultStamps.watermark() } });
        } else if (kind === 'numbers' && !s.doc.stamps?.pageNumbers) {
          dispatch({ type: 'setStamps', stamps: { ...s.doc.stamps, pageNumbers: defaultStamps.pageNumbers() } });
        }
        if (s.view === 'grid') dispatch({ type: 'setView', view: 'page' });
        setStampPanel(kind);
        return;
      }
      if (kind === 'pdf') {
        openPdfPicker.current();
        return;
      }
      if (kind === 'image') openImagePicker();
      else if (kind === 'signature') setSignatureOpen(true);
      else insertDate(kind === 'dateHijri');
    },
    [applyLetterhead, defaultStamps, insertDate, openImagePicker, settle],
  );

  // Pages
  const pageIndex = Math.max(0, doc.pages.findIndex((p) => p.id === currentPageId));
  const page = doc.pages[pageIndex];
  const goRelative = useCallback(
    (delta: -1 | 1) => {
      const s = stateRef.current;
      const i = s.doc.pages.findIndex((p) => p.id === s.currentPageId) + delta;
      if (i >= 0 && i < s.doc.pages.length) goToPage(s.doc.pages[i].id);
    },
    [goToPage],
  );
  const pageAction = useCallback(
    (action: EditorAction) => {
      settle();
      dispatch(action);
    },
    [settle],
  );

  // ── Ticked pages and the All pages grid ──
  const selectedPages = useMemo(() => new Set(state.selectedPageIds), [state.selectedPageIds]);
  const togglePage = useCallback((pageId: PageId, range: boolean) => dispatch({ type: 'togglePageSelection', pageId, range }), []);
  /** What the grid says it is for when All tools opened it (Turn, Delete, Reorder pages); the mode's own hint otherwise. */
  const [gridFocus, setGridFocus] = useState<'turn' | 'delete' | 'drag' | null>(null);
  const setView = useCallback(
    (view: 'page' | 'grid') => {
      settle();
      setGridFocus(null);
      dispatch({ type: 'setView', view });
    },
    [settle],
  );
  const openPage = useCallback(
    (pageId: PageId) => {
      goToPage(pageId);
      dispatch({ type: 'setView', view: 'page' });
    },
    [goToPage],
  );
  const movePageTo = useCallback((pageId: PageId, index: number) => pageAction({ type: 'movePageTo', pageId, index }), [pageAction]);
  /** Turn the ticked pages; pages with a changed line stay as they are, and the visitor is told. */
  const turnSelected = useCallback(
    (turns: 1 | 3) => {
      const s = stateRef.current;
      const skipped = s.selectedPageIds.filter((id) => pageHasReplace(s.doc, id));
      pageAction({ type: 'rotatePages', pageIds: s.selectedPageIds, turns });
      if (skipped.length > 0) block(tWorkspace('pages.skippedTurn'), LONG_NOTICE_MS);
    },
    [block, pageAction, tWorkspace],
  );
  // ── Crop: what a drag applies to (crop-pdf crops every page, so its mode starts on All pages) ──
  const [cropTarget, setCropTarget] = useState<CropTarget>(modeConfig.tool === 'crop' ? 'all' : 'page');
  const cropTargetIds = useCallback((target: CropTarget): PageId[] => {
    const s = stateRef.current;
    if (target === 'all') return s.doc.pages.map((p) => p.id);
    // The page drawn on is cropped too, ticked or not.
    if (target === 'selected') return [...new Set([...s.selectedPageIds, s.currentPageId])];
    return [s.currentPageId];
  }, []);
  /** Crop `pageIds`, unless the box would keep too little of one of them (sizes differ): that page is named. */
  const cropPages = useCallback(
    (pageIds: PageId[], box: VisualBox | null): boolean => {
      const s = stateRef.current;
      const tooSmall = box ? cropTooSmallOn(s.doc, s.sourcePages, pageIds, box) : null;
      if (tooSmall !== null) {
        block(tWorkspace('crop.tooSmallOn', { number: tooSmall }), LONG_NOTICE_MS);
        return false;
      }
      pageAction({ type: 'setCrop', pageIds, crop: box });
      return true;
    },
    [block, pageAction, tWorkspace],
  );
  const applyCrop = useCallback(
    (box: VisualBox | null) => void cropPages(cropTargetIds(cropTarget), box),
    [cropPages, cropTarget, cropTargetIds],
  );
  const changeCropTarget = useCallback(
    (target: CropTarget) => {
      // The crop on screen goes onto the pages just chosen, with the same fractions.
      const s = stateRef.current;
      const crop = s.doc.pages.find((p) => p.id === s.currentPageId)?.crop;
      if (crop && target !== 'page' && !cropPages(cropTargetIds(target), crop)) return;
      setCropTarget(target);
    },
    [cropPages, cropTargetIds],
  );

  const selectionBar =
    state.selectedPageIds.length > 0 ? (
      <SelectionBar
        count={state.selectedPageIds.length}
        total={doc.pages.length}
        onSelectAll={() => dispatch({ type: 'setPageSelection', pageIds: doc.pages.map((p) => p.id) })}
        onClear={() => dispatch({ type: 'setPageSelection', pageIds: [] })}
        onTurn={turnSelected}
        onDelete={() => pageAction({ type: 'deletePages', pageIds: state.selectedPageIds })}
        onBlocked={block}
        turnBlockedReason={state.selectedPageIds.every((id) => pageHasReplace(doc, id)) ? t('disabled.rotateReplaced') : undefined}
      />
    ) : null;

  // ── Edit text: lines of the page on screen, and a tap on one ──
  const sourceIndex = page.source.kind === 'source' ? page.source.index : null;
  useEffect(() => {
    if (tool === 'replace' && sourceIndex !== null && !detected.has(sourceIndex)) detectPage(sourceIndex);
  }, [detectPage, detected, sourceIndex, tool]);
  const detectedHere = sourceIndex === null ? undefined : detected.get(sourceIndex);
  const pageLines = detectedHere && detectedHere !== 'failed' ? detectedHere.lines : null;

  /**
   * Open the box for a line whose removal check passed, prefilled. With its
   * font analysis the engine sizes it (autoSize); without, it is sized as in
   * Phase C so the line keeps about its width in Cairo.
   */
  const openReplaceDraft = useCallback(
    (line: SourceTextLine, pageId: PageId, rotation: EditorPage['rotation'], font: LineFont | null) => {
      let prefillWidth = 0;
      if (!font) {
        try {
          prefillWidth =
            engine?.layout(line.text, { size: line.geometry.size, width: 1e6, fallbackDirection: line.direction }).lines[0]?.width ?? 0;
        } catch (err) {
          console.warn('edit-pdf: text layout failed', err);
        }
      }
      beginReplace(newReplaceObject({ id: newObjectId(), pageId, line, box: lineBoxAt(line, rotation), font, prefillWidth }), true);
    },
    [beginReplace, engine, newObjectId],
  );

  const pickLine = useCallback(
    async (pick: LinePick) => {
      const s = stateRef.current;
      const here = s.doc.pages.find((p) => p.id === s.currentPageId);
      if (!here) return;
      if (!pick) {
        const known = here.source.kind === 'source' ? detected.get(here.source.index) : 'failed';
        block(known === undefined ? t('replace.loading') : t('replace.none'));
        return;
      }
      const existing = replaceForLine(s.doc, pick.line.id);
      if (existing) {
        dispatch({ type: 'select', id: existing.id });
        return;
      }
      if (effectsPages.has(pick.line.pageIndex)) {
        block(`${t('replace.pageEffects')} ${t('replace.useCover')}`, LONG_NOTICE_MS);
        return;
      }
      const reason = lineBlock(pick.line, here.rotation);
      if (pick.kind === 'blocked' || reason) {
        if (reason === 'turned') block(t('replace.turned'), LONG_NOTICE_MS);
        else block(`${reason === 'slanted' ? t('replace.slanted') : t('replace.invisible')} ${t('replace.useCover')}`, LONG_NOTICE_MS);
        return;
      }
      const token = ++checkToken.current;
      const { line } = pick;
      const { file, pdf } = sourceRef.current;
      setPendingLineId(line.id);
      // Which font the line is drawn in and what it can draw, alongside the removal check. Null = Cairo, as before.
      const fontAnalysis = analyzeLineFont(file, pdf, line).catch((err: unknown) => {
        console.warn('edit-pdf: the font analysis failed', err);
        return null;
      });
      try {
        if (replaceEngine !== 'ready') block(t('replace.loading'));
        if (!(await ensureReplacer())) {
          if (token === checkToken.current) replaceUnavailable();
          return;
        }
        const [verdict, font] = await Promise.all([checkLineRemoval(file, line), fontAnalysis]);
        if (token !== checkToken.current) return;
        if (!verdict.ok) {
          if (verdict.wholePage) setEffectsPages((pages) => new Set(pages).add(line.pageIndex));
          const why = verdict.reason === 'PAGE_EFFECTS' ? t('replace.pageEffects') : t('replace.joined');
          block(`${why} ${t('replace.useCover')}`, LONG_NOTICE_MS);
          return;
        }
        // Still on that page, with the tool on, and nobody changed that line meanwhile.
        const now = stateRef.current;
        const target = now.doc.pages.find((p) => p.id === here.id);
        if (now.tool !== 'replace' || now.currentPageId !== here.id || !target || replaceForLine(now.doc, line.id)) return;
        if (lineBlock(line, target.rotation)) return;
        setNotice(null);
        openReplaceDraft(line, target.id, target.rotation, font);
      } catch (err) {
        if (token !== checkToken.current) return;
        if (isEditPdfError(err, 'REPLACE_UNAVAILABLE')) {
          console.warn('edit-pdf: Edit text could not load', err);
          replaceUnavailable();
        } else {
          console.warn('edit-pdf: the line check failed', err);
          block(`${t('replace.unreadable')} ${t('replace.useCover')}`, LONG_NOTICE_MS);
        }
      } finally {
        if (token === checkToken.current) setPendingLineId(null);
      }
    },
    [block, detected, effectsPages, ensureReplacer, openReplaceDraft, replaceEngine, replaceUnavailable, t],
  );

  // ── Save ──
  /** The source version the last save delivered. */
  const [savedVersion, setSavedVersion] = useState(0);
  /**
   * The source version the last fix (unlock, repair, OCR) produced; an insert
   * doesn't count (its pages are doc changes, and Undo takes them back). A
   * source that opened after a fix starts out fixed: those bytes aren't saved yet.
   */
  const [fixedVersion, setFixedVersion] = useState(source.version);
  const unsavedFix = fixedVersion > savedVersion;
  const changed = hasChanges(doc, state.basePageCount);
  const dirty = (changed && doc !== exportedDoc) || unsavedFix;
  const [saveStep, setSaveStep] = useState<SaveStep | null>(null);

  /**
   * One save through the shell's pipeline. `pre` runs on the settled state
   * first (the delete mode's "delete the selected pages, then save").
   * Nothing changed in the doc and nothing asked of the pages = pass-through
   * (request null): the working source's bytes go out as they are.
   * A source pdf-lib can't write yet asks for its fix first when this save
   * needs pdf-lib or (restrictions) our server (fixBeforeSave), and carries on after it.
   */
  const save = useCallback(
    async (plan: SavePlan, pre?: EditorAction) => {
      if (savingRef.current) return;
      let s = stateRef.current;
      for (const action of [commitNudge(), commitEditing(), commitReplace(), pre ?? null]) if (action) s = editorReducer(s, action);
      const working = sourceRef.current;
      // Exactly the source's own pages, untouched: the bytes as they are ARE the result.
      const asIs = !hasChanges(s.doc, s.sourcePages.length) && !plan.flatten && plan.pages === 'all';
      const fix = fixBeforeSave(working.needsFix, plan, !asIs);
      if (fix) {
        askFix(fix, { then: 'save', plan, pre });
        return;
      }
      if (pre) dispatch(pre);
      savingRef.current = true;
      setSaving(true);
      setError(null);
      setFixFirst(null);
      try {
        const ticked = new Set(s.selectedPageIds);
        let request: ExportRequest | null = null;
        if (!asIs) {
          const pages = plan.pages === 'selected' ? s.doc.pages.filter((p) => ticked.has(p.id)) : s.doc.pages;
          const kept = new Set(pages.map((p) => p.id));
          const objects = s.doc.objects.filter((o) => kept.has(o.pageId));
          const used = new Set(objects.flatMap((o) => (o.kind === 'image' ? [o.assetId] : [])));
          const watermarkAsset = s.doc.stamps?.watermark?.type === 'image' ? s.doc.stamps.watermark.assetId : undefined;
          if (watermarkAsset) used.add(watermarkAsset);
          const logoAsset = s.doc.stamps?.letterhead?.logoAssetId;
          if (logoAsset) used.add(logoAsset);
          const assets = Object.fromEntries(Object.entries(assetsRef.current).filter(([id]) => used.has(id)));
          request = {
            pages,
            objects,
            assets,
            fallbackDirection,
            ...(s.doc.stamps ? { stamps: s.doc.stamps } : {}),
            ...(s.doc.stamps?.letterhead
              ? {
                  textExtents: Object.fromEntries(
                    pages.flatMap((p) => {
                      const extent = roomExtentOf(p, objects);
                      return extent ? [[p.id, extent]] : [];
                    }),
                  ),
                }
              : {}),
            flattenForm: plan.flatten || objects.length > 0,
          };
        }
        const order = request ? request.pages : s.doc.pages;
        const input: SaveInput = {
          mode,
          source: working.file,
          request,
          plan,
          selected: order.flatMap((p, i) => (ticked.has(p.id) ? [i] : [])),
          pageCount: request ? request.pages.length : s.sourcePages.length,
          baseName: baseName(working.file),
          summary: summarizeDoc(s.doc, s.basePageCount),
          onStep: setSaveStep,
        };
        trackEvent('save_plan', savePlanParams(plan, s.doc.pages.length));
        const result = await runSave(input);
        // After `pre` the editor's own doc is the one saved (s.doc is an equal copy made here).
        const savedDoc = pre ? stateRef.current.doc : s.doc;
        setWarnings({ doc: savedDoc, list: result.warnings });
        setExportedDoc(savedDoc);
        setSavedVersion(working.version);
        setRefused(null);
        // Only the engine's verified count: never claim a removal the export didn't check.
        setRemoved(result.removedLines > 0 ? { doc: stateRef.current.doc, count: result.removedLines } : null);
        onSaved(result, planNextPerson(savedDoc, todayTexts()) ? startNextPerson : undefined);
      } catch (err) {
        setRemoved(null);
        if (isEditPdfError(err, 'ENCRYPTED')) {
          // Encrypted after all (inspectPdf and pdf.js missed it): remove the restrictions, then save again.
          askFix('unlock', { then: 'save', plan });
        } else if (isEditPdfError(err, 'REPLACE_REFUSED')) {
          console.warn('edit-pdf: a changed line was refused', err);
          setRefused({ doc: stateRef.current.doc, ids: new Set(err.objectIds) });
          setFailure({ kind: 'replaceRefused', page: err.pageNumbers[0] ?? 1 });
        } else if (isEditPdfError(err, 'REPLACE_FAILED')) {
          console.warn('edit-pdf: removing a line could not be verified', err);
          setFailure({ kind: 'replaceFailed' });
        } else if (isEditPdfError(err, 'REPLACE_UNAVAILABLE')) {
          console.warn('edit-pdf: Edit text could not load for the save', err);
          setFailure({ kind: 'replaceUnavailable' });
        } else if (err instanceof SaveError) {
          console.warn(`edit-pdf: the save stopped at ${err.step}`, err);
          setFailure({ kind: 'server', code: err.code });
        } else {
          console.error('edit-pdf: save failed', err);
          setError('save');
        }
      } finally {
        savingRef.current = false;
        setSaving(false);
        setSaveStep(null);
      }
    },
    [askFix, commitEditing, commitNudge, commitReplace, fallbackDirection, mode, onSaved, roomExtentOf, runSave, setError, startNextPerson, todayTexts],
  );

  // ── Fixes in the editor (OCR, repair) and Insert PDF: the working source is swapped in place ──
  const [fixing, setFixing] = useState<FixKind | null>(null);
  const [fixError, setFixError] = useState<{ kind: FixKind; text: string } | null>(null);
  const [inserting, setInserting] = useState(false);
  const busyWith = inserting ? 'inserting' : null;
  /** The fix that just finished, when the page's job IS that fix: deliver it at once (the save effect below). */
  const [deliverFix, setDeliverFix] = useState(() => fixedBy !== null && (fixedBy === modeConfig.primary.action || (fixedBy === 'unlock' && mode === 'unlock')));
  const [ocrLanguages, setOcrLanguages] = useState<OcrLanguage[]>(() => defaultOcrLanguages(locale));
  const [ocrRedo, setOcrRedo] = useState(false);
  const [ocrDismissed, setOcrDismissed] = useState(false);
  /** Why a fix that rewrites the file can't run now (fixRefusal: a changed line's font would point elsewhere after it). */
  const refusalText = useCallback(
    (kind: FixKind, d: EditorDoc): string | undefined =>
      fixRefusal(d, kind) ? (kind === 'ocr' ? tWorkspace('fix.ocrReplaced') : tWorkspace('fix.rebuildReplaced')) : undefined,
    [tWorkspace],
  );
  const tOcr = useTranslations('ocrPdf');
  /** Over the route's page cap: said before the upload (the route would refuse it after). */
  const ocrPageLimit = useCallback(
    (pages: number): string | undefined =>
      pages > OCR_MAX_PAGES ? tOcr('errors.pageLimitBeforeUpload', { pages, max: OCR_MAX_PAGES }) : undefined,
    [tOcr],
  );
  const ocrBlocked = refusalText('ocr', doc) ?? ocrPageLimit(sourcePages.length);
  const repairBlocked = refusalText('repair', doc);
  /** Pages Insert PDF left out (encrypted, unreadable, or over the size cap): said until dismissed. */
  const [insertNotice, setInsertNotice] = useState<{ skipped: string[]; tooBig: boolean } | null>(null);

  /**
   * A fix's result becomes the working source. Same pages (count, sizes,
   * /Rotate) = the doc and history stay; otherwise the doc starts over, after
   * asking when there is something to lose (no = the file as it was comes back).
   * Lines, page effects and previews were found on the old file: they go.
   * Null when the visitor kept the file as it was.
   */
  const swapSource = useCallback(
    async (fixed: File): Promise<'kept' | 'restarted' | null> => {
      const before = stateRef.current;
      const previous = sourceRef.current.file;
      const next = await replaceSource(fixed);
      // What the next render sets anyway: a step that carries on right after the fix reads the fixed file.
      sourceRef.current = next;
      const same =
        next.sourcePages.length === before.sourcePages.length &&
        next.sourcePages.every((p, i) => {
          const q = before.sourcePages[i];
          return Math.abs(p.width - q.width) <= 0.01 && Math.abs(p.height - q.height) <= 0.01 && p.rotate === q.rotate;
        });
      if (!same && hasChanges(before.doc, before.basePageCount) && !window.confirm(tWorkspace('fix.restartConfirm'))) {
        sourceRef.current = await replaceSource(previous);
        return null;
      }
      dispatch({ type: 'replaceSource', sourcePages: next.sourcePages, keepDoc: same });
      detecting.current.clear();
      setDetected(new Map());
      setEffectsPages(new Set());
      previews.reset();
      setFixedVersion(next.version);
      return same ? 'kept' : 'restarted';
    },
    [previews, replaceSource, tWorkspace],
  );

  const runFix = useCallback(
    async (kind: 'ocr' | 'repair') => {
      if (fixing || savingRef.current || inserting) return;
      settle();
      const refused = refusalText(kind, stateRef.current.doc);
      if (refused) {
        block(refused, LONG_NOTICE_MS);
        return;
      }
      const tooLong = kind === 'ocr' ? ocrPageLimit(stateRef.current.sourcePages.length) : undefined;
      if (tooLong) {
        block(tooLong, LONG_NOTICE_MS);
        return;
      }
      // Our OCR can't read an encrypted file: its restrictions go first.
      if (kind === 'ocr' && sourceRef.current.needsFix === 'unlock') {
        askFix('unlock', { then: 'ocr' });
        return;
      }
      setFixing(kind);
      setFixError(null);
      try {
        const file = sourceRef.current.file;
        const fixed = kind === 'ocr' ? await fixes.ocr(file, ocrLanguages, ocrRedo) : await fixes.repair(file);
        if (await swapSource(fixed)) {
          if (kind === 'ocr') setOcrDismissed(true);
          if (kind === modeConfig.primary.action) setDeliverFix(true);
        }
      } catch (err) {
        console.warn(`edit-pdf: ${kind} did not work`, err);
        setFixError({ kind, text: fixErrorText(kind, err) });
      } finally {
        setFixing(null);
      }
    },
    [askFix, block, fixErrorText, fixes, fixing, inserting, modeConfig, ocrLanguages, ocrPageLimit, ocrRedo, refusalText, settle, swapSource],
  );

  /**
   * Insert PDF: the files' pages are appended to the working source (their
   * page indexes follow the ones in use, which stay valid) and go into the
   * doc after `afterPageId` (the end when null), as one undo step. Files that
   * would take the source over WORKSPACE_MAX_BYTES are left for later;
   * encrypted or unreadable ones are skipped; both stay said until dismissed.
   * A source pdf-lib can't write yet gets its fix first.
   */
  const insertPdfs = useCallback(
    async (picked: readonly File[], afterPageId: PageId | null) => {
      if (picked.length === 0 || inserting || fixing || savingRef.current) return;
      settle();
      const working = sourceRef.current;
      if (working.needsFix) {
        askFix(working.needsFix, { then: 'insert', files: picked, afterPageId });
        return;
      }
      let total = working.file.size;
      const taken: File[] = [];
      for (const file of picked) {
        if (total + file.size > WORKSPACE_MAX_BYTES) break;
        total += file.size;
        taken.push(file);
      }
      const tooBig = taken.length < picked.length;
      if (taken.length === 0) {
        setInsertNotice({ skipped: [], tooBig });
        return;
      }
      setInserting(true);
      setError(null);
      setInsertNotice(null);
      try {
        const source = new Uint8Array(await working.file.arrayBuffer());
        // One file read at a time: a 20-file merge doesn't hold a second copy of each while the reads overlap.
        const inputs: { name: string; bytes: Uint8Array }[] = [];
        for (const file of taken) inputs.push({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
        const added = await appendPdfs(source, inputs);
        const count = added.added.reduce((sum, a) => sum + a.pages, 0);
        // Nothing was added: appendPdfs gives the source back as it was, so there is nothing to reload.
        if (count > 0 && added.bytes !== source) {
          const before = working.sourcePages.length;
          const merged = new File([added.bytes as unknown as BlobPart], working.file.name, { type: 'application/pdf' });
          // pdf-lib wrote it after reading the source: no need to parse it again to know it can.
          const next = await replaceSource(merged, { writtenByPdfLib: true });
          const indices = Array.from({ length: next.sourcePages.length - before }, (_, i) => before + i);
          dispatch({ type: 'insertSourcePages', sourcePages: next.sourcePages, indices, afterPageId });
        }
        if (count > 0) block(tWorkspace('insert.added', { count }), LONG_NOTICE_MS);
        if (added.skipped.length > 0 || tooBig) setInsertNotice({ skipped: added.skipped.map((s) => s.name), tooBig });
      } catch (err) {
        console.error('edit-pdf: the pages could not be added', err);
        block(tWorkspace('fix.failed'), LONG_NOTICE_MS);
      } finally {
        setInserting(false);
      }
    },
    [askFix, block, fixing, inserting, replaceSource, setError, settle, tWorkspace],
  );

  const { getInputProps: getPdfInputProps, open: openPdfDialog } = useTrackedDropzone({
    uploadRole: 'insert_pdf',
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: MAX_MERGE_FILES,
    multiple: true,
    maxSize: MAX_PDF_BYTES,
    noClick: true,
    noKeyboard: true,
    noDrag: true,
    onDrop: (accepted, rejected) => {
      const codes = rejected.flatMap((r) => r.errors.map((e) => e.code));
      if (codes.includes('too-many-files')) block(tWorkspace('insert.tooMany'), LONG_NOTICE_MS);
      else if (codes.includes('file-too-large')) block(tErrors('fileTooLarge'), LONG_NOTICE_MS);
      const s = stateRef.current;
      void insertPdfs(accepted, s.view === 'grid' ? null : s.currentPageId);
    },
  });

  useLayoutEffect(() => {
    openPdfPicker.current = openPdfDialog;
  });

  // merge-pdf: files[1..] go in at the end once the first one is open (after its fix, if it needed one).
  // (already in the working file when the editor came back after a language switch)
  const mergedRef = useRef(resume != null);
  useEffect(() => {
    if (mergedRef.current || files.length < 2) return;
    mergedRef.current = true;
    void insertPdfs(files.slice(1), null);
  }, [files, insertPdfs]);

  /** FixFirstPrompt's button: the fix on our server, the fixed file in place (same pages: the doc stays), then the step that asked. */
  const runFixFirst = async () => {
    const asked = fixFirst;
    if (!asked || asked.busy || fixing || savingRef.current || inserting) return;
    const refused = refusalText(asked.fix, stateRef.current.doc);
    if (refused) {
      block(refused, LONG_NOTICE_MS);
      return;
    }
    setFixFirst({ ...asked, busy: true, error: null });
    try {
      const file = sourceRef.current.file;
      const fixed = asked.fix === 'unlock' ? await fixes.unlock(file, null) : await fixes.repair(file);
      const swapped = await swapSource(fixed);
      setFixFirst(null);
      // The pages changed and the doc started over: what was asked for no longer applies.
      if (swapped !== 'kept') return;
      const { after } = asked;
      if (after.then === 'save') void save(after.plan, after.pre);
      else if (after.then === 'insert') void insertPdfs(after.files, after.afterPageId);
      else if (after.then === 'replaceTool') setTool('replace');
      else void runFix('ocr');
    } catch (err) {
      console.warn(`edit-pdf: ${asked.fix} before the step did not work`, err);
      setFixFirst({ ...asked, busy: false, error: fixErrorText(asked.fix, err) });
    }
  };

  // ── The primary button (ModeConfig.primary) and the Save dialog ──
  const { primary } = modeConfig;
  /** The plan last saved from the dialog or changed inline (InlinePlanChoice): the primary button saves with it from then on. */
  const [dialogPlan, setDialogPlan] = useState<SavePlan | null>(null);
  const primaryPlan = useMemo<SavePlan>(
    () => dialogPlan ?? { ...DEFAULT_SAVE_PLAN, ...modeConfig.preset, ...planPreset },
    [dialogPlan, modeConfig, planPreset]
  );
  /** The Save dialog, opened on `plan` (the primary's, or with an All tools choice made). */
  const [dialog, setDialog] = useState<{ focusPassword: boolean; plan: SavePlan } | null>(null);
  const summary = useMemo(() => summarizeDoc(doc, state.basePageCount), [doc, state.basePageCount]);
  const selectedCount = state.selectedPageIds.length;
  const planContext = { selected: selectedCount, pages: doc.pages.length, changed: changed || unsavedFix };
  const saveContext: SaveContext = {
    pageCount: doc.pages.length,
    selected: doc.pages.flatMap((p, i) => (selectedPages.has(p.id) ? [i] : [])),
    baseName: baseName(source.file),
    suffix: modeConfig.suffix,
    changed: planContext.changed,
  };
  /** What the primary button's save gives: the task card's "You'll get" line, the button's words, the header's "where". */
  const saveDescription = describeSave(primaryPlan, saveContext);
  const card = taskCard(mode, primaryPlan);

  /** Why the mode's primary can't act yet (its need), before the plan's own problems. */
  const needReason = (): string | undefined => {
    switch (primary.needs) {
      case 'objects':
        return doc.objects.length > 0 ? undefined : tWorkspace('needs.objects');
      case 'crop':
        return summary.croppedPages > 0 ? undefined : tWorkspace('needs.crop');
      case 'turn':
        return summary.turnedPages > 0 ? undefined : tWorkspace('needs.turn');
      case 'order':
        return summary.moved ? undefined : tWorkspace('needs.order');
      case 'selection':
        if (selectedCount === 0) return tWorkspace('needs.selection');
        return primary.action === 'deleteSelectedThenSave' && selectedCount >= doc.pages.length ? tWorkspace('needs.notAll') : undefined;
      case 'secondFile':
        return summary.insertedPages > 0 ? undefined : tWorkspace('needs.secondFile');
      case 'watermark':
        return summary.watermark ? undefined : tWorkspace('needs.watermark');
      case 'pageNumbers':
        return summary.pageNumbers ? undefined : tWorkspace('needs.pageNumbers');
      default:
        // 'change' is planProblems' nothingToDo (an option such as Make it smaller counts too).
        return undefined;
    }
  };
  const firstProblem = (plan: SavePlan, ctx: typeof planContext) =>
    planProblems(plan, ctx)
      // unlock-pdf with a file that has nothing to unlock (FixNotice notLocked) says that, not "change something".
      .map((problem) => (mode === 'unlock' && problem === 'nothingToDo' ? tWorkspace('needs.nothingToUnlock') : problemText(problem, plan, ctx)))
      .find((text) => text !== undefined);
  let primaryBlocked = busyWith === 'inserting' ? tWorkspace('insert.adding') : needReason();
  if (!primaryBlocked && primary.action === 'save') primaryBlocked = firstProblem(primaryPlan, planContext);
  if (!primaryBlocked && primary.action === 'ocr' && ocrBlocked) primaryBlocked = ocrBlocked;
  if (!primaryBlocked && primary.action === 'repair' && repairBlocked) primaryBlocked = repairBlocked;
  if (!primaryBlocked && primary.action === 'deleteSelectedThenSave') {
    primaryBlocked = firstProblem(primaryPlan, { selected: 0, pages: doc.pages.length - selectedCount, changed: true });
  }

  const openDialog = (focusPassword = false, patch?: Partial<SavePlan>) => {
    settle();
    trackEvent('save_open');
    setDialog({ focusPassword, plan: { ...primaryPlan, ...patch } });
  };
  const runPrimary = () => {
    switch (primary.action) {
      case 'saveDialog':
        openDialog(true);
        break;
      case 'deleteSelectedThenSave':
        void save(primaryPlan, { type: 'deletePages', pageIds: stateRef.current.selectedPageIds });
        break;
      case 'ocr':
      case 'repair':
        void runFix(primary.action);
        break;
      default:
        void save(primaryPlan);
    }
  };
  // /unlock-pdf, /repair-pdf, /ocr-pdf: the fixed file is delivered at once (pass-through when nothing else changed).
  useEffect(() => {
    if (!deliverFix || savingRef.current) return;
    setDeliverFix(false);
    void save(primaryPlan);
  }, [deliverFix, primaryPlan, save]);

  const busyLabel = (() => {
    switch (saveStep) {
      case 'convert':
        return tWorkspace('save.stepConvert');
      case 'compress':
        return tWorkspace('save.stepCompress');
      case 'cut':
        return tWorkspace('save.stepCut');
      case 'metadata':
        return tWorkspace('save.stepMetadata');
      case 'protect':
        return tWorkspace('save.stepProtect');
      case 'zip':
        return tWorkspace('save.stepZip');
      case 'export':
        return tWorkspace('save.stepExport');
      default:
        return fixing ? tWorkspace('fix.working') : t('saving');
    }
  })();
  const saveLabel = saveButtonLabelKey(saveDescription);
  const primaryProps: PrimaryButtonProps = {
    label: labelsFromSave(mode, saveDescription)
      ? messageByKey(tAll, saveLabel.key, saveLabel.values)
      : messageByKey(tAll, primary.labelKey, { count: selectedCount }),
    blockedReason: primaryBlocked,
    busy: saving || fixing !== null,
    busyLabel,
    onPrimary: runPrimary,
    onMore: () => openDialog(),
    onBlocked: block,
  };

  const chooseAnother = () => {
    settle();
    if (dirty && !window.confirm(t('discardConfirm'))) return;
    trackEvent('choose_another');
    onClose();
  };

  // Leaving with unsaved changes asks first.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ── Keyboard ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pausedRef = useRef(false);
  useLayoutEffect(() => {
    pausedRef.current = signatureOpen || sheetOpen || menuOpen;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target) || pausedRef.current) return;
      // Any modal on top, the delivery panel included (page.tsx owns it): the editor behind it stays as it is.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const s = stateRef.current;
      const key = event.key;
      const mod = event.ctrlKey || event.metaKey;
      if (mod && key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if (mod || event.altKey) return;
      const selected = s.selectedId ? s.doc.objects.find((o) => o.id === s.selectedId) : undefined;
      const onControl = event.target instanceof Element && event.target.closest('button, a, [role="menuitem"]');

      if ((key === 'Delete' || key === 'Backspace') && selected) {
        event.preventDefault();
        nudgeRef.current = null;
        setNudge(null);
        dispatch({ type: 'deleteObject', id: selected.id });
      } else if (key === 'Enter' && (selected?.kind === 'text' || selected?.kind === 'replace') && !onControl) {
        event.preventDefault();
        editText(selected.id);
      } else if (key === 'Escape') {
        if (selected) dispatch({ type: 'select', id: null });
        else if (s.tool !== 'select') dispatch({ type: 'setTool', tool: 'select' });
      } else if (ARROWS[key] && selected) {
        event.preventDefault();
        const base = nudgeRef.current?.id === selected.id ? nudgeRef.current : selected;
        const size = sizeOfPage(s.doc, base.pageId);
        const step = event.shiftKey ? 10 : 1;
        const [x, y] = ARROWS[key];
        const moved = translateObject(base, (x * step) / size.width, (y * step) / size.height);
        nudgeRef.current = moved;
        setNudge(moved);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (ARROWS[event.key]) commitNudge();
    };
    const onBlur = () => commitNudge();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [commitNudge, editText, redo, sizeOfPage, undo]);

  // A pending nudge belongs to the selected object; commit it when the selection moves on.
  useEffect(() => {
    if (nudgeRef.current && nudgeRef.current.id !== selectedId) commitNudge();
  }, [selectedId, commitNudge]);

  // ── Layout: canvas size from the area's width ──
  const [areaWidth, setAreaWidth] = useState(0);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => {
      const styles = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      if (inner > 0) setAreaWidth(Math.floor(inner));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // The canvas area only exists in the page view: measure it again when it comes back.
  }, [state.view]);

  const visual = pageVisualSize(page, sourcePages);
  const css = cssPageSize(areaWidth, zoom, visual);
  // Bound to the page being rendered: during a render the ref may still hold the previous doc (e.g. before a turn).
  const pageWidthPt = visual.width;
  const pageHeightPt = visual.height;
  const layoutOnPage = useCallback(
    (object: TextObject) => (fontReady ? layoutText(object.text, object.size, object.box.wPct * pageWidthPt) : null),
    [fontReady, layoutText, pageWidthPt],
  );
  const heightOnPage = useCallback(
    (object: TextObject) => textHeightOn({ width: pageWidthPt, height: pageHeightPt }, object),
    [pageHeightPt, pageWidthPt, textHeightOn],
  );
  const pageObjects = useMemo(
    () =>
      doc.objects
        .filter((o) => o.pageId === page.id)
        .map((o) => (nudge && o.id === nudge.id ? nudge : o)),
    [doc.objects, page.id, nudge],
  );

  // Created in the effect that destroys it, so StrictMode's mount-unmount-mount can't leave a dead one.
  const [renderer, setRenderer] = useState<ThumbnailRenderer | null>(null);
  useEffect(() => {
    const next = new ThumbnailRenderer(pdf);
    setRenderer(next);
    return () => next.destroy();
  }, [pdf]);

  const editingState: TextEditingState | null =
    editing && editing.object.pageId === page.id
      ? {
          object: editing.draft ? editing.object : ((doc.objects.find((o) => o.id === editing.object.id) as TextObject | undefined) ?? editing.object),
          value: editValue,
          onChange: changeEditValue,
          onDone: () => {
            commitEditing();
          },
        }
      : null;

  const replaceEditingState: ReplaceEditingState | null =
    replaceEditing && replaceEditing.object.pageId === page.id
      ? {
          object: replaceEditing.draft
            ? replaceEditing.object
            : ((doc.objects.find((o) => o.id === replaceEditing.object.id) as ReplaceObject | undefined) ?? replaceEditing.object),
          value: replaceValue,
          onChange: changeReplaceValue,
          onCommit: (viaEnter) => {
            commitReplace(viaEnter);
          },
          onCancel: cancelReplace,
        }
      : null;
  const layoutReplace = useCallback(
    (object: ReplaceObject, text: string) => (fontReady ? layoutText(text || ' ', object.size, 1e6, object.line.direction) : null),
    [fontReady, layoutText],
  );
  const layoutStamp = useCallback(
    (text: string, size: number, width?: number) => (fontReady ? layoutText(text || ' ', size, width ?? 1e6) : null),
    [fontReady, layoutText],
  );
  const watermarkAssetId = doc.stamps?.watermark?.type === 'image' ? doc.stamps.watermark.assetId : undefined;
  const watermarkImage = useMemo(
    () =>
      watermarkAssetId && assetUrls[watermarkAssetId] && assetSizes[watermarkAssetId]
        ? { url: assetUrls[watermarkAssetId], ...assetSizes[watermarkAssetId] }
        : undefined,
    [assetSizes, assetUrls, watermarkAssetId],
  );
  const logoAssetId = doc.stamps?.letterhead?.logoAssetId;
  // The page's own content as it will be saved under a letterhead: moved and shrunk to clear it
  const letterheadOnPage = doc.stamps?.letterhead && (doc.stamps.letterhead.pages === 'all' || pageIndex === 0) ? doc.stamps.letterhead : undefined;
  const pageRoom = useMemo(() => {
    if (!letterheadOnPage) return null;
    const extent = roomExtentOf(page, doc.objects);
    if (!extent) return null;
    const logoSize = letterheadOnPage.logoAssetId ? assetSizes[letterheadOnPage.logoAssetId] : undefined;
    const laid = previewLetterhead(letterheadOnPage, visual, logoSize, layoutStamp);
    return laid ? letterheadRoom(visual, laid.placed, extent) : null;
  }, [assetSizes, doc.objects, layoutStamp, letterheadOnPage, page, roomExtentOf, visual]);
  const letterheadLogo = useMemo(
    () => (logoAssetId && assetUrls[logoAssetId] && assetSizes[logoAssetId] ? { url: assetUrls[logoAssetId], ...assetSizes[logoAssetId] } : undefined),
    [assetSizes, assetUrls, logoAssetId],
  );
  const fontMetrics = useMemo(
    () => (engine && fontReady ? { ascent: engine.ascent, descent: engine.descent } : null),
    [engine, fontReady],
  );
  const refusedIds = refused && refused.doc === doc ? refused.ids : NO_IDS;
  const removedCount = removed && removed.doc === doc ? removed.count : 0;
  const replaceBlockedReason =
    replaceEngine === 'unsupported' ? t('disabled.replaceBrowser') : replaceEngine === 'unavailable' ? t('disabled.replace') : undefined;
  const rotateBlockedReason = pageHasReplace(doc, page.id) ? t('disabled.rotateReplaced') : undefined;

  // ── All tools: every feature from one place, each running the editor's own action ──
  /** Open: where the desktop panel hangs from the All tools button. */
  const [allTools, setAllTools] = useState<AllToolsPlace | null>(null);
  /** OCR asked for from All tools: its banner shows even on a file with text, with "read the text again". */
  const [ocrOpen, setOcrOpen] = useState(false);
  const closeAllTools = useCallback(() => setAllTools(null), []);
  const allTurnBlocked = doc.pages.every((p) => pageHasReplace(doc, p.id)) ? t('disabled.rotateReplaced') : undefined;
  const toolBlocked: Partial<Record<AllToolId, string>> = {
    turn: allTurnBlocked,
    delete: doc.pages.length <= 1 ? t('disabled.deletePage') : undefined,
    addPdf: inserting ? tWorkspace('insert.adding') : undefined,
    replace: replaceBlockedReason,
    ocr: ocrBlocked,
    repair: repairBlocked,
  };
  const showGrid = (focus: 'turn' | 'delete' | 'drag') => {
    setView('grid');
    setGridFocus(focus);
  };
  const toPage = () => {
    if (stateRef.current.view === 'grid') setView('page');
  };
  const runTool = (id: AllToolId) => {
    setAllTools(null);
    const patch = toolPlanPatch(id, primaryPlan);
    if (patch) {
      openDialog(id === 'password', patch);
      return;
    }
    switch (id) {
      case 'turn':
        return showGrid('turn');
      case 'delete':
        return showGrid('delete');
      case 'reorder':
        return showGrid('drag');
      case 'addPdf':
        return onInsert('pdf');
      case 'addBlank':
        return pageAction({ type: 'insertBlankPage', afterPageId: stateRef.current.currentPageId });
      case 'crop':
      case 'text':
      case 'draw':
      case 'highlight':
      case 'cover':
      case 'replace':
        return setTool(id);
      case 'shapes':
        return setTool('rectangle');
      case 'signature':
      case 'image':
      case 'date':
      case 'dateHijri':
      case 'watermark':
      case 'numbers':
      case 'letterhead':
        toPage();
        return onInsert(id);
      case 'ocr':
        setOcrDismissed(false);
        setOcrOpen(true);
        return;
      case 'repair':
        void runFix('repair');
        return;
    }
  };
  // tool_pick, counted at the click: the toolbar, its Insert menu, its second row and All tools (runTool calls setTool and onInsert itself, so they can't count)
  const pickToolbarTool = (next: EditorTool) => {
    trackEvent('tool_pick', { tool_id: next, surface: 'toolbar' });
    setTool(next);
  };
  const pickInsert = (kind: InsertKind) => {
    trackEvent('tool_pick', { tool_id: kind, surface: 'insert' });
    onInsert(kind);
  };
  const pickAllTool = (id: AllToolId) => {
    trackEvent('tool_pick', { tool_id: id, surface: 'all_tools' });
    runTool(id);
  };
  const pickFileTool = (id: AllToolId) => {
    trackEvent('tool_pick', { tool_id: id, surface: 'file_tools' });
    runTool(id);
  };

  // ── Status line ──
  const hint =
    tool === 'text'
      ? t('hint.text')
      : tool === 'draw'
        ? t('hint.draw')
        : tool === 'replace'
          ? replaceEngine === 'loading'
            ? t('replace.loading')
            : sourceIndex !== null && effectsPages.has(sourceIndex)
              ? `${t('replace.pageEffects')} ${t('replace.useCover')}`
              : t('replace.hint')
          : tool === 'select'
            ? null
            : tool === 'crop'
              ? tWorkspace('crop.hint')
              : t('hint.drag');
  /** workspace.save.errors.<code>, spelled out so every key is a literal. */
  const serverErrorText = (code: SaveError['code']): string => {
    switch (code) {
      case 'tooBig':
        return tWorkspace('save.errors.tooBig');
      case 'wordPages':
        return tWorkspace('save.errors.wordPages');
      case 'imagePages':
        return tWorkspace('save.errors.imagePages');
      case 'busy':
        return tWorkspace('save.errors.busy');
      case 'noText':
        return tWorkspace('save.errors.noText');
      case 'noImages':
        return tWorkspace('save.errors.noImages');
      case 'noTables':
        return tWorkspace('save.errors.noTables');
      default:
        return tWorkspace('save.errors.server');
    }
  };
  const failureText = !failure
    ? null
    : failure.kind === 'replaceRefused'
      ? t('replace.saveRefused', { page: failure.page })
      : failure.kind === 'server'
        ? serverErrorText(failure.code)
        : failure.kind === 'replaceFailed'
        ? t('replace.saveFailed')
        : failure.kind === 'replaceUnavailable'
          ? t('replace.saveUnavailable')
          : failure.kind === 'image'
            ? t('imageError')
            : t('saveError');
  const shownWarnings = warnings && warnings.doc === doc ? warnings.list : [];
  const overlapCount = new Set(
    shownWarnings.flatMap((w) => (w.code === 'OVERLAPS_ANNOTATION' ? [w.objectId] : [])),
  ).size;
  // A stamp saved as a picture ('stamp:watermark', 'stamp:pageNumbers') is not a text box.
  const textImageCount = new Set(
    shownWarnings.flatMap((w) => (w.code === 'TEXT_AS_IMAGE' && !w.objectId.startsWith('stamp:') ? [w.objectId] : [])),
  ).size;
  const formWarning = shownWarnings.some((w) => w.code === 'FORM_NOT_FLATTENED');

  const { ref: inViewRef, inView } = useInView();

  const sidePanel =
    tool === 'crop' ? (
      <CropPanel
        target={cropTarget}
        onTarget={changeCropTarget}
        selectedCount={state.selectedPageIds.length}
        hasCrop={!!page.crop}
        onRemove={() => applyCrop(null)}
        onClose={() => setTool('select')}
        onBlocked={block}
      />
    ) : stampPanel ? (
      <StampPanel
        key={stampPanel}
        kind={stampPanel}
        stamps={doc.stamps}
        onChange={setStamps}
        onChooseImage={(form) => {
          watermarkForm.current = form;
          openWatermarkPicker();
        }}
        imageUrl={doc.stamps?.watermark?.assetId ? assetUrls[doc.stamps.watermark.assetId] : undefined}
        onChooseLogo={(form) => {
          letterheadForm.current = form;
          openLogoPicker();
        }}
        logoUrl={doc.stamps?.letterhead?.logoAssetId ? assetUrls[doc.stamps.letterhead.logoAssetId] : undefined}
        onSaveFile={saveLetterheadFile}
        onOpenFile={() => letterheadFileInput.current?.click()}
        onClose={() => setStampPanel(null)}
      />
    ) : null;

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const selecting = planUsesSelection(primaryPlan);
  const hintKind = gridFocus ?? gridHint(mode, selecting);
  const gridHintText =
    hintKind === 'tick'
      ? tWorkspace('pages.tickHint')
      : hintKind === 'turn'
        ? tWorkspace('pages.turnHint')
        : hintKind === 'delete'
          ? tWorkspace('all.deleteHint')
          : tWorkspace('pages.dragHint');
  /** The task card has its own page-number field (extract-pages, a split by the selected pages): the grid doesn't repeat it. */
  const cardPicksPages = card === 'extract' || (card === 'split' && selecting);
  /** Enter in the task card's password field: the primary button, or why it can't act. */
  const submitPrimary = () => {
    if (saving || fixing) return;
    if (primaryBlocked) block(primaryBlocked);
    else runPrimary();
  };

  return (
    // Phones: room under the page for the bottom bar's two rows (the primary button, then undo and pages)
    <div ref={inViewRef} data-edit-pdf-workspace="" className="w-full min-w-0 pb-32 md:pb-0">
      <TaskHeader
        mode={mode}
        fileName={source.file.name}
        pageCount={doc.pages.length}
        bytes={source.file.size}
        allToolsOpen={allTools !== null}
        onAllTools={(button) => {
          settle();
          if (!allTools) trackEvent('all_tools_open');
          setAllTools(allTools ? null : allToolsPlace(button));
        }}
        onChooseAnother={chooseAnother}
      />
      {/* A scan gets the OCR offer on the pages about its text; elsewhere it would push an upload the page isn't for,
          unless All tools asked for it (then on any file, with "read the text again") */}
      {!ocrDismissed && (ocrOpen || (showsScanBanner(mode) && (scanned || modeConfig.panel === 'ocr'))) && (
        <>
          <OcrBanner
            expanded={modeConfig.panel === 'ocr' || ocrOpen}
            scanned={scanned}
            languages={ocrLanguages}
            onLanguages={setOcrLanguages}
            redo={ocrRedo}
            onRedo={setOcrRedo}
            blockedReason={ocrBlocked}
            busy={fixing === 'ocr'}
            error={fixError?.kind === 'ocr' ? fixError.text : null}
            onRun={() => void runFix('ocr')}
            onDismiss={() => setOcrDismissed(true)}
            onBlocked={block}
          />
          {/* The expanded banner has no Not now of its own (on /ocr-pdf it is the page's tool) */}
          {ocrOpen && modeConfig.panel !== 'ocr' && (
            <div className="-mt-1 mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setOcrOpen(false);
                  setOcrDismissed(true);
                }}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
              >
                {tWorkspace('fix.notNow')}
              </button>
            </div>
          )}
        </>
      )}
      {mode === 'unlock' && fixedBy === null && <FixNotice kind="notLocked" />}
      {mode === 'repair' && fixedBy === null && fixedVersion === 0 && (
        <FixNotice
          kind="opensFine"
          busy={fixing === 'repair'}
          error={fixError?.kind === 'repair' ? fixError.text : null}
          onRepair={() => void runFix('repair')}
        />
      )}
      {fixFirst && (
        <FixFirstPrompt
          kind={fixFirst.fix}
          busy={fixFirst.busy}
          error={fixFirst.error}
          onRun={() => void runFixFirst()}
          onCancel={() => setFixFirst(null)}
        />
      )}
      <Toolbar
        view={state.view}
        onView={setView}
        tool={tool}
        onTool={pickToolbarTool}
        onInsert={pickInsert}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        zoom={zoom}
        canZoomIn={canZoom(zoom, 1)}
        canZoomOut={canZoom(zoom, -1)}
        onZoom={(direction) => dispatch({ type: 'setZoom', zoom: stepZoom(zoom, direction) })}
        primary={primaryProps}
        onBlocked={block}
        onMenuOpenChange={setMenuOpen}
        replaceBlockedReason={replaceBlockedReason}
        fileTools={{ onPick: pickFileTool, blocked: toolBlocked }}
        pageTools={{
          selected: selectedCount,
          total: doc.pages.length,
          onSelectAll: () => dispatch({ type: 'setPageSelection', pageIds: doc.pages.map((p) => p.id) }),
          onClear: () => dispatch({ type: 'setPageSelection', pageIds: [] }),
          onTurn: turnSelected,
          turnBlockedReason: state.selectedPageIds.length > 0 && state.selectedPageIds.every((id) => pageHasReplace(doc, id)) ? t('disabled.rotateReplaced') : undefined,
          onDelete: () => pageAction({ type: 'deletePages', pageIds: state.selectedPageIds }),
          onAddBlank: () => pageAction({ type: 'insertBlankPage', afterPageId: page.id }),
        }}
      />
      {/* The page's own choices and what the save gives, in view rather than behind Options (the Save dialog keeps them too) */}
      {card && (
        <ModeTaskCard
          key={mode}
          card={card}
          plan={primaryPlan}
          onPlan={setDialogPlan}
          result={saveDescription}
          selectedCount={selectedCount}
          pageCount={doc.pages.length}
          onSelectPages={(indices) => dispatch({ type: 'setPageSelection', pageIds: indices.map((i) => doc.pages[i].id) })}
          onSubmit={submitPrimary}
        />
      )}

      <div className="mt-2 min-h-10 space-y-2 px-1 text-sm md:min-h-6" aria-live="polite">
        {failureText ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700" role="alert">
            <span className="flex-1">{failureText}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label={tCommon('dismiss')}
              className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : inserting ? (
          <p className="flex items-center gap-2 text-gray-600" role="status">
            <Loader2 className="h-4 w-4 animate-spin text-[#FF6B35]" aria-hidden="true" />
            {tWorkspace('insert.adding')}
          </p>
        ) : notice ? (
          // On a phone the reason shows above the bottom bar instead, where the tapped button is
          <p className="hidden text-gray-500 md:block">{notice}</p>
        ) : removedCount > 0 ? (
          <p className="text-green-700" role="status">
            {t('replace.removed', { count: removedCount })}
          </p>
        ) : hint ? (
          // Room for two lines on a phone, one on desktop: the cover note must not push the page down as the visitor aims
          <p className="text-gray-600">
            {hint}
            {tool === 'cover' && <span> · {t('coverNote')}</span>}
          </p>
        ) : null}
        {(overlapCount > 0 || textImageCount > 0 || formWarning) && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              {overlapCount > 0 && <p>{t('warnings.annotations', { count: overlapCount })}</p>}
              {textImageCount > 0 && <p>{t('warnings.textAsImage', { count: textImageCount })}</p>}
              {formWarning && <p>{t('warnings.form')}</p>}
            </div>
          </div>
        )}
        {insertNotice && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div className="flex-1 space-y-1">
              {insertNotice.skipped.length > 0 && <p>{tWorkspace('insert.skipped', { names: insertNotice.skipped.join(', ') })}</p>}
              {insertNotice.tooBig && <p>{tWorkspace('insert.tooBig')}</p>}
            </div>
            <button
              type="button"
              onClick={() => setInsertNotice(null)}
              aria-label={tCommon('dismiss')}
              className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* In the grid the toolbar holds these (pageTools) */}
      {selectionBar && state.view === 'page' && <div className="mt-2">{selectionBar}</div>}

      {state.view === 'grid' ? (
        <div className="mt-2 rounded-xl border border-orange-100 bg-white p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <p className="py-3 text-sm text-gray-500">{gridHintText}</p>
            {/* "1-3, 5, 8-10" for long files, where ticking page after page is slow (Add another PDF is in the toolbar) */}
            {!cardPicksPages && (
              <PageRangeField
                pageCount={doc.pages.length}
                onSelect={(indices) => dispatch({ type: 'setPageSelection', pageIds: indices.map((i) => doc.pages[i].id) })}
              />
            )}
          </div>
          {renderer && (
            <PageStrip
              layout="grid"
              size="large"
              pages={doc.pages}
              sourcePages={sourcePages}
              currentPageId={page.id}
              renderer={renderer}
              selectedIds={selectedPages}
              onActivate={togglePage}
              onToggle={togglePage}
              onOpen={openPage}
              onMove={movePageTo}
            />
          )}
        </div>
      ) : (
        <div className="mt-2 flex flex-col gap-4 md:flex-row">
          <aside
            aria-label={t('pages.title')}
            className="hidden w-32 shrink-0 overflow-y-auto rounded-xl border border-orange-100 bg-white/70 p-2 md:block md:max-h-[calc(100dvh-15rem)]"
          >
            {renderer && (
              <PageStrip
                layout="column"
                pages={doc.pages}
                sourcePages={sourcePages}
                currentPageId={page.id}
                renderer={renderer}
                selectedIds={selectedPages}
                onActivate={(pageId, shift) => (shift ? togglePage(pageId, true) : goToPage(pageId))}
                onToggle={togglePage}
              />
            )}
          </aside>

          <div className="min-w-0 flex-1">
            <div
              ref={areaRef}
              className="overflow-x-auto rounded-xl bg-gray-100 p-2 sm:p-4 md:max-h-[calc(100dvh-15rem)] md:overflow-auto md:p-6"
            >
              <div ref={pageRef} className="relative mx-auto bg-white shadow-lg" style={{ width: css.width, height: css.height }}>
                {page.source.kind === 'source' && css.width > 0 && (
                  <div
                    className="absolute inset-0"
                    style={
                      pageRoom
                        ? {
                            transform: `translate(${pageRoom.dx * (css.width / visual.width)}px, ${pageRoom.dy * (css.width / visual.width)}px) scale(${pageRoom.scale})`,
                            transformOrigin: '0 0',
                          }
                        : undefined
                    }
                  >
                    <PageCanvas
                      key={`canvas-${page.id}`}
                      pdf={pdf}
                      sourceIndex={page.source.index}
                      rotation={(sourcePages[page.source.index].rotate + page.rotation) % 360}
                      cssWidth={css.width}
                      cssHeight={css.height}
                    />
                  </div>
                )}
                {css.width > 0 && (
                  <ObjectLayer
                    key={`layer-${page.id}`}
                    pageId={page.id}
                    pageSize={visual}
                    cssWidth={css.width}
                    cssHeight={css.height}
                    objects={pageObjects}
                    selectedId={selectedId}
                    tool={tool}
                    style={style}
                    rtl={rtl}
                    assetUrls={assetUrls}
                    layoutFor={layoutOnPage}
                    textHeightPct={heightOnPage}
                    editing={editingState}
                    newObjectId={newObjectId}
                    onBeforePress={settle}
                    onAdd={add}
                    onReplace={replace}
                    onSelect={(id) => dispatch({ type: 'select', id })}
                    onDelete={(id) => dispatch({ type: 'deleteObject', id })}
                    onStartText={startText}
                    onEditText={editText}
                    onStyle={(patch) => dispatch({ type: 'setStyle', patch })}
                    replace={{
                      lines: pageLines,
                      pageRefused: sourceIndex !== null && effectsPages.has(sourceIndex),
                      rotation: page.rotation,
                      pendingLineId,
                      refusedIds,
                      editing: replaceEditingState,
                      layoutFor: layoutReplace,
                      metrics: fontMetrics,
                      previews,
                      onPick: (pick) => void pickLine(pick),
                    }}
                  />
                )}
                {css.width > 0 && doc.stamps && (
                  <StampPreview
                    stamps={doc.stamps}
                    page={page}
                    sourcePages={sourcePages}
                    outputIndex={pageIndex}
                    outputCount={doc.pages.length}
                    pxPerPt={css.width / visual.width}
                    layoutFor={layoutStamp}
                    image={watermarkImage}
                    logo={letterheadLogo}
                  />
                )}
                {css.width > 0 && (
                  <CropLayer
                    key={`crop-${page.id}`}
                    crop={page.crop}
                    active={tool === 'crop'}
                    pageSize={visual}
                    cssWidth={css.width}
                    cssHeight={css.height}
                    onCrop={applyCrop}
                    onTooSmall={() => block(tWorkspace('crop.tooSmall'))}
                  />
                )}
              </div>
            </div>

            <div className="mt-3 hidden md:block">
              <PageActions
                index={pageIndex}
                count={doc.pages.length}
                onGo={goRelative}
                onRotate={() => pageAction({ type: 'rotatePage', pageId: page.id })}
                onMove={(delta) => pageAction({ type: 'movePage', pageId: page.id, delta })}
                onAddBlank={() => pageAction({ type: 'insertBlankPage', afterPageId: page.id })}
                onDelete={() => pageAction({ type: 'deletePage', pageId: page.id })}
                onBlocked={block}
                rotateBlockedReason={rotateBlockedReason}
              />
            </div>
          </div>

          {/* The tool's panel: beside the page on desktop, under it on a phone (the page stays in view) */}
          {sidePanel && (
            <div className="md:w-72 md:shrink-0 md:overflow-y-auto md:max-h-[calc(100dvh-15rem)]">{sidePanel}</div>
          )}
        </div>
      )}

      {/* Phone, while the editor is on screen: the primary button on a row of its own (its label always shows:
          a bare floppy icon says nothing about "Convert to Word"), then undo, redo, page navigation and Pages */}
      {inView &&
        createPortal(
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-sm md:hidden">
            {/* Why a dimmed button did nothing: the status line at the top can be scrolled out of view */}
            <p role="status" className={notice ? 'px-2 pb-0.5 text-center text-xs text-gray-500' : 'sr-only'}>
              {notice}
            </p>
            <div className="mx-auto max-w-md pt-0.5">
              <PrimaryButton {...primaryProps} wide />
            </div>
            <div className="mx-auto flex max-w-md items-center justify-between gap-0.5">
              <ActionButton
                label={t('undo')}
                icon={<Undo2 className="h-5 w-5 rtl:-scale-x-100" />}
                onClick={undo}
                blockedReason={canUndo ? undefined : t('disabled.undo')}
                onBlocked={block}
              />
              <ActionButton
                label={t('redo')}
                icon={<Redo2 className="h-5 w-5 rtl:-scale-x-100" />}
                onClick={redo}
                blockedReason={canRedo ? undefined : t('disabled.redo')}
                onBlocked={block}
              />
              <div className="flex items-center">
                <ActionButton
                  label={t('pages.prev')}
                  icon={<ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />}
                  onClick={() => goRelative(-1)}
                  blockedReason={pageIndex > 0 ? undefined : t('disabled.moveEarlier')}
                  onBlocked={block}
                />
                <span className="min-w-[2.75rem] text-center text-sm tabular-nums text-gray-700">
                  <span aria-hidden="true">
                    {pageIndex + 1}/{doc.pages.length}
                  </span>
                  <span className="sr-only">{t('pages.pageOf', { current: pageIndex + 1, total: doc.pages.length })}</span>
                </span>
                <ActionButton
                  label={t('pages.next')}
                  icon={<ChevronRight className="h-5 w-5 rtl:-scale-x-100" />}
                  onClick={() => goRelative(1)}
                  blockedReason={pageIndex < doc.pages.length - 1 ? undefined : t('disabled.moveLater')}
                  onBlocked={block}
                />
              </div>
              <ActionButton label={t('pages.title')} icon={<LayoutGrid className="h-5 w-5" />} onClick={() => setSheetOpen(true)} />
            </div>
          </div>,
          document.body,
        )}

      {sheetOpen && (
        <PagesSheet title={t('pages.title')} closeLabel={tCommon('dismiss')} onClose={() => setSheetOpen(false)} notice={notice}>
          <PageActions
            hideNavigation
            index={pageIndex}
            count={doc.pages.length}
            onGo={goRelative}
            onRotate={() => pageAction({ type: 'rotatePage', pageId: page.id })}
            onMove={(delta) => pageAction({ type: 'movePage', pageId: page.id, delta })}
            onAddBlank={() => pageAction({ type: 'insertBlankPage', afterPageId: page.id })}
            onDelete={() => pageAction({ type: 'deletePage', pageId: page.id })}
            onBlocked={block}
            rotateBlockedReason={rotateBlockedReason}
          />
          {selectionBar && <div className="mt-1">{selectionBar}</div>}
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-1 pb-2">
            {renderer && (
              <PageStrip
                layout="grid"
                pages={doc.pages}
                sourcePages={sourcePages}
                currentPageId={page.id}
                renderer={renderer}
                selectedIds={selectedPages}
                onActivate={(pageId, shift) => {
                  if (shift) return togglePage(pageId, true);
                  openPage(pageId);
                  setSheetOpen(false);
                }}
                onToggle={togglePage}
              />
            )}
          </div>
        </PagesSheet>
      )}

      {allTools && <AllToolsPanel place={allTools} blocked={toolBlocked} onPick={pickAllTool} onClose={closeAllTools} />}

      {dialog && (
        <SaveDialog
          initialPlan={dialog.plan}
          focusPassword={dialog.focusPassword}
          ctx={planContext}
          saveContext={saveContext}
          summary={summary}
          onClearCrops={() => dispatch({ type: 'clearCrops' })}
          onRemoveWatermark={() => dispatch({ type: 'setStamps', stamps: { ...doc.stamps, watermark: undefined } })}
          onRemovePageNumbers={() => dispatch({ type: 'setStamps', stamps: { ...doc.stamps, pageNumbers: undefined } })}
          onRemoveLetterhead={() => dispatch({ type: 'setStamps', stamps: { ...doc.stamps, letterhead: undefined } })}
          onTurnBack={() => dispatch({ type: 'resetRotations' })}
          onSave={(plan) => {
            setDialog(null);
            setDialogPlan(plan);
            void save(plan);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {signatureOpen && (
        <SignatureDialog
          initialValue={lastSignature}
          onCancel={() => setSignatureOpen(false)}
          onPlace={(dataUrl) => {
            setSignatureOpen(false);
            setLastSignature(dataUrl);
            void insertPicture(dataUrlToBlob(dataUrl), true);
          }}
        />
      )}

      <input {...getInputProps()} />
      <input {...getWatermarkInputProps()} />
      <input {...getLogoInputProps()} />
      <input
        ref={letterheadFileInput}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void openLetterheadFile(file);
        }}
      />
      <input {...getPdfInputProps()} />
    </div>
  );
}

/** The phone's Pages sheet: page tools and a thumbnail grid, from the bottom. */
function PagesSheet({
  title,
  closeLabel,
  notice,
  onClose,
  children,
}: {
  title: string;
  closeLabel: string;
  notice: string | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  return createPortal(
    <div className="fixed inset-0 z-[55] md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 flex max-h-[70dvh] flex-col rounded-t-2xl bg-white px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="px-1 text-base font-bold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
        {notice && <p className="px-1 pt-1 text-center text-sm text-gray-500">{notice}</p>}
      </div>
    </div>,
    document.body,
  );
}
