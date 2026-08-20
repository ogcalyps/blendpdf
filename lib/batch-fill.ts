/**
 * Pure helpers for the batch form-filling grid: column derivation, fuzzy
 * header matching for imports, Excel-clipboard parsing, cell coercion and
 * validation, and output filename construction. No DOM dependencies so the
 * whole module is unit-testable under node.
 */

export const MAX_BATCH_ROWS = 50;

export interface BilingualOptionLabel {
    value: string;
    en: string;
    ar: string;
}

export interface BatchFieldDef {
    type: string;
    name?: string;
    label: string;
    labelAr?: string;
    multiline?: boolean;
    options?: string[];
    optionLabels?: BilingualOptionLabel[];
}

/** A fillable column: every non-section field (signatures included — a typed
 *  name is stamped as plain text, matching single-fill behavior). */
export interface BatchColumn extends BatchFieldDef {
    name: string;
}

export type RowValue = string | boolean;
export type RowData = Record<string, RowValue>;

/**
 * A grid row with a stable identity. The id lives OUTSIDE the form values so
 * it can never leak into generated PDFs; React keys rows by it so deleting or
 * duplicating a row cannot migrate uncommitted DOM state (partial native date
 * segments, input undo stacks) onto a different logical row.
 */
export interface BatchRow {
    id: string;
    values: RowData;
}

let nextBatchRowId = 0;

/** Stable, session-unique row id (module counter — survives remounts). */
export function newBatchRowId(): string {
    return `batch-row-${nextBatchRowId++}`;
}

export function makeBatchRow(columns: BatchColumn[]): BatchRow {
    return { id: newBatchRowId(), values: makeEmptyRow(columns) };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Same truthy set as the old CSV parser — Excel columns often hold 1/0 —
 *  plus the Arabic yes (نعم); Arabic-Indic digits are normalized to ASCII
 *  before the lookup, so ١ matches '1'. */
const CHECKBOX_TRUTHY = ['true', 'yes', 'y', '1', 'نعم'];

/** Map Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to ASCII. */
export function normalizeArabicDigits(s: string): string {
    return s.replace(/[٠-٩۰-۹]/g, ch => {
        const code = ch.charCodeAt(0);
        const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
        return String(code - base);
    });
}

export function getBatchColumns(fieldsDef: BatchFieldDef[]): BatchColumn[] {
    return fieldsDef.filter((f): f is BatchColumn => f.type !== 'section' && !!f.name);
}

export function makeEmptyRow(columns: BatchColumn[]): RowData {
    const row: RowData = {};
    for (const col of columns) {
        row[col.name] = col.type === 'checkbox' ? false : '';
    }
    return row;
}

export function isRowEmpty(row: RowData, columns: BatchColumn[]): boolean {
    return columns.every(col => {
        const v = row[col.name];
        if (v === undefined || v === null) return true;
        if (typeof v === 'boolean') return v === false;
        return String(v).trim() === '';
    });
}

/**
 * Normalize a header/label/name for fuzzy matching: lowercase and strip
 * everything that isn't a letter or digit (Unicode-aware, so Arabic labels
 * survive normalization).
 */
export function normalizeKey(s: string): string {
    return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

/**
 * Template headers use the friendly label; when two fields share a label
 * (e.g. "Name" under both signature sections) the internal name is appended
 * so headers stay unique and round-trip through the fuzzy matcher.
 */
export function buildTemplateHeaders(columns: BatchColumn[]): string[] {
    const counts = new Map<string, number>();
    for (const c of columns) counts.set(c.label, (counts.get(c.label) ?? 0) + 1);
    return columns.map(c => ((counts.get(c.label) ?? 0) > 1 ? `${c.label} (${c.name})` : c.label));
}

function aliasKeys(col: BatchColumn): string[] {
    const name = normalizeKey(col.name);
    const label = normalizeKey(col.label);
    const keys = [name, label, label + name];
    if (col.labelAr) {
        const ar = normalizeKey(col.labelAr);
        keys.push(ar, ar + name);
    }
    return keys.filter(Boolean);
}

/**
 * Auto-match imported headers to target fields. Matches against the field
 * name, the English label, the Arabic label, and the "Label (name)" template
 * header form — all normalized. Each field can be claimed by at most one
 * column; ties are broken by column order, so duplicate labels ("Name",
 * "Name") map to the fields in definition order.
 */
export function autoMatchColumns(headers: string[], columns: BatchColumn[]): (string | null)[] {
    const used = new Set<string>();
    return headers.map(header => {
        const key = normalizeKey(header);
        if (!key) return null;
        const match = columns.find(c => !used.has(c.name) && aliasKeys(c).includes(key));
        if (!match) return null;
        used.add(match.name);
        return match.name;
    });
}

/**
 * True when a quoted cell opened at `from` has a closing quote somewhere
 * before end-of-input (skipping doubled `""` escapes). Without one, the
 * "quoted cell" would swallow every following tab/newline, so the caller
 * treats the opening quote as literal text instead.
 */
function hasClosingQuote(text: string, from: number): boolean {
    let j = from;
    while (j < text.length) {
        if (text[j] === '"') {
            if (text[j + 1] === '"') {
                j += 2;
                continue;
            }
            return true;
        }
        j++;
    }
    return false;
}

/**
 * Parse plain-text clipboard data (Excel / Sheets / TSV) into a cell grid.
 * Handles Excel's quoting convention: a cell that contains tabs, newlines or
 * quotes is wrapped in double quotes with `""` escapes — so multiline cell
 * values survive the round trip. A cell-initial quote that never closes
 * (raw TSV from non-spreadsheet sources) is kept as literal text so it can't
 * swallow the rest of the paste.
 */
export function parseClipboardGrid(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let inQuotes = false;
    let cellStart = true;
    let i = 0;

    while (i < text.length) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"') {
                if (text[i + 1] === '"') {
                    cell += '"';
                    i += 2;
                } else {
                    inQuotes = false;
                    i++;
                }
            } else {
                cell += ch;
                i++;
            }
            continue;
        }
        if (ch === '"' && cellStart && hasClosingQuote(text, i + 1)) {
            inQuotes = true;
            cellStart = false;
            i++;
        } else if (ch === '\t') {
            row.push(cell);
            cell = '';
            cellStart = true;
            i++;
        } else if (ch === '\n' || ch === '\r') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            cellStart = true;
            i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
        } else {
            cell += ch;
            cellStart = false;
            i++;
        }
    }
    row.push(cell);
    rows.push(row);

    // Excel appends a trailing newline to copies — drop the resulting empty row.
    if (rows.length > 1 && rows[rows.length - 1].every(c => c === '')) rows.pop();
    return rows;
}

export function isMultiCellGrid(grid: string[][]): boolean {
    return grid.length > 1 || (grid[0]?.length ?? 0) > 1;
}

export function isTruthyCheckbox(raw: unknown): boolean {
    if (raw === true) return true;
    if (raw === false || raw === undefined || raw === null) return false;
    return CHECKBOX_TRUTHY.includes(normalizeArabicDigits(String(raw).trim().toLowerCase()));
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(y: number): boolean {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Real calendar validity (month 1-12, day valid for month/leap year) within
 *  a sane year window. */
function isValidYmd(y: number, m: number, d: number): boolean {
    if (y < 1900 || y > 2200) return false;
    if (m < 1 || m > 12) return false;
    const maxDay = m === 2 && isLeapYear(y) ? 29 : DAYS_IN_MONTH[m - 1];
    return d >= 1 && d <= maxDay;
}

/** True only for YYYY-MM-DD strings that are real calendar dates —
 *  '2026-09-31' fails even though it matches the ISO shape. */
export function isValidIsoDate(v: string): boolean {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return false;
    return isValidYmd(Number(m[1]), Number(m[2]), Number(m[3]));
}

function toIso(y: number, m: number, d: number): string {
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Numeric date: three groups split by the SAME / . - separator. */
const NUMERIC_DATE = /^(\d{1,4})([/.\-])(\d{1,2})\2(\d{1,4})$/;

/**
 * True when a numeric date is d/m vs m/d ambiguous: year-last form whose
 * first two parts are BOTH plausible months (<= 12) but differ, so the two
 * readings are different real dates. We refuse to guess these — validateCell
 * flags them and asks for YYYY-MM-DD.
 */
export function isAmbiguousNumericDate(raw: string): boolean {
    const m = NUMERIC_DATE.exec(raw.trim());
    if (!m) return false;
    const [, a, , b, c] = m;
    if (a.length === 4 || c.length !== 4) return false;
    const first = Number(a);
    const second = Number(b);
    const year = Number(c);
    if (first === second) return false;
    return isValidYmd(year, second, first) && isValidYmd(year, first, second);
}

/**
 * Deterministic normalization of an imported date string to ISO (YYYY-MM-DD)
 * so it can live in an <input type="date">. No `new Date(string)` parsing —
 * that silently reads DD/MM as MM/DD and rolls invalid days over. Accepted:
 *  - ISO YYYY-MM-DD (calendar validity is checked by validateCell);
 *  - year-first numeric forms (2026/9/1, 2026.09.01) — unambiguous;
 *  - year-last numeric d/m/y or m/d/y with a 4-digit year, ONLY when exactly
 *    one reading is calendar-valid (13/9/2026) or both readings are the same
 *    date (5/5/2026). Ambiguous values like 01/09/2026 are returned raw so
 *    validateCell can flag them instead of guessing.
 * Everything else ('5 5', '2026-09', 'Jan 5, 2026') is returned untouched
 * and flagged by validateCell.
 */
export function normalizeDateValue(raw: string): string {
    // Arabic-Indic digits are normalized first — same courtesy the checkbox
    // truthy set extends to ١ — so dates pasted from an Arabic-locale
    // spreadsheet resolve like their ASCII twins ('١٣/٩/٢٠٢٦' → 2026-09-13)
    // and ambiguous ones get the proper "Ambiguous date" flag downstream.
    const v = normalizeArabicDigits(raw.trim());
    if (!v || ISO_DATE.test(v)) return v;

    const m = NUMERIC_DATE.exec(v);
    if (!m) return v;
    const [, a, , b, c] = m;

    // Year-first: 2026/09/01 — unambiguous.
    if (a.length === 4) {
        const y = Number(a);
        const mo = Number(b);
        const d = Number(c);
        return isValidYmd(y, mo, d) ? toIso(y, mo, d) : v;
    }

    // Year-last: require an explicit 4-digit year (2-digit years are too
    // ambiguous to guess a century for).
    if (c.length !== 4) return v;
    const y = Number(c);
    const first = Number(a);
    const second = Number(b);

    const dmy = isValidYmd(y, second, first); // first=day, second=month
    const mdy = isValidYmd(y, first, second); // first=month, second=day

    if (dmy && mdy) {
        // Same date either way (5/5/2026) — safe. Otherwise ambiguous: don't guess.
        return first === second ? toIso(y, first, second) : v;
    }
    if (dmy) return toIso(y, second, first);
    if (mdy) return toIso(y, first, second);
    return v;
}

/**
 * Coerce a raw imported/pasted value into the grid's storage shape for a
 * field: booleans for checkboxes, canonical option values for radio groups
 * (matching option values AND bilingual option labels, case/punctuation
 * insensitive), ISO strings for dates, plain strings otherwise.
 */
export function coerceCellValue(field: BatchFieldDef, raw: unknown): RowValue {
    if (field.type === 'checkbox') return isTruthyCheckbox(raw);
    const s = raw === undefined || raw === null ? '' : String(raw);
    if (field.type === 'date') return normalizeDateValue(s);
    if (field.type === 'radioGroup') {
        const v = s.trim();
        if (!v) return '';
        const key = normalizeKey(v);
        const byValue = field.options?.find(o => normalizeKey(o) === key);
        if (byValue) return byValue;
        const byLabel = field.optionLabels?.find(
            ol => normalizeKey(ol.en) === key || normalizeKey(ol.ar) === key
        );
        return byLabel ? byLabel.value : v;
    }
    return s;
}

/**
 * Soft per-cell validation. Empty is always valid (all fields optional).
 * Returns a human-readable problem or null.
 */
export function validateCell(field: BatchFieldDef, value: RowValue): string | null {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    if (v === '') return null;
    if (field.type === 'radioGroup' && field.options && !field.options.includes(v)) {
        return `Must be one of: ${field.options.join(', ')}`;
    }
    if (field.type === 'date') {
        // Hand-typed values reach here without passing through
        // normalizeDateValue, so normalize Arabic-Indic digits before the
        // checks — otherwise an Arabic ambiguous date would get the generic
        // "not recognized" message instead of the ambiguity one.
        const dv = normalizeArabicDigits(v);
        if (ISO_DATE.test(dv)) {
            return isValidIsoDate(dv) ? null : 'Not a real calendar date — check the day and month';
        }
        if (isAmbiguousNumericDate(dv)) {
            return 'Ambiguous date (day/month vs month/day) — use YYYY-MM-DD';
        }
        return 'Not a recognized date — use YYYY-MM-DD';
    }
    return null;
}

export interface BatchCellError {
    /** 1-based row number, matching the grid's visible # column. */
    rowNumber: number;
    label: string;
    message: string;
}

/**
 * Blocking pre-generation validation: run validateCell over every cell of
 * every row and collect the failures. radioGroup mismatches are EXCLUDED —
 * the fill pipeline drops them (field left blank) and the results panel
 * surfaces a non-fatal warning — but everything else returned here (bad or
 * ambiguous dates) would be stamped into the PDFs verbatim, so generation
 * must not start while this list is non-empty.
 */
export function collectRowErrors(rows: RowData[], columns: BatchColumn[]): BatchCellError[] {
    const errors: BatchCellError[] = [];
    rows.forEach((row, i) => {
        for (const col of columns) {
            if (col.type === 'radioGroup') continue;
            const message = validateCell(col, row[col.name] ?? '');
            if (message) errors.push({ rowNumber: i + 1, label: col.label, message });
        }
    });
    return errors;
}

/**
 * Project a grid row onto the fill pipeline's form-data shape: booleans pass
 * through, strings are END-trimmed (internal newlines in multiline values
 * survive) and dropped when empty — so fillPdfForm never receives
 * whitespace-padded text.
 */
export function buildRowFormData(row: RowData, columns: BatchColumn[]): Record<string, RowValue> {
    const formData: Record<string, RowValue> = {};
    for (const col of columns) {
        const v = row[col.name];
        if (typeof v === 'boolean') {
            formData[col.name] = v;
        } else if (typeof v === 'string') {
            const trimmed = v.trim();
            if (trimmed !== '') formData[col.name] = trimmed;
        }
    }
    return formData;
}

/** Strip filesystem-hostile characters and clamp length for output names. */
export function sanitizeFilenameBase(raw: string): string {
    return raw
        .replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80)
        .trim();
}

/**
 * Build the .pdf filename for each row from the chosen name column, falling
 * back to `${prefix}_${i+1}` when the cell is empty, and deduplicating
 * collisions with _2, _3, … suffixes.
 */
export function buildRowFilenames(
    rows: RowData[],
    nameField: string | null,
    prefix: string
): string[] {
    const taken = new Set<string>();
    return rows.map((row, i) => {
        const raw = nameField ? String(row[nameField] ?? '') : '';
        const base = sanitizeFilenameBase(raw) || `${prefix}_${i + 1}`;
        let candidate = base;
        let n = 2;
        while (taken.has(candidate.toLowerCase())) {
            candidate = `${base}_${n}`;
            n++;
        }
        taken.add(candidate.toLowerCase());
        return `${candidate}.pdf`;
    });
}
