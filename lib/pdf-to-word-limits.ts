/**
 * How much the PDF-to-Word converter (pdf2docx 0.5.13 on a t3.small) can take
 * in one run, and how to read how far it got.
 *
 * On 2026-10-04 a real visitor hit the 120 s timeout twice on the same file,
 * and the log could not say whether it was a 300-page book or a 9-page scan.
 */

/**
 * Pages above which a run is refused up front with TOO_MANY_PAGES.
 *
 * This is a memory guard for the box, not a prediction of time. Page count
 * barely predicts pdf2docx time: on the prod versions (pdf2docx 0.5.13,
 * PyMuPDF 1.26.7, measured on an M3 Pro, roughly 2.3x slower on the box's
 * Xeon 8259CL) plain text runs at about 0.045 s/page, Arabic body text
 * 0.11 s/page and dense ruled tables 1.6 s/page. The timed-out prod files
 * whose length the logs show were 9 and 21 pages. Slow files are left to the
 * 120 s timeout, which answers CONVERSION_TIMEOUT.
 *
 * Memory does grow with pages: peak RSS was about 100 MB plus 1.5 MB per page
 * for plain text (860 MB at 500 pages, 1.0 GB at 600) and plus 3 MB per page
 * for Arabic text (1.0 GB at 300). The box has about 1.28 GB available next
 * to the Next.js server (`free -m`, 2026-10-09). At 500 pages plain text, the
 * cheapest content, already takes two thirds of that, and about 50 s.
 *
 * What it costs, honestly: it refuses plain-text files over 500 pages that
 * would still finish, because one such run would leave the site itself almost
 * no memory. It does not stop an Arabic file of 300-500 pages from passing
 * 1 GB before it finishes or the timeout kills it; that was already true
 * before this cap. The logs carry pages on every run, so tune it from there.
 */
export const PDF_TO_WORD_MAX_PAGES = 500;

export interface Pdf2DocxProgress {
  /** The last phase pdf2docx announced: '1/4' open, '2/4' analyze, '3/4' parse pages, '4/4' create pages. */
  phase: string | null;
  /** The last page it started in that phase, and of how many. */
  page: number | null;
  of: number | null;
}

/**
 * How far pdf2docx got, from its own stderr progress lines
 * ("[INFO] [3/4] Parsing pages...", "[INFO] (8/21) Page 8").
 *
 * Returns numbers only. The stderr itself must not be logged on this path: its
 * warnings quote the document's text ("Ignore Line \"...\" due to overlap").
 */
export function pdf2docxProgress(stderr: string): Pdf2DocxProgress {
  const phases = [...stderr.matchAll(/\[([1-4])\/4\]/g)];
  const pages = [...stderr.matchAll(/\((\d+)\/(\d+)\) Page \d+/g)];
  const lastPhase = phases.length ? phases[phases.length - 1] : null;
  const lastPage = pages.length ? pages[pages.length - 1] : null;
  // A page line belongs to the last phase only if it comes after that phase's banner.
  const pageInPhase = lastPage && lastPhase && lastPage.index! > lastPhase.index! ? lastPage : null;
  return {
    phase: lastPhase ? `${lastPhase[1]}/4` : null,
    page: pageInPhase ? Number(pageInPhase[1]) : null,
    of: pageInPhase ? Number(pageInPhase[2]) : null,
  };
}

export interface Pdf2DocxFailure {
  /** Python exception class, from the wrapper's "ERROR_TYPE: <name>" line. Never its message: that can quote the document. */
  errorType: string | null;
  /** The wrapper flagged a pdf2docx / PyMuPDF version mismatch. */
  versionIssue: boolean;
  /** How much pdf2docx printed, for scale. */
  stderrLines: number;
  progress: Pdf2DocxProgress;
}

/**
 * What a failed pdf2docx run may put in the log: the exception class, a
 * version-mismatch flag, a line count and the progress numbers. Never the
 * stderr itself, on any path: pdf2docx warnings and exception messages can
 * quote the document's text.
 */
export function pdf2docxFailureSummary(stderr: string): Pdf2DocxFailure {
  const type = /ERROR_TYPE: ([A-Za-z_][A-Za-z0-9_.]{0,80})/.exec(stderr);
  return {
    errorType: type ? type[1] : null,
    versionIssue: /VERSION_COMPATIBILITY_ERROR|VERSION_ERROR|get_area|'Rect' object has no attribute/.test(stderr),
    stderrLines: stderr ? stderr.split('\n').filter((line) => line.trim()).length : 0,
    progress: pdf2docxProgress(stderr),
  };
}
