'use client';

import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { ReorderPageThumbnail } from './ReorderPageThumbnail';

interface ReorderPageGridProps {
  file: File;
  pageOrder: number[];
  onReorder: (newOrder: number[]) => void;
}

export function ReorderPageGrid({ file, pageOrder, onReorder }: ReorderPageGridProps) {
  
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;
    
    const oldIndex = pageOrder.indexOf(Number(active.id));
    const newIndex = pageOrder.indexOf(Number(over.id));
    
    if (oldIndex === -1 || newIndex === -1) return;
    
    const newOrder = arrayMove(pageOrder, oldIndex, newIndex);
    onReorder(newOrder);
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={pageOrder} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {pageOrder.map((pageNum, index) => (
            <ReorderPageThumbnail
              key={pageNum}
              file={file}
              pageNumber={pageNum}
              position={index + 1}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

