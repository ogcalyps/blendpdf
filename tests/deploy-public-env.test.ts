/**
 * NEXT_PUBLIC_ values are inlined into the JavaScript every visitor downloads.
 * The site's old Google Drive picker (now removed) left its browser key and
 * OAuth client ID shipping for nothing (found while preparing the
 * open-source release). Keep them out of the production build and out of the
 * committed process config.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
// The public mirror (ogcalyps/blendpdf) ships neither the deploy workflow nor the process config.
const deployed = existsSync(join(ROOT, '.github/workflows/deploy.yml')) && existsSync(join(ROOT, 'ecosystem.config.js'));

describe.skipIf(!deployed)('production build env', () => {
  it('gives the build no Google API key or OAuth client ID', () => {
    expect(read('.github/workflows/deploy.yml')).not.toMatch(/NEXT_PUBLIC_GOOGLE_(API_KEY|CLIENT_ID)\s*:/);
  });

  it('commits no Google API key or OAuth client ID in the process config', () => {
    const config = read('ecosystem.config.js');
    expect(config).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(config).not.toMatch(/\.apps\.googleusercontent\.com/);
  });
});
