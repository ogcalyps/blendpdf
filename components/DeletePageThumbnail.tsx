'use client';

import { useEffect, useRef, useState } from 'react';
import { getPdfJs } from '@/lib/pdfjs-init';
import { X, Check, Trash2 } from 'lucide-react';


interface DeletePageThumbnailProps {
  file: File;
  pageNumber: number;
  isMarkedForDeletion: boolean;
  onToggle: () => void;
}

export function DeletePageThumbnail({ file, pageNumber, isMarkedForDeletion, onToggle }: DeletePageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [previewRendered, setPreviewRendered] = useState(false);
  const renderTaskRef = useRef<any>(null);
  const previewRenderTaskRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isRenderingRef = useRef(false);
  const isPreviewRenderingRef = useRef(false);
  const pdfRef = useRef<any>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
      if (previewRenderTaskRef.current) {
        previewRenderTaskRef.current.cancel();
      }
      pdfRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isRenderingRef.current) return;
    renderPageThumbnail();
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
    if (!canvasRef.current || !file) return;
    if (isRenderingRef.current) {
      // Cancel and WAIT for the previous task to settle before reusing the canvas
      if (renderTaskRef.current) {
        const prevTask = renderTaskRef.current;
        renderTaskRef.current = null;
        try {
          prevTask.cancel();
          await prevTask.promise;
        } catch (e) {
          // RenderingCancelledException is expected — ignore it
        }
        isRenderingRef.current = false;
      }
    }

    try {
      isRenderingRef.current = true;
      setLoading(true);

      let arrayBuffer: ArrayBuffer;
      let pdf: any;

      // Use cached PDF if available
      if (pdfRef.current) {
        pdf = pdfRef.current;
      } else {
        arrayBuffer = await file.arrayBuffer();
        pdf = await (await getPdfJs()).getDocument({ data: arrayBuffer }).promise;
        pdfRef.current = pdf;
      }

      if (!isMountedRef.current) return;

      const page = await pdf.getPage(pageNumber);

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

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderTask = page.render({
        canvasContext: context,
        transform: transform,
        viewport: scaledViewport,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;

      if (isMountedRef.current) {
        setLoading(false);
        isRenderingRef.current = false;
      }
    } catch (error: any) {
      if (isMountedRef.current) {
        // Handle cancellation gracefully
        if (error?.name === 'RenderingCancelledException' || error?.message?.includes('cancelled')) {
          // Retry after a short delay
          setTimeout(() => {
            if (isMountedRef.current && !isRenderingRef.current) {
              renderPageThumbnail();
            }
          }, 100);
        } else {
          console.error('Error rendering PDF thumbnail:', error);
          setLoading(false);
          isRenderingRef.current = false;
        }
      }
    }
  }

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative cursor-pointer transition-all ${isMarkedForDeletion
          ? 'border-3 border-red-500 bg-red-50'
          : 'border-2 border-gray-200 bg-white hover:border-blue-500 hover:shadow-lg'
        } rounded-xl p-3`}
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

      {/* Page number badge */}
      <div className={`absolute -top-2 -start-2 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold z-10 ${isMarkedForDeletion ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
        }`}>
        {pageNumber}
      </div>

      {/* Selection indicator */}
      <div className={`absolute -top-2 -end-2 w-8 h-8 rounded-full flex items-center justify-center z-10 transition-all ${isMarkedForDeletion
          ? 'bg-red-500 text-white scale-100'
          : 'bg-white border-2 border-gray-400 opacity-0 group-hover:opacity-100 scale-90'
        }`}>
        {isMarkedForDeletion ? (
          <Check className="w-5 h-5" strokeWidth={3} />
        ) : (
          <X className="w-5 h-5 text-gray-600" strokeWidth={2} />
        )}
      </div>

      {/* Canvas with overlay if marked for deletion */}
      <div className="rounded-lg border border-gray-300 bg-white relative overflow-hidden flex items-center justify-center aspect-[8.5/11]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Red overlay if marked for deletion */}
        {isMarkedForDeletion && !loading && (
          <div className="absolute inset-0 bg-red-500 opacity-40 z-10"></div>
        )}

        <canvas
          ref={canvasRef}
          className={`max-w-full h-auto ${isMarkedForDeletion ? 'opacity-60' : ''}`}
        />
      </div>

      {/* Delete icon overlay */}
      {isMarkedForDeletion && !loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="bg-red-500 rounded-full p-3">
            <Trash2 className="w-8 h-8 text-white" />
          </div>
        </div>
      )}

    </div>
  );
}

