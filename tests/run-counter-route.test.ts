import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import * as route from '../app/api/run/[tool]/[outcome]/route';
import { RUN_OUTCOMES, RUN_TOOLS } from '../lib/run-tools';

/**
 * POST /api/run/<tool>/<outcome>: the anonymous run counter's endpoint. Its
 * answer is the whole feature (nginx logs the line, the back office counts
 * it), so it must say 204 only for an allowlisted tool and outcome, 404 for
 * anything else, and never read the body, set a cookie or store anything.
 */

const ROUTE_FILE = join(__dirname, '..', 'app/api/run/[tool]/[outcome]/route.ts');

/** A request whose body is a sentinel: reading it would flip bodyUsed. */
function post(tool: string, outcome: string): Request {
  return new Request(`https://blendpdf.com/api/run/${tool}/${outcome}`, {
    method: 'POST',
    body: '{"file":"secret.pdf"}',
    headers: { 'content-type': 'application/json', cookie: 'a=b' },
  });
}

async function call(tool: string, outcome: string) {
  const request = post(tool, outcome);
  const response = await route.POST(request, { params: Promise.resolve({ tool, outcome }) });
  return { request, response };
}

describe('POST /api/run/[tool]/[outcome]', () => {
  it('answers 204 with no body for every allowlisted tool and outcome', async () => {
    expect(RUN_TOOLS.length).toBe(16);
    for (const t of RUN_TOOLS) {
      for (const outcome of RUN_OUTCOMES) {
        const { response } = await call(t.run, outcome);
        expect(response.status, `${t.run}/${outcome}`).toBe(204);
        expect(await response.text()).toBe('');
      }
    }
  });

  it('answers 404 for anything else', async () => {
    for (const [tool, outcome] of [
      ['compress', 'ok'], // a server tool: its own route logs the run
      ['merge-pdf', 'ok'], // the page slug, not the run name
      ['sign_pdf', 'ok'], // the GA name
      ['sign-pdf', 'rejected'],
      ['sign-pdf', 'OK'],
      ['sign-pdf', ''],
      ['', 'ok'],
      ['../admin', 'ok'],
      ['constructor', 'ok'],
      ['__proto__', 'error'],
    ]) {
      const { response } = await call(tool, outcome);
      expect(response.status, `${tool}/${outcome}`).toBe(404);
      expect(await response.text()).toBe('');
    }
  });

  it('never reads the body, never sets a cookie and is never cached', async () => {
    for (const [tool, outcome] of [
      ['sign-pdf', 'ok'],
      ['nope', 'ok'],
    ]) {
      const { request, response } = await call(tool, outcome);
      expect(request.bodyUsed, `${tool}/${outcome}`).toBe(false);
      expect(response.headers.get('set-cookie')).toBeNull();
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('handles POST only, and imports nothing that could store or log', () => {
    const exported = Object.keys(route).filter((k) => /^[A-Z]+$/.test(k));
    expect(exported).toEqual(['POST']);
    const src = readFileSync(ROUTE_FILE, 'utf8');
    const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(imports).toEqual(['@/lib/run-tools']);
    expect(src).not.toMatch(/console\.|logger|cookies\(|\.json\(\)|\.text\(\)|\.formData\(\)|\.arrayBuffer\(\)|\.body\b/);
  });
});
