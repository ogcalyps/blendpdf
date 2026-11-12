import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Third-party scripts must not compete with a page's first paint. On the live
 * /pdf-to-word, Lighthouse mobile put LCP at 7.0 s with Google's scripts and
 * 2.0 s with them blocked: gtag.js loaded right after hydration, and a Google
 * Drive picker (since removed) loaded Google's sign-in libraries on every tool
 * page.
 */
const ROOT = join(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

describe('third-party scripts wait for the page', () => {
  it('gtag.js loads after the page, not after hydration', () => {
    const source = read('components/GoogleAnalytics.tsx');
    const tag = source.match(/<Script\s+src=\{`https:\/\/www\.googletagmanager\.com\/gtag\/js[^`]*`\}\s+strategy="(\w+)"/);
    expect(tag, 'the gtag.js <Script> tag').not.toBeNull();
    expect(tag![1]).toBe('lazyOnload');
  });
});
