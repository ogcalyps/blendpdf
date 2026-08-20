'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { getPdfJs } from '@/lib/pdfjs-init';
import { useInView } from 'react-intersection-observer';
import { Check, FileText, GripVertical } from 'lucide-react';


interface PDFThumbnailProps {
  file: File;
  pageNumber: number;
  isSelected?: boolean;
  onToggle?: () => void;
  showCheckbox?: boolean;
  showPageNumber?: boolean;
  showDragHandle?: boolean;
  thumbnailWidth?: number;
  enableLazyLoading?: boolean;
}

function PDFThumbnailComponent({
  file,
  pageNumber,
  isSelected = false,
  onToggle,
  showCheckbox = false,
  showPageNumber = true,
  showDragHandle = false,
  thumbnailWidth = 120,
  enableLazyLoading = true,
}: PDFThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [previewRendered, setPreviewRendered] = useState(false);
  const isMountedRef = useRef(true);
  const isRenderingRef = useRef(false);
  const isPreviewRenderingRef = useRef(false);
  const arrayBufferRef = useRef<ArrayBuffer | null>(null);
  const pdfRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const previewRenderTaskRef = useRef<any>(null);

  // Lazy loading: only render when in viewport
  const { ref, inView } = useInView({
    triggerOnce: true, // Only load once when in viewport
    threshold: 0.1,
    skip: !enableLazyLoading, // Skip if lazy loading is disabled
  });

  // Effect for when lazy loading is DISABLED - render immediately
  useEffect(() => {
    if (!enableLazyLoading && !hasRendered && !isRenderingRef.current && file) {
      console.log('[PDFThumbnail] Lazy loading disabled - rendering immediately', { file: file?.name, pageNumber, hasRendered, isRendering: isRenderingRef.current });
      // Use setTimeout to ensure this runs after state updates
      const timer = setTimeout(() => {
        if (!hasRendered && !isRenderingRef.current) {
          renderPageThumbnail();
        }
      }, 0);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, pageNumber, enableLazyLoading, hasRendered]);

  // Effect for when lazy loading is ENABLED - render when in viewport
  useEffect(() => {
    if (enableLazyLoading && inView && !hasRendered && !isRenderingRef.current && file) {
      console.log('[PDFThumbnail] Lazy loading enabled - rendering now in viewport', { file: file?.name, pageNumber, inView });
      renderPageThumbnail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, pageNumber, inView, enableLazyLoading]);

  // Reset hasRendered when file or pageNumber changes
  useEffect(() => {
    // Cancel any ongoing render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (e) {
        // Ignore cancellation errors
      }
      renderTaskRef.current = null;
    }

    // Cancel preview render task
    if (previewRenderTaskRef.current) {
      try {
        previewRenderTaskRef.current.cancel();
      } catch (e) {
        // Ignore cancellation errors
      }
      previewRenderTaskRef.current = null;
    }

    setHasRendered(false);
    setPreviewRendered(false);
    setLoading(true);
    setError(false);
    isMountedRef.current = true;
    isRenderingRef.current = false;
    isPreviewRenderingRef.current = false;

    // Clear cached data when file changes
    arrayBufferRef.current = null;
    pdfRef.current = null;
  }, [file, pageNumber]);

  // Cleanup on unmount
  useEffect(() => {
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
      // Cancel preview render task
      if (previewRenderTaskRef.current) {
        try {
          previewRenderTaskRef.current.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
        previewRenderTaskRef.current = null;
      }
    };
  }, []);

  // Render preview on hover
  useEffect(() => {
    if (isHovered && hasRendered && !isPreviewRenderingRef.current && pdfRef.current) {
      // Small delay to ensure canvas ref is ready
      const timer = setTimeout(() => {
        if (previewCanvasRef.current && isHovered && pdfRef.current) {
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
  }, [isHovered, hasRendered]);

  async function renderPageThumbnail() {
    if (!canvasRef.current) {
      console.log('[PDFThumbnail] No canvas ref, skipping render');
      return;
    }

    // Cancel any previous render task and WAIT for it to fully settle before
    // reusing the canvas. Simply calling .cancel() sends a signal but the
    // canvas is still "in use" until the promise resolves/rejects.
    if (renderTaskRef.current) {
      console.log('[PDFThumbnail] Cancelling previous render task');
      const prevTask = renderTaskRef.current;
      renderTaskRef.current = null;
      try {
        prevTask.cancel();
        await prevTask.promise;
      } catch (e) {
        // RenderingCancelledException is expected — ignore it
      }
    }

    // Prevent concurrent renders
    if (isRenderingRef.current) {
      console.log('[PDFThumbnail] Already rendering, skipping...');
      return;
    }

    console.log('[PDFThumbnail] Starting renderPageThumbnail for page', pageNumber);
    isRenderingRef.current = true;
    setHasRendered(false); // Reset so we can retry if this one gets cancelled

    // Validate pageNumber - must be 1-indexed (1, 2, 3...)
    if (!pageNumber || pageNumber < 1 || !Number.isInteger(pageNumber)) {
      console.error('[PDFThumbnail] Invalid pageNumber (must be >= 1):', pageNumber, typeof pageNumber);
      isRenderingRef.current = false;
      setError(true);
      setLoading(false);
      return;
    }

    console.log(`[PDFThumbnail] Starting render for pageNumber=${pageNumber}`);

    // Validate file
    if (!file || !(file instanceof File)) {
      console.error('[PDFThumbnail] Invalid file:', file);
      isRenderingRef.current = false;
      setError(true);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(false);

      // Load PDF with error handling - cache arrayBuffer to avoid reading File multiple times
      let arrayBuffer: ArrayBuffer;

      // Use cached arrayBuffer if available (same file)
      if (arrayBufferRef.current) {
        console.log('[PDFThumbnail] Using cached arrayBuffer');
        arrayBuffer = arrayBufferRef.current;
      } else {
        try {
          console.log('[PDFThumbnail] Reading file.arrayBuffer()...');
          arrayBuffer = await file.arrayBuffer();
          // Cache it for this file
          arrayBufferRef.current = arrayBuffer;
        } catch (fileError) {
          console.error('[PDFThumbnail] Failed to read file:', fileError);
          isRenderingRef.current = false;
          setError(true);
          setLoading(false);
          return;
        }
      }

      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        console.error('[PDFThumbnail] File is empty');
        isRenderingRef.current = false;
        setError(true);
        setLoading(false);
        return;
      }

      // Load PDF document - cache PDF object to avoid reloading
      let pdf;

      // Use cached PDF if available (same file)
      if (pdfRef.current) {
        console.log('[PDFThumbnail] Using cached PDF object');
        pdf = pdfRef.current;
      } else {
        try {
          console.log('[PDFThumbnail] Loading PDF document...');
          const loadingTask = (await getPdfJs()).getDocument({ data: arrayBuffer });
          pdf = await loadingTask.promise;
          // Cache it for this file
          pdfRef.current = pdf;
        } catch (pdfError) {
          console.error('[PDFThumbnail] Failed to load PDF:', pdfError);
          isRenderingRef.current = false;
          setError(true);
          setLoading(false);
          return;
        }
      }

      // Validate PDF is loaded
      if (!pdf) {
        console.error('[PDFThumbnail] PDF is not properly loaded');
        isRenderingRef.current = false;
        setError(true);
        setLoading(false);
        return;
      }

      // Get page count - this should be available immediately after promise resolves
      const numPages = pdf.numPages;

      console.log(`[PDFThumbnail] PDF loaded: ${numPages} pages, requesting page ${pageNumber}`);

      if (!numPages || numPages === 0) {
        console.error('[PDFThumbnail] PDF has no pages');
        isRenderingRef.current = false;
        setError(true);
        setLoading(false);
        return;
      }

      // Validate page number is within bounds
      // Use pageNumber directly (1-indexed: 1, 2, 3...)
      console.log(`[PDFThumbnail] Validating: pageNumber=${pageNumber}, numPages=${numPages}`);

      // Strict validation - pageNumber must be exactly within bounds
      if (pageNumber < 1) {
        console.error(`[PDFThumbnail] Page number ${pageNumber} is less than 1. pageNumber must be >= 1`);
        isRenderingRef.current = false;
        setError(true);
        setLoading(false);
        return;
      }

      if (pageNumber > numPages) {
        console.error(`[PDFThumbnail] Page number ${pageNumber} is > numPages ${numPages}. pageNumber must be <= ${numPages}`);
        isRenderingRef.current = false;
        setError(true);
        setLoading(false);
        return;
      }

      // Ensure it's an integer
      if (!Number.isInteger(pageNumber)) {
        console.error(`[PDFThumbnail] Page number ${pageNumber} is not an integer`);
        isRenderingRef.current = false;
        setError(true);
        setLoading(false);
        return;
      }

      // Get specific page - use pageNumber directly (1-indexed)
      let page;
      try {
        console.log(`[PDFThumbnail] Calling pdf.getPage(${pageNumber}) for page ${pageNumber}`);
        console.log(`[PDFThumbnail] PDF has ${numPages} pages, valid page numbers are 1-${numPages}`);
        page = await pdf.getPage(pageNumber);
        console.log(`[PDFThumbnail] Successfully retrieved page ${pageNumber}`);
      } catch (pageError: any) {
        console.error(`[PDFThumbnail] pdf.getPage(${pageNumber}) failed:`, {
          error: pageError,
          message: pageError?.message,
          name: pageError?.name,
          pageNumber,
          numPages,
          pageNumberType: typeof pageNumber,
          pageNumberValue: pageNumber,
        });
        isRenderingRef.current = false;
        setError(true);
        setLoading(false);
        return;
      }

      if (!page) {
        console.error(`Page ${pageNumber} is null or undefined`);
        setError(true);
        setLoading(false);
        return;
      }

      // Calculate scale to fit thumbnail
      const viewport = page.getViewport({ scale: 1 });
      const scale = thumbnailWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      // Setup canvas
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        setError(true);
        setLoading(false);
        return;
      }

      // Set canvas size (accounting for device pixel ratio for crisp rendering)
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(scaledViewport.width * outputScale);
      canvas.height = Math.floor(scaledViewport.height * outputScale);
      canvas.style.width = Math.floor(scaledViewport.width) + 'px';
      canvas.style.height = Math.floor(scaledViewport.height) + 'px';

      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

      // Render PDF page
      const renderTask = page.render({
        canvasContext: context,
        transform: transform,
        viewport: scaledViewport,
      });

      // Store render task so we can cancel it if needed
      renderTaskRef.current = renderTask;

      try {
        await renderTask.promise;

        // Only update state if component is still mounted and render wasn't cancelled
        if (isMountedRef.current && canvasRef.current && renderTaskRef.current === renderTask) {
          console.log('[PDFThumbnail] Render completed successfully');
          setLoading(false);
          setHasRendered(true);
          renderTaskRef.current = null;
          isRenderingRef.current = false;
        }
      } catch (renderError: any) {
        // Check if this is a cancellation error (expected when we cancel renders)
        if (renderError?.name === 'RenderingCancelledException' ||
          renderError?.message?.includes('Rendering cancelled') ||
          renderError?.message?.includes('cancelled')) {
          // This is expected - render was cancelled, retry automatically
          console.log('[PDFThumbnail] Render cancelled (expected) - will retry automatically');
          if (isMountedRef.current) {
            // Clear the render task ref
            if (renderTaskRef.current === renderTask) {
              renderTaskRef.current = null;
            }
            // Reset rendering flag so new renders can proceed
            isRenderingRef.current = false;
            // Don't set hasRendered to true - allow retry
            setHasRendered(false);
            // Automatically retry after a short delay
            setTimeout(() => {
              if (isMountedRef.current && !hasRendered && !isRenderingRef.current && canvasRef.current) {
                console.log('[PDFThumbnail] Auto-retrying render after cancellation');
                renderPageThumbnail();
              }
            }, 100);
          }
          return; // Don't treat cancellation as an error, but don't continue
        }

        // This is a real error, not a cancellation
        throw renderError;
      }
    } catch (error: any) {
      // Only log and show error if it's not a cancellation
      if (error?.name !== 'RenderingCancelledException' &&
        !error?.message?.includes('Rendering cancelled') &&
        !error?.message?.includes('cancelled')) {
        console.error('[PDFThumbnail] Error rendering PDF thumbnail:', error);
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setError(true);
          setLoading(false);
        }
      }
    } finally {
      isRenderingRef.current = false;
    }
  }

  async function renderPreview() {
    if (!previewCanvasRef.current || !hasRendered || !pdfRef.current) return;

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
        // Expected cancellation, ignore
        isPreviewRenderingRef.current = false;
        return;
      }
      console.error('[PDFThumbnail] Error rendering preview:', error);
      isPreviewRenderingRef.current = false;
    }
  }

  // Error fallback
  if (error) {
    return (
      <div className="aspect-[8.5/11] rounded-lg border border-gray-300 bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
        <FileText className="w-12 h-12 text-gray-400" />
        <p className="text-xs text-gray-500 mt-2">Preview unavailable</p>
        {showPageNumber && (
          <div className="absolute top-2 end-2 px-2 py-1 bg-gray-900 bg-opacity-75 text-white text-xs font-bold rounded">
            {pageNumber}
          </div>
        )}
      </div>
    );
  }

  const containerClasses = onToggle
    ? `group relative cursor-pointer transition-all ${isSelected
      ? 'border-[3px] border-blue-500 bg-blue-50'
      : 'border-2 border-gray-200 hover:border-blue-300 hover:shadow-md'
    } rounded-xl p-2`
    : 'group relative rounded-xl p-2';

  return (
    <div
      ref={enableLazyLoading ? ref : undefined}
      onClick={onToggle}
      className={containerClasses}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover Preview Tooltip */}
      {isHovered && hasRendered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-2">
            <div className="rounded border border-gray-200 bg-white relative overflow-hidden">
              <canvas
                ref={previewCanvasRef}
                className="block"
              />
              {(!previewRendered || !previewCanvasRef.current || previewCanvasRef.current.width === 0) && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100" style={{ minWidth: '300px', minHeight: '388px' }}>
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

      {/* Checkbox overlay */}
      {showCheckbox && (
        <div
          className={`absolute top-3 start-3 z-10 ${isSelected ? '' : 'opacity-0 group-hover:opacity-100'
            } transition-opacity`}
        >
          {isSelected ? (
            <div className="w-6 h-6 bg-blue-500 rounded-md flex items-center justify-center">
              <Check className="w-4 h-4 text-white" strokeWidth={3} />
            </div>
          ) : (
            <div className="w-6 h-6 bg-white border-2 border-gray-400 rounded-md"></div>
          )}
        </div>
      )}

      {/* Page number badge */}
      {showPageNumber && (
        <div className="absolute top-3 end-3 z-10 px-2 py-1 bg-gray-900 bg-opacity-75 text-white text-xs font-bold rounded">
          {pageNumber}
        </div>
      )}

      {/* Canvas for PDF rendering */}
      <div className="rounded-lg border border-gray-300 bg-white relative overflow-hidden flex items-center justify-center aspect-[8.5/11]">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="max-w-full h-auto"
          style={{ display: loading ? 'none' : 'block' }}
        />
      </div>

      {/* Drag handle (optional for future reordering) */}
      {showDragHandle && (
        <div className="absolute bottom-2 end-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <GripVertical className="w-5 h-5 text-gray-500" />
        </div>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const PDFThumbnail = memo(PDFThumbnailComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.pageNumber === nextProps.pageNumber &&
    prevProps.file === nextProps.file
  );
});

