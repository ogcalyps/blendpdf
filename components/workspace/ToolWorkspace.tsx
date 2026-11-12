'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import type { FileRejection } from 'react-dropzone';
import { Loader2, Upload, X } from 'lucide-react';
import { useTrackedDropzone } from '@/hooks/useTrackedDropzone';
import { useDeliveryChoice } from '@/hooks/useDeliveryChoice';
import { FileDeliveryModal } from '@/components/FileDeliveryModal';
import type { NoticeTone } from '@/components/FileDeliveryPanel';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { downloadBlob, formatFileSize, formatLimitMb } from '@/lib/utils';
import { MAX_MERGE_FILES, MAX_PDF_BYTES } from '@/lib/edit-pdf';
import { MODES } from '@/lib/workspace/modes';
import { clearCarryOver, peekCarryOver, registerWorkspace } from '@/lib/workspace/carry-over';
import type { SaveInput, SaveOutput, SavePlan, SourceFixes, WorkspaceMode } from '@/lib/workspace/types';
import type { WatermarkStamp } from '@/lib/edit-pdf/types';

/**
 * The tool section of every PDF tool page (workspace-spec.md, section 6.1):
 * a dropzone, then the PDF editor opened in the page's mode.
 *
 * First load stays light: this file statically imports only the dropzone, the
 * Drive picker, the delivery modal and pure data. The editor comes through
 * next/dynamic once a PDF is chosen; the save pipeline and the server fixes
 * through import() on first use (tests/workspace-pages.test.ts walks the
 * static imports from here).
 */
export interface ToolWorkspaceProps {
  mode: WorkspaceMode;
  /** A PDF the page made itself (converters): open it with no dropzone. */
  initialFile?: File;
  /** With initialFile: open the delivery step at once (today's one click). */
  deliverOnOpen?: boolean;
  /** With initialFile: "Choose another PDF" hands control back to the page (e.g. to convert another file). */
  onClose?: () => void;
  /** On top of the mode's preset: /compress-pdf/to-1mb opens with "Under 1 MB" chosen. */
  planPreset?: Partial<SavePlan>;
  /** On top of the default watermark, for the watermark mode: /watermark-pdf/id-copy opens with its tiled text. */
  watermarkPreset?: Partial<WatermarkStamp>;
}

/** Shown while the editor's code loads (it is not part of the page's first load). */
function WorkspaceLoading() {
  const t = useTranslations('editPdf');
  return (
    <div className="flex min-h-[60vh] items-center justify-center gap-3 text-gray-600" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span>{t('opening')}</span>
    </div>
  );
}

// The editor (pdf.js, pdf-lib, fontkit, the Cairo font) loads only once a PDF has been chosen.
const EditorWorkspace = dynamic(() => import('@/components/edit-pdf/EditorWorkspace'), {
  ssr: false,
  loading: () => <WorkspaceLoading />,
});

/** One save; the pipeline (pdf-lib, the server calls, the zip) loads on the first click. */
const runSave = (input: SaveInput): Promise<SaveOutput> =>
  import('@/lib/workspace/save').then((m) => m.runSave(input));

let fixesModule: Promise<SourceFixes> | null = null;
const loadFixes = () => (fixesModule ??= import('@/lib/workspace/fixes').then((m) => m.createSourceFixes()));

/** Unlock, repair and OCR for the working source, loaded on first use. */
const fixes: SourceFixes = {
  unlock: (file, password) => loadFixes().then((f) => f.unlock(file, password)),
  repair: (file) => loadFixes().then((f) => f.repair(file)),
  ocr: (file, languages, redo) => loadFixes().then((f) => f.ocr(file, languages, redo)),
};

interface Result {
  blob: Blob;
  filename: string;
  notice: string | null;
  /** ok: good news (a PDF/A that passed veraPDF); else a caution. */
  noticeTone?: NoticeTone;
  /** The editor's Fill again for the next person, when the save was a filled-in form. */
  nextPerson?: () => void;
}

export function ToolWorkspace({ mode, initialFile, deliverOnOpen = false, onClose, planPreset, watermarkPreset }: ToolWorkspaceProps) {
  const t = useTranslations();
  const locale = useLocale();
  const multiple = MODES[mode].multiple === true;
  const pathname = usePathname();
  // Work open before a language switch comes back here (lib/workspace/carry-over)
  const [carried] = useState(() => (initialFile ? null : peekCarryOver(pathname, mode)));
  const [files, setFiles] = useState<File[] | null>(() => (initialFile ? [initialFile] : carried ? [...carried.files] : null));
  const [resume, setResume] = useState(carried?.editor ?? null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Filling one form for several people: the email field stops offering the previous person's address
  const [severalPeople, setSeveralPeople] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // One delivery step for each save: download, or send it by email
  const { openDelivery, deliveryModalProps } = useDeliveryChoice({
    // A closed panel leaves a way back to the result: saving again can mean another server round trip,
    // and a converter's PDF can't be saved again until something changes
    offerReopen: true,
    fileBlob: result?.blob ?? null,
    filename: result?.filename ?? 'document.pdf',
    onDownload: (filename) => {
      if (result) downloadBlob(result.blob, filename);
    },
    onReset: () => setResult(null),
  });

  // Converters: the PDF they made opens here, and today's one click still delivers it
  useEffect(() => {
    if (!initialFile) return;
    setFiles((current) => (current?.length === 1 && current[0] === initialFile ? current : [initialFile]));
    if (deliverOnOpen) {
      setResult({ blob: initialFile, filename: initialFile.name, notice: null });
      openDelivery();
    }
  }, [initialFile, deliverOnOpen, openDelivery]);

  useEffect(() => clearCarryOver(), []);
  const filesRef = useRef(files);
  filesRef.current = files;
  // A converter's own PDF is the page's to make again: only a visitor's file is carried
  useEffect(
    () => registerWorkspace(() => (filesRef.current && !initialFile ? { mode, files: filesRef.current } : null)),
    [mode, initialFile],
  );

  // The editor needs the height: bring it to the top of the screen once it opens
  useEffect(() => {
    if (files) sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [files]);

  const take = useCallback(
    (accepted: File[], codes: string[]) => {
      if (codes.includes('file-too-large')) setInlineError(t('errors.fileTooLarge'));
      else if (codes.includes('too-many-files')) setInlineError(multiple ? t('workspace.insert.tooMany') : t('editPdf.singleFile'));
      else if (codes.length > 0) setInlineError(t('errors.failedToReadPdf'));
      else setInlineError(null);
      if (accepted.length === 0) return;
      setResult(null);
      setResume(null);
      setFiles(accepted);
    },
    [t, multiple],
  );

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => take(accepted, rejections.flatMap((r) => r.errors.map((e) => e.code))),
    [take],
  );

  const onDriveFiles = useCallback(
    (picked: File[]) => {
      if (picked.length === 0) return;
      if (picked.length > (multiple ? MAX_MERGE_FILES : 1)) return take([], ['too-many-files']);
      const fits = picked.filter((file) => file.size <= MAX_PDF_BYTES);
      take(fits, fits.length < picked.length ? ['file-too-large'] : []);
    },
    [take, multiple],
  );

  // The tool's main dropzone: it also takes a Keep working / home page handoff on mount
  const { getRootProps, getInputProps, isDragActive } = useTrackedDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: multiple ? MAX_MERGE_FILES : 1,
    multiple,
    maxSize: MAX_PDF_BYTES,
    disabled: !!initialFile,
  });

  const onSaved = useCallback(
    (output: SaveOutput, nextPerson?: () => void) => {
      let notice: string | null = null;
      let noticeTone: NoticeTone = 'warn';
      if (output.pdfa) {
        const { level, status, validator, failedRules, flattenedCount, flattenedPages } = output.pdfa;
        // pdfaLabel's words, written out: the shell imports nothing it can do without (first load)
        const values = { level: `PDF/A-${level}` };
        if (status === 'pass') {
          notice = t('workspace.save.pdfaPass', { ...values, validator: validator ?? 'veraPDF' });
          noticeTone = 'ok';
        } else if (status === 'fail') {
          notice = t('workspace.save.pdfaFail', { ...values, rules: failedRules.join(', ') || '?' });
        } else {
          notice = t('workspace.save.pdfaUnchecked', values);
        }
        // A pass is still a pass, but pages that lost their text are worth knowing about before the deposit.
        if (flattenedCount > 0) {
          const pages = flattenedPages.join(locale === 'ar' ? '، ' : ', ') + (flattenedCount > flattenedPages.length ? '…' : '');
          notice = `${notice} ${t('workspace.save.pdfaFlattened', { count: flattenedCount, pages })}`;
          noticeTone = 'warn';
        }
      } else if (output.sizeLimit) {
        const { mb, met, bytes, untouched } = output.sizeLimit;
        const values = { size: formatFileSize(bytes, locale), limit: formatLimitMb(mb, locale) };
        notice = untouched
          ? t('workspace.save.alreadyUnderLimit', values)
          : met
            ? t('workspace.save.underLimit', values)
            : t('workspace.save.overLimit', values);
      } else if (output.reductionPercent !== undefined) {
        notice = output.reductionPercent > 0
          ? t('workspace.save.smaller', { percent: Math.round(output.reductionPercent) })
          : t('workspace.save.notSmaller');
      } else if (output.compatibility) {
        notice = t('workspace.save.compatibility');
      } else if (output.imageLimit) {
        // The picture scan stopped early: say where, as the extract-images page did
        const { pages, images } = output.imageLimit;
        notice = [
          pages !== undefined ? t('extractImages.pageLimitNotice', { count: pages }) : null,
          images !== undefined ? t('extractImages.imageLimitNotice', { count: images }) : null,
        ]
          .filter(Boolean)
          .join(' ');
      }
      setResult({ blob: output.blob, filename: output.filename, notice, noticeTone, nextPerson });
      openDelivery();
    },
    [t, locale, openDelivery],
  );

  const savedNextPerson = result?.nextPerson;
  const nextPerson = useMemo(
    () =>
      savedNextPerson
        ? () => {
            setSeveralPeople(true);
            savedNextPerson();
          }
        : undefined,
    [savedNextPerson],
  );

  const close = useCallback(() => {
    setFiles(null);
    setResume(null);
    setResult(null);
    setSeveralPeople(false);
    setInlineError(null);
    if (initialFile) onClose?.();
  }, [initialFile, onClose]);

  return (
    <section ref={sectionRef} className="scroll-mt-16 pb-12 pt-4">
      <div className={files ? 'mx-auto max-w-7xl px-2 sm:px-6 lg:px-8' : 'mx-auto max-w-3xl px-4 sm:px-6 lg:px-8'}>
        {inlineError && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{inlineError}</p>
            <button
              type="button"
              onClick={() => setInlineError(null)}
              className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-red-600 transition-colors hover:text-red-700"
              aria-label={t('common.dismiss')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {files ? (
          <EditorWorkspace files={files} mode={mode} planPreset={planPreset} watermarkPreset={watermarkPreset} runSave={runSave} fixes={fixes} onSaved={onSaved} onClose={close} resume={resume} />
        ) : (
          <>
            <div
              {...getRootProps()}
              className={`relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white p-8 transition-colors duration-200 sm:min-h-[400px] sm:p-16 ${isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4 text-center">
                <div className={`rounded-full p-4 ${isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
                  <Upload className={`h-12 w-12 ${isDragActive ? 'text-green-600' : 'text-primary'}`} />
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="text-2xl font-semibold text-gray-900">{t('common.dropPdfHere')}</h2>
                  <p className="text-gray-700">{t('common.orClickToBrowse')}</p>
                </div>
                <div className="pointer-events-none mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-center font-medium text-white">
                  {t('editPdf.chooseFile')}
                </div>
                <p className="mt-4 text-sm text-gray-500">{multiple ? t('workspace.drop.several') : t('workspace.drop.one')}</p>
              </div>
            </div>
            <div className="mt-4 flex justify-center">
              <GoogleDrivePicker onFilesSelected={onDriveFiles} multiple={multiple} accept={['application/pdf']} />
            </div>
          </>
        )}
      </div>

      <FileDeliveryModal {...deliveryModalProps} notice={result?.notice ?? null} noticeTone={result?.noticeTone} aboveEditorBar={files !== null} onNextPerson={nextPerson} prefillEmail={!severalPeople} />
    </section>
  );
}
