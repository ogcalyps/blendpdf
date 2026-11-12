/**
 * Compress to a size limit ("under 2 MB" for an upload form): pick the best
 * looking Ghostscript setting whose output fits. Used by app/api/compress.
 */

/**
 * Pictures down to this many dpi, always: a threshold of 1.0 makes
 * Ghostscript downsample anything above the target. The presets alone use
 * 1.5, so a phone photo on a big page at 96 ppi came back unchanged.
 */
const downsample = (dpi: number) => [
  '-dDownsampleColorImages=true',
  '-dDownsampleGrayImages=true',
  `-dColorImageResolution=${dpi}`,
  `-dGrayImageResolution=${dpi}`,
  '-dColorImageDownsampleThreshold=1.0',
  '-dGrayImageDownsampleThreshold=1.0',
];

/**
 * "Under a size limit" picks from these, best looking first. Text stays text
 * at every step, so a file that is mostly text may never get under a small
 * limit; 36 dpi is the floor where a scanned page still reads.
 */
export const FIT_STEPS: { name: string; args: string[] }[] = [
  { name: 'prepress', args: ['-dPDFSETTINGS=/prepress'] },
  { name: '150dpi', args: ['-dPDFSETTINGS=/ebook', ...downsample(150)] },
  { name: '100dpi', args: ['-dPDFSETTINGS=/ebook', ...downsample(100)] },
  { name: '72dpi', args: ['-dPDFSETTINGS=/screen', ...downsample(72)] },
  { name: '50dpi', args: ['-dPDFSETTINGS=/screen', ...downsample(50)] },
  { name: '36dpi', args: ['-dPDFSETTINGS=/screen', ...downsample(36)] },
];

/**
 * The best looking FIT_STEPS result at or under targetBytes, or the smallest
 * one it made when none gets there (met: false). Output shrinks step by step,
 * so it halves the range each pass: about 3 Ghostscript runs out of 6 steps.
 * A pass that fails or runs out of time ends the search with the best so far;
 * only a failing first pass is an error (the route falls back to pdf-lib).
 */
export async function compressToFit(
  targetBytes: number,
  run: (settings: string[], timeoutMs: number) => Promise<Buffer>,
  budgetMs: number
): Promise<{ output: Buffer; step: string; met: boolean }> {
  const deadline = Date.now() + budgetMs;
  const tries = new Map<number, Buffer>();
  let lo = 0;
  let hi = FIT_STEPS.length - 1;
  let fits: number | null = null;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const left = deadline - Date.now();
    if (left < 1000 && tries.size > 0) break;
    let output: Buffer;
    try {
      output = await run(FIT_STEPS[mid].args, Math.max(left, 1000));
    } catch (error) {
      if (tries.size === 0) throw error;
      break;
    }
    tries.set(mid, output);
    if (output.length <= targetBytes) {
      fits = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  const pick = (index: number, met: boolean) => ({ output: tries.get(index)!, step: FIT_STEPS[index].name, met });
  if (fits !== null) return pick(fits, true);
  let smallest = -1;
  for (const [index, output] of tries) if (smallest < 0 || output.length < tries.get(smallest)!.length) smallest = index;
  return pick(smallest, false);
}
