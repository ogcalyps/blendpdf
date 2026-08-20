'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFileStore } from '@/store/use-file-store';
import { PDFCard } from './PDFCard';
import { AddMoreCard } from './AddMoreCard';
import { useDropzone } from 'react-dropzone';
import { validateFile, formatFileSize } from '@/lib/utils';
import { X } from 'lucide-react';
import type { UploadedFile } from '@/types';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

interface FileListProps {
  showGrid?: boolean; // If false, shows simple list (for compress/split)
  showAddMore?: boolean; // If false, hides Add More card
  showActionButtons?: boolean; // If false, hides action buttons section
  onAction?: () => void; // Action button callback
  actionLabel?: string; // Action button label (defaults to a localized "Process")
  onClear?: () => void; // Clear button callback
}

interface SortablePDFCardProps {
  file: UploadedFile;
  index: number;
  onRemove: () => void;
}

function SortablePDFCard({ file, index, onRemove }: SortablePDFCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Create listeners that exclude the remove button
  const dragListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      // Don't start drag if clicking on remove button or its children
      const target = e.target as HTMLElement;
      if (target.closest('button[data-remove-button]')) {
        return;
      }
      listeners?.onPointerDown?.(e);
    },
    onMouseDown: (e: React.MouseEvent) => {
      // Don't start drag if clicking on remove button or its children
      const target = e.target as HTMLElement;
      if (target.closest('button[data-remove-button]')) {
        return;
      }
      listeners?.onMouseDown?.(e);
    },
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...dragListeners}>
      <PDFCard file={file} index={index} onRemove={onRemove} isDragging={isDragging} />
    </div>
  );
}

export function FileList({
  showGrid = true,
  showAddMore = true,
  showActionButtons = false,
  onAction,
  actionLabel,
  onClear
}: FileListProps = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const files = useFileStore((state) => state.files);
  const removeFile = useFileStore((state) => state.removeFile);
  const addFiles = useFileStore((state) => state.addFiles);
  const reorderFilesByIds = useFileStore((state) => state.reorderFilesByIds);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex((file) => file.id === active.id);
      const newIndex = files.findIndex((file) => file.id === over.id);

      const newOrder = arrayMove(
        files.map((f) => f.id),
        oldIndex,
        newIndex
      );

      reorderFilesByIds(newOrder);
    }
  };

  const handleAddMoreClick = () => {
    fileInputRef.current?.click();
  };

  const onDrop = async (acceptedFiles: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    acceptedFiles.forEach((file) => {
      const error = validateFile(file, MAX_FILE_SIZE);
      if (error === null) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${error}`);
      }
    });

    setValidationErrors(errors);

    if (validFiles.length > 0) {
      addFiles(validFiles);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    noClick: true, // We'll handle clicks manually
  });

  if (files.length === 0) {
    return null;
  }

  const errorBanner = validationErrors.length > 0 && (
    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          {validationErrors.map((error, index) => (
            <p key={index} className="text-sm text-red-600">
              {error}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setValidationErrors([])}
          aria-label={t('upload.dismiss')}
          className="shrink-0 rounded-full p-1 text-red-400 transition-colors hover:text-red-600 hover:bg-red-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  // Simple list view for single-file tools (compress, split)
  if (!showGrid) {
    return (
      <div className="mt-6 rounded-xl border-2 border-gray-200 bg-white">
        <div className="px-4 pt-4 pb-3">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('fileList.title')}
            {files.length > 0 && (
              <span className="ms-2 text-sm font-normal text-gray-500">
                ({files.length} {files.length === 1 ? t('fileList.file') : t('fileList.files')})
              </span>
            )}
          </h3>
        </div>
        <div>
          {files.map((file, index) => (
            <div
              key={file.id}
              className={`
                flex items-center gap-3 py-3 px-4 border-b border-gray-100 transition-colors hover:bg-gray-50
                ${index === files.length - 1 ? 'border-b-0' : ''}
              `}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-600">
                  {formatFileSize(file.size, locale)}
                </p>
              </div>
              <button
                onClick={() => removeFile(file.id)}
                className="p-1 text-gray-400 transition-colors hover:text-red-600"
                aria-label={`${t('common.removeFile')}: ${file.name}`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Grid view for multi-file tools (merge)
  return (
    <div {...getRootProps()} className="bg-white rounded-2xl border-2 border-gray-200 p-8">
      <input {...getInputProps()} ref={fileInputRef} />

      {errorBanner}

      {/* Header with count and actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {t('fileList.yourPdfs')} ({files.length} {files.length === 1 ? t('fileList.file') : t('fileList.files')})
          </h3>
          <p className="text-sm text-gray-500">
            {t('fileList.reorderHint')}
          </p>
        </div>
        {showAddMore && (
          <button
            onClick={handleAddMoreClick}
            className="px-4 py-2 text-sm font-medium text-primary hover:text-primary-coral border border-primary rounded-lg hover:bg-orange-50 transition-colors"
          >
            {t('fileList.addMorePdfs')}
          </button>
        )}
      </div>

      {/* Grid of PDF cards */}
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={files.map((f) => f.id)}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {files.map((file, index) => (
              <SortablePDFCard
                key={file.id}
                file={file}
                index={index}
                onRemove={() => removeFile(file.id)}
              />
            ))}

            {/* Add More card */}
            {showAddMore && <AddMoreCard onClick={handleAddMoreClick} />}
          </div>
        </SortableContext>
      </DndContext>

      {/* Action buttons */}
      {showActionButtons && onAction && (
        <div className="flex items-center gap-4">
          <button
            onClick={onAction}
            className="flex-1 px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary-coral transition-colors shadow-lg hover:shadow-xl"
          >
            {actionLabel ?? t('fileList.process')}
          </button>
          {onClear && (
            <button
              onClick={onClear}
              className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
            >
              {t('common.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
