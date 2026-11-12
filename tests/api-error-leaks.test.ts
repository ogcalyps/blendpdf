import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

/**
 * The pdf-to-word leak of 2026-08-30 was fixed route-by-route, so the guard
 * that came with it only watched that one file. On 2026-09-03 a traffic audit
 * found /api/watermark-pdf answering a 500 with the parser's own words —
 * "Failed to parse PDF document (line:0 col:54 offset=27): No PDF header
 * found" — because it had never been swept.
 *
 * This guard walks EVERY route instead, so the next route added is covered by
 * default rather than by remembering.
 */

const root = join(__dirname, '..');
const apiDir = join(root, 'app/api');

const routeFiles = readdirSync(apiDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(apiDir, entry.name, 'route.ts'))
  .filter((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  });

/** Anything that is engine output rather than copy we wrote. */
const ENGINE_OUTPUT =
  /\.\s*(message|stack)\b|\bstderr\b|\bstdout\b|String\(\s*(err|error)/i;

/**
 * A line may opt out with `// leak-guard: authored — <why>`, for the few places
 * that return a message our OWN code threw (a typed error carrying copy we
 * wrote). It must state a reason, and the count is asserted below so exemptions
 * cannot quietly accumulate.
 */
const AUTHORED = /\/\/\s*leak-guard:\s*authored\s*[—-]\s*\S/;

/** Strip comments so a line explaining the rule is not read as breaking it. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => (AUTHORED.test(line) ? '' : line.replace(/\/\/.*$/, '')))
    .join('\n');
}

/**
 * `error:` values inside a NextResponse.json(...) body — the strings a user can
 * actually receive. Paren-balanced, not line-based: a single-line
 * `NextResponse.json({...})` never reaches a lone `);`, so a line scanner stays
 * "inside" the call and starts mis-attributing later logger.error fields to it.
 */
function responseErrorBodies(src: string): string[] {
  const values: string[] = [];
  const token = 'NextResponse.json(';

  for (let start = src.indexOf(token); start !== -1; start = src.indexOf(token, start + 1)) {
    let depth = 0;
    let end = start + token.length - 1;
    for (; end < src.length; end++) {
      if (src[end] === '(') depth++;
      else if (src[end] === ')' && --depth === 0) break;
    }
    for (const line of src.slice(start, end).split('\n')) {
      if (AUTHORED.test(line)) continue;
      // `{?` matters: a single-line `NextResponse.json({ error: x, ... })` puts
      // the brace before `error:`, and anchoring on `error:` alone skipped
      // every one of them — which is how this guard passed while
      // /api/watermark-pdf was live-leaking the parser's message.
      const match = line.replace(/\/\/.*$/, '').match(/^\s*\{?\s*error:\s*(.+?)\s*$/);
      if (match) values.push(match[1].replace(/,\s*$/, ''));
    }
  }
  return values;
}

describe('no API route leaks engine output to the client', () => {
  it('found routes to check', () => {
    expect(routeFiles.length).toBeGreaterThan(15);
  });

  for (const path of routeFiles) {
    const name = path.replace(root + '/', '');
    const src = readFileSync(path, 'utf8');
    const bodies = responseErrorBodies(src);

    it(`${name} returns no raw error message`, () => {
      for (const value of bodies) {
        expect(value, `${name} puts engine output in a response body: ${value}`).not.toMatch(
          ENGINE_OUTPUT
        );
      }
    });

    it(`${name} does not route a raw message through a variable`, () => {
      // The indirect version of the same bug: `errorMessage = error.message`
      // further up, then `error: errorMessage` in the response. Only flags
      // identifiers that are actually used as a response error value.
      const code = stripComments(src);
      const returned = new Set(
        bodies
          .map((v) => v.split(',')[0].trim())
          .filter((v) => /^[A-Za-z_$][\w$]*$/.test(v))
      );
      for (const ident of returned) {
        const assignment = new RegExp(
          `\\b${ident}\\s*=\\s*[^;]*(?:${ENGINE_OUTPUT.source})`,
          'i'
        );
        expect(
          code,
          `${name} assigns engine output into \`${ident}\`, which it returns to the user`
        ).not.toMatch(assignment);
      }
    });
  }
});

describe('leak-guard exemptions stay rare', () => {
  it('only the known authored-message lines are exempt', () => {
    const exempt = routeFiles.flatMap((path) => {
      const name = path.replace(root + '/', '');
      return readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => AUTHORED.test(line))
        .map(() => name);
    });
    // Each of these returns a message THIS codebase wrote, on a typed error:
    // ocr-pdf ALREADY_HAS_TEXT, extract-pdf-fields PdfRejection,
    // send-file-email FileTooLargeForEmailError, unlock-pdf UnlockRequestError.
    // (split's parsePageRanges went with the route.) Adding a fifth should be deliberate.
    expect(exempt.sort()).toEqual([
      'app/api/extract-pdf-fields/route.ts',
      'app/api/ocr-pdf/route.ts',
      'app/api/send-file-email/route.ts',
      'app/api/unlock-pdf/route.ts',
    ]);
  });
});

describe('every route taking a PDF upload validates it at the front door', () => {
  // Routes whose input is not a user-supplied PDF, or that must accept files
  // a strict parse would reject.
  const NOT_PDF_INPUT = new Set([
    'health', 'subscribe', 'unsubscribe', 'send-file-email',
    'word-to-pdf', 'excel-to-pdf', 'powerpoint-to-pdf', 'images-to-pdf',
    'merge-s3',
    'ev', // first-party events: a query string, the body is never read
  ]);

  for (const path of routeFiles) {
    const dir = path.split('/').slice(-2)[0];
    if (NOT_PDF_INPUT.has(dir)) continue;
    const src = readFileSync(path, 'utf8');

    it(`${dir} imports a shared PDF check`, () => {
      expect(src, `${dir} accepts a PDF but hand-rolls (or skips) validation`).toMatch(
        /from '@\/lib\/pdf-validation'/
      );
    });
  }
});
