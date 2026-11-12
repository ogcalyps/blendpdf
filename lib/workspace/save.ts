/**
 * One workspace save (workspace-spec.md 5.2), always in this order:
 *   1. export the doc's changes in the browser, or keep the source bytes as
 *      they are when there is nothing to apply (request null);
 *   2. convert and stop, for any format but PDF (Word, Excel, images on the
 *      server; text and the pictures inside in the browser);
 *   3. compress (server; before metadata, since Ghostscript rewrites it);
 *   4. cut into files (browser);
 *   5. remove metadata from each file (browser; after the cut, since
 *      PDFDocument.create() adds a Producer and dates);
 *   6. add the password to each file (server; always last, nothing can read
 *      the file after);
 *   7. zip when there is more than one file.
 * Every upload is refused here first when the server would refuse it (size,
 * page caps). Analytics: one run per browser operation (./track); server
 * steps are tracked by the api-client helpers. Loaded by the shell with
 * import(), so nothing here reaches a first load.
 */
import { compressPDF, pdfToExcel, pdfToImages, pdfToPdfa, pdfToWord, protectPDF } from '@/lib/api-client';
import type { ApiError } from '@/lib/analytics';
import { exportEditedPdf } from '@/lib/edit-pdf';
import type { ExportWarning } from '@/lib/edit-pdf';
import { MAX_EXTRACTED_IMAGES, MAX_IMAGE_SCAN_PAGES, extractImages } from '@/lib/extract-images';
import { extractText } from '@/lib/extract-text';
import { removeMetadata } from '@/lib/pdf-cleanup';
import { createZipBlob, readZipFiles } from '@/lib/zip-generation';
import { cutPdf, everyGroups, runGroups } from './cut';
import { MODES } from './modes';
import { outputName, partName, runName, selectedName } from './names';
import { SaveError, effectivePlan, opsForSave } from './summary';
import type { SaveErrorCode } from './summary';
import { trackClientOps } from './track';
import { MAX_IMAGE_PAGES, MAX_SERVER_BYTES, MAX_WORD_PAGES } from './types';
import type { SaveInput, SaveOutput, SavePlan, SaveStep } from './types';

interface OutFile {
  name: string;
  bytes: Uint8Array;
}

/** A file of the save: its name, and the 0-based pages cut from the saved PDF (null = all of it, as is). */
interface FileGroup {
  name: string;
  pages: number[] | null;
}

const blobPart = (bytes: Uint8Array) => bytes as unknown as BlobPart;

/** Steps that run in the browser: only a failure there is a browser run's error. */
const CLIENT_STEPS: ReadonlySet<SaveStep> = new Set(['export', 'cut', 'metadata', 'zip']);
const CLIENT_FORMATS: ReadonlySet<SavePlan['format']> = new Set(['text', 'imagesInside']);

export async function runSave(input: SaveInput): Promise<SaveOutput> {
  const tracking = trackClientOps(opsForSave(input.summary, input.plan, input.mode).client);
  let step = 'export' as SaveStep; // moved on by at(), which TS can't see here
  const at = (next: SaveStep) => {
    step = next;
    input.onStep?.(next);
  };
  try {
    const output = await save(input, at);
    tracking.complete();
    return output;
  } catch (error) {
    if (error instanceof SaveError) {
      // The text or pictures were looked for and there were none: the browser run worked (as the old pages counted it).
      if (error.code === 'noText' || error.code === 'noImages') tracking.complete();
      // Otherwise a cap checked before uploading, or a server step's answer, which its route's log line counts.
    } else if (CLIENT_STEPS.has(step) || (step === 'convert' && CLIENT_FORMATS.has(input.plan.format))) {
      tracking.error(error, step);
    }
    throw error;
  }
}

async function save(input: SaveInput, at: (step: SaveStep) => void): Promise<SaveOutput> {
  const plan = effectivePlan(input.plan);
  const base = input.baseName;
  const suffix = MODES[input.mode].suffix;

  // Page caps are known before anything runs.
  if (plan.format === 'word' && input.pageCount > MAX_WORD_PAGES) throw new SaveError('wordPages', 'convert');
  if (plan.format === 'images' && input.pageCount > MAX_IMAGE_PAGES) throw new SaveError('imagePages', 'convert');

  // 1. Export, or the source bytes untouched.
  let bytes: Uint8Array = new Uint8Array(await input.source.arrayBuffer());
  let warnings: ExportWarning[] = [];
  let removedLines = 0;
  if (input.request) {
    at('export');
    ({ bytes, warnings, removedLines } = await exportEditedPdf(bytes, input.request));
  }
  const output = (blob: Blob, filename: string, files: number, extra: Partial<SaveOutput> = {}): SaveOutput => ({
    blob,
    filename,
    files,
    warnings,
    removedLines,
    ...extra,
  });

  // 2. Convert and stop.
  if (plan.format !== 'pdf') {
    at('convert');
    const send = <T>(fn: (file: File) => Promise<T>) => upload('convert', { name: input.source.name, bytes }, fn);
    switch (plan.format) {
      case 'word': {
        const { blob, compatibility } = await send(pdfToWord);
        return output(blob, outputName(base, suffix, 'docx'), 1, compatibility ? { compatibility: true } : {});
      }
      case 'excel':
        return output(await send(pdfToExcel), outputName(base, suffix, 'xlsx'), 1);
      case 'pdfa': {
        const { blob, check } = await send((file) => pdfToPdfa(file, plan.pdfaLevel));
        return output(blob, outputName(base, suffix, 'pdf'), 1, { pdfa: check });
      }
      case 'images': {
        const zip = await send((file) => pdfToImages(file, plan.imageType));
        // One page: hand back the picture itself, not a ZIP holding one file (the old page offered it on its own)
        if (input.pageCount === 1) {
          // Unreadable here is no reason to withhold it: the ZIP goes out as the server sent it
          const [only, ...rest] = await readZipFiles(zip).catch(() => []);
          if (only && rest.length === 0) {
            const type = plan.imageType === 'png' ? 'image/png' : 'image/jpeg';
            return output(new Blob([blobPart(only.bytes)], { type }), `${base}_page-1.${plan.imageType}`, 1);
          }
        }
        return output(zip, outputName(base, suffix, 'zip'), input.pageCount);
      }
      case 'text': {
        const text = await extractText(bytes, { pageSeparators: plan.pageSeparators });
        if (!text) throw new SaveError('noText', 'convert');
        return output(new Blob([text], { type: 'text/plain;charset=utf-8' }), outputName(base, suffix, 'txt'), 1);
      }
      case 'imagesInside': {
        const { images, pageLimitHit, imageLimitHit } = await extractImages(bytes);
        if (images.length === 0) throw new SaveError('noImages', 'convert');
        const limit =
          pageLimitHit || imageLimitHit
            ? {
                imageLimit: {
                  ...(pageLimitHit ? { pages: MAX_IMAGE_SCAN_PAGES } : {}),
                  ...(imageLimitHit ? { images: MAX_EXTRACTED_IMAGES } : {}),
                },
              }
            : {};
        if (images.length === 1) {
          return output(new Blob([blobPart(images[0].bytes)], { type: 'image/png' }), `${base}_image_1.png`, 1, limit);
        }
        at('zip');
        const zip = await createZipBlob(images.map((image) => ({ name: `${base}_${image.name}`, bytes: image.bytes })));
        return output(zip, outputName(base, suffix, 'zip'), images.length, limit);
      }
    }
  }

  // 3. Compress, by level or to fit a size limit.
  let reductionPercent: number | undefined;
  let sizeLimit: SaveOutput['sizeLimit'];
  if (plan.compress) {
    at('compress');
    const level = plan.compress;
    const mb = plan.compressLimitMb;
    const limit = mb === null ? undefined : Math.floor(mb * 1_000_000);
    if (mb !== null && limit !== undefined && bytes.length <= limit) {
      // Already fits: no upload, and no quality lost for nothing
      sizeLimit = { mb, met: true, bytes: bytes.length, untouched: true };
    } else {
      const compressed = await upload('compress', { name: input.source.name, bytes }, (file) => compressPDF(file, level, limit));
      const smaller = new Uint8Array(await compressed.arrayBuffer());
      reductionPercent = Math.max(0, Math.round((1 - smaller.length / bytes.length) * 100));
      bytes = smaller;
      if (mb !== null && limit !== undefined) sizeLimit = { mb, met: bytes.length <= limit, bytes: bytes.length, untouched: false };
    }
  }

  // 4. Cut into files.
  const groups = fileGroups(plan, input, suffix);
  let files: OutFile[];
  if (groups.some((group) => group.pages)) {
    at('cut');
    const cut = await cutPdf(bytes, groups.flatMap((group) => (group.pages ? [group.pages] : [])));
    files = groups.map((group) => ({ name: group.name, bytes: group.pages ? cut.shift()! : bytes }));
  } else {
    files = groups.map((group) => ({ name: group.name, bytes }));
  }

  // 5. Remove metadata, each file.
  if (plan.removeMetadata) {
    at('metadata');
    for (const file of files) file.bytes = await removeMetadata(file.bytes);
  }

  // 6. Add the password, each file. Always last.
  if (plan.password) {
    at('protect');
    const password = plan.password;
    for (const file of files) {
      const locked = await upload('protect', file, (pdf) => protectPDF(pdf, password));
      file.bytes = new Uint8Array(await locked.arrayBuffer());
    }
  }

  const extra = { ...(reductionPercent === undefined ? {} : { reductionPercent }), ...(sizeLimit ? { sizeLimit } : {}) };
  if (files.length === 1) {
    return output(new Blob([blobPart(files[0].bytes)], { type: 'application/pdf' }), files[0].name, 1, extra);
  }

  // 7. Zip.
  at('zip');
  return output(await createZipBlob(files), outputName(base, suffix, 'zip'), files.length, extra);
}

/** The files a PDF save delivers (plan already through effectivePlan). */
function fileGroups(plan: SavePlan, input: SaveInput, suffix: string): FileGroup[] {
  const base = input.baseName;
  const whole: FileGroup = { name: outputName(base, suffix, 'pdf'), pages: null };
  if (plan.split.kind === 'every') {
    const groups = everyGroups(input.pageCount, plan.split.n);
    return groups.length > 1 ? groups.map((pages, i) => ({ name: partName(base, i + 1), pages })) : [whole];
  }
  if (plan.split.kind === 'runs') {
    return runGroups(input.selected).map((pages) => ({
      name: runName(base, pages[0] + 1, pages[pages.length - 1] + 1),
      pages,
    }));
  }
  if (plan.alsoSelected) {
    return [whole, { name: selectedName(base), pages: [...new Set(input.selected)].sort((a, b) => a - b) }];
  }
  return [whole];
}

/**
 * Send one PDF to a route, refusing it here first when it is over the
 * server's size cap. Failures become a SaveError with the copy to show.
 */
async function upload<T>(step: SaveStep, file: OutFile, send: (file: File) => Promise<T>): Promise<T> {
  if (file.bytes.length > MAX_SERVER_BYTES) throw new SaveError('tooBig', step);
  try {
    return await send(new File([blobPart(file.bytes)], file.name, { type: 'application/pdf' }));
  } catch (error) {
    const { message, status, errorCode } = (error ?? {}) as ApiError;
    const code: SaveErrorCode =
      status === 429
        ? 'busy'
        : status === 413 || errorCode === 'FILE_TOO_LARGE'
          ? 'tooBig'
          : // A timeout fails the same way on retry (and holds a CPU for 120 s): point at fewer pages
            errorCode === 'TOO_MANY_PAGES' || errorCode === 'CONVERSION_TIMEOUT'
            ? 'wordPages'
            : // PDF to Excel on a PDF with no table: a retry finds none either
              errorCode === 'NO_TABLES'
              ? 'noTables'
              : 'server';
    throw new SaveError(code, step, { message, status, errorCode });
  }
}
