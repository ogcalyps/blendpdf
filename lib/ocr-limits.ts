/**
 * How much OCR (ocrmypdf + tesseract on the 2-vCPU box, one job at a time)
 * takes in one run. Shared by the route and the editor, which says so before
 * the upload instead of after it.
 *
 * Speed depends on the scan far more than on the page count. On 2026-11-04 in
 * prod: three light Arabic scans (about 80 KB a page) of 47 to 50 pages took
 * about 60 s each; a heavy one (13 MB, 42 pages, about 310 KB a page) with
 * "read the text again" got through about 11 pages in the 240 s timeout,
 * about 20 s a page. So the timeout cannot be sized from pages: a heavy file
 * would need some 15 minutes, with every other OCR visitor queued behind it.
 * A timed-out visitor is told to split the file instead (OCR_TIMEOUT).
 */
export const OCR_MAX_PAGES = 50;
