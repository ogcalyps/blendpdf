'use client';

import { PDFThumbnail } from '@/components/PDFThumbnail';

interface PageThumbnailProps {
  file: File;
  pageNumber: number;
  isSelected: boolean;
  onToggle: () => void;
}

export function PageThumbnail({ file, pageNumber, isSelected, onToggle }: PageThumbnailProps) {
  return (
    <PDFThumbnail
      file={file}
      pageNumber={pageNumber}
      isSelected={isSelected}
      onToggle={onToggle}
      showCheckbox={true}
      showPageNumber={true}
      showDragHandle={true}
      thumbnailWidth={120}
    />
  );
}

