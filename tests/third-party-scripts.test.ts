import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Third-party scripts must not compete with a page's first paint. On the live
 * /pdf-to-word, Lighthouse mobile put LCP at 7.0 s with Google's scripts and
 * 2.0 s with them blocked: the Drive picker loaded Google's sign-in and picker
 * libraries on every tool page although Drive is off in production, and
 * gtag.js loaded right after hydration.
 */
const ROOT = join(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');

describe('third-party scripts wait for the page', () => {
  it('the Drive picker loads nothing while Drive is off', () => {
    const source = read('components/GoogleDrivePicker.tsx');
    const effect = source.indexOf('useEffect(() => {');
    const bail = source.indexOf('if (!isGoogleDriveEnabled) return;', effect);
    const firstScript = source.indexOf("createElement('script')", effect);
    expect(effect).toBeGreaterThan(-1);
    expect(firstScript, 'the picker still loads its scripts somewhere').toBeGreaterThan(-1);
    expect(bail, 'the loading effect must return before it adds any script when Drive is off').toBeGreaterThan(effect);
    expect(bail).toBeLessThan(firstScript);
  });

  it('gtag.js loads after the page, not after hydration', () => {
    const source = read('components/GoogleAnalytics.tsx');
    const tag = source.match(/<Script\s+src=\{`https:\/\/www\.googletagmanager\.com\/gtag\/js[^`]*`\}\s+strategy="(\w+)"/);
    expect(tag, 'the gtag.js <Script> tag').not.toBeNull();
    expect(tag![1]).toBe('lazyOnload');
  });
});
