'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getPdfJs } from '@/lib/pdfjs-init';
import { GripVertical } from 'lucide-react';


interface ReorderPageThumbnailProps {
  file: File;
  pageNumber: number;
  position: number;
}

export function ReorderPageThumbnail({ file, pageNumber, position }: ReorderPageThumbnailProps) {
  const t = useTranslations();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [previewRendered, setPreviewRendered] = useState(false);
  const arrayBufferRef = useRef<ArrayBuffer | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const previewRenderTaskRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isPreviewRenderingRef = useRef(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pageNumber });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    isMountedRef.current = true;
    renderPageThumbnail();

    return () => {
      isMountedRef.current = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }
      if (previewRenderTaskRef.current) {
        try {
          previewRenderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        previewRenderTaskRef.current = null;
      }
    };
  }, [file, pageNumber]);

  // Render preview on hover
  useEffect(() => {
    if (isHovered && !loading && !isPreviewRenderingRef.current && pdfRef.current) {
      const timer = setTimeout(() => {
        if (previewCanvasRef.current && isHovered) {
          renderPreview();
        }
      }, 50);
      return () => clearTimeout(timer);
    } else if (!isHovered) {
      // Reset preview state when hover ends to allow re-rendering on next hover
      setPreviewRendered(false);
      // Cancel any ongoing preview render
      if (previewRenderTaskRef.current) {
        try {
          previewRenderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        previewRenderTaskRef.current = null;
      }
      isPreviewRenderingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered, loading]);

  async function renderPreview() {
    if (!previewCanvasRef.current || !pdfRef.current) return;

    // If already rendering, cancel the previous task and WAIT for it to
    // fully settle before reusing the canvas — calling .cancel() alone is
    // not enough; the canvas stays "in use" until the promise settles.
    if (previewRenderTaskRef.current) {
      const prevTask = previewRenderTaskRef.current;
      previewRenderTaskRef.current = null;
      try {
        prevTask.cancel();
        await prevTask.promise;
      } catch (e) {
        // RenderingCancelledException is expected — ignore it
      }
      isPreviewRenderingRef.current = false;
    }

    // Always re-render on hover (state is reset when hover ends)
    // This ensures the preview is fresh each time

    try {
      isPreviewRenderingRef.current = true;

      const pdf = pdfRef.current;
      const page = await pdf.getPage(pageNumber);

      // Use larger scale for preview (300px width)
      const previewWidth = 300;
      const viewport = page.getViewport({ scale: 1 });
      const scale = previewWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = previewCanvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) return;

      // Clear any existing canvas content before rendering
      // This ensures a clean state on each hover
      if (canvas.width > 0 && canvas.height > 0) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = Math.floor(scaledViewport.width) + 'px';
      canvas.style.height = Math.floor(scaledViewport.height) + 'px';

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderTask = page.render({
        canvasContext: context,
        transform: transform,
        viewport: scaledViewport,
      });

      previewRenderTaskRef.current = renderTask;
      await renderTask.promise;

      if (isMountedRef.current) {
        setPreviewRendered(true);
        isPreviewRenderingRef.current = false;
      }
    } catch (error: any) {
      if (error?.name === 'RenderingCancelledException' ||
        error?.message?.includes('cancelled')) {
        isPreviewRenderingRef.current = false;
        return;
      }
      console.error('Error rendering preview:', error);
      isPreviewRenderingRef.current = false;
    }
  }

  async function renderPageThumbnail() {
    if (!canvasRef.current || !isMountedRef.current) return;

    try {
      // Cancel any previous render task and WAIT for it to fully settle before
      // reusing the canvas. Simply calling .cancel() sends a signal but the
      // canvas is still "in use" until the promise resolves/rejects.
      if (renderTaskRef.current) {
        const prevTask = renderTaskRef.current;
        renderTaskRef.current = null;
        try {
          prevTask.cancel();
          await prevTask.promise;
        } catch (e) {
          // RenderingCancelledException is expected — ignore it
        }
      }

      if (!isMountedRef.current) return;

      setLoading(true);
      setError(false);

      // Cache arrayBuffer and pdf object
      if (!arrayBufferRef.current) {
        arrayBufferRef.current = await file.arrayBuffer();
      }
      if (!pdfRef.current) {
        pdfRef.current = await (await getPdfJs()).getDocument({ data: arrayBufferRef.current }).promise;
      }

      if (!isMountedRef.current) return;

      const pdf = pdfRef.current;
      const page = await pdf.getPage(pageNumber);

      if (!isMountedRef.current || !canvasRef.current) return;

      const viewport = page.getViewport({ scale: 1 });
      const scale = 120 / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context || !isMountedRef.current) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = Math.floor(scaledViewport.width) + 'px';
      canvas.style.height = Math.floor(scaledViewport.height) + 'px';

      const transformMatrix = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      const renderTask = page.render({
        canvasContext: context,
        transform: transformMatrix,
        viewport: scaledViewport,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;

      if (isMountedRef.current) {
        renderTaskRef.current = null;
        setLoading(false);
      }
    } catch (error: any) {
      if (error?.name === 'RenderingCancelledException' || error?.message?.includes('cancelled')) {
        return;
      }

      if (isMountedRef.current) {
        console.error('Error rendering PDF thumbnail:', error);
        setError(true);
        setLoading(false);
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-white border-2 border-gray-200 rounded-xl p-3 hover:border-blue-500 hover:shadow-lg transition-all cursor-move"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...attributes}
      {...listeners}
    >
      {/* Hover Preview Tooltip */}
      {isHovered && !loading && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-2">
            <div className="rounded border border-gray-200 bg-white relative overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                className="block"
                style={{ display: previewRendered ? 'block' : 'none' }}
              />
              {!previewRendered && (
                <div className="w-[300px] h-[388px] flex items-center justify-center bg-gray-100">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              )}
            </div>
            {/* Arrow pointing down */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
              <div className="w-4 h-4 bg-white border-r-2 border-b-2 border-gray-300 transform rotate-45"></div>
            </div>
          </div>
        </div>
      )}
      {/* Position badge (new order) */}
      <div className="absolute -top-2 -start-2 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold z-10">
        {position}
      </div>

      {/* Original page number (if different from position) */}
      {pageNumber !== position && (
        <div className="absolute -top-2 -end-2 px-2 py-1 bg-gray-700 text-white text-xs font-bold rounded-full z-10">
          {t('reorderPdf.wasPage', { page: pageNumber })}
        </div>
      )}

      {/* Drag handle icon */}
      <div className="absolute bottom-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GripVertical className="w-5 h-5 text-gray-500" />
      </div>

      {/* Canvas */}
      <div className="rounded-lg border border-gray-300 bg-white relative overflow-hidden flex items-center justify-center aspect-[8.5/11]">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
        {error ? (
          <div className="flex flex-col items-center justify-center p-4 text-gray-400">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-xs">Preview unavailable</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-w-full h-auto"
          />
        )}
      </div>
    </div>
  );
}

