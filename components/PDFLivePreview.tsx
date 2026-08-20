'use client';

import { useState, useEffect, useRef } from 'react';
import { initializePdfJsWorker } from '@/lib/pdfjs-init';

interface PDFLivePreviewProps {
    file: File | null;
    pageNumber?: number;
    children?: React.ReactNode;
    className?: string;
}

export function PDFLivePreview({ file, pageNumber = 1, children, className = '' }: PDFLivePreviewProps) {

    const [scale, setScale] = useState(1);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isComplete = false;
        let pdf: any = null;
        let renderTask: any = null;

        const renderPdf = async () => {
            if (!file || !canvasRef.current || !containerRef.current) return;

            try {
                const pdfjsLib = await initializePdfJsWorker();
                if (!pdfjsLib) return;

                const arrayBuffer = await file.arrayBuffer();
                pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                // Ensure page number is within bounds
                const safePageNum = Math.min(Math.max(1, pageNumber), pdf.numPages);
                const page = await pdf.getPage(safePageNum);

                // Calculate scale to fit container width
                const containerWidth = containerRef.current.clientWidth;
                const unscaledViewport = page.getViewport({ scale: 1 });
                const calculatedScale = containerWidth / unscaledViewport.width;
                if (!isComplete) {
                    setScale(calculatedScale);
                    setDimensions({ width: unscaledViewport.width, height: unscaledViewport.height });
                }

                const viewport = page.getViewport({ scale: calculatedScale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                if (canvas && context) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context,
                        viewport: viewport
                    };

                    renderTask = page.render(renderContext);
                    await renderTask.promise;
                }
            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error('Error rendering PDF preview:', err);
                }
            }
        };

        renderPdf();

        return () => {
            isComplete = true;
            if (renderTask) renderTask.cancel();
            if (pdf) pdf.destroy();
        };
    }, [file, pageNumber]);

    if (!file) {
        return null;
    }

    return (
        <div ref={containerRef} className={`relative w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex justify-center ${className}`}>
            <div className="relative shadow-lg" style={{ lineHeight: 0 }}>
                <canvas ref={canvasRef} className="block" />

                {/* Floating CSS Overlays matching true PDF Point coordinate system */}
                <div
                    className="absolute top-0 left-0 z-10 pointer-events-none origin-top-left"
                    style={{
                        width: `${dimensions.width}px`,
                        height: `${dimensions.height}px`,
                        transform: `scale(${scale})`
                    }}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
