import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileExt, fileLogMeta, emailLogRef, logRef, errorLogFields } from '../lib/log-redact';

/**
 * The site promises documents are never tracked, yet on 2026-10-04 twelve
 * routes logged `fileName: file.name` and three logged visitors' email
 * addresses, into files on the box (and CloudWatch) that are kept for weeks.
 * This guard reads every server-side log call and fails on a filename, an
 * email address or an S3 key (which embeds the filename) going in raw.
 */

const root = join(__dirname, '..');

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

/** Server-side modules outside app/api that log what they are handed. */
const SERVER_LIBS = ['lib/s3-client.ts', 'lib/send-file-email-ses.ts', 'lib/unsubscribe.ts', 'lib/pdf-validation.ts'];

const files = [...routeFiles(join(root, 'app/api')), ...SERVER_LIBS.map((p) => join(root, p))];

/**
 * Code with comments removed, plain string contents blanked, and template
 * literals reduced to their ${...} expressions. Prose like "email" inside a
 * message then cannot trip the guard, while `${file.name}` still does.
 */
function codeOnly(src: string): string {
  let out = '';
  let i = 0;
  // Brace depth of each open ${ ... } so we know when to resume template text.
  const templateStack: number[] = [];
  let depth = 0;

  const readTemplateText = () => {
    // At the char after ` or after the } closing an interpolation.
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') {
        i += 2;
      } else if (c === '`') {
        i++;
        out += "''";
        return;
      } else if (c === '$' && src[i + 1] === '{') {
        i += 2;
        out += '(';
        templateStack.push(depth);
        depth++;
        return;
      } else {
        i++;
      }
    }
  };

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
    } else if (c === "'" || c === '"') {
      i++;
      while (i < src.length && src[i] !== c && src[i] !== '\n') i += src[i] === '\\' ? 2 : 1;
      i++;
      out += "''";
    } else if (c === '`') {
      i++;
      readTemplateText();
    } else if (c === '{') {
      depth++;
      out += c;
      i++;
    } else if (c === '}') {
      depth--;
      i++;
      if (templateStack.length && templateStack[templateStack.length - 1] === depth) {
        templateStack.pop();
        out += ')';
        readTemplateText();
      } else {
        out += c;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** The argument text of every logger.x(...) / console.x(...) call, paren-balanced. */
function logCalls(code: string): string[] {
  const calls: string[] = [];
  const token = /\b(?:logger|console)\.(?:log|info|warn|error|debug)\(/g;
  for (let match = token.exec(code); match; match = token.exec(code)) {
    let depth = 0;
    let end = match.index + match[0].length - 1;
    for (; end < code.length; end++) {
      if (code[end] === '(') depth++;
      else if (code[end] === ')' && --depth === 0) break;
    }
    calls.push(code.slice(match.index, end + 1));
  }
  return calls;
}

/** Calls to the redaction helpers are the sanctioned way to mention these values. */
const REDACTED = /\b(?:logRef|emailLogRef|fileLogMeta|fileExt|errorLogFields)\((?:[^()]|\([^()]*\))*\)/g;

const FORBIDDEN: Array<[string, RegExp]> = [
  ['a file name (x.name)', /\b(?!(?:error|err|e|sendErr|dynamoError|execError|libreOfficeError)\.)\w+\.name\b/],
  ['a filename variable', /\b(?:fileName|filename|originalFilename|outputFilename|sanitizedFilename)\b/],
  ['an email address', /(?<!!!)\b(?:email|normalizedEmail|to)\b(?!\s*:)/],
  ['an S3 key (embeds the filename)', /\bkey\b/],
  ['a list of uploaded file names', /\b(?:invalidFiles|notPdfContent|skippedFiles)\b(?!\.length)/],
];

function violations(src: string): string[] {
  const found: string[] = [];
  for (const call of logCalls(codeOnly(src))) {
    const scrubbed = call.replace(REDACTED, 'REDACTED');
    for (const [what, pattern] of FORBIDDEN) {
      if (pattern.test(scrubbed)) found.push(`${what}: ${call.replace(/\s+/g, ' ').slice(0, 160)}`);
    }
  }
  return found;
}

describe('server logs carry no filenames or email addresses', () => {
  it('is looking at real log calls (not vacuous)', () => {
    const total = files.reduce((n, f) => n + logCalls(codeOnly(readFileSync(f, 'utf8'))).length, 0);
    // Floors, not counts: the public mirror (ogcalyps/blendpdf) leaves out the back
    // office, so it has 27 files and 207 calls where this repo has 35 and 217.
    expect(files.length).toBeGreaterThan(20);
    expect(total).toBeGreaterThan(150);
  });

  for (const file of files) {
    it(relative(root, file), () => {
      expect(violations(readFileSync(file, 'utf8'))).toEqual([]);
    });
  }

  // The leaks this guard exists for, in the exact shapes they had.
  it.each([
    ["logger.info('Repair PDF started', { fileSize: `${fileSizeMB}MB`, fileName: file.name }, requestId);"],
    ['console.log(`[${requestId}] Uploading file ${index + 1}/${files.length} (${file.name}) to S3...`);'],
    ["logger.info('OCR PDF started', {\n  fileSize: `${fileSizeMB}MB`,\n  fileName: file.name,\n  pageCount,\n}, requestId);"],
    ["console.log('[Email Capture] Successfully stored email in DynamoDB:', normalizedEmail);"],
    ["logger.error('[Send File Email] SES send failed', { error: msg, email, filename }, requestId);"],
    ["logger.info('[Unsubscribe] Email unsubscribed', { email: normalizedEmail }, requestId);"],
    ['console.log(`[downloadFromS3] Using bucket: ${BUCKET_NAME}, key: ${key}`);'],
    ['console.warn(`[${requestId}] Validation failed: invalid files`, invalidFiles);'],
  ])('catches %s', (line) => {
    expect(violations(line)).not.toEqual([]);
  });

  it('lets the redacted forms and prose about emails through', () => {
    expect(
      violations(
        [
          "logger.info('Repair PDF started', { ...fileLogMeta(file) }, requestId);",
          "console.log('[Email Capture] Stored new email in DynamoDB:', emailLogRef(normalizedEmail));",
          "logger.warn('[Unsubscribe] Invalid or missing signature', { hasEmail: !!email, hasSig: !!sig }, requestId);",
          'console.log(`[downloadFromS3] Using bucket: ${BUCKET_NAME}, key: ${logRef(key)}`);',
          "logger.error('[Send File Email] SES send failed', { errorName: sendErr.name }, requestId);",
        ].join('\n')
      )
    ).toEqual([]);
  });
});

describe('log-redact helpers', () => {
  it('keeps only a plausible extension', () => {
    expect(fileExt('Contrat de bail - Dupont.PDF')).toBe('pdf');
    expect(fileExt('Jean.Dupont passport scan')).toBe('unknown');
    expect(fileExt('no-extension')).toBe('unknown');
  });

  it('describes a file without its name', () => {
    const meta = fileLogMeta({ name: 'Contrat de bail - Dupont.pdf', size: 2 * 1024 * 1024 });
    expect(meta).toEqual({ fileExt: 'pdf', fileSize: '2.00MB', fileRef: expect.stringMatching(/^[0-9a-f]{12}$/) });
    expect(JSON.stringify(meta)).not.toMatch(/Dupont|bail/);
  });

  it('gives equal markers for equal values, and case variants of an email match', () => {
    expect(logRef('a')).toBe(logRef('a'));
    expect(logRef('a')).not.toBe(logRef('b'));
    expect(emailLogRef(' Jane@Example.com ')).toBe(emailLogRef('jane@example.com'));
    expect(emailLogRef('jane@example.com')).not.toContain('jane');
  });

  it('drops the fields the AWS SDK copies onto errors (S3 NoSuchKey carries Key)', () => {
    const error = Object.assign(new Error('The specified key does not exist.'), {
      name: 'NoSuchKey',
      Key: 'uploads/1759-abc-Contrat_Dupont.pdf',
    });
    const fields = errorLogFields(error);
    expect(fields.name).toBe('NoSuchKey');
    expect(JSON.stringify(fields)).not.toContain('Dupont');
  });
});
