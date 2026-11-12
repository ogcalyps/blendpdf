/**
 * Server fixes for the workspace's working source (workspace-spec.md 4.8):
 * unlock, repair and OCR through the tracked api-client helpers (GA events
 * keep their tool names; nginx counts the routes). Each answers with a File
 * typed application/pdf under the visitor's original name, so the editor
 * keeps working on "the same" file. Loaded by the shell with import().
 */
import { ocrPdf, repairPDF, unlockPDF } from '@/lib/api-client';
import { SaveError } from './summary';
import type { FixStep } from './summary';
import { MAX_SERVER_BYTES } from './types';
import type { SourceFixes } from './types';

function asPdf(data: Blob, name: string): File {
  return new File([data], name, { type: 'application/pdf' });
}

/**
 * What goes up: refused here when over the server's cap, as the save does
 * (SaveError tooBig, workspace.save.errors.tooBig; repair's route has no cap
 * of its own). The routes check the MIME type: a file without one goes as a PDF.
 */
function upload(file: File, step: FixStep): File {
  if (file.size > MAX_SERVER_BYTES) throw new SaveError('tooBig', step);
  return file.type === 'application/pdf' ? file : asPdf(file, file.name);
}

export function createSourceFixes(): SourceFixes {
  return {
    async unlock(file, password) {
      const pdf = upload(file, 'unlock');
      const { blob } =
        password === null
          ? await unlockPDF(pdf, 'remove-restrictions')
          : await unlockPDF(pdf, 'unlock-password', password);
      return asPdf(blob, file.name);
    },
    async repair(file) {
      return asPdf(await repairPDF(upload(file, 'repair')), file.name);
    },
    async ocr(file, languages, redo) {
      return asPdf(await ocrPdf(upload(file, 'ocr'), languages, redo ? 'redo' : 'searchable'), file.name);
    },
  };
}
