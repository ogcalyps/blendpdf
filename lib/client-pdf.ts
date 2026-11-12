/**
 * Client-side PDF processing via the pdf Web Worker.
 *
 * Usage in tool pages (client-first with server fallback):
 *
 *   try {
 *     const bytes = await runPdfOpInWorker({ op: 'merge', buffers });
 *     // → processed locally, file never left the device
 *   } catch (err) {
 *     if (err instanceof ClientPdfError && !err.retryOnServer) throw err;
 *     // → fall back to the existing API route
 *   }
 *
 * Errors that are the user's input's fault (encrypted PDF, unsupported text)
 * carry retryOnServer=false — the server would fail identically, so surface
 * them instead of wasting an upload.
 */
import type { PdfWorkerOp, PdfWorkerRequest, PdfWorkerResponse } from '@/workers/pdf.worker';

export type { PdfWorkerOp };

/** Total input bytes above which we prefer the server (worker memory limits). */
export const CLIENT_PDF_MAX_INPUT_BYTES = 80 * 1024 * 1024;

/** Per-op safety timeout — on expiry the worker is reset and callers fall back. */
const OP_TIMEOUT_MS = 120_000;

/** Error codes that would fail identically on the server. */
const NON_RETRYABLE_CODES = new Set(['ENCRYPTED_PDF', 'UNSUPPORTED_TEXT']);

export class ClientPdfError extends Error {
  constructor(
    message: string,
    public code?: string,
    /** false → server fallback is pointless; surface the error to the user */
    public retryOnServer: boolean = true
  ) {
    super(message);
    this.name = 'ClientPdfError';
  }
}

/**
 * True when a client-first page retries this browser failure on the server:
 * anything except a ClientPdfError marked retryOnServer=false.
 */
export function fallsBackToServer(error: unknown): boolean {
  return !(error instanceof ClientPdfError && !error.retryOnServer);
}

interface Pending {
  resolve: (bytes: Uint8Array) => void;
  reject: (err: ClientPdfError) => void;
  timer: ReturnType<typeof setTimeout>;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function resetWorker(reason: string) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  for (const [, p] of pending) {
    clearTimeout(p.timer);
    p.reject(new ClientPdfError(reason, 'WORKER_RESET'));
  }
  pending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url));

  worker.onmessage = (event: MessageEvent<PdfWorkerResponse>) => {
    const data = event.data;
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    clearTimeout(entry.timer);

    if (data.ok) {
      entry.resolve(data.result);
    } else {
      const retryOnServer = !NON_RETRYABLE_CODES.has(data.error.code ?? '');
      entry.reject(new ClientPdfError(data.error.message, data.error.code, retryOnServer));
    }
  };

  // A worker-level error (failed to load, OOM crash) poisons all in-flight ops.
  worker.onerror = () => {
    resetWorker('PDF worker crashed');
  };

  return worker;
}

/** True when this browser can run PDF ops locally. */
export function isClientPdfSupported(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

/**
 * Policy helper: should this operation run in the browser?
 * @param totalInputBytes - Combined size of all input files
 */
export function shouldUseClientPdf(totalInputBytes: number): boolean {
  return isClientPdfSupported() && totalInputBytes <= CLIENT_PDF_MAX_INPUT_BYTES;
}

/**
 * Run a PDF operation in the worker. Resolves with the output PDF bytes.
 * Rejects with ClientPdfError; check `retryOnServer` before falling back.
 *
 * Note: input ArrayBuffers are transferred to the worker (zero-copy) and are
 * unusable afterwards — pass a copy if the caller still needs the buffer
 * (e.g. `file.arrayBuffer()` results are fine, they're single-use anyway).
 */
export function runPdfOpInWorker(task: PdfWorkerOp): Promise<Uint8Array> {
  if (!isClientPdfSupported()) {
    return Promise.reject(new ClientPdfError('Web Workers are not supported in this browser', 'NO_WORKER'));
  }

  const id = ++seq;
  const transfers: ArrayBuffer[] =
    task.op === 'merge' ? [...task.buffers] : [task.buffer];

  return new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      // The op may be wedged (e.g. pathological PDF) — reset so the next op
      // gets a clean worker, and let the caller fall back to the server.
      resetWorker('PDF processing timed out in the browser');
      reject(new ClientPdfError('PDF processing timed out in the browser', 'TIMEOUT'));
    }, OP_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });

    const request: PdfWorkerRequest = { id, task };
    try {
      getWorker().postMessage(request, transfers);
    } catch (err) {
      pending.delete(id);
      clearTimeout(timer);
      reject(new ClientPdfError(err instanceof Error ? err.message : 'Failed to start PDF worker', 'POST_FAILED'));
    }
  });
}
