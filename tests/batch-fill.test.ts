import { describe, it, expect } from 'vitest';
import * as xlsx from 'xlsx';
import {
    getBatchColumns,
    buildTemplateHeaders,
    autoMatchColumns,
    parseClipboardGrid,
    isMultiCellGrid,
    coerceCellValue,
    isTruthyCheckbox,
    normalizeArabicDigits,
    normalizeDateValue,
    isValidIsoDate,
    isAmbiguousNumericDate,
    validateCell,
    collectRowErrors,
    buildRowFormData,
    buildRowFilenames,
    isRowEmpty,
    makeEmptyRow,
    makeBatchRow,
    BatchColumn,
    RowData,
} from '../lib/batch-fill';
import { parseSpreadsheetFile } from '../lib/csv-parsing';

const fields = [
    { type: 'text', name: 'disclosingPartyName', label: 'Disclosing Party Name' },
    { type: 'date', name: 'effectiveDate', label: 'Effective Date' },
    { type: 'radioGroup', name: 'ndaType', label: 'NDA Type', options: ['One-Way', 'Mutual'] },
    { type: 'section', label: 'Signatures (Disclosing Party)' },
    { type: 'text', name: 'disclosingName', label: 'Name' },
    { type: 'signature', name: 'disclosingSignature', label: 'Signature' },
    { type: 'text', name: 'receivingName', label: 'Name' },
    { type: 'checkbox', name: 'petsAllowed', label: 'Pets are permitted', labelAr: 'يُسمح بالحيوانات' },
    {
        type: 'radioGroup',
        name: 'furnished',
        label: 'Furnishing',
        labelAr: 'التأثيث',
        options: ['Furnished', 'Unfurnished'],
        optionLabels: [
            { value: 'Furnished', en: 'Furnished', ar: 'مفروش' },
            { value: 'Unfurnished', en: 'Unfurnished', ar: 'غير مفروش' },
        ],
    },
];
const columns = getBatchColumns(fields);

describe('getBatchColumns', () => {
    it('skips sections but keeps signatures in definition order', () => {
        expect(columns.map(c => c.name)).toEqual([
            'disclosingPartyName',
            'effectiveDate',
            'ndaType',
            'disclosingName',
            'disclosingSignature',
            'receivingName',
            'petsAllowed',
            'furnished',
        ]);
    });
});

describe('buildTemplateHeaders', () => {
    it('uses friendly labels, disambiguating duplicates with the field name', () => {
        const headers = buildTemplateHeaders(columns);
        expect(headers).toContain('Disclosing Party Name');
        expect(headers).toContain('Name (disclosingName)');
        expect(headers).toContain('Name (receivingName)');
        expect(new Set(headers).size).toBe(headers.length);
    });
});

describe('autoMatchColumns', () => {
    it('matches by field name, label, and normalized variants', () => {
        expect(
            autoMatchColumns(
                ['disclosingPartyName', 'EFFECTIVE  DATE!!', 'nda-type', 'unrelated'],
                columns
            )
        ).toEqual(['disclosingPartyName', 'effectiveDate', 'ndaType', null]);
    });

    it('round-trips its own template headers, including duplicate labels in order', () => {
        const headers = buildTemplateHeaders(columns);
        expect(autoMatchColumns(headers, columns)).toEqual(columns.map(c => c.name));
    });

    it('assigns duplicate plain labels to fields in definition order, once each', () => {
        expect(autoMatchColumns(['Name', 'Name', 'Name'], columns)).toEqual([
            'disclosingName',
            'receivingName',
            null,
        ]);
    });

    it('matches Arabic labels', () => {
        expect(autoMatchColumns(['التأثيث'], columns)).toEqual(['furnished']);
    });

    it('never maps one field to two columns', () => {
        const result = autoMatchColumns(['Effective Date', 'effectiveDate'], columns);
        expect(result[0]).toBe('effectiveDate');
        expect(result[1]).toBeNull();
    });
});

describe('parseClipboardGrid', () => {
    it('parses tab/newline separated cells', () => {
        expect(parseClipboardGrid('a\tb\nc\td')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
    });

    it('handles CRLF and the trailing newline Excel appends', () => {
        expect(parseClipboardGrid('a\tb\r\nc\td\r\n')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
    });

    it('preserves newlines inside quoted cells (Excel multiline cells)', () => {
        expect(parseClipboardGrid('"line1\nline2"\tb\nnext\td')).toEqual([
            ['line1\nline2', 'b'],
            ['next', 'd'],
        ]);
    });

    it('unescapes doubled quotes inside quoted cells', () => {
        expect(parseClipboardGrid('"He said ""hi"""\tb')).toEqual([['He said "hi"', 'b']]);
    });

    it('keeps Arabic text intact', () => {
        expect(parseClipboardGrid('شركة النور\tمفروش\nأحمد\tغير مفروش')).toEqual([
            ['شركة النور', 'مفروش'],
            ['أحمد', 'غير مفروش'],
        ]);
    });

    it('detects single-cell pastes so they are handled per-cell', () => {
        expect(isMultiCellGrid(parseClipboardGrid('just one value'))).toBe(false);
        expect(isMultiCellGrid(parseClipboardGrid('a\tb'))).toBe(true);
        expect(isMultiCellGrid(parseClipboardGrid('a\nb'))).toBe(true);
    });

    it('treats a cell-initial quote that never closes as literal text', () => {
        // The unbalanced quote must not swallow the rest of the paste.
        expect(parseClipboardGrid('a\t"unterminated\nb\tc')).toEqual([
            ['a', '"unterminated'],
            ['b', 'c'],
        ]);
        expect(parseClipboardGrid('"36x24\tfoo\nrow2a\trow2b')).toEqual([
            ['"36x24', 'foo'],
            ['row2a', 'row2b'],
        ]);
        // Well-formed Excel quoting still round-trips.
        expect(parseClipboardGrid('"line1\nline2"\tb')).toEqual([['line1\nline2', 'b']]);
    });
});

describe('checkbox coercion', () => {
    it('accepts the classic truthy set plus Arabic yes-values', () => {
        for (const v of ['true', 'TRUE', 'yes', 'Y', '1', ' Yes ', 'نعم', ' نعم ', '١']) {
            expect(isTruthyCheckbox(v)).toBe(true);
        }
        for (const v of ['', 'no', '0', 'false', '٠', 'لا']) {
            expect(isTruthyCheckbox(v)).toBe(false);
        }
        expect(isTruthyCheckbox(true)).toBe(true);
    });

    it('normalizes Arabic-Indic digits to ASCII', () => {
        expect(normalizeArabicDigits('١٢٣')).toBe('123');
        expect(normalizeArabicDigits('۱۲۳')).toBe('123'); // Eastern Arabic-Indic
        expect(normalizeArabicDigits('abc')).toBe('abc');
    });
});

describe('coerceCellValue', () => {
    const radio = columns.find(c => c.name === 'furnished')!;

    it('snaps radio values to canonical options case-insensitively', () => {
        expect(coerceCellValue(radio, 'furnished')).toBe('Furnished');
        expect(coerceCellValue(radio, ' UNFURNISHED ')).toBe('Unfurnished');
    });

    it('maps bilingual option labels (Arabic) to option values', () => {
        expect(coerceCellValue(radio, 'مفروش')).toBe('Furnished');
        expect(coerceCellValue(radio, 'غير مفروش')).toBe('Unfurnished');
    });

    it('keeps unknown radio values so validation can flag them', () => {
        expect(coerceCellValue(radio, 'Partly')).toBe('Partly');
    });

    it('normalizes unambiguous dates to ISO and leaves junk alone', () => {
        const date = columns.find(c => c.name === 'effectiveDate')!;
        expect(coerceCellValue(date, '8/13/2026')).toBe('2026-08-13');
        expect(coerceCellValue(date, '2026-08-13')).toBe('2026-08-13');
        expect(coerceCellValue(date, 'not a date')).toBe('not a date');
        expect(coerceCellValue(date, '5')).toBe('5');
    });
});

describe('normalizeDateValue', () => {
    it('resolves unambiguous day-first and month-first numeric dates', () => {
        expect(normalizeDateValue('13/9/2026')).toBe('2026-09-13'); // only d/m/y is valid
        expect(normalizeDateValue('9/13/2026')).toBe('2026-09-13'); // only m/d/y is valid
        expect(normalizeDateValue('31/12/2026')).toBe('2026-12-31');
        expect(normalizeDateValue('1.9.2026')).toBe('1.9.2026'); // ambiguous → raw
        expect(normalizeDateValue('13.9.2026')).toBe('2026-09-13'); // dotted, unambiguous
        expect(normalizeDateValue('13-09-2026')).toBe('2026-09-13'); // dashed, unambiguous
    });

    it('refuses to guess ambiguous dates (both parts <= 12)', () => {
        expect(normalizeDateValue('01/09/2026')).toBe('01/09/2026');
        expect(normalizeDateValue('1/9/2026')).toBe('1/9/2026');
        // Same date under both readings — no guessing needed.
        expect(normalizeDateValue('5/5/2026')).toBe('2026-05-05');
    });

    it('accepts 4-digit-year-first numeric forms', () => {
        expect(normalizeDateValue('2026/09/01')).toBe('2026-09-01');
        expect(normalizeDateValue('2026.9.1')).toBe('2026-09-01');
        expect(normalizeDateValue('2026/13/01')).toBe('2026/13/01'); // invalid month → raw
    });

    it('never rolls invalid days over into a different date', () => {
        expect(normalizeDateValue('2/30/2026')).toBe('2/30/2026');
        expect(normalizeDateValue('30/2/2026')).toBe('30/2/2026');
    });

    it('returns everything else raw so validateCell can flag it', () => {
        expect(normalizeDateValue('7')).toBe('7');
        expect(normalizeDateValue('5 5')).toBe('5 5');
        expect(normalizeDateValue('2026-09')).toBe('2026-09');
        expect(normalizeDateValue('Jan 5, 2026')).toBe('Jan 5, 2026');
        expect(normalizeDateValue('13/9/26')).toBe('13/9/26'); // 2-digit year → raw
        expect(normalizeDateValue('01/09-2026')).toBe('01/09-2026'); // mixed separators
    });

    it('passes ISO-shaped values through for validateCell to check', () => {
        expect(normalizeDateValue('2026-09-13')).toBe('2026-09-13');
        expect(normalizeDateValue('2026-09-31')).toBe('2026-09-31');
    });

    it('trims surrounding whitespace before resolving', () => {
        expect(normalizeDateValue(' 2026-09-13 ')).toBe('2026-09-13');
        expect(normalizeDateValue('  13/9/2026')).toBe('2026-09-13');
    });

    it('normalizes Arabic-Indic digits so Arabic-locale dates resolve', () => {
        expect(normalizeDateValue('١٣/٩/٢٠٢٦')).toBe('2026-09-13'); // unambiguous d/m/y
        expect(normalizeDateValue('٢٠٢٦-٠٩-١٣')).toBe('2026-09-13'); // ISO-shaped
        expect(normalizeDateValue('٢٠٢٦/٠٩/٠١')).toBe('2026-09-01'); // year-first
        expect(normalizeDateValue('۱۳/۹/۲۰۲۶')).toBe('2026-09-13'); // Eastern Arabic-Indic
    });

    it('returns ambiguous Arabic-digit dates unresolved (digits normalized) for flagging', () => {
        // Not converted to ISO — but digit-normalized, so validateCell's
        // ambiguity check recognizes it.
        expect(normalizeDateValue('١/٩/٢٠٢٦')).toBe('1/9/2026');
        expect(isAmbiguousNumericDate(normalizeDateValue('١/٩/٢٠٢٦'))).toBe(true);
    });
});

describe('isValidIsoDate', () => {
    it('checks real calendar validity, not just shape', () => {
        expect(isValidIsoDate('2026-09-13')).toBe(true);
        expect(isValidIsoDate('2026-09-31')).toBe(false); // September has 30 days
        expect(isValidIsoDate('2026-02-29')).toBe(false); // 2026 is not a leap year
        expect(isValidIsoDate('2028-02-29')).toBe(true); // 2028 is
        expect(isValidIsoDate('2026-13-01')).toBe(false);
        expect(isValidIsoDate('2026-00-10')).toBe(false);
        expect(isValidIsoDate('13/9/2026')).toBe(false); // not ISO-shaped
    });
});

describe('isAmbiguousNumericDate', () => {
    it('detects day/month vs month/day ambiguity', () => {
        expect(isAmbiguousNumericDate('01/09/2026')).toBe(true);
        expect(isAmbiguousNumericDate('13/9/2026')).toBe(false);
        expect(isAmbiguousNumericDate('5/5/2026')).toBe(false); // same date both ways
        expect(isAmbiguousNumericDate('2026/09/01')).toBe(false); // year-first
        expect(isAmbiguousNumericDate('not a date')).toBe(false);
    });
});

describe('validateCell', () => {
    const radio = columns.find(c => c.name === 'ndaType')!;
    const date = columns.find(c => c.name === 'effectiveDate')!;

    it('allows empty values everywhere', () => {
        expect(validateCell(radio, '')).toBeNull();
        expect(validateCell(date, '')).toBeNull();
    });

    it('flags radio values outside the options', () => {
        expect(validateCell(radio, 'Mutual')).toBeNull();
        expect(validateCell(radio, 'Bilateral')).toMatch(/One-Way, Mutual/);
    });

    it('flags non-ISO dates', () => {
        expect(validateCell(date, '2026-08-13')).toBeNull();
        expect(validateCell(date, '13/45/2026')).toMatch(/date/i);
    });

    it('flags calendar-impossible ISO dates that a date input would render blank', () => {
        expect(validateCell(date, '2026-09-31')).toMatch(/calendar/i);
        expect(validateCell(date, '2026-02-29')).toMatch(/calendar/i);
        expect(validateCell(date, '2028-02-29')).toBeNull();
    });

    it('tells the user ambiguous dates need YYYY-MM-DD', () => {
        expect(validateCell(date, '01/09/2026')).toMatch(/ambiguous/i);
        expect(validateCell(date, '01/09/2026')).toMatch(/YYYY-MM-DD/);
    });

    it('sees through Arabic-Indic digits for hand-typed date values', () => {
        // Stored verbatim (never passed through coercion) — the ambiguity
        // message must still be reachable, and valid ISO must not be flagged.
        expect(validateCell(date, '١/٩/٢٠٢٦')).toMatch(/ambiguous/i);
        expect(validateCell(date, '٢٠٢٦-٠٩-١٣')).toBeNull();
        expect(validateCell(date, '٢٠٢٦-٠٩-٣١')).toMatch(/calendar/i);
    });
});

describe('collectRowErrors (pre-generation blocking)', () => {
    const dateErrors = (v: string) => collectRowErrors([{ effectiveDate: v }], columns);

    it('collects every red-flagged date cell with row number and label', () => {
        const rows: RowData[] = [
            { disclosingPartyName: 'Acme', effectiveDate: '2026-09-13' }, // clean
            { effectiveDate: '01/09/2026' }, // ambiguous
            {}, // empty row — never an error
            { effectiveDate: '2026-09-31' }, // calendar-invalid
            { effectiveDate: '9/13/26' }, // 2-digit year
        ];
        const errors = collectRowErrors(rows, columns);
        expect(errors.map(e => e.rowNumber)).toEqual([2, 4, 5]);
        expect(errors.every(e => e.label === 'Effective Date')).toBe(true);
        expect(errors[0].message).toMatch(/ambiguous/i);
        expect(errors[1].message).toMatch(/calendar/i);
        expect(errors[2].message).toMatch(/YYYY-MM-DD/);
    });

    it('excludes radioGroup mismatches — those stay non-fatal warnings', () => {
        expect(collectRowErrors([{ ndaType: 'Bilateral' }], columns)).toEqual([]);
        // ...but a bad radio AND a bad date still reports the date.
        expect(
            collectRowErrors([{ ndaType: 'Bilateral', effectiveDate: 'soon' }], columns)
        ).toHaveLength(1);
    });

    it('returns empty for clean and empty grids', () => {
        expect(collectRowErrors([], columns)).toEqual([]);
        expect(collectRowErrors([makeEmptyRow(columns)], columns)).toEqual([]);
        expect(dateErrors('2026-09-13')).toEqual([]);
    });
});

describe('buildRowFormData', () => {
    it('end-trims strings, drops empties, passes booleans through', () => {
        const formData = buildRowFormData(
            {
                disclosingPartyName: ' Acme Corp ',
                effectiveDate: '2026-09-13 ',
                disclosingName: '   ',
                petsAllowed: true,
                ndaType: '',
            },
            columns
        );
        expect(formData).toEqual({
            disclosingPartyName: 'Acme Corp',
            effectiveDate: '2026-09-13',
            petsAllowed: true,
        });
    });

    it('keeps INTERNAL newlines in multiline values — only the ends are trimmed', () => {
        const multilineCols: BatchColumn[] = [
            { type: 'text', name: 'address', label: 'Address', multiline: true },
        ];
        expect(buildRowFormData({ address: '12 High St\nSpringfield\n' }, multilineCols)).toEqual({
            address: '12 High St\nSpringfield',
        });
    });
});

describe('batch rows', () => {
    it('mints stable unique row ids outside the form values', () => {
        const a = makeBatchRow(columns as BatchColumn[]);
        const b = makeBatchRow(columns as BatchColumn[]);
        expect(a.id).not.toBe(b.id);
        expect(Object.keys(a.values)).not.toContain('id');
        expect(isRowEmpty(a.values, columns)).toBe(true);
    });
});

describe('buildRowFilenames', () => {
    it('names by the chosen column with sanitization, fallback, and dedupe', () => {
        const rows = [
            { disclosingPartyName: 'Acme Corp' },
            { disclosingPartyName: 'Acme Corp' },
            { disclosingPartyName: '' },
            { disclosingPartyName: 'Bad/Name: <ok>' },
        ];
        expect(buildRowFilenames(rows, 'disclosingPartyName', 'nda')).toEqual([
            'Acme Corp.pdf',
            'Acme Corp_2.pdf',
            'nda_3.pdf',
            'Bad Name ok.pdf',
        ]);
    });

    it('falls back to row numbers when no name column is chosen', () => {
        expect(buildRowFilenames([{}, {}], null, 'nda')).toEqual(['nda_1.pdf', 'nda_2.pdf']);
    });

    it('keeps Arabic names', () => {
        expect(buildRowFilenames([{ n: 'شركة النور' }], 'n', 'nda')).toEqual(['شركة النور.pdf']);
    });

    it('avoids cascading collisions with existing _n names', () => {
        const rows = [{ n: 'a' }, { n: 'a_2' }, { n: 'a' }];
        const names = buildRowFilenames(rows, 'n', 'x');
        expect(new Set(names).size).toBe(3);
    });
});

describe('row emptiness', () => {
    it('treats fresh rows and unchecked checkboxes as empty', () => {
        const row = makeEmptyRow(columns as BatchColumn[]);
        expect(isRowEmpty(row, columns)).toBe(true);
        row['petsAllowed'] = true;
        expect(isRowEmpty(row, columns)).toBe(false);
        row['petsAllowed'] = false;
        row['disclosingName'] = '  ';
        expect(isRowEmpty(row, columns)).toBe(true);
        row['disclosingName'] = 'أحمد';
        expect(isRowEmpty(row, columns)).toBe(false);
    });
});

describe('parseSpreadsheetFile xlsx date recovery', () => {
    /** Build a real .xlsx in memory and wrap it as an uploaded File. */
    function makeXlsxFile(ws: xlsx.WorkSheet): File {
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
        const buf = xlsx.write(wb, { type: 'array', bookType: 'xlsx' });
        return new File([buf], 'import.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
    }

    it('recovers date serials as ISO instead of their lossy display text', async () => {
        const ws = xlsx.utils.aoa_to_sheet([['Effective Date', 'Renewal', 'Name']]);
        // Serial 46278 = 2026-09-13; 'm/d/yy' is Excel's stock Short Date
        // (numFmtId 14), which would otherwise surface as '9/13/26'.
        ws['A2'] = { t: 'n', v: 46278, z: 'm/d/yy' };
        // Serial 46031 = 2026-01-09; mm/dd/yyyy display '01/09/2026' would be
        // falsely flagged ambiguous even though the serial is exact.
        ws['B2'] = { t: 'n', v: 46031, z: 'mm/dd/yyyy' };
        ws['C2'] = { t: 's', v: 'Acme' };
        ws['!ref'] = 'A1:C2';

        const { headers, rows } = await parseSpreadsheetFile(makeXlsxFile(ws));
        expect(headers).toEqual(['Effective Date', 'Renewal', 'Name']);
        expect(rows).toEqual([['2026-09-13', '2026-01-09', 'Acme']]);

        // And the recovered values sail through the date pipeline unflagged.
        const dateCol = columns.find(c => c.name === 'effectiveDate')!;
        expect(coerceCellValue(dateCol, rows[0][0])).toBe('2026-09-13');
        expect(validateCell(dateCol, rows[0][0])).toBeNull();
    });

    it('leaves non-date numeric formats as display text', async () => {
        const ws = xlsx.utils.aoa_to_sheet([['Rate', 'Count']]);
        ws['A2'] = { t: 'n', v: 0.5, z: '0%' };
        ws['B2'] = { t: 'n', v: 46278 }; // General — stays a raw-looking number
        ws['!ref'] = 'A1:B2';

        const { rows } = await parseSpreadsheetFile(makeXlsxFile(ws));
        expect(rows[0][0]).toBe('50%');
        expect(rows[0][1]).toBe('46278');
    });

    it('leaves time-only cells alone (no fake 1900 dates)', async () => {
        const ws = xlsx.utils.aoa_to_sheet([['Start']]);
        ws['A2'] = { t: 'n', v: 0.5, z: 'h:mm' }; // noon, no date part
        ws['!ref'] = 'A1:A2';

        const { rows } = await parseSpreadsheetFile(makeXlsxFile(ws));
        expect(rows[0][0]).not.toMatch(/^\d{4}-/);
    });
});
