/**
 * Workspace engine (workspace-spec.md section 12, E1-E9): crop, the document
 * stamps, keeping a form live, Insert PDF and the text-layer check. Exports
 * run through the facade and are read back with pdf.js 3.11 in Node (the
 * oracle helpers), so positions are what a viewer shows. Expected crop
 * rectangles come from pdf.js's own viewport of the source page, never from
 * lib/pdf-geometry, so a geometry bug cannot hide behind itself.
 */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createCanvas } from 'canvas';
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFString,
  StandardFonts,
  TextRenderingMode,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  setTextRenderingMode,
} from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { createLayoutFont, layoutText } from '../lib/pdf-text';
import {
  LETTERHEAD_MARGIN_PT,
  STAMP_MARGIN_PT,
  letterheadPlacement,
  textExtentOf,
  WATERMARK_ANGLE,
  WATERMARK_COLOR,
  appendPdfs,
  exportEditedPdf,
  hasTextLayer,
  isEditPdfError,
  releaseTextReplacer,
  rotateCropClockwise,
  watermarkImageSize,
} from '../lib/edit-pdf';
import type {
  DocStamps,
  LetterheadStamp,
  EditorObject,
  EditorPage,
  ExportOptions,
  ExportRequest,
  ImageAsset,
  PageNumberStamp,
  QuarterTurn,
  RasterTextInput,
  VisualBox,
  WatermarkStamp,
} from '../lib/edit-pdf';
import { releaseLineFonts } from '../lib/edit-pdf/keep-font/analyze';
import { boundsOf, containsMarker, readGraphics, searchableBytes } from './helpers/edit-pdf-oracle';
import { readPdf, visualLines } from './helpers/pdf-glyph-oracle';
import type { OracleGlyph } from './helpers/pdf-glyph-oracle';
import { analyzeFile, loadPublicFont, replaceWithFont } from './helpers/keep-font';
import { CAIRO, PDFIUM_WASM, detectPage, fixture, linesOn, pagesText, pdfjs } from './helpers/replace-fixtures';

const noRaster = async (): Promise<never> => {
  throw new Error('nothing here should need the picture fallback');
};
const OPTIONS: ExportOptions = { fontBytes: CAIRO, rasterizeText: noRaster };
const TOLERANCE = 1e-6;

afterAll(async () => {
  releaseLineFonts();
  await releaseTextReplacer();
});

const sourcePage = (index: number, rotation: QuarterTurn = 0, crop?: VisualBox): EditorPage => ({
  id: `s${index}`,
  source: { kind: 'source', index },
  rotation,
  ...(crop ? { crop } : {}),
});

function request(pages: EditorPage[], extra: Partial<ExportRequest> = {}): ExportRequest {
  return { pages, objects: [], assets: {}, fallbackDirection: 'ltr', ...extra };
}

/** Letter pages, each with a small Helvetica marker in its middle (away from the stamps' margins). */
async function letterPdf(count: number, tweak?: (doc: PDFDocument, pages: PDFPage[]) => void | Promise<void>): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const pages = Array.from({ length: count }, (_, i) => {
    const page = doc.addPage([612, 792]);
    page.drawText(`MARK${i}`, { x: 290, y: 396, size: 8, font: helvetica });
    return page;
  });
  await tweak?.(doc, pages);
  return doc.save();
}

function pngAsset(id: string, width: number, height: number): ImageAsset {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3366cc';
  ctx.fillRect(0, 0, width, height);
  return { id, format: 'png', bytes: new Uint8Array(canvas.toBuffer('image/png')), width, height };
}

/** The visible rectangle of a visual box of the source page, from pdf.js's viewport: [x0, y0, x1, y1] in user space. */
async function viewportRect(bytes: Uint8Array, box: VisualBox, pageNumber = 1): Promise<number[]> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    const vp = (await doc.getPage(pageNumber)).getViewport({ scale: 1 });
    const corners = [
      vp.convertToPdfPoint(box.xPct * vp.width, box.yPct * vp.height),
      vp.convertToPdfPoint((box.xPct + box.wPct) * vp.width, (box.yPct + box.hPct) * vp.height),
    ] as Array<[number, number]>;
    const xs = corners.map((p) => p[0]);
    const ys = corners.map((p) => p[1]);
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  } finally {
    await doc.destroy();
  }
}

function expectNumbers(got: readonly number[], want: readonly number[], what: string, tolerance = TOLERANCE) {
  expect(got).toHaveLength(want.length);
  got.forEach((value, i) => expect(Math.abs(value - want[i]), `${what}[${i}] (got ${got}, want ${want})`).toBeLessThan(tolerance));
}

/** /CropBox of each page of a saved file, as [x0, y0, x1, y1]. */
async function cropBoxes(bytes: Uint8Array): Promise<number[][]> {
  return (await PDFDocument.load(bytes)).getPages().map((page) => {
    const r = page.getCropBox();
    return [r.x, r.y, r.x + r.width, r.y + r.height];
  });
}

/** Every ExtGState dictionary in a page's resources. */
function extGStates(page: PDFPage): PDFDict[] {
  const states = page.node.Resources()?.lookupMaybe(PDFName.of('ExtGState'), PDFDict);
  return states ? states.values().map((value) => page.doc.context.lookup(value)).filter((v): v is PDFDict => v instanceof PDFDict) : [];
}

const numberOf = (dict: PDFDict, key: string) => dict.lookupMaybe(PDFName.of(key), PDFNumber)?.asNumber();
const squashSpaces = (s: string) => s.replace(/\s+/g, ' ').trim();

const NUMBERS: PageNumberStamp = { position: 'bottom-center', format: 'Page 1 of 10', template: 'Page {n} of {total}', startFrom: 1, size: 12 };
const WATERMARK: WatermarkStamp = { type: 'text', text: 'DRAFT', position: 'diagonal', opacity: 0.3, size: 48 };

// ── E1, E2: crop ─────────────────────────────────────────────────────────────

describe('workspace export: crop', () => {
  it('E1 on a /Rotate 90 page with its own CropBox, /CropBox becomes the crop as the page was shown; a cover keeps its place on the page', async () => {
    const source = fixture('d2-rotate90-cropbox.pdf');
    const crop = { xPct: 0.1, yPct: 0.1, wPct: 0.5, hPct: 0.5 };
    const want = await viewportRect(source, crop);
    const cover: EditorObject = { id: 'c1', pageId: 's0', kind: 'cover', box: { xPct: 0.2, yPct: 0.3, wPct: 0.1, hPct: 0.1 } };
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0, 0, crop)], { objects: [cover] }), OPTIONS);
    expect(warnings).toEqual([]);

    const [page] = (await readGraphics(bytes)).pages;
    expect(page.rotate).toBe(90);
    expectNumbers(page.view, want, 'view');
    // MediaBox untouched (crop-pdf's contract).
    const media = (doc: PDFDocument) => doc.getPage(0).getMediaBox();
    expect(media(await PDFDocument.load(bytes))).toEqual(media(await PDFDocument.load(source)));
    // The cover is where it was on the pre-crop page: (fraction - crop start) / crop size of what is now shown.
    const covers = page.paths.filter((p) => p.paint === 'fill' && p.fill.join() === '255,255,255');
    expect(covers).toHaveLength(1);
    const got = boundsOf(covers[0].points);
    const wantBox = { xPct: (0.2 - 0.1) / 0.5, yPct: (0.3 - 0.1) / 0.5, wPct: 0.1 / 0.5, hPct: 0.1 / 0.5 };
    for (const k of ['xPct', 'yPct', 'wPct', 'hPct'] as const) expect(Math.abs(got[k] - wantBox[k]), k).toBeLessThan(TOLERANCE);
  });

  it.each([
    ['a plain page', async () => letterPdf(1)],
    ['a /Rotate 90 page with a CropBox', async () => fixture('d2-rotate90-cropbox.pdf')],
  ])('E2 crop then turn equals turn then crop (rotateCropClockwise): same /CropBox on %s', async (_name, make) => {
    const source = await make();
    const crop = { xPct: 0.12, yPct: 0.2, wPct: 0.55, hPct: 0.35 };
    let turned = crop;
    const boxes: number[][] = [];
    for (const rotation of [0, 90, 180, 270] as QuarterTurn[]) {
      const { bytes } = await exportEditedPdf(source, request([sourcePage(0, rotation, turned)]), OPTIONS);
      boxes.push((await cropBoxes(bytes))[0]);
      const [page] = (await readGraphics(bytes)).pages;
      expect(page.rotate).toBe((((await PDFDocument.load(source)).getPage(0).getRotation().angle + rotation) % 360 + 360) % 360);
      turned = rotateCropClockwise(turned);
    }
    for (const box of boxes.slice(1)) expectNumbers(box, boxes[0], 'cropbox');
    expectNumbers(boxes[0], await viewportRect(source, crop), 'cropbox vs pdf.js');
  });
});

// ── E3, E4: page numbers ─────────────────────────────────────────────────────

/** Glyphs of the number line: Cairo glyphs near the visible bottom (the markers sit mid-page). */
const bottomGlyphs = (page: { height: number; glyphs: OracleGlyph[] }) => page.glyphs.filter((g) => g.y > page.height - 60);

describe('workspace export: page numbers', () => {
  it('E3 number the saved pages in saved order, from startFrom, inside each visible box (turned page, cropped page)', async () => {
    const source = await letterPdf(5, (doc, pages) => {
      pages[2].setRotation(degrees(90));
      pages[0].node.set(PDFName.of('Thumb'), doc.context.register(doc.context.stream('thumbnail')));
    });
    const crop = { xPct: 0.25, yPct: 0.25, wPct: 0.5, hPct: 0.5 };
    // Page 2 deleted, page 4 moved first, page 5 cropped.
    const pages = [sourcePage(3), sourcePage(0), sourcePage(2), sourcePage(4, 0, crop)];
    const stamps: DocStamps = { pageNumbers: { ...NUMBERS, startFrom: 3 } };
    const { bytes, warnings } = await exportEditedPdf(source, request(pages, { stamps }), OPTIONS);
    expect(warnings).toEqual([]);

    const glyphPages = await readPdf(bytes);
    const textPages = (await readGraphics(bytes)).pages;
    expect(glyphPages).toHaveLength(4);
    expect(textPages.map((p) => p.text.match(/MARK\d/)?.[0])).toEqual(['MARK3', 'MARK0', 'MARK2', 'MARK4']);
    expect(textPages.map((p) => p.rotate)).toEqual([0, 0, 90, 0]);
    expect(glyphPages.map((p) => [p.width, p.height])).toEqual([
      [612, 792],
      [612, 792],
      [792, 612],
      [306, 396],
    ]);

    const font = createLayoutFont(CAIRO);
    glyphPages.forEach((page, i) => {
      const text = `Page ${3 + i} of 6`;
      expect(squashSpaces(textPages[i].text), `page ${i + 1} text`).toContain(text);
      const glyphs = bottomGlyphs(page);
      expect(glyphs.map((g) => g.unicode).join('').replace(/\s/g, ''), `page ${i + 1} glyphs`).toBe(text.replace(/\s/g, ''));
      // Upright, centred, the line's box STAMP_MARGIN_PT above the visible bottom.
      const layout = layoutText(font, text, { size: 12 });
      const baseline = page.height - STAMP_MARGIN_PT - layout.height + layout.baseline;
      const left = (page.width - layout.width) / 2 + layout.lines[0].glyphs[0].x;
      for (const g of glyphs) {
        expect(Math.abs(g.y - baseline), `page ${i + 1} baseline`).toBeLessThan(1e-3);
        expect([g.dx, g.dy]).toEqual([1, 0]);
      }
      expect(Math.abs(Math.min(...glyphs.map((g) => g.x)) - left), `page ${i + 1} start`).toBeLessThan(1e-3);
      expect(glyphs.every((g) => g.x >= 0 && g.x <= page.width && g.y <= page.height - STAMP_MARGIN_PT)).toBe(true);
    });

    // The stale thumbnail of a stamped page goes.
    const saved = await PDFDocument.load(bytes);
    expect(saved.getPage(1).node.get(PDFName.of('Thumb'))).toBeUndefined();
  });

  it('E4 an Arabic template is shaped, reads right to left on the page and extracts in logical order', async () => {
    const source = await letterPdf(2);
    const stamps: DocStamps = { pageNumbers: { ...NUMBERS, template: 'صفحة {n} من {total}', startFrom: 9 } };
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0), sourcePage(1)], { stamps, fallbackDirection: 'rtl' }), OPTIONS);
    const glyphPages = await readPdf(bytes);
    const extracted = await pagesText(bytes);
    ['صفحة 9 من 10', 'صفحة 10 من 10'].forEach((text, i) => {
      expect(squashSpaces(extracted[i]), `page ${i + 1}`).toContain(text);
      const layout = layoutText(createLayoutFont(CAIRO), text, { size: 12 });
      // Visual order, left to right: the number of pages first, the word "page" last; digits keep their order.
      expect(visualLines(bottomGlyphs(glyphPages[i]), layout.lineHeight)).toEqual([text.split(' ').reverse().map((w) => (/\d/.test(w) ? w : [...w].reverse().join(''))).join(' ')]);
    });
  });
});

// ── E5: watermark ────────────────────────────────────────────────────────────

describe('workspace export: watermark', () => {
  it('E5 diagonal text at 45° for the reader on /Rotate 0 and 90 pages, centred, grey, with ca = CA = opacity', async () => {
    const source = await letterPdf(2, (_doc, pages) => pages[1].setRotation(degrees(90)));
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0), sourcePage(1)], { stamps: { watermark: WATERMARK } }), OPTIONS);
    expect(warnings).toEqual([]);

    const layout = layoutText(createLayoutFont(CAIRO), 'DRAFT', { size: 48 });
    const [w, h] = [layout.width, layout.height];
    const a = (WATERMARK_ANGLE * Math.PI) / 180;
    // The first glyph's origin in the box (y up), centred on the origin, turned counter-clockwise.
    const [x0, y0] = [layout.lines[0].glyphs[0].x - w / 2, -layout.baseline + h / 2];
    const [rx, ry] = [x0 * Math.cos(a) - y0 * Math.sin(a), x0 * Math.sin(a) + y0 * Math.cos(a)];
    const grey = Number.parseInt(WATERMARK_COLOR.slice(1, 3), 16);

    const glyphPages = await readPdf(bytes);
    for (const page of glyphPages) {
      const glyphs = page.glyphs.filter((g) => g.fill.join() === [grey, grey, grey].join());
      expect(glyphs.map((g) => g.unicode).join('')).toBe('DRAFT');
      for (const g of glyphs) {
        expect(g.dx).toBeCloseTo(Math.cos(a), 9);
        expect(g.dy).toBeCloseTo(-Math.sin(a), 9); // display y points down: up-right for the reader
      }
      expect(Math.abs(glyphs[0].x - (page.width / 2 + rx))).toBeLessThan(1e-3);
      expect(Math.abs(glyphs[0].y - (page.height / 2 - ry))).toBeLessThan(1e-3);
    }
    const saved = await PDFDocument.load(bytes);
    for (const page of saved.getPages()) {
      expect(extGStates(page).some((gs) => numberOf(gs, 'ca') === 0.3 && numberOf(gs, 'CA') === 0.3)).toBe(true);
    }
  });

  it('E5 an image watermark is drawn upright, centred, at watermarkImageSize, with its opacity', async () => {
    const source = await letterPdf(1);
    const asset = pngAsset('wm', 400, 200);
    const stamps: DocStamps = { watermark: { type: 'image', text: '', assetId: 'wm', position: 'center', opacity: 0.5, size: 48 } };
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0)], { stamps, assets: { wm: asset } }), OPTIONS);
    const [page] = (await readGraphics(bytes)).pages;
    expect(page.images).toHaveLength(1);
    const { bl, br, tl } = page.images[0];
    const size = watermarkImageSize(asset, { width: 612, height: 792 });
    expect(Math.abs((br[0] - bl[0]) * 612 - size.width)).toBeLessThan(1e-6);
    expect(Math.abs((bl[1] - tl[1]) * 792 - size.height)).toBeLessThan(1e-6);
    expect(Math.abs(br[1] - bl[1])).toBeLessThan(1e-9); // upright
    expect(Math.abs((bl[0] + br[0]) / 2 - 0.5)).toBeLessThan(1e-9);
    expect(Math.abs((bl[1] + tl[1]) / 2 - 0.5)).toBeLessThan(1e-9);
    const saved = await PDFDocument.load(bytes);
    expect(extGStates(saved.getPage(0)).some((gs) => numberOf(gs, 'ca') === 0.5 && numberOf(gs, 'CA') === 0.5)).toBe(true);
  });

  it('E5 tiled text covers the page in a grid, every copy turned', async () => {
    const source = await letterPdf(1);
    const { bytes } = await exportEditedPdf(source, request([sourcePage(0)], { stamps: { watermark: { ...WATERMARK, position: 'tiled', size: 24 } } }), OPTIONS);
    const [page] = await readPdf(bytes);
    const firsts = page.glyphs.filter((g) => g.unicode === 'D');
    expect(firsts.length).toBeGreaterThan(4);
    for (const g of firsts) expect(g.dy).toBeCloseTo(-Math.sin((WATERMARK_ANGLE * Math.PI) / 180), 9);
  });

  it('E5 text Cairo cannot draw is pictured once through the injected rasterizer, turned, with one TEXT_AS_IMAGE', async () => {
    const source = await letterPdf(2, (_doc, pages) => pages[1].setRotation(degrees(90)));
    const rasterize = vi.fn(async (input: RasterTextInput) => {
      const width = Math.ceil(input.width * input.scale);
      const height = Math.ceil(input.size * 1.6 * input.scale);
      return { format: 'png' as const, bytes: new Uint8Array(createCanvas(width, height).toBuffer('image/png')), width, height };
    });
    const stamps: DocStamps = { watermark: { ...WATERMARK, text: 'DRAFT 😀' } };
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0), sourcePage(1)], { stamps }), { fontBytes: CAIRO, rasterizeText: rasterize });
    expect(rasterize).toHaveBeenCalledTimes(1);
    expect(rasterize.mock.calls[0][0]).toMatchObject({ text: 'DRAFT 😀', size: 48, color: WATERMARK_COLOR });
    expect(warnings).toEqual([{ code: 'TEXT_AS_IMAGE', objectId: 'stamp:watermark', pageNumber: 1 }]);
    for (const page of (await readGraphics(bytes)).pages) {
      expect(page.images).toHaveLength(1);
      const { bl, br } = page.images[0];
      const [dx, dy] = [(br[0] - bl[0]) * page.width, (br[1] - bl[1]) * page.height];
      expect(Math.atan2(-dy, dx)).toBeCloseTo((WATERMARK_ANGLE * Math.PI) / 180, 9);
    }
  });

  it('E5 page numbers Cairo cannot draw are pictured too, with one TEXT_AS_IMAGE for the stamp', async () => {
    const source = await letterPdf(2);
    const rasterize = vi.fn(async (input: RasterTextInput) => {
      const width = Math.ceil(input.width * input.scale);
      const height = Math.ceil(input.size * 1.6 * input.scale);
      return { format: 'png' as const, bytes: new Uint8Array(createCanvas(width, height).toBuffer('image/png')), width, height };
    });
    const stamps: DocStamps = { pageNumbers: { ...NUMBERS, template: '😀 {n}' } };
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0), sourcePage(1)], { stamps }), { fontBytes: CAIRO, rasterizeText: rasterize });
    expect(rasterize.mock.calls.map(([input]) => input.text)).toEqual(['😀 1', '😀 2']);
    expect(warnings).toEqual([{ code: 'TEXT_AS_IMAGE', objectId: 'stamp:pageNumbers', pageNumber: 1 }]);
    for (const page of (await readGraphics(bytes)).pages) {
      expect(page.images).toHaveLength(1);
      // Its bottom edge STAMP_MARGIN_PT above the page's bottom.
      expect(Math.abs(page.images[0].bl[1] * page.height - (page.height - STAMP_MARGIN_PT))).toBeLessThan(1e-6);
    }
  });
});

// ── E6: keeping the form live ───────────────────────────────────────────────

async function twoFieldPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const [first, second] = [doc.addPage([612, 792]), doc.addPage([612, 792])];
  const form = doc.getForm();
  const keep = form.createTextField('keep');
  keep.setText('Kept value');
  keep.addToPage(first, { x: 100, y: 600, width: 200, height: 24 });
  const gone = form.createTextField('gone');
  gone.setText('GONE-VALUE-123');
  gone.addToPage(second, { x: 100, y: 600, width: 200, height: 24 });
  return doc.save();
}

describe('workspace export: flattenForm', () => {
  it('E6 false: fields on kept pages stay fillable; a field only on a deleted page is removed and pruned', async () => {
    const { bytes, warnings } = await exportEditedPdf(await twoFieldPdf(), request([sourcePage(0)], { flattenForm: false }), OPTIONS);
    expect(warnings).toEqual([]);
    const [page] = (await readGraphics(bytes)).pages;
    expect(page.annotations.map((a) => [a.subtype, a.fieldType])).toEqual([['Widget', 'Tx']]);
    const form = (await PDFDocument.load(bytes)).getForm();
    expect(form.getFields().map((f) => f.getName())).toEqual(['keep']);
    expect(form.getTextField('keep').getText()).toBe('Kept value');
    expect(containsMarker(searchableBytes(bytes), 'GONE-VALUE-123')).toBe(false);
  });

  it('E6 false with every page kept leaves the form exactly as it was (both fields)', async () => {
    const { bytes } = await exportEditedPdf(await twoFieldPdf(), request([sourcePage(1, 90), sourcePage(0)], { flattenForm: false }), OPTIONS);
    expect((await PDFDocument.load(bytes)).getForm().getFields().map((f) => f.getName()).sort()).toEqual(['gone', 'keep']);
  });

  it('E6 true (and absent): every field is flattened as before', async () => {
    for (const flattenForm of [true, undefined]) {
      const { bytes } = await exportEditedPdf(await twoFieldPdf(), request([sourcePage(0)], { flattenForm }), OPTIONS);
      const [page] = (await readGraphics(bytes)).pages;
      expect(page.annotations).toEqual([]);
      expect(page.text).toContain('Kept value');
      expect((await PDFDocument.load(bytes)).catalog.get(PDFName.of('AcroForm'))).toBeUndefined();
    }
  });
});

// ── E7: Insert PDF ──────────────────────────────────────────────────────────

async function encryptedPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  const ctx = doc.context;
  ctx.trailerInfo.Encrypt = ctx.register(ctx.obj({ Filter: 'Standard', V: 1, R: 2, O: PDFString.of('owner'), U: PDFString.of('user'), P: -4 }));
  return doc.save({ useObjectStreams: false });
}

/** The page's /Font entries: name -> object number. */
async function fontRefs(bytes: Uint8Array, pageIndex = 0): Promise<Record<string, number>> {
  const doc = await PDFDocument.load(bytes);
  const fonts = doc.getPage(pageIndex).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
  const out: Record<string, number> = {};
  for (const [key, value] of fonts.entries()) if (value instanceof PDFRef) out[key.decodeText()] = value.objectNumber;
  return out;
}

describe('workspace: appendPdfs', () => {
  it('E7 appends the readable files at the end, skips encrypted and unreadable ones, and keeps every object number', async () => {
    const source = fixture('c-english-invoice.pdf');
    const extra = await letterPdf(2);
    const junk = new TextEncoder().encode('this is not a PDF at all');
    const result = await appendPdfs(source, [
      { name: 'extra.pdf', bytes: extra },
      { name: 'locked.pdf', bytes: await encryptedPdf() },
      { name: 'junk.pdf', bytes: junk },
    ]);
    expect(result.added).toEqual([{ name: 'extra.pdf', pages: 2 }]);
    expect(result.skipped).toEqual([
      { name: 'locked.pdf', reason: 'ENCRYPTED' },
      { name: 'junk.pdf', reason: 'UNREADABLE' },
    ]);

    const before = await PDFDocument.load(source);
    const after = await PDFDocument.load(result.bytes);
    expect(after.getPageCount()).toBe(3);
    expect(after.getPage(0).ref).toEqual(before.getPage(0).ref);
    expect(await fontRefs(result.bytes)).toEqual(await fontRefs(source));
    // Every object of the source is still there under its own number (object streams aside: pdf-lib unpacks them).
    for (const [ref, object] of before.context.enumerateIndirectObjects()) {
      expect(after.context.lookup(ref)?.constructor.name, ref.toString()).toBe(object.constructor.name);
    }
    const text = await pagesText(result.bytes);
    expect(text[0]).toBe((await pagesText(source))[0]);
    expect(text.slice(1).map((t) => t.match(/MARK\d/)?.[0])).toEqual(['MARK0', 'MARK1']);
  });

  it('E7 nothing readable to add: the source comes back as it is', async () => {
    const source = await letterPdf(1);
    const result = await appendPdfs(source, [{ name: 'locked.pdf', bytes: await encryptedPdf() }]);
    expect(result.bytes).toBe(source);
    expect(result.added).toEqual([]);
  });

  it('E7 gate: a line changed in its own font (analysed before the insert) is still drawn in that font object after it', async () => {
    const source = fixture('c-english-invoice.pdf');
    const { lines } = await analyzeFile(source);
    const { line, font } = lines.find((l) => l.line.id === '0:12')!;
    expect(font).not.toBeNull();
    const object = replaceWithFont(line, font, 'Total due: 68.00 GBP');

    const appended = await appendPdfs(source, [{ name: 'extra.pdf', bytes: await letterPdf(2) }]);
    const pages = [sourcePage(0), sourcePage(1), sourcePage(2)];
    const options: ExportOptions = { fontBytes: CAIRO, pdfiumWasm: PDFIUM_WASM, loadFont: loadPublicFont, rasterizeText: noRaster };
    const result = await exportEditedPdf(appended.bytes, request(pages, { objects: [object] }), options);
    expect(result.removedLines).toBe(1);
    expect(result.warnings).toEqual([]);

    // The same font object PDFium kept in the original file (44 0 R, tests/edit-pdf-keep-font-export.test.ts).
    const doc = await PDFDocument.load(result.bytes);
    const fonts = doc.getPage(0).node.Resources()!.lookup(PDFName.of('Font'), PDFDict);
    const kept = fonts.entries().filter(([key]) => key.decodeText().startsWith('KF'));
    expect(kept.map(([key, value]) => [key.decodeText(), (value as PDFRef).objectNumber])).toEqual([['KF0', 44]]);
    expect(linesOn((await detectPage(result.bytes)).lines, line).map((l) => l.text)).toEqual(['Total due: 68.00 GBP']);
    expect(doc.getPageCount()).toBe(3);
    expect((await pagesText(result.bytes)).slice(1).map((t) => t.match(/MARK\d/)?.[0])).toEqual(['MARK0', 'MARK1']);
  });
});

// ── E8: text layer ──────────────────────────────────────────────────────────

async function withPdfJs<T>(bytes: Uint8Array, run: (doc: { numPages: number; getPage: (n: number) => Promise<unknown> }) => Promise<T>): Promise<T> {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
  try {
    return await run(doc);
  } finally {
    await doc.destroy();
  }
}

describe('workspace: hasTextLayer', () => {
  type Proxy = Parameters<typeof hasTextLayer>[0];

  it('E8 false on an image-only file, true on a text file and on an invisible OCR layer', async () => {
    const scan = await (async () => {
      const doc = await PDFDocument.create();
      const image = await doc.embedPng(pngAsset('scan', 200, 260).bytes);
      for (let i = 0; i < 2; i++) doc.addPage([612, 792]).drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
      return doc.save();
    })();
    expect(await withPdfJs(scan, (doc) => hasTextLayer(doc as Proxy))).toBe(false);
    expect(await withPdfJs(fixture('c-english-invoice.pdf'), (doc) => hasTextLayer(doc as Proxy))).toBe(true);

    const ocr = await (async () => {
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const page = doc.addPage([612, 792]);
      page.pushOperators(pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible));
      page.drawText('Invoice 2026', { x: 72, y: 700, size: 12, font });
      page.pushOperators(popGraphicsState());
      return doc.save();
    })();
    expect(await withPdfJs(ocr, (doc) => hasTextLayer(doc as Proxy))).toBe(true);
  });

  it('E8 looks at the first pages only', async () => {
    const lateText = await letterPdf(4, (doc, pages) => {
      // Only the 4th page keeps its text.
      for (const page of pages.slice(0, 3)) page.node.set(PDFName.of('Contents'), doc.context.register(doc.context.stream('')));
    });
    expect(await withPdfJs(lateText, (doc) => hasTextLayer(doc as Proxy))).toBe(false);
    expect(await withPdfJs(lateText, (doc) => hasTextLayer(doc as Proxy, 4))).toBe(true);
  });
});

// ── Letterhead ──────────────────────────────────────────────────────────────

const LETTERHEAD: LetterheadStamp = { left: 'Centre Nour\nRabat', right: 'مركز نور\nالرباط', footer: 'Rabat · 0522 00 00 00', logoAssetId: 'logo', pages: 'all' };
const topGlyphs = (page: { glyphs: OracleGlyph[] }) => page.glyphs.filter((g) => g.y < 120);

describe('workspace export: letterhead', () => {
  it('L1 both sides, the logo between them and the footer on every page, Arabic extracting in logical order', async () => {
    const source = await letterPdf(2, (_doc, pages) => pages[1].setRotation(degrees(90)));
    const logo = pngAsset('logo', 200, 100);
    const { bytes, warnings } = await exportEditedPdf(source, request([sourcePage(0), sourcePage(1)], { stamps: { letterhead: LETTERHEAD }, assets: { logo } }), OPTIONS);
    expect(warnings).toEqual([]);
    const extracted = await pagesText(bytes);
    const glyphPages = await readPdf(bytes);
    const graphics = (await readGraphics(bytes)).pages;
    glyphPages.forEach((page, i) => {
      for (const text of ['Centre Nour', 'Rabat', 'مركز نور', 'الرباط', 'Rabat · 0522 00 00 00']) expect(squashSpaces(extracted[i]), `page ${i + 1}`).toContain(text);
      const top = topGlyphs(page);
      const latin = top.filter((g) => /[A-Za-z]/.test(g.unicode));
      const arabic = top.filter((g) => /[\u0600-\u06FF]/.test(g.unicode));
      // Latin from the left margin, Arabic ending at the right margin, both upright
      expect(Math.min(...latin.map((g) => g.x))).toBeGreaterThanOrEqual(LETTERHEAD_MARGIN_PT - 1);
      expect(Math.min(...latin.map((g) => g.x))).toBeLessThan(LETTERHEAD_MARGIN_PT + 3);
      expect(Math.max(...arabic.map((g) => g.x))).toBeLessThan(page.width - LETTERHEAD_MARGIN_PT);
      expect(Math.max(...arabic.map((g) => g.x))).toBeGreaterThan(page.width - LETTERHEAD_MARGIN_PT - 15);
      for (const g of top) expect([g.dx, g.dy]).toEqual([1, 0]);
      // The logo: 48 pt high, 96 wide, centred, LETTERHEAD_MARGIN_PT from the top
      const placed = letterheadPlacement({ width: page.width, height: page.height }, { logo: { width: 200, height: 100 } }).logo!;
      expect(graphics[i].images).toHaveLength(1);
      const { bl, br, tl } = graphics[i].images[0];
      expect(Math.abs((br[0] - bl[0]) * page.width - placed.w), `page ${i + 1} logo width`).toBeLessThan(1e-6);
      expect(Math.abs(tl[1] * page.height - LETTERHEAD_MARGIN_PT), `page ${i + 1} logo top`).toBeLessThan(1e-6);
      expect(Math.abs((bl[0] + br[0]) / 2 - 0.5)).toBeLessThan(1e-9);
    });
  });

  it('L2 first page only leaves the other pages as they were', async () => {
    const { bytes } = await exportEditedPdf(await letterPdf(2), request([sourcePage(0), sourcePage(1)], { stamps: { letterhead: { ...LETTERHEAD, logoAssetId: undefined, pages: 'first' } } }), OPTIONS);
    const extracted = await pagesText(bytes);
    expect(extracted[0]).toContain('Centre Nour');
    expect(extracted[1]).not.toContain('Centre Nour');
    expect(extracted[1]).not.toContain('0522');
  });

  it('L4 hierarchy: the first line of a side (the name) is bigger than the lines under it', async () => {
    const { bytes } = await exportEditedPdf(await letterPdf(1), request([sourcePage(0)], { stamps: { letterhead: { ...LETTERHEAD, right: '', footer: '', logoAssetId: undefined } } }), OPTIONS);
    const sizes = await withPdfJs(bytes, async (doc) => {
      const page = (await doc.getPage(1)) as { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> };
      const items = (await page.getTextContent()).items.filter((i) => /Centre|Rabat/.test(i.str));
      return Object.fromEntries(items.map((i) => [i.str.trim().split(' ')[0], Math.hypot(i.transform[2], i.transform[3])]));
    });
    expect(sizes.Centre).toBeCloseTo(12, 6);
    expect(sizes.Rabat).toBeCloseTo(9, 6);
  });

  it('L5 a Word-style page (text from 1 inch) moves down to clear the letterhead, its link with it; a page with room is left alone', async () => {
    const source = await (async () => {
      const doc = await PDFDocument.create();
      const helvetica = await doc.embedFont(StandardFonts.Helvetica);
      for (const top of [72, 200]) {
        const page = doc.addPage([595, 842]);
        page.drawText(`TOPLINE${top}`, { x: 72, y: 842 - top - 10, size: 11, font: helvetica });
        page.drawText('ENDLINE', { x: 72, y: 842 - 600, size: 11, font: helvetica });
        const link = doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [72, 842 - 600 - 2, 140, 842 - 600 + 12], Border: [0, 0, 0] }));
        page.node.set(PDFName.of('Annots'), doc.context.obj([link]));
      }
      return doc.save();
    })();
    const extents = await withPdfJs(source, async (doc) =>
      Promise.all([1, 2].map(async (n) => textExtentOf((await doc.getPage(n)) as Parameters<typeof textExtentOf>[0]))),
    );
    expect(extents[0]!.top).toBeLessThan(80);
    const pages = [sourcePage(0), sourcePage(1)];
    const stamps: DocStamps = { letterhead: LETTERHEAD };
    const assets = { logo: pngAsset('logo', 200, 100) };
    const { bytes } = await exportEditedPdf(source, request(pages, { stamps, assets, textExtents: { [pages[0].id]: extents[0]!, [pages[1].id]: extents[1]! } }), OPTIONS);

    const positions = (b: Uint8Array) =>
      withPdfJs(b, async (doc) =>
        Promise.all(
          [1, 2].map(async (n) => {
            const page = (await doc.getPage(n)) as { getTextContent: () => Promise<{ items: Array<{ str: string; transform: number[] }> }> };
            const items = (await page.getTextContent()).items;
            const y = (prefix: string) => items.find((i) => i.str.startsWith(prefix))!.transform[5];
            return { top: y('TOPLINE'), end: y('ENDLINE') };
          }),
        ),
      );
    const before = await positions(source);
    const after = await positions(bytes);
    // Page 1: moved down (PDF y smaller) by the same amount top and bottom: no shrinking, there was room below
    const shift = before[0].top - after[0].top;
    expect(shift).toBeGreaterThan(5);
    expect(before[0].end - after[0].end).toBeCloseTo(shift, 6);
    const saved = await PDFDocument.load(bytes);
    const rect = (n: number) => {
      const annots = saved.getPage(n).node.Annots()!;
      return (annots.lookup(0, PDFDict).lookup(PDFName.of('Rect')) as unknown as { asArray: () => PDFNumber[] }).asArray().map((v) => v.asNumber());
    };
    expect(rect(0)[1]).toBeCloseTo(842 - 600 - 2 - shift, 6);
    expect(rect(0)[3]).toBeCloseTo(842 - 600 + 12 - shift, 6);
    // Page 2's text starts at 200 pt: clear of the letterhead, nothing moves
    expect(after[1]).toEqual(before[1]);
    expect(rect(1)).toEqual([72, 842 - 600 - 2, 140, 842 - 600 + 12]);
  });

  it('L3 a side too long for its half is drawn smaller and stops before the logo', async () => {
    const left = 'Association marocaine pour le développement durable et la solidarité';
    const logo = pngAsset('logo', 100, 100);
    const { bytes } = await exportEditedPdf(await letterPdf(1), request([sourcePage(0)], { stamps: { letterhead: { ...LETTERHEAD, left } }, assets: { logo } }), OPTIONS);
    const [page] = await readPdf(bytes);
    const latin = topGlyphs(page).filter((g) => /[A-Za-z]/.test(g.unicode));
    const logoLeft = (page.width - 48) / 2;
    expect(Math.max(...latin.map((g) => g.x))).toBeLessThan(logoLeft);
    expect(squashSpaces((await pagesText(bytes))[0])).toContain('Association marocaine');
  });
});

// ── E9: validation ──────────────────────────────────────────────────────────

describe('workspace export: refuses bad crops and stamps with INVALID_REQUEST', () => {
  const tiny = { xPct: 0.1, yPct: 0.1, wPct: 10 / 612, hPct: 0.5 };
  const CASES: Array<[string, Partial<ExportRequest>, EditorPage]> = [
    ['a crop under MIN_CROP_PT', {}, sourcePage(0, 0, tiny)],
    ['a crop past the page edge', {}, sourcePage(0, 0, { xPct: 0.6, yPct: 0, wPct: 0.5, hPct: 0.5 })],
    ['a crop with no size', {}, sourcePage(0, 0, { xPct: 0.1, yPct: 0.1, wPct: 0, hPct: 0.5 })],
    ['opacity 0', { stamps: { watermark: { ...WATERMARK, opacity: 0 } } }, sourcePage(0)],
    ['a blank text watermark', { stamps: { watermark: { ...WATERMARK, text: '  ' } } }, sourcePage(0)],
    ['an image watermark without its asset', { stamps: { watermark: { ...WATERMARK, type: 'image', assetId: 'nope' } } }, sourcePage(0)],
    ['a watermark size out of range', { stamps: { watermark: { ...WATERMARK, size: 500 } } }, sourcePage(0)],
    ['a template without {n}', { stamps: { pageNumbers: { ...NUMBERS, template: 'Page' } } }, sourcePage(0)],
    ['a template with a line break', { stamps: { pageNumbers: { ...NUMBERS, template: 'Page\n{n}' } } }, sourcePage(0)],
    ['startFrom 0', { stamps: { pageNumbers: { ...NUMBERS, startFrom: 0 } } }, sourcePage(0)],
    ['startFrom 1.5', { stamps: { pageNumbers: { ...NUMBERS, startFrom: 1.5 } } }, sourcePage(0)],
    ['an empty letterhead', { stamps: { letterhead: { left: ' ', right: '', footer: '', pages: 'all' } } }, sourcePage(0)],
    ['a letterhead logo without its asset', { stamps: { letterhead: { ...LETTERHEAD, logoAssetId: 'nope' } } }, sourcePage(0)],
    ['letterhead pages "some"', { stamps: { letterhead: { ...LETTERHEAD, logoAssetId: undefined, pages: 'some' as 'all' } } }, sourcePage(0)],
  ];

  it.each(CASES)('E9 %s', async (_name, extra, page) => {
    const error = await exportEditedPdf(await letterPdf(1), request([page], extra), OPTIONS).catch((e: unknown) => e);
    expect(isEditPdfError(error, 'INVALID_REQUEST'), String(error)).toBe(true);
  });

  it('E9 a crop exactly MIN_CROP_PT wide is fine', async () => {
    const { bytes } = await exportEditedPdf(await letterPdf(1), request([sourcePage(0, 0, { ...tiny, wPct: 18 / 612 })]), OPTIONS);
    // x 0.1 * 612 .. + 18; visual y 0.1 .. 0.6 of 792, counted from the top.
    expectNumbers((await cropBoxes(bytes))[0], [61.2, 316.8, 79.2, 712.8], 'cropbox');
  });
});
