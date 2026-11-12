/**
 * "Keep the font": the few TrueType (sfnt) tables the font analysis reads
 * from a font program embedded in the PDF (FontFile2): does a glyph id have
 * an outline (glyf/loca), and the cmap lookups that tie a code or a code
 * point to a glyph id. Read-only and defensive: a table that is missing or
 * malformed answers null ("can't tell"), never throws.
 *
 * Owner: ENGINE. Pure, no imports.
 */

interface TableEntry {
  offset: number;
  length: number;
}

/** The table directory of an sfnt program (TrueType or OpenType), or null when it is not one. */
export function sfntTables(program: Uint8Array): Record<string, TableEntry> | null {
  try {
    if (program.length < 12) return null;
    const dv = new DataView(program.buffer, program.byteOffset, program.byteLength);
    const version = dv.getUint32(0);
    if (version !== 0x00010000 && version !== 0x74727565 && version !== 0x4f54544f) return null;
    const count = dv.getUint16(4);
    const tables: Record<string, TableEntry> = {};
    for (let i = 0; i < count; i++) {
      const at = 12 + i * 16;
      if (at + 16 > program.length) return null;
      const tag = String.fromCharCode(program[at], program[at + 1], program[at + 2], program[at + 3]);
      const offset = dv.getUint32(at + 8);
      const length = dv.getUint32(at + 12);
      if (offset + length > program.length) continue;
      tables[tag] = { offset, length };
    }
    return tables;
  } catch {
    return null;
  }
}

const view = (program: Uint8Array) => new DataView(program.buffer, program.byteOffset, program.byteLength);

/** Glyphs in the program (maxp), or null. */
export function glyphCount(program: Uint8Array): number | null {
  const tables = sfntTables(program);
  if (!tables?.maxp) return null;
  try {
    return view(program).getUint16(tables.maxp.offset + 4);
  } catch {
    return null;
  }
}

/**
 * Does glyph `gid` have an outline? Through glyf/loca, so only for TrueType
 * outlines: null for CFF programs, or when the tables can't be read. A
 * subset keeps the glyph ids of the full font but empties the glyphs it did
 * not keep, so this is how "the subset has this glyph" is told.
 */
export function glyphHasOutline(program: Uint8Array | undefined, gid: number): boolean | null {
  if (!program) return null;
  const tables = sfntTables(program);
  if (!tables?.glyf || !tables.loca || !tables.head || !tables.maxp) return null;
  try {
    const dv = view(program);
    const longOffsets = dv.getInt16(tables.head.offset + 50) !== 0;
    const count = dv.getUint16(tables.maxp.offset + 4);
    if (!Number.isInteger(gid) || gid < 0 || gid >= count) return false;
    const at = (i: number) => (longOffsets ? dv.getUint32(tables.loca.offset + i * 4) : dv.getUint16(tables.loca.offset + i * 2) * 2);
    return at(gid + 1) > at(gid);
  } catch {
    return null;
  }
}

interface CmapSubtable {
  platform: number;
  encoding: number;
  offset: number;
}

function cmapSubtables(program: Uint8Array): CmapSubtable[] {
  const tables = sfntTables(program);
  if (!tables?.cmap) return [];
  try {
    const dv = view(program);
    const base = tables.cmap.offset;
    const count = dv.getUint16(base + 2);
    const out: CmapSubtable[] = [];
    for (let i = 0; i < count; i++) {
      out.push({ platform: dv.getUint16(base + 4 + i * 8), encoding: dv.getUint16(base + 6 + i * 8), offset: base + dv.getUint32(base + 8 + i * 8) });
    }
    return out;
  } catch {
    return [];
  }
}

/** One lookup in a cmap subtable of format 0, 4, 6 or 12; null when absent. */
function lookup(program: Uint8Array, offset: number, code: number): number | null {
  try {
    const dv = view(program);
    const format = dv.getUint16(offset);
    if (format === 0) return code < 256 ? program[offset + 6 + code] || null : null;
    if (format === 6) {
      const first = dv.getUint16(offset + 6);
      const count = dv.getUint16(offset + 8);
      return code >= first && code < first + count ? dv.getUint16(offset + 10 + (code - first) * 2) || null : null;
    }
    if (format === 4) {
      const segX2 = dv.getUint16(offset + 6);
      const ends = offset + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = dv.getUint16(ends + s * 2);
        if (code > end) continue;
        const start = dv.getUint16(starts + s * 2);
        if (code < start) return null;
        const delta = dv.getInt16(deltas + s * 2);
        const rangeOffset = dv.getUint16(ranges + s * 2);
        if (rangeOffset === 0) return ((code + delta) & 0xffff) || null;
        const glyph = dv.getUint16(ranges + s * 2 + rangeOffset + (code - start) * 2);
        return glyph === 0 ? null : ((glyph + delta) & 0xffff) || null;
      }
      return null;
    }
    if (format === 12) {
      const groups = dv.getUint32(offset + 12);
      for (let g = 0; g < groups; g++) {
        const at = offset + 16 + g * 12;
        const startCode = dv.getUint32(at);
        const endCode = dv.getUint32(at + 4);
        if (code >= startCode && code <= endCode) return dv.getUint32(at + 8) + (code - startCode) || null;
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/** Mac OS Roman, 0x80-0xFF (0xDB is the currency sign in PDF's MacRomanEncoding and the euro in later Mac fonts). */
const MAC_ROMAN_HIGH =
  'ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\u00A0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄¤‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\uF8FFÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';

/** The Mac OS Roman code of a Unicode code point, or undefined. */
export function macRomanCode(unicode: number): number | undefined {
  if (unicode >= 0x20 && unicode <= 0x7e) return unicode;
  if (unicode === 0x20ac) return 0xdb;
  const at = MAC_ROMAN_HIGH.indexOf(String.fromCodePoint(unicode));
  return at >= 0 ? 0x80 + at : undefined;
}

/**
 * The glyph a one-byte code of a SIMPLE TrueType font draws (PDF 32000
 * 9.6.6.4). A symbolic font: the (3,0) symbol cmap at 0xF000 + code (or
 * code), then the (1,0) Mac cmap at the code, then the (3,1) cmap at the
 * code's Unicode value. A non-symbolic one (`symbolic` false: its codes
 * mean WinAnsi, MacRoman or /Differences characters): the (3,1) cmap at
 * the code's Unicode value, else the (1,0) cmap at that character's
 * MacRoman code (never at the raw code: 0xE9 is é in WinAnsi but È in
 * MacRoman), then the (3,0) cmap. Null when no table answers.
 */
export function simpleGlyphFor(program: Uint8Array | undefined, code: number, unicode?: number, symbolic = true): number | null {
  if (!program) return null;
  const subtables = cmapSubtables(program);
  const viaUnicode = () => {
    if (unicode === undefined) return null;
    for (const t of subtables) {
      if ((t.platform === 3 && (t.encoding === 1 || t.encoding === 10)) || t.platform === 0) {
        const gid = lookup(program, t.offset, unicode);
        if (gid) return gid;
      }
    }
    return null;
  };
  if (!symbolic) {
    const unicodeGid = viaUnicode();
    if (unicodeGid) return unicodeGid;
    const mac = unicode === undefined ? undefined : macRomanCode(unicode);
    for (const t of subtables) {
      if (mac !== undefined && t.platform === 1 && t.encoding === 0) {
        const gid = lookup(program, t.offset, mac);
        if (gid) return gid;
      }
    }
  }
  for (const t of subtables) {
    if (t.platform === 3 && t.encoding === 0) {
      const gid = lookup(program, t.offset, 0xf000 + code) ?? lookup(program, t.offset, code);
      if (gid) return gid;
    }
  }
  if (!symbolic) return null;
  for (const t of subtables) {
    if (t.platform === 1 && t.encoding === 0) {
      const gid = lookup(program, t.offset, code);
      if (gid) return gid;
    }
  }
  return viaUnicode();
}

/**
 * Every (code point -> glyph id) pair of the program's Unicode cmap ((3,1),
 * (3,10) or platform 0, formats 4 and 12). Subsets made by Chrome and Word
 * often keep it, and it names the presentation form a glyph stands for.
 */
export function unicodeCmap(program: Uint8Array | undefined): Map<number, number> {
  const out = new Map<number, number>();
  if (!program) return out;
  const subtable = cmapSubtables(program).find((t) => (t.platform === 3 && (t.encoding === 1 || t.encoding === 10)) || t.platform === 0);
  if (!subtable) return out;
  try {
    const dv = view(program);
    const format = dv.getUint16(subtable.offset);
    if (format === 4) {
      const o = subtable.offset;
      const segX2 = dv.getUint16(o + 6);
      const ends = o + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = dv.getUint16(ends + s * 2);
        const start = dv.getUint16(starts + s * 2);
        const delta = dv.getInt16(deltas + s * 2);
        const rangeOffset = dv.getUint16(ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let gid: number;
          if (rangeOffset === 0) gid = (c + delta) & 0xffff;
          else {
            const v = dv.getUint16(ranges + s * 2 + rangeOffset + (c - start) * 2);
            gid = v === 0 ? 0 : (v + delta) & 0xffff;
          }
          if (gid) out.set(c, gid);
        }
      }
    } else if (format === 12) {
      const o = subtable.offset;
      const groups = dv.getUint32(o + 12);
      for (let g = 0; g < groups; g++) {
        const at = o + 16 + g * 12;
        const startCode = dv.getUint32(at);
        const endCode = Math.min(dv.getUint32(at + 4), startCode + 0xffff);
        const first = dv.getUint32(at + 8);
        for (let c = startCode; c <= endCode; c++) if (first + (c - startCode)) out.set(c, first + (c - startCode));
      }
    }
  } catch {
    // a broken table: whatever was read so far
  }
  return out;
}
