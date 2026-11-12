/**
 * "Make it searchable" on a PDF whose every page already has text: ocrmypdf
 * --skip-text skips each page and still exits 0, so the route sent the file
 * back unchanged as if it had been read, and the "already has text" message
 * (and the FAQ answer promising it) never showed. ocrmypdf is a stand-in
 * that reports pages the way 15.2 (the server) and 17.x do.
 */
import { describe, expect, it, vi } from 'vitest';
import { writeFile } from 'fs/promises';
import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';

const state = vi.hoisted(() => ({ stderr: '', calls: 0 }));

vi.mock('child_process', async (original) => ({
  ...(await original<typeof import('child_process')>()),
  exec: (_cmd: string, _opts: unknown, done: (error: null, out: { stdout: string; stderr: string }) => void) =>
    done(null, { stdout: '/usr/bin/ocrmypdf\n', stderr: '' }),
}));
vi.mock('@/lib/run-process', () => ({
  withScratchDir: async (_prefix: string, run: (dir: string) => Promise<unknown>) => run('/tmp'),
  runProcess: async (_command: string, args: string[]) => {
    state.calls++;
    // ocrmypdf writes its output to the last argument.
    await writeFile(args[args.length - 1], await (await PDFDocument.create()).save());
    return { stdout: '', stderr: state.stderr, exitCode: 0, signal: null, timedOut: false };
  },
}));

async function ocr(pages: number, mode: 'searchable' | 'redo', stderr: string) {
  state.stderr = stderr;
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([200, 200]);
  const form = new FormData();
  form.append('file', new File([(await doc.save()) as BlobPart], 'Lettre.pdf', { type: 'application/pdf' }));
  form.append('languages', 'fra');
  form.append('mode', mode);
  const { POST } = await import('../app/api/ocr-pdf/route');
  // A fresh address each call: the route allows 5 OCR runs per IP.
  const headers = { 'x-real-ip': `10.0.0.${++state.calls}` };
  return POST(new NextRequest('http://localhost/api/ocr-pdf', { method: 'POST', body: form, headers }));
}

const skipped = (...pages: number[]) =>
  ['This PDF contains structural markup (it is a Tagged PDF).', ...pages.map((p) => `    ${p} skipping all processing on this page`), 'Postprocessing...'].join('\n');

describe('OCR on a PDF that already has text', () => {
  it('every page skipped: says so (ALREADY_HAS_TEXT) instead of handing the same file back', async () => {
    const response = await ocr(2, 'searchable', skipped(1, 2));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ errorCode: 'ALREADY_HAS_TEXT' });
  });

  it('some pages skipped (a scan with a typed cover page): the scanned pages are read', async () => {
    const response = await ocr(2, 'searchable', skipped(1));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
  });

  it('re-OCR runs on pages with text, whatever ocrmypdf says', async () => {
    expect((await ocr(1, 'redo', skipped(1))).status).toBe(200);
  });
});
