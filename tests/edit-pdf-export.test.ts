/**
 * /edit-pdf export golden tests. Source PDFs are built here with pdf-lib, run
 * through exportEditedPdf (through the facade, so the lazy wiring is tested
 * too) and read back with pdf.js 3.11 in Node. Expected positions come from
 * pdf.js's own viewport (tests/helpers/edit-pdf-oracle), never from
 * lib/pdf-geometry, so a geometry bug cannot hide behind itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCanvas } from 'canvas';
import {
  PDFBool,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
  StandardFonts,
  degrees,
} from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { createLayoutFont, layoutText } from '../lib/pdf-text';
import {
  HIGHLIGHT_COLOR,
  arrowHeadArms,
  exportEditedPdf,
  inspectPdf,
  isEditPdfError,
  lineBoxAt,
  loadTextReplacer,
  releaseTextReplacer,
} from '../lib/edit-pdf';
import type {
  EditorObject,
  EditorPage,
  ExportOptions,
  ExportRequest,
  ExportWarning,
  ImageAsset,
  PaletteColor,
  QuarterTurn,
  RasterTextInput,
  ReplaceObject,
  SourceTextLine,
  VisualBox,
} from '../lib/edit-pdf';
import { boundsOf, containsMarker, readGraphics, searchableBytes } from './helpers/edit-pdf-oracle';
import type { GraphicsPage, PaintedPath, Pt } from './helpers/edit-pdf-oracle';
import { readPdf } from './helpers/pdf-glyph-oracle';
import { PDFIUM_WASM, detectPage, findLine, fixture, linesOn, pagesText, sharedLetterhead, squash } from './helpers/replace-fixtures';

const FONT_BYTES = new Uint8Array(readFileSync(join(__dirname, '..', 'public', 'fonts', 'Cairo-Regular.ttf')));
const noRaster = async (): Promise<never> => {
  throw new Error('no text box should need the picture fallback here');
};
const OPTIONS: ExportOptions = { fontBytes: FONT_BYTES, rasterizeText: noRaster };
const TOLERANCE = 1e-6;

type Box4 = [number, number, number, number];

interface SourceSpec {
  media?: Box4;
  crop?: Box4;
  rotate?: number;
  marker?: string;
}

async function sourcePdf(specs: SourceSpec[], tweak?: (doc: PDFDocument, pages: PDFPage[]) => void | Promise<void>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const pages = specs.map((spec) => {
    const page = doc.addPage([612, 792]);
    if (spec.media) page.setMediaBox(...spec.media);
    if (spec.crop) page.setCropBox(...spec.crop);
    if (spec.rotate) page.setRotation(degrees(spec.rotate));
    const box = spec.crop ?? spec.media ?? [0, 0, 612, 792];
    if (spec.marker) page.drawText(spec.marker, { x: box[0] + 20, y: box[1] + 20, size: 10, font: helvetica });
    return page;
  });
  await tweak?.(doc, pages);
  return doc.save();
}

const sourcePage = (index: number, rotation: QuarterTurn = 0): EditorPage => ({ id: `s${index}`, source: { kind: 'source', index }, rotation });

function request(pages: EditorPage[], objects: EditorObject[], assets: Record<string, ImageAsset> = {}, fallbackDirection: 'ltr' | 'rtl' = 'ltr'): ExportRequest {
  return { pages, objects, assets, fallbackDirection };
}

function pngAsset(id: string, width: number, height: number, draw?: (ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>) => void): ImageAsset {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (draw) draw(ctx);
  else {
    ctx.fillStyle = '#3366cc';
    ctx.fillRect(0, 0, width, height);
  }
  return { id, format: 'png', bytes: new Uint8Array(canvas.toBuffer('image/png')), width, height };
}

function photoJpeg(width: number, height: number): Uint8Array {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  let seed = 7;
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const p = i / 4;
    image.data[i] = (p % width) & 255;
    image.data[i + 1] = (seed >> 8) & 255;
    image.data[i + 2] = Math.floor(p / width) & 255;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return new Uint8Array(canvas.toBuffer('image/jpeg', { quality: 0.85 }));
}

const rgbOf = (hex: string): [number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function expectNear(got: Pt, want: Pt, what: string, tolerance = TOLERANCE) {
  expect(Math.abs(got[0] - want[0]), `${what} x (got ${got}, want ${want})`).toBeLessThan(tolerance);
  expect(Math.abs(got[1] - want[1]), `${what} y (got ${got}, want ${want})`).toBeLessThan(tolerance);
}

function expectBox(got: VisualBox, want: VisualBox, what: string) {
  for (const k of ['xPct', 'yPct', 'wPct', 'hPct'] as const) {
    expect(Math.abs(got[k] - want[k]), `${what} ${k} (got ${got[k]}, want ${want[k]})`).toBeLessThan(TOLERANCE);
  }
}

function pathWith(page: GraphicsPage, what: string, match: (p: PaintedPath) => boolean): PaintedPath {
  const found = page.paths.filter(match);
  expect(found, `${what}: one matching path`).toHaveLength(1);
  return found[0];
}

// ── Every kind of object, placed where the visitor put it ──────────────────

const COLORS = { rect: '#1D4ED8', ellipse: '#15803D', line: '#DC2626', ink: '#FF6B35', text: '#000000' } as const satisfies Record<string, PaletteColor>;
const BOX = {
  cover: { xPct: 0.05, yPct: 0.1, wPct: 0.2, hPct: 0.08 },
  highlight: { xPct: 0.55, yPct: 0.12, wPct: 0.3, hPct: 0.05 },
  rect: { xPct: 0.1, yPct: 0.3, wPct: 0.25, hPct: 0.12 },
  ellipse: { xPct: 0.5, yPct: 0.3, wPct: 0.3, hPct: 0.15 },
  image: { xPct: 0.6, yPct: 0.55, wPct: 0.25, hPct: 0.1 },
  text: { xPct: 0.08, yPct: 0.58, wPct: 0.45, hPct: 0.1 },
};
const LINE = { from: { x: 0.1, y: 0.8 }, to: { x: 0.45, y: 0.92 } };
const INK = [0.6, 0.75, 0.7, 0.8, 0.65, 0.9, 0.8, 0.85];
const TEXT = 'Signed\nموافق عليه';
const TEXT_SIZE = 14;

function everyKind(pageId: string): EditorObject[] {
  return [
    { id: 'o1', pageId, kind: 'cover', box: BOX.cover },
    { id: 'o2', pageId, kind: 'highlight', box: BOX.highlight },
    { id: 'o3', pageId, kind: 'shape', shape: 'rectangle', box: BOX.rect, color: COLORS.rect, strokeWidth: 3 },
    { id: 'o4', pageId, kind: 'shape', shape: 'ellipse', box: BOX.ellipse, color: COLORS.ellipse, strokeWidth: 2 },
    { id: 'o5', pageId, kind: 'line', from: LINE.from, to: LINE.to, arrow: true, color: COLORS.line, strokeWidth: 4 },
    { id: 'o6', pageId, kind: 'ink', points: INK, color: COLORS.ink, strokeWidth: 6 },
    { id: 'o7', pageId, kind: 'image', box: BOX.image, assetId: 'a1' },
    { id: 'o8', pageId, kind: 'text', box: BOX.text, text: TEXT, size: TEXT_SIZE, color: COLORS.text },
  ];
}

interface PageCase {
  name: string;
  media: Box4;
  crop?: Box4;
  rotate: number;
  added: QuarterTurn;
}

const VARIANTS: Array<{ label: string; media: Box4; crop?: Box4 }> = [
  { label: 'plain', media: [0, 0, 612, 792] },
  // BlendPDF's own crop-pdf output: a CropBox inside an untouched MediaBox.
  { label: 'CropBox', media: [0, 0, 612, 792], crop: [100, 150, 300, 350] },
  { label: 'offset MediaBox', media: [-100, -100, 612, 792] },
];
const CASES: PageCase[] = [
  ...[0, 90, 180, 270].flatMap((rotate) => VARIANTS.map((v) => ({ name: `${v.label}, /Rotate ${rotate}`, media: v.media, crop: v.crop, rotate, added: 0 as QuarterTurn }))),
  // Turns added in the editor on top of the page's own /Rotate: objects are placed on the page as finally shown.
  { name: 'plain, /Rotate 0 + editor 90', media: [0, 0, 612, 792], rotate: 0, added: 90 },
  { name: 'CropBox, /Rotate 90 + editor 90', media: [0, 0, 612, 792], crop: [100, 150, 300, 350], rotate: 90, added: 90 },
  { name: 'offset MediaBox, /Rotate 270 + editor 270', media: [-100, -100, 612, 792], rotate: 270, added: 270 },
  { name: 'CropBox, /Rotate 180 + editor 270', media: [0, 0, 612, 792], crop: [100, 150, 300, 350], rotate: 180, added: 270 },
];

describe('edit-pdf export: placement (pdf.js 3.11 read-back)', () => {
  it.each(CASES)('every kind lands where it was placed: $name', async (c) => {
    const source = await sourcePdf([{ media: c.media, crop: c.crop, rotate: c.rotate }]);
    const asset = pngAsset('a1', 4, 2);
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0, c.added)], everyKind('s0'), { a1: asset }), OPTIONS);
    expect(warnings).toEqual([]);

    const { pages } = await readGraphics(bytes);
    expect(pages).toHaveLength(1);
    const page = pages[0];
    expect(page.rotate).toBe((c.rotate + c.added) % 360);

    const cover = pathWith(page, 'cover', (p) => p.paint === 'fill' && p.fill.join() === '255,255,255');
    expectBox(boundsOf(cover.points), BOX.cover, 'cover');
    expect(cover.blend).toBeNull();

    const highlight = pathWith(page, 'highlight', (p) => p.paint === 'fill' && p.fill.join() === rgbOf(HIGHLIGHT_COLOR).join());
    expectBox(boundsOf(highlight.points), BOX.highlight, 'highlight');
    expect(highlight.blend).toBe('multiply');

    const rect = pathWith(page, 'rectangle', (p) => p.paint === 'stroke' && p.stroke.join() === rgbOf(COLORS.rect).join());
    expectBox(boundsOf(rect.points), BOX.rect, 'rectangle');
    expect([rect.lineWidth, rect.lineJoin]).toEqual([3, 1]);

    const ellipse = pathWith(page, 'ellipse', (p) => p.paint === 'stroke' && p.stroke.join() === rgbOf(COLORS.ellipse).join());
    expectBox(boundsOf(ellipse.points), BOX.ellipse, 'ellipse');
    expect(ellipse.lineWidth).toBe(2);

    const line = pathWith(page, 'arrow', (p) => p.paint === 'stroke' && p.stroke.join() === rgbOf(COLORS.line).join());
    expect([line.lineWidth, line.lineCap, line.lineJoin]).toEqual([4, 1, 1]);
    expect(line.subpaths).toHaveLength(3);
    expectNear(line.subpaths[0][0], [LINE.from.x, LINE.from.y], 'line start');
    expectNear(line.subpaths[0][1], [LINE.to.x, LINE.to.y], 'line end');
    // Arms in points on the page as pdf.js shows it, then back to fractions.
    const arms = arrowHeadArms(
      { x: LINE.from.x * page.width, y: LINE.from.y * page.height },
      { x: LINE.to.x * page.width, y: LINE.to.y * page.height },
      4,
    );
    arms.forEach((arm, i) => {
      expectNear(line.subpaths[i + 1][0], [LINE.to.x, LINE.to.y], `arm ${i} starts at the tip`);
      expectNear(line.subpaths[i + 1][1], [arm.x / page.width, arm.y / page.height], `arm ${i} end`);
    });

    const ink = pathWith(page, 'ink', (p) => p.paint === 'stroke' && p.stroke.join() === rgbOf(COLORS.ink).join());
    expect([ink.lineWidth, ink.lineCap, ink.lineJoin]).toEqual([6, 1, 1]);
    expect(ink.subpaths).toHaveLength(1);
    ink.subpaths[0].forEach((p, i) => expectNear(p, [INK[2 * i], INK[2 * i + 1]], `ink point ${i}`));

    expect(page.images).toHaveLength(1);
    const img = page.images[0];
    const b = BOX.image;
    expectNear(img.tl, [b.xPct, b.yPct], 'image top-left');
    expectNear(img.bl, [b.xPct, b.yPct + b.hPct], 'image bottom-left');
    expectNear(img.br, [b.xPct + b.wPct, b.yPct + b.hPct], 'image bottom-right');

    // Text: upright, each paragraph at its own start edge, baselines where lib/pdf-text puts them.
    const [glyphPage] = await readPdf(bytes);
    const width = BOX.text.wPct * page.width;
    const layout = layoutText(createLayoutFont(FONT_BYTES), TEXT, { size: TEXT_SIZE, maxWidth: width, fallbackDirection: 'ltr' });
    expect(layout.lines.map((l) => l.direction)).toEqual(['ltr', 'rtl']);
    for (const g of glyphPage.glyphs) {
      expect(g.dx).toBeCloseTo(1, 9);
      expect(g.dy).toBeCloseTo(0, 9);
    }
    const top = BOX.text.yPct * page.height;
    layout.lines.forEach((line, i) => {
      const baseline = top + i * layout.lineHeight + layout.baseline;
      const onLine = glyphPage.glyphs.filter((g) => Math.abs(g.y - baseline) < layout.lineHeight / 2);
      expect(onLine).toHaveLength(line.glyphs.length);
      const first = onLine.reduce((a, g) => (g.x < a.x ? g : a));
      const left = BOX.text.xPct * page.width + (line.direction === 'rtl' ? width - line.width : 0);
      expect(first.x).toBeCloseTo(left + line.glyphs[0].x, 4);
      expect(first.y).toBeCloseTo(baseline - line.glyphs[0].y, 4);
    });
  });
});

// ── Page structure ───────────────────────────────────────────────────────────

describe('edit-pdf export: pages', () => {
  it('reorders, turns, deletes and inserts pages in place; bookmarks and links follow their pages', async () => {
    const source = await sourcePdf(
      [
        { marker: 'MARKER-0' },
        { marker: 'MARKER-1' },
        { marker: 'MARKER-2', rotate: 90 },
        { marker: 'MARKER-3', media: [0, 0, 400, 300] },
        { marker: 'MARKER-4', media: [0, 0, 500, 700] },
      ],
      (doc, pages) => {
        const ctx = doc.context;
        const outlinesRef = ctx.nextRef();
        const toC = ctx.register(ctx.obj({ Title: PDFHexString.fromText('Chapter C'), Parent: outlinesRef, Dest: [pages[2].ref, PDFName.of('Fit')] }));
        const toB = ctx.register(ctx.obj({ Title: PDFHexString.fromText('Chapter B'), Parent: outlinesRef, Prev: toC, Dest: [pages[1].ref, PDFName.of('Fit')] }));
        ctx.lookup(toC, PDFDict).set(PDFName.of('Next'), toB);
        ctx.assign(outlinesRef, ctx.obj({ Type: 'Outlines', First: toC, Last: toB, Count: 2 }));
        doc.catalog.set(PDFName.of('Outlines'), outlinesRef);
        const link = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [50, 50, 150, 70], Border: [0, 0, 0], A: { S: 'URI', URI: PDFString.of('https://blendpdf.com') } }));
        pages[0].node.addAnnot(link);
      },
    );
    const pages: EditorPage[] = [
      sourcePage(2, 90),
      sourcePage(0),
      { id: 'b1', source: { kind: 'blank', width: 300, height: 400 }, rotation: 0 },
      sourcePage(4, 180),
    ];
    const objects: EditorObject[] = [{ id: 'o1', pageId: 'b1', kind: 'text', box: { xPct: 0.1, yPct: 0.1, wPct: 0.8, hPct: 0.1 }, text: 'Blank page note', size: 12, color: '#000000' }];
    const { bytes, warnings } = await exportEditedPdf(source, request(pages, objects), OPTIONS);
    expect(warnings).toEqual([]);

    const out = await readGraphics(bytes);
    expect(out.pages.map((p) => p.text.match(/MARKER-\d/g) ?? [])).toEqual([['MARKER-2'], ['MARKER-0'], [], ['MARKER-4']]);
    expect(out.pages.map((p) => p.rotate)).toEqual([180, 0, 0, 180]);
    expect(out.pages.map((p) => [p.width, p.height])).toEqual([
      [612, 792],
      [612, 792],
      [300, 400],
      [500, 700],
    ]);
    expect(out.pages[2].text).toContain('Blank page note');
    for (const p of out.pages) expect(p.text).not.toMatch(/MARKER-[13]/);
    expect(out.pages[1].annotations.map((a) => a.subtype)).toEqual(['Link']);
    // The bookmark to page C now opens output page 1; the one to the deleted page B is gone with it
    // (a bookmark's title is usually that page's own heading: tests/edit-pdf-structure.test.ts).
    expect(out.outline).toEqual([{ title: 'Chapter C', pageIndex: 0 }]);
    expect(containsMarker(searchableBytes(bytes), 'Chapter B')).toBe(false);
  });

  it('a page moved out of a branch of the page tree keeps the size, rotation and resources it inherited there', async () => {
    const source = await sourcePdf([{ marker: 'ROOT-0' }, { marker: 'ROOT-1' }, { marker: 'BRANCH-2' }, { marker: 'BRANCH-3' }], (doc, pages) => {
      // Rebuild the tree as Pages[0, 1, Branch[2, 3]] with the branch holding MediaBox, Rotate and Resources.
      const ctx = doc.context;
      const rootRef = doc.catalog.get(PDFName.of('Pages'))!;
      const branch = ctx.obj({ Type: 'Pages', Parent: rootRef, Kids: [pages[2].ref, pages[3].ref], Count: 2, MediaBox: [0, 0, 400, 500], Rotate: 90 });
      branch.set(PDFName.of('Resources'), pages[3].node.get(PDFName.of('Resources'))!);
      const branchRef = ctx.register(branch);
      doc.catalog.Pages().set(PDFName.of('Kids'), ctx.obj([pages[0].ref, pages[1].ref, branchRef]));
      for (const page of [pages[2], pages[3]]) {
        page.node.set(PDFName.of('Parent'), branchRef);
        page.node.delete(PDFName.of('MediaBox'));
      }
      pages[3].node.delete(PDFName.of('Resources'));
    });
    const before = await readGraphics(source);
    expect(before.pages.map((p) => [p.view, p.rotate])).toEqual([
      [[0, 0, 612, 792], 0],
      [[0, 0, 612, 792], 0],
      [[0, 0, 400, 500], 90],
      [[0, 0, 400, 500], 90],
    ]);
    expect(before.pages[3].text).toContain('BRANCH-3');

    const { bytes } = await exportEditedPdf(source, request([sourcePage(3), sourcePage(0), sourcePage(2)], []), OPTIONS);
    const out = await readGraphics(bytes);
    expect(out.pages.map((p) => [p.view, p.rotate])).toEqual([
      [[0, 0, 400, 500], 90],
      [[0, 0, 612, 792], 0],
      [[0, 0, 400, 500], 90],
    ]);
    expect(out.pages.map((p) => p.text.trim())).toEqual(['BRANCH-3', 'ROOT-0', 'BRANCH-2']);
  });

  it('a page tree with a wrong /Count: the deleted page leaves and the highlight lands on the page the visitor saw', async () => {
    const source = await sourcePdf([{ marker: 'PAGE-ONE' }, { marker: 'PAGE-TWO' }, { marker: 'PAGE-THREE' }], (doc, pages) => {
      // Pages[Branch[1, 2] that claims /Count 1, 3]: viewers count the kids and show all three pages.
      const ctx = doc.context;
      const rootRef = doc.catalog.get(PDFName.of('Pages'))!;
      const branchRef = ctx.register(ctx.obj({ Type: 'Pages', Parent: rootRef, Kids: [pages[0].ref, pages[1].ref], Count: 1 }));
      for (const page of [pages[0], pages[1]]) page.node.set(PDFName.of('Parent'), branchRef);
      doc.catalog.Pages().set(PDFName.of('Kids'), ctx.obj([branchRef, pages[2].ref]));
    });
    expect((await readGraphics(source)).pages.map((p) => p.text.trim())).toEqual(['PAGE-ONE', 'PAGE-TWO', 'PAGE-THREE']);

    const objects: EditorObject[] = [{ id: 'o1', pageId: 's2', kind: 'highlight', box: BOX.highlight }];
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0), sourcePage(2)], objects), OPTIONS);
    const out = await readGraphics(bytes);
    expect(out.pages.map((p) => p.text.trim())).toEqual(['PAGE-ONE', 'PAGE-THREE']);
    const highlight = (page: GraphicsPage) => page.paths.some((p) => p.paint === 'fill' && p.fill.join() === rgbOf(HIGHLIGHT_COLOR).join());
    expect(out.pages.map(highlight)).toEqual([false, true]);
  });

  it('an added blank page does not inherit a /CropBox (or /Rotate) the page tree holds for the original pages', async () => {
    const source = await sourcePdf([{ marker: 'ORIGINAL' }], (doc) => {
      doc.catalog.Pages().set(PDFName.of('CropBox'), doc.context.obj([100, 100, 400, 400]));
      doc.catalog.Pages().set(PDFName.of('Rotate'), doc.context.obj(90));
    });
    expect((await readGraphics(source)).pages.map((p) => [p.view, p.rotate])).toEqual([[[100, 100, 400, 400], 90]]);

    const blank: EditorPage = { id: 'b1', source: { kind: 'blank', width: 300, height: 300 }, rotation: 0 };
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0), blank], []), OPTIONS);
    const out = await readGraphics(bytes);
    expect(out.pages.map((p) => [p.view, p.rotate])).toEqual([
      [[100, 100, 400, 400], 90],
      [[0, 0, 300, 300], 0],
    ]);
  });

  it('a document of only blank pages and new text: the tree is never left empty', async () => {
    const source = await sourcePdf([{ marker: 'GONE-0' }, { marker: 'GONE-1' }]);
    const blank = (id: string): EditorPage => ({ id, source: { kind: 'blank', width: 595, height: 842 }, rotation: 0 });
    const objects: EditorObject[] = [{ id: 'o1', pageId: 'b2', kind: 'text', box: { xPct: 0.1, yPct: 0.1, wPct: 0.5, hPct: 0.05 }, text: 'Only me', size: 12, color: '#000000' }];
    const { bytes } = await exportEditedPdf(source, request([blank('b1'), blank('b2')], objects), OPTIONS);
    const out = await readGraphics(bytes);
    expect(out.pages.map((p) => p.text.trim())).toEqual(['', 'Only me']);
  });
});

// ── Forms ────────────────────────────────────────────────────────────────────

async function formPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const other = doc.addPage([612, 792]);
  const form = doc.getForm();
  const name = form.createTextField('name');
  name.setText('Jane Doe');
  name.addToPage(page, { x: 100, y: 600, width: 200, height: 24 });
  const agree = form.createCheckBox('agree');
  agree.addToPage(page, { x: 100, y: 550, width: 18, height: 18 });
  agree.check();
  const colour = form.createDropdown('colour');
  colour.addOptions(['Red', 'Blue']);
  colour.select('Blue');
  colour.addToPage(page, { x: 100, y: 500, width: 120, height: 24 });
  // Hidden from view (annotation flag Hidden): flattening must not make it appear.
  const hidden = form.createTextField('hidden');
  hidden.setText('Hidden value');
  hidden.addToPage(page, { x: 350, y: 600, width: 200, height: 24, hidden: true });
  const elsewhere = form.createTextField('elsewhere');
  elsewhere.setText('Elsewhere');
  elsewhere.addToPage(other, { x: 100, y: 600, width: 200, height: 24 });
  return doc.save();
}

describe('edit-pdf export: forms', () => {
  it('flattens a filled form into the page, so additions sit on top, and the saved PDF has no fields', async () => {
    const source = await formPdf();
    const before = await readGraphics(source);
    expect(before.pages[0].annotations.filter((a) => a.subtype === 'Widget')).toHaveLength(4);
    expect(before.pages[0].text).not.toContain('Jane Doe'); // widget appearances are not page text before flattening

    const objects: EditorObject[] = [{ id: 'o1', pageId: 's0', kind: 'cover', box: { xPct: 0.6, yPct: 0.6, wPct: 0.2, hPct: 0.1 } }];
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0)], objects), OPTIONS);
    expect(warnings).toEqual([]);

    const out = await readGraphics(bytes);
    expect(out.pages).toHaveLength(1);
    expect(out.pages[0].annotations).toEqual([]);
    expect(out.pages[0].text).toContain('Jane Doe');
    expect(out.pages[0].text).toContain('Blue');
    expect(out.pages[0].text).not.toContain('Hidden value');
    // The flattened value sits inside the field's rectangle (x 100..300, y 600..624 in user space).
    const [glyphPage] = await readPdf(bytes);
    const jane = glyphPage.glyphs.filter((g) => g.unicode === 'J' || g.unicode === 'D'); // only "Jane Doe" has them
    expect(jane).toHaveLength(2);
    for (const g of jane) {
      expect(g.x).toBeGreaterThan(100);
      expect(g.x).toBeLessThan(300);
      expect(792 - g.y).toBeGreaterThan(600);
      expect(792 - g.y).toBeLessThan(624);
    }
    const saved = await PDFDocument.load(bytes);
    expect(saved.catalog.get(PDFName.of('AcroForm'))).toBeUndefined();
  });

  it('a field it cannot flatten (Arabic value, no appearance) stays a working field and is reported; the rest are flattened', async () => {
    const doc = await PDFDocument.load(await formPdf());
    const form = doc.getForm();
    const arabic = form.createTextField('arabic');
    arabic.addToPage(doc.getPage(0), { x: 300, y: 400, width: 200, height: 24 });
    arabic.acroField.getWidgets()[0].dict.delete(PDFName.of('AP'));
    arabic.acroField.dict.set(PDFName.of('V'), PDFHexString.fromText('مرحبا'));
    const source = await doc.save({ updateFieldAppearances: false });

    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0)], []), OPTIONS);
    expect(warnings).toEqual([{ code: 'FORM_NOT_FLATTENED', fields: 1 }]);
    const out = await readGraphics(bytes);
    expect(out.pages[0].annotations.map((a) => [a.subtype, a.fieldType])).toEqual([['Widget', 'Tx']]);
    expect(out.pages[0].text).toContain('Jane Doe');
    const saved = await PDFDocument.load(bytes);
    expect(saved.getForm().getFields().map((f) => f.getName())).toEqual(['arabic']);
  });

  it('with /NeedAppearances, a text field is redrawn from its value instead of flattening a stale appearance', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const field = doc.getForm().createTextField('stale');
    field.setText('Old value');
    field.addToPage(page, { x: 100, y: 600, width: 200, height: 24 });
    const first = await PDFDocument.load(await doc.save());
    const acroForm = first.catalog.AcroForm()!;
    acroForm.set(PDFName.of('NeedAppearances'), PDFBool.True);
    first.getForm().getTextField('stale').acroField.dict.set(PDFName.of('V'), PDFHexString.fromText('Fresh value'));
    const source = await first.save({ updateFieldAppearances: false });

    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0)], []), OPTIONS);
    expect(warnings).toEqual([]);
    const out = await readGraphics(bytes);
    expect(out.pages[0].text).toContain('Fresh value');
    expect(out.pages[0].text).not.toContain('Old value');
  });

  it('does not create an AcroForm in a file that has none', async () => {
    const source = await sourcePdf([{ marker: 'NO-FORM' }]);
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0)], everyKind('s0').filter((o) => o.kind !== 'image')), OPTIONS);
    const saved = await PDFDocument.load(bytes);
    expect(saved.catalog.get(PDFName.of('AcroForm'))).toBeUndefined();
  });
});

// ── Annotations that stay ────────────────────────────────────────────────────

describe('edit-pdf export: annotations', () => {
  it('keeps comments, and warns about each addition that a visible one would cover', async () => {
    const source = await sourcePdf([{ marker: 'NOTES' }], (doc, [page]) => {
      const ctx = doc.context;
      const add = (dict: Record<string, unknown>) => page.node.addAnnot(ctx.register(ctx.obj(dict as never)));
      add({ Type: 'Annot', Subtype: 'Text', Rect: [100, 600, 124, 624], Contents: PDFString.of('Check this'), F: 4 });
      add({ Type: 'Annot', Subtype: 'Link', Rect: [300, 300, 400, 320], Border: [0, 0, 0] });
      add({ Type: 'Annot', Subtype: 'Square', Rect: [400, 100, 450, 150], F: 2 });
    });
    const y = (userY: number) => (792 - userY) / 792;
    const objects: EditorObject[] = [
      // Over the sticky note.
      { id: 'cover-note', pageId: 's0', kind: 'cover', box: { xPct: 0.15, yPct: 0.2, wPct: 0.05, hPct: 0.03 } },
      // A horizontal line through the note: zero-height bounds, so only its stroke width overlaps.
      { id: 'line-note', pageId: 's0', kind: 'line', from: { x: 0.1, y: y(612) }, to: { x: 0.3, y: y(612) }, arrow: false, color: '#000000', strokeWidth: 2 },
      // Over a link (draws nothing) and a hidden square: no warning.
      { id: 'over-link', pageId: 's0', kind: 'highlight', box: { xPct: 0.5, yPct: 0.6, wPct: 0.1, hPct: 0.01 } },
      { id: 'over-hidden', pageId: 's0', kind: 'ink', points: [0.66, 0.82, 0.72, 0.86], color: '#000000', strokeWidth: 2 },
      // Far from everything.
      { id: 'clear', pageId: 's0', kind: 'cover', box: { xPct: 0.7, yPct: 0.05, wPct: 0.1, hPct: 0.05 } },
    ];
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0)], objects), OPTIONS);
    expect(warnings).toEqual<ExportWarning[]>([
      { code: 'OVERLAPS_ANNOTATION', objectId: 'cover-note', pageNumber: 1 },
      { code: 'OVERLAPS_ANNOTATION', objectId: 'line-note', pageNumber: 1 },
    ]);
    const out = await readGraphics(bytes);
    expect(out.pages[0].annotations.map((a) => a.subtype).sort()).toEqual(['Link', 'Square', 'Text']);
  });
});

// ── Images ───────────────────────────────────────────────────────────────────

describe('edit-pdf export: images', () => {
  it('embeds a passed-through JPEG byte for byte (DCTDecode), so the file grows by about the photo', async () => {
    const jpeg = photoJpeg(320, 240);
    const source = await sourcePdf([{ marker: 'PHOTO' }]);
    const asset: ImageAsset = { id: 'a1', format: 'jpg', bytes: jpeg, width: 320, height: 240 };
    const image: EditorObject = { id: 'o1', pageId: 's0', kind: 'image', box: { xPct: 0.1, yPct: 0.1, wPct: 0.5, hPct: 0.3 }, assetId: 'a1' };
    const withPhoto = await exportEditedPdf(source, request([sourcePage(0)], [image], { a1: asset }), OPTIONS);
    const without = await exportEditedPdf(source, request([sourcePage(0)], []), OPTIONS);

    const saved = await PDFDocument.load(withPhoto.bytes);
    const dct = saved.context
      .enumerateIndirectObjects()
      .map(([, object]) => object)
      .filter((o): o is PDFRawStream => o instanceof PDFRawStream && o.dict.lookup(PDFName.of('Filter')) === PDFName.of('DCTDecode'));
    expect(dct).toHaveLength(1);
    expect(Buffer.from(dct[0].contents).equals(Buffer.from(jpeg))).toBe(true);
    const growth = withPhoto.bytes.length - without.bytes.length;
    expect(growth).toBeGreaterThanOrEqual(jpeg.length);
    expect(growth).toBeLessThan(jpeg.length + 1024);
  });

  it('gives a PNG with transparency a soft mask, and embeds an asset used twice once', async () => {
    const asset = pngAsset('a1', 40, 20, (ctx) => {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(20, 10, 8, 0, Math.PI * 2);
      ctx.fill();
    });
    const source = await sourcePdf([{ marker: 'ALPHA' }]);
    const objects: EditorObject[] = [
      { id: 'o1', pageId: 's0', kind: 'image', box: { xPct: 0.1, yPct: 0.1, wPct: 0.3, hPct: 0.1 }, assetId: 'a1', signature: true },
      { id: 'o2', pageId: 's0', kind: 'image', box: { xPct: 0.5, yPct: 0.5, wPct: 0.3, hPct: 0.1 }, assetId: 'a1' },
    ];
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0)], objects, { a1: asset }), OPTIONS);
    const saved = await PDFDocument.load(bytes);
    const images = saved.context
      .enumerateIndirectObjects()
      .map(([, o]) => o)
      .filter((o): o is PDFRawStream => o instanceof PDFRawStream && o.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Image'));
    const withMask = images.filter((o) => o.dict.has(PDFName.of('SMask')));
    expect(withMask).toHaveLength(1);
    expect(images).toHaveLength(2); // the picture and its mask
    expect((await readGraphics(bytes)).pages[0].images).toHaveLength(2);
  });
});

// ── Text ─────────────────────────────────────────────────────────────────────

describe('edit-pdf export: text', () => {
  it('writes Arabic as real text: every word can be found in what pdf.js extracts', async () => {
    const text = 'يرجى التوقيع هنا والتاريخ في نهاية الصفحة\nالاسم: محمد عبد الله';
    const source = await sourcePdf([{}]);
    const objects: EditorObject[] = [{ id: 'o1', pageId: 's0', kind: 'text', box: { xPct: 0.1, yPct: 0.1, wPct: 0.8, hPct: 0.1 }, text, size: 16, color: '#1D4ED8' }];
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0)], objects, {}, 'rtl'), OPTIONS);
    const extracted = new Set((await readGraphics(bytes)).pages[0].text.replace(/[:]/g, ' ').split(/\s+/).filter(Boolean));
    const words = text.replace(/[:]/g, ' ').split(/\s+/).filter(Boolean);
    expect(words.filter((w) => !extracted.has(w))).toEqual([]);
  });

  it('a box with no letters at all takes the fallback direction (the UI locale): RTL ends at the right edge', async () => {
    const source = await sourcePdf([{}]);
    const box = { xPct: 0.1, yPct: 0.1, wPct: 0.5, hPct: 0.05 };
    const text = '2026/10/14';
    const objects: EditorObject[] = [{ id: 'o1', pageId: 's0', kind: 'text', box, text, size: 12, color: '#000000' }];
    for (const fallbackDirection of ['ltr', 'rtl'] as const) {
      const { bytes } = await exportEditedPdf(source, request([sourcePage(0)], objects, {}, fallbackDirection), OPTIONS);
      const [page] = await readPdf(bytes);
      const layout = layoutText(createLayoutFont(FONT_BYTES), text, { size: 12, fallbackDirection });
      const left = Math.min(...page.glyphs.map((g) => g.x));
      const start = 0.1 * 612 + (fallbackDirection === 'rtl' ? 0.5 * 612 - layout.lines[0].width : 0);
      expect(left, fallbackDirection).toBeCloseTo(start + layout.lines[0].glyphs[0].x, 4);
    }
  });

  it('saves a box with characters Cairo lacks as a picture, through the rasterizer, at the box width', async () => {
    const source = await sourcePdf([{ rotate: 90 }]);
    const box = { xPct: 0.2, yPct: 0.3, wPct: 0.4, hPct: 0.05 };
    const objects: EditorObject[] = [{ id: 'emoji', pageId: 's0', kind: 'text', box, text: 'Done 😀', size: 18, color: '#DC2626' }];
    const rasterize = vi.fn(async (input: RasterTextInput) => {
      const width = Math.ceil(input.width * input.scale);
      const height = Math.ceil(18 * 1.6 * input.scale);
      return { format: 'png' as const, bytes: new Uint8Array(createCanvas(width, height).toBuffer('image/png')), width, height };
    });
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0)], objects, {}, 'rtl'), { fontBytes: FONT_BYTES, rasterizeText: rasterize });
    expect(warnings).toEqual([{ code: 'TEXT_AS_IMAGE', objectId: 'emoji', pageNumber: 1 }]);
    expect(rasterize).toHaveBeenCalledTimes(1);
    const visualWidth = 792; // /Rotate 90 page shown landscape
    expect(rasterize.mock.calls[0][0]).toEqual({ text: 'Done 😀', size: 18, width: box.wPct * visualWidth, color: '#DC2626', fallbackDirection: 'rtl', scale: 3 });

    const out = await readGraphics(bytes);
    const img = out.pages[0].images[0];
    const pictureHeight = Math.ceil(18 * 1.6 * 3) / 3 / out.pages[0].height;
    expectNear(img.tl, [box.xPct, box.yPct], 'picture top-left');
    expectNear(img.br, [box.xPct + box.wPct, box.yPct + pictureHeight], 'picture bottom-right');
    expect((await readPdf(bytes))[0].glyphs).toEqual([]);
  });

  it('never fetches the font when there is no text to write', async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error('no fetch expected');
    });
    vi.stubGlobal('fetch', fetchSpy);
    try {
      const source = await sourcePdf([{}]);
      const objects: EditorObject[] = [
        { id: 'o1', pageId: 's0', kind: 'cover', box: BOX.cover },
        { id: 'o2', pageId: 's0', kind: 'text', box: BOX.text, text: '   ', size: 12, color: '#000000' },
      ];
      await exportEditedPdf(source, request([sourcePage(0)], objects));
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ── Errors ───────────────────────────────────────────────────────────────────

describe('edit-pdf export: refusals', () => {
  afterEach(() => vi.restoreAllMocks());

  it('refuses an encrypted file with ENCRYPTED, and inspectPdf says so at upload', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.addPage();
    const ctx = doc.context;
    ctx.trailerInfo.Encrypt = ctx.register(ctx.obj({ Filter: 'Standard', V: 1, R: 2, O: PDFString.of('owner'), U: PDFString.of('user'), P: -4 }));
    const encrypted = await doc.save({ useObjectStreams: false });

    expect(await inspectPdf(encrypted)).toEqual({ encrypted: true, pageCount: 2 });
    const error = await exportEditedPdf(encrypted, request([sourcePage(0)], []), OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'ENCRYPTED')).toBe(true);
    expect((error as { errorCode: string }).errorCode).toBe('ENCRYPTED');
  });

  it('says ENCRYPTED, not damaged, when the page tree is out of reach (AES object streams)', async () => {
    // qpdf's AES-256 output keeps the page tree inside encrypted object
    // streams, so pdf-lib sees /Encrypt but no readable /Pages. Simulated:
    // /Encrypt in the trailer and a catalog whose /Pages points at nothing.
    const doc = await PDFDocument.create();
    doc.addPage();
    const ctx = doc.context;
    ctx.trailerInfo.Encrypt = ctx.register(ctx.obj({ Filter: 'Standard', V: 5, R: 6, O: PDFString.of('owner'), U: PDFString.of('user'), P: -4 }));
    doc.catalog.set(PDFName.of('Pages'), ctx.nextRef());
    const encrypted = await doc.save({ useObjectStreams: false });

    expect(await inspectPdf(encrypted)).toEqual({ encrypted: true, pageCount: 0 });
    const error = await exportEditedPdf(encrypted, request([sourcePage(0)], []), OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'ENCRYPTED')).toBe(true);
  });

  it('reports a file pdf-lib cannot read as UNREADABLE', async () => {
    const junk = new TextEncoder().encode('this is not a PDF at all');
    for (const run of [() => inspectPdf(junk), () => exportEditedPdf(junk, request([sourcePage(0)], []), OPTIONS)]) {
      const error = await run().catch((e: unknown) => e);
      expect(isEditPdfError(error, 'UNREADABLE')).toBe(true);
    }
    expect(await inspectPdf(await sourcePdf([{}, {}, {}]))).toEqual({ encrypted: false, pageCount: 3 });
  });

  it.each<[string, ExportRequest]>([
    ['no pages', request([], [])],
    ['a source page that does not exist', request([sourcePage(2)], [])],
    ['the same source page twice', request([sourcePage(0), { ...sourcePage(0), id: 'again' }], [])],
    ['a page id twice', request([sourcePage(0), { ...sourcePage(1), id: 's0' }], [])],
    ['a blank page with no size', request([{ id: 'b1', source: { kind: 'blank', width: 0, height: 100 }, rotation: 0 }], [])],
    ['a rotation that is not a quarter turn', request([{ ...sourcePage(0), rotation: 45 as QuarterTurn }], [])],
    ['an image without its asset', request([sourcePage(0)], [{ id: 'o1', pageId: 's0', kind: 'image', box: BOX.image, assetId: 'missing' }])],
    ['a text box with no size', request([sourcePage(0)], [{ id: 'o1', pageId: 's0', kind: 'text', box: BOX.text, text: 'Hi', size: 0, color: '#000000' }])],
  ])('rejects a request with %s as INVALID_REQUEST', async (_label, bad) => {
    const source = await sourcePdf([{}, {}]);
    const error = await exportEditedPdf(source, bad, OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'INVALID_REQUEST')).toBe(true);
  });

  it('ignores objects on pages that are not in the output (no asset needed for them)', async () => {
    const source = await sourcePdf([{}, {}]);
    const objects: EditorObject[] = [{ id: 'o1', pageId: 's1', kind: 'image', box: BOX.image, assetId: 'missing' }];
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0)], objects), OPTIONS);
    expect((await readGraphics(bytes)).pages[0].images).toEqual([]);
  });
});

// ── 20 pages, 100 objects ────────────────────────────────────────────────────

describe('edit-pdf export: a 20-page file', () => {
  it('exports 100 objects including Arabic text, and logs the time it takes', async () => {
    const source = await sourcePdf(Array.from({ length: 20 }, (_, i) => ({ marker: `PAGE-${i + 1}`, rotate: i % 5 === 0 ? 90 : 0 })));
    const pages = Array.from({ length: 20 }, (_, i) => sourcePage(i, (i % 7 === 0 ? 90 : 0) as QuarterTurn));
    const objects: EditorObject[] = pages.flatMap((page, i) => [
      { id: `t${i}`, pageId: page.id, kind: 'text', box: { xPct: 0.1, yPct: 0.1, wPct: 0.6, hPct: 0.1 }, text: `الصفحة ${i + 1}: يرجى التوقيع هنا قبل 15/10/2026`, size: 14, color: '#000000' },
      { id: `e${i}`, pageId: page.id, kind: 'text', box: { xPct: 0.1, yPct: 0.3, wPct: 0.6, hPct: 0.1 }, text: `Page ${i + 1}: approved by the committee`, size: 12, color: '#1D4ED8' },
      { id: `c${i}`, pageId: page.id, kind: 'cover', box: { xPct: 0.7, yPct: 0.8, wPct: 0.2, hPct: 0.05 } },
      { id: `h${i}`, pageId: page.id, kind: 'highlight', box: { xPct: 0.1, yPct: 0.5, wPct: 0.5, hPct: 0.03 } },
      { id: `i${i}`, pageId: page.id, kind: 'ink', points: Array.from({ length: 40 }, (_, k) => (k % 2 ? 0.6 + 0.1 * Math.sin(k) : 0.2 + k / 100)), color: '#DC2626', strokeWidth: 3 },
    ]);
    expect(objects).toHaveLength(100);

    const timings: number[] = [];
    let bytes: Uint8Array = new Uint8Array();
    for (let run = 0; run < 2; run++) {
      const started = performance.now();
      ({ bytes } = await exportEditedPdf(source, request(pages, objects, {}, 'rtl'), OPTIONS));
      timings.push(performance.now() - started);
    }
    console.log(`[edit-pdf] 20 pages, 100 objects: export ${timings.map((t) => `${t.toFixed(0)} ms`).join(', then ')} in Node; ${bytes.length} bytes`);

    const out = await readGraphics(bytes);
    expect(out.pages).toHaveLength(20);
    out.pages.forEach((page, i) => {
      expect(page.text).toContain(`PAGE-${i + 1}`);
      expect(page.text).toContain('approved by the committee');
      expect(page.paths.length).toBe(3);
    });
    expect(Math.max(...timings)).toBeLessThan(15_000);
  });
});

// ── Edit text (beta): replace objects ───────────────────────────────────────

describe('edit-pdf export: replacing a line of existing text', () => {
  const REPLACE_OPTIONS: ExportOptions = { ...OPTIONS, pdfiumWasm: PDFIUM_WASM };

  function replaceOf(line: SourceTextLine, text: string, extra: Partial<ReplaceObject> = {}): ReplaceObject {
    return {
      id: `r-${line.id}`,
      pageId: `s${line.pageIndex}`,
      kind: 'replace',
      line,
      box: lineBoxAt(line, 0),
      text,
      size: line.geometry.size,
      color: line.color,
      ...extra,
    };
  }

  const allPages = (count: number) => Array.from({ length: count }, (_, i) => sourcePage(i));

  it('an English line: the old words leave the file, the new ones sit on the old baseline from the old start edge', async () => {
    const source = fixture('c-english-invoice.pdf');
    const { lines, pageCount } = await detectPage(source);
    const old = findLine(lines, 'Total due');
    const result = await exportEditedPdf(source, request(allPages(pageCount), [replaceOf(old, 'Total due: 99.00 GBP')]), REPLACE_OPTIONS);
    expect(result.removedLines).toBe(1);
    expect(result.warnings).toEqual([]);
    const after = (await detectPage(result.bytes)).lines;
    const [now] = linesOn(after, old);
    expect(now.text).toBe('Total due: 99.00 GBP');
    expect(Math.abs(now.geometry.baseline - old.geometry.baseline)).toBeLessThan(0.5);
    expect(Math.abs(now.geometry.start - old.geometry.start)).toBeLessThan(0.5);
    expect(squash((await pagesText(result.bytes))[0])).not.toContain('86.00');
    // Every other line is still there, where it was.
    for (const other of lines.filter((l) => l !== old)) expect(after.some((l) => l.text === other.text && Math.abs(l.geometry.baseline - other.geometry.baseline) < 0.05)).toBe(true);
  });

  it('an Arabic line keeps its right edge; pdf.js extracts every new word and reads the line back as the new prefill', async () => {
    for (const [file, selector, text] of [
      ['c-arabic-letter.pdf', 'المدير العام', 'المديرة العامة: سلمى بن سعيد'],
      ['b-arabic-chrome.pdf', 'المبلغ الإجمالي', 'المبلغ الإجمالي هو 300 دولار لا غير'],
    ]) {
      const source = fixture(file);
      const { lines, pageCount } = await detectPage(source);
      const old = findLine(lines, selector);
      expect(old.direction).toBe('rtl');
      const result = await exportEditedPdf(source, request(allPages(pageCount), [replaceOf(old, text)], {}, 'rtl'), REPLACE_OPTIONS);
      expect(result.removedLines).toBe(1);
      const after = (await detectPage(result.bytes)).lines;
      const on = linesOn(after, old);
      expect(on).toHaveLength(1);
      expect(on[0].text, file).toBe(text);
      expect(Math.abs(on[0].geometry.end - old.geometry.end), `${file} right edge`).toBeLessThan(0.5);
      expect(Math.abs(on[0].geometry.baseline - old.geometry.baseline)).toBeLessThan(0.5);
      const extracted = squash((await pagesText(result.bytes))[0]);
      for (const word of text.split(' ')) expect(extracted, `${file}: ${word}`).toContain(squash(word));
    }
    // The old words are gone (LibreOffice's Arabic is extracted faithfully, so this can be checked as text).
    const letter = fixture('c-arabic-letter.pdf');
    const { lines } = await detectPage(letter);
    const result = await exportEditedPdf(letter, request([sourcePage(0)], [replaceOf(findLine(lines, 'المدير العام'), 'التوقيع')], {}, 'rtl'), REPLACE_OPTIONS);
    expect((await detectPage(result.bytes)).lines.some((l) => l.text.includes('خالد'))).toBe(false);
  });

  it('a line on a /Rotate 90 page with an offset CropBox: the new text reads normally where the old line was', async () => {
    const source = fixture('d2-rotate90-cropbox.pdf');
    const { lines } = await detectPage(source);
    const old = findLine(lines, 'Second line');
    const result = await exportEditedPdf(source, request([sourcePage(0)], [replaceOf(old, 'Second line now says PAPAYA-42.')]), REPLACE_OPTIONS);
    const after = (await detectPage(result.bytes)).lines;
    const [now] = linesOn(after, old);
    expect(now.text).toBe('Second line now says PAPAYA-42.');
    expect(now.turn).toBe(0);
    expect(Math.abs(now.geometry.baseline - old.geometry.baseline)).toBeLessThan(0.5);
    expect(Math.abs(now.geometry.start - old.geometry.start)).toBeLessThan(0.5);
    expect(containsMarker(searchableBytes(result.bytes), 'MANGO-310')).toBe(false);
    // On screen, through pdf.js's own viewport: the new line starts at the old line's top-left.
    const page = (await readPdf(result.bytes))[0];
    const first = page.glyphs.find((g) => g.unicode === 'S')!;
    expect([first.dx, first.dy]).toEqual([1, 0]);
    expect(Math.abs(first.x / page.width - old.box.xPct)).toBeLessThan(0.002);
  });

  it('replaces one page, deletes another and reorders, in one request; removedLines counts the lines', async () => {
    const source = fixture('g-chrome-tagged-outline.pdf');
    const first = await detectPage(source, 1);
    const third = await detectPage(source, 3);
    const objects = [replaceOf(findLine(first.lines, 'Page one text'), 'Page one now reads LIME-8.'), replaceOf(findLine(third.lines, 'Chapter three'), 'Chapter three, revised')];
    const result = await exportEditedPdf(source, request([sourcePage(2), sourcePage(0)], objects), REPLACE_OPTIONS);
    expect(result.removedLines).toBe(2);
    const text = (await pagesText(result.bytes)).map(squash);
    expect(text).toHaveLength(2);
    expect(text[0]).toContain(squash('Chapter three, revised'));
    expect(text[1]).toContain(squash('Page one now reads LIME-8.'));
    expect(text[1]).not.toContain(squash('Page one text stays'));
    expect(text.join('')).not.toContain('TOPAZ-55');
  });

  it('a refusal names the OUTPUT page and the object; nothing is saved', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);
    const [complex] = await doc.copyPages(await PDFDocument.load(fixture('h-chrome-complex.pdf')), [0]);
    doc.addPage(complex);
    const source = await doc.save();
    const { lines } = await detectPage(source, 2);
    const object = replaceOf(findLine(lines, 'السطر الأخير'), 'سطر جديد');
    const error = await exportEditedPdf(source, request([sourcePage(1), sourcePage(0)], [object]), REPLACE_OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'REPLACE_REFUSED')).toBe(true);
    expect((error as { objectIds: string[]; pageNumbers: number[] }).objectIds).toEqual([object.id]);
    expect((error as { pageNumbers: number[] }).pageNumbers).toEqual([1]);
  });

  it('a letterhead shared with a page the visitor deleted is replaced: the deleted page does not count', async () => {
    const source = await sharedLetterhead();
    const head = findLine((await detectPage(source, 1)).lines, 'Letterhead');
    const result = await exportEditedPdf(source, request([sourcePage(0)], [replaceOf(head, 'Letterhead NEW-1')]), REPLACE_OPTIONS);
    expect(result.removedLines).toBe(1);
    expect(containsMarker(searchableBytes(result.bytes), 'ACME-SECRET-9')).toBe(false);
    expect(squash((await pagesText(result.bytes))[0])).toContain(squash('Letterhead NEW-1'));
  });

  it("text '' takes the line out and draws nothing (the font is never needed)", async () => {
    const source = fixture('a-latin-pdflib.pdf');
    const { lines } = await detectPage(source);
    const old = findLine(lines, 'Settlement reference');
    const { fontBytes: _unused, ...withoutFont } = REPLACE_OPTIONS;
    void _unused;
    const result = await exportEditedPdf(source, request([sourcePage(0)], [replaceOf(old, '')]), withoutFont);
    expect(result.removedLines).toBe(1);
    expect(linesOn((await detectPage(result.bytes)).lines, old)).toEqual([]);
    expect(containsMarker(searchableBytes(result.bytes), 'QX-4471')).toBe(false);
    expect(containsMarker(searchableBytes(result.bytes), 'Cairo')).toBe(false);
  });

  it('ignores a replace object on a deleted page: PDFium is not even loaded', async () => {
    const source = fixture('g-chrome-tagged-outline.pdf');
    const second = await detectPage(source, 2);
    await releaseTextReplacer();
    const broken: ExportOptions = { ...OPTIONS, pdfiumWasm: new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 9]) };
    const result = await exportEditedPdf(source, request([sourcePage(0), sourcePage(2)], [replaceOf(second.lines[0], 'x')]), broken);
    expect(result.removedLines).toBe(0);
    // And when it must load and can't: REPLACE_UNAVAILABLE, nothing saved.
    const first = await detectPage(source, 1);
    const error = await exportEditedPdf(source, request([sourcePage(0)], [replaceOf(first.lines[0], 'x')]), broken).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'REPLACE_UNAVAILABLE')).toBe(true);
    await loadTextReplacer({ pdfiumWasm: PDFIUM_WASM });
  });

  it('drops /PieceInfo (an app\'s private copy of the page) and /Thumb from a rewritten page; a thumbnail stays on an untouched page', async () => {
    const doc = await PDFDocument.load(fixture('a-latin-pdflib.pdf'));
    doc.addPage([612, 792]).drawText('Untouched second page', { x: 72, y: 700, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) });
    const [first, second] = doc.getPages();
    const ctx = doc.context;
    first.node.set(PDFName.of('PieceInfo'), ctx.obj({ Editor: { Private: ctx.obj({ Copy: PDFString.of('PRIVATE-COPY QX-4471') }) } }));
    first.node.set(PDFName.of('Thumb'), ctx.register(ctx.stream('THUMB-ONE', { Width: 1, Height: 1 })));
    second.node.set(PDFName.of('Thumb'), ctx.register(ctx.stream('THUMB-TWO', { Width: 1, Height: 1 })));
    const source = await doc.save();
    const { lines } = await detectPage(source);
    const result = await exportEditedPdf(source, request([sourcePage(0), sourcePage(1)], [replaceOf(findLine(lines, 'Settlement reference'), 'Settlement reference QX-9000 is confirmed.')]), REPLACE_OPTIONS);
    const raw = searchableBytes(result.bytes);
    expect(containsMarker(raw, 'PRIVATE-COPY')).toBe(false);
    expect(containsMarker(raw, 'QX-4471')).toBe(false);
    expect(containsMarker(raw, 'THUMB-ONE')).toBe(false);
    expect(containsMarker(raw, 'THUMB-TWO')).toBe(true);
    const out = await PDFDocument.load(result.bytes);
    expect(out.getPage(0).node.has(PDFName.of('PieceInfo'))).toBe(false);
    expect(out.getPage(0).node.has(PDFName.of('Thumb'))).toBe(false);
  });

  it('characters Cairo lacks: the new line becomes a picture in the line\'s frame, with a warning', async () => {
    const source = fixture('c-english-invoice.pdf');
    const { lines, pageCount } = await detectPage(source);
    const old = findLine(lines, 'Total due');
    const seen: RasterTextInput[] = [];
    const rasterizeText = async (input: RasterTextInput) => {
      seen.push(input);
      const asset = pngAsset('raster', Math.ceil(input.width * input.scale), Math.ceil(input.size * 1.6 * input.scale));
      return { format: 'png' as const, bytes: asset.bytes, width: asset.width, height: asset.height };
    };
    const result = await exportEditedPdf(source, request(allPages(pageCount), [replaceOf(old, 'Total due ✓ 漢')]), { ...REPLACE_OPTIONS, rasterizeText });
    expect(result.warnings).toEqual([{ code: 'TEXT_AS_IMAGE', objectId: `r-${old.id}`, pageNumber: 1 }]);
    expect(seen).toHaveLength(1);
    const out = await readGraphics(result.bytes);
    const image = out.pages[0].images[0];
    // Upright, starting at the old line's start edge (display fractions through pdf.js's viewport).
    expect(Math.abs(image.bl[0] - old.box.xPct)).toBeLessThan(0.002);
    expect(image.bl[1]).toBeGreaterThan(image.tl[1]);
    expect(linesOn((await detectPage(result.bytes)).lines, old)).toEqual([]);
  });

  it.each<[string, (line: SourceTextLine) => ReplaceObject, EditorPage[]]>([
    ['a replace on a blank page', (line) => ({ ...replaceOf(line, 'x'), pageId: 'b1' }), [sourcePage(0), { id: 'b1', source: { kind: 'blank', width: 612, height: 792 }, rotation: 0 }]],
    ['a line from another source page', (line) => ({ ...replaceOf({ ...line, pageIndex: 1 }, 'x'), pageId: 's0' }), [sourcePage(0), sourcePage(1)]],
    ['a line break in the text', (line) => replaceOf(line, 'two\nlines'), [sourcePage(0)]],
    ['a colour that is not #RRGGBB', (line) => replaceOf(line, 'x', { color: 'red' as `#${string}` }), [sourcePage(0)]],
    ['a size outside 4..72', (line) => replaceOf(line, 'x', { size: 90 }), [sourcePage(0)]],
  ])('rejects %s as INVALID_REQUEST', async (_label, make, pages) => {
    const doc = await PDFDocument.load(fixture('a-latin-pdflib.pdf'));
    doc.addPage([612, 792]);
    const source = await doc.save();
    const { lines } = await detectPage(source);
    const error = await exportEditedPdf(source, request(pages, [make(lines[0])]), REPLACE_OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'INVALID_REQUEST')).toBe(true);
  });

  it('rejects two replace objects for the same line as INVALID_REQUEST', async () => {
    const source = fixture('a-latin-pdflib.pdf');
    const { lines } = await detectPage(source);
    const objects = [replaceOf(lines[0], 'a'), { ...replaceOf(lines[0], 'b'), id: 'twin' }];
    const error = await exportEditedPdf(source, request([sourcePage(0)], objects), REPLACE_OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'INVALID_REQUEST')).toBe(true);
  });

  it('an encrypted file is refused before PDFium sees it', async () => {
    const doc = await PDFDocument.load(fixture('a-latin-pdflib.pdf'));
    const ctx = doc.context;
    ctx.trailerInfo.Encrypt = ctx.register(ctx.obj({ Filter: 'Standard', V: 1, R: 2, O: PDFString.of('owner'), U: PDFString.of('user'), P: -4 }));
    const encrypted = await doc.save({ useObjectStreams: false });
    const { lines } = await detectPage(fixture('a-latin-pdflib.pdf'));
    const error = await exportEditedPdf(encrypted, request([sourcePage(0)], [replaceOf(lines[0], 'x')]), REPLACE_OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'ENCRYPTED')).toBe(true);
  });

});
