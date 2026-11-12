// Lazily loads pdfjs-dist on the client and configures its worker.
// Keep pdfjs OUT of static imports in client components — statically importing
// it adds ~300KB+ gzipped to the first-load JS of every page that renders a
// thumbnail. Always obtain it through getPdfJs()/initializePdfJsWorker().

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJsModule> | null = null;

type GetDocumentSource = Parameters<PdfJsModule['getDocument']>[0];

/**
 * pdf.js <= 4.1.392 compiles font programs with eval unless isEvalSupported is
 * false, so a crafted PDF can run script on our origin (CVE-2024-4367). Every
 * client caller goes through getPdfJs(), so forcing the flag here covers them all,
 * whichever source shape they pass.
 */
export function withEvalDisabled(pdfjsLib: PdfJsModule): PdfJsModule {
  const getDocument = (src: GetDocumentSource) => {
    const params =
      typeof src === 'string' || src instanceof URL
        ? { url: src }
        : src instanceof ArrayBuffer || ArrayBuffer.isView(src)
          ? { data: src }
          : { ...src };
    return pdfjsLib.getDocument({ ...params, isEvalSupported: false });
  };
  return { ...pdfjsLib, getDocument } as PdfJsModule;
}

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
      return withEvalDisabled(pdfjsLib);
    });
  }
  return pdfjsPromise;
}

/** Back-compat alias for existing callers. */
export async function initializePdfJsWorker(): Promise<PdfJsModule | null> {
  if (typeof window === 'undefined') return null;
  return getPdfJs();
}
