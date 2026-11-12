'use client';

/**
 * The workspace's working source: the PDF pdf.js shows and every save,
 * Edit text probe and font analysis reads (workspace-spec.md 4.2). It starts
 * as the visitor's file and can be swapped in place (`replace`) by a fix
 * (unlock, repair, OCR) or by Insert PDF, without the editor being rebuilt:
 * the doc and its history live on in the Editor.
 *
 * One pdf.js document at a time, shared by the page canvas and every
 * thumbnail. The file goes to pdf.js as an object URL, never as { data }:
 * pdf.js transfers (detaches) a buffer it is given. The URL lives as long as
 * its document (pdf.js may read ranges later). On a swap the old document is
 * destroyed only once the new one is ready, so the page never goes blank.
 *
 * Opening also sorts out what the editor can't open yet: a password pdf.js
 * asks for (locked, needsPassword), a file pdf.js can't open that pdf-lib
 * finds encrypted (locked) or can't read either (unreadable). FixPanel offers
 * the way out. A file pdf.js opens without a password opens, even when
 * pdf-lib can't write it yet (restrictions only, or unreadable to pdf-lib):
 * `needsFix` says which fix a step that writes it will ask for first
 * (workspace-rules.ts). `scanned` is set when the first pages have no text at
 * all (hasTextLayer).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { getPdfJs } from '@/lib/pdfjs-init';
import { EditPdfError, hasTextLayer, inspectPdf, isEditPdfError, type QuarterTurn, type SourcePageInfo } from '@/lib/edit-pdf';
import { fixForSource, type SourceFix } from './workspace-rules';

export interface WorkingSource {
  file: File;
  pdf: PDFDocumentProxy;
  sourcePages: SourcePageInfo[];
  /** 0 for the file as dropped, +1 for every swap. */
  version: number;
  /** What pdf-lib needs before it can write this file (pdf.js reads it either way); null = nothing. */
  needsFix: SourceFix | null;
}

export interface ReplaceOptions {
  /** pdf-lib wrote `next` itself (appendPdfs): it can read it, so there's no need to parse it again. */
  writtenByPdfLib?: boolean;
}

export type WorkingState =
  | { status: 'loading' }
  | { status: 'ready'; source: WorkingSource; scanned: boolean }
  | { status: 'locked'; file: File; needsPassword: boolean }
  | { status: 'unreadable'; file: File };

/** An open pdf.js document and what it needs to be let go. */
interface Handle {
  pdf: PDFDocumentProxy;
  release: () => void;
}

type Opened =
  | { status: 'ready'; handle: Handle; sourcePages: SourcePageInfo[]; scanned: boolean; needsFix: SourceFix | null }
  | { status: 'locked'; needsPassword: boolean }
  | { status: 'unreadable' };

const toQuarterTurn = (angle: number): QuarterTurn => {
  const a = (((Math.round(angle / 90) * 90) % 360) + 360) % 360;
  return a as QuarterTurn;
};

/** Run inspectPdf; 'unknown' when the engine is unavailable, so it never blocks editing on its own. */
async function inspect(file: File): Promise<'encrypted' | 'unreadable' | 'ok' | 'unknown'> {
  try {
    const result = await inspectPdf(new Uint8Array(await file.arrayBuffer()));
    return result.encrypted ? 'encrypted' : 'ok';
  } catch (error) {
    if (isEditPdfError(error, 'ENCRYPTED')) return 'encrypted';
    if (isEditPdfError(error, 'UNREADABLE')) return 'unreadable';
    console.warn('edit-pdf: inspectPdf failed', error);
    return 'unknown';
  }
}

/** Open one file with pdf.js (and pdf-lib alongside). `alive` false = the caller moved on: give everything back. */
async function openPdf(file: File, alive: () => boolean, options: ReplaceOptions = {}): Promise<Opened | null> {
  const inspection = options.writtenByPdfLib ? Promise.resolve('ok' as const) : inspect(file);
  const url = URL.createObjectURL(file);
  let handle: Handle | null = null;
  try {
    const pdfjs = await getPdfJs();
    if (!alive()) {
      URL.revokeObjectURL(url);
      return null;
    }
    const task = pdfjs.getDocument({ url });
    handle = {
      pdf: null as unknown as PDFDocumentProxy,
      release: () => {
        void task.destroy();
        URL.revokeObjectURL(url);
      },
    };
    const pdf = await task.promise;
    handle.pdf = pdf;
    if (!alive()) {
      handle.release();
      return null;
    }
    const sourcePages = await Promise.all(
      Array.from({ length: pdf.numPages }, async (_, i) => {
        const page = await pdf.getPage(i + 1);
        const [x0, y0, x1, y1] = page.view;
        return { width: Math.abs(x1 - x0), height: Math.abs(y1 - y0), rotate: toQuarterTurn(page.rotate) };
      }),
    );
    // pdf.js knows the file is encrypted even when it opens it without a password (owner password
    // only); pdf-lib may not get as far as saying so when the page tree sits in encrypted streams.
    const info = (await pdf.getMetadata().catch(() => null))?.info as { EncryptFilterName?: string | null } | undefined;
    const verdict = await inspection;
    const scanned = sourcePages.length > 0 && !(await hasTextLayer(pdf).catch(() => true));
    if (!alive()) {
      handle.release();
      return null;
    }
    if (sourcePages.length === 0) {
      handle.release();
      return { status: 'unreadable' };
    }
    // pdf.js opened it without a password: it opens. Restrictions or pdf-lib's trouble with it wait for a step that writes it.
    return { status: 'ready', handle, sourcePages, scanned, needsFix: fixForSource(verdict, Boolean(info?.EncryptFilterName)) };
  } catch (error) {
    handle?.release();
    if (!handle) URL.revokeObjectURL(url);
    if (!alive()) return null;
    const name = (error as { name?: string } | null)?.name;
    if (name === 'PasswordException') return { status: 'locked', needsPassword: true };
    if ((await inspection) === 'encrypted') return { status: 'locked', needsPassword: false };
    console.error('edit-pdf: could not open the PDF', error);
    return { status: 'unreadable' };
  }
}

export function useWorkingSource(initial: File): {
  state: WorkingState;
  /**
   * Open `next` in place of the current file. Resolves with the new source
   * once pdf.js has it (the old document is destroyed then). Rejects with
   * EditPdfError('ENCRYPTED' | 'UNREADABLE') when `next` can't be opened:
   * a ready source stays as it was; a locked or unreadable one shows `next`'s
   * state instead (a fix that didn't take).
   */
  replace: (next: File, options?: ReplaceOptions) => Promise<WorkingSource>;
} {
  const [state, setState] = useState<WorkingState>({ status: 'loading' });
  const current = useRef<{ handle: Handle | null; version: number; ready: boolean }>({ handle: null, version: 0, ready: false });
  /** Bumped by every open: an older open that finishes late gives its document back. */
  const token = useRef(0);
  const mounted = useRef(true);

  /** Adopt a ready document as the working source; the previous one goes. */
  const adopt = useCallback((file: File, opened: Extract<Opened, { status: 'ready' }>, version: number): WorkingSource => {
    const previous = current.current.handle;
    current.current = { handle: opened.handle, version, ready: true };
    const source: WorkingSource = { file, pdf: opened.handle.pdf, sourcePages: opened.sourcePages, version, needsFix: opened.needsFix };
    setState({ status: 'ready', source, scanned: opened.scanned });
    previous?.release();
    return source;
  }, []);

  useEffect(() => {
    mounted.current = true;
    const mine = ++token.current;
    current.current = { handle: null, version: 0, ready: false };
    setState({ status: 'loading' });
    void openPdf(initial, () => mounted.current && token.current === mine).then((opened) => {
      if (!opened) return;
      if (opened.status === 'ready') adopt(initial, opened, 0);
      else setState(opened.status === 'locked' ? { status: 'locked', file: initial, needsPassword: opened.needsPassword } : { status: 'unreadable', file: initial });
    });
    return () => {
      mounted.current = false;
      token.current += 1;
      current.current.handle?.release();
      current.current = { handle: null, version: 0, ready: false };
    };
  }, [adopt, initial]);

  const replace = useCallback(
    async (next: File, options?: ReplaceOptions): Promise<WorkingSource> => {
      const mine = ++token.current;
      const opened = await openPdf(next, () => mounted.current && token.current === mine, options);
      if (!opened) throw new EditPdfError('UNREADABLE', 'superseded');
      const version = current.current.version + 1;
      if (opened.status === 'ready') return adopt(next, opened, version);
      // Nothing to show the new file with: keep a ready source; otherwise say what is wrong with this one.
      if (!current.current.ready) {
        current.current = { ...current.current, version };
        setState(opened.status === 'locked' ? { status: 'locked', file: next, needsPassword: opened.needsPassword } : { status: 'unreadable', file: next });
      }
      throw new EditPdfError(opened.status === 'locked' ? 'ENCRYPTED' : 'UNREADABLE', `the new file is ${opened.status}`);
    },
    [adopt],
  );

  return { state, replace };
}
