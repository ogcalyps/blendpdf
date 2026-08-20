'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getPdfJs } from '@/lib/pdfjs-init';

/**
 * A crop selection expressed as fractions of the rendered (rotated) page,
 * origin top-left. Storing fractions lets the same selection be re-applied
 * to pages of different sizes and survive canvas re-renders/resizes.
 */
export interface CropSelection {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Minimum selection size in CSS pixels before a drag counts as a selection. */
const MIN_SELECTION_CSS_PX = 20;

interface CropPDFPreviewProps {
  fileUrl: string;
  pageNumber: number;
  selection: CropSelection | null;
  onSelectionChange: (selection: CropSelection | null) => void;
  /** Reports the current page's visual size in PDF points (rotation baked in). */
  onPageInfo?: (info: { pdfWidth: number; pdfHeight: number }) => void;
}

export function CropPDFPreview({
  fileUrl,
  pageNumber,
  selection,
  onSelectionChange,
  onPageInfo,
}: CropPDFPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Rendered canvas size in CSS pixels — the coordinate space of the overlay.
  const [cssSize, setCssSize] = useState<{ width: number; height: number } | null>(null);
  // Container width drives the fit-to-container scale; updated by ResizeObserver.
  const [targetWidth, setTargetWidth] = useState(0);
  // In-progress drag, in CSS pixels relative to the overlay.
  const [drag, setDrag] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  // Track container width so the render scale follows the layout.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setTargetWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        if (width > 0) setTargetWidth(width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const renderPage = useCallback(async () => {
    if (!canvasRef.current || !fileUrl || targetWidth <= 0) return;

    try {
      // Cancel any previous render task and WAIT for it to fully settle
      // before reusing the canvas (see RotatePDFThumbnail for rationale).
      if (renderTaskRef.current) {
        const prevTask = renderTaskRef.current;
        renderTaskRef.current = null;
        try {
          prevTask.cancel();
          await prevTask.promise;
        } catch {
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

      const page = await pdfRef.current.getPage(pageNumber);

      if (!isMountedRef.current || !canvasRef.current) return;

      // pdfjs renders from the page's CropBox with /Rotate baked in — the
      // viewport at scale 1 is the visual page in PDF points.
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(targetWidth, 760) / baseViewport.width;
      const scaledViewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context || !isMountedRef.current) return;

      const outputScale = window.devicePixelRatio || 1;
      const cssWidth = Math.floor(scaledViewport.width);
      const cssHeight = Math.floor(scaledViewport.height);
      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = cssWidth + 'px';
      canvas.style.height = cssHeight + 'px';

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

      const renderTask = page.render({
        canvasContext: context,
        transform,
        viewport: scaledViewport,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;

      if (isMountedRef.current) {
        renderTaskRef.current = null;
        setCssSize({ width: cssWidth, height: cssHeight });
        onPageInfo?.({ pdfWidth: baseViewport.width, pdfHeight: baseViewport.height });
        setLoading(false);
      }
    } catch (err: any) {
      if (err?.name === 'RenderingCancelledException' || err?.message?.includes('cancelled')) {
        return;
      }
      if (isMountedRef.current) {
        console.error('Error rendering PDF page:', err);
        setError(true);
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, pageNumber, targetWidth]);

  useEffect(() => {
    isMountedRef.current = true;
    renderPage();
    return () => {
      isMountedRef.current = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // Ignore cancellation errors
        }
        renderTaskRef.current = null;
      }
    };
  }, [renderPage]);

  // Drop the cached document when the file changes.
  useEffect(() => {
    return () => {
      const pdf = pdfRef.current;
      pdfRef.current = null;
      if (pdf) {
        try {
          pdf.destroy();
        } catch {
          // Ignore teardown errors
        }
      }
    };
  }, [fileUrl]);

  const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

  const pointFromEvent = (e: React.PointerEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: clamp(e.clientX - rect.left, rect.width),
      y: clamp(e.clientY - rect.top, rect.height),
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!cssSize || loading) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    overlayRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = pointFromEvent(e);
    setDrag({ startX: x, startY: y, curX: x, curY: y });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    e.preventDefault();
    const { x, y } = pointFromEvent(e);
    setDrag({ ...drag, curX: x, curY: y });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!drag || !cssSize) return;
    try {
      overlayRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore — capture may already be released
    }
    const left = Math.min(drag.startX, drag.curX);
    const top = Math.min(drag.startY, drag.curY);
    const width = Math.abs(drag.curX - drag.startX);
    const height = Math.abs(drag.curY - drag.startY);
    setDrag(null);

    if (width >= MIN_SELECTION_CSS_PX && height >= MIN_SELECTION_CSS_PX) {
      onSelectionChange({
        x: left / cssSize.width,
        y: top / cssSize.height,
        w: width / cssSize.width,
        h: height / cssSize.height,
      });
    } else {
      // Too small to be a deliberate selection — treat as "clear".
      onSelectionChange(null);
    }
  };

  // The rectangle to draw: the live drag if one is in progress, otherwise
  // the committed selection projected onto the current canvas size.
  let rect: { left: number; top: number; width: number; height: number } | null = null;
  if (drag) {
    rect = {
      left: Math.min(drag.startX, drag.curX),
      top: Math.min(drag.startY, drag.curY),
      width: Math.abs(drag.curX - drag.startX),
      height: Math.abs(drag.curY - drag.startY),
    };
  } else if (selection && cssSize) {
    rect = {
      left: selection.x * cssSize.width,
      top: selection.y * cssSize.height,
      width: selection.w * cssSize.width,
      height: selection.h * cssSize.height,
    };
  }

  return (
    <div ref={containerRef} className="w-full flex justify-center">
      {error ? (
        <div className="flex flex-col items-center justify-center p-12 text-gray-400">
          <svg className="w-10 h-10 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-center">Preview Error</p>
        </div>
      ) : (
        <div
          className="relative inline-block overflow-hidden rounded-lg border border-gray-200 bg-gray-50 shadow-sm"
          style={cssSize ? { width: cssSize.width, height: cssSize.height } : undefined}
        >
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <canvas ref={canvasRef} className="block" />
          {/* Drag overlay — touch-action:none so pointer events also work for touch */}
          <div
            ref={overlayRef}
            className="absolute inset-0 cursor-crosshair select-none"
            style={{ touchAction: 'none' }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => setDrag(null)}
          >
            {rect && rect.width > 0 && rect.height > 0 && (
              <div
                className="absolute border-2 border-[#FF6B35] pointer-events-none"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  // Masks everything outside the selection (clipped by the
                  // overflow-hidden wrapper) — the box-shadow trick.
                  boxShadow: '0 0 0 9999px rgba(17, 24, 39, 0.45)',
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
