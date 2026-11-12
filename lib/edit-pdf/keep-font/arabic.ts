/**
 * "Keep the font": Arabic joining (Unicode ArabicShaping.txt, the letters a
 * document can hold) and presentation-form decoding, for harvesting which
 * glyph a face uses for each (letter, form) and for shaping new text into
 * the same units. Ported from the keep-font spike (scripts/arabic.mts).
 *
 * Owner: ENGINE. Pure, no imports.
 */

/** Joining type: Dual, Right, non-joining (U), join-Causing (tatweel, ZWJ), Transparent (marks). */
export type Joining = 'D' | 'R' | 'U' | 'C' | 'T';
export type Form = 'isol' | 'init' | 'medi' | 'fina';

const RANGES: ReadonlyArray<readonly [number, number, Joining]> = [
  [0x0620, 0x0620, 'D'], [0x0621, 0x0621, 'U'], [0x0622, 0x0625, 'R'], [0x0626, 0x0626, 'D'], [0x0627, 0x0627, 'R'],
  [0x0628, 0x0628, 'D'], [0x0629, 0x0629, 'R'], [0x062a, 0x062e, 'D'], [0x062f, 0x0632, 'R'], [0x0633, 0x063f, 'D'],
  [0x0640, 0x0640, 'C'], [0x0641, 0x0647, 'D'], [0x0648, 0x0648, 'R'], [0x0649, 0x064a, 'D'],
  [0x064b, 0x065f, 'T'], [0x0670, 0x0670, 'T'],
  [0x066e, 0x066f, 'D'], [0x0671, 0x0673, 'R'], [0x0674, 0x0674, 'U'], [0x0675, 0x0677, 'R'], [0x0678, 0x0687, 'D'],
  [0x0688, 0x0699, 'R'], [0x069a, 0x06bf, 'D'], [0x06c0, 0x06c0, 'R'], [0x06c1, 0x06c2, 'D'], [0x06c3, 0x06cb, 'R'],
  [0x06cc, 0x06cc, 'D'], [0x06cd, 0x06cd, 'R'], [0x06ce, 0x06ce, 'D'], [0x06cf, 0x06cf, 'R'], [0x06d0, 0x06d1, 'D'],
  [0x06d2, 0x06d3, 'R'], [0x06d5, 0x06d5, 'R'], [0x06d6, 0x06ed, 'T'], [0x06ee, 0x06ef, 'R'], [0x06fa, 0x06fc, 'D'], [0x06ff, 0x06ff, 'D'],
  [0x200d, 0x200d, 'C'],
];

export function joining(ch: string | undefined): Joining {
  if (!ch) return 'U';
  const cp = ch.codePointAt(0)!;
  for (const [a, b, j] of RANGES) if (cp >= a && cp <= b) return j;
  if (/\p{Mn}/u.test(ch)) return 'T';
  return 'U';
}

export const isArabicLetter = (ch: string): boolean => {
  const j = joining(ch);
  return j === 'D' || j === 'R' || (j === 'U' && /[ءٴ]/.test(ch));
};

/** A combining mark (harakat, Quranic marks, any Mn). */
export const isMarkChar = (ch: string): boolean => joining(ch) === 'T' || /^\p{M}$/u.test(ch);

export const ALEFS: ReadonlySet<string> = new Set(['آ', 'أ', 'إ', 'ا']);

export const hasArabic = (s: string): boolean => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻾]/.test(s);

/** Compatibility characters that ARE what they decompose to: Arabic presentation forms (ﷲ included) and the Latin ligatures ﬀ to ﬆ. */
const FOLDED = /[\uFB00-\uFB06\uFB50-\uFDFF\uFE70-\uFEFF]/g;

/**
 * The text a glyph or a typed character is keyed by: NFC, with only the
 * characters above folded (NFKC). Never NFKC as a whole: it would make ² a
 * 2, º an o and ™ "TM", so a typed 2 could be drawn with the superscript.
 */
export function foldText(text: string): string {
  return text.replace(FOLDED, (c) => c.normalize('NFKC')).normalize('NFC');
}

/** The marks whose placement on a CHANGED word can't be reproduced reliably (planReplacement sends such a line to the look-alike). */
export const ARABIC_MARK = /[ً-ٰٟۖ-ۭ]/;

/** Presentation form code point -> { base (NFKC), form }. */
const PRES = new Map<number, { base: string; form: Form }>();
(function build() {
  // Each base letter's forms are consecutive, ordered isol, fina, init, medi.
  const ranges: Array<[number, number]> = [
    [0xfe80, 0xfefc],
    [0xfb50, 0xfbb1],
    [0xfbd3, 0xfbe9],
    [0xfbfc, 0xfbff],
  ];
  const order: Form[] = ['isol', 'fina', 'init', 'medi'];
  for (const [a, b] of ranges) {
    let cp = a;
    while (cp <= b) {
      const base = String.fromCodePoint(cp).normalize('NFKC');
      let n = 1;
      while (cp + n <= b && String.fromCodePoint(cp + n).normalize('NFKC') === base && n < 4) n++;
      for (let k = 0; k < n; k++) PRES.set(cp + k, { base, form: order[k] });
      cp += n;
    }
  }
  // The one pair that breaks the order: Uighur alef maksura has only an initial and a medial form.
  PRES.set(0xfbe8, { base: 'ى', form: 'init' });
  PRES.set(0xfbe9, { base: 'ى', form: 'medi' });
})();

/** The base letter(s) and positional form a presentation-form character stands for; null for anything else. */
export function presentationForm(ch: string): { base: string; form: Form } | null {
  if ([...ch].length !== 1) return null;
  return PRES.get(ch.codePointAt(0)!) ?? null;
}

/**
 * Fonts often draw two forms of a letter with one glyph, and a reverse cmap
 * then names only the first of them: an initial glyph that also serves the
 * medial form (Arial's beh), an isolated one that also serves the final form
 * (a right-joining reh). A glyph whose own presentation form is `own` may be
 * filed under `used` only when they are the same form or one of those pairs.
 */
export function formServes(own: Form, used: Form): boolean {
  return own === used || (own === 'init' && used === 'medi') || (own === 'isol' && used === 'fina');
}

export function formOf(joinsPrev: boolean, joinsNext: boolean): Form {
  if (joinsPrev && joinsNext) return 'medi';
  if (joinsPrev) return 'fina';
  if (joinsNext) return 'init';
  return 'isol';
}

/** Characters of a unit's text that take part in joining (marks dropped). */
export function joiningChars(text: string): string[] {
  return [...text].filter((c) => !isMarkChar(c));
}

export const canJoinNext = (ch: string | undefined): boolean => {
  const j = joining(ch);
  return j === 'D' || j === 'C';
};

export const canJoinPrev = (ch: string | undefined): boolean => {
  const j = joining(ch);
  return j === 'D' || j === 'R' || j === 'C';
};

/** A right-joining unit (alef, dal, reh, waw, lam-alef...) has no initial or medial form: those collapse to isolated and final. */
export function collapseForm(text: string, form: Form): Form {
  const jc = joiningChars(text);
  if (canJoinNext(jc[jc.length - 1])) return form;
  return form === 'init' ? 'isol' : form === 'medi' ? 'fina' : form;
}

/** A shaped unit of new text in LOGICAL order; marks ride on their base unit. */
export interface Unit {
  /** One letter, a lam-alef or another seen ligature, or one non-Arabic character. */
  text: string;
  form: Form | 'n';
  marks: string[];
  /** Index (code points) in the logical string. */
  start: number;
}

/**
 * Shape logical text into units: Arabic letters get a positional form from
 * their logical neighbours (marks are transparent; joining stops at anything
 * that is not a letter). `ligatures` (letter sequences the document's own
 * glyphs show as one glyph) are matched greedily, longest first; lam + alef
 * is one unit only when `lamAlefLigature`. Everything else is one unit per
 * code point, form 'n'.
 */
export function shapeUnits(text: string, ligatures: readonly string[] = [], lamAlefLigature = true): Unit[] {
  const chars = [...text];
  const units: Unit[] = [];
  const known = new Set(ligatures);
  const maxLig = Math.max(2, ...ligatures.map((l) => [...l].length));
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (isMarkChar(ch) && units.length > 0) {
      units[units.length - 1].marks.push(ch);
      continue;
    }
    let matched = false;
    for (let length = Math.min(maxLig, chars.length - i); length >= 2 && !matched; length--) {
      const seq = chars.slice(i, i + length).join('');
      if (known.has(seq)) {
        units.push({ text: seq, form: hasArabic(seq) ? 'isol' : 'n', marks: [], start: i });
        i += length - 1;
        matched = true;
      }
    }
    if (matched) continue;
    if (ch === 'ل' && lamAlefLigature) {
      let j = i + 1;
      const marks: string[] = [];
      while (j < chars.length && isMarkChar(chars[j])) marks.push(chars[j++]);
      if (j < chars.length && ALEFS.has(chars[j])) {
        units.push({ text: ch + chars[j], form: 'isol', marks, start: i });
        i = j;
        continue;
      }
    }
    units.push({ text: ch, form: joining(ch) === 'U' && !isArabicLetter(ch) ? 'n' : 'isol', marks: [], start: i });
  }
  assignForms(units);
  return units;
}

/** Give every Arabic unit its positional form from its logical neighbours (in place). */
export function assignForms(units: Unit[]): void {
  for (let k = 0; k < units.length; k++) {
    const u = units[k];
    if (u.form === 'n') continue;
    const jc = joiningChars(u.text);
    const prev = units[k - 1];
    const next = units[k + 1];
    const prevLast = prev && prev.form !== 'n' ? joiningChars(prev.text).slice(-1)[0] : undefined;
    const nextFirst = next && next.form !== 'n' ? joiningChars(next.text)[0] : undefined;
    const joinsPrev = canJoinNext(prevLast) && canJoinPrev(jc[0]);
    const joinsNext = canJoinNext(jc[jc.length - 1]) && canJoinPrev(nextFirst);
    u.form = formOf(joinsPrev, joinsNext);
  }
}
