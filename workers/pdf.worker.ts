/**
 * Web Worker for client-side PDF processing.
 *
 * Runs the pure pdf-lib operations from lib/pdf-ops.ts off the main thread so
 * files never have to leave the user's device for the core organize/edit
 * tools. Spawned by lib/client-pdf.ts — do not import this file directly.
 */
import {
  mergePDFs,
  splitPDF,
  rotatePages,
  reorderPages,
  deletePages,
  addPageNumbers,
  watermarkPDF,
  type AddPageNumbersOptions,
  type WatermarkOptions,
} from '@/lib/pdf-ops';

export type PdfWorkerOp =
  | { op: 'merge'; buffers: ArrayBuffer[] }
  | { op: 'split'; buffer: ArrayBuffer; pageIndices: number[] }
  | { op: 'rotate'; buffer: ArrayBuffer; rotations: Record<number, number> }
  | { op: 'reorder'; buffer: ArrayBuffer; pageOrder: number[] }
  | { op: 'deletePages'; buffer: ArrayBuffer; pages: number[] }
  | { op: 'addPageNumbers'; buffer: ArrayBuffer; options: AddPageNumbersOptions }
  | { op: 'watermark'; buffer: ArrayBuffer; options: WatermarkOptions };

export interface PdfWorkerRequest {
  id: number;
  task: PdfWorkerOp;
}

export type PdfWorkerResponse =
  | { id: number; ok: true; result: Uint8Array }
  | { id: number; ok: false; error: { message: string; code?: string } };

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  const { id, task } = event.data;
  try {
    let result: Uint8Array;
    switch (task.op) {
      case 'merge':
        result = await mergePDFs(task.buffers);
        break;
      case 'split':
        result = await splitPDF(task.buffer, task.pageIndices);
        break;
      case 'rotate':
        result = await rotatePages(task.buffer, task.rotations);
        break;
      case 'reorder':
        result = await reorderPages(task.buffer, task.pageOrder);
        break;
      case 'deletePages':
        result = await deletePages(task.buffer, task.pages);
        break;
      case 'addPageNumbers':
        result = await addPageNumbers(task.buffer, task.options);
        break;
      case 'watermark':
        result = await watermarkPDF(task.buffer, task.options);
        break;
      default: {
        const exhaustive: never = task;
        throw new Error(`Unknown op: ${(exhaustive as { op: string }).op}`);
      }
    }
    const response: PdfWorkerResponse = { id, ok: true, result };
    (self as unknown as Worker).postMessage(response, [result.buffer as ArrayBuffer]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF processing failed';
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined;
    const response: PdfWorkerResponse = { id, ok: false, error: { message, code } };
    (self as unknown as Worker).postMessage(response);
  }
};
