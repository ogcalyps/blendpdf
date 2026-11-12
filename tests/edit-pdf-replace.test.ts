/**
 * The removal engine (lib/edit-pdf/replace.ts, PDFium 2.15.1 in Node): a
 * detected line is TRULY taken out of the file, nothing else moves, and
 * every refusal is said before anything is saved.
 *
 * "Gone" is checked three ways: pdf.js finds no glyph left on the line,
 * pdf.js no longer extracts its words anywhere on the page, and for the
 * files whose text is stored as plain strings, the line's marker token is in
 * none of the file's inflated streams. "Nothing else moves": every other
 * line is found again with the same text, baseline and extent.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { PDFDocument, PDFNumber, PDFOperator, PDFOperatorNames, PDFString, StandardFonts, beginText, endText, moveText, rgb, setFontAndSize } from 'pdf-lib';
import { checkLineRemoval, isEditPdfError, loadTextReplacer, releaseTextReplacer } from '../lib/edit-pdf';
import type { EditPdfError, SourceTextLine } from '../lib/edit-pdf';
import { removeLines } from '../lib/edit-pdf/replace';
import type { RemovalTarget } from '../lib/edit-pdf/replace';
import { loadPdfium } from '../lib/edit-pdf/pdfium';
import { boundsOf, containsMarker, readGraphics, searchableBytes } from './helpers/edit-pdf-oracle';
import { PDFIUM_WASM, detectPage, findLine, fixture, linesOn, pagesText, sameLine, sharedLetterhead, squash } from './helpers/replace-fixtures';

beforeAll(async () => {
  await loadTextReplacer({ pdfiumWasm: PDFIUM_WASM });
});
afterAll(async () => {
  await releaseTextReplacer();
});

const target = (line: SourceTextLine, objectId = 'r1', pageNumber = line.pageIndex + 1): RemovalTarget => ({
  objectId,
  pageIndex: line.pageIndex,
  pageNumber,
  geometry: line.geometry,
});

async function rejection(promise: Promise<unknown>): Promise<EditPdfError> {
  try {
    await promise;
  } catch (error) {
    if (isEditPdfError(error)) return error;
    throw error;
  }
  throw new Error('expected a rejection');
}

const CASES: Array<{ file: string; line: string | number; token?: string }> = [
  { file: 'a-latin-pdflib.pdf', line: 'Settlement reference', token: 'QX-4471' },
  { file: 'a-latin-pdflib.pdf', line: 'Account update', token: 'Account update' },
  { file: 'b-arabic-chrome.pdf', line: 'المبلغ الإجمالي هو 250' },
  { file: 'b-arabic-chrome.pdf', line: '1,250.00' },
  { file: 'b-arabic-chrome.pdf', line: 3 }, // dots drawn as separate glyphs, one of them lowered off the baseline
  { file: 'c-arabic-letter.pdf', line: 'سيتم تحويل المبلغ' },
  { file: 'c-arabic-letter.pdf', line: 'المدير العام' },
  { file: 'c-english-invoice.pdf', line: 'Bank transfer to account' },
  { file: 'c-english-invoice.pdf', line: 'Item' },
  { file: 'c4-english-tight.pdf', line: 7 }, // set solid: the ink boxes overlap the neighbours'
  { file: 'd1-form-xobject.pdf', line: 'Line two holds', token: 'ORCHID-77' },
  { file: 'd2-rotate90-cropbox.pdf', line: 'Second line carries', token: 'MANGO-310' },
  { file: 'e-nontext-under-text.pdf', line: 'Text over a picture', token: 'LEMON-22' },
  { file: 'e-nontext-under-text.pdf', line: 'Shaded row text', token: 'PEACH-11' },
  { file: 'e-nontext-under-text.pdf', line: 'Underlined words', token: 'GRAPE-33' },
  { file: 'e-nontext-under-text.pdf', line: 'Cell text', token: 'KIWI-44' },
];

describe('removeLines: the line leaves the file, nothing else moves', () => {
  for (const { file, line: selector, token } of CASES) {
    it(`${file}: ${selector}`, async () => {
      const source = fixture(file);
      const { lines, pageCount } = await detectPage(source);
      const line = findLine(lines, selector);
      const start = performance.now();
      const { bytes, removedLines } = await removeLines(source, [target(line)], { sourcePageCount: pageCount });
      const ms = performance.now() - start;
      expect(removedLines).toBe(1);

      const after = (await detectPage(bytes)).lines;
      expect(linesOn(after, line).map((l) => l.text), 'glyphs left on the line').toEqual([]);
      // Where pdf.js extracts the line's words from the source (not Chrome's Arabic, which it reverses),
      // they must be found exactly once less afterwards (c4 repeats its paragraph).
      const count = (text: string) => (line.text ? text.split(squash(line.text)).length - 1 : 0);
      const before = count(squash((await pagesText(source))[0]));
      if (before > 0) expect(count(squash((await pagesText(bytes))[0]))).toBe(before - 1);
      if (token) {
        expect(containsMarker(searchableBytes(source), token), 'the token is in the source as a plain string').toBe(true);
        expect(containsMarker(searchableBytes(bytes), token), 'the token is in an inflated stream of the output').toBe(false);
      }
      for (const other of lines) {
        if (other === line) continue;
        const again = after.find((l) => sameLine(l, other));
        expect(again, `neighbour moved or lost: ${other.text}`).toBeDefined();
        expect(again!.text).toBe(other.text);
      }
      console.log(`removeLines ${file} ${String(selector).slice(0, 20)}: ${ms.toFixed(0)} ms`);
      expect(ms).toBeLessThan(250); // 3-41 ms on a laptop; the bound only catches a pathological slowdown
    });
  }

  it('removes several lines of one page in one pass', async () => {
    const source = fixture('c-english-invoice.pdf');
    const { lines, pageCount } = await detectPage(source);
    const picked = [findLine(lines, 'Invoice number'), findLine(lines, '18.50'), findLine(lines, 'Total due')];
    const { bytes, removedLines } = await removeLines(source, picked.map((l, i) => target(l, `r${i}`)), { sourcePageCount: pageCount });
    expect(removedLines).toBe(3);
    const after = (await detectPage(bytes)).lines;
    for (const line of picked) expect(linesOn(after, line)).toEqual([]);
    expect(after).toHaveLength(lines.length - 3);
    expect(after.find((l) => l.text === '74.00' && sameLine(l, findLine(lines, '74.00')))).toBeDefined();
  });

  it('an object that runs into the next cell: only this cell goes (band fallback), the shading under it stays', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 400]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawRectangle({ x: 60, y: 290, width: 300, height: 30, color: rgb(0.85, 0.9, 0.97) });
    const key = page.node.newFontDictionary(font.name, font.ref);
    // ONE text object (one TJ) for two table cells, 12 em apart.
    const cells = PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [doc.context.obj([PDFString.of('Name APRICOT-5'), PDFNumber.of(-12000), PDFString.of('Value KEEP-6')])]);
    page.pushOperators(beginText(), setFontAndSize(key, 12), moveText(72, 300), cells, endText());
    page.drawText('Line below stays here.', { x: 72, y: 270, size: 12, font });
    const source = await doc.save({ useObjectStreams: false });

    const { lines } = await detectPage(source);
    expect(lines.map((l) => l.text)).toEqual(['Name APRICOT-5', 'Value KEEP-6', 'Line below stays here.']);
    const { bytes } = await removeLines(source, [target(lines[0])], { sourcePageCount: 1 });
    const after = (await detectPage(bytes)).lines;
    expect(after.map((l) => l.text)).toEqual(['Value KEEP-6', 'Line below stays here.']);
    expect(sameLine(after[0], lines[1])).toBe(true);
    expect(containsMarker(searchableBytes(bytes), 'APRICOT')).toBe(false);
    const fills = (await readGraphics(bytes)).pages[0].paths.filter((p) => p.paint === 'fill');
    const original = (await readGraphics(source)).pages[0].paths.filter((p) => p.paint === 'fill');
    // The same rectangle (PDFium may write its corners in another order).
    expect(fills.map((p) => boundsOf(p.points))).toEqual(original.map((p) => boundsOf(p.points)));
    // PDFium writes the colour back with its own precision (0.9 becomes a hair under it).
    fills[0].fill.forEach((channel, i) => expect(Math.abs(channel - original[0].fill[i])).toBeLessThanOrEqual(1));
  });
});

describe('removeLines: refusals and failures', () => {
  it('a page whose rewrite would change anything else (soft masks) is refused with its page number', async () => {
    const source = fixture('h-chrome-complex.pdf');
    const { lines, pageCount } = await detectPage(source);
    const error = await rejection(removeLines(source, [target(findLine(lines, 'السطر الأخير'), 'r7', 3)], { sourcePageCount: pageCount }));
    expect(error.code).toBe('REPLACE_REFUSED');
    expect(error.errorCode).toBe('REPLACE_REFUSED');
    expect(error.objectIds).toEqual(['r7']);
    expect(error.pageNumbers).toEqual([3]);
  });

  it('refuses a line inside a form that another page draws too (it would vanish there as well)', async () => {
    const stamp = await PDFDocument.create();
    const font = await stamp.embedFont(StandardFonts.Helvetica);
    stamp.addPage([300, 60]).drawText('Letterhead line PLUM-12 on every page', { x: 10, y: 20, size: 12, font });
    const doc = await PDFDocument.create();
    const [form] = await doc.embedPdf(await stamp.save());
    for (let i = 0; i < 2; i++) doc.addPage([612, 792]).drawPage(form, { x: 72, y: 700 });
    const source = await doc.save();
    const { lines, pageCount } = await detectPage(source);
    const error = await rejection(removeLines(source, [target(findLine(lines, 'Letterhead line'))], { sourcePageCount: pageCount }));
    expect(error.code).toBe('REPLACE_REFUSED');
    expect(error.pageNumbers).toEqual([1]);
  });

  it('a letterhead two pages share: replacing it on page 1 and a body line on page 2 is refused, in either order', async () => {
    // Rewriting page 1 rewrites the shared form in place; page 2 must still be compared with how it looked before.
    const source = await sharedLetterhead();
    const head = target(findLine((await detectPage(source, 1)).lines, 'Letterhead'), 'head');
    const body = target(findLine((await detectPage(source, 2)).lines, 'Body text of page 2'), 'body');
    for (const order of [[head, body], [body, head]]) {
      const error = await rejection(removeLines(source, order, { sourcePageCount: 2 }));
      expect(error.code).toBe('REPLACE_REFUSED');
    }
  });

  it('the letterhead replaced on both pages that share it leaves both pages', async () => {
    const source = await sharedLetterhead();
    const heads = [1, 2].map(async (n) => target(findLine((await detectPage(source, n)).lines, 'Letterhead'), `h${n}`));
    const { bytes, removedLines } = await removeLines(source, await Promise.all(heads), { sourcePageCount: 2 });
    expect(removedLines).toBe(2);
    expect(containsMarker(searchableBytes(bytes), 'ACME-SECRET-9')).toBe(false);
    const text = (await pagesText(bytes)).map(squash);
    expect(text[0]).toContain('BODY1');
    expect(text[1]).toContain('BODY2');
  });

  it('a letterhead shared with a page the export deletes: only the kept pages are checked', async () => {
    const source = await sharedLetterhead();
    const head = target(findLine((await detectPage(source, 1)).lines, 'Letterhead'));
    expect((await rejection(removeLines(source, [head], { sourcePageCount: 2 }))).code).toBe('REPLACE_REFUSED');
    const { bytes } = await removeLines(source, [head], { sourcePageCount: 2, keptPages: new Set([0]) });
    expect(squash((await pagesText(bytes))[0])).toBe(squash('Body text of page 1 BODY1'));
  });

  it('fails (never succeeds) when PDFium counts different pages than pdf-lib, or cannot open the file', async () => {
    const source = fixture('a-latin-pdflib.pdf');
    const { lines } = await detectPage(source);
    expect((await rejection(removeLines(source, [target(lines[0])], { sourcePageCount: 2 }))).code).toBe('REPLACE_FAILED');
    const garbage = new TextEncoder().encode('%PDF-1.7\nnot really a pdf');
    expect((await rejection(removeLines(garbage, [target(lines[0])], { sourcePageCount: 1 }))).code).toBe('REPLACE_FAILED');
  });
});

describe('checkLineRemoval: the click-time probe', () => {
  it('agrees with the export on the same lines and never changes the file', async () => {
    for (const [file, selectors] of [
      ['b-arabic-chrome.pdf', ['إشعار', '1,250.00', 3]],
      ['c4-english-tight.pdf', [2, 8]],
      ['h-chrome-complex.pdf', ['السطر الأخير', 'نص شفاف']],
    ] as Array<[string, Array<string | number>]>) {
      const source = fixture(file);
      const digest = createHash('sha256').update(source).digest('hex');
      const blob = new Blob([source.slice()]);
      const { lines, pageCount } = await detectPage(source);
      for (const selector of selectors) {
        const line = findLine(lines, selector);
        const probe = await checkLineRemoval(blob, line);
        const exported = await removeLines(source, [target(line)], { sourcePageCount: pageCount }).then(
          () => 'ok',
          (error: EditPdfError) => error.code,
        );
        expect([file, selector, probe.ok ? 'ok' : 'REPLACE_REFUSED']).toEqual([file, selector, exported]);
        if (!probe.ok) expect(probe.reason).toBe('PAGE_EFFECTS');
      }
      expect(createHash('sha256').update(source).digest('hex')).toBe(digest);
      expect(createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex')).toBe(digest);
    }
  });

  it('says CANT_ISOLATE when the band fallback leaves glyphs on the line, and the export refuses it too', async () => {
    // One TJ for two cells; the left cell ends in underscores, which sit below the thin band the fallback redacts.
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 400]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const key = page.node.newFontDictionary(font.name, font.ref);
    const cells = PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [doc.context.obj([PDFString.of('Sign here ____'), PDFNumber.of(-12000), PDFString.of('Date FIG')])]);
    page.pushOperators(beginText(), setFontAndSize(key, 12), moveText(72, 300), cells, endText());
    const source = await doc.save();
    const { lines } = await detectPage(source);
    expect(lines.map((l) => l.text)).toEqual(['Sign here ____', 'Date FIG']);
    expect(await checkLineRemoval(new Blob([source.slice()]), lines[0])).toEqual({ ok: false, reason: 'CANT_ISOLATE' });
    const error = await rejection(removeLines(source, [target(lines[0], 'r2', 4)], { sourcePageCount: 1 }));
    expect([error.code, error.objectIds, error.pageNumbers]).toEqual(['REPLACE_REFUSED', ['r2'], [4]]);
  });

  it('a line refused because of the form it sits in does not refuse the rest of the page', async () => {
    // PDFium 2.15.1 regenerates a changed form with its /Matrix applied twice, so the form's other line moves.
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const ctx = doc.context;
    const content = 'BT /F1 12 Tf 10 15 Td (Scaled form PECAN-2) Tj ET BT /F1 12 Tf 10 40 Td (Scaled keep) Tj ET';
    const form = ctx.register(ctx.flateStream(content, { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 400, 80], Matrix: [0.8, 0, 0, 0.8, 30, 10], Resources: { Font: { F1: font.ref } } }));
    const page = doc.addPage([612, 792]);
    const name = page.node.newXObject('Fm', form);
    const cm = PDFOperator.of(PDFOperatorNames.ConcatTransformationMatrix, [1.5, 0, 0, 1.5, 56, 500].map((n) => PDFNumber.of(n)));
    page.pushOperators(PDFOperator.of(PDFOperatorNames.PushGraphicsState), cm, PDFOperator.of(PDFOperatorNames.DrawObject, [name]), PDFOperator.of(PDFOperatorNames.PopGraphicsState));
    page.drawText('Plain body line FIG-3', { x: 56, y: 300, size: 12, font });
    const source = await doc.save({ useObjectStreams: false });
    const { lines } = await detectPage(source);
    const blob = new Blob([source.slice()]);
    const body = findLine(lines, 'Plain body');
    expect(await checkLineRemoval(blob, findLine(lines, 'Scaled form'))).toEqual({ ok: false, reason: 'PAGE_EFFECTS' });
    expect(await checkLineRemoval(blob, body)).toEqual({ ok: true });
    expect((await removeLines(source, [target(body)], { sourcePageCount: 1 })).removedLines).toBe(1);
  });

  it('a page that changes when rewritten refuses every line on it, saying so (wholePage)', async () => {
    const source = fixture('h-chrome-complex.pdf');
    const blob = new Blob([source.slice()]);
    const { lines } = await detectPage(source);
    for (const selector of ['السطر الأخير', 'نص شفاف']) {
      expect(await checkLineRemoval(blob, findLine(lines, selector))).toEqual({ ok: false, reason: 'PAGE_EFFECTS', wholePage: true });
    }
  });

  it('PDFium stopping mid-way (a wasm trap) is an EditPdfError, and the next call runs on a fresh module', async () => {
    const source = fixture('a-latin-pdflib.pdf');
    const blob = new Blob([source.slice()]);
    const { lines } = await detectPage(source);
    const trap = () => {
      throw new WebAssembly.RuntimeError('unreachable');
    };
    for (const [name, run, code] of [
      ['FPDFPage_GenerateContent', () => removeLines(source, [target(lines[0])], { sourcePageCount: 1, pdfiumWasm: PDFIUM_WASM }), 'REPLACE_FAILED'],
      ['FPDF_ImportPagesByIndex', () => checkLineRemoval(blob, lines[0]), 'UNREADABLE'],
    ] as const) {
      const pd = await loadPdfium(PDFIUM_WASM);
      const api = pd.api as unknown as Record<string, unknown>;
      api[name] = trap;
      api.FPDF_CloseDocument = trap; // a dead module throws again on the way out
      expect((await rejection(run())).code, name).toBe(code);
      const fresh = await loadPdfium(PDFIUM_WASM);
      expect(fresh, name).not.toBe(pd);
    }
    expect(await checkLineRemoval(blob, lines[0])).toEqual({ ok: true });
    expect((await removeLines(source, [target(lines[0])], { sourcePageCount: 1 })).removedLines).toBe(1);
  });

  it('a load failure is REPLACE_UNAVAILABLE and is not cached: the next load works', async () => {
    await releaseTextReplacer();
    const error = await rejection(loadTextReplacer({ pdfiumWasm: new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 9, 9, 9]) }));
    expect(error.code).toBe('REPLACE_UNAVAILABLE');
    await loadTextReplacer({ pdfiumWasm: PDFIUM_WASM });
    const source = fixture('a-latin-pdflib.pdf');
    const { lines } = await detectPage(source);
    expect(await checkLineRemoval(new Blob([source.slice()]), lines[0])).toEqual({ ok: true });
  });
});
