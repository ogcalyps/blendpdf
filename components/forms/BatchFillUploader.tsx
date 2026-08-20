'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Download, FileDown, Loader2, X } from 'lucide-react';
import { generateCsvTemplate } from '@/lib/csv-parsing';
import { fillPdfForm, pdfBytesToBlob } from '@/lib/pdf-generation';
import { createZipAndDownload } from '@/lib/zip-generation';
import { MonetizationModal } from './MonetizationModal';
import { BatchGrid } from './batch/BatchGrid';
import { ImportWizard } from './batch/ImportWizard';
import { RowPreviewModal } from './batch/RowPreviewModal';
import {
    MAX_BATCH_ROWS,
    BatchCellError,
    BatchRow,
    RowData,
    RowValue,
    getBatchColumns,
    makeBatchRow,
    makeEmptyRow,
    newBatchRowId,
    isRowEmpty,
    coerceCellValue,
    collectRowErrors,
    validateCell,
    buildRowFilenames,
    buildRowFormData,
} from '@/lib/batch-fill';

const INITIAL_ROW_COUNT = 3;
const DRAFT_SAVE_DEBOUNCE_MS = 300;
/** Cap for the pre-generation validation panel — beyond this, "+K more". */
const MAX_LISTED_CELL_ERRORS = 10;

interface RowFailure {
    rowNumber: number;
    message: string;
    /** Non-fatal: the row's PDF WAS generated, but a field was left blank. */
    warning?: boolean;
}

interface PreviewState {
    rowNumber: number;
    file: File | null;
    loading: boolean;
    error: string | null;
}

export function BatchFillUploader({ templateBase64, formDef, filenamePrefix }: any) {
    const columns = useMemo(() => getBatchColumns(formDef.fields), [formDef]);

    const [rows, setRows] = useState<BatchRow[]>(() =>
        Array.from({ length: INITIAL_ROW_COUNT }, () => makeBatchRow(columns))
    );
    const [nameField, setNameField] = useState<string>(
        () => columns.find(c => c.type === 'text')?.name ?? ''
    );

    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [failures, setFailures] = useState<RowFailure[]>([]);
    /** Red-flagged cells found at Generate time — non-empty blocks the run. */
    const [validationErrors, setValidationErrors] = useState<BatchCellError[]>([]);
    const [preview, setPreview] = useState<PreviewState | null>(null);
    const [showLimitModal, setShowLimitModal] = useState(false);
    const [attemptedRows, setAttemptedRows] = useState(0);

    // Guard for the async preview generation: closing the modal (or starting
    // a newer preview) bumps the token so stale results are dropped instead of
    // re-opening the modal.
    const previewTokenRef = useRef(0);

    const nameFieldOptions = useMemo(() => columns.filter(c => c.type === 'text'), [columns]);
    const dataRowCount = useMemo(
        () => rows.filter(r => !isRowEmpty(r.values, columns)).length,
        [rows, columns]
    );

    // --- session draft persistence -------------------------------------------
    // The Single/Batch tabs remount this component, which used to wipe every
    // typed row. Drafts live in sessionStorage only (never the server), keyed
    // per template, capped at the 50-row limit.

    const draftKey = `batch_draft_${filenamePrefix}`;
    const [draftHydrated, setDraftHydrated] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);

    useEffect(() => {
        try {
            const saved = sessionStorage.getItem(draftKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                const savedRows: unknown = parsed?.rows;
                if (Array.isArray(savedRows) && savedRows.length > 0) {
                    const restored: BatchRow[] = savedRows
                        .slice(0, MAX_BATCH_ROWS)
                        .map((values: unknown) => {
                            const base = makeEmptyRow(columns);
                            if (values && typeof values === 'object') {
                                for (const col of columns) {
                                    const v = (values as Record<string, unknown>)[col.name];
                                    if (col.type === 'checkbox') {
                                        if (typeof v === 'boolean') base[col.name] = v;
                                    } else if (typeof v === 'string') {
                                        base[col.name] = v;
                                    }
                                }
                            }
                            return { id: newBatchRowId(), values: base };
                        });
                    if (restored.some(r => !isRowEmpty(r.values, columns))) {
                        setRows(restored);
                        if (
                            typeof parsed.nameField === 'string' &&
                            (parsed.nameField === '' ||
                                columns.some(c => c.name === parsed.nameField && c.type === 'text'))
                        ) {
                            setNameField(parsed.nameField);
                        }
                        setDraftRestored(true);
                    }
                }
            }
        } catch (e) {
            console.warn('Could not restore batch draft', e);
        }
        setDraftHydrated(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey]);

    // Latest save closure, so the unmount flush below always writes the
    // CURRENT rows — not whatever the effect had captured 300ms ago.
    const draftFlushRef = useRef<() => void>(() => {});

    useEffect(() => {
        if (!draftHydrated) return;
        const save = () => {
            try {
                if (rows.every(r => isRowEmpty(r.values, columns))) {
                    sessionStorage.removeItem(draftKey);
                } else {
                    sessionStorage.setItem(
                        draftKey,
                        JSON.stringify({
                            rows: rows.slice(0, MAX_BATCH_ROWS).map(r => r.values),
                            nameField,
                        })
                    );
                }
            } catch (e) {
                console.warn('Could not save batch draft', e);
            }
        };
        draftFlushRef.current = save;
        const t = setTimeout(save, DRAFT_SAVE_DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [rows, nameField, columns, draftKey, draftHydrated]);

    // The debounce above DROPS a pending save when the component unmounts —
    // and switching to the Single tab unmounts it, which is the exact
    // remount the draft exists to survive. Flush synchronously on unmount so
    // type → immediate tab switch never loses rows. (Idempotent if the timer
    // already fired.)
    useEffect(() => () => draftFlushRef.current(), []);

    const clearDraft = () => {
        if (isGenerating) return;
        try {
            sessionStorage.removeItem(draftKey);
        } catch (e) { }
        setRows(Array.from({ length: INITIAL_ROW_COUNT }, () => makeBatchRow(columns)));
        setNameField(columns.find(c => c.type === 'text')?.name ?? '');
        setDraftRestored(false);
        setValidationErrors([]);
    };

    const notifyRowLimit = (attempted: number) => {
        setAttemptedRows(attempted);
        setShowLimitModal(true);
    };

    // --- grid mutations -----------------------------------------------------
    // Every mutator no-ops while a run is in flight (the grid is also
    // disabled visually): the generation loop reads a snapshot, so a mid-run
    // edit would be silently absent from the ZIP and could desync the
    // failure panel's row numbers.

    const handleCellChange = (rowIndex: number, fieldName: string, value: RowValue) => {
        if (isGenerating) return;
        setRows(prev =>
            prev.map((r, i) =>
                i === rowIndex ? { ...r, values: { ...r.values, [fieldName]: value } } : r
            )
        );
    };

    const handleAddRow = () => {
        if (isGenerating) return;
        if (rows.length >= MAX_BATCH_ROWS) {
            notifyRowLimit(rows.length + 1);
            return;
        }
        setRows(prev => [...prev, makeBatchRow(columns)]);
    };

    const handleDuplicateRow = (rowIndex: number) => {
        if (isGenerating) return;
        if (rows.length >= MAX_BATCH_ROWS) {
            notifyRowLimit(rows.length + 1);
            return;
        }
        setRows(prev => {
            const next = [...prev];
            // Copy the values but mint a fresh id — row identity is per-<tr>.
            next.splice(rowIndex + 1, 0, { id: newBatchRowId(), values: { ...prev[rowIndex].values } });
            return next;
        });
    };

    const handleDeleteRow = (rowIndex: number) => {
        if (isGenerating) return;
        setRows(prev => {
            const next = prev.filter((_, i) => i !== rowIndex);
            return next.length > 0 ? next : [makeBatchRow(columns)];
        });
    };

    /**
     * Multi-cell paste from Excel/Sheets: fill cells starting at the focused
     * cell, expanding rows up to the 50-row cap. Values are coerced per field
     * type (checkbox truthy set, radio option snapping, date normalization).
     */
    const handlePasteGrid = (startRow: number, startCol: number, grid: string[][]) => {
        if (isGenerating) return;
        const next = rows.map(r => ({ ...r, values: { ...r.values } }));
        let overflow = false;

        for (let r = 0; r < grid.length; r++) {
            const targetRow = startRow + r;
            if (targetRow >= MAX_BATCH_ROWS) {
                overflow = true;
                break;
            }
            while (next.length <= targetRow) next.push(makeBatchRow(columns));
            for (let c = 0; c < grid[r].length; c++) {
                const col = columns[startCol + c];
                if (!col) break;
                next[targetRow].values[col.name] = coerceCellValue(col, grid[r][c]);
            }
        }

        setRows(next);
        if (overflow) notifyRowLimit(startRow + grid.length);
    };

    /** Imported rows from the mapping wizard land in the grid after any
     *  existing non-empty rows — never straight into a ZIP. */
    const handleImport = (importedRows: RowData[]) => {
        if (isGenerating) return;
        const existing = rows.filter(r => !isRowEmpty(r.values, columns));
        let combined = [...existing, ...importedRows.map(values => ({ id: newBatchRowId(), values }))];
        if (combined.length > MAX_BATCH_ROWS) {
            notifyRowLimit(combined.length);
            combined = combined.slice(0, MAX_BATCH_ROWS);
        }
        setRows(combined.length > 0 ? combined : [makeBatchRow(columns)]);
    };

    // --- preview & generation ----------------------------------------------

    // End-trims string values (internal newlines survive) and drops empties —
    // pure helper in lib/batch-fill so it stays unit-tested.
    const buildFormData = (row: RowData): Record<string, any> => buildRowFormData(row, columns);

    const handlePreviewRow = async (rowIndex: number) => {
        // Already generating this exact row — ignore the duplicate click.
        if (preview?.loading && preview.rowNumber === rowIndex + 1) return;

        const token = ++previewTokenRef.current;
        setPreview({ rowNumber: rowIndex + 1, file: null, loading: true, error: null });
        try {
            const bytes = await fillPdfForm(templateBase64, buildFormData(rows[rowIndex].values), formDef.fields);
            if (previewTokenRef.current !== token) return; // closed or superseded meanwhile
            const file = new File([pdfBytesToBlob(bytes)], `${filenamePrefix}_preview.pdf`, {
                type: 'application/pdf',
            });
            setPreview({ rowNumber: rowIndex + 1, file, loading: false, error: null });
        } catch (e: any) {
            if (previewTokenRef.current !== token) return;
            console.error(e);
            setPreview({
                rowNumber: rowIndex + 1,
                file: null,
                loading: false,
                error: e?.message ?? 'Unknown error',
            });
        }
    };

    const handleClosePreview = () => {
        // Invalidate any in-flight generation so it can't re-open the modal.
        previewTokenRef.current++;
        setPreview(null);
    };

    const handleGenerate = async () => {
        const dataRows = rows
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => !isRowEmpty(row.values, columns));
        if (dataRows.length === 0 || isGenerating) return;

        // Hard gate: any red-flagged cell (bad, ambiguous or unrecognized
        // dates) BLOCKS the run — fillPdfForm would stamp those strings into
        // the PDFs verbatim and the run would report clean success. Radio
        // mismatches stay non-fatal (field left blank, warned after the run).
        const cellErrors = collectRowErrors(rows.map(r => r.values), columns);
        if (cellErrors.length > 0) {
            setValidationErrors(cellErrors);
            return;
        }
        setValidationErrors([]);

        setIsGenerating(true);
        setProgress(0);
        setFailures([]);

        const filenames = buildRowFilenames(
            dataRows.map(d => d.row.values),
            nameField || null,
            filenamePrefix
        );

        const generatedFiles: { name: string; bytes: Uint8Array }[] = [];
        const rowFailures: RowFailure[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const { row, index } = dataRows[i];
            try {
                const bytes = await fillPdfForm(templateBase64, buildFormData(row.values), formDef.fields);
                generatedFiles.push({ name: filenames[i], bytes });
                // Non-fatal: invalid radio values are dropped by the fill
                // pipeline (the PDF is generated with that field blank) —
                // surface that instead of reporting silent full success.
                for (const col of columns) {
                    if (col.type !== 'radioGroup') continue;
                    const v = row.values[col.name];
                    if (typeof v === 'string' && v.trim() !== '' && validateCell(col, v)) {
                        rowFailures.push({
                            rowNumber: index + 1,
                            message: `"${v.trim()}" is not a valid option for ${col.label} — left blank`,
                            warning: true,
                        });
                    }
                }
            } catch (e: any) {
                console.error(`Batch row ${index + 1} failed`, e);
                rowFailures.push({
                    rowNumber: index + 1,
                    message: e?.message ?? 'Unknown error',
                });
            }
            setProgress(Math.round(((i + 1) / dataRows.length) * 100));
        }

        try {
            if (generatedFiles.length > 0) {
                await createZipAndDownload(generatedFiles, `${filenamePrefix}_batch.zip`);
            }
        } catch (e: any) {
            console.error(e);
            rowFailures.push({ rowNumber: 0, message: 'Could not build the ZIP download.' });
        }

        setFailures(rowFailures);
        setIsGenerating(false);
    };

    return (
        <div className="w-full mt-8">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Batch Fill</h2>
                        <p className="text-gray-600">
                            Type or paste your data below — one row per PDF — or import a spreadsheet. Preview any row before generating.
                        </p>
                    </div>
                    <button
                        onClick={() => generateCsvTemplate(formDef.fields, `${filenamePrefix}_template`)}
                        className="flex items-center gap-2 bg-gray-100 text-gray-800 px-5 py-3 rounded-xl font-semibold hover:bg-gray-200 transition whitespace-nowrap"
                        title="CSV with friendly column headers (UTF-8, Excel-safe)"
                    >
                        <Download size={18} /> Get template
                    </button>
                </div>

                {draftRestored && (
                    <div className="flex items-center justify-end gap-2 mb-3 text-xs text-gray-500">
                        <span>Restored your rows from earlier in this session (saved on this device only).</span>
                        <button
                            type="button"
                            onClick={clearDraft}
                            disabled={isGenerating}
                            className="underline font-medium hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                        >
                            Clear
                        </button>
                    </div>
                )}

                <BatchGrid
                    columns={columns}
                    rows={rows}
                    onCellChange={handleCellChange}
                    onAddRow={handleAddRow}
                    onDuplicateRow={handleDuplicateRow}
                    onDeleteRow={handleDeleteRow}
                    onPreviewRow={handlePreviewRow}
                    onPasteGrid={handlePasteGrid}
                    disabled={isGenerating}
                />

                {/* Import is frozen during a run too — rows landing mid-loop
                    would be silently absent from the ZIP. */}
                <div
                    className={`mt-6 ${isGenerating ? 'pointer-events-none opacity-50' : ''}`}
                    aria-disabled={isGenerating}
                >
                    <ImportWizard columns={columns} onImport={handleImport} />
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        <label htmlFor="batch-name-field" className="text-sm font-semibold text-gray-600 whitespace-nowrap">
                            Name files by
                        </label>
                        <select
                            id="batch-name-field"
                            value={nameField}
                            onChange={e => setNameField(e.target.value)}
                            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer"
                        >
                            <option value="">Row number</option>
                            {nameFieldOptions.map(col => (
                                <option key={col.name} value={col.name}>
                                    {col.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={dataRowCount === 0 || isGenerating}
                        className="flex items-center gap-2 bg-blue-600 text-white px-7 py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none transition shadow-lg shadow-blue-500/30"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <FileDown size={18} />}
                        Generate {dataRowCount > 0 ? dataRowCount : ''} PDF{dataRowCount === 1 ? '' : 's'}
                    </button>
                </div>

                {validationErrors.length > 0 && (
                    <div className="mt-6 p-5 rounded-2xl border bg-red-50 border-red-100">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="shrink-0 mt-0.5 text-red-500" size={20} />
                                <div>
                                    <p className="font-bold mb-1 text-red-800">
                                        Fix {validationErrors.length} invalid cell
                                        {validationErrors.length === 1 ? '' : 's'} before generating
                                    </p>
                                    <p className="text-sm mb-2 text-red-700">
                                        Nothing was generated — these values would be stamped into the
                                        PDFs exactly as typed. Fix or clear the red cells in the grid,
                                        then click Generate again.
                                    </p>
                                    <ul className="text-sm space-y-1 list-disc list-inside text-red-700">
                                        {validationErrors.slice(0, MAX_LISTED_CELL_ERRORS).map((er, i) => (
                                            <li key={i}>
                                                Row {er.rowNumber}, {er.label}: {er.message}
                                            </li>
                                        ))}
                                        {validationErrors.length > MAX_LISTED_CELL_ERRORS && (
                                            <li>+{validationErrors.length - MAX_LISTED_CELL_ERRORS} more</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                            <button
                                onClick={() => setValidationErrors([])}
                                title="Dismiss"
                                className="p-1.5 transition rounded-full shrink-0 text-red-400 hover:text-red-700 hover:bg-red-100"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {isGenerating && (
                    <div className="mt-6 p-6 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-gray-800 flex items-center gap-3">
                                <Loader2 className="animate-spin text-blue-600" size={20} />
                                Generating your PDFs...
                            </span>
                            <span className="text-lg font-bold text-blue-600">{progress}%</span>
                        </div>
                        <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-600 transition-all duration-300 ease-out relative overflow-hidden"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
                            </div>
                        </div>
                    </div>
                )}

                {failures.length > 0 && (() => {
                    const errorCount = failures.filter(f => !f.warning).length;
                    const warningsOnly = errorCount === 0;
                    return (
                        <div
                            className={`mt-6 p-5 rounded-2xl border ${
                                warningsOnly ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle
                                        className={`shrink-0 mt-0.5 ${warningsOnly ? 'text-amber-500' : 'text-red-500'}`}
                                        size={20}
                                    />
                                    <div>
                                        <p className={`font-bold mb-1 ${warningsOnly ? 'text-amber-800' : 'text-red-800'}`}>
                                            {warningsOnly
                                                ? `Generated with ${failures.length} warning${failures.length === 1 ? '' : 's'}`
                                                : `${errorCount} row${errorCount === 1 ? '' : 's'} could not be generated`}
                                        </p>
                                        <p className={`text-sm mb-2 ${warningsOnly ? 'text-amber-700' : 'text-red-700'}`}>
                                            {warningsOnly
                                                ? 'All PDFs were included in your download — check the notes below.'
                                                : 'The remaining PDFs were still included in your download.'}
                                        </p>
                                        <ul
                                            className={`text-sm space-y-1 list-disc list-inside ${
                                                warningsOnly ? 'text-amber-700' : 'text-red-700'
                                            }`}
                                        >
                                            {failures.map((f, i) => (
                                                <li key={i}>
                                                    {f.rowNumber > 0
                                                        ? `Row ${f.rowNumber}${f.warning ? ': ' : ' failed: '}`
                                                        : ''}
                                                    {f.message}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setFailures([])}
                                    title="Dismiss"
                                    className={`p-1.5 transition rounded-full shrink-0 ${
                                        warningsOnly
                                            ? 'text-amber-400 hover:text-amber-700 hover:bg-amber-100'
                                            : 'text-red-400 hover:text-red-700 hover:bg-red-100'
                                    }`}
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {preview && (
                <RowPreviewModal
                    rowNumber={preview.rowNumber}
                    file={preview.file}
                    loading={preview.loading}
                    error={preview.error}
                    onClose={handleClosePreview}
                />
            )}

            <MonetizationModal
                isOpen={showLimitModal}
                onClose={() => setShowLimitModal(false)}
                rowCount={attemptedRows}
            />
        </div>
    );
}
