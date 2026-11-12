/**
 * The workspace save pipeline (lib/workspace/save.ts, workspace-spec.md 5.2)
 * with fetch mocked and real pdf-lib: step order, pass-through bytes, the
 * files a save delivers and their names, route fields, error mapping, client
 * caps, the analytics runs (8.2), plus the pure helpers it rests on
 * (summary.ts, names.ts, cut.ts) and the source fixes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { createCanvas, ImageData as NodeImageData } from 'canvas';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import type { DocStamps, EditorDoc, EditorPage, ExportRequest } from '../lib/edit-pdf/types';
import { extractText } from '../lib/extract-text';
import { runSave } from '../lib/workspace/save';
import { createSourceFixes } from '../lib/workspace/fixes';
import { everyGroups, runGroups } from '../lib/workspace/cut';
import { baseName, outputName } from '../lib/workspace/names';
import { SaveError, describeSave, effectivePlan, maxEveryN, opsForSave, planProblems, summarizeDoc } from '../lib/workspace/summary';
import { MODES } from '../lib/workspace/modes';
import { DEFAULT_SAVE_PLAN } from '../lib/workspace/types';
import type { DocSummary, SaveInput, SavePlan, SaveStep, WorkspaceMode } from '../lib/workspace/types';
import { createZipBlob } from '../lib/zip-generation';
import { runToolForGa } from '../lib/run-tools';

// extract-text runs through the pipeline for format 'text': pdf.js 3.11 in Node.
vi.mock('@/lib/pdfjs-init', async () => {
  const { createRequire } = await import('node:module');
  const pdfjs = createRequire(import.meta.url)('pdfjs-dist/legacy/build/pdf.js');
  return { getPdfJs: async () => pdfjs, initializePdfJsWorker: async () => pdfjs };
});

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A PDF whose page i (0-based) is 101 + i points wide, so a cut can be read back by widths. */
async function numberedPdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([101 + i, 200]);
  return doc.save();
}

async function widths(bytes: Uint8Array | ArrayBuffer): Promise<number[]> {
  const doc = await PDFDocument.load(bytes);
  return doc.getPages().map((p) => p.getWidth());
}

const pdfFile = (bytes: Uint8Array, name = 'Report.PDF') => new File([bytes as BlobPart], name, { type: 'application/pdf' });
const blobBytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

const sourcePage = (index: number, rotation: EditorPage['rotation'] = 0): EditorPage => ({
  id: `s${index}`,
  source: { kind: 'source', index },
  rotation,
});
const docOf = (pages: EditorPage[]): EditorDoc => ({ pages, objects: [] });
const requestOf = (pages: EditorPage[]): ExportRequest => ({ pages, objects: [], assets: {}, fallbackDirection: 'ltr' });
const allPages = (n: number) => Array.from({ length: n }, (_, i) => sourcePage(i));

function saveInput(source: File, pageCount: number, over: Partial<SaveInput> = {}): SaveInput {
  return {
    mode: 'edit',
    source,
    request: null,
    plan: DEFAULT_SAVE_PLAN,
    selected: [],
    pageCount,
    baseName: 'Report',
    summary: summarizeDoc(docOf(allPages(pageCount)), pageCount),
    ...over,
  };
}
const plan = (over: Partial<SavePlan>): SavePlan => ({ ...DEFAULT_SAVE_PLAN, ...over });

// ── Browser stand-ins: window (path, consent), gtag, fetch ─────────────────

interface Call {
  url: string;
  form: FormData | null;
  init?: RequestInit;
}
type Route = (form: FormData) => Response | Promise<Response>;

function install(routes: Record<string, Route> = {}, path = '/en/compress-pdf') {
  const calls: Call[] = [];
  const gtag: unknown[][] = [];
  vi.stubGlobal('window', {
    location: { pathname: path },
    localStorage: { getItem: () => null, setItem: () => undefined },
    gtag: (...args: unknown[]) => gtag.push(args),
  });
  vi.stubGlobal('navigator', { globalPrivacyControl: false });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const form = init?.body instanceof FormData ? init.body : null;
    calls.push({ url, form, init });
    // The run counter and the first-party events (lib/analytics.ts) answer 204
    if (url.startsWith('/api/run/') || url.startsWith('/api/ev?')) return new Response(null, { status: 204 });
    const route = routes[url];
    if (!route) throw new Error(`unexpected fetch ${url}`);
    return route(form as FormData);
  });
  const api = () => calls.filter((c) => !c.url.startsWith('/api/run/') && !c.url.startsWith('/api/ev?'));
  const runs = () => calls.filter((c) => c.url.startsWith('/api/run/')).map((c) => c.url);
  return { calls, api, runs, gtag };
}

const posted = async (form: FormData) => {
  const file = form.get('file') as File;
  return { file, bytes: await blobBytes(file) };
};
const pdfResponse = (bytes: Uint8Array | string, headers: Record<string, string> = {}) =>
  new Response(bytes as BodyInit, { status: 200, headers: { 'Content-Type': 'application/pdf', ...headers } });
const jsonError = (status: number, errorCode?: string) =>
  new Response(JSON.stringify({ error: 'nope', ...(errorCode ? { errorCode } : {}) }), { status });

/** What Ghostscript does to the info: a compress that stamps a Producer and dates on the file it got. */
const ghostscript: Route = async (form) => {
  const doc = await PDFDocument.load((await posted(form)).bytes, { updateMetadata: false });
  doc.setProducer('GPL Ghostscript 10.02.1');
  doc.setCreationDate(new Date('2020-01-01'));
  doc.setModificationDate(new Date('2020-01-02'));
  return pdfResponse(await doc.save());
};

async function infoOf(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  return {
    producer: doc.getProducer() || null,
    creationDate: info instanceof PDFDict ? info.has(PDFName.of('CreationDate')) : false,
    xmp: doc.catalog.has(PDFName.of('Metadata')),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── Order ───────────────────────────────────────────────────────────────────

describe('runSave order', () => {
  it('export → compress → cut → metadata → protect (each file, last) → zip', async () => {
    const env = install({
      '/api/compress': ghostscript,
      // A locked file can't be read back: the marker proves nothing touched it after.
      '/api/protect-pdf': async (form) => {
        const { file, bytes } = await posted(form);
        const { producer } = await infoOf(bytes);
        return pdfResponse(`LOCKED ${file.name} producer=${producer} pages=${(await widths(bytes)).length}`);
      },
    });
    const steps: SaveStep[] = [];
    const pages = allPages(6); // drop page 7 of 7
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(7)), 6, {
        mode: 'split',
        request: requestOf(pages),
        summary: summarizeDoc(docOf(pages), 7),
        plan: plan({ compress: 'medium', split: { kind: 'every', n: 2 }, removeMetadata: true, password: 'pw' }),
        onStep: (step) => steps.push(step),
      }),
    );

    expect(steps).toEqual(['export', 'compress', 'cut', 'metadata', 'protect', 'zip']);
    expect(env.api().map((c) => c.url)).toEqual(['/api/compress', '/api/protect-pdf', '/api/protect-pdf', '/api/protect-pdf']);
    const compressed = await posted(env.api()[0].form!);
    expect(await widths(compressed.bytes)).toEqual([101, 102, 103, 104, 105, 106]);

    expect(out.filename).toBe('Report_split.zip');
    expect(out.files).toBe(3);
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    const names = Object.keys(zip.files).sort();
    expect(names).toEqual(['Report_part-1.pdf', 'Report_part-2.pdf', 'Report_part-3.pdf']);
    for (const name of names) {
      // Metadata ran before protect (no Producer reached it), the zip only wraps what protect returned.
      expect(await zip.files[name].async('string')).toBe(`LOCKED ${name} producer=null pages=2`);
    }
  });

  it('removes metadata after compress: Ghostscript\'s Producer and dates are gone', async () => {
    install({ '/api/compress': ghostscript });
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(3)), 3, { plan: plan({ compress: 'high', removeMetadata: true }) }),
    );
    expect(out.filename).toBe('Report_edited.pdf');
    expect(await infoOf(await blobBytes(out.blob))).toEqual({ producer: null, creationDate: false, xmp: false });
  });

  it('removes metadata from each file after the cut (PDFDocument.create adds a Producer)', async () => {
    install();
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(4)), 4, { plan: plan({ split: { kind: 'every', n: 2 }, removeMetadata: true }) }),
    );
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    for (const entry of Object.values(zip.files)) {
      expect(await infoOf(await entry.async('uint8array'))).toEqual({ producer: null, creationDate: false, xmp: false });
    }
  });
});

// ── Pass-through ────────────────────────────────────────────────────────────

describe('runSave pass-through (request null)', () => {
  it('posts the visitor\'s bytes as they are and delivers the server\'s answer', async () => {
    const source = await numberedPdf(3);
    const env = install({ '/api/compress': async (form) => pdfResponse((await posted(form)).bytes, { 'X-Compression-Note': 'already-optimized' }) });
    const steps: SaveStep[] = [];
    const out = await runSave(
      saveInput(pdfFile(source), 3, { mode: 'compress', plan: plan({ compress: 'low' }), onStep: (s) => steps.push(s) }),
    );
    const sent = await posted(env.api()[0].form!);
    expect(sent.bytes).toEqual(source);
    expect(sent.file.type).toBe('application/pdf');
    expect(env.api()[0].form!.get('level')).toBe('low');
    expect(steps).toEqual(['compress']);
    expect(out).toMatchObject({ filename: 'Report_compressed.pdf', files: 1, reductionPercent: 0, warnings: [], removedLines: 0 });
    expect(await blobBytes(out.blob)).toEqual(source);
  });

  it('reports how much smaller the server made it', async () => {
    const source = await numberedPdf(3);
    install({ '/api/compress': async () => pdfResponse(source.slice(0, Math.round(source.length / 4))) });
    const out = await runSave(saveInput(pdfFile(source), 3, { plan: plan({ compress: 'medium' }) }));
    expect(out.reductionPercent).toBe(75);
  });

  it('a size limit posts targetBytes (1 MB = 1,000,000 bytes) and says whether it fits', async () => {
    const source = await numberedPdf(3);
    const env = install({ '/api/compress': async () => pdfResponse(source.slice(0, 200)) });
    const limitMb = (source.length - 100) / 1_000_000;
    const out = await runSave(saveInput(pdfFile(source), 3, { mode: 'compress', plan: plan({ compress: 'medium', compressLimitMb: limitMb }) }));
    expect(env.api()[0].form!.get('targetBytes')).toBe(String(Math.floor(limitMb * 1_000_000)));
    expect(out.sizeLimit).toEqual({ mb: limitMb, met: true, bytes: 200, untouched: false });
  });

  it('a size limit the server could not reach is reported, with the size it got to', async () => {
    const source = await numberedPdf(3);
    install({ '/api/compress': async () => pdfResponse(source.slice(0, source.length - 10)) });
    const limitMb = 100 / 1_000_000;
    const out = await runSave(saveInput(pdfFile(source), 3, { mode: 'compress', plan: plan({ compress: 'medium', compressLimitMb: limitMb }) }));
    expect(out.sizeLimit).toMatchObject({ met: false, bytes: source.length - 10 });
  });

  it('a file already under the size limit is not uploaded at all', async () => {
    const source = await numberedPdf(2);
    const env = install();
    const out = await runSave(saveInput(pdfFile(source), 2, { mode: 'compress', plan: plan({ compress: 'medium', compressLimitMb: 2 }) }));
    expect(env.api()).toEqual([]);
    expect(out.sizeLimit).toEqual({ mb: 2, met: true, bytes: source.length, untouched: true });
    expect(await blobBytes(out.blob)).toEqual(source);
  });

  it('saves the source untouched when there is nothing to do', async () => {
    const source = await numberedPdf(2);
    const env = install();
    const out = await runSave(saveInput(pdfFile(source), 2));
    expect(await blobBytes(out.blob)).toEqual(source);
    expect(out.reductionPercent).toBeUndefined();
    expect(env.calls).toEqual([]);
  });
});

// ── Files and names ─────────────────────────────────────────────────────────

describe('runSave files', () => {
  it('a PDF every N pages: parts named _part-k, zipped under the mode suffix', async () => {
    install();
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(5)), 5, { mode: 'split', plan: plan({ split: { kind: 'every', n: 2 } }) }),
    );
    expect(out).toMatchObject({ filename: 'Report_split.zip', files: 3 });
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    expect(await widths(await zip.files['Report_part-1.pdf'].async('uint8array'))).toEqual([101, 102]);
    expect(await widths(await zip.files['Report_part-2.pdf'].async('uint8array'))).toEqual([103, 104]);
    expect(await widths(await zip.files['Report_part-3.pdf'].async('uint8array'))).toEqual([105]);
  });

  it('every N that covers every page is one file, not a zip', async () => {
    install();
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(3)), 3, { mode: 'split', plan: plan({ split: { kind: 'every', n: 3 } }) }),
    );
    expect(out).toMatchObject({ filename: 'Report_split.pdf', files: 1 });
    expect(await widths(await blobBytes(out.blob))).toEqual([101, 102, 103]);
  });

  it('runs: one PDF per group of selected pages next to each other', async () => {
    install();
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(6)), 6, { mode: 'split', selected: [5, 0, 3, 1, 4], plan: plan({ split: { kind: 'runs' } }) }),
    );
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['Report_pages-1-2.pdf', 'Report_pages-4-6.pdf']);
    expect(await widths(await zip.files['Report_pages-1-2.pdf'].async('uint8array'))).toEqual([101, 102]);
    expect(await widths(await zip.files['Report_pages-4-6.pdf'].async('uint8array'))).toEqual([104, 105, 106]);
  });

  it('also selected: the whole file as saved plus the selected pages, zipped', async () => {
    const source = await numberedPdf(4);
    install();
    const out = await runSave(saveInput(pdfFile(source), 4, { selected: [2, 0], plan: plan({ alsoSelected: true }) }));
    expect(out).toMatchObject({ filename: 'Report_edited.zip', files: 2 });
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    expect(await zip.files['Report_edited.pdf'].async('uint8array')).toEqual(source);
    expect(await widths(await zip.files['Report_selected.pdf'].async('uint8array'))).toEqual([101, 103]);
  });

  it('selected pages only: the export gets the selection and the file is the mode\'s', async () => {
    install();
    const pages = [sourcePage(3), sourcePage(1)];
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(5)), 2, {
        mode: 'extract',
        selected: [0, 1],
        request: requestOf(pages),
        plan: plan({ pages: 'selected' }),
      }),
    );
    expect(out).toMatchObject({ filename: 'Report_extracted.pdf', files: 1 });
    expect(await widths(await blobBytes(out.blob))).toEqual([104, 102]);
  });
});

describe('runSave page numbers count the pages as saved', () => {
  const CAIRO = new Uint8Array(readFileSync(join(__dirname, '..', 'public', 'fonts', 'Cairo-Regular.ttf')));
  const cairo: Route = () => new Response(CAIRO as BodyInit);
  const stamps: DocStamps = {
    pageNumbers: { position: 'bottom-center', format: 'Page 1 of 10', template: 'Page {n} of {total}', startFrom: 1, size: 12 },
  };
  const numbersOn = async (bytes: Uint8Array) =>
    (await extractText(bytes, { pageSeparators: false })).split('\n\n').map((t) => t.replace(/\s/g, ''));

  it('selected pages only: numbered over the selection', async () => {
    install({ '/fonts/Cairo-Regular.ttf': cairo });
    const pages = [sourcePage(1), sourcePage(3)];
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(4)), 2, {
        selected: [0, 1],
        request: { ...requestOf(pages), stamps },
        plan: plan({ pages: 'selected' }),
      }),
    );
    expect(await numbersOn(await blobBytes(out.blob))).toEqual(['Page1of2', 'Page2of2']);
  });

  it('also selected: the selected file keeps the full file\'s numbers', async () => {
    install({ '/fonts/Cairo-Regular.ttf': cairo });
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(3)), 3, {
        selected: [2],
        request: { ...requestOf(allPages(3)), stamps },
        plan: plan({ alsoSelected: true }),
      }),
    );
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    expect(await numbersOn(await zip.files['Report_edited.pdf'].async('uint8array'))).toEqual(['Page1of3', 'Page2of3', 'Page3of3']);
    expect(await numbersOn(await zip.files['Report_selected.pdf'].async('uint8array'))).toEqual(['Page3of3']);
  });
});

// ── Routes, conversions and errors ──────────────────────────────────────────

describe('runSave routes and conversions', () => {
  it('protect sends the password with a PDF-typed file', async () => {
    const env = install({ '/api/protect-pdf': async () => pdfResponse('LOCKED') });
    const out = await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { mode: 'protect', plan: plan({ password: 's3cret' }) }));
    const form = env.api()[0].form!;
    expect(form.get('password')).toBe('s3cret');
    expect((form.get('file') as File).type).toBe('application/pdf');
    expect(out.filename).toBe('Report_protected.pdf');
  });

  it('Word: converts and stops, compatibility from X-Conversion-Method', async () => {
    const env = install({
      '/api/pdf-to-word': () => new Response('DOCX', { status: 200, headers: { 'X-Conversion-Method': 'libreoffice' } }),
    });
    const steps: SaveStep[] = [];
    // PDF-only options are ignored for another format.
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(2)), 2, {
        mode: 'word',
        plan: plan({ format: 'word', compress: 'low', password: 'x', removeMetadata: true }),
        onStep: (s) => steps.push(s),
      }),
    );
    expect(env.api().map((c) => c.url)).toEqual(['/api/pdf-to-word']);
    expect(steps).toEqual(['convert']);
    expect(out).toMatchObject({ filename: 'Report.docx', files: 1, compatibility: true });
    expect(await out.blob.text()).toBe('DOCX');
  });

  it('Word through pdf2docx has no compatibility flag', async () => {
    install({ '/api/pdf-to-word': () => new Response('DOCX', { headers: { 'X-Conversion-Method': 'pdf2docx' } }) });
    const out = await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { mode: 'word', plan: plan({ format: 'word' }) }));
    expect(out.compatibility).toBeUndefined();
  });

  it('images: format and dpi 300, the server\'s zip of one image per page', async () => {
    const env = install({ '/api/pdf-to-images': () => new Response('ZIP', { headers: { 'Content-Type': 'application/zip' } }) });
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(3)), 3, { mode: 'images', plan: plan({ format: 'images', imageType: 'png' }) }),
    );
    const form = env.api()[0].form!;
    expect([form.get('format'), form.get('dpi')]).toEqual(['png', '300']);
    expect(out).toMatchObject({ filename: 'Report_images.zip', files: 3 });
  });

  it('images of a one-page PDF: the picture itself, not a ZIP of one file', async () => {
    const { createZipBlob } = await import('@/lib/zip-generation');
    const zip = await createZipBlob([{ name: 'page-001.png', bytes: new Uint8Array([137, 80, 78, 71]) }]);
    install({ '/api/pdf-to-images': () => new Response(zip, { headers: { 'Content-Type': 'application/zip' } }) });
    const out = await runSave(
      saveInput(pdfFile(await numberedPdf(1)), 1, { mode: 'images', plan: plan({ format: 'images', imageType: 'png' }) }),
    );
    expect(out).toMatchObject({ filename: 'Report_page-1.png', files: 1 });
    expect(out.blob.type).toBe('image/png');
    expect([...new Uint8Array(await out.blob.arrayBuffer())]).toEqual([137, 80, 78, 71]);
  });

  it('images of a one-page PDF stay zipped when the ZIP is not one picture', async () => {
    const { createZipBlob } = await import('@/lib/zip-generation');
    const two = await createZipBlob([
      { name: 'page-001.jpg', bytes: new Uint8Array([1]) },
      { name: 'page-002.jpg', bytes: new Uint8Array([2]) },
    ]);
    for (const body of [two, new Blob(['not a zip'])]) {
      install({ '/api/pdf-to-images': () => new Response(body, { headers: { 'Content-Type': 'application/zip' } }) });
      const out = await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { mode: 'images', plan: plan({ format: 'images' }) }));
      expect(out).toMatchObject({ filename: 'Report_images.zip', files: 1 });
    }
  });

  it('Excel: <base>.xlsx', async () => {
    install({ '/api/pdf-to-excel': () => new Response('XLSX') });
    const out = await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { mode: 'excel', plan: plan({ format: 'excel' }) }));
    expect(out.filename).toBe('Report.xlsx');
  });

  it('text: the pages as plain text; no text is noText', async () => {
    install();
    const out = await runSave(saveInput(pdfFile(await numberedPdf(2)), 2, { mode: 'text', plan: plan({ format: 'text' }) })).catch((e) => e);
    expect(out).toBeInstanceOf(SaveError);
    expect(out).toMatchObject({ code: 'noText', step: 'convert' });
  });

  it.each([
    [422, 'TOO_MANY_PAGES', 'wordPages'],
    [429, 'RATE_LIMITED', 'busy'],
    [429, undefined, 'busy'],
    [400, 'FILE_TOO_LARGE', 'tooBig'],
    [413, undefined, 'tooBig'],
    [500, 'CONVERSION_FAILED', 'server'],
    [503, 'ENGINE_UNAVAILABLE', 'server'],
  ])('a %i %s answer is %s', async (status, errorCode, code) => {
    install({ '/api/pdf-to-word': () => jsonError(status, errorCode) });
    const error = await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { plan: plan({ format: 'word' }) })).catch((e) => e);
    expect(error).toBeInstanceOf(SaveError);
    expect(error).toMatchObject({ code, step: 'convert', status, errorCode });
  });

  it('a failed protect is a server error at the protect step', async () => {
    install({ '/api/protect-pdf': () => jsonError(500, 'PROCESSING_FAILED') });
    const error = await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { plan: plan({ password: 'pw' }) })).catch((e) => e);
    expect(error).toMatchObject({ code: 'server', step: 'protect' });
  });

  it('refuses a file over 50 MB before any upload', async () => {
    const env = install();
    const big = new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'Big.pdf', { type: 'application/pdf' });
    const error = await runSave(saveInput(big, 1, { plan: plan({ compress: 'medium' }) })).catch((e) => e);
    expect(error).toMatchObject({ code: 'tooBig', step: 'compress', status: 422 });
    expect(env.api()).toEqual([]);
  });

  it.each([
    ['word', 501, 'wordPages'],
    ['images', 101, 'imagePages'],
  ] as const)('refuses %s over its page cap before exporting or uploading', async (format, pages, code) => {
    const env = install();
    const steps: SaveStep[] = [];
    const error = await runSave(
      saveInput(pdfFile(await numberedPdf(1)), pages, { plan: plan({ format }), onStep: (s) => steps.push(s) }),
    ).catch((e) => e);
    expect(error).toMatchObject({ code });
    expect(env.api()).toEqual([]);
    expect(steps).toEqual([]);
  });
});

// ── Analytics ───────────────────────────────────────────────────────────────

describe('runSave analytics', () => {
  const moved = [sourcePage(2, 90), sourcePage(0)]; // page 2 deleted, page 3 turned and moved first

  it('one /api/run/<run>/ok per browser operation, none for server steps', async () => {
    const env = install({ '/api/compress': async (form) => pdfResponse((await posted(form)).bytes) });
    await runSave(
      saveInput(pdfFile(await numberedPdf(3)), 2, {
        request: requestOf(moved),
        summary: summarizeDoc(docOf(moved), 3),
        plan: plan({ compress: 'medium', removeMetadata: true }),
      }),
    );
    expect(env.runs().sort()).toEqual([
      '/api/run/delete-pages/ok',
      '/api/run/remove-metadata/ok',
      '/api/run/reorder-pdf/ok',
      '/api/run/rotate-pdf/ok',
    ]);
    const runInit = env.calls.find((c) => c.url.startsWith('/api/run/'))!.init;
    expect(runInit).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    // GA: named after the operation, page_slug = the page the visitor is on.
    const starts = env.gtag.filter((e) => e[1] === 'tool_process_start').map((e) => e[2] as Record<string, unknown>);
    expect(starts.find((p) => p.tool_name === 'rotate_pdf')).toMatchObject({ processing_method: 'client', page_slug: 'compress_pdf' });
    expect(starts.find((p) => p.tool_name === 'compress_pdf')).toMatchObject({ processing_method: 'server' });
  });

  it('a server step that fails sends no browser /error (its route\'s log line counts it)', async () => {
    const env = install({ '/api/compress': () => jsonError(500) });
    const error = await runSave(
      saveInput(pdfFile(await numberedPdf(3)), 2, {
        request: requestOf(moved),
        summary: summarizeDoc(docOf(moved), 3),
        plan: plan({ compress: 'medium' }),
      }),
    ).catch((e) => e);
    expect(error).toMatchObject({ code: 'server', step: 'compress' });
    expect(env.runs()).toEqual([]);
    expect(env.gtag.filter((e) => e[1] === 'tool_process_error' && (e[2] as Record<string, unknown>).processing_method === 'client')).toEqual([]);
  });

  it('a file refused before uploading sends no /error either', async () => {
    const env = install();
    const big = new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'Big.pdf', { type: 'application/pdf' });
    const error = await runSave(saveInput(big, 1, { plan: plan({ removeMetadata: true, compress: 'medium' }) })).catch((e) => e);
    expect(error).toMatchObject({ code: 'tooBig', step: 'compress' });
    expect(env.runs()).toEqual([]);
  });

  it('a browser step that fails sends /error for each browser operation, with the step', async () => {
    const env = install();
    const broken = new File([new TextEncoder().encode('not a pdf') as BlobPart], 'Report.pdf', { type: 'application/pdf' });
    const error = await runSave(
      saveInput(broken, 2, { request: requestOf(moved), summary: summarizeDoc(docOf(moved), 3) }),
    ).catch((e) => e);
    expect(error).not.toBeInstanceOf(SaveError);
    expect(env.runs().sort()).toEqual(['/api/run/delete-pages/error', '/api/run/reorder-pdf/error', '/api/run/rotate-pdf/error']);
    // An unreadable file is declined (422): tool_input_rejected, still a run that ended in error
    const errors = env.gtag.filter((e) => e[1] === 'tool_input_rejected').map((e) => e[2] as Record<string, unknown>);
    expect(errors.find((p) => p.tool_name === 'rotate_pdf')).toMatchObject({ error_code: 'export' });
  });

  it('text with none to find is a run that worked, as /pdf-to-text counted it', async () => {
    const env = install({}, '/en/pdf-to-text');
    const error = await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { mode: 'text', plan: plan({ format: 'text' }) })).catch((e) => e);
    expect(error).toMatchObject({ code: 'noText' });
    expect(env.runs()).toEqual(['/api/run/pdf-to-text/ok']);
  });

  it('split-pdf\'s save of the selected pages is a split run, not an extract', async () => {
    const env = install({}, '/en/split-pdf');
    await runSave(saveInput(pdfFile(await numberedPdf(3)), 3, { mode: 'split', plan: plan({ pages: 'selected' }), selected: [0, 2] }));
    expect(env.runs()).toEqual(['/api/run/split/ok']);
  });

  it('a pass-through conversion on /pdf-to-word is one server run and no beacon', async () => {
    const env = install({ '/api/pdf-to-word': () => new Response('DOCX') }, '/en/pdf-to-word');
    await runSave(saveInput(pdfFile(await numberedPdf(1)), 1, { mode: 'word', plan: plan({ format: 'word' }) }));
    expect(env.runs()).toEqual([]);
    expect(env.api().map((c) => c.url)).toEqual(['/api/pdf-to-word']);
  });
});

// ── describeSave agrees with runSave ────────────────────────────────────────

describe('describeSave says what runSave delivers', () => {
  const echo: Route = async (form) => pdfResponse((await posted(form)).bytes);
  /** pdf-to-images: one picture per page of the PDF it got. */
  const pictures: Route = async (form) => {
    const pages = (await widths((await posted(form)).bytes)).length;
    const files = Array.from({ length: pages }, (_, i) => ({ name: `page-00${i + 1}.jpg`, bytes: new Uint8Array([i]) }));
    return new Response(await createZipBlob(files), { headers: { 'Content-Type': 'application/zip' } });
  };
  const routes: Record<string, Route> = {
    '/api/compress': echo,
    '/api/protect-pdf': echo,
    '/api/pdf-to-word': () => new Response('DOCX'),
    '/api/pdf-to-excel': () => new Response('XLSX'),
    '/api/pdf-to-images': pictures,
  };

  async function textPdf(pages: number): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let i = 0; i < pages; i++) doc.addPage([300, 300]).drawText(`Page ${i + 1}`, { x: 20, y: 250, size: 14, font });
    return doc.save();
  }
  /** Two different pictures, one per page (extract-images needs a canvas: node-canvas with toBlob). */
  async function picturePdf(): Promise<Uint8Array> {
    vi.stubGlobal('document', {
      createElement: () => {
        const canvas = createCanvas(1, 1) as ReturnType<typeof createCanvas> & { toBlob?: unknown };
        canvas.toBlob = (done: (blob: Blob) => void, type: string) => done(new Blob([canvas.toBuffer('image/png') as BlobPart], { type }));
        return canvas;
      },
    });
    vi.stubGlobal('ImageData', NodeImageData);
    const doc = await PDFDocument.create();
    for (const [w, h] of [[40, 30], [50, 20]]) {
      const canvas = createCanvas(w, h);
      canvas.getContext('2d').fillRect(0, 0, w, h);
      doc.addPage([300, 300]).drawImage(await doc.embedPng(canvas.toBuffer('image/png')), { x: 10, y: 10, width: w, height: h });
    }
    return doc.save();
  }

  // [name, mode, pages in the doc, selected positions, plan, source (default numberedPdf)]
  it.each<[string, WorkspaceMode, number, number[], Partial<SavePlan>, ((pages: number) => Promise<Uint8Array>)?]>([
    ['one PDF', 'edit', 5, [], {}],
    ['the selected pages only', 'extract', 5, [3, 1], { pages: 'selected' }],
    ['a PDF per page', 'split', 3, [], { split: { kind: 'every', n: 1 } }],
    ['a PDF every 2 pages', 'split', 5, [], { split: { kind: 'every', n: 2 } }],
    ['every 3 of 3 pages is one file', 'split', 3, [], { split: { kind: 'every', n: 3 } }],
    ['every 2 of the selected pages', 'split', 6, [0, 2, 5], { pages: 'selected', split: { kind: 'every', n: 2 } }],
    ['a PDF per range of selected pages', 'split', 6, [5, 0, 3, 1, 4], { split: { kind: 'runs' } }],
    ['also the selected pages', 'edit', 4, [2, 0], { alsoSelected: true }],
    ['Word', 'word', 2, [], { format: 'word' }],
    ['Word from the edit page', 'edit', 2, [], { format: 'word', compress: 'low' }],
    ['Excel', 'excel', 1, [], { format: 'excel' }],
    ['images of 1 page', 'images', 1, [], { format: 'images', imageType: 'png' }],
    ['images of 3 pages', 'images', 3, [], { format: 'images' }],
    ['images of 1 selected page', 'images', 3, [1], { format: 'images', pages: 'selected' }],
    ['the pictures inside', 'imagesInside', 2, [], { format: 'imagesInside' }, picturePdf],
    ['text', 'text', 2, [], { format: 'text' }, textPdf],
    ['smaller and locked', 'protect', 3, [], { compress: 'medium', password: 'pw' }],
  ])('%s', async (_, mode, pageCount, selected, over, source = numberedPdf) => {
    install(routes);
    const p = plan(over);
    const bytes = await source(pageCount);
    // As the editor builds it: "selected pages only" exports just those pages, all selected.
    const kept = [...selected].sort((a, b) => a - b);
    const input =
      p.pages === 'selected'
        ? saveInput(pdfFile(bytes), kept.length, { mode, plan: p, request: requestOf(kept.map((i) => sourcePage(i))), selected: kept.map((_, i) => i) })
        : saveInput(pdfFile(bytes), pageCount, { mode, plan: p, selected });
    const out = await runSave(input);
    const d = describeSave(p, { pageCount, selected, baseName: 'Report', suffix: MODES[mode].suffix, changed: false });

    expect(d.filename).toBe(out.filename);
    expect(d.zipped).toBe(out.filename.endsWith('.zip'));
    // The pictures inside can't be counted before the PDF is read.
    expect(d.files).toBe(p.format === 'imagesInside' ? 0 : out.files);
    if (p.format !== 'pdf') {
      expect(d.parts).toEqual([]);
      return;
    }
    // Each file holds the pages it says: numberedPdf's page i is 101 + i wide, so width - 100 = its page in the doc.
    const inDoc = (n: number) => (p.pages === 'selected' ? kept[n - 1] + 1 : n);
    const files = out.filename.endsWith('.zip')
      ? await JSZip.loadAsync(await out.blob.arrayBuffer()).then((zip) =>
          Promise.all(Object.keys(zip.files).sort().map(async (name) => ({ name, bytes: await zip.files[name].async('uint8array') }))),
        )
      : [{ name: out.filename, bytes: await blobBytes(out.blob) }];
    expect(d.parts.map((part) => part.filename).sort()).toEqual(files.map((f) => f.name));
    for (const part of d.parts) {
      const file = files.find((f) => f.name === part.filename)!;
      expect((await widths(file.bytes)).map((w) => w - 100), part.filename).toEqual(part.pages.map(inDoc));
    }
  });
});

// ── Source fixes ────────────────────────────────────────────────────────────

describe('createSourceFixes', () => {
  const fixes = createSourceFixes();
  const echo: Route = async (form) => pdfResponse((await posted(form)).bytes);

  it('unlock: a password unlocks, null removes restrictions', async () => {
    const env = install({ '/api/unlock-pdf': echo });
    const file = pdfFile(await numberedPdf(1), 'Locked.pdf');
    const unlocked = await fixes.unlock(file, 'pw');
    await fixes.unlock(file, null);
    const [withPassword, restrictions] = env.api().map((c) => c.form!);
    expect([withPassword.get('mode'), withPassword.get('password')]).toEqual(['unlock-password', 'pw']);
    expect([restrictions.get('mode'), restrictions.get('password')]).toEqual(['remove-restrictions', null]);
    expect([unlocked.name, unlocked.type]).toEqual(['Locked.pdf', 'application/pdf']);
  });

  it('unlock: a wrong password rejects with UNLOCK_REJECTED', async () => {
    install({ '/api/unlock-pdf': () => jsonError(400, 'UNLOCK_REJECTED') });
    await expect(fixes.unlock(pdfFile(await numberedPdf(1)), 'nope')).rejects.toMatchObject({ status: 400, errorCode: 'UNLOCK_REJECTED' });
  });

  it('OCR: languages joined with +, mode redo or searchable; an untyped file goes as a PDF', async () => {
    const env = install({ '/api/ocr-pdf': echo });
    const untyped = new File([await numberedPdf(1) as BlobPart], 'scan.pdf');
    const out = await fixes.ocr(untyped, ['ara', 'eng'], true);
    await fixes.ocr(untyped, ['fra'], false);
    const [first, second] = env.api().map((c) => c.form!);
    expect([first.get('languages'), first.get('mode'), (first.get('file') as File).type]).toEqual(['ara+eng', 'redo', 'application/pdf']);
    expect([second.get('languages'), second.get('mode')]).toEqual(['fra', 'searchable']);
    expect([out.name, out.type]).toEqual(['scan.pdf', 'application/pdf']);
  });

  it.each(['unlock', 'repair', 'ocr'] as const)('%s: a file over 50 MB is refused before uploading (tooBig)', async (kind) => {
    const env = install();
    const big = new File([new Uint8Array(50 * 1024 * 1024 + 1)], 'Big.pdf', { type: 'application/pdf' });
    const run = kind === 'unlock' ? fixes.unlock(big, 'pw') : kind === 'repair' ? fixes.repair(big) : fixes.ocr(big, ['eng'], false);
    const error = await run.catch((e) => e);
    expect(error).toBeInstanceOf(SaveError);
    expect(error).toMatchObject({ code: 'tooBig', step: kind, status: 422, errorCode: 'tooBig' });
    expect(env.api()).toEqual([]);
  });

  it('repair: the repaired file under the original name', async () => {
    const env = install({ '/api/repair-pdf': echo });
    const out = await fixes.repair(pdfFile(await numberedPdf(1), 'Broken.pdf'));
    expect(env.api()[0].url).toBe('/api/repair-pdf');
    expect([out.name, out.type]).toEqual(['Broken.pdf', 'application/pdf']);
  });
});

// ── Pure helpers ────────────────────────────────────────────────────────────

const NONE: DocSummary = summarizeDoc(docOf(allPages(3)), 3);

describe('summarizeDoc', () => {
  it('counts changes against the pages the doc opened with', () => {
    const doc: EditorDoc = {
      pages: [
        { ...sourcePage(2), crop: { xPct: 0, yPct: 0, wPct: 0.5, hPct: 0.5 } },
        sourcePage(0, 90),
        { id: 'b1', source: { kind: 'blank', width: 100, height: 100 }, rotation: 0 },
        sourcePage(4),
      ],
      objects: [
        { id: 'o1', pageId: 's2', kind: 'image', assetId: 'a', box: { xPct: 0, yPct: 0, wPct: 0.1, hPct: 0.1 }, signature: true },
        { id: 'o2', pageId: 's2', kind: 'image', assetId: 'a', box: { xPct: 0, yPct: 0, wPct: 0.1, hPct: 0.1 } },
      ] as EditorDoc['objects'],
      stamps: { pageNumbers: { position: 'bottom-center', format: '1', template: '{n}', startFrom: 1, size: 12 } },
    };
    expect(summarizeDoc(doc, 4)).toEqual({
      deletedPages: 2,
      turnedPages: 1,
      moved: true,
      blankPages: 1,
      insertedPages: 1,
      croppedPages: 1,
      watermark: false,
      pageNumbers: true,
      letterhead: false,
      objects: { text: 0, image: 2, shape: 0, line: 0, ink: 0, highlight: 0, cover: 0 },
      signatures: 1,
      changedLines: 0,
    });
  });

  it('an untouched doc changes nothing', () => {
    expect(NONE).toMatchObject({ deletedPages: 0, turnedPages: 0, moved: false, blankPages: 0, insertedPages: 0 });
  });
});

describe('opsForSave', () => {
  const s = (over: Partial<DocSummary>): DocSummary => ({ ...NONE, ...over });
  it.each<[string, DocSummary, Partial<SavePlan>, string[], string[]]>([
    ['nothing', NONE, {}, [], []],
    ['a signature only', s({ objects: { ...NONE.objects, image: 1 }, signatures: 1 }), {}, ['sign_pdf'], []],
    ['a signature and a text box', s({ objects: { ...NONE.objects, image: 1, text: 1 }, signatures: 1 }), {}, ['edit_pdf', 'sign_pdf'], []],
    ['a blank page', s({ blankPages: 1 }), {}, ['edit_pdf'], []],
    ['a changed line', s({ changedLines: 1 }), {}, ['edit_pdf'], []],
    ['crop, turn, move, delete, insert', s({ croppedPages: 1, turnedPages: 2, moved: true, deletedPages: 1, insertedPages: 3 }), {},
      ['crop_pdf', 'rotate_pdf', 'reorder_pdf', 'delete_pages', 'merge_pdf'], []],
    ['stamps', s({ watermark: true, pageNumbers: true }), {}, ['watermark_pdf', 'add_page_numbers'], []],
    ['flatten, metadata, compress, password', NONE, { flatten: true, removeMetadata: true, compress: 'low', password: 'pw' },
      ['flatten_pdf', 'remove_metadata'], ['compress_pdf', 'protect_pdf']],
    ['selected pages', NONE, { pages: 'selected' }, ['extract_pages'], []],
    ['also selected', NONE, { alsoSelected: true }, ['extract_pages'], []],
    ['every N', NONE, { split: { kind: 'every', n: 2 } }, ['split_pdf'], []],
    ['runs', NONE, { split: { kind: 'runs' } }, ['split_pdf'], []],
    ['text', NONE, { format: 'text' }, ['pdf_to_text'], []],
    ['pictures inside', NONE, { format: 'imagesInside' }, ['extract_images'], []],
    ['Word ignores PDF-only options', NONE, { format: 'word', compress: 'low', removeMetadata: true, password: 'pw' }, [], ['pdf_to_word']],
    ['Excel', NONE, { format: 'excel' }, [], ['pdf_to_excel']],
    ['images, flattened', NONE, { format: 'images', flatten: true }, ['flatten_pdf'], ['pdf_to_images']],
    ['an empty password adds none', NONE, { password: '' }, [], []],
  ])('%s', (_, summary, over, client, server) => {
    expect(opsForSave(summary, plan(over))).toEqual({ client, server });
  });

  it('on split-pdf, keeping the selected pages is the split', () => {
    expect(opsForSave(NONE, plan({ pages: 'selected' }), 'split').client).toEqual(['split_pdf']);
    expect(opsForSave(NONE, plan({ alsoSelected: true }), 'split').client).toEqual(['split_pdf']);
    expect(opsForSave(NONE, plan({ pages: 'selected', split: { kind: 'every', n: 2 } }), 'split').client).toEqual(['split_pdf']);
    expect(opsForSave(NONE, plan({ pages: 'selected' }), 'extract').client).toEqual(['extract_pages']);
  });

  it('names only tools the run counter takes (a misspelt name would send nothing)', () => {
    const all = s({
      objects: { ...NONE.objects, text: 1, image: 1 },
      signatures: 1, croppedPages: 1, turnedPages: 1, moved: true, deletedPages: 1, insertedPages: 1, watermark: true, pageNumbers: true,
    });
    const client = new Set([
      ...opsForSave(all, plan({ flatten: true, removeMetadata: true, pages: 'selected', split: { kind: 'every', n: 2 } })).client,
      ...opsForSave(all, plan({ format: 'text' })).client,
      ...opsForSave(all, plan({ format: 'imagesInside' })).client,
    ]);
    expect(client.size).toBe(15);
    for (const op of client) expect(runToolForGa(op), op).not.toBeNull();
  });
});

describe('planProblems', () => {
  const ctx = { selected: 0, pages: 6, changed: true };
  it.each<[string, Partial<SavePlan>, Partial<typeof ctx>, string[]]>([
    ['a plain save of a changed doc', {}, {}, []],
    ['nothing changed, nothing asked', {}, { changed: false }, ['nothingToDo']],
    ['nothing changed but compress', { compress: 'medium' }, { changed: false }, []],
    ['nothing changed but Word', { format: 'word' }, { changed: false }, []],
    ['selected pages, none selected', { pages: 'selected' }, {}, ['needsSelection']],
    ['runs, none selected', { split: { kind: 'runs' } }, {}, ['needsSelection']],
    ['runs on selected pages', { pages: 'selected', split: { kind: 'runs' } }, { selected: 2 }, ['runsNeedAll']],
    ['a password on a split', { password: 'pw', split: { kind: 'every', n: 2 } }, {}, ['protectSplit']],
    ['a password on also-selected is fine', { password: 'pw', alsoSelected: true }, { selected: 1 }, []],
    ['an empty password', { password: '' }, {}, ['passwordEmpty']],
    ['every 0', { split: { kind: 'every', n: 0 } }, {}, ['everyN']],
    ['every 7 of 6', { split: { kind: 'every', n: 7 } }, {}, ['everyN']],
    ['every 6 of 6', { split: { kind: 'every', n: 6 } }, {}, []],
    ['every 3 of 2 selected', { pages: 'selected', split: { kind: 'every', n: 3 } }, { selected: 2 }, ['everyN']],
    ['PDF-only options with Word (a notice)', { format: 'word', compress: 'low' }, {}, ['onlyPdf']],
  ])('%s', (_, over, c, problems) => {
    expect(planProblems(plan(over), { ...ctx, ...c })).toEqual(problems);
  });

  it('maxEveryN counts the pages the save keeps', () => {
    expect(maxEveryN(plan({}), { selected: 2, pages: 6, changed: true })).toBe(6);
    expect(maxEveryN(plan({ pages: 'selected' }), { selected: 2, pages: 6, changed: true })).toBe(2);
  });

  it('effectivePlan drops what the format or page choice can\'t take', () => {
    expect(effectivePlan(plan({ format: 'text', compress: 'low', alsoSelected: true }))).toMatchObject({ compress: null, alsoSelected: false });
    expect(effectivePlan(plan({ pages: 'selected', split: { kind: 'runs' } })).split).toEqual({ kind: 'none' });
    expect(effectivePlan(plan({ alsoSelected: true, split: { kind: 'every', n: 2 } })).alsoSelected).toBe(false);
  });
});

describe('names and groups', () => {
  it('baseName strips .pdf in any case, once', () => {
    expect(baseName({ name: 'Report.PDF' })).toBe('Report');
    expect(baseName({ name: 'a.pdf.pdf' })).toBe('a.pdf');
    expect(baseName({ name: 'notes.pdfx' })).toBe('notes.pdfx');
    expect(baseName({ name: '.pdf' })).toBe('document');
  });

  it('outputName adds the suffix unless it is empty', () => {
    expect(outputName('R', 'cropped', 'pdf')).toBe('R_cropped.pdf');
    expect(outputName('R', '', 'docx')).toBe('R.docx');
  });

  it('everyGroups and runGroups', () => {
    expect(everyGroups(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
    expect(everyGroups(2, 0)).toEqual([[0, 1]]);
    expect(runGroups([4, 0, 1, 1, 6, 5])).toEqual([[0, 1], [4, 5, 6]]);
  });

  it('createZipBlob zips what it is given', async () => {
    const zip = await JSZip.loadAsync(await (await createZipBlob([{ name: 'a.txt', bytes: new TextEncoder().encode('A') }])).arrayBuffer());
    expect(await zip.files['a.txt'].async('string')).toBe('A');
  });
});
