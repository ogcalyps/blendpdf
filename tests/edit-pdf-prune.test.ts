/**
 * "Delete page" must remove the page's content from the FILE, not only from
 * the page list: the export works on the original document in place, and
 * pdf-lib writes every object it holds. These tests search the raw output,
 * with every stream inflated (object streams included), for what was on the
 * deleted page.
 */
import { describe, expect, it } from 'vitest';
import { createCanvas } from 'canvas';
import { PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import type { PDFRef } from 'pdf-lib';
import { exportEditedPdf } from '../lib/edit-pdf';
import type { EditorPage } from '../lib/edit-pdf';
import { pruneUnreachable } from '../lib/edit-pdf/prune';
import { containsMarker, readGraphics, searchableBytes } from './helpers/edit-pdf-oracle';

const sourcePage = (index: number): EditorPage => ({ id: `s${index}`, source: { kind: 'source', index }, rotation: 0 });

function noisyJpeg(width: number, height: number, seed = 99): Uint8Array {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  for (let i = 0; i < image.data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    image.data[i] = i % 4 === 3 ? 255 : (seed >> 16) & 255;
  }
  ctx.putImageData(image, 0, 0);
  return new Uint8Array(canvas.toBuffer('image/jpeg'));
}

describe('pruneUnreachable', () => {
  it('deletes what nothing reaches (cycles included) and keeps what the catalog reaches', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const ctx = doc.context;
    const orphan = ctx.register(ctx.obj({ Marker: PDFString.of('ORPHAN-XYZ') }));
    const cycleA = ctx.nextRef();
    const cycleB = ctx.register(ctx.obj({ Next: cycleA, Marker: PDFString.of('CYCLE-XYZ') }));
    ctx.assign(cycleA, ctx.obj({ Next: cycleB }));
    const keptLeaf = ctx.register(ctx.obj({ Marker: PDFString.of('KEPT-XYZ') }));
    const keptStream = ctx.register(ctx.stream('KEPT-STREAM', { Leaf: keptLeaf }));
    doc.catalog.set(PDFName.of('KeptThing'), keptStream);
    await doc.flush();

    const before = ctx.enumerateIndirectObjects().length;
    expect(pruneUnreachable(ctx)).toBe(3);
    expect(ctx.enumerateIndirectObjects().length).toBe(before - 3);
    for (const ref of [orphan, cycleA, cycleB]) expect(ctx.lookup(ref)).toBeUndefined();
    expect(ctx.lookup(keptStream)).toBeDefined();
    expect(ctx.lookup(keptLeaf)).toBeDefined();

    const hay = searchableBytes(await doc.save());
    expect(containsMarker(hay, 'KEPT-XYZ')).toBe(true);
    expect(containsMarker(hay, 'KEPT-STREAM')).toBe(true);
    expect(containsMarker(hay, 'ORPHAN-XYZ')).toBe(false);
    expect(containsMarker(hay, 'CYCLE-XYZ')).toBe(false);
  });
});

describe('edit-pdf export: a deleted page is gone from the file', () => {
  it('removes its text, its image and its comments, even when a link on a kept page still points at it', async () => {
    const jpeg = noisyJpeg(64, 48);
    const doc = await PDFDocument.create();
    const helvetica = await doc.embedFont(StandardFonts.Helvetica);
    const pages = ['KEEP-0', 'SECRET-1', 'KEEP-2'].map((marker) => {
      const page = doc.addPage([612, 792]);
      page.drawText(marker, { x: 50, y: 700, size: 14, font: helvetica });
      return page;
    });
    pages[1].drawImage(await doc.embedJpg(jpeg), { x: 50, y: 400, width: 128, height: 96 });
    const ctx = doc.context;
    pages[1].node.addAnnot(ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: [50, 50, 70, 70], Contents: PDFString.of('SECRET-NOTE') })));
    // A table-of-contents style link on a kept page that jumps to the page being deleted.
    pages[0].node.addAnnot(ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [50, 600, 200, 620], Border: [0, 0, 0], Dest: [pages[1].ref, PDFName.of('Fit')] })));
    const source = await doc.save();

    // The oracle can see all of it in the source.
    const sourceHay = searchableBytes(source);
    for (const marker of ['KEEP-0', 'SECRET-1', 'KEEP-2', 'SECRET-NOTE']) expect(containsMarker(sourceHay, marker), marker).toBe(true);
    expect(sourceHay.includes(Buffer.from(jpeg.subarray(300, 364)))).toBe(true);

    const { bytes } = await exportEditedPdf(source, { pages: [sourcePage(0), sourcePage(2)], objects: [], assets: {}, fallbackDirection: 'ltr' });
    const hay = searchableBytes(bytes);
    expect(containsMarker(hay, 'KEEP-0')).toBe(true);
    expect(containsMarker(hay, 'KEEP-2')).toBe(true);
    expect(containsMarker(hay, 'SECRET-1')).toBe(false);
    expect(containsMarker(hay, 'SECRET-NOTE')).toBe(false);
    expect(hay.includes(Buffer.from(jpeg.subarray(300, 364)))).toBe(false);
    expect(hay.includes(Buffer.from('DCTDecode'))).toBe(false);

    const out = await readGraphics(bytes);
    expect(out.pages.map((p) => p.text.trim())).toEqual(['KEEP-0', 'KEEP-2']);
    expect(out.pages[0].annotations.map((a) => a.subtype)).toEqual(['Link']);
  });

  it('drops objects an earlier revision left behind', async () => {
    const doc = await PDFDocument.create();
    doc.addPage().drawText('CURRENT', { x: 50, y: 700, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) });
    const ctx = doc.context;
    // What an incremental update leaves when it replaces an object: the old one, now referenced by nothing.
    ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: [0, 0, 10, 10], Contents: PDFString.of('OLD-REVISION') }));
    const source = await doc.save();
    expect(containsMarker(searchableBytes(source), 'OLD-REVISION')).toBe(true);

    const { bytes } = await exportEditedPdf(source, { pages: [sourcePage(0)], objects: [], assets: {}, fallbackDirection: 'ltr' });
    expect(containsMarker(searchableBytes(bytes), 'OLD-REVISION')).toBe(false);
    expect((await readGraphics(bytes)).pages[0].text.trim()).toBe('CURRENT');
  });
});

/**
 * Two pages, a photo each, drawn through ONE resources dictionary: LibreOffice
 * (which runs BlendPDF's own Office converters) points both pages at it and
 * puts it on the page tree too; other producers leave it on the tree only.
 * With `borrow`, page 1 draws its photo through a form XObject that has no
 * resources of its own and so uses the page's.
 */
async function oneResourcesDict(where: 'pages-and-root' | 'root-only', borrow = false) {
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const [a, b] = [noisyJpeg(64, 48, 1), noisyJpeg(64, 48, 2)];
  const [imageA, imageB] = [await doc.embedJpg(a), await doc.embedJpg(b)];
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const pages = [doc.addPage([612, 792]), doc.addPage([612, 792])];
  const text = (marker: string) => `BT /F1 14 Tf 50 700 Td (${marker}) Tj ET`;
  const xobjects: Record<string, PDFRef> = { ImA: imageA.ref, ImB: imageB.ref };
  let first = `${text('KEEP-A')} q 128 0 0 96 50 400 cm /ImA Do Q`;
  if (borrow) {
    xobjects.Fm0 = ctx.register(ctx.flateStream('q 128 0 0 96 0 0 cm /ImA Do Q', { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, 128, 96] }));
    first = `${text('KEEP-A')} q 1 0 0 1 50 400 cm /Fm0 Do Q`;
  }
  const resources = ctx.register(ctx.obj({ Font: { F1: helvetica.ref }, XObject: xobjects }));
  pages[0].node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream(first)));
  pages[1].node.set(PDFName.of('Contents'), ctx.register(ctx.flateStream(`${text('SECRET-B')} q 128 0 0 96 50 400 cm /ImB Do Q`)));
  for (const page of pages) {
    if (where === 'pages-and-root') page.node.set(PDFName.of('Resources'), resources);
    else page.node.delete(PDFName.of('Resources'));
  }
  doc.catalog.Pages().set(PDFName.of('Resources'), resources);
  return { source: await doc.save(), a, b };
}

/** A run of a JPEG's scan data (its headers are the same for every photo here): in the file means the photo is. */
const photoBytes = (jpeg: Uint8Array) => Buffer.from(jpeg.subarray(jpeg.length - 80, jpeg.length - 16));

describe('edit-pdf export: pages that share one resources dictionary', () => {
  it.each(['pages-and-root', 'root-only'] as const)("a deleted page's photo leaves the file (%s)", async (where) => {
    const { source, a, b } = await oneResourcesDict(where);
    const before = await readGraphics(source);
    expect(before.pages.map((p) => [p.text.trim(), p.images.length])).toEqual([
      ['KEEP-A', 1],
      ['SECRET-B', 1],
    ]);
    expect(searchableBytes(source).includes(photoBytes(b))).toBe(true);

    const { bytes } = await exportEditedPdf(source, { pages: [sourcePage(0)], objects: [], assets: {}, fallbackDirection: 'ltr' });
    const hay = searchableBytes(bytes);
    expect(hay.includes(photoBytes(a))).toBe(true);
    expect(hay.includes(photoBytes(b))).toBe(false);
    expect(containsMarker(hay, 'SECRET-B')).toBe(false);
    const out = await readGraphics(bytes);
    expect(out.pages.map((p) => [p.text.trim(), p.images.length])).toEqual([['KEEP-A', 1]]);
  });

  it('keeps what a kept page draws through a form XObject that borrows the page resources', async () => {
    const { source, a, b } = await oneResourcesDict('pages-and-root', true);
    expect((await readGraphics(source)).pages[0].images).toHaveLength(1);

    const { bytes } = await exportEditedPdf(source, { pages: [sourcePage(0)], objects: [], assets: {}, fallbackDirection: 'ltr' });
    const hay = searchableBytes(bytes);
    expect(hay.includes(photoBytes(a))).toBe(true);
    expect(hay.includes(photoBytes(b))).toBe(false);
    expect((await readGraphics(bytes)).pages.map((p) => [p.text.trim(), p.images.length])).toEqual([['KEEP-A', 1]]);
  });

  it('with no page deleted, every page keeps what it lists and still draws it', async () => {
    const { source, a, b } = await oneResourcesDict('pages-and-root');
    const { bytes } = await exportEditedPdf(source, { pages: [sourcePage(1), sourcePage(0)], objects: [], assets: {}, fallbackDirection: 'ltr' });
    const hay = searchableBytes(bytes);
    expect(hay.includes(photoBytes(a)) && hay.includes(photoBytes(b))).toBe(true);
    expect((await readGraphics(bytes)).pages.map((p) => [p.text.trim(), p.images.length])).toEqual([
      ['SECRET-B', 1],
      ['KEEP-A', 1],
    ]);
  });
});
