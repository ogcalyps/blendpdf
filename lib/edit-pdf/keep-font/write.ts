/**
 * "Keep the font": writing a planned line with the ORIGINAL font objects
 * (keep-font-spec.md section 4). The new text references the source font by
 * object, so copy and search read it through the font's own ToUnicode: every
 * glyph the plan draws was picked BY its own ToUnicode text (the inventory is
 * keyed by it), so the glyphs read back as what was typed.
 *
 *   q  BT  0 Tc 0 Tw 0 Ts  r g b rg  [Tz]  /KFn size Tf  a b c d e f Tm  <code> Tj  dx dy Td <code> Tj ...  ET  Q
 *
 * No /ActualText span, on purpose (measured with the editor's PDFium, the
 * engine of Chrome's viewer): PDFium gives a span's whole text to the span's
 * first glyph, so search and selection boxes of the edited line collapse
 * into one glyph's width, and PDFium before chromium/8000 also reverses an
 * RTL span's text (tests/edit-pdf-keep-font-export.test.ts checks both).
 *
 * Pushed with page.pushOperators (pdf-lib wraps the page's existing content
 * in q/Q first), one Tf per font or size switch, one rg per fill switch, one
 * Tz per scale switch, a Tm at the first glyph then one Td per glyph (a Tm
 * again for a slanted glyph), hex codes of 2 (simple, Type3) or 4
 * (Identity-H) digits. Fonts go into the page's OWN /Resources /Font as
 * /KF0, /KF1... (one per font object), never into a form XObject's.
 *
 * Owner: ENGINE. Reached only through import().
 */
import {
  PDFDict,
  PDFHexString,
  PDFName,
  PDFObjectCopier,
  PDFRef,
  beginText,
  endText,
  moveText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSpacing,
  setCharacterSqueeze,
  setFillingRgbColor,
  setFontAndSize,
  setTextMatrix,
  setTextRise,
  setWordSpacing,
  showText,
} from 'pdf-lib';
import type { PDFDocument, PDFOperator, PDFPage } from 'pdf-lib';
import { fontSignature } from './pdf-fonts';
import type { PdfFontInfo, ReplacementPlan } from './types';

/** Where a source font object lives in the document being written. */
export interface FontRefResolver {
  refFor(font: PdfFontInfo): PDFRef;
}

/** The line's axis and baseline in the target page's user space. */
export interface LineFrame {
  ux: number;
  uy: number;
  baseline: number;
}

/** How each source font reached the output, for tests and logs: 'same' object or 'copied' from the source. */
export type FontRoute = 'same' | 'copied';

export interface TrackedResolver extends FontRefResolver {
  /** PdfFontInfo key -> how it was resolved. */
  readonly routes: ReadonlyMap<string, FontRoute>;
}

const sourceRef = (font: PdfFontInfo) => PDFRef.of(font.objectNumber, font.generation);

/**
 * The export's resolver: the same object number in `output` when the object
 * there has the same signature (PDFium kept the font), else a PDFObjectCopier
 * copy from `source` (PDFium dropped or renumbered it), cached per font.
 */
export function exportFontResolver(source: PDFDocument, output: PDFDocument): TrackedResolver {
  const copier = PDFObjectCopier.for(source.context, output.context);
  const refs = new Map<string, PDFRef>();
  const routes = new Map<string, FontRoute>();
  return {
    routes,
    refFor(font) {
      const known = refs.get(font.key);
      if (known) return known;
      if (font.objectNumber < 0) throw new Error(`keep-font: font ${font.key} is not an indirect object`);
      const ref = sourceRef(font);
      const there = output.context.lookup(ref);
      let target: PDFRef;
      if (there instanceof PDFDict && fontSignature(output.context, there) === font.signature) {
        target = ref;
        routes.set(font.key, 'same');
      } else {
        target = copier.copy(ref);
        routes.set(font.key, 'copied');
      }
      refs.set(font.key, target);
      return target;
    },
  };
}

/** The preview's resolver: always a copy from the session's source document (cached per font). */
export function copyFontResolver(source: PDFDocument, target: PDFDocument): FontRefResolver & { copies(): PDFRef[] } {
  const copier = PDFObjectCopier.for(source.context, target.context);
  const refs = new Map<string, PDFRef>();
  return {
    copies: () => [...refs.values()],
    refFor(font) {
      let ref = refs.get(font.key);
      if (!ref) {
        if (font.objectNumber < 0) throw new Error(`keep-font: font ${font.key} is not an indirect object`);
        ref = copier.copy(sourceRef(font));
        refs.set(font.key, ref);
      }
      return ref;
    },
  };
}

/** /KFn names already given on a page, by target ref. */
const pageNames = new WeakMap<PDFPage, Map<string, string>>();

function resourceName(page: PDFPage, ref: PDFRef): string {
  let names = pageNames.get(page);
  if (!names) pageNames.set(page, (names = new Map()));
  const known = names.get(ref.toString());
  if (known) return known;
  const { Font } = page.node.normalizedEntries();
  let n = 0;
  while (Font.has(PDFName.of(`KF${n}`))) n++;
  const name = `KF${n}`;
  Font.set(PDFName.of(name), ref);
  names.set(ref.toString(), name);
  return name;
}

const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16) / 255;
/** Positions and sizes are written to 1/10000 pt; Td deltas are taken between rounded positions, so they never drift. */
const round = (n: number) => Math.round(n * 1e4) / 1e4;
const SCALE_EPSILON = 0.002;
const SLANT_EPSILON = 1e-4;

/** The writer. Adds /KFn entries to the page's own /Resources /Font and pushes one text object. */
export function drawOriginalLine(page: PDFPage, plan: Extract<ReplacementPlan, { kind: 'original' }>, frame: LineFrame, fonts: FontRefResolver): void {
  const glyphs = plan.glyphs.filter((g) => g.code >= 0);
  if (glyphs.length === 0) return;
  const { ux, uy, baseline } = frame;
  const ops: PDFOperator[] = [
    pushGraphicsState(),
    beginText(),
    setCharacterSpacing(0),
    setWordSpacing(0),
    setTextRise(0),
  ];
  let fill = '';
  let tf = '';
  let hscale = 1;
  let previous: { s: number; p: number; skew: number } | null = null;
  for (const g of glyphs) {
    const font = plan.fonts[g.font];
    if (!font) throw new Error(`keep-font: no font ${g.font} in the plan`);
    if (g.fill.toLowerCase() !== fill) {
      fill = g.fill.toLowerCase();
      ops.push(setFillingRgbColor(channel(fill, 1), channel(fill, 3), channel(fill, 5)));
    }
    const name = resourceName(page, fonts.refFor(font));
    const size = round(g.size);
    const nextTf = `${name} ${size}`;
    if (nextTf !== tf) {
      tf = nextTf;
      ops.push(setFontAndSize(name, size));
    }
    if (Math.abs(g.hscale - hscale) > SCALE_EPSILON) {
      hscale = g.hscale;
      ops.push(setCharacterSqueeze(round(hscale * 100)));
    }
    const s = round(g.s);
    const p = round(baseline + g.p);
    const slanted = Math.abs(g.skew) > SLANT_EPSILON;
    if (!previous || slanted || Math.abs(previous.skew) > SLANT_EPSILON) {
      const k = slanted ? g.skew : 0;
      // Text space: x along the baseline, y across it, slanted by k for a synthetic italic.
      ops.push(setTextMatrix(round(ux), round(uy), round(-uy + k * ux), round(ux + k * uy), round(s * ux - p * uy), round(s * uy + p * ux)));
    } else {
      ops.push(moveText(round(s - previous.s), round(p - previous.p)));
    }
    previous = { s, p, skew: slanted ? g.skew : 0 };
    ops.push(showText(PDFHexString.of(g.code.toString(16).toUpperCase().padStart(g.twoByte ? 4 : 2, '0'))));
  }
  ops.push(endText(), popGraphicsState());
  page.pushOperators(...ops);
}
