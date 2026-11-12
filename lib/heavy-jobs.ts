/**
 * Memory-heavy image work (decoding PNGs into a PDF, rendering pages to
 * images) runs one job at a time per process, with a few more waiting; the
 * rest are told to come back. Two large jobs side by side could otherwise
 * push the process past pm2's 500 MB restart line and cut every visitor's
 * request (security review, 2026-11-12). Same idea as the OCR and PDF/A
 * queues, shared by the image routes.
 */
export const MAX_WAITING_HEAVY_JOBS = 3;

let inQueue = 0;
let tail: Promise<unknown> = Promise.resolve();

/** Run `job` after the ones already queued, or return null when the queue is full. */
export function runHeavyJob<T>(job: () => Promise<T>): Promise<T> | null {
  if (inQueue > MAX_WAITING_HEAVY_JOBS) return null;
  inQueue++;
  const run = tail.then(job);
  tail = run.catch(() => undefined);
  return run.finally(() => {
    inQueue--;
  });
}

/** The JSON a route answers when the queue is full. */
export const BUSY_RESPONSE = {
  error: 'The server is busy with other files right now. Please try again in a minute.',
  errorCode: 'SERVER_BUSY',
} as const;
