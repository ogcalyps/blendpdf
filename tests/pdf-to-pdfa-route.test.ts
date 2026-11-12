/**
 * /api/pdf-to-pdfa with stand-ins for ocrmypdf and veraPDF: the file comes
 * back with veraPDF's verdict in X-PdfA-* headers, a missing or broken
 * veraPDF costs only the check (never the file), and a signed PDF, a level
 * that isn't one, and an encrypted file are refused with their own codes.
 * At PDF/A-1b the unused see-through resources are dropped first and the
 * pages that came back as pictures are reported (lib/pdfa-pages.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { PDFDict, PDFDocument, PDFName, StandardFonts, drawObject, setGraphicsState } from 'pdf-lib';
import pass from './fixtures/verapdf/pass-2b.json';
import fail from './fixtures/verapdf/fail-2b.json';

const engines = vi.hoisted(() => ({
  verapdfInstalled: true,
  ocrmypdf: { exitCode: 0 as number | null, stderr: '' } as { exitCode: number | null; stderr: string; output?: Uint8Array; input?: Buffer },
  verapdf: { stdout: '', exitCode: 0 as number | null, timedOut: false } as { stdout: string; exitCode: number | null; timedOut: boolean; spawnError?: Error },
  calls: [] as { command: string; args: string[]; env?: NodeJS.ProcessEnv }[],
}));

vi.mock('fs/promises', async (original) => {
  const actual = await original<typeof import('fs/promises')>();
  return {
    ...actual,
    access: async (path: string) => {
      if (path.endsWith('/ocrmypdf') && path.startsWith('/usr/bin')) return;
      if (path.endsWith('/verapdf') && path.startsWith('/opt/verapdf') && engines.verapdfInstalled) return;
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    },
  };
});

vi.mock('@/lib/run-process', () => ({
  withScratchDir: async (prefix: string, run: (dir: string) => Promise<unknown>) => {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    try {
      return await run(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  runProcess: async (command: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
    engines.calls.push({ command, args, env: options.env });
    if (command.endsWith('/ocrmypdf')) {
      engines.ocrmypdf.input = readFileSync(args[args.length - 2]);
      if (engines.ocrmypdf.exitCode === 0) writeFileSync(args[args.length - 1], engines.ocrmypdf.output ?? '%PDF-1.7 converted');
      return { stdout: '', stderr: engines.ocrmypdf.stderr, exitCode: engines.ocrmypdf.exitCode, signal: null, timedOut: false };
    }
    // runProcess rejects only when the program can't start (lib/run-process.ts).
    if (engines.verapdf.spawnError) throw engines.verapdf.spawnError;
    return { stdout: engines.verapdf.stdout, stderr: '', exitCode: engines.verapdf.exitCode, signal: null, timedOut: engines.verapdf.timedOut };
  },
}));

let ip = 0;

async function post(fields: Record<string, string> = {}, pdf?: Uint8Array) {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const form = new FormData();
  form.append('file', new File([(pdf ?? (await doc.save())) as BlobPart], 'Thèse finale.pdf', { type: 'application/pdf' }));
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  const { POST } = await import('../app/api/pdf-to-pdfa/route');
  return POST(new NextRequest('http://localhost/api/pdf-to-pdfa', { method: 'POST', body: form, headers: { 'x-real-ip': `10.0.9.${++ip}` } }));
}

describe('/api/pdf-to-pdfa', () => {
  beforeEach(() => {
    vi.resetModules();
    engines.verapdfInstalled = true;
    engines.ocrmypdf = { exitCode: 0, stderr: '' };
    engines.verapdf = { stdout: JSON.stringify(pass), exitCode: 0, timedOut: false };
    engines.calls = [];
  });
  afterEach(() => vi.restoreAllMocks());

  it('converts with the level asked for and sends the veraPDF pass along', async () => {
    const response = await post({ level: '1b' });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('%PDF-1.7 converted');
    expect(response.headers.get('X-PdfA-Check')).toBe('pass');
    expect(response.headers.get('X-PdfA-Level')).toBe('1b');
    expect(response.headers.get('X-PdfA-Validator')).toBe('veraPDF 1.30.4');
    // The Arabic-safe, accented name survives (RFC 5987).
    expect(response.headers.get('Content-Disposition')).toContain(`filename*=UTF-8''${encodeURIComponent('Thèse finale_pdfa.pdf')}`);

    const [convert, check] = engines.calls;
    expect(convert.args).toEqual(expect.arrayContaining(['--output-type', 'pdfa-1', '--color-conversion-strategy', 'RGB', '--skip-text']));
    expect(convert.args.slice(convert.args.indexOf('--tesseract-timeout'), convert.args.indexOf('--tesseract-timeout') + 2)).toEqual(['--tesseract-timeout', '0']);
    expect(check.command).toBe('/opt/verapdf/verapdf');
    expect(check.args).toEqual(expect.arrayContaining(['--format', 'json', '--flavour', '1b']));
    expect(check.args[check.args.length - 1]).toBe(convert.args[convert.args.length - 1]);
    expect(check.env?.JAVA_OPTS).toMatch(/-Xmx\d+m/);
  });

  it('defaults to PDF/A-2b', async () => {
    const response = await post();
    expect(response.headers.get('X-PdfA-Level')).toBe('2b');
    expect(engines.calls[0].args).toEqual(expect.arrayContaining(['--output-type', 'pdfa-2']));
  });

  it('names the failed rules instead of passing a file veraPDF rejects', async () => {
    engines.verapdf = { stdout: JSON.stringify(fail), exitCode: 1, timedOut: false };
    const response = await post({ level: '2b' });
    expect(response.status).toBe(200);
    expect(response.headers.get('X-PdfA-Check')).toBe('fail');
    expect(response.headers.get('X-PdfA-Failed')).toBe('6.2.4.2-1');
  });

  it('still sends the file, unchecked, when veraPDF is missing, crashes or runs out of time', async () => {
    engines.verapdfInstalled = false;
    let response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('X-PdfA-Check')).toBe('unchecked');
    expect(engines.calls).toHaveLength(1);

    vi.resetModules();
    engines.verapdfInstalled = true;
    engines.verapdf = { stdout: 'Exception in thread "main" java.lang.OutOfMemoryError', exitCode: 7, timedOut: false };
    response = await post();
    expect(response.headers.get('X-PdfA-Check')).toBe('unchecked');

    vi.resetModules();
    engines.verapdf = { stdout: JSON.stringify(pass).slice(0, 200), exitCode: null, timedOut: true };
    response = await post();
    expect(response.headers.get('X-PdfA-Check')).toBe('unchecked');
  });

  it('still sends the file when a veraPDF found earlier can no longer start', async () => {
    // Found on the first run, then made non-executable (a real walk hit this as a 500).
    expect((await post()).headers.get('X-PdfA-Check')).toBe('pass');
    engines.verapdf = { ...engines.verapdf, spawnError: Object.assign(new Error('spawn /opt/verapdf/verapdf EACCES'), { code: 'EACCES' }) };
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('%PDF-1.7 converted');
    expect(response.headers.get('X-PdfA-Check')).toBe('unchecked');
  });

  describe('PDF/A-1b and transparency', () => {
    /** Two pages of text sharing one see-through ExtGState that only page 2 draws with (what pgf writes). */
    async function latexLike(): Promise<Uint8Array> {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const shared = doc.context.register(doc.context.obj({ GSa: doc.context.register(doc.context.obj({ Type: 'ExtGState', ca: 0.5 })) }));
      for (const n of [1, 2]) {
        const page = doc.addPage([200, 200]);
        page.drawText(`Page ${n}`, { x: 20, y: 100, size: 12, font });
        page.node.Resources()!.set(PDFName.of('ExtGState'), shared);
        if (n === 2) page.pushOperators(setGraphicsState('GSa'));
      }
      return doc.save();
    }

    /** What Ghostscript sends back: page 1 still text, page 2 one picture. */
    async function page2AsPicture(): Promise<Uint8Array> {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      doc.addPage([200, 200]).drawText('Page 1', { x: 20, y: 100, size: 12, font });
      const page = doc.addPage([200, 200]);
      const picture = doc.context.register(
        doc.context.stream(new Uint8Array([0]), { Type: 'XObject', Subtype: 'Image', Width: 1, Height: 1, ColorSpace: 'DeviceGray', BitsPerComponent: 8 }),
      );
      page.node.Resources()!.set(PDFName.of('XObject'), doc.context.obj({ Im0: picture }));
      page.pushOperators(drawObject('Im0'));
      return doc.save();
    }

    const states = async (pdf: Buffer, index: number) =>
      ((await PDFDocument.load(pdf)).getPage(index).node.Resources()?.lookupMaybe(PDFName.of('ExtGState'), PDFDict)?.keys() ?? []).map((n) => n.decodeText());

    it('converts without the see-through state page 1 never uses, and names the page that became a picture', async () => {
      engines.ocrmypdf.output = await page2AsPicture();
      const response = await post({ level: '1b' }, await latexLike());
      expect(response.status).toBe(200);
      expect(response.headers.get('X-PdfA-Check')).toBe('pass');
      expect(response.headers.get('X-PdfA-Flattened')).toBe('1');
      expect(response.headers.get('X-PdfA-Flattened-Pages')).toBe('2');

      const converted = engines.ocrmypdf.input!;
      expect(await states(converted, 0)).toEqual([]);
      expect(await states(converted, 1)).toEqual(['GSa']);
    });

    it('leaves PDF/A-2b alone: transparency is allowed there, so nothing is dropped or counted', async () => {
      const input = await latexLike();
      engines.ocrmypdf.output = await page2AsPicture();
      const response = await post({ level: '2b' }, input);
      expect(response.headers.get('X-PdfA-Flattened')).toBeNull();
      expect(engines.ocrmypdf.input!.equals(Buffer.from(input))).toBe(true);
    });

    it('sends the file without a count when the result cannot be read', async () => {
      const response = await post({ level: '1b' }, await latexLike());
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('%PDF-1.7 converted');
      expect(response.headers.get('X-PdfA-Flattened')).toBeNull();
    });
  });

  it('refuses a signed PDF with its own message', async () => {
    engines.ocrmypdf = { exitCode: 2, stderr: 'DigitalSignatureError: Input PDF has a digital signature. OCR would alter the document, invalidating the signature.' };
    const response = await post();
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errorCode).toBe('SIGNED_PDF');
    expect(body.error).toMatch(/sign/i);
  });

  it('never repeats the engine output when the conversion fails', async () => {
    engines.ocrmypdf = { exitCode: 15, stderr: 'GhostscriptFollowsError at /tmp/pdfa-abc/input.pdf' };
    const response = await post();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.errorCode).toBe('CONVERSION_FAILED');
    expect(JSON.stringify(body)).not.toMatch(/tmp|Ghostscript/);
  });

  it('refuses a level that is not one', async () => {
    const response = await post({ level: '2a' });
    expect(response.status).toBe(400);
    expect((await response.json()).errorCode).toBe('INVALID_LEVEL');
    expect(engines.calls).toHaveLength(0);
  });

  it('refuses a file that is not a PDF before running anything', async () => {
    const response = await post({}, new TextEncoder().encode('not a pdf at all'));
    expect(response.status).toBe(400);
    expect(engines.calls).toHaveLength(0);
  });
});
