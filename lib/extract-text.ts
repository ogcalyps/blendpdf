/**
 * The text of a PDF as plain text, read in the browser with pdf.js (moved
 * from app/[locale]/pdf-to-text/page.tsx, same output). pdf.js comes through
 * lib/pdfjs-init, never a static import.
 */
import { getPdfJs } from '@/lib/pdfjs-init';

type TextRun = { str: string; width: number; transform: number[]; hasEOL?: boolean };

const fontSize = (run: TextRun) => Math.hypot(run.transform[2], run.transform[3]) || 1;

/** The horizontal gap between two runs, whichever is on the left; negative when they overlap. */
function gapBetween(a: TextRun, b: TextRun): number {
  const aStart = a.transform[4];
  const bStart = b.transform[4];
  return Math.max(bStart - (aStart + a.width), aStart - (bStart + b.width));
}

/**
 * Whether a space belongs between two runs on one line. Chrome-made PDFs put
 * every word and punctuation mark in its own run, and pdf.js already adds its
 * own " " runs for word gaps, so a space between every run doubled the spaces
 * and cut "fusionner," into "fusionner ,". Runs that touch (a comma after its
 * word, a word split by a font change, an Arabic mark) join; a gap of more
 * than 0.22 of the font size is a word break (the narrowest measured on the
 * fixtures is 0.24, the widest touching gap 0.20). Measured both ways, so
 * right-to-left runs work too. A run drawn mostly over the last one (a text
 * shadow) is another copy, not the same word.
 */
function apart(previous: TextRun, run: TextRun): boolean {
  const gap = gapBetween(previous, run);
  return gap > fontSize(run) * 0.22 || gap < -fontSize(run) * 0.5;
}

const RIGHT_TO_LEFT = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const LATIN = /[A-Za-zÀ-ɏ]/;
/** Arabic harakat and other marks drawn as runs of their own. */
const ARABIC_MARKS = /^[ؐ-ًؚ-ٰٟۖ-ۭ]+$/;
const DIGITS = /^[0-9٠-٩۰-۹]+$/;
const NUMBER_SEPARATOR = /^[.,:/-]$/;
const PRESENTATION_FORMS = /[ﭐ-﷿ﹰ-﻿]+/g;
/** Letters only Persian or Urdu use; a page without any is read as Arabic. */
const PERSIAN_OR_URDU = /[پچژگٹڈڑںے]/;
/**
 * Fonts like Arial draw Arabic ي ك ه with the glyphs of Persian ی ک ھ, so
 * their presentation forms come back as the Persian letters: right on
 * screen, but a search for an Arabic word misses them.
 */
const PERSIAN_LOOKALIKES: Record<string, string> = { 'ی': 'ي', 'ک': 'ك', 'ھ': 'ه' };

const count = (text: string, letters: RegExp) => [...text].filter((c) => letters.test(c)).length;

/** Runs on one line, in the order pdf.js gave them, joined with the spaces their gaps call for. */
function joinRuns(runs: TextRun[]): string {
  let text = '';
  // The last run with text on the line.
  let previous: TextRun | null = null;
  for (const run of runs) {
    // Some PDFs map the space glyph to U+0000; in a .txt it is a space.
    const str = run.str.replace(/\u0000/g, ' ');
    if (text && str && !/\s$/.test(text) && !/^\s/.test(str) && (!previous || apart(previous, run))) text += ' ';
    text += str;
    if (str.trim()) previous = run;
  }
  return text;
}

type Direction = 'R' | 'L' | 'number' | 'separator' | 'other';
function direction(str: string): Direction {
  if (RIGHT_TO_LEFT.test(str)) return 'R';
  if (LATIN.test(str)) return 'L';
  if (DIGITS.test(str)) return 'number';
  return NUMBER_SEPARATOR.test(str) ? 'separator' : 'other';
}

/**
 * A line holding Arabic (or Hebrew) letters, in reading order. Chrome draws
 * such text glyph by glyph, left to right as it appears on the page, and
 * pdf.js 3.11 can only reorder inside one run, so every word came out
 * backwards ("ﺔطﺳﺑﻣ" for "مبسطة"). The runs are put back in visual order,
 * read right to left on a right-to-left page (left to right otherwise), and
 * the runs of the other direction (Latin words and numbers on an Arabic page,
 * Arabic words on a Latin one) are turned back round. Presentation forms
 * become the plain letters people search for.
 */
function readingOrder(runs: TextRun[], rightToLeftPage: boolean, arabicPage: boolean): string {
  // The runs with text, each mark joined to the letter it sits on, and the
  // word breaks pdf.js marked with " " runs between its neighbours.
  const letters: TextRun[] = [];
  const marks: TextRun[] = [];
  const spaceAfter = new Set<TextRun>();
  let last: TextRun | null = null;
  let afterMark = false;
  for (const run of runs) {
    const str = run.str.replace(/\u0000/g, ' ').trim();
    if (!str) {
      // A space pdf.js put right after a mark comes from the mark's offset.
      if (last && !afterMark) spaceAfter.add(last);
      continue;
    }
    afterMark = ARABIC_MARKS.test(str);
    const copy = { ...run, str };
    if (afterMark) {
      marks.push(copy);
    } else {
      // ى and ة only end a word: a run starting with one is backwards (pdf.js merged and reversed it).
      if (/^[ىة][؀-ۿ]{1,2}$/.test(str)) copy.str = [...str].reverse().join('');
      letters.push(copy);
      last = copy;
    }
  }
  const center = (run: TextRun) => run.transform[4] + run.width / 2;
  for (const mark of marks) {
    let nearest: TextRun | null = null;
    for (const letter of letters) {
      if (!nearest || Math.abs(center(letter) - center(mark)) < Math.abs(center(nearest) - center(mark))) nearest = letter;
    }
    if (nearest) nearest.str += mark.str;
    else letters.push(mark);
  }
  const streamIndex = new Map(letters.map((run, i) => [run, i]));
  const brokenBetween = (a: TextRun, b: TextRun) => {
    const i = streamIndex.get(a)!;
    const j = streamIndex.get(b)!;
    return Math.abs(i - j) === 1 && spaceAfter.has(i < j ? a : b);
  };
  const spaced = (a: TextRun, b: TextRun) => apart(a, b) || brokenBetween(a, b);

  const visual = [...letters].sort((a, b) => a.transform[4] - b.transform[4] || center(a) - center(b));
  const order = rightToLeftPage ? [...visual].reverse() : visual;
  const opposite = (d: Direction) => (rightToLeftPage ? d === 'L' || d === 'number' : d === 'R');
  const reading: TextRun[] = [];
  for (let i = 0; i < order.length; ) {
    const d = direction(order[i].str);
    let j = i + 1;
    if (opposite(d)) {
      // Letters keep going across the words between them, numbers across a
      // single separator (1,250 or 2026/03/12); a wide gap (a table cell, a
      // label) ends the run.
      while (j < order.length && gapBetween(order[j - 1], order[j]) <= fontSize(order[j])) {
        const next = direction(order[j].str);
        if (next === d) j++;
        else if (rightToLeftPage && d === 'number' && next === 'separator' && j + 1 < order.length && direction(order[j + 1].str) === 'number') j += 2;
        else if (rightToLeftPage && d === 'L' && next === 'other' && j + 1 < order.length && direction(order[j + 1].str) === 'L') j += 2;
        else break;
      }
      reading.push(...order.slice(i, j).reverse());
    } else {
      reading.push(order[i]);
    }
    i = j;
  }

  let text = '';
  reading.forEach((run, n) => {
    if (n > 0 && spaced(reading[n - 1], run)) text += ' ';
    text += run.str;
  });
  return text.replace(/ {2,}/g, ' ').replace(PRESENTATION_FORMS, (forms) => {
    const letters = forms.normalize('NFKC');
    return arabicPage ? letters.replace(/[یکھ]/g, (c) => PERSIAN_LOOKALIKES[c]) : letters;
  });
}

/** One string per page, lines inferred from the text positions. */
async function extractPageTexts(bytes: Uint8Array): Promise<string[]> {
  const pdfjsLib = await getPdfJs();
  // A copy: pdf.js hands its data to the worker, which detaches the caller's buffer.
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  try {
    const texts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const runs = content.items.filter((item): item is (typeof content.items)[number] & TextRun => 'str' in item);

      // Lines: a new one when the vertical position changes noticeably, or
      // after pdf.js marks an end of line. An Arabic mark sits above or below
      // its letter, so it never starts a line.
      const lines: TextRun[][] = [];
      let line: TextRun[] = [];
      let lastY: number | null = null;
      for (const run of runs) {
        const y = Array.isArray(run.transform) ? run.transform[5] : undefined;
        const mark = ARABIC_MARKS.test(run.str);
        if (!mark && lastY !== null && typeof y === 'number' && Math.abs(y - lastY) > 2 && line.length) {
          lines.push(line);
          line = [];
        }
        line.push(run);
        if (run.hasEOL && !mark) {
          lines.push(line);
          line = [];
        }
        if (!mark && typeof y === 'number') lastY = y;
      }
      if (line.length) lines.push(line);

      const all = runs.map((run) => run.str).join('');
      const rightToLeftPage = count(all, RIGHT_TO_LEFT) >= count(all, LATIN);
      const arabicPage = !PERSIAN_OR_URDU.test(all.normalize('NFKC'));
      const text = lines
        .map((runsOnLine) =>
          runsOnLine.some((run) => RIGHT_TO_LEFT.test(run.str))
            ? readingOrder(runsOnLine, rightToLeftPage, arabicPage)
            : joinRuns(runsOnLine),
        )
        .map((lineText) => lineText.replace(/\s+$/, ''))
        .filter((lineText) => lineText.trim())
        .join('\n');
      // Chrome maps ’ to U+02BC when the font draws both with one glyph (it
      // fixes it with ActualText, which pdf.js ignores); search needs the ’.
      texts.push(text.replace(/ʼ/g, '’').trim());
    }
    return texts;
  } finally {
    void pdf.destroy().catch(() => undefined);
  }
}

/** Pages joined by a blank line; with pageSeparators (and more than one page) each starts with "--- Page n ---". Empty when no page has text. */
export async function extractText(bytes: Uint8Array, { pageSeparators }: { pageSeparators: boolean }): Promise<string> {
  const pageTexts = await extractPageTexts(bytes);
  if (!pageTexts.some((text) => text.length > 0)) return '';
  if (pageSeparators && pageTexts.length > 1) {
    return pageTexts.map((text, index) => `--- Page ${index + 1} ---\n\n${text}`).join('\n\n');
  }
  return pageTexts.join('\n\n');
}
