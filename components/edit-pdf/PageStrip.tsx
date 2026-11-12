'use client';

/**
 * Page thumbnails: a column beside the canvas on desktop, a 3-column grid in
 * the Pages sheet on phones, and the large grid of the All pages view, which
 * is sortable (drag a page to move it, as on /reorder-pdf). Every thumbnail
 * comes from the editor's one shared pdf.js document, rendered one at a time
 * and only once it scrolls into view; the result is cached by page and
 * rotation, so every list shares it and a reorder never re-renders.
 *
 * Each thumbnail has a checkbox (workspace selection: SelectionBar, Save
 * dialog's "Selected pages") and dims what a crop hides. What a tap on the
 * picture does is the caller's: go to the page (column, phone sheet), or
 * tick it (large grid); shift extends the selection from the last one ticked.
 */
import { memo, useEffect, useState, type CSSProperties, type HTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { useInView } from 'react-intersection-observer';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Maximize2 } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { pageVisualSize, type EditorPage, type PageId, type SourcePageInfo } from '@/lib/edit-pdf';

/** Thumbnail width in CSS px, drawn once for both sizes (the large grid shows it 1:1, the column scales it down). */
const THUMB_WIDTH = 160;

interface Job {
  sourceIndex: number;
  rotation: number;
  listeners: Set<(url: string) => void>;
}

/** Renders thumbnails from the shared document, one at a time, for the pages someone is looking at. */
export class ThumbnailRenderer {
  private cache = new Map<string, string>();
  private wanted = new Map<string, Job>();
  private running = false;
  private destroyed = false;

  constructor(private pdf: PDFDocumentProxy) {}

  private static key(sourceIndex: number, rotation: number) {
    return `${sourceIndex}:${rotation}`;
  }

  get(sourceIndex: number, rotation: number): string | undefined {
    return this.cache.get(ThumbnailRenderer.key(sourceIndex, rotation));
  }

  /** Ask for a thumbnail; the listener gets its URL once drawn. Returns the unsubscribe. */
  subscribe(sourceIndex: number, rotation: number, listener: (url: string) => void): () => void {
    const key = ThumbnailRenderer.key(sourceIndex, rotation);
    const cached = this.cache.get(key);
    if (cached) {
      listener(cached);
      return () => {};
    }
    let job = this.wanted.get(key);
    if (!job) {
      job = { sourceIndex, rotation, listeners: new Set() };
      this.wanted.set(key, job);
    }
    job.listeners.add(listener);
    void this.pump();
    return () => {
      job.listeners.delete(listener);
      if (job.listeners.size === 0 && this.wanted.get(key) === job) this.wanted.delete(key);
    };
  }

  destroy() {
    this.destroyed = true;
    this.wanted.clear();
  }

  private async pump() {
    if (this.running) return;
    this.running = true;
    try {
      while (!this.destroyed && this.wanted.size > 0) {
        const [key, job] = this.wanted.entries().next().value as [string, Job];
        try {
          const url = await this.render(job.sourceIndex, job.rotation);
          if (this.destroyed) return;
          this.cache.set(key, url);
          // Listeners still waiting (it may have scrolled away meanwhile; it's cached either way).
          this.wanted.get(key)?.listeners.forEach((listener) => listener(url));
        } catch (error) {
          if (!this.destroyed) console.warn('edit-pdf: thumbnail failed', error);
        }
        this.wanted.delete(key);
      }
    } finally {
      this.running = false;
    }
  }

  private async render(sourceIndex: number, rotation: number): Promise<string> {
    const page = await this.pdf.getPage(sourceIndex + 1);
    const base = page.getViewport({ scale: 1, rotation });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (THUMB_WIDTH * ratio) / base.width, rotation });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas context');
    await page.render({ canvasContext: context, viewport }).promise;
    const url = canvas.toDataURL('image/jpeg', 0.8);
    canvas.width = 0;
    canvas.height = 0;
    return url;
  }
}

/** Dims what the crop hides: a hole the size of the crop, the rest shaded by its shadow (the parent clips it). */
export function cropShadeStyle(crop: NonNullable<EditorPage['crop']>): CSSProperties {
  return {
    left: `${crop.xPct * 100}%`,
    top: `${crop.yPct * 100}%`,
    width: `${crop.wPct * 100}%`,
    height: `${crop.hPct * 100}%`,
    boxShadow: '0 0 0 9999px rgba(17, 24, 39, 0.45)',
  };
}

interface ThumbProps {
  page: EditorPage;
  number: number;
  sourcePages: readonly SourcePageInfo[];
  renderer: ThumbnailRenderer;
  current: boolean;
  selected: boolean;
  large: boolean;
  onActivate: (pageId: PageId, shift: boolean) => void;
  onToggle: (pageId: PageId, range: boolean) => void;
  onOpen?: (pageId: PageId) => void;
  /** Large grid: useSortable's handles, put on the picture (drag it, or pick it up with Space). */
  sortable?: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: CSSProperties;
    handle: HTMLAttributes<HTMLButtonElement>;
    dragging: boolean;
  };
}

const Thumb = memo(function Thumb({
  page,
  number,
  sourcePages,
  renderer,
  current,
  selected,
  large,
  onActivate,
  onToggle,
  onOpen,
  sortable,
}: ThumbProps) {
  const t = useTranslations('editPdf');
  const tw = useTranslations('workspace');
  const { ref, inView } = useInView({ rootMargin: '300px 0px' });
  const size = pageVisualSize(page, sourcePages);
  const sourceIndex = page.source.kind === 'source' ? page.source.index : -1;
  const rotation = sourceIndex >= 0 ? (sourcePages[sourceIndex].rotate + page.rotation) % 360 : 0;
  const [url, setUrl] = useState<string | undefined>(() =>
    sourceIndex >= 0 ? renderer.get(sourceIndex, rotation) : undefined,
  );

  useEffect(() => {
    if (sourceIndex < 0) return;
    setUrl(renderer.get(sourceIndex, rotation));
    if (!inView) return;
    return renderer.subscribe(sourceIndex, rotation, setUrl);
  }, [renderer, sourceIndex, rotation, inView]);

  return (
    <div
      ref={(node) => {
        ref(node);
        sortable?.setNodeRef(node);
      }}
      style={sortable?.style}
      className={`relative rounded-lg ${selected ? 'bg-orange-50' : ''} ${sortable?.dragging ? 'z-10 opacity-60' : ''}`}
    >
      <button
        type="button"
        {...sortable?.handle}
        onClick={(e) => onActivate(page.id, e.shiftKey)}
        aria-label={large ? tw('pages.select', { number }) : t('pages.thumb', { number })}
        aria-current={current ? 'page' : undefined}
        aria-pressed={large ? selected : undefined}
        className={`group flex w-full flex-col items-center gap-1 rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
          sortable ? 'cursor-grab touch-manipulation active:cursor-grabbing' : ''
        }`}
      >
        <span
          className={`relative block w-full overflow-hidden rounded bg-white shadow-sm ring-offset-1 transition ${
            large ? 'max-w-[160px]' : 'max-w-[96px]'
          } ${current || selected ? 'ring-2 ring-[#FF6B35]' : 'ring-1 ring-gray-200 group-hover:ring-[#FF8B68]'}`}
          style={{ aspectRatio: `${size.width} / ${size.height}` }}
        >
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="absolute inset-0 h-full w-full" draggable={false} />
          )}
          {page.crop && <span aria-hidden="true" className="absolute" style={cropShadeStyle(page.crop)} />}
        </span>
        <span className={`text-xs ${current ? 'font-semibold text-[#E85A2B]' : 'text-gray-500'}`}>{number}</span>
      </button>

      {/* The checkbox: its own 44 px target over the picture's corner, never inside the picture's button */}
      <label className="absolute start-0 top-0 flex h-11 w-11 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => undefined}
          onClick={(e) => onToggle(page.id, e.shiftKey)}
          aria-label={tw('pages.select', { number })}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 items-center justify-center rounded border shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF6B35] ${
            selected ? 'border-[#FF6B35] bg-[#FF6B35] text-white' : 'border-gray-300 bg-white/90'
          }`}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </label>

      {onOpen && (
        <button
          type="button"
          onClick={() => onOpen(page.id)}
          aria-label={tw('pages.open', { number })}
          title={tw('pages.open', { number })}
          className="absolute end-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 hover:text-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 shadow-sm">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
});

/** A thumbnail of the sortable grid. */
function SortableThumb(props: Omit<ThumbProps, 'sortable'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.page.id });
  return (
    <Thumb
      {...props}
      sortable={{
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        handle: { ...attributes, ...listeners } as HTMLAttributes<HTMLButtonElement>,
        dragging: isDragging,
      }}
    />
  );
}

interface PageStripProps {
  pages: readonly EditorPage[];
  sourcePages: readonly SourcePageInfo[];
  currentPageId: PageId;
  renderer: ThumbnailRenderer;
  selectedIds: ReadonlySet<PageId>;
  /** A tap on a picture (shift held or not). */
  onActivate: (pageId: PageId, shift: boolean) => void;
  /** The checkbox. */
  onToggle: (pageId: PageId, range: boolean) => void;
  /** Large grid: the Open button on each page. */
  onOpen?: (pageId: PageId) => void;
  /** Large grid: a page dropped at `index`. */
  onMove?: (pageId: PageId, index: number) => void;
  layout: 'column' | 'grid';
  /** Grid only: 'large' = the All pages view. */
  size?: 'small' | 'large';
}

export function PageStrip({ pages, sourcePages, currentPageId, renderer, selectedIds, onActivate, onToggle, onOpen, onMove, layout, size = 'small' }: PageStripProps) {
  const large = layout === 'grid' && size === 'large';
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A long press picks a page up on touch screens, so a swipe still scrolls the grid.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const items = pages.map((page, i) => {
    const props = {
      page,
      number: i + 1,
      sourcePages,
      renderer,
      current: page.id === currentPageId,
      selected: selectedIds.has(page.id),
      large,
      onActivate,
      onToggle,
      onOpen,
    };
    return <li key={page.id}>{large && onMove ? <SortableThumb {...props} /> : <Thumb {...props} />}</li>;
  });

  if (!large || !onMove) {
    return <ol className={layout === 'grid' ? 'grid grid-cols-3 gap-2' : 'flex flex-col gap-2'}>{items}</ol>;
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const index = pages.findIndex((p) => p.id === over.id);
    if (index >= 0) onMove(String(active.id), index);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
        <ol className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">{items}</ol>
      </SortableContext>
    </DndContext>
  );
}
