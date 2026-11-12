'use client';

/**
 * One page of the shared pdf.js document, drawn at an exact CSS size. Follows
 * CropPDFPreview (sharp on high-density screens, cancel-safe), with two
 * changes: it takes the editor's shared document instead of opening its own,
 * and every render draws into a fresh canvas that replaces the old one only
 * when it is finished, so zooming never flashes a blank page and a cancelled
 * render can never scribble on a canvas in use. The backing store is capped at
 * MAX_CANVAS_PIXELS (iOS Safari draws nothing above about 16.7 MP).
 */
import { memo, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { canvasBackingSize } from './interaction';

interface PageCanvasProps {
  pdf: PDFDocumentProxy;
  /** 0-based page index in the file. */
  sourceIndex: number;
  /** The page's own /Rotate plus the editor's turns, degrees clockwise. */
  rotation: number;
  /** The CSS size to draw at (the visual page, fit to width, times the zoom). */
  cssWidth: number;
  cssHeight: number;
}

const isCancelled = (error: unknown) => {
  const e = error as { name?: string; message?: string } | null;
  return e?.name === 'RenderingCancelledException' || /cancel/i.test(e?.message ?? '');
};

function PageCanvasImpl({ pdf, sourceIndex, rotation, cssWidth, cssHeight }: PageCanvasProps) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (cssWidth <= 0 || cssHeight <= 0) return;
    let cancelled = false;
    let task: RenderTask | null = null;
    // Wait for the size to settle (ResizeObserver can fire in bursts).
    const timer = window.setTimeout(async () => {
      try {
        const page = await pdf.getPage(sourceIndex + 1);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1, rotation: ((rotation % 360) + 360) % 360 });
        const viewport = page.getViewport({ scale: cssWidth / base.width, rotation: ((rotation % 360) + 360) % 360 });
        const backing = canvasBackingSize(cssWidth, cssHeight, window.devicePixelRatio || 1);
        const canvas = document.createElement('canvas');
        canvas.width = backing.width;
        canvas.height = backing.height;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
        const context = canvas.getContext('2d');
        if (!context) throw new Error('No 2D canvas context');
        const sx = backing.width / viewport.width;
        const sy = backing.height / viewport.height;
        task = page.render({ canvasContext: context, viewport, transform: [sx, 0, 0, sy, 0, 0] });
        await task.promise;
        task = null;
        if (cancelled || !holderRef.current) {
          canvas.width = 0;
          canvas.height = 0;
          return;
        }
        const old = holderRef.current.firstElementChild as HTMLCanvasElement | null;
        holderRef.current.replaceChildren(canvas);
        if (old) {
          // Release the old backing store now; iOS keeps canvas memory until it is zeroed.
          old.width = 0;
          old.height = 0;
        }
        setDrawn(true);
        setFailed(false);
      } catch (error) {
        if (cancelled || isCancelled(error)) return;
        console.error('edit-pdf: page render failed', error);
        setFailed(true);
      }
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (task) {
        try {
          task.cancel();
        } catch {
          // already finished
        }
      }
    };
  }, [pdf, sourceIndex, rotation, cssWidth, cssHeight]);

  // A different page or a turn: the old drawing would show stretched, so show the spinner until it is redrawn.
  useEffect(() => {
    setDrawn(false);
    holderRef.current?.replaceChildren();
  }, [pdf, sourceIndex, rotation]);

  return (
    <div className="absolute inset-0 bg-white" aria-hidden="true">
      <div ref={holderRef} className="absolute inset-0" />
      {!drawn && !failed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#FF6B35]" />
        </div>
      )}
    </div>
  );
}

export const PageCanvas = memo(PageCanvasImpl);
