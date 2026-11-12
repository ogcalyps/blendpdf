/**
 * ActualText after "Edit text (beta)" (lib/edit-pdf/spans.ts). Chrome marks
 * its Arabic glyphs with `/Span <</ActualText …>> BDC … EMC`; PDFium, when it
 * rewrites the page, writes each glyph as its own `q … cm BT … ET Q` and
 * closes the span after the Q. poppler emits a span's text at its EMC with
 * the CTM in force then, so every untouched line of the page read in
 * fragments in pdftotext ("دة" for "شهادة عمل"). Test set tasks 1a, 4a, 5a
 * and 6a (scripts/arabic-pdf-test) are the regression cases.
 *
 * The oracle is what poppler relies on: every glyph of a span is drawn
 * under the same CTM as the span's EMC. PDFium's own output breaks it (so
 * the oracle is not vacuous); the export's output keeps it, keeps every span
 * and draws exactly the same page. Where pdftotext and qpdf are installed,
 * the test set's checker also reads the untouched lines back.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFArray, PDFDocument, PDFName, PDFRawStream, PDFRef, decodePDFRawStream } from 'pdf-lib';
import { exportEditedPdf, loadTextReplacer, releaseTextReplacer } from '../lib/edit-pdf';
import type { EditorPage, ExportOptions, ReplaceObject } from '../lib/edit-pdf';
import { removeLines } from '../lib/edit-pdf/replace';
import { fixActualText, fixSpans } from '../lib/edit-pdf/spans';
import { anyFixture, changedPixels, renderWithPdfium, replaceWithFont } from './helpers/keep-font';
import { CAIRO, PDFIUM_WASM, detectPage, findLine } from './helpers/replace-fixtures';
import * as checker from '../scripts/arabic-pdf-test/check.mjs';

type M = [number, number, number, number, number, number];

beforeAll(async () => {
  await loadTextReplacer({ pdfiumWasm: PDFIUM_WASM });
});
afterAll(async () => {
  await releaseTextReplacer();
});

const OPTIONS: ExportOptions = { fontBytes: CAIRO, pdfiumWasm: PDFIUM_WASM };
const pagesOf = (count: number): EditorPage[] => Array.from({ length: count }, (_, i) => ({ id: `s${i}`, source: { kind: 'source', index: i }, rotation: 0 }));
const request = (count: number, objects: ReplaceObject[]) => ({ pages: pagesOf(count), objects, assets: {}, fallbackDirection: 'rtl' as const });

/** The first page's content streams, decoded and joined (one char per byte). */
async function pageContent(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  const { context } = doc;
  const { node } = doc.getPages()[0];
  const contents = node.get(PDFName.of('Contents'));
  const list = contents instanceof PDFRef ? context.lookup(contents) : contents;
  const streams = (list instanceof PDFArray ? list.asArray() : [contents]).map((ref) => context.lookup(ref as PDFRef));
  return streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString('latin1')).join('\n');
}

const TOKEN = /\/[^\s/<>[\]()]*|<<|>>|<[0-9A-Fa-f\s]*>|\((?:\\.|[^\\)])*\)|[[\]]|[^\s/<>[\]()]+/g;
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;
const multiply = (m: M, n: M): M => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];

/** Each ActualText span of a content stream: the CTM of every glyph run inside it, and the CTM at its EMC. */
function spans(content: string): Array<{ glyphs: M[]; end: M }> {
  const out: Array<{ glyphs: M[]; end: M }> = [];
  const marks: Array<{ actual: boolean; glyphs: M[] }> = [];
  const saved: M[] = [];
  let ctm: M = [1, 0, 0, 1, 0, 0];
  let operands: string[] = [];
  for (const [token] of content.matchAll(TOKEN)) {
    if (token.startsWith('/') || token.startsWith('<') || token.startsWith('(') || token === '[' || token === ']' || token === '>>' || NUMBER.test(token)) {
      operands.push(token);
      continue;
    }
    if (token === 'q') saved.push(ctm);
    else if (token === 'Q') ctm = saved.pop()!;
    else if (token === 'cm') ctm = multiply(operands.slice(-6).map(Number) as M, ctm);
    else if (token === 'BDC' || token === 'BMC') marks.push({ actual: operands.includes('/ActualText'), glyphs: [] });
    else if (token === 'EMC') {
      const mark = marks.pop()!;
      if (mark.actual) out.push({ glyphs: mark.glyphs, end: ctm });
    } else if (token === 'Tj' || token === 'TJ' || token === "'" || token === '"') {
      for (const mark of marks) mark.glyphs.push(ctm);
    }
    operands = [];
  }
  return out;
}

const same = (a: M, b: M) => a.every((v, i) => Math.abs(v - b[i]) < 1e-6);
/** Spans poppler would put somewhere else than their glyphs. */
const misplaced = (found: ReturnType<typeof spans>) => found.filter((s) => s.glyphs.length === 0 || s.glyphs.some((g) => !same(g, s.end))).length;

describe('fixSpans', () => {
  const glyph = (x: number, code: string) => `q 0 0 0 rg /G3 gs 1 0 0 1 ${x} 700 cm BT .75 0 0 .75 0 0 Tm /FXF1 20 Tf 0 Tr <${code}> Tj ET Q`;

  it('draws the glyphs of a span under the CTM its EMC sees: the cm translation goes into the Tm', () => {
    const before = `/NonStruct <</MCID 0>> BDC\n/Span <</ActualText<feff0644>>> BDC\n${glyph(100, '03de')}\nEMC\n${glyph(120, '0003')}\nEMC\n`;
    const result = fixSpans(before)!;
    expect(result.objects).toBe(1);
    // The glyph outside any ActualText span stays as PDFium wrote it.
    expect(result.text).toBe(
      `/NonStruct <</MCID 0>> BDC\n/Span <</ActualText<feff0644>>> BDC\nq 0 0 0 rg /G3 gs BT .75 0 0 .75 100 700 Tm /FXF1 20 Tf 0 Tr <03de> Tj ET Q\nEMC\n${glyph(120, '0003')}\nEMC\n`,
    );
    expect(misplaced(spans(before))).toBe(1);
    expect(misplaced(spans(result.text))).toBe(0);
  });

  it('fixes a letter drawn with its haraka in two objects, each with its own clip', () => {
    const clipped = glyph(108.5, '03a9').replace('/G3 gs', '51 790 493 -739 re W* n /G3 gs');
    const { text, objects } = fixSpans(`/Span <</ActualText<feff062f064e>>> BDC\n${glyph(100, '02f4')}\n${clipped}\nEMC\n`)!;
    expect(objects).toBe(2);
    expect(text).toBe(
      '/Span <</ActualText<feff062f064e>>> BDC\nq 0 0 0 rg /G3 gs BT .75 0 0 .75 100 700 Tm /FXF1 20 Tf 0 Tr <02f4> Tj ET Q\nq 0 0 0 rg 51 790 493 -739 re W* n /G3 gs BT .75 0 0 .75 108.5 700 Tm /FXF1 20 Tf 0 Tr <03a9> Tj ET Q\nEMC\n',
    );
    expect(misplaced(spans(text))).toBe(0);
  });

  it('starts a run placed by Td alone from the translation, and moves every later Tm too', () => {
    const { text } = fixSpans('/Span <</ActualText<feff0627>>> BDC q 1 0 0 1 10 20 cm BT 5 0 Td (a) Tj 2 0 0 2 1 1 Tm (b) Tj ET Q EMC')!;
    expect(text).toBe('/Span <</ActualText<feff0627>>> BDC q BT 1 0 0 1 10 20 Tm 5 0 Td (a) Tj 2 0 0 2 11 21 Tm (b) Tj ET Q EMC');
  });

  it('reads a span named in /Properties through the callback, and spans nested in other marks', () => {
    const before = `/Span /MC3 BDC\n/Artifact BMC\n${glyph(100, '03de')}\nEMC\nEMC\n`;
    expect(fixSpans(before)).toBeNull();
    expect(fixSpans(before, (name) => name === 'MC3')?.objects).toBe(1);
  });

  it('leaves alone what it cannot fix without changing the drawing', () => {
    const cases = [
      // a cm that scales (stroked text would change width)
      `/Span <</ActualText<feff0627>>> BDC\n${glyph(100, '038e').replace('1 0 0 1 100 700 cm', '2 0 0 2 100 700 cm')}\nEMC\n`,
      // a path painted before the text
      `/Span <</ActualText<feff0627>>> BDC\nq 0 0 10 10 re f 1 0 0 1 5 5 cm BT /F1 12 Tf (a) Tj ET Q\nEMC\n`,
      // something drawn after the text inside the same q
      `/Span <</ActualText<feff0627>>> BDC\nq 1 0 0 1 5 5 cm BT /F1 12 Tf (a) Tj ET 0 0 1 1 re f Q\nEMC\n`,
      // a span with no ActualText
      `/Span <</MCID 4>> BDC\n${glyph(100, '038e')}\nEMC\n`,
      // an inline image anywhere in the stream: its raw data can look like anything
      `/Span <</ActualText<feff0627>>> BDC\n${glyph(100, '038e')}\nEMC\nq BI /W 1 /H 1 /CS /G /BPC 8 ID \u{ff} EI Q\n`,
    ];
    for (const content of cases) expect(fixSpans(content), content).toBeNull();
  });

  it('is not misled by strings that hold operator names or brackets', () => {
    const before = `BT /F1 12 Tf (EMC \\) Q \\( q) Tj ET\n/Span <</ActualText (\\(x\\) BDC)>> BDC\n${glyph(100, '038e')}\nEMC\n`;
    const result = fixSpans(before)!;
    expect(result.objects).toBe(1);
    expect(result.text.startsWith('BT /F1 12 Tf (EMC \\) Q \\( q) Tj ET\n/Span <</ActualText (\\(x\\) BDC)>> BDC\nq 0 0 0 rg /G3 gs BT')).toBe(true);
  });
});

const cases = checker.loadCases();
/** The four test set tasks that change a line of a Chrome file (01, 04, 05 harakat, 06 with a clip). */
const TASKS = ['1a', '4a', '5a', '6a'];

/** A test set task (scripts/arabic-pdf-test/cases.json) as a visitor does it: the line edited in place, drawn in Cairo. */
async function taskEdit(id: string) {
  const task = cases.tasks.find((t: { id: string }) => t.id === id);
  const source = new Uint8Array(readFileSync(checker.findOriginal(task.file)));
  const { lines, pageCount } = await detectPage(source);
  const line = lines.find((l) => l.text.includes(task.from))!;
  return { task, source, pageCount, object: replaceWithFont(line, null, line.text.replace(task.from, task.to)) };
}

describe('the export keeps Chrome’s ActualText where poppler looks for it', () => {
  async function expectSpansKept(source: Uint8Array, pageCount: number, object: ReplaceObject): Promise<void> {
    // What PDFium alone writes: the span count the export must keep, and spans poppler misplaces.
    const removal = await removeLines(source, [{ objectId: object.id, pageIndex: 0, pageNumber: 1, geometry: object.line.geometry }], { sourcePageCount: pageCount });
    const raw = spans(await pageContent(removal.bytes));
    expect(raw.length).toBeGreaterThan(0);
    expect(misplaced(raw)).toBeGreaterThan(0);

    const { bytes } = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS);
    const kept = spans(await pageContent(bytes));
    expect(kept.length).toBe(raw.length);
    expect(misplaced(kept)).toBe(0);

    // Only the matrices changed: the page draws exactly as PDFium wrote it.
    const doc = await PDFDocument.load(removal.bytes);
    expect(fixActualText(doc.getPages()[0])).toBeGreaterThan(0);
    const fixed = await doc.save();
    expect(changedPixels(await renderWithPdfium(removal.bytes, 0), await renderWithPdfium(fixed, 0))).toBe(0);
  }

  it.each(TASKS)('test set task %s', async (id) => {
    const { source, pageCount, object } = await taskEdit(id);
    await expectSpansKept(source, pageCount, object);
  });

  it.each([
    ['b-arabic-chrome.pdf', 'المبلغ الإجمالي'],
    ['k3-chrome-arial-times.pdf', 0],
  ])('%s: its first word changed', async (name, selector) => {
    const source = anyFixture(name);
    const { lines, pageCount } = await detectPage(source);
    const line = findLine(lines, selector);
    await expectSpansKept(source, pageCount, replaceWithFont(line, null, line.text.replace(/\S+/u, 'يوسف')));
  });
});

const installed = (command: string) => {
  try {
    execFileSync(command, ['-v'], { stdio: 'ignore' });
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ENOENT';
  }
};

describe.skipIf(!installed('pdftotext') || !installed('qpdf'))('pdftotext reads the untouched lines as before (needs pdftotext and qpdf)', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'actualtext-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it.each(TASKS)('test set task %s', async (id) => {
    const { task, source, pageCount, object } = await taskEdit(id);
    const { bytes } = await exportEditedPdf(source, request(pageCount, [object]), OPTIONS);
    const saved = join(dir, `${id}.pdf`);
    writeFileSync(saved, bytes);
    const status = Object.fromEntries(checker.checkTask(cases, task, saved).checks.map((c: { id: string; status: string }) => [c.id, c.status]));
    expect(status).toMatchObject({ removed: 'pass', kept: 'pass' });
  }, 30000);
});
