import { describe, it, expect, vi } from 'vitest';
import { withEvalDisabled } from '../lib/pdfjs-init';

function fakePdfJs() {
  const getDocument = vi.fn((params: unknown) => params);
  return { lib: { getDocument, GlobalWorkerOptions: {} } as any, getDocument };
}

describe('withEvalDisabled', () => {
  it.each([
    ['a data object', { data: new Uint8Array([1]) }, { data: new Uint8Array([1]) }],
    ['a data object that asks for eval', { data: new Uint8Array([1]), isEvalSupported: true }, { data: new Uint8Array([1]) }],
    ['a blob URL string', 'blob:http://x/1', { url: 'blob:http://x/1' }],
    ['an ArrayBuffer', new ArrayBuffer(2), { data: new ArrayBuffer(2) }],
    ['a typed array', new Uint8Array([3]), { data: new Uint8Array([3]) }],
  ])('forces isEvalSupported: false for %s', (_label, src, expected) => {
    const { lib, getDocument } = fakePdfJs();
    withEvalDisabled(lib).getDocument(src as any);
    expect(getDocument).toHaveBeenCalledWith({ ...expected, isEvalSupported: false });
  });

  it('keeps the rest of the module, including the shared worker options', () => {
    const { lib } = fakePdfJs();
    expect(withEvalDisabled(lib).GlobalWorkerOptions).toBe(lib.GlobalWorkerOptions);
  });
});
