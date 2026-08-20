'use client';

import { X, GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatFileSize } from '@/lib/utils';
import { PDFThumbnail } from '@/components/PDFThumbnail';
import type { UploadedFile } from '@/types';

interface PDFCardProps {
  file: UploadedFile;
  index: number;
  onRemove: () => void;
  isDragging?: boolean;
}

export function PDFCard({ file, index, onRemove, isDragging = false }: PDFCardProps) {
  const t = useTranslations('common');

  const handleRemove = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Call onRemove after a small delay to ensure event propagation is stopped
    setTimeout(() => {
      onRemove();
    }, 0);
  };

  const handleRemoveMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent drag from starting when clicking remove button
    e.preventDefault();
    e.stopPropagation();
    // Also stop immediate propagation
    e.nativeEvent.stopImmediatePropagation();
  };

  return (
    <div
      className={`group relative bg-white border-2 border-gray-200 rounded-xl p-3 hover:border-primary hover:shadow-lg transition-all cursor-move ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Position badge (1, 2, 3...) */}
      <div className="absolute -top-2 -start-2 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold z-10 shadow-md">
        {index + 1}
      </div>

      {/* Remove button: hover-revealed on pointers that can hover, always visible on touch */}
      <button
        data-remove-button
        onClick={handleRemove}
        onMouseDown={handleRemoveMouseDown}
        onTouchStart={(e) => {
          // Block drag from starting on touch, but do NOT preventDefault —
          // that would suppress the synthesized click and break removal on touch devices
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        className="absolute -top-2 -end-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 transition-opacity z-50 hover:bg-red-600 shadow-md cursor-pointer"
        aria-label={`${t('removeFile')}: ${file.name}`}
        type="button"
        style={{ pointerEvents: 'auto', zIndex: 9999 }}
      >
        <X className="w-5 h-5" />
      </button>

      {/* PDF Thumbnail preview */}
      <div className="mb-3">
        <PDFThumbnail
          file={file.file}
          pageNumber={1}
          showCheckbox={false}
          showPageNumber={false}
          showDragHandle={true}
          thumbnailWidth={150}
          enableLazyLoading={false}
        />
      </div>

      {/* File info */}
      <div className="text-sm">
        <p className="font-medium text-gray-900 truncate mb-1" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)}
        </p>
      </div>
    </div>
  );
}

