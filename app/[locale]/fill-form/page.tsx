'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, FileText, FileSpreadsheet, Download, Settings, FileBox, AlertCircle, CalendarDays } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Button } from '@/components/ui/Button';
import { useTrackedDropzone } from '@/hooks/useTrackedDropzone';
import { validateFile, validateSpreadsheetFile, formatFileSize, downloadBlob } from '@/lib/utils';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { initializePdfJsWorker } from '@/lib/pdfjs-init';
import { useReviewAskAfterSuccess } from '@/hooks/useReviewAskAfterSuccess';
import { trackToolStart, trackToolComplete, trackToolError, responseError } from '@/lib/analytics';
import { substituteDateTokens, todayHijri, formatGregorianDate, TOKEN_TODAY, TOKEN_TODAY_HIJRI } from '@/lib/hijri';

const MAX_PDF_SIZE = 50 * 1024 * 1024;
const MAX_SHEET_SIZE = 10 * 1024 * 1024;
// Keep in sync with MAX_ROWS_PER_REQUEST in app/api/fill-form-chunk/route.ts
const MAX_ROWS = 50;

interface FieldWidget {
    rect: { x1: number, y1: number, x2: number, y2: number } | null;
    pageIndex: number;
}

interface PdfField {
    name: string;
    type: string;
    rawType?: string;
    rect?: { x1: number, y1: number, x2: number, y2: number } | null;
    pageIndex?: number;
    widgets?: FieldWidget[];
}

/** Format a JS Date as YYYY-MM-DD (Excel date cells arrive as Date objects with cellDates: true) */
function formatDateYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Interactive Preview Component
function PdfPreviewOverlay({
    file,
    fields,
    mapping,
    setMapping,
    sheetColumns
}: {
    file: File,
    fields: PdfField[],
    mapping: Record<string, string>,
    setMapping: (m: Record<string, string>) => void,
    sheetColumns: string[]
}) {
    const t = useTranslations();
    const [scale, setScale] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(1);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Start back at page 1 whenever a new file is loaded
    useEffect(() => {
        setCurrentPage(1);
        setNumPages(1);
    }, [file]);

    useEffect(() => {
        let isComplete = false;
        let pdf: any = null;

        const renderPdf = async () => {
            if (!file || !canvasRef.current || !containerRef.current) return;

            try {
                const pdfjsLib = await initializePdfJsWorker();
                if (!pdfjsLib) return;
                const arrayBuffer = await file.arrayBuffer();
                pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                if (!isComplete) setNumPages(pdf.numPages);
                const page = await pdf.getPage(Math.min(currentPage, pdf.numPages));

                // Calculate scale to fit container width
                const containerWidth = containerRef.current.clientWidth;
                const unscaledViewport = page.getViewport({ scale: 1 });
                const calculatedScale = containerWidth / unscaledViewport.width;
                if (!isComplete) setScale(calculatedScale);

                const viewport = page.getViewport({ scale: calculatedScale });
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');

                if (canvas) {
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    const renderContext = {
                        canvasContext: context!,
                        viewport: viewport
                    };

                    const renderTask = page.render(renderContext);

                    // We don't save the task, instead we wait for it to finish or be cancelled
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
            if (pdf) pdf.destroy();
        };
    }, [file, currentPage]);

    // Overlay boxes for the currently shown page only: one per widget so
    // multi-widget fields and multi-page forms map correctly
    const pageOverlays: Array<{ field: PdfField; rect: NonNullable<PdfField['rect']>; key: string }> = [];
    for (const field of fields) {
        const widgets: FieldWidget[] = field.widgets && field.widgets.length > 0
            ? field.widgets
            : [{ rect: field.rect ?? null, pageIndex: field.pageIndex ?? 0 }];

        widgets.forEach((widget, idx) => {
            if (!widget.rect) return;
            if (widget.pageIndex !== currentPage - 1) return;
            pageOverlays.push({ field, rect: widget.rect, key: `${field.name}-${idx}` });
        });
    }

    return (
        <div>
            {/* Page navigation */}
            {numPages > 1 && (
                <div className="flex items-center justify-center gap-4 mb-3">
                    <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t('fillForm.prevPage')}
                    </button>
                    <span className="text-sm font-medium text-gray-700">
                        {t('fillForm.pageOf', { current: currentPage, total: numPages })}
                    </span>
                    <button
                        type="button"
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages}
                        className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {t('fillForm.nextPage')}
                    </button>
                </div>
            )}

            <div ref={containerRef} className="relative w-full border border-gray-200 rounded-lg overflow-hidden bg-gray-50 flex justify-center">
                <div className="relative shadow-lg" style={{ lineHeight: 0 }}>
                    <canvas ref={canvasRef} className="block" />

                    {/* Field Overlays (current page only) */}
                    {pageOverlays.map(({ field, rect, key }) => {
                        // pdf-lib origin is bottom-left, pdfjs origin is top-left
                        // We must invert Y. Also rect is [x1, y1, x2, y2]
                        const width = (rect.x2 - rect.x1) * scale;
                        const height = (rect.y2 - rect.y1) * scale;
                        const left = rect.x1 * scale;
                        // Y calculation depends on unscaled page height, but an approximation using viewport height is:
                        // y = canvas.height - (y2 * scale)
                        const top = canvasRef.current ? canvasRef.current.height - (rect.y2 * scale) : 0;

                        const isMapped = !!mapping[field.name];

                        return (
                            <div
                                key={key}
                                className={`absolute border-2 rounded-sm flex items-center justify-center group overflow-visible transition-colors ${isMapped ? 'border-primary/60 bg-primary/10' : 'border-blue-500/60 bg-blue-500/10 hover:bg-blue-500/20'}`}
                                style={{
                                    left: `${left}px`,
                                    top: `${top}px`,
                                    width: `${width}px`,
                                    height: `${height}px`,
                                }}
                            >
                                <div className="hidden group-hover:flex absolute -bottom-10 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 shadow-xl rounded-md p-2 flex-col gap-1 w-[200px]">
                                    <span className="text-xs font-semibold text-gray-700 truncate">{field.name}</span>
                                    <select
                                        value={mapping[field.name] || ""}
                                        onChange={(e) => setMapping({ ...mapping, [field.name]: e.target.value })}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded focus:ring-primary focus:border-primary"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <option value="">-- Leave Blank --</option>
                                        <optgroup label={t('fillForm.dateTokens.groupLabel')}>
                                            <option value={TOKEN_TODAY}>{t('fillForm.dateTokens.gregorianOption')}</option>
                                            <option value={TOKEN_TODAY_HIJRI}>{t('fillForm.dateTokens.hijriOption')}</option>
                                        </optgroup>
                                        {sheetColumns.map(col => (
                                            <option key={col} value={col}>{col}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function FillFormPage() {
    const t = useTranslations();
    const locale = useLocale();

    // File states
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [sheetFile, setSheetFile] = useState<File | null>(null);

    // Extraction states
    const [pdfFields, setPdfFields] = useState<PdfField[]>([]);
    const [sheetColumns, setSheetColumns] = useState<string[]>([]);
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [isExtracting, setIsExtracting] = useState(false);

    // Mapping state: key=pdfFieldName, val=sheetColumnName
    const [mapping, setMapping] = useState<Record<string, string>>({});

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [processedCount, setProcessedCount] = useState(0);
    const [viewMode, setViewMode] = useState<'visual' | 'list'>('visual');
    const [results, setResults] = useState<{
        zipBlob: Blob | null;
        successCount: number;
        failCount: number;
        logs: string[];
    } | null>(null);

    // Technical row-limit notice (server enforces the same cap per request)
    const [showRowLimitNotice, setShowRowLimitNotice] = useState(false);
    const { markSuccess, reviewAsk } = useReviewAskAfterSuccess();

    // Read Sheet
    const onSheetDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        const file = acceptedFiles[0];
        const error = validateSpreadsheetFile(file, MAX_SHEET_SIZE);
        if (error) { alert(error); return; }

        setSheetFile(file);

        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            // cellDates so Excel date cells arrive as Date objects instead of serial
            // numbers; cellText: false so sheet_to_json re-formats dates with dateNF
            // below instead of returning Excel's cached display text
            const workbook = XLSX.read(data, { type: 'array', cellDates: true, cellText: false });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            // Convert to JSON; raw: false + dateNF renders date cells as YYYY-MM-DD text
            const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false, dateNF: 'yyyy-mm-dd' });
            // Belt and braces: format any remaining Date instances as YYYY-MM-DD
            const json = (rawJson as Record<string, any>[]).map(row => {
                const formatted: Record<string, any> = {};
                for (const [key, value] of Object.entries(row)) {
                    formatted[key] = value instanceof Date ? formatDateYMD(value) : value;
                }
                return formatted;
            });

            if (json.length > 0) {
                setSheetColumns(Object.keys(json[0] as object));
                setSheetData(json);
            } else {
                alert(t('fillForm.emptySpreadsheet'));
                setSheetFile(null);
            }
        };
        reader.readAsArrayBuffer(file);
    }, []);

    // Read PDF
    const onPdfDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        const file = acceptedFiles[0];
        const error = validateFile(file, MAX_PDF_SIZE);
        if (error) { alert(error); return; }

        setPdfFile(file);
        setIsExtracting(true);
        setPdfFields([]);
        setMapping({});

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/extract-pdf-fields', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (!response.ok) throw responseError(response, t('fillForm.failedToExtractFields'), data?.errorCode);

            if (data.fields.length === 0) {
                alert(t('fillForm.noFormFields'));
            } else {
                setPdfFields(data.fields);
                // Auto-map identical names if sheet is already loaded
                if (sheetColumns.length > 0) {
                    const autoMap: Record<string, string> = {};
                    data.fields.forEach((f: PdfField) => {
                        const match = sheetColumns.find(c => c.toLowerCase() === f.name.toLowerCase());
                        if (match) autoMap[f.name] = match;
                    });
                    setMapping(autoMap);
                }
            }
        } catch (err: any) {
            alert(err.message);
            setPdfFile(null);
        } finally {
            setIsExtracting(false);
        }
    }, [sheetColumns]);

    // Re-run auto-mapping when sheet changes but PDF is already loaded
    useEffect(() => {
        if (pdfFields.length > 0 && sheetColumns.length > 0 && Object.keys(mapping).length === 0) {
            const autoMap: Record<string, string> = {};
            let hasMatches = false;

            pdfFields.forEach(f => {
                const match = sheetColumns.find(c => c.toLowerCase() === f.name.toLowerCase());
                if (match) {
                    autoMap[f.name] = match;
                    hasMatches = true;
                }
            });

            if (hasMatches) {
                setMapping(autoMap);
            }
        }
    }, [sheetColumns, pdfFields, mapping]);

    const { getRootProps: getPdfProps, getInputProps: getPdfInput, isDragActive: isPdfDrag } = useTrackedDropzone({
        onDrop: onPdfDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1, disabled: isProcessing || isExtracting
    });

    const { getRootProps: getSheetProps, getInputProps: getSheetInput, isDragActive: isSheetDrag } = useTrackedDropzone({
        onDrop: onSheetDrop, accept: { 'text/csv': ['.csv'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] }, maxFiles: 1, disabled: isProcessing, uploadRole: 'spreadsheet'
    });

    const handleGenerate = async () => {
        if (!pdfFile || !sheetFile || sheetData.length === 0) return;

        // Technical limit: keep batches small enough for reliable processing
        if (sheetData.length > MAX_ROWS) {
            setShowRowLimitNotice(true);
            return;
        }

        setIsProcessing(true);
        const trackStart = Date.now();
        trackToolStart('fill_form');
        setProgress(0);
        setProcessedCount(0);
        const allLogs: string[] = [];
        let successCount = 0;
        let failCount = 0;

        const zip = new JSZip();

        try {
            const pdfBase64 = Buffer.from(await pdfFile.arrayBuffer()).toString('base64');
            const chunkSize = 5;
            const totalRows = sheetData.length;

            // Resolve {{today}} / {{today_hijri}} once for the whole batch and
            // expose them as virtual columns so fields mapped directly to a
            // date token (via the dropdown) resolve server-side like any column.
            const fillDate = new Date();
            const todayGregorianValue = formatGregorianDate(fillDate, locale);
            // Degrades to the Gregorian date if the browser lacks Islamic
            // calendar support (matches substituteDateTokens behaviour).
            let todayHijriValue = todayGregorianValue;
            try {
                todayHijriValue = todayHijri(locale);
            } catch (e) {
                console.warn('Hijri calendar unavailable in this browser', e);
            }
            const withDateTokens = (row: Record<string, any>): Record<string, any> => {
                const out: Record<string, any> = {};
                for (const [key, value] of Object.entries(row)) {
                    out[key] = typeof value === 'string' ? substituteDateTokens(value, locale, fillDate) : value;
                }
                out[TOKEN_TODAY] = todayGregorianValue;
                out[TOKEN_TODAY_HIJRI] = todayHijriValue;
                return out;
            };

            for (let i = 0; i < totalRows; i += chunkSize) {
                const chunk = sheetData.slice(i, i + chunkSize).map(withDateTokens);

                const res = await fetch('/api/fill-form-chunk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pdfBase64,
                        mapping,
                        rows: chunk
                    })
                });

                if (!res.ok) {
                    const data = await res.json().catch(() => null);
                    throw responseError(res, t('fillForm.failedToGenerate'), data?.errorCode);
                }

                const data = await res.json();

                // Add to ZIP
                data.results.forEach((r: any, idx: number) => {
                    const globalRowIndex = i + idx;
                    if (r.success && r.pdfBase64) {
                        successCount++;
                        zip.file(`filled_row_${globalRowIndex + 1}.pdf`, r.pdfBase64, { base64: true });
                    } else {
                        failCount++;
                    }
                });

                allLogs.push(...data.logs);

                setProcessedCount(Math.min(i + chunkSize, totalRows));
                setProgress(Math.floor(((i + chunkSize) / totalRows) * 100));
            }

            // Generate ZIP blob
            setProgress(100);
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            setResults({ zipBlob, successCount, failCount, logs: allLogs });
            trackToolComplete('fill_form', Date.now() - trackStart);

        } catch (err: any) {
            trackToolError('fill_form', err, Date.now() - trackStart);
            alert(t('fillForm.processingError', { message: err.message }));
        } finally {
            setIsProcessing(false);
        }
    };

    const resetAll = () => {
        setPdfFile(null);
        setSheetFile(null);
        setPdfFields([]);
        setSheetColumns([]);
        setSheetData([]);
        setMapping({});
        setResults(null);
        setProgress(0);
        setProcessedCount(0);
        setShowRowLimitNotice(false);
    };

    const steps = [
        { icon: <Upload className="h-8 w-8 text-primary" />, title: "Upload Files", description: "Upload your fillable PDF and a CSV/Excel spreadsheet." },
        { icon: <Settings className="h-8 w-8 text-primary" />, title: "Map Fields", description: "Match your spreadsheet columns to the PDF form fields." },
        { icon: <FileBox className="h-8 w-8 text-primary" />, title: "Generate & Download", description: "We generate a filled PDF for every row and package them in a ZIP." },
    ];

    const faqData = [
        {
            question: 'What types of spreadsheets are supported?',
            answer: 'You can upload CSV files (.csv) or Excel spreadsheets (.xlsx, .xls). We automatically extract the columns for you to map.',
        },
        {
            question: 'Will this work with any PDF?',
            answer: 'The PDF must contain interactive form fields (text boxes, checkboxes, dropdowns, etc.). A flat scanned document will not work.',
        },
        {
            question: 'Are my generated forms secure?',
            answer: 'Yes. All data processing and ZIP generation happens immediately. We do not store your templates, spreadsheets, or generated PDFs on our servers.',
        },
        {
            question: 'Can I insert today\'s date automatically — including the Hijri (Islamic) date?',
            answer: 'Yes. In the field mapping dropdown, choose "Today\'s date (Gregorian)" or "Today\'s date (Hijri)" instead of a spreadsheet column. You can also type the tokens {{today}} or {{today_hijri}} anywhere inside a spreadsheet cell (e.g. "Signed on {{today_hijri}}") and they are replaced with the date, in the Umm al-Qura Hijri calendar for the Hijri token, when the PDFs are generated.',
        },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-white">
            <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Batch PDF Form Filler', url: '/fill-form' }]} />
            <HowToSchema name="How to Batch Fill PDF Forms" description="Automate filling PDF forms from a spreadsheet" steps={steps.map(s => ({ title: s.title, description: s.description }))} />
            <Navigation />

            <section className="py-12 px-4">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Batch Fill PDF Forms</h1>
                        <p className="mt-4 text-lg text-gray-600">Upload a PDF form and a spreadsheet to instantly generate hundreds of custom PDFs.</p>
                    </div>
                </div>
            </section>

            <section className="bg-white py-8">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">

                    {!results ? (
                        <div className="space-y-8">
                            {/* Upload Zones */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* PDF Upload */}
                                <div {...getPdfProps()} className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isPdfDrag ? 'border-primary bg-orange-50' : 'border-gray-300 hover:border-primary'} ${pdfFile ? 'bg-orange-50 border-primary' : ''} ${isProcessing || isExtracting ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                    <input {...getPdfInput()} />
                                    <FileText className={`w-12 h-12 mx-auto mb-4 ${pdfFile ? 'text-primary' : 'text-gray-400'}`} />
                                    {pdfFile ? (
                                        <div>
                                            <p className="font-semibold text-gray-900">{pdfFile.name}</p>
                                            <p className="text-sm text-gray-500">{formatFileSize(pdfFile.size, locale)}</p>
                                            {isExtracting ? (
                                                <p className="text-sm text-primary mt-2 animate-pulse">Scanning for form fields...</p>
                                            ) : (
                                                <div className="mt-4">
                                                    <p className="text-sm text-green-600 font-medium mb-2">✅ {t('fillForm.fieldsDetected', { count: pdfFields.length })}</p>
                                                    <div className="flex flex-wrap justify-center gap-2 max-h-32 overflow-y-auto p-2 bg-white/50 rounded-lg border border-orange-100">
                                                        {pdfFields.map(f => (
                                                            <span key={f.name} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200" title={`${f.type} Field`}>
                                                                {f.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="font-medium text-gray-900">1. Upload PDF Template</p>
                                            <p className="text-sm text-gray-500 mt-1">Must be an interactive PDF form</p>
                                        </div>
                                    )}
                                </div>

                                {/* Spreadsheet Upload */}
                                <div {...getSheetProps()} className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${isSheetDrag ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-500'} ${sheetFile ? 'bg-green-50 border-green-500' : ''} ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                    <input {...getSheetInput()} />
                                    <FileSpreadsheet className={`w-12 h-12 mx-auto mb-4 ${sheetFile ? 'text-green-600' : 'text-gray-400'}`} />
                                    {sheetFile ? (
                                        <div>
                                            <p className="font-semibold text-gray-900">{sheetFile.name}</p>
                                            <p className="text-sm text-gray-500">{formatFileSize(sheetFile.size, locale)}</p>
                                            <div className="mt-4">
                                                <p className="text-sm text-green-600 font-medium mb-2">✅ {sheetData.length} records • {sheetColumns.length} columns available</p>
                                                <div className="flex flex-wrap justify-center gap-2 max-h-32 overflow-y-auto p-2 bg-white/50 rounded-lg border border-green-100">
                                                    {sheetColumns.map(col => (
                                                        <span key={col} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200" title={`Column: ${col}`}>
                                                            {col}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="font-medium text-gray-900">2. Upload Spreadsheet</p>
                                            <p className="text-sm text-gray-500 mt-1">Accepts CSV or Excel (.xlsx)</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Mapping Interface */}
                            {pdfFile && sheetFile && pdfFields.length > 0 && sheetColumns.length > 0 && (
                                <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold text-gray-900">3. Map Fields</h3>
                                        <div className="flex bg-gray-200 rounded-lg p-1">
                                            <button
                                                onClick={() => setViewMode('visual')}
                                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'visual' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                                            >
                                                Visual PDF
                                            </button>
                                            <button
                                                onClick={() => setViewMode('list')}
                                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                                            >
                                                List View
                                            </button>
                                        </div>
                                    </div>

                                    <p className="flex items-start gap-1.5 text-xs text-gray-500 mb-4">
                                        <CalendarDays className="w-4 h-4 shrink-0 mt-0.5 text-gray-400" aria-hidden="true" />
                                        <span>{t('fillForm.dateTokens.help', { today: TOKEN_TODAY, hijri: TOKEN_TODAY_HIJRI })}</span>
                                    </p>

                                    {viewMode === 'list' ? (
                                        <div className="max-h-[400px] overflow-y-auto pe-2 space-y-3">
                                            {pdfFields.map(field => (
                                                <div key={field.name} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{field.name}</span>
                                                        <span className="text-xs text-gray-500">{field.type} Field</span>
                                                    </div>
                                                    <select
                                                        value={mapping[field.name] || ""}
                                                        onChange={(e) => setMapping({ ...mapping, [field.name]: e.target.value })}
                                                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary text-sm min-w-[200px]"
                                                        disabled={isProcessing}
                                                    >
                                                        <option value="">-- Do not fill --</option>
                                                        <optgroup label={t('fillForm.dateTokens.groupLabel')}>
                                                            <option value={TOKEN_TODAY}>{t('fillForm.dateTokens.gregorianOption')}</option>
                                                            <option value={TOKEN_TODAY_HIJRI}>{t('fillForm.dateTokens.hijriOption')}</option>
                                                        </optgroup>
                                                        {sheetColumns.map(col => (
                                                            <option key={col} value={col}>{col}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <PdfPreviewOverlay
                                            file={pdfFile}
                                            fields={pdfFields}
                                            mapping={mapping}
                                            setMapping={setMapping}
                                            sheetColumns={sheetColumns}
                                        />
                                    )}

                                    {/* Processing Status & Button */}
                                    <div className="mt-8">
                                        {showRowLimitNotice ? (
                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center mb-4">
                                                <AlertCircle className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                                                <h4 className="text-lg font-bold text-gray-900">{t('fillForm.rowLimit.title')}</h4>
                                                <p className="text-sm text-gray-700 mt-2">{t('fillForm.rowLimit.body', { count: sheetData.length, max: MAX_ROWS })}</p>
                                                <div className="mt-4 flex gap-4 justify-center">
                                                    <Button variant="secondary" onClick={() => setShowRowLimitNotice(false)}>{t('fillForm.rowLimit.dismiss')}</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                {isProcessing && (
                                                    <div className="mb-4">
                                                        <div className="flex justify-between text-sm mb-1 font-medium text-gray-700">
                                                            <span>Generating PDFs...</span>
                                                            <span>{processedCount} of {sheetData.length}</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                            <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                                        </div>
                                                    </div>
                                                )}
                                                <Button
                                                    onClick={handleGenerate}
                                                    disabled={isProcessing || Object.values(mapping).every(v => v === "")}
                                                    size="lg"
                                                    className="w-full"
                                                >
                                                    {isProcessing ? 'Processing Batch...' : `Generate ${sheetData.length} PDFs`}
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // Results Screen
                        <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-8 text-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <FileBox className="w-10 h-10 text-green-600" />
                            </div>
                            <h2 className="text-3xl font-bold text-gray-900 mb-2">Batch Complete!</h2>
                            <p className="text-lg text-gray-700 mb-8">
                                Successfully filled {results.successCount} PDFs.
                                {results.failCount > 0 && <span className="text-red-600 font-medium ms-2">({results.failCount} failed)</span>}
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <Button onClick={() => {
                                    if (!results.zipBlob) return;
                                    downloadBlob(results.zipBlob, 'filled_forms.zip');
                                    markSuccess();
                                }} size="lg" className="bg-green-600 hover:bg-green-700">
                                    <Download className="w-5 h-5 me-2" />
                                    Download ZIP
                                </Button>
                                <Button onClick={() => {
                                    const logBlob = new Blob([results.logs.join('\n')], { type: 'text/plain' });
                                    downloadBlob(logBlob, 'processing_log.txt');
                                }} variant="secondary" size="lg">
                                    <FileText className="w-5 h-5 me-2" />
                                    Download Log
                                </Button>
                            </div>

                            {reviewAsk}

                            <div className="mt-8">
                                <Button onClick={resetAll} variant="secondary">Run Another Batch</Button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            <HowItWorks steps={steps} />
            {/* No /fill-form/faq page exists — the questions render inline here. */}
            <ToolFAQ questions={faqData} />
            <RelatedTools currentTool="fill-form" />
            <Footer />
        </div>
    );
}
