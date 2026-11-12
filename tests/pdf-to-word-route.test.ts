import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';

/**
 * On 2026-10-04 a ChatGPT-referred visitor got two 500s from /api/pdf-to-word:
 * pdf2docx ran into its 120 s timeout, the answer was the generic "layout too
 * complex" failure, and the log said nothing about the file but its size.
 * These tests call the real route handler with the converter process mocked.
 */

const state = vi.hoisted(() => ({
  runProcess: vi.fn(),
}));

// The converter itself: each test decides what python "did".
vi.mock('@/lib/run-process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/run-process')>()),
  runProcess: state.runProcess,
}));

// Engine detection shells out to `which python3` and an import probe; answer
// both as a box with pdf2docx installed would.
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('child_process')>();
  const exec = (cmd: string, _opts: unknown, cb: (err: Error | null, out: { stdout: string; stderr: string }) => void) => {
    cb(null, { stdout: cmd.startsWith('which') ? '/usr/bin/python3\n' : 'OK\n', stderr: '' });
  };
  return { ...actual, default: { ...actual, exec }, exec };
});

import { POST } from '../app/api/pdf-to-word/route';
import { logger } from '../lib/cloudwatch-logger';
import { PDF_TO_WORD_MAX_PAGES, pdf2docxProgress } from '../lib/pdf-to-word-limits';
import { runSave } from '../lib/workspace/save';
import { summarizeDoc } from '../lib/workspace/summary';
import { DEFAULT_SAVE_PLAN } from '../lib/workspace/types';

const FILE_NAME = 'Contrat de bail - Dupont.pdf';
/** Document text that pdf2docx quotes in its warnings; it must not reach the log on the timeout path. */
const DOCUMENT_TEXT = 'Loyer mensuel Dupont';

type LogCall = { level: string; message: string; data: Record<string, any> | undefined };
let logs: LogCall[] = [];
let scratch: string;
let ipCounter = 0;
// macOS sets TMPDIR for every process; put it back as it was, not unset.
const originalTmpdir = process.env.TMPDIR;

async function pdfWithPages(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  return doc.save();
}

function post(bytes: Uint8Array) {
  const form = new FormData();
  form.append('file', new File([new Uint8Array(bytes)], FILE_NAME, { type: 'application/pdf' }));
  // A fresh client address per request: the route allows 10 runs per 15 min per IP.
  return POST(
    new NextRequest('http://localhost/api/pdf-to-word', {
      method: 'POST',
      body: form,
      headers: { 'x-real-ip': `203.0.113.${++ipCounter}` },
    })
  );
}

/** What python would leave behind on success: the .docx at the path the route's script names. */
function convertsSuccessfully() {
  state.runProcess.mockImplementation(async (_cmd: string, args: string[]) => {
    const script = readFileSync(args[0], 'utf8');
    const output = /cv\.convert\("([^"]+)"/.exec(script)![1];
    writeFileSync(output, 'PK\u0003\u0004 not really a docx');
    return { stdout: 'SUCCESS\n', stderr: '[INFO] [4/4] Creating pages...\n', exitCode: 0, signal: null, timedOut: false };
  });
}

function timesOut() {
  state.runProcess.mockResolvedValue({
    stdout: '',
    stderr: [
      '[INFO] Start to convert /tmp/x.pdf',
      '[INFO] \u001b[1;36m[1/4] Opening document...\u001b[0m',
      '[INFO] \u001b[1;36m[2/4] Analyzing document...\u001b[0m',
      `[WARNING] Ignore Line "${DOCUMENT_TEXT}" due to overlap`,
      '[INFO] \u001b[1;36m[3/4] Parsing pages...\u001b[0m',
      '[INFO] (1/5) Page 1',
      '[INFO] (5/5) Page 5',
      '[INFO] \u001b[1;36m[4/4] Creating pages...\u001b[0m',
      '[INFO] (1/5) Page 1',
      '[INFO] (2/5) Page 2',
    ].join('\n'),
    exitCode: null,
    signal: 'SIGTERM',
    timedOut: true,
  });
}

const logLine = (message: string) => logs.find((l) => l.message.startsWith(message));

beforeEach(() => {
  logs = [];
  state.runProcess.mockReset();
  for (const level of ['info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(logger, level).mockImplementation(async (message: string, data?: any) => {
      logs.push({ level, message, data });
    });
  }
  // os.tmpdir() re-reads TMPDIR on every call, so the route's files land here.
  scratch = mkdtempSync(join(tmpdir(), 'p2w-route-'));
  process.env.TMPDIR = scratch;
});

afterEach(() => {
  if (originalTmpdir === undefined) delete process.env.TMPDIR;
  else process.env.TMPDIR = originalTmpdir;
  vi.restoreAllMocks();
  rmSync(scratch, { recursive: true, force: true });
});

describe('pdf-to-word page cap', () => {
  it('refuses a file over the cap with 422 TOO_MANY_PAGES, before starting the converter', async () => {
    const bytes = await pdfWithPages(PDF_TO_WORD_MAX_PAGES + 1);
    const res = await post(bytes);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.errorCode).toBe('TOO_MANY_PAGES');
    expect(state.runProcess).not.toHaveBeenCalled();

    const line = logLine('PDF rejected before conversion: too many pages');
    expect(line?.data).toMatchObject({ pages: PDF_TO_WORD_MAX_PAGES + 1, bytes: bytes.length, maxPages: PDF_TO_WORD_MAX_PAGES });
  });

  it('converts a file at the cap', async () => {
    convertsSuccessfully();
    const res = await post(await pdfWithPages(PDF_TO_WORD_MAX_PAGES));

    expect(res.status).toBe(200);
    expect(state.runProcess).toHaveBeenCalledTimes(1);
    expect(readdirSync(scratch)).toEqual([]);
  });
});

describe('pdf-to-word timeout', () => {
  it('answers 504 CONVERSION_TIMEOUT with the split message, not the generic "too complex" failure', async () => {
    timesOut();
    const res = await post(await pdfWithPages(5));
    const body = await res.json();

    expect(res.status).toBe(504);
    expect(body.errorCode).toBe('CONVERSION_TIMEOUT');
    expect(body.error).toMatch(/split/i);
    expect(body.error).not.toMatch(/complex/i);
    expect(readdirSync(scratch)).toEqual([]);
  });

  it('logs pages, bytes, elapsed time and how far pdf2docx got, without the document text', async () => {
    timesOut();
    const bytes = await pdfWithPages(5);
    await post(bytes);

    const line = logLine('[pdf2docx] Timed out');
    expect(line?.data).toMatchObject({
      pages: 5,
      bytes: bytes.length,
      timeoutMs: 120_000,
      progress: { phase: '4/4', page: 2, of: 5 },
    });
    expect(typeof line?.data?.elapsedMs).toBe('number');
    expect(JSON.stringify(logs)).not.toContain(DOCUMENT_TEXT);
  });
});

/**
 * Stands in for pdf2docx 0.5.13 the way it logs: basicConfig on import, then
 * root-logger warnings that quote each overlapping line, then the progress
 * lines. 20k warnings is about 1.2 MB, past the 1 MB of stderr runProcess keeps.
 */
const FAKE_PDF2DOCX = `import logging
logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

class Converter:
    def __init__(self, path):
        pass

    def convert(self, out, start=0, end=None):
        logging.info('[3/4] Parsing pages...')
        for i in range(20000):
            logging.warning('Ignore Line "%s" due to overlap', '${DOCUMENT_TEXT} %d' % i)
        logging.info('[4/4] Creating pages...')
        for i in range(1, 9):
            logging.info('(%d/%d) Page %d', i, 21, i)
        # Warnings the filter does not drop, and exception messages, can quote the document too.
        logging.warning('Words "%s" have no matching font', '${DOCUMENT_TEXT}')
        raise RuntimeError('stopped on page 8 near "${DOCUMENT_TEXT}"')

    def close(self):
        pass
`;

const hasPython = spawnSync('python3', ['--version']).status === 0;

describe.skipIf(!hasPython)('pdf2docx stderr, through a real python process', () => {
  let fakePythonPath: string;
  const originalPythonPath = process.env.PYTHONPATH;

  beforeAll(() => {
    fakePythonPath = mkdtempSync(join(tmpdir(), 'p2w-fake-pdf2docx-'));
    mkdirSync(join(fakePythonPath, 'pdf2docx'));
    writeFileSync(join(fakePythonPath, 'pdf2docx', '__init__.py'), FAKE_PDF2DOCX);
  });

  afterAll(() => {
    rmSync(fakePythonPath, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // The route's own python script runs for real, against the fake pdf2docx.
    process.env.PYTHONPATH = fakePythonPath;
    const actual = await vi.importActual<typeof import('@/lib/run-process')>('@/lib/run-process');
    state.runProcess.mockImplementation(actual.runProcess);
  });

  afterEach(() => {
    if (originalPythonPath === undefined) delete process.env.PYTHONPATH;
    else process.env.PYTHONPATH = originalPythonPath;
  });

  it('still reads how far pdf2docx got, and keeps the quoted text out of every log line', async () => {
    const res = await post(await pdfWithPages(21));
    expect(res.status).toBe(500);

    const line = logLine('[pdf2docx] Conversion failed');
    expect(line?.data?.progress).toEqual({ phase: '4/4', page: 8, of: 21 });
    expect(line?.data?.errorType).toBe('RuntimeError');
    expect(JSON.stringify(logs)).not.toContain(DOCUMENT_TEXT);
    expect(await res.text()).not.toContain(DOCUMENT_TEXT);
    expect(readdirSync(scratch)).toEqual([]);
  });
});

describe('pdf-to-word logs', () => {
  it('logs only the exception class when pdf2docx fails, never its stderr', async () => {
    state.runProcess.mockResolvedValue({
      stdout: '',
      stderr: [
        '[INFO] [3/4] Parsing pages...',
        `[WARNING] Words "${DOCUMENT_TEXT}" have no matching font`,
        `ERROR: could not place "${DOCUMENT_TEXT}"`,
        'ERROR_TYPE: ValueError',
      ].join('\n'),
      exitCode: 1,
      signal: null,
      timedOut: false,
    });
    const res = await post(await pdfWithPages(3));
    expect(res.status).toBe(500);

    const line = logLine('[pdf2docx] Conversion failed');
    expect(line?.data).toMatchObject({ errorType: 'ValueError', versionIssue: false, stderrLines: 4, exitCode: 1 });
    expect(line?.data?.stderr).toBeUndefined();
    expect(JSON.stringify(logs)).not.toContain(DOCUMENT_TEXT);
    expect(await res.text()).not.toContain(DOCUMENT_TEXT);
  });

  it('flags a version mismatch without logging the stderr', async () => {
    state.runProcess.mockResolvedValue({
      stdout: '',
      stderr: `[WARNING] Words "${DOCUMENT_TEXT}"\nVERSION_ERROR\nERROR_TYPE: AttributeError`,
      exitCode: 2,
      signal: null,
      timedOut: false,
    });
    await post(await pdfWithPages(2));
    const line = logLine('[pdf2docx] Version compatibility error');
    expect(line?.data).toMatchObject({ versionIssue: true, errorType: 'AttributeError' });
    expect(JSON.stringify(logs)).not.toContain(DOCUMENT_TEXT);
  });

  it('names the file by reference only, and every outcome line carries pages and bytes', async () => {
    convertsSuccessfully();
    const bytes = await pdfWithPages(3);
    const res = await post(bytes);
    expect(res.status).toBe(200);

    const all = JSON.stringify(logs);
    expect(all).not.toContain('Dupont');
    expect(all).not.toContain('Contrat');

    for (const message of ['PDF to Word conversion started', '[pdf2docx] Converted', 'PDF to Word conversion completed successfully']) {
      expect(logLine(message)?.data, message).toMatchObject({ pages: 3, bytes: bytes.length });
    }
    expect(logLine('PDF to Word conversion started')?.data?.fileRef).toMatch(/^[0-9a-f]{12}$/);
    expect(typeof logLine('[pdf2docx] Converted')?.data?.elapsedMs).toBe('number');
  });

  it('names the file by reference only on the timeout path too', async () => {
    timesOut();
    await post(await pdfWithPages(5));
    expect(logs.length).toBeGreaterThan(3);
    expect(JSON.stringify(logs)).not.toContain('Dupont');
    for (const message of ['[pdf2docx] Timed out', 'pdf2docx conversion failed', 'PDF to Word conversion failed']) {
      expect(logLine(message)?.data, message).toMatchObject({ pages: 5 });
    }
  });
});

describe('pdf2docxProgress', () => {
  it('reads the last phase and the last page started in it', () => {
    expect(pdf2docxProgress('[INFO] [3/4] Parsing pages...\n[INFO] (1/21) Page 1\n[INFO] (2/21) Page 2\n')).toEqual({
      phase: '3/4',
      page: 2,
      of: 21,
    });
  });

  it('does not credit the creating phase with the parsing phase page count', () => {
    expect(pdf2docxProgress('[3/4] Parsing pages...\n(9/9) Page 9\n[4/4] Creating pages...\n')).toEqual({
      phase: '4/4',
      page: null,
      of: null,
    });
  });

  it('reports nothing when pdf2docx printed nothing', () => {
    expect(pdf2docxProgress('')).toEqual({ phase: null, page: null, of: null });
  });
});

describe('pdf-to-word budgets line up', () => {
  const routeSrc = readFileSync(join(__dirname, '../app/api/pdf-to-word/route.ts'), 'utf8');

  it('gives the route more time than the converter, so the CONVERSION_TIMEOUT answer always gets out', () => {
    const maxDuration = Number(/export const maxDuration = (\d+)/.exec(routeSrc)?.[1]);
    const timeoutMs = Number(/const PDF2DOCX_TIMEOUT_MS = ([\d_]+)/.exec(routeSrc)?.[1].replace(/_/g, ''));
    expect(timeoutMs).toBeGreaterThan(0);
    // 2 s TERM grace in runProcess, plus upload parsing, inspection and the reply.
    expect(maxDuration * 1000).toBeGreaterThanOrEqual(timeoutMs + 15_000);
  });
});

describe('pdf-to-word page shows the way through', () => {
  // The page converts in the workspace now (lib/workspace/save.ts). A file too
  // long for one run gets workspace.save.errors.wordPages, "save fewer pages,
  // then convert" (the workspace selects pages itself), instead of the old
  // split hint and its link to /split-pdf.
  const pageSrc = readFileSync(join(__dirname, '../app/[locale]/pdf-to-word/page.tsx'), 'utf8');
  const en = JSON.parse(readFileSync(join(__dirname, '../messages/en.json'), 'utf8'));
  const ar = JSON.parse(readFileSync(join(__dirname, '../messages/ar.json'), 'utf8'));

  async function wordSaveFailing(status: number, errorCode: string): Promise<unknown> {
    vi.stubGlobal('window', { location: { pathname: '/pdf-to-word' }, localStorage: { getItem: () => null, setItem: () => undefined } });
    vi.stubGlobal('navigator', { globalPrivacyControl: false });
    vi.stubGlobal('fetch', async (url: string) =>
      url === '/api/pdf-to-word'
        ? new Response(JSON.stringify({ error: 'x', errorCode }), { status })
        : new Response(null, { status: 204 }),
    );
    try {
      const doc = await PDFDocument.create();
      doc.addPage([200, 200]);
      const source = new File([(await doc.save()) as BlobPart], 'Long.pdf', { type: 'application/pdf' });
      return await runSave({
        mode: 'word',
        source,
        request: null,
        plan: { ...DEFAULT_SAVE_PLAN, format: 'word' },
        selected: [],
        pageCount: 1,
        baseName: 'Long',
        summary: summarizeDoc({ pages: [{ id: 's0', source: { kind: 'source', index: 0 }, rotation: 0 }], objects: [] }, 1),
      }).catch((error: unknown) => error);
    } finally {
      vi.unstubAllGlobals();
    }
  }

  it('converts in the workspace', () => {
    expect(pageSrc).toContain('<ToolWorkspace mode="word" />');
  });

  it('answers both "too long" codes with the save-fewer-pages copy', async () => {
    for (const [status, code] of [[422, 'TOO_MANY_PAGES'], [504, 'CONVERSION_TIMEOUT']] as const) {
      expect(await wordSaveFailing(status, code), code).toMatchObject({ code: 'wordPages', errorCode: code });
    }
    expect(en.workspace.save.errors.wordPages).toMatch(/fewer pages/i);
    expect(ar.workspace.save.errors.wordPages).toMatch(/[؀-ۿ]{3}/);
  });

  it('offers no "try again" when the answer is fewer pages', () => {
    // On 2026-10-04 the visitor sent the same file twice; a retry pins a CPU
    // for another 120 s and fails the same way.
    expect(en.workspace.save.errors.wordPages).not.toMatch(/try again/i);
  });

  it('has the message in both locales, Arabic written in Arabic and English without em-dashes', () => {
    expect(en.pdfToWord.tooLongToConvert).toMatch(/split/i);
    expect(en.pdfToWord.tooLongToConvert).not.toContain('—');
    expect(ar.pdfToWord.tooLongToConvert).toMatch(/[؀-ۿ]{3}/);
    expect(ar.pdfToWord.tooLongToConvert).not.toBe(en.pdfToWord.tooLongToConvert);
    expect(en.pdfToWord.openSplitPdf).toMatch(/Split PDF/);
    expect(ar.pdfToWord.openSplitPdf).toMatch(/[؀-ۿ]{3}/);
  });
});

describe('pdf-to-word copy matches the page cap', () => {
  const en = JSON.parse(readFileSync(join(__dirname, '../messages/en.json'), 'utf8'));
  const ar = JSON.parse(readFileSync(join(__dirname, '../messages/ar.json'), 'utf8'));
  const faqSrc = readFileSync(join(__dirname, '../app/[locale]/pdf-to-word/faq/page.tsx'), 'utf8');
  const llms = readFileSync(join(__dirname, '../public/llms.txt'), 'utf8');
  const llmsFull = readFileSync(join(__dirname, '../public/llms-full.txt'), 'utf8');
  // AI assistants read llms-full.txt; ChatGPT is the page's best-converting referrer.
  const start = llmsFull.indexOf('## PDF to Word');
  const llmsSection = llmsFull.slice(start, llmsFull.indexOf('\n## ', start + 1));
  const NO_LIMIT = /no (fixed )?page limit|no limit on the number of pages|unlimited pages/i;
  const NO_LIMIT_AR = /لا (يوجد|توجد) حد|ولا حد لعدد الصفحات|بلا حد/;

  it('never promises "no page limit" while the route refuses long files', () => {
    expect(start).toBeGreaterThan(-1);
    expect(JSON.stringify(en.pdfToWord)).not.toMatch(NO_LIMIT);
    expect(JSON.stringify(ar.pdfToWord)).not.toMatch(NO_LIMIT_AR);
    expect(faqSrc).not.toMatch(NO_LIMIT);
    expect(llmsSection).not.toMatch(NO_LIMIT);
  });

  it('names the number of pages the route enforces', () => {
    const pages = `${PDF_TO_WORD_MAX_PAGES} pages`;
    const pagesAr = `${PDF_TO_WORD_MAX_PAGES} صفحة`;
    expect(en.pdfToWord.faq.limits.answer).toContain(pages);
    expect(en.pdfToWord.faq.blendpdfSPdf.answer).toContain(pages);
    expect(ar.pdfToWord.faq.limits.answer).toContain(pagesAr);
    expect(ar.pdfToWord.faq.blendpdfSPdf.answer).toContain(pagesAr);
    expect(faqSrc.split(`50MB and ${pages}`).length - 1).toBe(3);
    expect(llmsSection).toContain(`50MB and ${pages}`);
    expect(llms).toMatch(new RegExp(`\\[PDF to Word\\]\\([^)]*\\): [^\\n]*Up to ${pages}\\.`));
  });
});

describe('pdf-to-word conversion script', () => {
  // The script is Python inside a template literal, with the Arabic fix
  // (lib/pdf-to-word-arabic.ts) pasted in: a bad indent or escape there only
  // shows on the server, as every conversion failing.
  it.skipIf(!hasPython)('is valid Python, with the Arabic layout fix in it', async () => {
    let script = '';
    state.runProcess.mockImplementation(async (_cmd: string, args: string[]) => {
      script = readFileSync(args[0], 'utf8');
      return { stdout: '', stderr: '', exitCode: 1, signal: null, timedOut: false };
    });
    await post(await pdfWithPages(1));

    expect(script).toContain('arabic_undo = arabic_reader()');
    expect(script).toContain('if arabic_docx(');
    const parsed = spawnSync('python3', ['-c', 'import ast, sys; ast.parse(sys.stdin.read())'], { input: script, encoding: 'utf-8' });
    expect(parsed.stderr).toBe('');
    expect(parsed.status).toBe(0);
  });
});
