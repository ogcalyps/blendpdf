/**
 * "Keep the font": the decision function and the size rule, shared by the
 * preview (./preview) and the export (../export) so both draw the same thing
 * (keep-font-spec.md sections 3 and 7). Reached only through import().
 *
 *   empty text                                   -> 'empty' (nothing drawn, no note)
 *   no LineFont                                  -> Cairo, reason 'font' (Phase C behaviour)
 *   data.blocked                                 -> look-alike, reason 'font'
 *   a CHANGED word carries an Arabic mark        -> look-alike, reason 'letters'
 *   planLine ok, no approx                       -> 'original'
 *   only font problems (a word in two fonts...)  -> look-alike, reason 'font'
 *   otherwise                                    -> look-alike, reason 'letters'
 *   look-alike stack can't draw every character  -> Cairo (same reason; `transient` when a file did not load)
 *   Cairo can't either                           -> 'image' (TEXT_AS_IMAGE, as today)
 *
 * Owner: ENGINE.
 */
import type { Font } from '@pdf-lib/fontkit';
import { createLayoutFont, firstStrongDirection, layoutText } from '@/lib/pdf-text';
import { CAIRO_FONT_URL } from '@/lib/pdf-text/constants';
import { REPLACE_FIT_MAX, REPLACE_FIT_MIN, REPLACE_FIT_UNSURE, REPLACE_MAX_SIZE, REPLACE_MIN_SIZE } from '../types';
import type { HexColor, ReplaceFontChoice, ReplaceObject } from '../types';
import { ARABIC_MARK } from './arabic';
import { LOOKALIKE_FONTS, lookalikeFile } from './lookalike';
import { FONT_PROBLEM, planLine } from './plan';
import type { LineFontData, LookalikeFamily, PdfFontInfo, PlacedGlyph, ReplacementPlan } from './types';

export interface PlanDeps {
  /** Font bytes by URL (../font loadFontFile in the browser; public/fonts in Node tests). */
  loadFont: (url: string) => Promise<Uint8Array>;
}

/** One fontkit layout instance per font file (by its bytes), for the session. */
const layoutFonts = new WeakMap<Uint8Array, Font>();

/** The layout instance for these bytes (never the one inside pdf-lib's subsetter: see lib/pdf-text embedTextFont). */
export function layoutFontFor(bytes: Uint8Array): Font {
  let font = layoutFonts.get(bytes);
  if (!font) {
    font = createLayoutFont(bytes);
    layoutFonts.set(bytes, font);
  }
  return font;
}

/** Layout instances of a stack of font URLs. */
export async function stackFonts(urls: readonly string[], deps: PlanDeps): Promise<Font[]> {
  return Promise.all(urls.map(async (url) => layoutFontFor(await deps.loadFont(url))));
}

const roundSize = (size: number) => Math.round(size * 10) / 10;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** The look-alike families for this text, primary first (keep-font-spec.md section 3). */
export function lookalikeStack(data: LineFontData, text: string, lineDirection: 'ltr' | 'rtl'): LookalikeFamily[] {
  const pick = data.lookalike;
  const arabicFirst = (firstStrongDirection(text) ?? lineDirection) === 'rtl';
  const first = arabicFirst ? pick.arabic : pick.latin;
  const second = arabicFirst ? pick.latin : pick.arabic;
  return LOOKALIKE_FONTS[first].covers === 'both' || first === second ? [first] : [first, second];
}

/** Is `family` the original's own family (Carlito drawn in Carlito)? Then no note is shown. */
function sameFamilyOf(data: LineFontData, family: LookalikeFamily): boolean {
  const pick = data.lookalike;
  if (family === pick.latin && pick.sameFamily.latin) return true;
  return family === pick.arabic && pick.sameFamily.arabic;
}

/** Words of `next` that are not words of `previous` (multiset difference). */
function changedWords(previous: string, next: string): string[] {
  const counts = new Map<string, number>();
  for (const w of previous.split(' ').filter(Boolean)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const out: string[] = [];
  for (const w of next.split(' ').filter(Boolean)) {
    const left = counts.get(w) ?? 0;
    if (left > 0) counts.set(w, left - 1);
    else out.push(w);
  }
  return out;
}

/**
 * The size of a replacement drawn with `fonts` (keep-font-spec.md section
 * 7): `object.size` once the visitor chose one (no autoSize); the line's own
 * size in the original font; else the Phase C width fit of the old prefill
 * in that stack at the line's size, rounded to 0.1.
 */
function fittedSize(object: ReplaceObject, fonts: readonly Font[] | null, unsureFit: number): number {
  if (!object.autoSize || !object.font) return object.size;
  const { line } = object;
  const base = object.font.size;
  if (!fonts) return base;
  let fit = unsureFit;
  if (!line.textUnsure && line.text !== '') {
    const width = layoutText(fonts, line.text, { size: base, direction: 'auto', fallbackDirection: line.direction }).width;
    if (width > 0) fit = clamp((line.geometry.end - line.geometry.start) / width, REPLACE_FIT_MIN, REPLACE_FIT_MAX);
  }
  return roundSize(clamp(base * fit, REPLACE_MIN_SIZE, REPLACE_MAX_SIZE));
}

/**
 * The fill of every planned glyph: unchanged colour = each kept glyph its
 * own, new ones the fill of the word they replace (else the line's); a
 * chosen colour paints them all.
 */
function fillOf(object: ReplaceObject, glyph: Pick<PlacedGlyph, 'verbatim' | 'ownFill' | 'fill'>): HexColor {
  const unchanged = object.color.toLowerCase() === object.line.color.toLowerCase();
  if (!unchanged) return object.color;
  return glyph.verbatim || glyph.ownFill ? glyph.fill : object.line.color;
}

/**
 * What to draw for `text` on `object`'s line, and the note's choice. `text`
 * is the field's value while typing, else object.text. The same inputs give
 * the same plan, for the preview and the export alike.
 */
export async function planReplacement(object: ReplaceObject, text: string, deps: PlanDeps): Promise<ReplacementPlan> {
  const { line } = object;
  const font = object.font && object.font.lineId === line.id ? object.font : undefined;
  if (text.trim() === '') {
    return { kind: 'empty', choice: { mode: 'original', font: null, reason: null, sameFamily: false }, size: object.autoSize && font ? font.size : object.size };
  }

  let reason: 'letters' | 'font' = 'font';
  /** A look-alike file did not arrive (offline, a failed fetch): what follows is not what the save would draw. */
  let unavailable = false;
  if (font) {
    const data = font.data;
    reason = data.blocked ? 'font' : 'letters';
    const marked = changedWords(line.text, text).some((w) => ARABIC_MARK.test(w));
    if (!data.blocked && !marked) {
      const size = object.autoSize ? font.size : object.size;
      const plan = planLine(data, line.text, text, line.direction, size);
      const problems = [...plan.missing, ...plan.approx];
      if (problems.length > 0 && problems.every((p) => p.startsWith(FONT_PROBLEM))) reason = 'font';
      if (plan.ok && plan.approx.length === 0 && plan.glyphs.length > 0) {
        const fonts: Record<string, PdfFontInfo> = {};
        for (const g of plan.glyphs) fonts[g.font] = data.faces[data.faceOf[g.font]].fonts[g.font];
        return {
          kind: 'original',
          choice: { mode: 'original', font: null, reason: null, sameFamily: false },
          size,
          hscale: data.style.hscale,
          glyphs: plan.glyphs.map((g) => ({ ...g, fill: fillOf(object, g) })),
          fonts,
        };
      }
    }
    // The closest look-alike we ship: the primary family alone when it has every character (one
    // download), else with its companion. A file that did not arrive counts as not having the letters.
    const families = lookalikeStack(data, text, line.direction);
    const urls = families.map((family) => lookalikeFile(family, data.lookalike.bold));
    const draws = (stack: Font[] | null) => !!stack && layoutText(stack, text, { size: font.size, direction: 'auto', fallbackDirection: line.direction }).missing.length === 0;
    const load = (list: string[]) =>
      stackFonts(list, deps).catch((error: unknown) => {
        console.warn('keep-font: a look-alike font did not load', error);
        unavailable = true;
        return null;
      });
    let used = urls.slice(0, 1);
    let stack = await load(used);
    if (!draws(stack) && urls.length > 1) {
      used = urls;
      stack = await load(used);
    }
    if (stack && draws(stack)) {
      const choice: ReplaceFontChoice = { mode: 'lookalike', font: families[0], reason, sameFamily: sameFamilyOf(data, families[0]) };
      return { kind: 'vector', choice, size: fittedSize(object, stack, LOOKALIKE_FONTS[families[0]].unsureFit), fonts: used, oblique: data.lookalike.italic };
    }
  }

  // Cairo, as in Phase C; a picture when even Cairo lacks a character.
  const cairo = await stackFonts([CAIRO_FONT_URL], deps);
  const size = fittedSize(object, cairo, REPLACE_FIT_UNSURE);
  const transient = unavailable ? ({ transient: true } as const) : {};
  if (layoutText(cairo, text, { size, direction: 'auto', fallbackDirection: line.direction }).missing.length === 0) {
    return { kind: 'vector', choice: { mode: 'cairo', font: 'Cairo', reason, sameFamily: false }, size, fonts: [CAIRO_FONT_URL], oblique: false, ...transient };
  }
  return { kind: 'image', choice: { mode: 'image', font: null, reason, sameFamily: false }, size, ...transient };
}
