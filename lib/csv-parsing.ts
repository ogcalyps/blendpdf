import * as xlsx from 'xlsx';
import { getBatchColumns, buildTemplateHeaders, BatchFieldDef } from './batch-fill';

/**
 * Download a one-row CSV template whose headers are the FRIENDLY field labels
 * (duplicated labels get the internal name appended so headers stay unique).
 * Written manually with a UTF-8 BOM so Arabic labels survive an Excel
 * round-trip instead of turning into mojibake. The import mapping wizard
 * fuzzy-matches these label headers back to fields.
 */
export function generateCsvTemplate(fieldsDef: BatchFieldDef[], filename: string) {
    const headers = buildTemplateHeaders(getBatchColumns(fieldsDef));
    const escapeCell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const csv = '\uFEFF' + headers.map(escapeCell).join(',') + '\r\n';

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export interface ParsedSpreadsheet {
    headers: string[];
    rows: string[][];
}

/**
 * Excel stores dates as exact serial numbers; `raw: false` surfaces them as
 * their DISPLAY text, which destroys information: the stock "Short Date"
 * format (numFmtId 14, m/d/yy) renders serial 46278 as '9/13/26' (2-digit
 * year — rejected downstream), and an mm/dd/yyyy display like '01/09/2026'
 * reads as d/m-vs-m/d ambiguous even though the serial pins the exact date.
 * Recover it: rewrite every date-formatted numeric cell's text to ISO
 * YYYY-MM-DD before sheet_to_json. SSF.parse_date_code is pure serial
 * arithmetic (no JS Date), so this is timezone-safe; non-date numeric
 * formats (percents, currency) keep their display text.
 */
function recoverIsoDateText(ws: xlsx.WorkSheet, date1904: boolean): void {
    for (const addr of Object.keys(ws)) {
        if (addr.charAt(0) === '!') continue;
        const cell = ws[addr];
        if (!cell || cell.t !== 'n' || typeof cell.v !== 'number') continue;
        if (cell.z === undefined || !xlsx.SSF.is_date(String(cell.z))) continue;
        const p = xlsx.SSF.parse_date_code(cell.v, { date1904 });
        // Time-only serials parse with no date part (d === 0) — leave them.
        if (!p || p.y < 1900 || p.d < 1) continue;
        cell.w = `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
    }
}

/**
 * Parse an uploaded spreadsheet (.csv, .tsv, .xlsx, .xls) into a raw header
 * row + string data rows for the mapping wizard. Binary workbook formats are
 * detected by magic bytes (ZIP for .xlsx, OLE2 for .xls); everything else is
 * decoded as UTF-8 text ourselves (TextDecoder consumes a BOM if present) so
 * Arabic CSV/TSV content never depends on SheetJS codepage tables. Values
 * are formatted (`raw: false`) so Excel serials come out as display strings —
 * except date-formatted cells, whose exact serial is recovered as ISO (see
 * recoverIsoDateText); fully-empty rows are dropped.
 */
export async function parseSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
    const data = await file.arrayBuffer();
    const bytes = new Uint8Array(data);
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // .xlsx
    const isOle2 = bytes[0] === 0xd0 && bytes[1] === 0xcf; // legacy .xls
    // cellNF keeps each cell's number-format string on cell.z so date-typed
    // cells can be told apart from plain numerics.
    const wb = isZip || isOle2
        ? xlsx.read(data, { type: 'array', cellNF: true })
        : xlsx.read(new TextDecoder('utf-8').decode(data), { type: 'string' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (ws && (isZip || isOle2)) {
        recoverIsoDateText(ws, !!wb.Workbook?.WBProps?.date1904);
    }
    const aoa: unknown[][] = ws
        ? (xlsx.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as unknown[][])
        : [];

    const headers = (aoa[0] ?? []).map(v => String(v ?? '').trim());
    const rows = aoa
        .slice(1)
        .map(r => headers.map((_, i) => String(r?.[i] ?? '')))
        .filter(r => r.some(c => c.trim() !== ''));

    return { headers, rows };
}
