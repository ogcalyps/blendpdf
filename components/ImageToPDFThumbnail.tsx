'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

interface ImageToPDFThumbnailProps {
  image: ImageFile;
  position: number;
  onRemove: () => void;
}

export function ImageToPDFThumbnail({ image, position, onRemove }: ImageToPDFThumbnailProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white border-2 border-gray-200 rounded-xl p-3 hover:border-blue-500 hover:shadow-lg transition-all cursor-move"
      {...attributes}
      {...listeners}
    >
      
      {/* Position badge */}
      <div className="absolute -top-2 -start-2 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold z-10">
        {position}
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="absolute -top-2 -end-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-600 pointer-events-auto"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Drag handle icon */}
      <div className="absolute bottom-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GripVertical className="w-5 h-5 text-gray-500" />
      </div>

      {/* Image preview */}
      <div className="aspect-[8.5/11] rounded-lg border border-gray-300 bg-gray-100 relative overflow-hidden">
        <img
          src={image.preview}
          alt={`Image ${position}`}
          className="w-full h-full object-cover"
        />
      </div>

      {/* File name */}
      <p className="text-xs text-gray-600 truncate mt-2" title={image.file.name}>
        {image.file.name}
      </p>

    </div>
  );
}

