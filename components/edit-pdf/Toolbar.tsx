'use client';

/**
 * The editor's one toolbar. Every button shows its name under its icon, at
 * every width and on phones too: an icon alone doesn't say what it does.
 *
 * First line, one page: One page / All pages | Select, Text, Edit existing
 * text (beta), Draw, Shapes▾, Highlight, Hide (white box), Crop, Insert▾ |
 * Undo, Redo | zoom (on the second line below 1000 px).
 * All pages (the grid): the editing tools work on one page, so the grid shows
 * page tools in their place (Select all, Clear selection, Turn left, Turn
 * right, Delete selected, Add another PDF, Add a blank page), each only when
 * the caller passes its handler. Zoom only acts on the one-page canvas, so it
 * leaves the grid too.
 * Second line (md+): the page and file tools people come for (FILE_TOOLS:
 * Merge, Split, Rotate, Delete pages | Sign, Watermark, Page numbers |
 * Compress, Convert▾, Protect), each running All tools' own action, then the
 * mode's primary button and its Options button. The grid leaves out the ones
 * its page tools already have.
 *
 * Layout: each line's tools scroll sideways when they don't fit. Undo, Redo
 * and zoom end the first line from 1000 px; narrower, they sit just before
 * the primary button at the end of the second, so the editing tools keep the
 * first line (and the zoom percentage shows from 1280 px). On phones the first line ends with the zoom buttons, the
 * second line is left to All tools, and Undo, Redo and the primary button
 * (full width, label shown) move to the bottom bar.
 *
 * The two menus are portalled to <body> and positioned `fixed` from their
 * button (menuPlacement.ts): the tools row scrolls (overflow-x) and would clip
 * a dropdown, and the toolbar's backdrop blur makes it the containing block of
 * any `fixed` child. A menu is measured before it shows, so it can line up
 * with the button's other edge or open upwards to stay on screen.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  ArrowRightLeft,
  ArrowUpRight,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Circle,
  Crop,
  EyeOff,
  File as FileIcon,
  FileBadge,
  FileImage,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FileType,
  FileUp,
  PanelTop,
  GitMerge,
  Hash,
  Highlighter,
  ImagePlus,
  Images,
  LayoutGrid,
  Loader2,
  Lock,
  Minimize2,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Scissors,
  Shapes,
  Signature,
  Square,
  Stamp,
  TextCursorInput,
  Trash2,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { SHAPE_TOOLS, type EditorTool } from './state';
import { placeMenu, type MenuPlace } from './menuPlacement';
import type { AllToolId } from './workspace-rules';

export type InsertKind = 'image' | 'signature' | 'date' | 'dateHijri' | 'watermark' | 'numbers' | 'letterhead' | 'pdf';

/**
 * The All pages grid's tools, shown in place of the editing tools when
 * `view` is 'grid'. A button shows only when its handler is passed. "Add
 * another PDF" needs nothing here: it calls `onInsert('pdf')`.
 */
export interface PageTools {
  /** How many pages are ticked: Clear, Turn and Delete say why they can't act at 0. */
  selected: number;
  /** How many pages the file has: Delete can't remove every page. */
  total: number;
  /** Tick every page. */
  onSelectAll?: () => void;
  /** Untick every page. */
  onClear?: () => void;
  /** Turn the ticked pages: 3 quarter turns is Turn left, 1 is Turn right. */
  onTurn?: (turns: 1 | 3) => void;
  /** Set when the ticked pages can't be turned (every one has changed lines): why. */
  turnBlockedReason?: string;
  /** Delete the ticked pages. */
  onDelete?: () => void;
  /** Add a blank page (where it goes is the caller's call: after the last ticked page, else at the end). */
  onAddBlank?: () => void;
}

interface ToolbarProps {
  /** One page (the canvas) or All pages (the sortable grid). */
  view: 'page' | 'grid';
  onView: (view: 'page' | 'grid') => void;
  tool: EditorTool;
  onTool: (tool: EditorTool) => void;
  onInsert: (kind: InsertKind) => void;
  /** The grid's page tools (see PageTools). Without it the grid shows Add another PDF only. */
  pageTools?: PageTools;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoom: (direction: 1 | -1) => void;
  /** The page's one primary button (ModeConfig.primary) and the Save dialog's Options button. */
  primary: PrimaryButtonProps;
  /** A tap on a control that can't act: show this reason in the status line. */
  onBlocked: (reason: string) => void;
  /** A menu opened or closed (the editor's shortcuts pause while one is open). */
  onMenuOpenChange?: (open: boolean) => void;
  /** Set when Edit text can't be used in this browser or its engine didn't load: why. */
  replaceBlockedReason?: string;
  /** The second line's page and file tools (FILE_TOOLS). Without it that line has the primary button only. */
  fileTools?: FileTools;
}

/** What the second line's tools run: All tools' own action for each, and why one can't act now. */
export interface FileTools {
  onPick: (id: AllToolId) => void;
  blocked: Partial<Record<AllToolId, string>>;
}

/**
 * The second line, in groups. Convert is one menu of the formats
 * (CONVERT_TOOLS); the grid leaves out Merge, Rotate and Delete pages (its
 * page tools add a PDF, turn and delete).
 */
export const FILE_TOOLS: readonly (readonly (AllToolId | 'convert')[])[] = [
  ['addPdf', 'split', 'turn', 'delete'],
  ['signature', 'watermark', 'numbers'],
  ['compress', 'convert', 'password'],
];
export const CONVERT_TOOLS = ['word', 'excel', 'images', 'plainText', 'imagesInside', 'pdfa'] as const satisfies readonly AllToolId[];
const IN_GRID_TOOLS: ReadonlySet<AllToolId | 'convert'> = new Set<AllToolId | 'convert'>(['addPdf', 'turn', 'delete']);

const ICON = 'h-5 w-5 shrink-0';

interface ToolButtonProps {
  /** The name shown under the icon; also the accessible name unless `name` is set. */
  label: string;
  /** The accessible name when it says more than the label ("Edit existing text (beta)"). */
  name?: string;
  /** The tooltip, when it explains more than the name. */
  hint?: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  blockedReason?: string;
  onBlocked?: (reason: string) => void;
  /** Opens a menu: a small chevron after the label. */
  menu?: { open: boolean };
  /** Red on hover (Delete selected). */
  danger?: boolean;
  /** Drawn over the button's corner, taking no room in the row. */
  badge?: ReactNode;
  buttonRef?: Ref<HTMLButtonElement>;
  pressed?: boolean;
}

function ToolButton({
  label,
  name,
  hint,
  icon,
  active,
  onClick,
  blockedReason,
  onBlocked,
  menu,
  danger,
  badge,
  buttonRef,
  pressed,
}: ToolButtonProps) {
  const blocked = blockedReason !== undefined;
  return (
    <button
      ref={buttonRef}
      type="button"
      title={hint ?? name ?? label}
      aria-label={name}
      aria-pressed={pressed}
      aria-disabled={blocked || undefined}
      aria-haspopup={menu ? 'menu' : undefined}
      aria-expanded={menu?.open}
      onClick={() => (blocked ? onBlocked?.(blockedReason) : onClick())}
      className={`relative inline-flex h-12 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-1 ${
        active
          ? 'bg-[#FF6B35] text-white hover:bg-[#E85A2B]'
          : blocked
            ? 'cursor-not-allowed text-gray-300'
            : danger
              ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
              : 'text-gray-700 hover:bg-orange-50 hover:text-[#E85A2B]'
      }`}
    >
      {icon}
      <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] font-medium leading-[14px]">
        {label}
        {menu && <ChevronDown className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
      </span>
      {badge}
    </button>
  );
}

interface MenuItem {
  key: string;
  label: string;
  icon: ReactNode;
  checked?: boolean;
  onSelect: () => void;
}

/** A button with a small menu under it (or over it, near the bottom of the screen). */
function MenuButton({
  label,
  icon,
  active,
  items,
  onOpenChange,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  items: MenuItem[];
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  // Null while open = rendered hidden to be measured; then placed and shown
  const [place, setPlace] = useState<MenuPlace | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = (focusButton = false) => {
    setOpen(false);
    setPlace(null);
    if (focusButton) buttonRef.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || place) return;
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!button || !menu) return;
    // clientWidth leaves out a desktop scrollbar, which innerWidth counts
    const root = document.documentElement;
    setPlace(
      placeMenu(
        button.getBoundingClientRect(),
        { width: menu.offsetWidth, height: menu.offsetHeight },
        { width: root.clientWidth, height: root.clientHeight },
        getComputedStyle(button).direction === 'rtl',
      ),
    );
  }, [open, place]);

  useLayoutEffect(() => {
    if (place) menuRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus({ preventScroll: true });
  }, [place]);

  useEffect(() => {
    onOpenChange?.(open);
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    // The button moved (the row or the page scrolled, the window changed): a menu left behind would point at nothing
    const onScrollOrResize = (event: Event) => {
      if (event.type === 'scroll' && menuRef.current?.contains(event.target as Node)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);
    const at = entries.indexOf(document.activeElement as HTMLElement);
    const go = (index: number) => {
      event.preventDefault();
      entries[(index + entries.length) % entries.length]?.focus();
    };
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'ArrowDown') go(at + 1);
    else if (event.key === 'ArrowUp') go(at - 1);
    else if (event.key === 'Home') go(0);
    else if (event.key === 'End') go(entries.length - 1);
  };

  return (
    <>
      <ToolButton
        buttonRef={buttonRef}
        label={label}
        icon={icon}
        active={active}
        onClick={() => (open ? close() : setOpen(true))}
        menu={{ open }}
      />
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKeyDown}
            className="fixed z-[45] w-max min-w-52 max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl"
            style={place ? { top: place.top, left: place.left, maxHeight: place.maxHeight } : { top: 0, left: 0, visibility: 'hidden' }}
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
                aria-checked={item.checked}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
                  item.checked ? 'bg-orange-50 font-semibold text-[#E85A2B]' : 'text-gray-700 hover:bg-orange-50'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function Divider() {
  return <span className="mx-0.5 hidden h-8 w-px shrink-0 bg-gray-200 md:block" aria-hidden="true" />;
}

export function Toolbar({
  view,
  onView,
  tool,
  onTool,
  onInsert,
  pageTools,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  zoom,
  canZoomIn,
  canZoomOut,
  onZoom,
  primary,
  onBlocked,
  onMenuOpenChange,
  replaceBlockedReason,
  fileTools,
}: ToolbarProps) {
  const t = useTranslations('editPdf');
  const tw = useTranslations('workspace');

  const shapeItems: MenuItem[] = [
    { key: 'rectangle', label: t('tools.rectangle'), icon: <Square className={ICON} />, checked: tool === 'rectangle', onSelect: () => onTool('rectangle') },
    { key: 'ellipse', label: t('tools.ellipse'), icon: <Circle className={ICON} />, checked: tool === 'ellipse', onSelect: () => onTool('ellipse') },
    { key: 'line', label: t('tools.line'), icon: <Minus className={`${ICON} -rotate-45`} />, checked: tool === 'line', onSelect: () => onTool('line') },
    { key: 'arrow', label: t('tools.arrow'), icon: <ArrowUpRight className={ICON} />, checked: tool === 'arrow', onSelect: () => onTool('arrow') },
  ];
  const insertItems: MenuItem[] = [
    { key: 'image', label: t('tools.image'), icon: <ImagePlus className={ICON} />, onSelect: () => onInsert('image') },
    { key: 'signature', label: t('tools.signature'), icon: <Signature className={ICON} />, onSelect: () => onInsert('signature') },
    { key: 'date', label: t('tools.date'), icon: <CalendarDays className={ICON} />, onSelect: () => onInsert('date') },
    { key: 'dateHijri', label: t('tools.dateHijri'), icon: <CalendarDays className={ICON} />, onSelect: () => onInsert('dateHijri') },
    { key: 'watermark', label: tw('watermark.title'), icon: <Stamp className={ICON} />, onSelect: () => onInsert('watermark') },
    { key: 'numbers', label: tw('numbers.title'), icon: <Hash className={ICON} />, onSelect: () => onInsert('numbers') },
    { key: 'letterhead', label: tw('letterhead.title'), icon: <PanelTop className={ICON} />, onSelect: () => onInsert('letterhead') },
    { key: 'pdf', label: tw('insert.pdf'), icon: <FileUp className={ICON} />, onSelect: () => onInsert('pdf') },
  ];

  const toolButton = (id: EditorTool, label: string, icon: ReactNode, hint?: string) => (
    <ToolButton label={label} hint={hint} icon={icon} active={tool === id} pressed={tool === id} onClick={() => onTool(id)} />
  );

  const editingTools = (
    <div role="toolbar" aria-label={t('toolbar')} className="flex shrink-0 items-center gap-0.5">
      {toolButton('select', t('tools.select'), <MousePointer2 className={ICON} />)}
      {toolButton('text', t('tools.text'), <Type className={ICON} />)}
      <ToolButton
        label={t('tools.replace')}
        name={t('tools.replaceTitle')}
        icon={<TextCursorInput className={ICON} />}
        active={tool === 'replace'}
        pressed={tool === 'replace'}
        onClick={() => onTool('replace')}
        blockedReason={replaceBlockedReason}
        onBlocked={onBlocked}
        badge={
          // A corner badge that takes no room in the row; "beta" is in the accessible name, the tooltip and the hint line too
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute end-0.5 top-0.5 rounded px-1 text-[9px] font-semibold leading-3 ${
              tool === 'replace'
                ? 'bg-white text-orange-800'
                : replaceBlockedReason !== undefined
                  ? 'bg-gray-50 text-gray-400'
                  : 'bg-orange-100 text-orange-800'
            }`}
          >
            {t('tools.beta')}
          </span>
        }
      />
      {toolButton('draw', t('tools.draw'), <PenLine className={ICON} />)}
      <MenuButton
        label={t('tools.shapes')}
        icon={<Shapes className={ICON} />}
        active={SHAPE_TOOLS.includes(tool)}
        items={shapeItems}
        onOpenChange={onMenuOpenChange}
      />
      {toolButton('highlight', t('tools.highlight'), <Highlighter className={ICON} />)}
      {/* Hides, doesn't delete: the tooltip (and the hint line while it's on) says what stays in the file */}
      {toolButton('cover', t('tools.cover'), <EyeOff className={ICON} />, t('coverNote'))}
      {toolButton('crop', tw('crop.tool'), <Crop className={ICON} />)}
      <MenuButton label={t('tools.insert')} icon={<Plus className={ICON} />} items={insertItems} onOpenChange={onMenuOpenChange} />
    </div>
  );

  const selected = pageTools?.selected ?? 0;
  const needSelection = selected === 0 ? tw('needs.selection') : undefined;
  const gridTools = (
    <div role="toolbar" aria-label={tw('pages.grid')} className="flex shrink-0 items-center gap-0.5">
      {pageTools?.onSelectAll && (
        <ToolButton label={tw('pages.selectAll')} icon={<CheckSquare className={ICON} />} onClick={pageTools.onSelectAll} />
      )}
      {pageTools?.onClear && (
        <ToolButton
          label={tw('toolbar.clear')}
          icon={<X className={ICON} />}
          onClick={pageTools.onClear}
          blockedReason={selected === 0 ? tw('toolbar.noSelection') : undefined}
          onBlocked={onBlocked}
        />
      )}
      {pageTools?.onTurn && (
        <>
          <ToolButton
            label={tw('pages.turnLeft')}
            icon={<RotateCcw className={ICON} />}
            onClick={() => pageTools.onTurn?.(3)}
            blockedReason={needSelection ?? pageTools.turnBlockedReason}
            onBlocked={onBlocked}
          />
          <ToolButton
            label={tw('pages.turnRight')}
            icon={<RotateCw className={ICON} />}
            onClick={() => pageTools.onTurn?.(1)}
            blockedReason={needSelection ?? pageTools.turnBlockedReason}
            onBlocked={onBlocked}
          />
        </>
      )}
      {pageTools?.onDelete && (
        <ToolButton
          label={tw('toolbar.deleteSelected')}
          icon={<Trash2 className={ICON} />}
          onClick={pageTools.onDelete}
          blockedReason={needSelection ?? (selected >= pageTools.total ? t('disabled.deletePage') : undefined)}
          onBlocked={onBlocked}
          danger
        />
      )}
      <ToolButton label={tw('insert.pdf')} icon={<FileUp className={ICON} />} onClick={() => onInsert('pdf')} />
      {pageTools?.onAddBlank && (
        <ToolButton label={tw('toolbar.addBlank')} icon={<FilePlus2 className={ICON} />} onClick={pageTools.onAddBlank} />
      )}
    </div>
  );

  const zoomButtons = (
    <div className="flex shrink-0 items-center gap-0.5">
      <ToolButton
        label={t('zoomOut')}
        icon={<ZoomOut className={ICON} />}
        onClick={() => onZoom(-1)}
        blockedReason={canZoomOut ? undefined : t('disabled.zoomOut')}
        onBlocked={onBlocked}
      />
      <span className="hidden w-12 text-center text-sm tabular-nums text-gray-600 xl:inline" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <ToolButton
        label={t('zoomIn')}
        icon={<ZoomIn className={ICON} />}
        onClick={() => onZoom(1)}
        blockedReason={canZoomIn ? undefined : t('disabled.zoomIn')}
        onBlocked={onBlocked}
      />
    </div>
  );

  /** The Convert menu's rows: the Save dialog's own format names, the All tools icons. */
  const convertItem = (id: (typeof CONVERT_TOOLS)[number]): [label: string, icon: ReactNode] => {
    switch (id) {
      case 'word':
        return [tw('export.format.word'), <FileText className={ICON} />];
      case 'excel':
        return [tw('export.format.excel'), <FileSpreadsheet className={ICON} />];
      case 'images':
        return [tw('export.format.images'), <FileImage className={ICON} />];
      case 'plainText':
        return [tw('export.format.text'), <FileType className={ICON} />];
      case 'imagesInside':
        return [tw('export.format.imagesInside'), <Images className={ICON} />];
      case 'pdfa':
        return [tw('export.format.pdfa'), <FileBadge className={ICON} />];
    }
  };
  const fileTool = (id: AllToolId | 'convert'): ReactNode => {
    if (!fileTools) return null;
    if (id === 'convert') {
      const items = CONVERT_TOOLS.map((format): MenuItem => {
        const [label, icon] = convertItem(format);
        return { key: format, label, icon, onSelect: () => fileTools.onPick(format) };
      });
      return (
        <MenuButton key="convert" label={tw('toolbar.convert')} icon={<ArrowRightLeft className={ICON} />} items={items} onOpenChange={onMenuOpenChange} />
      );
    }
    const run = () => fileTools.onPick(id);
    const button = (label: string, icon: ReactNode, hint?: string) => (
      <ToolButton key={id} label={label} hint={hint} icon={icon} onClick={run} blockedReason={fileTools.blocked[id]} onBlocked={onBlocked} />
    );
    switch (id) {
      case 'addPdf':
        return button(tw('toolbar.merge'), <GitMerge className={ICON} />, tw('toolbar.mergeHint'));
      case 'split':
        return button(tw('toolbar.split'), <Scissors className={ICON} />);
      case 'turn':
        return button(tw('toolbar.rotate'), <RotateCw className={ICON} />);
      case 'delete':
        return button(tw('toolbar.deletePages'), <Trash2 className={ICON} />);
      case 'signature':
        return button(tw('toolbar.sign'), <Signature className={ICON} />);
      case 'watermark':
        return button(tw('toolbar.watermark'), <Stamp className={ICON} />);
      case 'numbers':
        return button(tw('toolbar.numbers'), <Hash className={ICON} />);
      case 'compress':
        return button(tw('toolbar.compress'), <Minimize2 className={ICON} />);
      case 'password':
        return button(tw('toolbar.protect'), <Lock className={ICON} />);
      default:
        return null;
    }
  };
  const fileGroups = FILE_TOOLS.map((group) => group.filter((id) => view === 'page' || !IN_GRID_TOOLS.has(id))).filter((group) => group.length > 0);

  /** Undo, Redo and zoom: the end of the first line from 1000 px, else just before the primary button. */
  const historyAndZoom = (
    <>
      <div className="flex items-center gap-0.5">
        <ToolButton
          label={t('undo')}
          icon={<Undo2 className={`${ICON} rtl:-scale-x-100`} />}
          onClick={onUndo}
          blockedReason={canUndo ? undefined : t('disabled.undo')}
          onBlocked={onBlocked}
        />
        <ToolButton
          label={t('redo')}
          icon={<Redo2 className={`${ICON} rtl:-scale-x-100`} />}
          onClick={onRedo}
          blockedReason={canRedo ? undefined : t('disabled.redo')}
          onBlocked={onBlocked}
        />
      </div>
      {view === 'page' && (
        <>
          <Divider />
          {zoomButtons}
        </>
      )}
    </>
  );

  return (
    <div className="sticky top-16 z-30 rounded-xl border border-orange-100 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1 px-1.5 py-1">
        {/* The tools: scroll sideways when they don't fit (a thin scrollbar says so on desktop) */}
        <div className="flex min-w-0 grow items-center gap-1 overflow-x-auto [scrollbar-width:none] md:[scrollbar-width:thin]">
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-gray-50 p-0.5">
            <ToolButton
              label={tw('pages.single')}
              icon={<FileIcon className={ICON} />}
              active={view === 'page'}
              pressed={view === 'page'}
              onClick={() => onView('page')}
            />
            <ToolButton
              label={tw('pages.grid')}
              icon={<LayoutGrid className={ICON} />}
              active={view === 'grid'}
              pressed={view === 'grid'}
              onClick={() => onView('grid')}
            />
          </div>
          <Divider />
          {view === 'grid' ? gridTools : editingTools}
          {view === 'page' && <div className="flex shrink-0 md:hidden">{zoomButtons}</div>}
        </div>

        {/* Undo, Redo and zoom: the end of the first line where it fits beside the tools */}
        <div className="hidden shrink-0 items-center gap-1 min-[1000px]:flex">{historyAndZoom}</div>
      </div>

      {/* Second line: the page and file tools, then the primary button (phones: All tools and the bottom bar) */}
      <div className="hidden items-center gap-1 border-t border-gray-100 px-1.5 py-1 md:flex">
        <div
          role="toolbar"
          aria-label={tw('toolbar.fileTools')}
          className="flex min-w-0 grow items-center gap-0.5 overflow-x-auto [scrollbar-width:thin]"
        >
          {fileGroups.map((group, i) => (
            <div key={group[0]} className="flex shrink-0 items-center gap-0.5">
              {i > 0 && <Divider />}
              {group.map(fileTool)}
            </div>
          ))}
        </div>
        {/* Narrower: the editing tools keep the first line to themselves */}
        <div className="hidden shrink-0 items-center gap-1 md:max-[1000px]:flex">{historyAndZoom}</div>
        <div className="shrink-0 ps-1">
          <PrimaryButton {...primary} />
        </div>
      </div>
    </div>
  );
}

export interface PrimaryButtonProps {
  /** The mode's label (workspace.primary.<mode>), already translated. */
  label: string;
  /** Set when it can't act yet: why (the mode's need, or what stops the plan). */
  blockedReason?: string;
  /** A save or a fix is running. */
  busy: boolean;
  busyLabel: string;
  onPrimary: () => void;
  /** The Options button: the Save dialog. It stays usable while the primary is blocked (an option may be what's missing). */
  onMore: () => void;
  onBlocked: (reason: string) => void;
  /** Phone bottom bar: the whole row, so the label always fits (it says what the page does). */
  wide?: boolean;
}

/** The mode's primary button and its "Options" button (toolbar on desktop, bottom bar on phones). */
export function PrimaryButton({ label, blockedReason, busy, busyLabel, onPrimary, onMore, onBlocked, wide }: PrimaryButtonProps) {
  const tw = useTranslations('workspace');
  const blocked = blockedReason !== undefined;
  const half =
    'inline-flex min-h-11 items-center justify-center bg-[#FF6B35] text-white transition hover:bg-[#E85A2B] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] focus-visible:ring-offset-2';
  return (
    <div className={`${wide ? 'flex w-full' : 'inline-flex shrink-0'} rounded-xl shadow-md`}>
      <button
        type="button"
        aria-disabled={blocked || busy || undefined}
        aria-busy={busy || undefined}
        onClick={() => {
          if (busy) return;
          if (blocked) onBlocked(blockedReason);
          else onPrimary();
        }}
        className={`${half} ${wide ? 'min-w-0 flex-1' : ''} gap-2 whitespace-nowrap rounded-s-xl px-4 text-sm font-semibold ${
          blocked ? 'cursor-not-allowed opacity-50 hover:bg-[#FF6B35]' : ''
        } ${busy ? 'cursor-wait' : ''}`}
      >
        {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Save className="h-4 w-4 shrink-0" />}
        <span className="truncate">{busy ? busyLabel : label}</span>
      </button>
      {/* "Options" in words; on the narrowest phones the primary label needs the room, and the arrow keeps the name */}
      <button
        type="button"
        aria-label={tw('moreOptions')}
        title={tw('moreOptions')}
        aria-haspopup="dialog"
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onMore();
        }}
        className={`${half} min-w-11 shrink-0 gap-1 rounded-e-xl border-s border-white/40 px-3 text-sm font-medium`}
      >
        <span className={wide ? 'hidden min-[360px]:inline' : undefined}>{tw('save.options')}</span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
    </div>
  );
}
