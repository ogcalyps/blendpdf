'use client';

import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { ImageToPDFThumbnail } from './ImageToPDFThumbnail';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

interface ImageToPDFGridProps {
  images: ImageFile[];
  onReorder: (newOrder: ImageFile[]) => void;
  onRemove: (id: string) => void;
}

export function ImageToPDFGrid({ images, onReorder, onRemove }: ImageToPDFGridProps) {
  
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = images.findIndex(img => img.id === active.id);
    const newIndex = images.findIndex(img => img.id === over.id);
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const newOrder = arrayMove(images, oldIndex, newIndex);
    onReorder(newOrder);
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={images.map(img => img.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {images.map((image, index) => (
            <ImageToPDFThumbnail
              key={image.id}
              image={image}
              position={index + 1}
              onRemove={() => onRemove(image.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

