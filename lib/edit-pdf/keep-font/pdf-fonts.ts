/**
 * "Keep the font": the PDF font objects of the SOURCE file, read with
 * pdf-lib (keep-font-spec.md section 2): kind, BaseFont, ToUnicode, widths,
 * descriptor, embedded program, and a signature that recognises the same
 * object in PDFium's output. Fonts are found from each page's resources and
 * from the resources of the form XObjects it draws (depth <= 6).
 *
 * Standard 14 metrics and the WinAnsi encoding come from pdf-lib's exported
 * StandardFontEmbedder (pinned by guard (d) in
 * tests/edit-pdf-keep-font-guards.test.ts), never from the transitive
 * @pdf-lib/standard-fonts directly.
 *
 * Owner: ENGINE. Reached only through import() (./analyze, ./write).
 */
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFStream, StandardFontEmbedder, decodePDFRawStream } from 'pdf-lib';
import type { PDFContext, PDFDocument, PDFObject } from 'pdf-lib';
import type { PdfFontInfo, PdfFontKind } from './types';

/** A source font object with everything the inventories need (session-private; LineFont carries only PdfFontInfo). */
export interface SourceFont {
  info: PdfFontInfo;
  /** The object in the source document; null for an inline font dictionary (never reused). */
  ref: PDFRef | null;
  /** Code -> Unicode text, from /ToUnicode. */
  toUnicode: Map<number, string>;
  /** Code -> width in 1/1000 em (Type3: FontMatrix applied). */
  widths: Map<number, number>;
  /** /DW of a Type0 font, /MissingWidth of a simple one; null when absent. */
  defaultWidth: number | null;
  /** Embedded program bytes (FontFile2 / FontFile3 / FontFile), decoded. */
  program?: Uint8Array;
  /** Simple fonts: /Encoding name or /BaseEncoding, and /Differences. */
  baseEncoding?: string;
  differences?: Map<number, string>;
  /** Type3: glyph names that have a /CharProcs entry. */
  charProcs?: Set<string>;
  /**
   * Every name pdf.js may report for this object (normalised, see
   * normFontName): /BaseFont, the descendant's /BaseFont of a Type0 (the
   * Type0's own may carry a "-Identity-H" suffix), the descriptor's
   * /FontName (pdf.js prefers it when it differs), "Type3" for a Type3
   * without a descriptor.
   */
  names: string[];
}

/** A font name as the resolver compares it: no spaces, commas, hyphens or underscores, lower case (pdf.js turns "Arial,Bold" into "Arial-Bold"). */
export const normFontName = (name: string): string => name.replace(/[\s,_-]/g, '').toLowerCase();

const STD14_LATIN = new Set([
  'Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique', 'Helvetica-BoldOblique',
  'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
  'Courier', 'Courier-Bold', 'Courier-Oblique', 'Courier-BoldOblique',
]);

/** Non-embedded names viewers draw with a standard 14 font (PDF 32000 Annex D, and what pdf.js maps). */
const STD14_ALIASES: Record<string, string> = {
  Arial: 'Helvetica',
  ArialMT: 'Helvetica',
  'Arial,Bold': 'Helvetica-Bold',
  'Arial-BoldMT': 'Helvetica-Bold',
  'Arial,Italic': 'Helvetica-Oblique',
  'Arial-ItalicMT': 'Helvetica-Oblique',
  'Arial,BoldItalic': 'Helvetica-BoldOblique',
  'Arial-BoldItalicMT': 'Helvetica-BoldOblique',
  TimesNewRoman: 'Times-Roman',
  TimesNewRomanPSMT: 'Times-Roman',
  'TimesNewRoman,Bold': 'Times-Bold',
  'TimesNewRomanPS-BoldMT': 'Times-Bold',
  'TimesNewRoman,Italic': 'Times-Italic',
  'TimesNewRomanPS-ItalicMT': 'Times-Italic',
  'TimesNewRoman,BoldItalic': 'Times-BoldItalic',
  'TimesNewRomanPS-BoldItalicMT': 'Times-BoldItalic',
  CourierNew: 'Courier',
  CourierNewPSMT: 'Courier',
  'CourierNew,Bold': 'Courier-Bold',
  'CourierNewPS-BoldMT': 'Courier-Bold',
};

const SUBSET_TAG = /^[A-Z]{6}\+/;

export const faceName = (baseFont: string): string => baseFont.replace(SUBSET_TAG, '');

/** The key LineFontData and the inventories use for a font object. */
export function fontKeyOf(ref: PDFRef | null, fallback: string): string {
  return ref ? `${ref.objectNumber} ${ref.generationNumber}` : `direct:${fallback}`;
}

function lookup(context: PDFContext, value: PDFObject | undefined): PDFObject | undefined {
  return value instanceof PDFRef ? context.lookup(value) : value;
}

function get(context: PDFContext, dict: PDFDict | undefined, key: string): PDFObject | undefined {
  return dict ? lookup(context, dict.get(PDFName.of(key))) : undefined;
}

const nameOf = (value: PDFObject | undefined): string | undefined => (value instanceof PDFName ? value.decodeText() : undefined);
const numberOf = (value: PDFObject | undefined): number | undefined => (value instanceof PDFNumber ? value.asNumber() : undefined);

/** A stream's decoded bytes, or undefined when it can't be decoded. */
export function streamBytes(value: PDFObject | undefined): Uint8Array | undefined {
  try {
    if (value instanceof PDFRawStream) return decodePDFRawStream(value).decode();
    if (value instanceof PDFStream) return value.getContents();
  } catch {
    // an unsupported filter: treat as absent
  }
  return undefined;
}

const latin1 = (bytes: Uint8Array): string => {
  let out = '';
  for (let i = 0; i < bytes.length; i += 8192) out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return out;
};

function utf16Hex(hex: string): string {
  if (hex.length <= 2) return hex.length === 0 ? '' : String.fromCharCode(parseInt(hex, 16));
  const units: number[] = [];
  for (let i = 0; i + 4 <= hex.length; i += 4) units.push(parseInt(hex.slice(i, i + 4), 16));
  return String.fromCharCode(...units);
}

/** A ToUnicode CMap: code -> text (bfchar and bfrange, both range forms). */
export function parseToUnicode(bytes: Uint8Array): Map<number, string> {
  const text = latin1(bytes);
  const map = new Map<number, string>();
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g)) map.set(parseInt(m[1], 16), utf16Hex(m[2]));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const m of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]*)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (!(hi >= lo) || hi - lo > 0xffff) continue;
      if (m[3] !== undefined) {
        const units: number[] = [];
        if (m[3].length <= 2) units.push(parseInt(m[3] || '0', 16));
        else for (let i = 0; i + 4 <= m[3].length; i += 4) units.push(parseInt(m[3].slice(i, i + 4), 16));
        for (let c = lo; c <= hi; c++) {
          const u = [...units];
          u[u.length - 1] += c - lo;
          map.set(c, String.fromCharCode(...u));
        }
      } else if (m[4] !== undefined) {
        [...m[4].matchAll(/<([0-9A-Fa-f]*)>/g)].forEach((item, k) => {
          if (lo + k <= hi) map.set(lo + k, utf16Hex(item[1]));
        });
      }
    }
  }
  return map;
}

/** /W of a CIDFont: cid -> width. */
function parseCidWidths(context: PDFContext, w: PDFObject | undefined, out: Map<number, number>): void {
  if (!(w instanceof PDFArray)) return;
  const items = w.asArray().map((item) => lookup(context, item));
  for (let i = 0; i < items.length; ) {
    const first = numberOf(items[i]);
    const next = items[i + 1];
    if (first === undefined) break;
    if (next instanceof PDFArray) {
      next.asArray().forEach((value, k) => {
        const width = numberOf(lookup(context, value));
        if (width !== undefined) out.set(first + k, width);
      });
      i += 2;
    } else {
      const last = numberOf(next);
      const width = numberOf(items[i + 2]);
      if (last === undefined || width === undefined || last - first > 0xffff) break;
      for (let c = first; c <= last; c++) out.set(c, width);
      i += 3;
    }
  }
}

function refString(value: PDFObject | undefined): string {
  if (value instanceof PDFRef) return value.toString();
  if (value === undefined) return '-';
  return value instanceof PDFArray ? `[${value.asArray().map(refString).join(',')}]` : 'direct';
}

/**
 * What identifies a font object across PDFium's rewrite: /Subtype,
 * /BaseFont, the refs of /ToUnicode, /DescendantFonts, /FontDescriptor and
 * /CharProcs, the descriptor's /FontName and the refs of its program
 * streams, and whether those streams are really there. Equal signatures in
 * the source and at the same object number in the output = PDFium kept the
 * font, so the new text can point at it.
 */
export function fontSignature(context: PDFContext, dict: PDFDict): string {
  const raw = (key: string) => dict.get(PDFName.of(key));
  const parts = [
    nameOf(get(context, dict, 'Subtype')) ?? '-',
    nameOf(get(context, dict, 'BaseFont')) ?? '-',
    refString(raw('ToUnicode')),
    refString(raw('DescendantFonts')),
    refString(raw('FontDescriptor')),
    refString(raw('CharProcs')),
  ];
  let holder: PDFDict | undefined = dict;
  const descendants = get(context, dict, 'DescendantFonts');
  if (descendants instanceof PDFArray) {
    const d0 = lookup(context, descendants.get(0));
    holder = d0 instanceof PDFDict ? d0 : undefined;
    if (holder) parts.push(refString(holder.get(PDFName.of('FontDescriptor'))), refString(holder.get(PDFName.of('CIDToGIDMap'))));
  }
  const descriptor = get(context, holder, 'FontDescriptor');
  if (descriptor instanceof PDFDict) {
    parts.push(nameOf(get(context, descriptor, 'FontName')) ?? '-');
    for (const key of ['FontFile', 'FontFile2', 'FontFile3']) {
      const value = descriptor.get(PDFName.of(key));
      if (value === undefined) continue;
      parts.push(`${key}=${refString(value)}:${lookup(context, value) instanceof PDFStream ? 'S' : 'missing'}`);
    }
  }
  const toUnicode = raw('ToUnicode');
  if (toUnicode !== undefined) parts.push(lookup(context, toUnicode) instanceof PDFStream ? 'TU' : 'TU-missing');
  return parts.join('|');
}

/** Read one font object. Anything unexpected makes it 'unsupported' (never reused), never throws. */
export function readFont(doc: PDFDocument, ref: PDFRef | null, dict: PDFDict, fallbackName: string): SourceFont {
  const { context } = doc;
  const subtype = nameOf(get(context, dict, 'Subtype')) ?? '';
  let baseFont = nameOf(get(context, dict, 'BaseFont')) ?? '';
  const toUnicodeBytes = streamBytes(get(context, dict, 'ToUnicode'));
  let toUnicode = new Map<number, string>();
  try {
    if (toUnicodeBytes) toUnicode = parseToUnicode(toUnicodeBytes);
  } catch {
    toUnicode = new Map();
  }
  const widths = new Map<number, number>();
  let defaultWidth: number | null = null;
  let kind: PdfFontKind = 'unsupported';
  let twoByte = false;
  let holder: PDFDict | undefined = dict;
  let baseEncoding: string | undefined;
  let differences: Map<number, string> | undefined;
  let charProcs: Set<string> | undefined;
  let std14Name: string | undefined;

  if (subtype === 'Type0') {
    twoByte = true;
    const encoding = nameOf(get(context, dict, 'Encoding'));
    const descendants = get(context, dict, 'DescendantFonts');
    const d0 = descendants instanceof PDFArray ? lookup(context, descendants.get(0)) : undefined;
    if (d0 instanceof PDFDict) {
      holder = d0;
      const cidSubtype = nameOf(get(context, d0, 'Subtype'));
      const c2g = get(context, d0, 'CIDToGIDMap');
      const identityMap = c2g === undefined || nameOf(c2g) === 'Identity';
      if (encoding === 'Identity-H' && identityMap && (cidSubtype === 'CIDFontType2' || cidSubtype === 'CIDFontType0')) kind = 'type0-identity';
      parseCidWidths(context, get(context, d0, 'W'), widths);
      defaultWidth = numberOf(get(context, d0, 'DW')) ?? 1000;
    }
  } else if (subtype === 'Type1' || subtype === 'TrueType' || subtype === 'MMType1' || subtype === 'Type3') {
    const firstChar = numberOf(get(context, dict, 'FirstChar'));
    const w = get(context, dict, 'Widths');
    if (w instanceof PDFArray && firstChar !== undefined) {
      w.asArray().forEach((value, k) => {
        const width = numberOf(lookup(context, value));
        if (width !== undefined) widths.set(firstChar + k, width);
      });
    }
    const encoding = get(context, dict, 'Encoding');
    if (encoding instanceof PDFName) baseEncoding = encoding.decodeText();
    else if (encoding instanceof PDFDict) {
      baseEncoding = nameOf(get(context, encoding, 'BaseEncoding')) ?? 'implicit';
      const list = get(context, encoding, 'Differences');
      if (list instanceof PDFArray) {
        differences = new Map();
        let code = 0;
        for (const item of list.asArray()) {
          const value = lookup(context, item);
          if (value instanceof PDFNumber) code = value.asNumber();
          else if (value instanceof PDFName) differences.set(code++, value.decodeText());
        }
      }
    } else if (encoding !== undefined) {
      baseEncoding = 'unknown';
    }
    if (subtype === 'Type3') {
      const matrix = get(context, dict, 'FontMatrix');
      const scale = matrix instanceof PDFArray ? (numberOf(lookup(context, matrix.get(0))) ?? 0.001) : 0.001;
      for (const [code, width] of widths) widths.set(code, width * scale * 1000);
      const procs = get(context, dict, 'CharProcs');
      charProcs = new Set(procs instanceof PDFDict ? procs.keys().map((key) => key.decodeText()) : []);
      if (procs instanceof PDFDict && matrix instanceof PDFArray && scale !== 0) kind = 'type3';
      if (!baseFont) {
        const descriptor = get(context, dict, 'FontDescriptor');
        baseFont = (descriptor instanceof PDFDict ? nameOf(get(context, descriptor, 'FontName')) : undefined) ?? nameOf(get(context, dict, 'Name')) ?? '';
      }
    } else {
      const descriptor = get(context, dict, 'FontDescriptor');
      const file2 = descriptor instanceof PDFDict ? descriptor.has(PDFName.of('FontFile2')) : false;
      const embedded = descriptor instanceof PDFDict && ['FontFile', 'FontFile2', 'FontFile3'].some((key) => descriptor.has(PDFName.of(key)));
      const face = faceName(baseFont);
      const std = STD14_LATIN.has(face) ? face : STD14_ALIASES[face];
      const winAnsi = baseEncoding === undefined || baseEncoding === 'WinAnsiEncoding';
      if (!embedded && std && winAnsi && !differences) {
        kind = 'std14';
        std14Name = std;
      } else if (embedded && file2 && subtype === 'TrueType') kind = 'simple-truetype';
      else if (embedded) kind = 'simple-other';
      if (descriptor instanceof PDFDict) defaultWidth = numberOf(get(context, descriptor, 'MissingWidth')) ?? null;
    }
  }

  let flags = 0;
  let italicAngle = 0;
  let weight: number | null = null;
  let program: Uint8Array | undefined;
  const names = new Set<string>([normFontName(baseFont)]);
  if (holder !== dict) names.add(normFontName(nameOf(get(context, holder, 'BaseFont')) ?? ''));
  const descriptor = get(context, holder, 'FontDescriptor');
  if (descriptor instanceof PDFDict) names.add(normFontName(nameOf(get(context, descriptor, 'FontName')) ?? ''));
  else if (subtype === 'Type3') names.add('type3');
  names.delete('');
  if (descriptor instanceof PDFDict) {
    flags = numberOf(get(context, descriptor, 'Flags')) ?? 0;
    italicAngle = numberOf(get(context, descriptor, 'ItalicAngle')) ?? 0;
    weight = numberOf(get(context, descriptor, 'FontWeight')) ?? null;
    for (const key of ['FontFile2', 'FontFile3', 'FontFile']) {
      const stream = get(context, descriptor, key);
      if (stream) {
        program = streamBytes(stream);
        break;
      }
    }
  }
  if (kind === 'simple-truetype' && !program) kind = 'unsupported';
  if (!ref) kind = 'unsupported';

  const key = fontKeyOf(ref, fallbackName);
  const info: PdfFontInfo = {
    key,
    objectNumber: ref ? ref.objectNumber : -1,
    generation: ref ? ref.generationNumber : 0,
    kind,
    baseFont,
    face: faceName(baseFont),
    twoByte,
    signature: fontSignature(context, dict),
    flags,
    italicAngle,
    weight,
    ...(std14Name ? { std14Name } : {}),
  };
  return { info, ref, toUnicode, widths, defaultWidth, program, baseEncoding, differences, charProcs, names: [...names] };
}

/**
 * Every font object a page can draw with: its /Resources /Font, and those
 * of the form XObjects it reaches (depth <= 6). `cache` keeps one SourceFont
 * per object across pages.
 */
export function fontsOfPage(doc: PDFDocument, pageIndex: number, cache: Map<string, SourceFont>): SourceFont[] {
  const { context } = doc;
  const out: SourceFont[] = [];
  const seen = new Set<string>();
  const visitedForms = new Set<PDFObject>();
  const walk = (resources: PDFObject | undefined, depth: number) => {
    if (!(resources instanceof PDFDict) || depth > 6) return;
    const fonts = get(context, resources, 'Font');
    if (fonts instanceof PDFDict) {
      for (const [name, value] of fonts.entries()) {
        const dict = lookup(context, value);
        if (!(dict instanceof PDFDict)) continue;
        const ref = value instanceof PDFRef ? value : null;
        const fallback = `${pageIndex}/${depth}/${name.decodeText()}`;
        const key = fontKeyOf(ref, fallback);
        if (seen.has(key)) continue;
        seen.add(key);
        let font = cache.get(key);
        if (!font) {
          font = readFont(doc, ref, dict, fallback);
          cache.set(key, font);
        }
        out.push(font);
      }
    }
    const xobjects = get(context, resources, 'XObject');
    if (xobjects instanceof PDFDict) {
      for (const [, value] of xobjects.entries()) {
        const xobject = lookup(context, value);
        if (!(xobject instanceof PDFStream) || visitedForms.has(xobject)) continue;
        if (nameOf(get(context, xobject.dict, 'Subtype')) !== 'Form') continue;
        visitedForms.add(xobject);
        walk(get(context, xobject.dict, 'Resources'), depth + 1);
      }
    }
  };
  const page = doc.getPages()[pageIndex];
  if (page) walk(lookup(context, page.node.getInheritableAttribute(PDFName.of('Resources'))), 0);
  return out;
}

// ── Standard 14 metrics (pdf-lib's StandardFontEmbedder) ────────────────────

export interface Std14Metrics {
  /** Every WinAnsi character the font encodes: its text, one-byte code and width (1/1000 em). */
  entries: Array<{ text: string; code: number; width: number }>;
  /** Width of a WinAnsi code (1/1000 em), or null when the code is not encoded. */
  widthOfCode(code: number): number | null;
}

const std14Cache = new Map<string, Std14Metrics>();

/** Metrics and WinAnsi codes of a standard 14 Latin font, from pdf-lib. */
export function std14Metrics(name: string): Std14Metrics {
  let metrics = std14Cache.get(name);
  if (metrics) return metrics;
  const embedder = StandardFontEmbedder.for(name as Parameters<typeof StandardFontEmbedder.for>[0]);
  const encoding = embedder.encoding;
  const nameOfCode = new Map<number, string>();
  const entries: Std14Metrics['entries'] = [];
  for (const cp of encoding.supportedCodePoints) {
    const { code, name: glyphName } = encoding.encodeUnicodeCodePoint(cp);
    const width = embedder.font.getWidthOfGlyph(glyphName);
    if (typeof width !== 'number') continue;
    if (!nameOfCode.has(code)) nameOfCode.set(code, glyphName);
    entries.push({ text: String.fromCodePoint(cp), code, width });
  }
  metrics = {
    entries,
    widthOfCode: (code) => {
      const glyphName = nameOfCode.get(code);
      const width = glyphName === undefined ? undefined : embedder.font.getWidthOfGlyph(glyphName);
      return typeof width === 'number' ? width : null;
    },
  };
  std14Cache.set(name, metrics);
  return metrics;
}

/** WinAnsi: code -> Unicode text, for simple fonts without a ToUnicode entry (glyph names through the same table). */
let winAnsi: { byCode: Map<number, string>; byName: Map<string, string> } | null = null;
export function winAnsiTables(): { byCode: Map<number, string>; byName: Map<string, string> } {
  if (winAnsi) return winAnsi;
  const encoding = StandardFontEmbedder.for('Helvetica' as Parameters<typeof StandardFontEmbedder.for>[0]).encoding;
  const byCode = new Map<number, string>();
  const byName = new Map<string, string>();
  for (const cp of encoding.supportedCodePoints) {
    const { code, name } = encoding.encodeUnicodeCodePoint(cp);
    if (!byCode.has(code)) byCode.set(code, String.fromCodePoint(cp));
    if (!byName.has(name)) byName.set(name, String.fromCodePoint(cp));
  }
  winAnsi = { byCode, byName };
  return winAnsi;
}

/** Unicode text for a glyph name: the WinAnsi names, uniXXXX and uXXXX[XX]. */
export function textOfGlyphName(name: string): string | undefined {
  const known = winAnsiTables().byName.get(name);
  if (known) return known;
  const uni = /^uni([0-9A-F]{4})$/.exec(name) ?? /^u([0-9A-F]{4,6})$/.exec(name);
  if (uni) {
    const cp = parseInt(uni[1], 16);
    if (cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)) return String.fromCodePoint(cp);
  }
  return undefined;
}
