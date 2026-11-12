/**
 * The edit field's prefill for a detected line: the line's text in LOGICAL
 * order, rebuilt from the glyphs as they are drawn (visual order, left to
 * right). Pure string work, no pdf.js: ./lines.ts collects the glyphs.
 * Reached only through import() (from ./lines).
 *
 * Why glyph by glyph and not pdf.js's own getTextContent string: pdf.js
 * reverses an RTL item character by character, so a ligature glyph whose
 * ToUnicode is "لا" (Chrome writes lam-alef that way) comes out as "ال".
 * Reversing whole GLYPHS keeps each glyph's own string intact.
 */
import type { Direction } from './types';

/** Hebrew, Arabic, Syriac, Thaana, NKo, and the Hebrew/Arabic presentation forms. */
const RTL_LETTER = /[֐-ࣿיִ-﷿ﹰ-﻾]/;
/** Latin letters (basic, Latin-1, Extended-A/B), Greek and Cyrillic: they read left to right. */
const LTR_LETTER = /[A-Za-zÀ-ɏͰ-ϿЀ-ӿ]/;
/** European, Arabic-Indic and extended Arabic-Indic digits. Numbers always read left to right, also in an RTL line. */
const DIGIT = /[0-9٠-٩۰-۹]/;
/** Characters that stick to a number next to them (UAX #9 ET, W5): 15% and $20 stay one left-to-right run. */
const NUMBER_AFFIX = /^[%٪‰$€£#°±+]$/;
/** Format and control characters a prefill never shows (bidi marks, ZWSP, BOM, soft hyphen, C0 controls). */
const CONTROLS = /[\u0000-\u0008\u000b-\u001f\u007f­​-‏‪-‮⁦-⁩﻿]/g;
/** C0 controls in what a glyph maps to: its ToUnicode entry is broken. */
const C0 = /[\u0000-\u0008\u000b-\u001f]/;
/** Dotless bases and detached hamza: the dots were drawn as separate glyphs, so the letters can't be trusted. U+FFFD: no mapping. */
const BROKEN_ARABIC = /[ٮٯڡںٕٔ�]/;

/**
 * Letters only Persian or Urdu write, in shapes no Arabic letter has (keheh
 * counts only isolated or final: its initial and medial share Arabic kaf's
 * glyph in many fonts). Checked on NFKC text with keheh's joined forms
 * (U+FB90, U+FB91) taken out first.
 */
const PERSIAN_ONLY = /[پچژگکںہۃےۓٹڈڑ]/;
/** Letters Persian and Urdu don't write: teh marbuta, Arabic kaf, Arabic yeh, alef maksura. */
const ARABIC_ONLY = /[ةكيى]/;

/** 'arabic' or 'persian' when the text's letters say which, else null (no Arabic letters, or only shared ones). */
export function arabicScriptLanguage(text: string): 'arabic' | 'persian' | null {
  const letters = text.replace(/[ﮐﮑ]/g, '').normalize('NFKC');
  if (PERSIAN_ONLY.test(letters)) return 'persian';
  return ARABIC_ONLY.test(letters) ? 'arabic' : null;
}

/** Persian/Urdu presentation forms whose glyph a font shares with an Arabic letter's form -> that Arabic form. */
const ARABIC_FORM: Record<string, string> = {
  // Heh doachashmee (U+FBAA-FBAD, U+06BE) -> heh, form for form.
  'ﮪ': 'ﻩ',
  'ﮫ': 'ﻪ',
  'ﮬ': 'ﻫ',
  'ﮭ': 'ﻬ',
  'ھ': 'ه',
  // Farsi yeh (U+FBFC-FBFF): dotless when isolated or final (alef maksura), dotted when joined (yeh).
  'ﯼ': 'ﻯ',
  'ﯽ': 'ﻰ',
  'ﯾ': 'ﻳ',
  'ﯿ': 'ﻴ',
};

/**
 * An ARABIC line whose producer named some letters by their Persian
 * look-alikes, read back as Arabic. Chrome writes a font's reverse cmap into
 * ToUnicode, and Times New Roman draws heh and heh doachashmee (and yeh and
 * Farsi yeh) with one glyph, so "لديها" comes out as "لدیھا": the edit field
 * would show it, the saved line would keep it, and nobody searching with an
 * Arabic keyboard would find the word. Presentation forms map form for form;
 * a bare Farsi yeh is yeh when a letter follows it in its word, else alef
 * maksura (its dotless final shape). Logical order in, logical order out.
 */
export function arabicLetters(text: string): string {
  return text
    .replace(/[ﮪﮫﮬﮭھﯼﯽﯾﯿ]/g, (c) => ARABIC_FORM[c])
    .replace(/ی(?=[ؠ-يٮ-ۓﭐ-﷿ﹰ-ﻼ])/g, 'ي')
    .replace(/ی/g, 'ى');
}

/** Text shown in the edit field: NFKC (presentation forms back to letters), controls dropped, spaces collapsed. */
export function prefillText(text: string): string {
  return text.normalize('NFKC').replace(CONTROLS, '').replace(/\s+/g, ' ').trim();
}

/** The line's paragraph direction: RTL when it has more right-to-left letters than left-to-right ones; `fallback` when it has no letters at all. */
export function strongDirection(text: string, fallback: Direction = 'ltr'): Direction {
  let rtl = 0;
  let ltr = 0;
  for (const ch of text) {
    if (DIGIT.test(ch)) continue;
    if (RTL_LETTER.test(ch)) rtl++;
    else if (LTR_LETTER.test(ch)) ltr++;
  }
  if (rtl === 0 && ltr === 0) return fallback;
  return rtl > ltr ? 'rtl' : 'ltr';
}

type Strong = 'L' | 'R';
type Kind = Strong | 'N';

function kindOf(piece: string): Kind {
  if (DIGIT.test(piece) && !hasRtlLetter(piece)) return 'L';
  if (hasRtlLetter(piece)) return 'R';
  if (LTR_LETTER.test(piece)) return 'L';
  return 'N';
}

/** An RTL letter, not counting Arabic-Indic digits (they sit inside the Arabic block but read left to right). */
function hasRtlLetter(text: string): boolean {
  for (const ch of text) if (RTL_LETTER.test(ch) && !DIGIT.test(ch)) return true;
  return false;
}

/**
 * A glyph's own string as the reader means it. A lam-alef ligature stored
 * as "ال" (alef first) was written for viewers that reverse RTL text
 * character by character (BlendPDF's own lib/pdf-text does this), so it is
 * turned back to "لا" here, where glyphs are reversed whole.
 */
function glyphString(text: string): string {
  return /^[اأإآ]ل$/.test(text) ? `ل${text[0]}` : text;
}

/**
 * Pieces drawn left to right (glyph strings, or pdf.js item strings, with
 * ' ' where the line has a visible gap) in logical order, for a line of
 * paragraph direction `base`. A small inverse of UAX #9 for one line:
 * letters are strong, digits read left to right, a number's % or $ goes with
 * the number, and a run of neutrals (spaces, punctuation) takes the
 * direction of the strong pieces on both sides when they agree, else the
 * paragraph's. Each right-to-left run is reversed piece by piece; the runs
 * themselves are reversed in an RTL paragraph.
 */
export function logicalOrder(pieces: readonly string[], base: Direction): string {
  const strings = pieces.map(glyphString);
  const kinds: Kind[] = strings.map(kindOf);
  // W5: a number affix next to a digit belongs to the number.
  for (let i = 0; i < strings.length; i++) {
    if (kinds[i] !== 'N' || !NUMBER_AFFIX.test(strings[i])) continue;
    if (DIGIT.test(strings[i - 1] ?? '') || DIGIT.test(strings[i + 1] ?? '')) kinds[i] = 'L';
  }
  // N1/N2: neutrals between two strong pieces of the same direction take it; any other neutral takes the paragraph's.
  const edge: Strong = base === 'rtl' ? 'R' : 'L';
  const resolved: Strong[] = [];
  for (let i = 0; i < kinds.length; ) {
    if (kinds[i] !== 'N') {
      resolved.push(kinds[i] as Strong);
      i++;
      continue;
    }
    let j = i;
    while (j < kinds.length && kinds[j] === 'N') j++;
    const before = i > 0 ? resolved[i - 1] : edge;
    const after = j < kinds.length ? (kinds[j] as Strong) : edge;
    const level = before === after ? before : edge;
    for (let k = i; k < j; k++) resolved.push(level);
    i = j;
  }
  const runs: Array<{ dir: Strong; pieces: string[] }> = [];
  resolved.forEach((dir, i) => {
    const last = runs[runs.length - 1];
    if (last && last.dir === dir) last.pieces.push(strings[i]);
    else runs.push({ dir, pieces: [strings[i]] });
  });
  const ordered = runs.map(({ dir, pieces: run }) => (dir === 'R' ? [...run].reverse() : run).join(''));
  return (base === 'rtl' ? ordered.reverse() : ordered).join('');
}

/**
 * Does the rebuilt prefill look unreliable, so the field should start empty
 * and ask the visitor to type the line? Called on the NFKC text BEFORE
 * controls are stripped (a control there means a broken ToUnicode entry).
 */
export function prefillLooksBroken(text: string): boolean {
  if (text.trim() === '') return true;
  if (BROKEN_ARABIC.test(text)) return true;
  if (C0.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  const arabicSingles = words.filter((word) => /^[؀-ۿ]$/.test(word)).length;
  // Letters scattered as one-letter "words": the producer placed glyphs one by one with gaps.
  if (arabicSingles >= 3 && arabicSingles / words.length > 0.2) return true;
  const letters = [...text].filter((ch) => /\p{L}/u.test(ch));
  let doubled = 0;
  for (let i = 1; i < letters.length; i++) if (letters[i] === letters[i - 1]) doubled++;
  // Every glyph drawn twice (a text shadow, fake bold by overprinting).
  return letters.length > 6 && doubled / letters.length > 0.3;
}
