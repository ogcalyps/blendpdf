/**
 * Compress to a size limit: the route's step search (lib/compress-fit.ts)
 * with a fake Ghostscript, the field's number parsing, and the plan check.
 */
import { describe, expect, it } from 'vitest';
import { FIT_STEPS, compressToFit } from '../lib/compress-fit';
import { parseLimitMb } from '../components/edit-pdf/SizeLimitField';
import { formatLimitMb } from '../lib/utils';
import { planProblems } from '../lib/workspace/summary';
import { DEFAULT_SAVE_PLAN } from '../lib/workspace/types';

/** A fake Ghostscript: each step's output is this many bytes. */
function fakeGs(sizes: Record<string, number>) {
  const ran: string[] = [];
  const run = async (settings: string[]) => {
    const step = FIT_STEPS.find((s) => s.args.join() === settings.join())!.name;
    ran.push(step);
    return Buffer.alloc(sizes[step]);
  };
  return { run, ran };
}

describe('compressToFit', () => {
  // prepress, 150dpi, 100dpi, 72dpi, 50dpi, 36dpi
  const sizes = (list: number[]) => Object.fromEntries(FIT_STEPS.map((step, i) => [step.name, list[i]]));

  it('halves the range: the best looking step that fits, in about 3 runs', async () => {
    const gs = fakeGs(sizes([9000, 5000, 3000, 900, 600, 400]));
    const fit = await compressToFit(1000, gs.run, 50000);
    expect(gs.ran).toEqual(['100dpi', '50dpi', '72dpi']);
    expect(fit).toMatchObject({ step: '72dpi', met: true });
  });

  it('a file that fits untouched keeps the best quality', async () => {
    const gs = fakeGs(sizes([900, 800, 700, 600, 500, 400]));
    const fit = await compressToFit(1000, gs.run, 50000);
    expect(gs.ran).toEqual(['100dpi', 'prepress']);
    expect(fit).toMatchObject({ step: 'prepress', met: true });
  });

  it('returns the smallest it made when nothing fits, having tried the strongest step', async () => {
    const gs = fakeGs(sizes([9000, 8000, 7000, 6000, 5000, 4000]));
    const fit = await compressToFit(1000, gs.run, 50000);
    expect(gs.ran).toContain('36dpi');
    expect(fit).toMatchObject({ step: '36dpi', met: false });
    expect(fit.output.length).toBe(4000);
  });

  it('a later run that fails ends the search with the best so far', async () => {
    const gs = fakeGs(sizes([9000, 8000, 7000, 6000, 5000, 4000]));
    let calls = 0;
    const fit = await compressToFit(1000, async (settings) => {
      if (++calls > 1) throw new Error('gs crashed');
      return gs.run(settings);
    }, 50000);
    expect(fit).toMatchObject({ step: '100dpi', met: false });
  });

  it('the first run failing is an error (the route falls back to pdf-lib)', async () => {
    await expect(compressToFit(1000, async () => { throw new Error('no gs'); }, 50000)).rejects.toThrow('no gs');
  });
});

describe('size limit field', () => {
  it('reads dots, commas and Arabic digits', () => {
    expect(parseLimitMb('2')).toBe(2);
    expect(parseLimitMb('1.5')).toBe(1.5);
    expect(parseLimitMb('1,5')).toBe(1.5);
    expect(parseLimitMb('٢٫٥')).toBe(2.5);
    expect(parseLimitMb('')).toBeNaN();
    expect(parseLimitMb('2MB')).toBeNaN();
  });

  it('writes French and Spanish with a comma', () => {
    expect(formatLimitMb(1.5, 'fr')).toBe('1,5');
    expect(formatLimitMb(1.5, 'es')).toBe('1,5');
    expect(formatLimitMb(2, 'en')).toBe('2');
  });

  it('a limit outside 0.1 to 50 MB, or not a number, blocks the save', () => {
    const problems = (mb: number) =>
      planProblems({ ...DEFAULT_SAVE_PLAN, compress: 'medium', compressLimitMb: mb }, { selected: 0, pages: 3, changed: false });
    expect(problems(2)).not.toContain('sizeLimit');
    expect(problems(0.05)).toContain('sizeLimit');
    expect(problems(51)).toContain('sizeLimit');
    expect(problems(Number.NaN)).toContain('sizeLimit');
  });
});
