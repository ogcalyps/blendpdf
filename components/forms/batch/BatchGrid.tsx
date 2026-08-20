'use client';

import { Copy, Eye, Plus, Trash2 } from 'lucide-react';
import {
    BatchColumn,
    BatchRow,
    RowData,
    RowValue,
    MAX_BATCH_ROWS,
    validateCell,
    parseClipboardGrid,
    isMultiCellGrid,
    isValidIsoDate,
    coerceCellValue,
    normalizeDateValue,
} from '@/lib/batch-fill';

interface BatchGridProps {
    columns: BatchColumn[];
    rows: BatchRow[];
    onCellChange: (rowIndex: number, fieldName: string, value: RowValue) => void;
    onAddRow: () => void;
    onDuplicateRow: (rowIndex: number) => void;
    onDeleteRow: (rowIndex: number) => void;
    onPreviewRow: (rowIndex: number) => void;
    onPasteGrid: (startRow: number, startCol: number, grid: string[][]) => void;
    /** Freeze all editing (cells, row actions, paste) — set during generation
     *  so the ZIP always matches what the grid shows. */
    disabled?: boolean;
}

function cellClass(error: string | null): string {
    return `w-full rounded-lg border px-2.5 py-1.5 text-sm text-gray-900 bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${
        error
            ? 'border-red-400 bg-red-50 text-red-900 focus:border-red-500'
            : 'border-gray-200 focus:border-blue-400'
    }`;
}

const ROW_BUTTON_DISABLED = 'disabled:text-gray-200 disabled:hover:bg-transparent disabled:cursor-not-allowed';

export function BatchGrid({
    columns,
    rows,
    onCellChange,
    onAddRow,
    onDuplicateRow,
    onDeleteRow,
    onPreviewRow,
    onPasteGrid,
    disabled = false,
}: BatchGridProps) {
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        const target = e.target as HTMLElement;
        const rowAttr = target.dataset?.row;
        const colAttr = target.dataset?.col;
        if (rowAttr === undefined || colAttr === undefined) return;

        const text = e.clipboardData.getData('text/plain');
        if (!text) return;
        const col = columns[Number(colAttr)];
        if (!col) return;

        const grid = parseClipboardGrid(text);
        // Plain multi-line text with NO tabs pasted into a multiline cell is
        // content for that ONE cell — newlines are the whole point of a
        // textarea — not a column of rows to overwrite. Tab-bearing
        // clipboards (real spreadsheet copies) keep grid semantics.
        const multilineContentPaste =
            col.multiline && isMultiCellGrid(grid) && !text.includes('\t');

        if (!isMultiCellGrid(grid) || multilineContentPaste) {
            // Single-cell paste. Native paste is a no-op in selects, checkboxes
            // and (in Chrome) date inputs, and would keep Excel quote artifacts
            // in text cells — so coerce it exactly like an imported cell.
            const rawCell = multilineContentPaste
                ? text.replace(/\r\n?/g, '\n').replace(/\n$/, '')
                : grid[0]?.[0] ?? '';
            e.preventDefault();

            if (col.type === 'checkbox' || col.type === 'radioGroup' || col.type === 'date') {
                onCellChange(Number(rowAttr), col.name, coerceCellValue(col, rawCell));
                return;
            }

            // Text-ish cells: splice the (already unquoted) clipboard text over
            // the current selection so caret semantics stay sane.
            const input = target as HTMLInputElement | HTMLTextAreaElement;
            const current = typeof input.value === 'string' ? input.value : '';
            const start = input.selectionStart ?? current.length;
            const end = input.selectionEnd ?? current.length;
            const nextValue = current.slice(0, start) + rawCell + current.slice(end);
            onCellChange(Number(rowAttr), col.name, coerceCellValue(col, nextValue));
            return;
        }

        e.preventDefault();
        onPasteGrid(Number(rowAttr), Number(colAttr), grid);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (disabled) return;
        if (e.key !== 'Enter' || e.shiftKey) return;
        const target = e.target as HTMLElement;
        // Selects use Enter to pick options; textareas use it for newlines.
        if (target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') return;
        const row = Number(target.dataset?.row);
        const col = Number(target.dataset?.col);
        // Enter in the last cell of the last row appends a fresh row.
        if (row === rows.length - 1 && col === columns.length - 1 && rows.length < MAX_BATCH_ROWS) {
            e.preventDefault();
            onAddRow();
        }
    };

    const renderCell = (col: BatchColumn, colIndex: number, row: RowData, rowIndex: number) => {
        const value = row[col.name];
        const dataProps = { 'data-row': rowIndex, 'data-col': colIndex };

        if (col.type === 'checkbox') {
            return (
                <div className="flex justify-center">
                    <input
                        type="checkbox"
                        {...dataProps}
                        checked={value === true}
                        disabled={disabled}
                        onChange={e => onCellChange(rowIndex, col.name, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                    />
                </div>
            );
        }

        const strValue = typeof value === 'string' ? value : '';
        const error = validateCell(col, strValue);

        if (col.type === 'radioGroup') {
            return (
                <select
                    {...dataProps}
                    value={col.options?.includes(strValue) ? strValue : strValue === '' ? '' : '__invalid__'}
                    disabled={disabled}
                    onChange={e => onCellChange(rowIndex, col.name, e.target.value === '__invalid__' ? strValue : e.target.value)}
                    title={error ?? undefined}
                    className={`${cellClass(error)} cursor-pointer`}
                >
                    <option value=""></option>
                    {error && <option value="__invalid__">{strValue} (invalid)</option>}
                    {col.options?.map(option => {
                        const bilingual = col.optionLabels?.find(ol => ol.value === option);
                        return (
                            <option key={option} value={option}>
                                {bilingual ? `${bilingual.en} — ${bilingual.ar}` : option}
                            </option>
                        );
                    })}
                </select>
            );
        }

        if (col.type === 'date') {
            // Values a native date input can't hold (bad imports, ambiguous
            // dates, calendar-invalid strings like 2026-09-31 — which a date
            // input would silently render BLANK) fall back to a red text
            // input so the user sees and can fix them.
            const isRealIso = strValue === '' || isValidIsoDate(strValue);
            return (
                <input
                    type={isRealIso ? 'date' : 'text'}
                    {...dataProps}
                    value={strValue}
                    disabled={disabled}
                    onChange={e => {
                        // Hand-typed fixes in the text fallback: the moment the
                        // value normalizes to a real ISO date (trim, Arabic
                        // digits, unambiguous d/m/y), store the CLEAN form so
                        // the cell snaps back to the calendar input and no
                        // padded string reaches the PDF. validateCell trims,
                        // so storing '2026-09-13 ' verbatim would clear the
                        // error while the cell stayed stuck in text mode.
                        const raw = e.target.value;
                        const fixed = normalizeDateValue(raw);
                        onCellChange(rowIndex, col.name, isValidIsoDate(fixed) ? fixed : raw);
                    }}
                    title={error ?? undefined}
                    className={cellClass(error)}
                />
            );
        }

        if (col.multiline) {
            // Auto-growing textarea: rows follows the line count so imported
            // \n values stay visible as separate lines and edits preserve them
            // (an <input> would strip the newlines on the first keystroke).
            const lineCount = strValue === '' ? 1 : strValue.split('\n').length;
            return (
                <textarea
                    dir="auto"
                    {...dataProps}
                    rows={Math.min(6, Math.max(1, lineCount))}
                    value={strValue}
                    disabled={disabled}
                    onChange={e => onCellChange(rowIndex, col.name, e.target.value)}
                    title={error ?? undefined}
                    className={`${cellClass(error)} resize-y leading-snug`}
                />
            );
        }

        // text / signature — plain text input, dir="auto" so Arabic values
        // flow RTL.
        return (
            <input
                type="text"
                dir="auto"
                {...dataProps}
                value={strValue}
                disabled={disabled}
                onChange={e => onCellChange(rowIndex, col.name, e.target.value)}
                title={error ?? undefined}
                className={cellClass(error)}
            />
        );
    };

    return (
        <div onPaste={handlePaste} onKeyDown={handleKeyDown}>
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
                <table className="w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-3 text-left text-xs font-semibold text-gray-400 w-10">#</th>
                            {columns.map(col => (
                                <th
                                    key={col.name}
                                    className="px-2 py-3 text-left align-bottom min-w-[11rem]"
                                    title={col.type === 'signature' ? 'Typed name — stamped as text on the signature line' : col.name}
                                >
                                    <div className="font-semibold text-gray-800 leading-snug">
                                        {col.label}
                                        {col.type === 'signature' && (
                                            <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wide text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">typed</span>
                                        )}
                                    </div>
                                    {col.labelAr && (
                                        <div dir="rtl" className="text-xs font-normal text-gray-500 mt-0.5 text-right">
                                            {col.labelAr}
                                        </div>
                                    )}
                                </th>
                            ))}
                            <th className="px-2 py-3 w-28" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIndex) => (
                            <tr key={row.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50">
                                <td className="sticky left-0 z-10 bg-white px-3 py-2 text-xs font-medium text-gray-400">
                                    {rowIndex + 1}
                                </td>
                                {columns.map((col, colIndex) => (
                                    <td key={col.name} className="px-2 py-2 align-middle">
                                        {renderCell(col, colIndex, row.values, rowIndex)}
                                    </td>
                                ))}
                                <td className="px-2 py-2">
                                    <div className="flex items-center gap-1 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => onPreviewRow(rowIndex)}
                                            disabled={disabled}
                                            title="Preview this row as a PDF"
                                            className={`p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition ${ROW_BUTTON_DISABLED}`}
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDuplicateRow(rowIndex)}
                                            disabled={disabled}
                                            title="Duplicate row"
                                            className={`p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition ${ROW_BUTTON_DISABLED}`}
                                        >
                                            <Copy size={16} />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteRow(rowIndex)}
                                            disabled={disabled}
                                            title="Delete row"
                                            className={`p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition ${ROW_BUTTON_DISABLED}`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mt-3">
                <button
                    type="button"
                    onClick={onAddRow}
                    disabled={disabled || rows.length >= MAX_BATCH_ROWS}
                    className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:cursor-not-allowed transition px-2 py-1.5 rounded-lg hover:bg-blue-50"
                >
                    <Plus size={16} /> Add row
                </button>
                <span className="text-xs text-gray-400 font-medium">
                    {rows.length} / {MAX_BATCH_ROWS} rows &middot; paste cells from Excel or Google Sheets directly into the grid
                </span>
            </div>
        </div>
    );
}
