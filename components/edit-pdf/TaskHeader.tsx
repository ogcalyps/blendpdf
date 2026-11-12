'use client';

/**
 * Above the toolbar: the file the visitor is working on (name, pages, size),
 * one plain sentence on what this page does with it, the All tools button (every feature in one place, on phones too) and Choose
 * another PDF.
 */
import { useTranslations } from 'next-intl';
import { FileText, LayoutGrid } from 'lucide-react';
import type { WorkspaceMode } from '@/lib/workspace/types';

interface TaskHeaderProps {
  mode: WorkspaceMode;
  fileName: string;
  pageCount: number;
  bytes: number;
  allToolsOpen: boolean;
  /** The All tools button was clicked (the panel hangs from it on desktop). */
  onAllTools: (button: HTMLButtonElement) => void;
  onChooseAnother: () => void;
}

/** What the page does with the file: workspace.task.<mode>, spelled out so every key is a literal. */
function useTaskText(): (mode: WorkspaceMode) => string {
  const t = useTranslations('workspace');
  return (mode) => {
    switch (mode) {
      case 'edit':
        return t('task.edit');
      case 'sign':
        return t('task.sign');
      case 'crop':
        return t('task.crop');
      case 'rotate':
        return t('task.rotate');
      case 'delete':
        return t('task.delete');
      case 'reorder':
        return t('task.reorder');
      case 'extract':
        return t('task.extract');
      case 'split':
        return t('task.split');
      case 'merge':
        return t('task.merge');
      case 'watermark':
        return t('task.watermark');
      case 'numbers':
        return t('task.numbers');
      case 'compress':
        return t('task.compress');
      case 'protect':
        return t('task.protect');
      case 'unlock':
        return t('task.unlock');
      case 'repair':
        return t('task.repair');
      case 'ocr':
        return t('task.ocr');
      case 'flatten':
        return t('task.flatten');
      case 'metadata':
        return t('task.metadata');
      case 'word':
        return t('task.word');
      case 'excel':
        return t('task.excel');
      case 'images':
        return t('task.images');
      case 'text':
        return t('task.text');
      case 'imagesInside':
        return t('task.imagesInside');
      case 'pdfa':
        return t('task.pdfa');
      case 'converted':
        return t('task.converted');
    }
  };
}

export function TaskHeader({ mode, fileName, pageCount, bytes, allToolsOpen, onAllTools, onChooseAnother }: TaskHeaderProps) {
  const t = useTranslations('workspace');
  const tEdit = useTranslations('editPdf');
  const taskText = useTaskText();
  const mb = bytes >= 1024 * 1024;
  const size = mb ? t('task.mb', { n: Math.round((bytes / (1024 * 1024)) * 10) / 10 }) : t('task.kb', { n: Math.max(1, Math.round(bytes / 1024)) });
  return (
    <div className="mb-2 rounded-xl border border-orange-100 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-[#FF6B35]" aria-hidden="true" />
          <div className="min-w-0">
            <p dir="auto" title={fileName} className="truncate text-sm font-semibold text-gray-900">
              {fileName}
            </p>
            <p className="text-xs text-gray-500">
              {t('task.pages', { count: pageCount })} · {size}
            </p>
          </div>
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onChooseAnother}
            className="min-h-11 rounded-lg px-2 text-sm font-medium text-gray-500 underline-offset-4 hover:text-[#E85A2B] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            {tEdit('chooseAnother')}
          </button>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={allToolsOpen}
            onClick={(e) => onAllTools(e.currentTarget)}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-orange-200 px-3 text-sm font-semibold text-gray-800 hover:bg-orange-50 hover:text-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            <LayoutGrid className="h-5 w-5 text-[#FF6B35]" aria-hidden="true" />
            {t('all.button')}
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-700">{taskText(mode)}</p>
    </div>
  );
}
