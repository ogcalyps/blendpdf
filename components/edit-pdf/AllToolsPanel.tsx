'use client';

/**
 * Every feature of the workspace in one place, grouped by what the visitor
 * wants to do (ALL_TOOLS in workspace-rules): a panel under the All tools
 * button on desktop, a sheet from the bottom on phones. Each row is an icon,
 * a plain name and one short line; a row that can't act now says why in place of its line and stays
 * tappable. Picking a row closes the panel and runs the editor's own action
 * for it (onPick).
 *
 * role="dialog" aria-modal: the editor's shortcuts pause while it is open.
 */
import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import {
  ArrowUpDown,
  CalendarDays,
  Crop,
  EyeOff,
  FileCheck,
  FileBadge,
  FileImage,
  FilePlus,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  FileType,
  Hash,
  PanelTop,
  Highlighter,
  ImagePlus,
  Images,
  Lock,
  Minimize2,
  PenLine,
  RotateCw,
  ScanText,
  Scissors,
  Shapes,
  Signature,
  Stamp,
  TextCursorInput,
  Trash2,
  Type,
  UserX,
  Wrench,
  X,
} from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { ALL_TOOLS, type AllToolId, type AllToolsGroup } from './workspace-rules';

/** Where the desktop panel hangs: under the All tools button, its inline end lined up with the button's (allToolsPlace). */
export interface AllToolsPlace {
  top: number;
  end: number;
}

/** Measured from the button when it is clicked. */
export function allToolsPlace(button: HTMLElement): AllToolsPlace {
  const rect = button.getBoundingClientRect();
  const rtl = document.documentElement.dir === 'rtl';
  return { top: Math.round(rect.bottom + 8), end: Math.max(8, Math.round(rtl ? rect.left : window.innerWidth - rect.right)) };
}

interface AllToolsPanelProps {
  place: AllToolsPlace;
  /** Why a row can't act now, by row. */
  blocked: Partial<Record<AllToolId, string>>;
  onPick: (id: AllToolId) => void;
  onClose: () => void;
}

const ICON = 'h-5 w-5 shrink-0';

const ICONS: Record<AllToolId, ReactNode> = {
  turn: <RotateCw className={ICON} />,
  delete: <Trash2 className={ICON} />,
  reorder: <ArrowUpDown className={ICON} />,
  addPdf: <FilePlus2 className={ICON} />,
  addBlank: <FilePlus className={ICON} />,
  crop: <Crop className={ICON} />,
  text: <Type className={ICON} />,
  signature: <Signature className={ICON} />,
  image: <ImagePlus className={ICON} />,
  date: <CalendarDays className={ICON} />,
  dateHijri: <CalendarDays className={ICON} />,
  watermark: <Stamp className={ICON} />,
  numbers: <Hash className={ICON} />,
  letterhead: <PanelTop className={ICON} />,
  draw: <PenLine className={ICON} />,
  shapes: <Shapes className={ICON} />,
  highlight: <Highlighter className={ICON} />,
  cover: <EyeOff className={ICON} />,
  replace: <TextCursorInput className={ICON} />,
  split: <Scissors className={ICON} />,
  word: <FileText className={ICON} />,
  excel: <FileSpreadsheet className={ICON} />,
  images: <FileImage className={ICON} />,
  plainText: <FileType className={ICON} />,
  imagesInside: <Images className={ICON} />,
  pdfa: <FileBadge className={ICON} />,
  compress: <Minimize2 className={ICON} />,
  password: <Lock className={ICON} />,
  metadata: <UserX className={ICON} />,
  flatten: <FileCheck className={ICON} />,
  ocr: <ScanText className={ICON} />,
  repair: <Wrench className={ICON} />,
};

/** workspace.all.groups.<group> and workspace.all.items.<id>, spelled out so every key is a literal. */
function useAllToolsText() {
  const t = useTranslations('workspace');
  const group = (g: AllToolsGroup): string => {
    switch (g) {
      case 'pages':
        return t('all.groups.pages');
      case 'add':
        return t('all.groups.add');
      case 'text':
        return t('all.groups.text');
      case 'file':
        return t('all.groups.file');
      case 'fix':
        return t('all.groups.fix');
    }
  };
  const item = (id: AllToolId): [name: string, line: string] => {
    switch (id) {
      case 'turn':
        return [t('all.items.turn.name'), t('all.items.turn.line')];
      case 'delete':
        return [t('all.items.delete.name'), t('all.items.delete.line')];
      case 'reorder':
        return [t('all.items.reorder.name'), t('all.items.reorder.line')];
      case 'addPdf':
        return [t('all.items.addPdf.name'), t('all.items.addPdf.line')];
      case 'addBlank':
        return [t('all.items.addBlank.name'), t('all.items.addBlank.line')];
      case 'crop':
        return [t('all.items.crop.name'), t('all.items.crop.line')];
      case 'text':
        return [t('all.items.text.name'), t('all.items.text.line')];
      case 'signature':
        return [t('all.items.signature.name'), t('all.items.signature.line')];
      case 'image':
        return [t('all.items.image.name'), t('all.items.image.line')];
      case 'date':
        return [t('all.items.date.name'), t('all.items.date.line')];
      case 'dateHijri':
        return [t('all.items.dateHijri.name'), t('all.items.dateHijri.line')];
      case 'watermark':
        return [t('all.items.watermark.name'), t('all.items.watermark.line')];
      case 'numbers':
        return [t('all.items.numbers.name'), t('all.items.numbers.line')];
      case 'letterhead':
        return [t('all.items.letterhead.name'), t('all.items.letterhead.line')];
      case 'draw':
        return [t('all.items.draw.name'), t('all.items.draw.line')];
      case 'shapes':
        return [t('all.items.shapes.name'), t('all.items.shapes.line')];
      case 'highlight':
        return [t('all.items.highlight.name'), t('all.items.highlight.line')];
      case 'cover':
        return [t('all.items.cover.name'), t('all.items.cover.line')];
      case 'replace':
        return [t('all.items.replace.name'), t('all.items.replace.line')];
      case 'split':
        return [t('all.items.split.name'), t('all.items.split.line')];
      case 'word':
        return [t('all.items.word.name'), t('all.items.word.line')];
      case 'excel':
        return [t('all.items.excel.name'), t('all.items.excel.line')];
      case 'images':
        return [t('all.items.images.name'), t('all.items.images.line')];
      case 'plainText':
        return [t('all.items.plainText.name'), t('all.items.plainText.line')];
      case 'imagesInside':
        return [t('all.items.imagesInside.name'), t('all.items.imagesInside.line')];
      case 'pdfa':
        return [t('all.items.pdfa.name'), t('all.items.pdfa.line')];
      case 'compress':
        return [t('all.items.compress.name'), t('all.items.compress.line')];
      case 'password':
        return [t('all.items.password.name'), t('all.items.password.line')];
      case 'metadata':
        return [t('all.items.metadata.name'), t('all.items.metadata.line')];
      case 'flatten':
        return [t('all.items.flatten.name'), t('all.items.flatten.line')];
      case 'ocr':
        return [t('all.items.ocr.name'), t('all.items.ocr.line')];
      case 'repair':
        return [t('all.items.repair.name'), t('all.items.repair.line')];
    }
  };
  return { group, item };
}

export function AllToolsPanel({ place, blocked, onPick, onClose }: AllToolsPanelProps) {
  const t = useTranslations('workspace');
  const tEdit = useTranslations('editPdf');
  const tCommon = useTranslations('common');
  const text = useAllToolsText();
  const titleId = useId();
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [said, setSaid] = useState<string | null>(null);

  // The desktop panel hangs from the button: when the page moves under it, it closes (as the toolbar's menus do).
  useEffect(() => {
    const panel = trapRef.current;
    const onScroll = (event: Event) => {
      if (panel?.contains(event.target as Node)) return;
      if (window.matchMedia('(min-width: 768px)').matches) onClose();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose, trapRef]);

  const style = { '--all-tools-top': `${place.top}px`, '--all-tools-end': `${place.end}px` } as CSSProperties;

  return createPortal(
    <div className="fixed inset-0 z-[55]">
      <div className="absolute inset-0 bg-black/40 md:bg-transparent" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={style}
        className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl bg-white shadow-2xl md:inset-x-auto md:bottom-auto md:end-[var(--all-tools-end)] md:top-[var(--all-tools-top)] md:max-h-[calc(100dvh_-_var(--all-tools-top)_-_1rem)] md:w-[min(46rem,calc(100vw_-_2rem))] md:rounded-2xl md:border md:border-gray-200"
      >
        <div className="flex items-center justify-between px-4 pt-2 sm:px-5">
          <h2 id={titleId} className="text-base font-bold text-gray-900">
            {t('all.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon('dismiss')}
            className="-me-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p role="status" className={said ? 'px-4 text-sm text-gray-700 sm:px-5' : 'sr-only'}>
          {said}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-3 md:columns-2 md:gap-4">
          {ALL_TOOLS.map(({ group, items }) => (
            <section key={group} className="mb-2 break-inside-avoid" aria-labelledby={`${titleId}-${group}`}>
              <h3 id={`${titleId}-${group}`} className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                {text.group(group)}
              </h3>
              <ul>
                {items.map((id) => {
                  const [name, line] = text.item(id);
                  const reason = blocked[id];
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        aria-disabled={reason !== undefined || undefined}
                        onClick={() => (reason !== undefined ? setSaid(reason) : onPick(id))}
                        className={`flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-1.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
                          reason !== undefined ? 'cursor-not-allowed' : 'hover:bg-orange-50'
                        }`}
                      >
                        <span className={`mt-0.5 ${reason !== undefined ? 'text-gray-300' : 'text-[#E85A2B]'}`} aria-hidden="true">
                          {ICONS[id]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className={`text-sm font-medium ${reason !== undefined ? 'text-gray-400' : 'text-gray-900'}`}>{name}</span>
                            {id === 'replace' && (
                              <span className="rounded bg-orange-100 px-1 text-[10px] font-semibold leading-4 text-orange-800">{tEdit('tools.beta')}</span>
                            )}
                          </span>
                          <span className={`block text-xs ${reason !== undefined ? 'text-gray-600' : 'text-gray-500'}`}>{reason ?? line}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
