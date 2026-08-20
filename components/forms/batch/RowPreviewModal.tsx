'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { PDFLivePreview } from '@/components/PDFLivePreview';

interface RowPreviewModalProps {
    rowNumber: number;
    file: File | null;
    loading: boolean;
    error: string | null;
    onClose: () => void;
}

/**
 * Renders a single grid row through the real fill pipeline and shows the
 * resulting PDF so users can verify one before generating fifty. Page
 * next/prev is clamped inside PDFLivePreview, so paging past the end simply
 * re-renders the last page.
 */
export function RowPreviewModal({ rowNumber, file, loading, error, onClose }: RowPreviewModalProps) {
    const [page, setPage] = useState(1);

    useEffect(() => {
        setPage(1);
    }, [file]);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
                <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
                    <h3 className="text-xl font-bold text-gray-900">Preview — row {rowNumber}</h3>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1 || !file}
                            title="Previous page"
                            className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-transparent transition"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-medium text-gray-500 min-w-[4.5rem] text-center">Page {page}</span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!file}
                            title="Next page"
                            className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 disabled:text-gray-300 disabled:hover:bg-transparent transition"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <button
                            onClick={onClose}
                            className="ml-2 p-2 text-gray-400 hover:text-gray-800 transition rounded-full hover:bg-gray-100"
                        >
                            <X size={22} />
                        </button>
                    </div>
                </div>

                <div className="overflow-y-auto p-6 flex-1">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                            <Loader2 className="animate-spin text-blue-600" size={32} />
                            <p className="font-medium">Generating preview...</p>
                        </div>
                    )}
                    {!loading && error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                            Could not generate this row: {error}
                        </div>
                    )}
                    {!loading && !error && <PDFLivePreview file={file} pageNumber={page} />}
                </div>
            </div>
        </div>
    );
}
