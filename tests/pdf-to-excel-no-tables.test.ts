/**
 * PDF to Excel on a PDF with no table (a brochure, a letter): tabula finds
 * nothing. That used to be a 500 "Please try again" and, in the workspace,
 * "That step didn't work on our server", though a retry finds no table
 * either. Now the route answers 422 NO_TABLES and the workspace says why.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import { runSave } from '../lib/workspace/save';
import { SaveError, summarizeDoc } from '../lib/workspace/summary';
import { DEFAULT_SAVE_PLAN, type SaveInput } from '../lib/workspace/types';

// tabula is "installed" and finds no table, the way the script reports it.
vi.mock('child_process', async (original) => ({
  ...(await original<typeof import('child_process')>()),
  exec: (_cmd: string, _opts: unknown, done: (error: null, out: { stdout: string; stderr: string }) => void) =>
    done(null, { stdout: 'OK\n', stderr: '' }),
}));
vi.mock('@/lib/run-process', () => ({
  runProcess: async () => ({ stdout: '', stderr: 'ERROR: No tables found in PDF\n', exitCode: 1, signal: null, timedOut: false }),
}));

const root = join(__dirname, '..');
const catalog = (locale: string) => JSON.parse(readFileSync(join(root, `messages/${locale}.json`), 'utf8'));

async function onePagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  return doc.save();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PDF to Excel without a table', () => {
  it('the route answers 422 NO_TABLES, not a 500', async () => {
    const { POST } = await import('../app/api/pdf-to-excel/route');
    const form = new FormData();
    form.append('file', new File([(await onePagePdf()) as BlobPart], 'Brochure.pdf', { type: 'application/pdf' }));
    const response = await POST(new NextRequest('http://localhost/api/pdf-to-excel', { method: 'POST', body: form }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ errorCode: 'NO_TABLES' });
  });

  it('the workspace says there is no table, in every locale', async () => {
    vi.stubGlobal('window', { location: { pathname: '/pdf-to-excel' }, localStorage: { getItem: () => null, setItem: () => undefined } });
    vi.stubGlobal('navigator', { globalPrivacyControl: false });
    vi.stubGlobal('fetch', async (url: string) =>
      url === '/api/pdf-to-excel'
        ? new Response(JSON.stringify({ error: 'x', errorCode: 'NO_TABLES' }), { status: 422 })
        : new Response(null, { status: 204 }),
    );
    const input: SaveInput = {
      mode: 'excel',
      source: new File([(await onePagePdf()) as BlobPart], 'Brochure.pdf', { type: 'application/pdf' }),
      request: null,
      plan: { ...DEFAULT_SAVE_PLAN, format: 'excel' },
      selected: [],
      pageCount: 1,
      baseName: 'Brochure',
      summary: summarizeDoc({ pages: [{ id: 's0', source: { kind: 'source', index: 0 }, rotation: 0 }], objects: [] }, 1),
    };
    const error = await runSave(input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SaveError);
    expect(error).toMatchObject({ code: 'noTables', status: 422, errorCode: 'NO_TABLES' });
    for (const locale of ['en', 'fr', 'ar']) {
      expect(typeof catalog(locale).workspace.save.errors.noTables, locale).toBe('string');
    }
  });
});
