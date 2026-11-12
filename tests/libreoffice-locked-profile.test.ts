/**
 * Every LibreOffice conversion starts from a profile that blocks loading by
 * link. Without it an uploaded document with a linked image made the server
 * fetch any http:// URL (blind SSRF, the EC2 metadata service included) or
 * embed an image from its own disk (security review, 2026-11-12).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const seen: string[] = [];
vi.mock('../lib/run-process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/run-process')>();
  return {
    ...actual,
    runProcess: vi.fn(async (command: string, argv: string[], options: { cwd: string }) => {
      if (process.env.LO_REAL === '1') return actual.runProcess(command, argv, options as never);
      seen.push(readFileSync(join(options.cwd, 'profile', 'user', 'registrymodifications.xcu'), 'utf8'));
      return { exitCode: 0, signal: null, stdout: '', stderr: '', timedOut: false };
    }),
  };
});

import { convertWithLibreOffice } from '../lib/libreoffice';

const hasSoffice = (() => {
  try {
    execFileSync('soffice', ['--version'], { stdio: 'ignore', timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
})();

describe('LibreOffice profile', () => {
  it('starts every conversion with links blocked', async () => {
    seen.length = 0;
    await convertWithLibreOffice('soffice', '/nonexistent/input.docx', 'pdf', { flags: ['--headless'], timeoutMs: 1000, env: process.env });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/<prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true<\/value><\/prop>/);
  });

  // Needs soffice on the machine (CI doesn't have it; the Mac and the server do)
  it.skipIf(!hasSoffice)('makes no request for a linked image in an uploaded document', async () => {
    const hits: string[] = [];
    const server = createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;
    const dir = mkdtempSync(join(tmpdir(), 'lo-ssrf-'));
    const input = join(dir, 'linked');
    writeFileSync(
      input,
      `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" office:version="1.2" office:mimetype="application/vnd.oasis.opendocument.text">
<office:body><office:text><text:p>x<draw:frame draw:name="i" svg:width="1cm" svg:height="1cm" text:anchor-type="as-char"><draw:image xlink:href="http://127.0.0.1:${port}/probe.png" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame></text:p></office:text></office:body>
</office:document>`
    );
    process.env.LO_REAL = '1';
    try {
      const result = await convertWithLibreOffice('soffice', input, 'pdf', { flags: ['--headless', '--norestore'], timeoutMs: 90_000, env: process.env });
      expect(result.output).not.toBeNull();
      expect(hits).toEqual([]);
    } finally {
      delete process.env.LO_REAL;
      server.close();
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
