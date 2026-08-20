import { describe, it, expect } from 'vitest';
import { parsePageRanges } from '../lib/utils';

describe('parsePageRanges', () => {
  it('parses 1-indexed input into deduped 0-indexed page indices', () => {
    expect(parsePageRanges('1-3, 2, 5', 10)).toEqual([0, 1, 2, 4]);
  });

  it('rejects out-of-bounds pages', () => {
    expect(() => parsePageRanges('1-3, 12', 10)).toThrow();
  });

  it('rejects reversed ranges', () => {
    expect(() => parsePageRanges('5-2', 10)).toThrow();
  });

  it('rejects non-numeric input', () => {
    expect(() => parsePageRanges('abc', 10)).toThrow();
  });
});
