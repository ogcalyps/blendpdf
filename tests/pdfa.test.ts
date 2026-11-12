/**
 * PDF to PDF/A: veraPDF's verdict on the file, read from its own JSON report
 * (tests/fixtures/verapdf: real 1.30.4 output, a Word file that passed and a
 * Chrome file that failed 6.2.4.2 before the RGB conversion), and carried to
 * the page in X-PdfA-* headers. A verdict that can't be read is never a pass,
 * and pages that came back as pictures (PDF/A-1b) are carried with it.
 */
import { describe, expect, it } from 'vitest';
import pass from './fixtures/verapdf/pass-2b.json';
import fail from './fixtures/verapdf/fail-2b.json';
import { PDFA_HEADERS, isPdfaLevel, pdfaCheckFromHeaders, pdfaHeaders, readVeraPdfReport, type PdfaCheck } from '@/lib/pdfa';

const fromHeaders = (headers: Record<string, string>, requested: '1b' | '2b' | '3b' = '2b') =>
  pdfaCheckFromHeaders((name) => headers[name] ?? null, requested);

describe('readVeraPdfReport', () => {
  it('reads a pass with the validator version', () => {
    expect(readVeraPdfReport(pass)).toEqual({ compliant: true, validator: 'veraPDF 1.30.4', failedRules: [] });
  });

  it('reads a fail with the rules that failed', () => {
    expect(readVeraPdfReport(fail)).toEqual({ compliant: false, validator: 'veraPDF 1.30.4', failedRules: ['6.2.4.2-1'] });
  });

  it('gives null for anything that is not a verdict', () => {
    expect(readVeraPdfReport(null)).toBeNull();
    expect(readVeraPdfReport({})).toBeNull();
    expect(readVeraPdfReport({ report: { jobs: [{ taskException: { message: 'Out of memory' } }] } })).toBeNull();
    expect(readVeraPdfReport({ report: { jobs: [{ validationResult: [{ compliant: 'yes' }] }] } })).toBeNull();
  });

  it('keeps only well-formed rule ids, and at most eight', () => {
    const many = structuredClone(fail) as typeof fail;
    const summaries = many.report.jobs[0].validationResult[0].details.ruleSummaries;
    const rule = summaries[0];
    summaries.length = 0;
    for (let i = 1; i <= 12; i++) summaries.push({ ...rule, testNumber: i });
    summaries.push({ ...rule, clause: '6.1"><script>', testNumber: 1 });
    const read = readVeraPdfReport(many);
    expect(read?.failedRules).toHaveLength(8);
    expect(read?.failedRules.every((id) => /^\d+(\.\d+)*-\d+$/.test(id))).toBe(true);
  });
});

describe('X-PdfA headers', () => {
  const cases: PdfaCheck[] = [
    { level: '2b', status: 'pass', validator: 'veraPDF 1.30.4', failedRules: [], flattenedCount: 0, flattenedPages: [] },
    { level: '1b', status: 'fail', validator: 'veraPDF 1.30.4', failedRules: ['6.2.3.2-1', '6.2.3.2-2'], flattenedCount: 0, flattenedPages: [] },
    { level: '3b', status: 'unchecked', validator: null, failedRules: [], flattenedCount: 0, flattenedPages: [] },
    { level: '1b', status: 'pass', validator: 'veraPDF 1.30.4', failedRules: [], flattenedCount: 30, flattenedPages: [2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  ];

  it.each(cases)('round-trips $status', (check) => {
    expect(fromHeaders(pdfaHeaders(check), '2b')).toEqual(check);
  });

  it('reads missing or odd headers as unchecked, never as a pass', () => {
    expect(fromHeaders({}, '1b')).toEqual({ level: '1b', status: 'unchecked', validator: null, failedRules: [], flattenedCount: 0, flattenedPages: [] });
    expect(fromHeaders({ [PDFA_HEADERS.status]: 'PASS', [PDFA_HEADERS.level]: '4u' }).status).toBe('unchecked');
    expect(fromHeaders({ [PDFA_HEADERS.status]: 'pass', [PDFA_HEADERS.validator]: 'evil <b>' }).validator).toBeNull();
  });

  it('reads only well-formed flattened pages, and none without a count', () => {
    const odd = fromHeaders({ [PDFA_HEADERS.flattened]: '3', [PDFA_HEADERS.flattenedPages]: '2,0,x,<b>,07,4' });
    expect(odd).toMatchObject({ flattenedCount: 3, flattenedPages: [2, 4] });
    expect(fromHeaders({ [PDFA_HEADERS.flattened]: 'many', [PDFA_HEADERS.flattenedPages]: '2' })).toMatchObject({ flattenedCount: 0, flattenedPages: [] });
    expect(fromHeaders({ [PDFA_HEADERS.flattenedPages]: '2' })).toMatchObject({ flattenedCount: 0, flattenedPages: [] });
  });

  it('knows its levels', () => {
    expect(['1b', '2b', '3b'].every(isPdfaLevel)).toBe(true);
    expect(['2a', '2u', '', null, 2].some(isPdfaLevel)).toBe(false);
  });
});
