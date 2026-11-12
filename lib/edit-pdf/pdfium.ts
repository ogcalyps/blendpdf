/**
 * PDFium (WebAssembly) for "Edit text (beta)": the ONLY file that names the
 * package, and only inside import(), so neither its JS nor its 4.6 MB wasm
 * is part of any page's first load (tests/edit-pdf-replace-lazy.test.ts).
 * Reached only through import() (./replace, from ./index and ./export).
 *
 * Self-hosted: with no wasmBinary, the package finds its wasm with
 * `new URL('pdfium.wasm', import.meta.url)`, which the bundler turns into a
 * hashed file under /_next/static/media. The package's own CDN URL constant
 * is never used. Node tests pass the bytes from node_modules.
 */
import { EditPdfError } from './types';

/** The wrapped PDFium API (every FPDF and EPDF function), as the package types it. */
export type PdfiumApi = Awaited<ReturnType<(typeof import('@embedpdf/pdfium'))['init']>>;

/** The Emscripten runtime pieces used here. The package's typings lack HEAPU8 and type getValue loosely. */
export interface PdfiumRuntime {
  /** Re-read after every allocation: the heap's buffer is replaced when memory grows. */
  readonly HEAPU8: Uint8Array;
  wasmExports: { malloc(size: number): number; free(ptr: number): void };
  getValue(ptr: number, type: 'i32' | 'float' | 'double'): number;
  setValue(ptr: number, value: number, type: 'i32' | 'float' | 'double'): void;
}

export interface Pdfium {
  api: PdfiumApi;
  runtime: PdfiumRuntime;
}

let loading: Promise<Pdfium> | null = null;

/**
 * PDFium, loaded once and kept until forgetPdfium(). A failed load (no
 * WebAssembly, the chunk or the wasm did not arrive, init threw) rejects
 * with REPLACE_UNAVAILABLE and is not cached, so the next call tries again.
 */
export function loadPdfium(wasmBinary?: Uint8Array): Promise<Pdfium> {
  if (!loading) {
    const attempt = (async (): Promise<Pdfium> => {
      if (typeof WebAssembly !== 'object' || typeof WebAssembly.instantiate !== 'function') {
        throw new EditPdfError('REPLACE_UNAVAILABLE', 'this browser has no WebAssembly');
      }
      try {
        const { init } = await import('@embedpdf/pdfium');
        const api = await init(wasmBinary ? { wasmBinary: wasmBinary.slice().buffer } : {});
        api.PDFiumExt_Init();
        return { api, runtime: api.pdfium as unknown as PdfiumRuntime };
      } catch (error) {
        throw new EditPdfError('REPLACE_UNAVAILABLE', error instanceof Error ? error.message : String(error));
      }
    })();
    loading = attempt;
    attempt.catch(() => {
      if (loading === attempt) loading = null;
    });
  }
  return loading;
}

/** Drop the module, so its heap (which never shrinks) can be collected. The next loadPdfium starts over. */
export function forgetPdfium(): void {
  loading = null;
}
