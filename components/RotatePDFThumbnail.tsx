'use client';

import { useEffect, useRef, useState } from 'react';
import { getPdfJs } from '@/lib/pdfjs-init';


interface RotatePDFThumbnailProps {
  fileUrl: string;
  pageNumber: number;
  rotation: number;
  onRotate: (degrees: number) => void;
}

export function RotatePDFThumbnail({ fileUrl, pageNumber, rotation, onRotate }: RotatePDFThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [previewRendered, setPreviewRendered] = useState(false);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const previewRenderTaskRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const isPreviewRenderingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    renderPageThumbnail();

    return () => {
      isMountedRef.current = false;
      // Cancel any ongoing render task
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
  }, [fileUrl, pageNumber]);

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
    if (!canvasRef.current || !isMountedRef.current || !fileUrl) return;

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

      if (!pdfRef.current) {
        pdfRef.current = await (await getPdfJs()).getDocument(fileUrl).promise;
      }

      if (!isMountedRef.current) return;

      const pdf = pdfRef.current;
      const page = await pdf.getPage(pageNumber);

      if (!isMountedRef.current || !canvasRef.current) return;

      // Calculate scale to fit thumbnail (120px width)
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

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      // Store render task so we can cancel it if needed
      const renderTask = page.render({
        canvasContext: context,
        transform: transform,
        viewport: scaledViewport,
      });

      renderTaskRef.current = renderTask;

      await renderTask.promise;

      if (isMountedRef.current) {
        renderTaskRef.current = null;
        setLoading(false);
      }
    } catch (error: any) {
      // Ignore cancellation errors
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
    <div className="relative bg-white border border-gray-200 hover:border-orange-300 rounded-xl p-3 shadow-sm transition-all group">

      {/* Page number badge (top left) */}
      <div className="absolute -top-[10px] -left-[10px] w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold z-10 shadow-sm border-2 border-white">
        {pageNumber}
      </div>

      {/* Rotation indicator (top right) */}
      {rotation !== 0 && (
        <div className="absolute -top-[10px] -right-[10px] px-2 py-0.5 bg-[#00D06A] text-white text-[10px] font-bold rounded-full z-10 shadow-sm border-2 border-white">
          {rotation}°
        </div>
      )}

      {/* Canvas with rotation applied */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 relative overflow-hidden flex items-center justify-center aspect-[1/1.3] mb-3">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        )}
        {error ? (
          <div className="flex flex-col items-center justify-center p-4 text-gray-400">
            <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-[10px] text-center">Preview Error</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="max-w-[85%] max-h-[85%] object-contain"
            style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s ease-out' }}
          />
        )}
      </div>

      {/* Rotation controls (bottom) */}
      <div className="flex items-center justify-center gap-2 mt-auto">
        <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-1">
          <button
            onClick={() => onRotate(-90)}
            className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
            title="Rotate left 90°"
          >
            <svg className="w-4 h-4 text-gray-600 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <div className="w-px h-5 mx-1 bg-gray-300 self-center" />
          <button
            onClick={() => onRotate(90)}
            className="p-1.5 hover:bg-gray-200 rounded-md transition-colors"
            title="Rotate right 90°"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

