import { afterEach, describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { runSave } from '../lib/workspace/save';
import { SaveError, summarizeDoc } from '../lib/workspace/summary';
import { DEFAULT_SAVE_PLAN, type SaveInput } from '../lib/workspace/types';

/**
 * On 2026-08-30 a real user was shown ~1,088 characters of engine output —
 * "Segmentation fault (core dumped)", a server /tmp path and a
 * `pip3 install pdf2docx` instruction — because the pdf-to-word route echoed
 * `error.message` into its 500 body and the page rendered it verbatim.
 * These guards keep both halves of that contract from regressing.
 */

const root = join(__dirname, '..');
const routeSrc = readFileSync(join(root, 'app/api/pdf-to-word/route.ts'), 'utf8');
const pageSrc = readFileSync(join(root, 'app/[locale]/pdf-to-word/page.tsx'), 'utf8');
const en = JSON.parse(readFileSync(join(root, 'messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'messages/ar.json'), 'utf8'));

const lookup = (messages: Record<string, any>, path: string) =>
  path.split('.').reduce<any>((node, key) => (node == null ? node : node[key]), messages);

/** `error:` values that appear inside a NextResponse.json(...) body — i.e. the
 *  ones a user can actually receive. Deliberately excludes logger calls, which
 *  SHOULD carry the raw detail.
 *
 *  Paren-balanced rather than line-based: a single-line `NextResponse.json({...})`
 *  never reaches a lone `);`, so a line-based scanner stays "inside" the call
 *  forever and starts attributing the next logger.error's `error:` field to a
 *  response body. */
function responseErrorBodies(src: string): string[] {
  const values: string[] = [];
  const token = 'NextResponse.json(';

  for (let start = src.indexOf(token); start !== -1; start = src.indexOf(token, start + 1)) {
    // Walk from the opening paren to its match, so we only read this one call.
    let depth = 0;
    let end = start + token.length - 1;
    for (; end < src.length; end++) {
      if (src[end] === '(') depth++;
      else if (src[end] === ')' && --depth === 0) break;
    }
    for (const line of src.slice(start, end).split('\n')) {
      const match = line.match(/^\s*error:\s*(.+?),?\s*$/);
      if (match) values.push(match[1].replace(/,$/, ''));
    }
  }
  return values;
}

describe('pdf-to-word route does not leak engine output', () => {
  const responseErrorValues = responseErrorBodies(routeSrc);

  it('returns at least one error body (guard is actually looking at something)', () => {
    expect(responseErrorValues.length).toBeGreaterThan(0);
  });

  it('every error body is a fixed string literal, never an interpolated message', () => {
    for (const value of responseErrorValues) {
      expect(value, `error body must be a literal, got: ${value}`).toMatch(/^(['"]).*\1$/);
      expect(value).not.toContain('${');
    }
  });

  it('never puts stderr, a stack or a message variable in a response', () => {
    for (const value of responseErrorValues) {
      expect(value).not.toMatch(/err(or)?\??\.(message|stack)|stderr|stdout/i);
    }
  });

  it('tags a native converter crash with its own errorCode', () => {
    expect(routeSrc).toContain('CONVERTER_CRASHED');
    // python runs without a shell now (lib/run-process.ts), so a segfault
    // arrives as the signal itself, not as the shell's exit code 139.
    expect(routeSrc).toMatch(/const crashed = signal !== null/);
  });

  it('runs pdf2docx through runProcess, not a shell that its timeout cannot see past', () => {
    expect(routeSrc).toMatch(/runProcess\('python3', \[pythonScriptPath\]/);
    expect(routeSrc).not.toMatch(/execAsync\(`python3/);
    expect(routeSrc).toContain("'TIMEOUT'");
  });
});

/**
 * The page converts through the workspace now (lib/workspace/save.ts): a
 * failed conversion rejects with a SaveError whose code picks the copy
 * (workspace.save.errors.<code>), never the server's own words.
 */
describe('pdf-to-word client error messages', () => {
  /** Each errorCode the route emits, with the status it sends it with. */
  const emitted = [...routeSrc.matchAll(/errorCode:\s*'([A-Z_]+)'/g)].map((m) => {
    const status = Number(/status:\s*(\d{3})/.exec(routeSrc.slice(m.index))?.[1]);
    return [m[1], status] as const;
  });
  // Sent through variables (inspectPdf, the crash ternary), so the scan above can't see them.
  const indirect = [['ENCRYPTED_PDF', 400], ['INVALID_FILE_CONTENT', 400], ['CONVERSION_FAILED', 500], ['CONVERTER_CRASHED', 500]] as const;

  async function convertFailingWith(status: number, errorCode: string): Promise<unknown> {
    vi.stubGlobal('window', { location: { pathname: '/pdf-to-word' }, localStorage: { getItem: () => null, setItem: () => undefined } });
    vi.stubGlobal('navigator', { globalPrivacyControl: false });
    vi.stubGlobal('fetch', async (url: string) => {
      if (url === '/api/pdf-to-word') {
        return new Response(JSON.stringify({ error: 'Segmentation fault (core dumped) /tmp/x', errorCode }), { status });
      }
      return new Response(null, { status: 204 });
    });
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    const source = new File([(await doc.save()) as BlobPart], 'Report.pdf', { type: 'application/pdf' });
    const input: SaveInput = {
      mode: 'word',
      source,
      request: null,
      plan: { ...DEFAULT_SAVE_PLAN, format: 'word' },
      selected: [],
      pageCount: 1,
      baseName: 'Report',
      summary: summarizeDoc({ pages: [{ id: 's0', source: { kind: 'source', index: 0 }, rotation: 0 }], objects: [] }, 1),
    };
    return runSave(input).catch((error: unknown) => error);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maps every errorCode the route can emit to a message', async () => {
    expect(emitted.length).toBeGreaterThan(0);
    for (const [code, status] of [...emitted, ...indirect]) {
      expect(status, code).toBeGreaterThanOrEqual(400);
      const error = await convertFailingWith(status, code);
      expect(error, code).toBeInstanceOf(SaveError);
      for (const messages of [en, ar]) {
        expect(typeof lookup(messages, `workspace.save.errors.${(error as SaveError).code}`), code).toBe('string');
      }
    }
  });

  it('resolves every mapped message key in BOTH locales', async () => {
    const codes = new Set<string>();
    for (const [code, status] of [...emitted, ...indirect]) codes.add(((await convertFailingWith(status, code)) as SaveError).code);
    expect(codes.size).toBeGreaterThan(1);
    for (const code of codes) {
      expect(typeof lookup(en, `workspace.save.errors.${code}`), `missing en.workspace.save.errors.${code}`).toBe('string');
      expect(typeof lookup(ar, `workspace.save.errors.${code}`), `missing ar.workspace.save.errors.${code}`).toBe('string');
    }
  });

  it('does not render the server-supplied error string', () => {
    expect(pageSrc).not.toMatch(/errorData\?\.error(?![A-Za-z])/);
    // The page hands the conversion to the workspace and renders no error of its own
    expect(pageSrc).toContain('<ToolWorkspace mode="word" />');
  });
});
