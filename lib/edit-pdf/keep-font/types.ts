/**
 * "Keep the font" (keep-font-spec.md): the engine-private data behind
 * LineFont, and the plans the preview and the export share. Types only, no
 * runtime imports (lib/edit-pdf/types.ts imports this with `import type`).
 *
 * Owner: ENGINE. Everything here is plain data (records and arrays, no Maps
 * or class instances) so a LineFont survives structured clone (a future
 * worker export) and compares in tests.
 *
 * Coordinates: LINE SPACE of the source page, as in LineGeometry. s runs
 * along the baseline (s = x*ux + y*uy, user space), p across it; offsets
 * from the baseline are p - geometry.baseline.
 */
import type { HexColor, ReplaceFontChoice } from '../types';

/** One glyph of a detected line exactly as pdf.js drew it (the lines.ts glyph pass, extended with font and code). */
export interface LineGlyph {
  /** pdf.js font id (its loadedName, e.g. "g_d0_f3"). Session-local; the analysis resolves it to a PDF font object. */
  font: string;
  /** The code in the content stream (pdf.js originalCharCode): a glyph id for Identity-H, one byte for a simple or Type3 font. */
  code: number;
  /** pdf.js unicode for the glyph ('' when it has none). */
  text: string;
  /** Glyph width in 1/1000 em, font matrix applied. */
  width: number;
  isSpace: boolean;
  /** Origin in line space: s along the baseline, p ACROSS it (absolute, not relative to the baseline). */
  s: number;
  p: number;
  /** Effective font size along and across the baseline, user units (Tf size, Tz and CTM applied). */
  sx: number;
  sy: number;
  /** Slant of the glyph's vertical axis, tan of the angle (0 upright; Chrome's synthetic italic is about 0.21). */
  skew: number;
  fill: HexColor;
  /** Text render mode (0 fill). */
  mode: number;
}

/** What pdf.js tells about one of its fonts (commonObjs), used to resolve it to a PDF font object. */
export interface PdfjsFontFacts {
  /** pdf.js Font.name: the /BaseFont as written, subset tag included ('' for most Type3 fonts). */
  name: string;
  type3: boolean;
  /** Type0 (two-byte codes). */
  composite: boolean;
  vertical: boolean;
}

/**
 * What kind of PDF font a font object is, for reuse:
 *   std14            non-embedded standard 14 font, WinAnsi or no /Encoding, no /Differences;
 *   simple-truetype  embedded TrueType (FontFile2), one-byte codes;
 *   simple-other     embedded Type1/CFF simple font: only codes harvested from the page are reused;
 *   type3            Type3, one-byte codes, glyphs by /CharProcs (never merged with a TrueType of the same name);
 *   type0-identity   Type0 + CIDFontType2/0, /Encoding Identity-H, CIDToGIDMap Identity or absent: codes are glyph ids;
 *   unsupported      anything else (non-Identity CMaps, vertical, inline font dicts, broken): never reused.
 */
export type PdfFontKind = 'std14' | 'simple-truetype' | 'simple-other' | 'type3' | 'type0-identity' | 'unsupported';

/** A PDF font object of the SOURCE file that the line's glyphs use. */
export interface PdfFontInfo {
  /** `${objectNumber} ${generation}`; `direct:...` for an inline font dictionary (always 'unsupported'). */
  key: string;
  /** -1 for an inline font dictionary. */
  objectNumber: number;
  generation: number;
  kind: PdfFontKind;
  /** /BaseFont as written, subset tag included ("ABCDEF+ArialMT"). */
  baseFont: string;
  /** /BaseFont without the subset tag ("ArialMT"). */
  face: string;
  /** Two-byte codes (Type0 Identity-H). */
  twoByte: boolean;
  /**
   * Recognises the same object in PDFium's output: /Subtype, /BaseFont and the
   * object refs of /ToUnicode, /DescendantFonts and /FontDescriptor. When the
   * output's object with this number has another signature (PDFium dropped
   * the font), the writer copies it from the source with PDFObjectCopier.
   */
  signature: string;
  /** FontDescriptor /Flags (0 when absent), /ItalicAngle, /FontWeight (null when absent): look-alike choice. */
  flags: number;
  italicAngle: number;
  weight: number | null;
  /** Standard 14 name for kind 'std14' (Arial maps to Helvetica, as pdf.js does). */
  std14Name?: string;
}

/** Positional form of an Arabic letter; 'n' = not a joining letter (Latin, digits, punctuation, space); 'm' = a combining mark. */
export type UnitForm = 'isol' | 'init' | 'medi' | 'fina' | 'n' | 'm';

/** One way a face draws a (text, form) unit. */
export interface GlyphEntry {
  /** PdfFontInfo key ("12 0") of the font object holding the glyph. */
  font: string;
  code: number;
  /** 1/1000 em. */
  width: number;
  /** Times seen on the harvested pages (0 for declared-only entries). */
  count: number;
  /** harvest = drawn on a page; tounicode/encoding/cmap = declared by the font object and outline-checked where possible. */
  source: 'harvest' | 'tounicode' | 'encoding' | 'cmap';
  /** `${previousLetter}_${nextLetter}` (logical neighbours, ^ and $ at word ends) -> count: exact-context matching for contextual fonts. */
  contexts: Record<string, number>;
}

/**
 * What one FACE can draw: every font object with the same face name, kind and
 * flags (Chrome's Type0 and Type3 halves of one face stay apart: its
 * synthetic bold is a Type3 with the regular font's name).
 */
export interface FaceInventory {
  /** `${face}|${kind}|${flags}`. */
  key: string;
  face: string;
  /** PdfFontInfo key -> info, for every font object of the face. */
  fonts: Record<string, PdfFontInfo>;
  /** `${text}|${form}` -> entries (text: arabic.ts foldText; a ligature such as لا or "ti" is one unit). */
  units: Record<string, GlyphEntry[]>;
  /** `${font}:${code},${font}:${code}` (visual order) -> median extra gap in em. */
  kern: Record<string, number>;
  /** `${baseFont}:${baseCode},${markFont}:${markCode}` -> median [ds, dp] in em from the base origin. */
  markOffsets: Record<string, [number, number]>;
  /** The face's space glyph, if it has one. */
  space: { font: string; code: number; width: number } | null;
  /** Multi-character units the document showed (لا, لإ, ريال, "ti"), matched greedily. */
  ligatures: string[];
  /** Lam-alef is a mandatory ligature in this face (seen as one glyph, or never seen split). */
  lamAlefLigature: boolean;
  /** Two or more letters drawn with different glyphs in one form: the face has contextual alternates (Amiri); only exact contexts count as exact. */
  contextual: boolean;
  /**
   * The face draws some Arabic letters in pieces whose text is unknown (Chrome
   * writes Noto Naskh's dots as thin glyphs of their own, ToUnicode U+0000): its
   * letter glyphs may be bodies without their dots, so it never draws new
   * Arabic letters (unchanged words are still redrawn as they were).
   */
  arabicInPieces: boolean;
}

/** Why the original font can't be reused for new text at all (reason 'font' in the choice). */
export type ReuseBlock =
  /** A glyph's pdf.js font matched no PDF font object (or more than one with different data). */
  | 'unresolved'
  /** The main face's kind is 'unsupported' (another face's only stops edits to its own words). */
  | 'unsupported-font'
  /** Ink drawn with a render mode other than 0 (synthetic bold by stroking, clipping). */
  | 'render-mode';

/** Shipped look-alike families (lookalike.ts holds their files). */
export type LookalikeFamily =
  | 'Liberation Sans'
  | 'Liberation Serif'
  | 'Liberation Mono'
  | 'Carlito'
  | 'Caladea'
  | 'Noto Sans Arabic'
  | 'Cairo';

/** The look-alike pair picked from the main face's name and descriptor (pickLookalike). */
export interface LookalikePick {
  latin: LookalikeFamily;
  arabic: LookalikeFamily;
  bold: boolean;
  /** Drawn as a 12 degree synthetic oblique (no italic files are shipped). */
  italic: boolean;
  /**
   * The file drawn looks exactly like the original (lookalike.ts
   * withSameFamily): the original face is that family already (Carlito,
   * Liberation, Noto, Cairo), in a weight we ship, upright, and the line's
   * other faces pick the same. Then no note.
   */
  sameFamily: { latin: boolean; arabic: boolean };
}

/** LineFont.data. */
export interface LineFontData {
  version: 1;
  /** pdf.js font id -> PdfFontInfo key, for this line's glyphs. */
  fontKeys: Record<string, string>;
  /** Faces the line uses, the main face (most ink) first. Shared by reference between lines of a session. */
  faces: FaceInventory[];
  /** PdfFontInfo key -> index in `faces`. */
  faceOf: Record<string, number>;
  /** The line's glyphs in s order (marks included). */
  glyphs: LineGlyph[];
  /** The detected line's own frame (LineGeometry): the em that cuts words, and the edges a changed line grows from. */
  line: {
    /** geometry.size. */
    size: number;
    baseline: number;
    start: number;
    end: number;
  };
  /** The line's measured style in its main face. */
  style: {
    /** Median effective size across the baseline (= LineFont.size). */
    size: number;
    /** Median sx / sy (Tz). */
    hscale: number;
    /** Median extra gap between neighbouring glyphs, em (tracking, Tc). */
    extra: number;
    /** Median gap between words of one segment, user units. */
    wordGap: number;
    /** Median slant of the main face's glyphs (synthetic italic), see LineGlyph.skew. */
    skew: number;
  };
  /** Null = the original can be reused for whatever its faces can draw. */
  blocked: ReuseBlock | null;
  lookalike: LookalikePick;
}

/** One glyph of a planned original-font line, ready for the writer. */
export interface PlacedGlyph {
  /** PdfFontInfo key. */
  font: string;
  code: number;
  twoByte: boolean;
  /** Along the baseline (absolute s) and offset from the baseline (p - baseline), user units. */
  s: number;
  p: number;
  /** Tf size for this glyph (verbatim glyphs keep their own sy). */
  size: number;
  /** Horizontal scale (Tz / 100) and slant for this glyph (verbatim glyphs keep their own). */
  hscale: number;
  skew: number;
  /** Advance along the baseline, user units (the ink box of the preview). */
  advance: number;
  fill: HexColor;
  /** Redrawn from the original line (keeps its own fill when the colour was not changed). */
  verbatim: boolean;
  /** A new glyph that keeps `fill` while the colour is unchanged: the word it replaces had that fill of its own. */
  ownFill?: true;
}

/** planLine's result: the new text mapped onto the original glyphs. */
export interface LinePlan {
  /** Every unit (and every mark placement) exists in the faces. */
  ok: boolean;
  /** Decisions not guaranteed to match the producer's shaping (an unseen context in a contextual face, a split ligature): not exact. */
  approx: string[];
  /** What is missing, for tests and logs ("ب.init", "mark ً on ل"). */
  missing: string[];
  glyphs: PlacedGlyph[];
  /** verbatim+reflow = unchanged words redrawn from their own glyphs, changed segments re-flowed; full-relayout = words could not be matched to the prefill. */
  placement: 'verbatim+reflow' | 'full-relayout';
}

/**
 * What both the preview and the export draw for one replace object
 * (choose.ts planReplacement). The same inputs give the same plan.
 */
export type ReplacementPlan =
  | { kind: 'empty'; choice: ReplaceFontChoice; size: number }
  | {
      kind: 'original';
      choice: ReplaceFontChoice;
      size: number;
      hscale: number;
      glyphs: PlacedGlyph[];
      /** Every font object the glyphs use, by PdfFontInfo key (the writer resolves each to a ref). */
      fonts: Record<string, PdfFontInfo>;
    }
  | {
      kind: 'vector';
      choice: ReplaceFontChoice;
      size: number;
      /** Font URLs in stack order (primary first, then its companion); one entry for Cairo. */
      fonts: string[];
      /** 12 degree synthetic oblique. */
      oblique: boolean;
      /** Cairo only because the look-alike did not load: the save fetches it again, so this plan must not be kept. */
      transient?: true;
    }
  | { kind: 'image'; choice: ReplaceFontChoice; size: number; transient?: true };
