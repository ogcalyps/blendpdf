'use client';

/**
 * Everything the visitor adds, over the page canvas: drawing the objects,
 * creating them (tap or drag with the active tool), selecting, moving,
 * resizing, and the mini-bar on the selection.
 *
 * Objects are placed in % of the page from their fractions. Shapes, lines,
 * arrows and ink are SVG in page POINTS (viewBox = the visual page in
 * points), so strokes scale with the zoom exactly as they will print.
 *
 * Pointer events with setPointerCapture. Objects and handles are always
 * touch-action: none; the page itself only while a creation tool is on, so
 * with Select the page scrolls and pinch-zooms normally on a phone.
 *
 * One history entry per gesture: moves and resizes live in local state while
 * the pointer moves and are committed once on pointer up.
 *
 * Edit text (beta): with that tool on, the line under the mouse is outlined
 * (on touch screens every line that can be changed gets a faint dashed
 * underline instead) and a tap on a line asks the workspace to open its box.
 * The page keeps normal touch scrolling with this tool: a line is chosen by a
 * tap, not a drag. From the keyboard the page is one tab stop: the up and
 * down arrows move through the lines, Enter picks one, and after Enter or
 * Escape in the field the focus comes back to the changed line (or the page).
 * Changed lines (ReplaceBox) are anchored: they can be selected, never moved
 * or resized. Each shows the engine's render of what the save will write
 * (keep-font-spec.md section 8: its own font, else the closest look-alike),
 * asked for through the workspace's ReplacePreviewStore after every change;
 * the field's note and the mini-bar's Smaller/Bigger read the same render.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { flushSync } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  COVER_COLOR,
  HIGHLIGHT_COLOR,
  STROKE_WIDTHS,
  TEXT_SIZES,
  arrowHeadArms,
  lineBlock,
  lineBoxAt,
  objectBounds,
  type AssetId,
  type EditorObject,
  type ObjectId,
  type PagePoint,
  type PageId,
  type PageSize,
  type PaletteColor,
  type QuarterTurn,
  type ReplaceObject,
  type SourceTextLine,
  type TextBoxLayout,
  type TextObject,
  type VisualBox,
} from '@/lib/edit-pdf';
import {
  LINE_TAP_SLOP_PX,
  boxAround,
  boxFromPoints,
  clamp,
  isDrag,
  lineAround,
  lineAt,
  placeMiniBar,
  pointerToFraction,
  resizeBox,
  resizeTextWidth,
  shouldAddInkPoint,
  stepIn,
  textBoxAt,
  translateObject,
  withBounds,
  type Corner,
  type Rect,
} from './interaction';
import { ONE_SHOT_TOOLS, replaceSizeLimits, shownReplaceSize, stepReplaceObjectSize, type EditorStyle, type EditorTool } from './state';
import { fieldChoice, previewKey, previewPixelRatio, previewSize, type ReplacePreviewStore } from './replace-preview';
import { TextBox } from './TextBox';
import { MiniBar } from './MiniBar';
import { ReplaceBox } from './ReplaceBox';
import { ReplaceField } from './ReplaceField';

type Handle = Corner | 'w' | 'e' | 'from' | 'to';

type Gesture =
  | { kind: 'create-box'; tool: 'rectangle' | 'ellipse' | 'highlight' | 'cover'; start: PagePoint; current: PagePoint; pointerId: number }
  | { kind: 'create-line'; arrow: boolean; start: PagePoint; current: PagePoint; pointerId: number }
  | { kind: 'ink'; points: number[]; pointerId: number }
  | { kind: 'text-tap'; start: PagePoint; pointerId: number }
  | { kind: 'replace-tap'; start: PagePoint; pointerId: number; touch: boolean }
  | {
      kind: 'move' | 'resize';
      handle?: Handle;
      original: EditorObject;
      current: EditorObject;
      startX: number;
      startY: number;
      moved: boolean;
      wasSelected: boolean;
      pointerId: number;
    };

export interface TextEditingState {
  object: TextObject;
  value: string;
  onChange: (value: string) => void;
  onDone: () => void;
}

/** A changed line being typed: a draft (not in the doc yet) or an existing one reopened. */
export interface ReplaceEditingState {
  object: ReplaceObject;
  value: string;
  onChange: (value: string) => void;
  /** Enter (`viaEnter`) or leaving the field. */
  onCommit: (viaEnter: boolean) => void;
  /** Escape. */
  onCancel: () => void;
}

/** What a tap with Edit text landed on: a line that can be changed, one that can't (and why is the workspace's call), or nothing. */
export type LinePick = { kind: 'line'; line: SourceTextLine } | { kind: 'blocked'; line: SourceTextLine } | null;

export interface ReplaceLayerProps {
  /** This page's detected lines; null while detection runs, or on a page that isn't from the file. */
  lines: readonly SourceTextLine[] | null;
  /** The page changes when rewritten (the removal check said so): its lines are not offered. */
  pageRefused: boolean;
  /** The page's turns added in the editor (detected boxes are at turn 0). */
  rotation: QuarterTurn;
  /** The line whose removal check is running (kept outlined). */
  pendingLineId: string | null;
  /** Changed lines the last save refused (red outline). */
  refusedIds: ReadonlySet<ObjectId>;
  editing: ReplaceEditingState | null;
  /** The engine's layout of a changed line's text at its size (null until the engine and its font are ready). */
  layoutFor: (object: ReplaceObject, text: string) => TextBoxLayout | null;
  /** Cairo's ascent and descent in em, once the editor font is registered. */
  metrics: { ascent: number; descent: number } | null;
  /** The engine's renders of changed lines (keep-font-spec.md section 8), shared across pages. */
  previews: ReplacePreviewStore;
  onPick: (pick: LinePick) => void;
}

interface ObjectLayerProps {
  pageId: PageId;
  /** The visual page in points. */
  pageSize: PageSize;
  cssWidth: number;
  cssHeight: number;
  /** This page's objects in z-order. */
  objects: readonly EditorObject[];
  selectedId: ObjectId | null;
  tool: EditorTool;
  style: EditorStyle;
  rtl: boolean;
  assetUrls: Readonly<Record<AssetId, string>>;
  /** The engine's layout for a text object (null until the engine and its font are ready). */
  layoutFor: (object: TextObject) => TextBoxLayout | null;
  /** box.hPct for a text object at its current size and width. */
  textHeightPct: (object: TextObject) => number;
  /** The text box being typed in (a new draft, or an existing object). */
  editing: TextEditingState | null;
  newObjectId: () => ObjectId;
  /** Called first on any press on the page: commits a text being typed. */
  onBeforePress: () => void;
  onAdd: (object: EditorObject, toolAfter: EditorTool) => void;
  onReplace: (object: EditorObject) => void;
  onSelect: (id: ObjectId | null) => void;
  onDelete: (id: ObjectId) => void;
  onStartText: (box: VisualBox) => void;
  onEditText: (id: ObjectId) => void;
  onStyle: (patch: Partial<EditorStyle>) => void;
  /** Edit text (beta): the page's lines and the changed line being typed. */
  replace: ReplaceLayerProps;
}

/** Pointer is a finger: bigger invisible hit strokes. */
const coarsePointer = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
/** No hover (a touch screen): Edit text underlines every line it can change instead of outlining the one under the mouse. */
const noHover = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(hover: none)').matches);

const LINE_OUTLINE = { outline: '2px solid #FF6B35', background: 'rgba(255, 107, 53, 0.1)', borderRadius: 2 } as const;
const LINE_UNDERLINE = { borderBottom: '1.5px dashed rgba(255, 107, 53, 0.55)' } as const;

function StrokeShape({
  object,
  pageSize,
  hitWidth,
  interactive,
  hitProps,
}: {
  object: Extract<EditorObject, { kind: 'shape' | 'line' | 'ink' }>;
  pageSize: PageSize;
  hitWidth: number;
  interactive: boolean;
  hitProps?: HTMLAttributes<SVGElement>;
}) {
  const W = pageSize.width;
  const H = pageSize.height;
  let d: string;
  if (object.kind === 'shape') {
    const b = object.box;
    const x = b.xPct * W;
    const y = b.yPct * H;
    const w = b.wPct * W;
    const h = b.hPct * H;
    if (object.shape === 'rectangle') {
      d = `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    } else {
      const rx = w / 2;
      const ry = h / 2;
      d = `M${x} ${y + ry}A${rx} ${ry} 0 1 0 ${x + w} ${y + ry}A${rx} ${ry} 0 1 0 ${x} ${y + ry}Z`;
    }
  } else if (object.kind === 'line') {
    const from = { x: object.from.x * W, y: object.from.y * H };
    const to = { x: object.to.x * W, y: object.to.y * H };
    d = `M${from.x} ${from.y}L${to.x} ${to.y}`;
    if (object.arrow) {
      const [a, b] = arrowHeadArms(from, to, object.strokeWidth);
      d += `M${a.x} ${a.y}L${to.x} ${to.y}L${b.x} ${b.y}`;
    }
  } else {
    const p = object.points;
    d = '';
    for (let i = 0; i + 1 < p.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${p[i] * W} ${p[i + 1] * H}`;
    if (p.length === 2) d += `L${p[0] * W} ${p[1] * H}`;
  }
  return (
    <svg
      className="absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      // touch-action on the root too: Chrome ignores it on SVG children, so a finger on the stroke would pan
      // the page and cancel the drag. The root takes no pointer events, so the rest of the page still scrolls.
      style={{ pointerEvents: 'none', touchAction: interactive ? 'none' : undefined }}
      aria-hidden={interactive ? undefined : true}
    >
      <path
        d={d}
        fill="none"
        stroke={object.color}
        strokeWidth={object.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {interactive && (
        <path
          {...hitProps}
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(object.strokeWidth, hitWidth)}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: 'stroke', touchAction: 'none', cursor: 'move', outline: 'none' }}
        />
      )}
    </svg>
  );
}

export function ObjectLayer(props: ObjectLayerProps) {
  const {
    pageId,
    pageSize,
    cssWidth,
    cssHeight,
    objects,
    selectedId,
    tool,
    style,
    rtl,
    assetUrls,
    layoutFor,
    textHeightPct,
    editing,
    newObjectId,
    onBeforePress,
    onAdd,
    onReplace,
    onSelect,
    onDelete,
    onStartText,
    onEditText,
    onStyle,
    replace,
  } = props;
  const t = useTranslations('editPdf');
  const overlayRef = useRef<HTMLDivElement>(null);
  const rectRef = useRef<Rect>({ left: 0, top: 0, width: 1, height: 1 });
  const gestureRef = useRef<Gesture | null>(null);
  const [gesture, setGestureState] = useState<Gesture | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [barSize, setBarSize] = useState({ width: 200, height: 52 });
  const pxPerPt = pageSize.width > 0 ? cssWidth / pageSize.width : 1;
  const hitWidth = (coarsePointer() ? 44 : 20) / pxPerPt;
  // Changed lines: re-render when a preview comes back; every request is at this page's zoom.
  const previews = replace.previews;
  useSyncExternalStore(previews.subscribe, previews.getVersion, previews.getVersion);
  const pixelRatio = previewPixelRatio(typeof window === 'undefined' ? 1 : window.devicePixelRatio);
  const previewRequest = useMemo(() => ({ pxPerPt, pixelRatio }), [pixelRatio, pxPerPt]);
  /** The size a changed line shows at (the engine's resolved size while autoSize is on). */
  const shownSizeOf = (object: ReplaceObject) =>
    shownReplaceSize(object, previewSize(previews.view(object, object.text, previewRequest)));
  const selecting = tool === 'select';
  const replacing = tool === 'replace';
  const [touchUi] = useState(noHover);
  const [hoverLineId, setHoverLineId] = useState<string | null>(null);
  /** The line the arrow keys are on, while the page has the focus. */
  const [keyLineId, setKeyLineId] = useState<string | null>(null);
  /** After Enter or Escape in the field: the changed line to focus (or the page, when there is none). */
  const focusAfterRef = useRef<ObjectId | null>(null);
  useLayoutEffect(() => {
    const id = focusAfterRef.current;
    if (!id || replace.editing) return;
    focusAfterRef.current = null;
    const box = overlayRef.current?.querySelector<HTMLElement>(`[data-replace-id="${CSS.escape(id)}"]`);
    (box ?? overlayRef.current)?.focus({ preventScroll: true });
  });
  /**
   * Touch screens: the line's removal check runs before its field opens, and
   * iOS only shows the keyboard for a focus() inside the tap. So the tap
   * focuses this hidden input (keyboard up), the field takes the focus over
   * when it opens, and if the check refuses the line the input lets go
   * (keyboard down).
   */
  const primerRef = useRef<HTMLInputElement>(null);
  const primedRef = useRef(false);
  useEffect(() => {
    if (!primedRef.current || replace.pendingLineId) return;
    primedRef.current = false;
    if (document.activeElement === primerRef.current) primerRef.current?.blur();
  }, [replace.pendingLineId, replace.editing]);

  const setGesture = (next: Gesture | null) => {
    gestureRef.current = next;
    setGestureState(next);
  };

  const label = (object: EditorObject): string => {
    switch (object.kind) {
      case 'text': {
        // What the box says, so a screen reader can tell the boxes apart
        const chars = Array.from(object.text.replace(/\s+/g, ' ').trim());
        const excerpt = chars.length > 40 ? `${chars.slice(0, 40).join('').trimEnd()}…` : chars.join('');
        return excerpt ? `${t('tools.text')}: ${excerpt}` : t('tools.text');
      }
      case 'image':
        return object.signature ? t('tools.signature') : t('tools.image');
      case 'shape':
        return object.shape === 'rectangle' ? t('tools.rectangle') : t('tools.ellipse');
      case 'line':
        return object.arrow ? t('tools.arrow') : t('tools.line');
      case 'ink':
        return t('tools.draw');
      case 'highlight':
        return t('tools.highlight');
      case 'replace': {
        const chars = Array.from(object.text.replace(/\s+/g, ' ').trim());
        const excerpt = chars.length > 40 ? `${chars.slice(0, 40).join('').trimEnd()}…` : chars.join('');
        return excerpt ? `${t('replace.changedLine')}: ${excerpt}` : t('replace.changedLine');
      }
      default:
        return t('tools.cover');
    }
  };

  const snapshotRect = () => {
    const r = overlayRef.current?.getBoundingClientRect();
    if (r) rectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
  };

  const capture = (e: ReactPointerEvent<Element>) => {
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // The pointer may already be gone.
    }
  };

  const toPoint = (clientX: number, clientY: number) => pointerToFraction(clientX, clientY, rectRef.current);

  // ── Creation, on the page itself ───────────────────────────────────────
  const onPagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Crop draws on its own layer above this one (CropLayer).
    if (tool === 'crop') return;
    onBeforePress();
    if (selecting) {
      onSelect(null);
      return;
    }
    if (replacing) {
      // A tap picks a line on pointer up; a drag scrolls the page (touch-action stays auto with this tool).
      onSelect(null);
      e.preventDefault();
      snapshotRect();
      capture(e);
      setGesture({ kind: 'replace-tap', start: toPoint(e.clientX, e.clientY), pointerId: e.pointerId, touch: e.pointerType !== 'mouse' });
      return;
    }
    // Keep focus where it is and stop the emulated mouse events (they would blur a new text box).
    e.preventDefault();
    snapshotRect();
    capture(e);
    const p = toPoint(e.clientX, e.clientY);
    switch (tool) {
      case 'text':
        setGesture({ kind: 'text-tap', start: p, pointerId: e.pointerId });
        break;
      case 'draw':
        setGesture({ kind: 'ink', points: [p.x, p.y], pointerId: e.pointerId });
        break;
      case 'line':
      case 'arrow':
        setGesture({ kind: 'create-line', arrow: tool === 'arrow', start: p, current: p, pointerId: e.pointerId });
        break;
      default:
        setGesture({ kind: 'create-box', tool, start: p, current: p, pointerId: e.pointerId });
    }
  };

  // ── Move and resize, on an object or a handle ──────────────────────────
  const startObjectGesture = (
    e: ReactPointerEvent<Element>,
    object: EditorObject,
    kind: 'move' | 'resize',
    handle?: Handle,
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const typingId = editing?.object.id ?? replace.editing?.object.id;
    if (typingId && typingId !== object.id) onBeforePress();
    const wasSelected = selectedId === object.id;
    if (!wasSelected) onSelect(object.id);
    (e.currentTarget as HTMLElement | SVGElement).focus?.({ preventScroll: true });
    snapshotRect();
    capture(e);
    setGesture({
      kind,
      handle,
      original: object,
      current: object,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      wasSelected,
      pointerId: e.pointerId,
    });
  };

  /** Edit text, mouse only: the line under the pointer. */
  const hoverAt = (clientX: number, clientY: number) => {
    const r = overlayRef.current?.getBoundingClientRect();
    if (!r || !replace.lines) return;
    const p = pointerToFraction(clientX, clientY, { left: r.left, top: r.top, width: r.width, height: r.height });
    const id = replace.pageRefused ? null : (lineAt(replace.lines, p, replace.rotation, pageSize)?.id ?? null);
    if (id !== hoverLineId) setHoverLineId(id);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g && replacing && e.pointerType === 'mouse') {
      hoverAt(e.clientX, e.clientY);
      return;
    }
    if (!g || e.pointerId !== g.pointerId) return;
    const { width, height } = rectRef.current;
    switch (g.kind) {
      case 'ink': {
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
        const samples = events.length > 0 ? events : [e.nativeEvent];
        const points = g.points.slice();
        for (const sample of samples) {
          const p = toPoint(sample.clientX, sample.clientY);
          const last = { x: points[points.length - 2], y: points[points.length - 1] };
          if (shouldAddInkPoint(last, p, width, height)) points.push(p.x, p.y);
        }
        if (points.length !== g.points.length) setGesture({ ...g, points });
        break;
      }
      case 'create-box':
      case 'create-line':
        setGesture({ ...g, current: toPoint(e.clientX, e.clientY) });
        break;
      case 'move':
      case 'resize': {
        const dx = (e.clientX - g.startX) / width;
        const dy = (e.clientY - g.startY) / height;
        const moved = g.moved || isDrag({ x: 0, y: 0 }, { x: dx, y: dy }, width, height);
        if (!moved) return;
        setGesture({ ...g, moved, current: transform(g.original, g.kind, g.handle, dx, dy) });
        break;
      }
      default:
        break;
    }
  };

  const transform = (original: EditorObject, kind: 'move' | 'resize', handle: Handle | undefined, dx: number, dy: number) => {
    if (kind === 'move' || !handle) return translateObject(original, dx, dy);
    if (original.kind === 'line' && (handle === 'from' || handle === 'to')) {
      const p = original[handle];
      return { ...original, [handle]: { x: clamp(p.x + dx, 0, 1), y: clamp(p.y + dy, 0, 1) } };
    }
    if (original.kind === 'text' && (handle === 'w' || handle === 'e')) {
      const resized = { ...original, box: resizeTextWidth(original.box, handle, dx, pageSize.width) };
      return { ...resized, box: { ...resized.box, hPct: textHeightPct(resized) } };
    }
    if (handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se') {
      const box = resizeBox(objectBounds(original), handle, dx, dy, {
        keepAspect: original.kind === 'image',
        page: pageSize,
      });
      return withBounds(original, box);
    }
    return original;
  };

  const finish = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    setGesture(null);
    if (cancelled) return;
    const { width, height } = rectRef.current;
    const next: EditorTool = ONE_SHOT_TOOLS.includes(tool) ? 'select' : tool;
    switch (g.kind) {
      case 'text-tap': {
        const lineH = textHeightPct({
          id: '',
          pageId,
          kind: 'text',
          text: ' ',
          size: style.textSize,
          color: style.textColor,
          box: { xPct: 0, yPct: 0, wPct: 0.4, hPct: 0 },
        });
        const box = textBoxAt(g.start, 0.4, lineH, rtl);
        // Synchronously, so the textarea is focused inside this tap (iOS opens the keyboard only then).
        flushSync(() => onStartText(box));
        break;
      }
      case 'ink': {
        const points = g.points.length === 2 ? [...g.points, ...g.points] : g.points;
        onAdd({ id: newObjectId(), pageId, kind: 'ink', points, color: style.strokeColor, strokeWidth: style.strokeWidth }, next);
        break;
      }
      case 'create-line': {
        const ends = isDrag(g.start, g.current, width, height) ? { from: g.start, to: g.current } : lineAround(g.start, 0.2);
        onAdd(
          { id: newObjectId(), pageId, kind: 'line', ...ends, arrow: g.arrow, color: style.strokeColor, strokeWidth: style.strokeWidth },
          next,
        );
        break;
      }
      case 'create-box': {
        const dragged = isDrag(g.start, g.current, width, height);
        if (g.tool === 'highlight' || g.tool === 'cover') {
          if (!dragged) return;
          onAdd({ id: newObjectId(), pageId, kind: g.tool, box: boxFromPoints(g.start, g.current) }, next);
          return;
        }
        const box = dragged ? boxFromPoints(g.start, g.current) : boxAround(g.start, 0.2, 0.1);
        onAdd(
          { id: newObjectId(), pageId, kind: 'shape', shape: g.tool, box, color: style.strokeColor, strokeWidth: style.strokeWidth },
          next,
        );
        break;
      }
      case 'replace-tap': {
        if (isDrag(g.start, toPoint(e.clientX, e.clientY), width, height)) return;
        const lines = replace.lines ?? [];
        // A finger is wide and lines are thin at phone size: a tap just beside a line still picks it.
        const slop = g.touch ? LINE_TAP_SLOP_PX / pxPerPt : 0;
        const line = lineAt(lines, g.start, replace.rotation, pageSize, undefined, slop);
        if (line) {
          const primer = primerRef.current;
          if (touchUi && primer) {
            // On the tapped spot, so a browser that scrolls a focused input into view has nowhere to go.
            primer.style.left = `${g.start.x * 100}%`;
            primer.style.top = `${g.start.y * 100}%`;
            primedRef.current = true;
            primer.focus({ preventScroll: true });
          }
          replace.onPick({ kind: 'line', line });
        } else {
          const blocked = lineAt(lines, g.start, replace.rotation, pageSize, () => true, slop);
          replace.onPick(blocked ? { kind: 'blocked', line: blocked } : null);
        }
        break;
      }
      case 'move':
      case 'resize': {
        if (g.moved) {
          if (g.current !== g.original) onReplace(g.current);
        } else if (
          g.kind === 'move' &&
          (g.original.kind === 'text' || g.original.kind === 'replace') &&
          (g.wasSelected || (g.original.kind === 'text' && g.original.text === ''))
        ) {
          // A tap on a text box or a changed line that was already selected, or on an empty box: type in it.
          flushSync(() => onEditText(g.original.id));
        }
        break;
      }
      default:
        break;
    }
  };

  // ── What to draw ───────────────────────────────────────────────────────
  const live = gesture && (gesture.kind === 'move' || gesture.kind === 'resize') && gesture.moved ? gesture.current : null;
  const shown = live ? objects.map((o) => (o.id === live.id ? live : o)) : objects;
  const editingId = editing?.object.id ?? null;
  const replaceEditing = replace.editing;
  /** Select picks anything; Edit text picks changed lines (to restyle them or keep the original). */
  const pickable = (o: EditorObject) => selecting || (replacing && o.kind === 'replace');
  const selected = !editing && !replaceEditing ? shown.find((o) => o.id === selectedId && pickable(o)) ?? null : null;

  const preview: EditorObject | null = useMemo(() => {
    if (!gesture) return null;
    const base = { id: '__preview', pageId };
    switch (gesture.kind) {
      case 'ink':
        return { ...base, kind: 'ink', points: gesture.points.length === 2 ? [...gesture.points, ...gesture.points] : gesture.points, color: style.strokeColor, strokeWidth: style.strokeWidth };
      case 'create-line':
        return { ...base, kind: 'line', from: gesture.start, to: gesture.current, arrow: gesture.arrow, color: style.strokeColor, strokeWidth: style.strokeWidth };
      case 'create-box': {
        const box = boxFromPoints(gesture.start, gesture.current);
        if (gesture.tool === 'highlight' || gesture.tool === 'cover') return { ...base, kind: gesture.tool, box };
        return { ...base, kind: 'shape', shape: gesture.tool, box, color: style.strokeColor, strokeWidth: style.strokeWidth };
      }
      default:
        return null;
    }
  }, [gesture, pageId, style.strokeColor, style.strokeWidth]);

  const renderObject = (object: EditorObject, interactive: boolean) => {
    const hit = {
      role: 'button',
      tabIndex: interactive ? 0 : -1,
      'aria-label': label(object),
      'aria-pressed': object.id === selectedId,
      onPointerDown: (e: ReactPointerEvent<Element>) => startObjectGesture(e, object, 'move'),
      onFocus: () => {
        if (selectedId !== object.id) onSelect(object.id);
      },
    };
    const boxStyle = (b: VisualBox) => ({
      left: `${b.xPct * 100}%`,
      top: `${b.yPct * 100}%`,
      width: `${b.wPct * 100}%`,
      height: `${b.hPct * 100}%`,
      pointerEvents: interactive ? ('auto' as const) : ('none' as const),
      touchAction: 'none' as const,
    });
    switch (object.kind) {
      case 'text':
        return (
          <TextBox
            key={object.id}
            object={object}
            pxPerPt={pxPerPt}
            layout={layoutFor(object)}
            interactive={interactive}
            hitProps={{
              ...hit,
              onDoubleClick: () => onEditText(object.id),
              className: 'focus:outline-none',
            }}
          />
        );
      case 'image':
        return (
          <div key={object.id} {...hit} className="absolute cursor-move focus:outline-none" style={boxStyle(object.box)}>
            {assetUrls[object.assetId] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={assetUrls[object.assetId]} alt="" draggable={false} className="pointer-events-none block h-full w-full select-none" />
            )}
          </div>
        );
      case 'highlight':
        return (
          <div
            key={object.id}
            {...hit}
            className="absolute cursor-move focus:outline-none"
            style={{ ...boxStyle(object.box), background: HIGHLIGHT_COLOR, mixBlendMode: 'multiply' }}
          />
        );
      case 'cover':
        return (
          <div
            key={object.id}
            {...hit}
            className="absolute cursor-move focus:outline-none"
            style={{ ...boxStyle(object.box), background: COVER_COLOR }}
          />
        );
      case 'replace': {
        const typing = replaceEditing?.object.id === object.id ? replaceEditing : null;
        const text = typing ? typing.value : object.text;
        return (
          <ReplaceBox
            key={object.id}
            object={object}
            text={text}
            view={previews.view(object, text, previewRequest)}
            pxPerPt={pxPerPt}
            cssWidth={cssWidth}
            cssHeight={cssHeight}
            layout={replace.layoutFor(object, text)}
            metrics={replace.metrics}
            outline={replace.refusedIds.has(object.id) ? 'refused' : typing || (interactive && object.id === selectedId) ? 'active' : 'none'}
            masked={!typing || typing.value.trim() !== ''}
            interactive={interactive && !typing}
            hitProps={{ ...hit, onDoubleClick: () => onEditText(object.id) }}
          />
        );
      }
      default:
        return (
          <StrokeShape
            key={object.id}
            object={object}
            pageSize={pageSize}
            hitWidth={hitWidth}
            interactive={interactive}
            hitProps={hit as HTMLAttributes<SVGElement>}
          />
        );
    }
  };

  // ── Selection frame, handles and mini-bar ──────────────────────────────
  const bounds = selected ? objectBounds(selected) : null;
  const pad = selected && 'strokeWidth' in selected ? (selected.strokeWidth / 2) * pxPerPt + 3 : 3;
  const frame: Rect | null = bounds
    ? {
        left: bounds.xPct * cssWidth - pad,
        top: bounds.yPct * cssHeight - pad,
        width: bounds.wPct * cssWidth + pad * 2,
        height: Math.max(bounds.hPct * cssHeight, selected?.kind === 'text' ? 1 : 0) + pad * 2,
      }
    : null;

  const handles: { id: Handle; x: number; y: number; cursor: string }[] = [];
  if (selected && frame) {
    if (selected.kind === 'line') {
      handles.push(
        { id: 'from', x: selected.from.x * cssWidth, y: selected.from.y * cssHeight, cursor: 'crosshair' },
        { id: 'to', x: selected.to.x * cssWidth, y: selected.to.y * cssHeight, cursor: 'crosshair' },
      );
    } else if (selected.kind === 'replace') {
      // Anchored to its line: no handles.
    } else if (selected.kind === 'text') {
      const midY = frame.top + frame.height / 2;
      handles.push(
        { id: 'w', x: frame.left, y: midY, cursor: 'ew-resize' },
        { id: 'e', x: frame.left + frame.width, y: midY, cursor: 'ew-resize' },
      );
    } else {
      const { left, top, width, height } = frame;
      handles.push(
        { id: 'nw', x: left, y: top, cursor: 'nwse-resize' },
        { id: 'ne', x: left + width, y: top, cursor: 'nesw-resize' },
        { id: 'sw', x: left, y: top + height, cursor: 'nesw-resize' },
        { id: 'se', x: left + width, y: top + height, cursor: 'nwse-resize' },
      );
    }
  }

  const showBar = Boolean(selected && frame && !gesture);
  useLayoutEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const next = { width: el.offsetWidth, height: el.offsetHeight };
    if (next.width !== barSize.width || next.height !== barSize.height) setBarSize(next);
  });
  const barPlace = frame ? placeMiniBar(frame, barSize, { width: cssWidth, height: cssHeight }) : null;

  const restyle = (object: EditorObject, patch: { color?: PaletteColor; direction?: 1 | -1 }) => {
    if (object.kind === 'replace') {
      // Its own size and colour only: the Text tool's last style stays as it was.
      if (patch.color) {
        onReplace({ ...object, color: patch.color });
      } else if (patch.direction) {
        // From the size on screen; from now on the visitor's size wins over the engine's (autoSize dropped).
        const next = stepReplaceObjectSize(object, patch.direction, shownSizeOf(object));
        if (next) onReplace(next);
      }
    } else if (object.kind === 'text') {
      if (patch.color) {
        onReplace({ ...object, color: patch.color });
        onStyle({ textColor: patch.color });
      } else if (patch.direction) {
        const size = stepIn(TEXT_SIZES, object.size, patch.direction);
        if (size === object.size) return;
        onReplace({ ...object, size });
        onStyle({ textSize: size });
      }
    } else if (object.kind === 'shape' || object.kind === 'line' || object.kind === 'ink') {
      if (patch.color) {
        onReplace({ ...object, color: patch.color });
        onStyle({ strokeColor: patch.color });
      } else if (patch.direction) {
        const strokeWidth = stepIn(STROKE_WIDTHS, object.strokeWidth, patch.direction);
        if (strokeWidth === object.strokeWidth) return;
        onReplace({ ...object, strokeWidth });
        onStyle({ strokeWidth });
      }
    }
  };

  const sizeLimits = (object: EditorObject) => {
    if (object.kind === 'replace') return replaceSizeLimits(object, shownSizeOf(object));
    if (object.kind === 'text') return [object.size > TEXT_SIZES[0], object.size < TEXT_SIZES[TEXT_SIZES.length - 1]];
    if ('strokeWidth' in object)
      return [object.strokeWidth > STROKE_WIDTHS[0], object.strokeWidth < STROKE_WIDTHS[STROKE_WIDTHS.length - 1]];
    return [false, false];
  };

  const cursor =
    tool === 'select'
      ? undefined
      : tool === 'text'
        ? 'text'
        : replacing
          ? hoverLineId
            ? 'text'
            : replace.pendingLineId
              ? 'progress'
              : undefined
          : 'crosshair';

  // ── Edit text: which lines to mark ─────────────────────────────────────
  const replacedLines = new Set<string>();
  for (const o of shown) if (o.kind === 'replace') replacedLines.add(o.line.id);
  if (replaceEditing) replacedLines.add(replaceEditing.object.line.id);
  const pageLines = replacing && replace.lines && !replace.pageRefused ? replace.lines : [];
  const offerable = (line: SourceTextLine) => lineBlock(line, replace.rotation) === null && !replacedLines.has(line.id);
  const outlined = pageLines.filter(
    (line) =>
      offerable(line) && (line.id === replace.pendingLineId || line.id === keyLineId || (!touchUi && line.id === hoverLineId)),
  );
  const underlined = touchUi ? pageLines.filter(offerable) : [];
  const lineStyle = (line: SourceTextLine) => {
    const b = lineBoxAt(line, replace.rotation);
    return { left: `${b.xPct * 100}%`, top: `${b.yPct * 100}%`, width: `${b.wPct * 100}%`, height: `${b.hPct * 100}%` };
  };
  const draft = replaceEditing && !objects.some((o) => o.id === replaceEditing.object.id) ? replaceEditing : null;
  const typedLayout = replaceEditing ? replace.layoutFor(replaceEditing.object, replaceEditing.value) : null;
  const typedView = replaceEditing ? previews.view(replaceEditing.object, replaceEditing.value, previewRequest) : null;

  // Ask for the render of every changed line on this page (and the one being typed) whenever one of them changes.
  const previewTargets: Array<{ object: ReplaceObject; text: string }> = [];
  for (const o of shown) {
    if (o.kind === 'replace') previewTargets.push({ object: o, text: replaceEditing?.object.id === o.id ? replaceEditing.value : o.text });
  }
  if (draft) previewTargets.push({ object: draft.object, text: draft.value });
  const previewWants = previewTargets.map((target) => previewKey(target.object, target.text, previewRequest)).join('\n');
  const previewTargetsRef = useRef(previewTargets);
  useLayoutEffect(() => {
    previewTargetsRef.current = previewTargets;
  });
  useEffect(() => {
    for (const target of previewTargetsRef.current) previews.want(target.object, target.text, previewRequest);
  }, [previewRequest, previewWants, previews]);

  // Keyboard: the page itself is the line picker while Edit text is on.
  const keyLines = pageLines.filter(offerable);
  const keyLine = keyLines.find((line) => line.id === keyLineId) ?? null;
  const onPageKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!replacing || e.target !== e.currentTarget || replaceEditing) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (keyLines.length === 0) return;
      const at = keyLine ? keyLines.indexOf(keyLine) : -1;
      const next = e.key === 'ArrowDown' ? Math.min(keyLines.length - 1, at + 1) : Math.max(0, at === -1 ? 0 : at - 1);
      setKeyLineId(keyLines[next].id);
    } else if ((e.key === 'Enter' || e.key === ' ') && keyLine) {
      e.preventDefault();
      replace.onPick({ kind: 'line', line: keyLine });
    }
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
      style={{ touchAction: selecting || replacing ? 'auto' : 'none', cursor }}
      tabIndex={replacing ? 0 : undefined}
      role={replacing ? 'group' : undefined}
      aria-label={replacing ? t('tools.replaceTitle') : undefined}
      aria-describedby={replacing ? `${pageId}-replace-keys` : undefined}
      onKeyDown={onPageKeyDown}
      onBlur={(e) => {
        if (e.target === e.currentTarget) setKeyLineId(null);
      }}
      onPointerDown={onPagePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finish(e, false)}
      onPointerCancel={(e) => finish(e, true)}
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse' && hoverLineId) setHoverLineId(null);
      }}
    >
      {replacing && (
        <>
          <span id={`${pageId}-replace-keys`} className="sr-only">
            {replace.pageRefused ? `${t('replace.pageEffects')} ${t('replace.useCover')}` : t('replace.keys')}
          </span>
          <span className="sr-only" aria-live="polite">
            {keyLine ? keyLine.text || `${keyLines.indexOf(keyLine) + 1}/${keyLines.length}` : ''}
          </span>
        </>
      )}
      {underlined.map((line) => (
        <div key={`u-${line.id}`} aria-hidden="true" className="pointer-events-none absolute" style={{ ...lineStyle(line), ...LINE_UNDERLINE }} />
      ))}
      {outlined.map((line) => (
        <div
          key={`h-${line.id}`}
          aria-hidden="true"
          className={`pointer-events-none absolute ${line.id === replace.pendingLineId ? 'animate-pulse' : ''}`}
          style={{ ...lineStyle(line), ...LINE_OUTLINE }}
        />
      ))}

      {shown.map((object) =>
        object.id === editingId ? null : renderObject(object, pickable(object)),
      )}

      {draft && (
        <ReplaceBox
          object={draft.object}
          text={draft.value}
          view={typedView ?? { kind: 'waiting' }}
          pxPerPt={pxPerPt}
          cssWidth={cssWidth}
          cssHeight={cssHeight}
          layout={typedLayout}
          metrics={replace.metrics}
          outline="active"
          masked={draft.value.trim() !== ''}
          interactive={false}
        />
      )}

      {preview && renderObject(preview, false)}

      {editing && (
        <TextBox
          object={editing.object}
          pxPerPt={pxPerPt}
          layout={null}
          interactive={false}
          editing={{ value: editing.value, onChange: editing.onChange, onDone: editing.onDone }}
        />
      )}

      {replacing && touchUi && (
        <input
          ref={primerRef}
          type="text"
          aria-hidden="true"
          tabIndex={-1}
          autoComplete="off"
          className="pointer-events-none absolute h-px w-px opacity-0"
          style={{ left: 0, top: 0, fontSize: 16 }}
        />
      )}

      {replaceEditing && (
        <ReplaceField
          key={replaceEditing.object.id}
          value={replaceEditing.value}
          onChange={replaceEditing.onChange}
          onCommit={(viaEnter) => {
            if (viaEnter) focusAfterRef.current = replaceEditing.object.id;
            replaceEditing.onCommit(viaEnter);
          }}
          onCancel={() => {
            focusAfterRef.current = replaceEditing.object.id;
            replaceEditing.onCancel();
          }}
          unsure={replaceEditing.object.line.textUnsure}
          choice={typedView ? fieldChoice(typedView, (typedLayout?.missing.length ?? 0) > 0) : null}
          line={{
            left: replaceEditing.object.box.xPct * cssWidth,
            top: replaceEditing.object.box.yPct * cssHeight,
            width: replaceEditing.object.box.wPct * cssWidth,
            height: replaceEditing.object.box.hPct * cssHeight,
          }}
          container={{ width: cssWidth, height: cssHeight }}
          overlayRef={overlayRef}
        />
      )}

      {frame && selected && (
        <>
          {selected.kind !== 'replace' && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-[#FF6B35]"
              style={{ left: frame.left, top: frame.top, width: frame.width, height: frame.height }}
            />
          )}
          {handles.map((h) => (
            <div
              key={h.id}
              role="presentation"
              aria-label={t('resize')}
              title={t('resize')}
              onPointerDown={(e) => startObjectGesture(e, selected, 'resize', h.id)}
              className="absolute z-10 flex h-11 w-11 items-center justify-center"
              style={{ left: h.x - 22, top: h.y - 22, touchAction: 'none', cursor: h.cursor }}
            >
              <span className="block h-3.5 w-3.5 rounded-full border-2 border-[#FF6B35] bg-white shadow" />
            </div>
          ))}
        </>
      )}

      {showBar && selected && barPlace && (
        <MiniBar
          ref={barRef}
          key={selected.id}
          object={selected}
          canShrink={sizeLimits(selected)[0]}
          canGrow={sizeLimits(selected)[1]}
          onColor={(color) => restyle(selected, { color })}
          onSize={(direction) => restyle(selected, { direction })}
          onEdit={() => flushSync(() => onEditText(selected.id))}
          onDelete={() => onDelete(selected.id)}
          style={{ left: barPlace.left, top: barPlace.top }}
        />
      )}
    </div>
  );
}
