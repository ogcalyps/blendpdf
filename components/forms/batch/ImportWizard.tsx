'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileSpreadsheet, Upload, X } from 'lucide-react';
import { parseSpreadsheetFile } from '@/lib/csv-parsing';
import {
    BatchColumn,
    RowData,
    autoMatchColumns,
    coerceCellValue,
    makeEmptyRow,
} from '@/lib/batch-fill';

interface ImportWizardProps {
    columns: BatchColumn[];
    onImport: (rows: RowData[]) => void;
}

interface ParsedState {
    fileName: string;
    headers: string[];
    rows: string[][];
}

/**
 * Secondary import path: dropzone for .csv/.tsv/.xlsx/.xls, then a mapping
 * step where each detected column is matched (fuzzy auto-match, editable) to
 * a target field before the rows land in the editable grid.
 */
export function ImportWizard({ columns, onImport }: ImportWizardProps) {
    const [parsed, setParsed] = useState<ParsedState | null>(null);
    const [mapping, setMapping] = useState<(string | null)[]>([]);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;
            setError(null);
            try {
                const file = acceptedFiles[0];
                const { headers, rows } = await parseSpreadsheetFile(file);
                if (headers.length === 0 || rows.length === 0) {
                    setError('No data rows found — the first row should be headers, followed by one row per PDF.');
                    return;
                }
                setMapping(autoMatchColumns(headers, columns));
                setParsed({ fileName: file.name, headers, rows });
            } catch (e) {
                console.error(e);
                setError('Could not read that file. Please upload a valid CSV, TSV, or Excel file.');
            }
        },
        [columns]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'text/tab-separated-values': ['.tsv'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        multiple: false,
    });

    const setColumnTarget = (colIndex: number, target: string) => {
        setMapping(prev =>
            prev.map((m, i) => {
                if (i === colIndex) return target || null;
                // A field can be mapped only once: claiming it here releases
                // it from any other column.
                return m === target ? null : m;
            })
        );
    };

    const confirmImport = () => {
        if (!parsed) return;
        const rows = parsed.rows.map(rawRow => {
            const row = makeEmptyRow(columns);
            mapping.forEach((fieldName, colIndex) => {
                if (!fieldName) return;
                const col = columns.find(c => c.name === fieldName);
                if (!col) return;
                row[fieldName] = coerceCellValue(col, rawRow[colIndex] ?? '');
            });
            return row;
        });
        setParsed(null);
        onImport(rows);
    };

    const mappedCount = mapping.filter(Boolean).length;

    return (
        <>
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl px-5 py-4 cursor-pointer transition-all duration-200 ${
                    isDragActive
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
            >
                <input {...getInputProps()} />
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-full shrink-0 ${isDragActive ? 'bg-blue-200' : 'bg-blue-50'}`}>
                        <Upload className={`w-5 h-5 ${isDragActive ? 'text-blue-700' : 'text-blue-500'}`} />
                    </div>
                    {isDragActive ? (
                        <p className="font-bold text-blue-600">Drop your spreadsheet here...</p>
                    ) : (
                        <div>
                            <p className="font-semibold text-gray-800">Import from a spreadsheet</p>
                            <p className="text-sm text-gray-500">
                                CSV, TSV, or Excel (.xlsx / .xls) — you&apos;ll map columns to fields before anything is filled.
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            {parsed && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="flex items-start justify-between p-6 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                    <FileSpreadsheet className="text-blue-600" size={22} />
                                    Map columns to fields
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {parsed.fileName} &middot; {parsed.rows.length} data row{parsed.rows.length === 1 ? '' : 's'} &middot; {mappedCount} of {parsed.headers.length} columns mapped
                                </p>
                            </div>
                            <button
                                onClick={() => setParsed(null)}
                                className="p-2 text-gray-400 hover:text-gray-800 transition rounded-full hover:bg-gray-100"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        <div className="overflow-y-auto px-6 py-4 flex-1">
                            <div className="space-y-3">
                                {parsed.headers.map((header, colIndex) => {
                                    const samples = parsed.rows
                                        .map(r => r[colIndex])
                                        .filter(v => String(v ?? '').trim() !== '')
                                        .slice(0, 2);
                                    return (
                                        <div
                                            key={colIndex}
                                            className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start p-3 rounded-xl border border-gray-100 bg-gray-50/60"
                                        >
                                            <div className="min-w-0">
                                                <p dir="auto" className="font-semibold text-gray-800 truncate" title={header}>
                                                    {header || <span className="text-gray-400 italic">(untitled column)</span>}
                                                </p>
                                                {samples.length > 0 ? (
                                                    samples.map((s, i) => (
                                                        <p key={i} dir="auto" className="text-xs text-gray-500 truncate mt-0.5" title={s}>
                                                            e.g. {s}
                                                        </p>
                                                    ))
                                                ) : (
                                                    <p className="text-xs text-gray-400 italic mt-0.5">no values</p>
                                                )}
                                            </div>
                                            <select
                                                value={mapping[colIndex] ?? ''}
                                                onChange={e => setColumnTarget(colIndex, e.target.value)}
                                                className={`w-full rounded-lg border px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 cursor-pointer ${
                                                    mapping[colIndex] ? 'border-gray-200 text-gray-900' : 'border-gray-200 text-gray-400'
                                                }`}
                                            >
                                                <option value="">— skip —</option>
                                                {columns.map(col => (
                                                    <option key={col.name} value={col.name}>
                                                        {col.label}
                                                        {col.labelAr ? ` — ${col.labelAr}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => setParsed(null)}
                                className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-100 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmImport}
                                disabled={mappedCount === 0}
                                className="px-6 py-2.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition shadow-lg shadow-blue-500/30"
                            >
                                Add {parsed.rows.length} row{parsed.rows.length === 1 ? '' : 's'} to grid
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
