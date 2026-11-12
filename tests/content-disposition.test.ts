import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { toHeaderSafeFilename, contentDisposition } from '../lib/pdf-processor';

/**
 * An Arabic upload name used to 500 two routes. HTTP header values must be
 * ASCII, so interpolating a non-Latin filename into Content-Disposition makes
 * the Response constructor throw:
 *
 *   Cannot convert argument to a ByteString because the character at index 22
 *   has a value of 1605 which is greater than 255.
 *
 * Reproduced live on /api/protect-pdf on 2026-09-02 — ASCII name 200, Arabic
 * name 500. These guard the helper and the call sites.
 */

const ARABIC = 'مستند-عربي.pdf';

/** Everything a Response would reject. */
const isHeaderSafe = (v: string) => /^[\x20-\x7E]*$/.test(v);

describe('toHeaderSafeFilename', () => {
  it('passes an ASCII name through untouched', () => {
    expect(toHeaderSafeFilename('report_protected.pdf', 'x.pdf')).toBe('report_protected.pdf');
  });

  it('falls back rather than returning the punctuation left by stripping Arabic', () => {
    // Naive stripping leaves "-.pdf", which is header-legal but a useless
    // download name — that is the bug this branch exists for.
    expect(toHeaderSafeFilename(ARABIC, 'protected.pdf')).toBe('protected.pdf');
  });

  it('keeps a mixed name, minus the non-ASCII part and its trailing punctuation', () => {
    expect(toHeaderSafeFilename('report-مستند.pdf', 'x.pdf')).toBe('report.pdf');
  });

  it('trims the punctuation edges stripping leaves behind', () => {
    // What protect-pdf actually passes: "<arabic>_protected.pdf".
    expect(toHeaderSafeFilename('مستند-عربي_protected.pdf', 'protected.pdf')).toBe('protected.pdf');
  });

  it('falls back on an empty or dotfile name', () => {
    expect(toHeaderSafeFilename('', 'x.pdf')).toBe('x.pdf');
    expect(toHeaderSafeFilename('.pdf', 'x.pdf')).toBe('x.pdf');
  });

  it('strips quotes and backslashes that would break out of the quoted value', () => {
    const out = toHeaderSafeFilename('a"b\\c.pdf', 'x.pdf');
    expect(out).not.toMatch(/["\\]/);
  });
});

describe('contentDisposition', () => {
  it('is ASCII-safe for an Arabic name, and still carries the real name', () => {
    const value = contentDisposition(ARABIC, 'protected.pdf');
    expect(isHeaderSafe(value)).toBe(true);
    expect(value).toContain('filename="protected.pdf"');
    // RFC 5987 half — what a modern browser actually uses.
    expect(value).toContain(`filename*=UTF-8''${encodeURIComponent(ARABIC)}`);
  });

  it('survives every awkward name without emitting a non-ASCII byte', () => {
    for (const name of [ARABIC, '文件.pdf', 'файл.pdf', 'a"b.pdf', '', '.pdf', 'ünïcodé.pdf']) {
      expect(isHeaderSafe(contentDisposition(name, 'fallback.pdf')), name).toBe(true);
    }
  });
});

describe('no route interpolates a raw filename into Content-Disposition', () => {
  const apiDir = join(__dirname, '..', 'app', 'api');

  function routeFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? routeFiles(join(dir, e.name)) : e.name === 'route.ts' ? [join(dir, e.name)] : []
    );
  }

  it('every Content-Disposition filename is a literal, a sanitizer, or an encoded value', () => {
    const offenders: string[] = [];

    for (const file of routeFiles(apiDir)) {
      const src = readFileSync(file, 'utf8');
      for (const line of src.split('\n')) {
        if (!line.includes('Content-Disposition')) continue;
        // Pull each ${...} inside the quoted filename= portion.
        const quoted = line.match(/filename="([^"]*)"/);
        if (!quoted) continue;
        for (const [, expr] of quoted[1].matchAll(/\$\{([^}]*)\}/g)) {
          const safe =
            /toHeaderSafeFilename|contentDisposition|sanitiz|encodeURIComponent/i.test(expr) ||
            // a variable that was sanitized earlier in the handler
            /^(asciiName|sanitizedFilename|outputFilename|zipFilename)$/.test(expr.trim());
          if (!safe) offenders.push(`${file.replace(/.*\/app\//, 'app/')}: \${${expr}}`);
        }
      }
    }

    expect(offenders, `raw filename interpolation will 500 on a non-ASCII name:\n${offenders.join('\n')}`).toEqual([]);
  });
});
