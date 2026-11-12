/**
 * The closest-match fonts for a replaced line whose own font can't draw the
 * new text (keep-font-spec.md section 5). Self-hosted under public/fonts,
 * each next to its licence file, fetched lazily (font.ts loadFontFile) only
 * when the original font fails. Never a CDN.
 *
 * Owner: ENGINE. Pure: no imports with side effects, safe in Node tests.
 *
 * Amiri is deliberately absent: pdf-lib 1.17.1's subsetter breaks it (only
 * one or two glyphs render). So is Noto Naskh Arabic: it draws the dots of
 * most letters as glyphs of their own and shares one dotless glyph between
 * letters (ب ت ث ن ي), so a PDF can't map its glyphs back to text (one
 * ToUnicode entry per glyph) and the saved line could not be copied or
 * searched. Every Arabic look-alike draws each letter in each form as one
 * glyph of its own (tests/edit-pdf-keep-font-guards.test.ts checks it).
 * Italic files are not shipped: italic lines get a 12 degree synthetic
 * oblique (and the note, since that is not the italic). Cairo has no bold.
 */
import { CAIRO_FONT_URL } from '@/lib/pdf-text/constants';
import type { LookalikeFamily, LookalikePick } from './types';

export interface LookalikeFiles {
  regular: string;
  /** Absent: bold lines use the regular file. */
  bold?: string;
  /** Scripts the family covers: a font stack pairs an Arabic-only family with a Latin companion. */
  covers: 'latin' | 'arabic' | 'both';
  /** Width fit for a line whose prefill was unsure (nothing to measure), like REPLACE_FIT_UNSURE for Cairo. */
  unsureFit: number;
  /** The licence file served next to the font (OFL 1.1 or Apache 2.0). */
  licence: string;
  /** The upstream release shipped, as its name table says (tests check the files are these, unmodified). */
  version: string;
}

/** Every shipped look-alike. tests/edit-pdf-keep-font-guards.test.ts (guard (a)) checks each file, its licence and its version. */
export const LOOKALIKE_FONTS: Readonly<Record<LookalikeFamily, LookalikeFiles>> = {
  'Liberation Sans': {
    regular: '/fonts/LiberationSans-Regular.ttf',
    bold: '/fonts/LiberationSans-Bold.ttf',
    covers: 'latin',
    unsureFit: 1,
    licence: '/fonts/OFL-LiberationSans.txt',
    version: 'Version 2.1.5',
  },
  'Liberation Serif': {
    regular: '/fonts/LiberationSerif-Regular.ttf',
    bold: '/fonts/LiberationSerif-Bold.ttf',
    covers: 'latin',
    unsureFit: 1,
    licence: '/fonts/OFL-LiberationSerif.txt',
    version: 'Version 2.1.5',
  },
  'Liberation Mono': {
    regular: '/fonts/LiberationMono-Regular.ttf',
    bold: '/fonts/LiberationMono-Bold.ttf',
    covers: 'latin',
    unsureFit: 1,
    licence: '/fonts/OFL-LiberationMono.txt',
    version: 'Version 2.1.5',
  },
  Carlito: { regular: '/fonts/Carlito-Regular.ttf', bold: '/fonts/Carlito-Bold.ttf', covers: 'latin', unsureFit: 1, licence: '/fonts/OFL-Carlito.txt', version: 'Version 1.103' },
  // Cambria Bold is Word 2007-2010's heading font.
  Caladea: { regular: '/fonts/Caladea-Regular.ttf', bold: '/fonts/Caladea-Bold.ttf', covers: 'latin', unsureFit: 1, licence: '/fonts/LICENSE-Caladea.txt', version: 'Version 1.002' },
  'Noto Sans Arabic': {
    regular: '/fonts/NotoSansArabic-Regular.ttf',
    bold: '/fonts/NotoSansArabic-Bold.ttf',
    covers: 'arabic',
    unsureFit: 0.85,
    licence: '/fonts/OFL-NotoSansArabic.txt',
    version: 'Version 2.010',
  },
  Cairo: { regular: CAIRO_FONT_URL, covers: 'both', unsureFit: 0.85, licence: '/fonts/OFL-Cairo.txt', version: 'Version 3.130' },
};

/** Synthetic oblique for italic lines, in degrees. */
export const OBLIQUE_DEGREES = 12;

/** PDF 32000 table 123, 1-based bits: 1 FixedPitch, 2 Serif, 7 Italic, 19 ForceBold. */
const FIXED_PITCH = 1 << 0;
const SERIF = 1 << 1;
const ITALIC = 1 << 6;
const FORCE_BOLD = 1 << 18;

const SAME_FAMILY: Array<[RegExp, LookalikeFamily]> = [
  [/^liberationsans/, 'Liberation Sans'],
  [/^liberationserif/, 'Liberation Serif'],
  [/^liberationmono/, 'Liberation Mono'],
  [/^carlito/, 'Carlito'],
  [/^caladea/, 'Caladea'],
  [/^notosansarabic/, 'Noto Sans Arabic'],
  [/^cairo/, 'Cairo'],
];

const compact = (baseFont: string) => baseFont.replace(/^[A-Z]{6}\+/, '').toLowerCase().replace(/[\s_,-]/g, '');

/** The shipped family a /BaseFont already is (a LibreOffice Liberation Sans, a Carlito...), if any. */
export function ownFamily(baseFont: string): LookalikeFamily | undefined {
  const n = compact(baseFont);
  return SAME_FAMILY.find(([pattern]) => pattern.test(n))?.[1];
}

/**
 * pick.sameFamily: the file drawn looks exactly like the original, so no
 * note: the original IS that family (`own`), the weight is shipped (a bold
 * line needs a bold file), the line is not italic (the oblique regular is
 * not the italic), and every face of the line picks the same (`uniform`:
 * a bold label on a regular line would come out regular).
 */
export function withSameFamily(pick: LookalikePick, own: LookalikeFamily | undefined, uniform = true): LookalikePick {
  const faithful = (family: LookalikeFamily) => uniform && own === family && !pick.italic && (!pick.bold || !!LOOKALIKE_FONTS[family].bold);
  return { ...pick, sameFamily: { latin: faithful(pick.latin), arabic: faithful(pick.arabic) } };
}

/**
 * The look-alike pair for a face, from its /BaseFont (subset tag allowed) and
 * FontDescriptor. Ported from the keep-font spike (scripts/lookalike-pick.mts).
 */
export function pickLookalike(baseFont: string, flags = 0, weight: number | null = null, italicAngle = 0): LookalikePick {
  const n = compact(baseFont);
  const bold = /bold|black|heavy|semibold|demi/.test(n) || (weight ?? 0) >= 600 || (flags & FORCE_BOLD) !== 0;
  const italic = /italic|oblique/.test(n) || (flags & ITALIC) !== 0 || italicAngle !== 0;
  let latin: LookalikeFamily = 'Liberation Sans';
  let arabic: LookalikeFamily = 'Noto Sans Arabic';
  if (/carlito|calibri/.test(n)) latin = 'Carlito';
  else if (/caladea|cambria/.test(n)) latin = 'Caladea';
  else if (/courier|mono|consolas|menlo/.test(n) || (flags & FIXED_PITCH) !== 0) latin = 'Liberation Mono';
  else if (
    /times|tinos|liberationserif|georgia|garamond|book|serif|minion|palatino/.test(n) ||
    ((flags & SERIF) !== 0 && !/arial|helvetica|sans|calibri|tahoma|segoe|verdana/.test(n))
  ) {
    latin = 'Liberation Serif';
  }
  if (/cairo/.test(n)) {
    latin = 'Cairo';
    arabic = 'Cairo';
  }
  return withSameFamily({ latin, arabic, bold, italic, sameFamily: { latin: false, arabic: false } }, ownFamily(baseFont));
}

/** The file for a family and weight. */
export function lookalikeFile(family: LookalikeFamily, bold: boolean): string {
  const files = LOOKALIKE_FONTS[family];
  return (bold && files.bold) || files.regular;
}
