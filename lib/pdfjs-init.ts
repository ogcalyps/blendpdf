// Lazily loads pdfjs-dist on the client and configures its worker.
// Keep pdfjs OUT of static imports in client components — statically importing
// it adds ~300KB+ gzipped to the first-load JS of every page that renders a
// thumbnail. Always obtain it through getPdfJs()/initializePdfJsWorker().

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJsModule> | null = null;

export function getPdfJs(): Promise<PdfJsModule> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('pdfjs is client-only'));
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((pdfjsLib) => {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        // Self-hosted worker (copied to public/ by the postinstall script) —
        // no third-party CDN dependency for a core rendering path.
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      }
      return pdfjsLib;
    });
  }
  return pdfjsPromise;
}

/** Back-compat alias for existing callers. */
export async function initializePdfJsWorker(): Promise<PdfJsModule | null> {
  if (typeof window === 'undefined') return null;
  return getPdfJs();
}
