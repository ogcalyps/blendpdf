/**
 * PDF/A-1b and transparency (lib/pdfa-pages.ts): Ghostscript draws every page
 * that lists something see-through as one picture, so before the conversion
 * the see-through resources a page lists but never uses are dropped (pgf/TikZ
 * shares one opacity ExtGState across every page of a LaTeX file), and after
 * it the pages that lost their fonts to a picture are counted.
 */
import { describe, expect, it } from 'vitest';
import { PDFDict, PDFDocument, PDFName, StandardFonts, drawObject, setGraphicsState, type PDFPage, type PDFRef } from 'pdf-lib';
import { flattenedPages, prepareForPdfa1 } from '@/lib/pdfa-pages';

function names(page: PDFPage, category: 'ExtGState' | 'XObject'): string[] {
  const dict = page.node.Resources()?.lookupMaybe(PDFName.of(category), PDFDict);
  return (dict?.keys() ?? []).map((name) => name.decodeText()).sort();
}

async function reload(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPages();
}

/** A 1x1 grey image, with a soft mask when asked: the "see-through" kind. */
function image(doc: PDFDocument, masked: boolean): PDFRef {
  const base = { Type: 'XObject', Subtype: 'Image', Width: 1, Height: 1, ColorSpace: 'DeviceGray', BitsPerComponent: 8 };
  const mask = masked ? { SMask: doc.context.register(doc.context.stream(new Uint8Array([128]), base)) } : {};
  return doc.context.register(doc.context.stream(new Uint8Array([0]), { ...base, ...mask }));
}

/** Text on every page, and one ExtGState dictionary shared by all of them, as pgf writes it. */
async function sharedStates(seeThroughUsedOn: number[], pageCount = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const seeThrough = doc.context.register(doc.context.obj({ Type: 'ExtGState', ca: 0.5, CA: 0.5 }));
  const opaque = doc.context.register(doc.context.obj({ Type: 'ExtGState', ca: 1, CA: 1 }));
  const shared = doc.context.register(doc.context.obj({ GSa: seeThrough, GSo: opaque }));
  for (let n = 1; n <= pageCount; n++) {
    const page = doc.addPage([200, 200]);
    page.drawText(`Page ${n}`, { x: 20, y: 100, size: 12, font });
    page.node.Resources()!.set(PDFName.of('ExtGState'), shared);
    if (seeThroughUsedOn.includes(n)) page.pushOperators(setGraphicsState('GSa'));
  }
  return doc.save();
}

describe('prepareForPdfa1', () => {
  it('drops a shared see-through state from the pages that never use it, and only there', async () => {
    const prepared = await prepareForPdfa1(await sharedStates([2]));
    expect(prepared.cleanedPages).toBe(2);
    expect(prepared.fontPages).toEqual([true, true, true]);

    const pages = await reload(prepared.pdf!);
    // The opaque state isn't transparency, so it stays where it was.
    expect(names(pages[0], 'ExtGState')).toEqual(['GSo']);
    expect(names(pages[1], 'ExtGState')).toEqual(['GSa', 'GSo']);
    expect(names(pages[2], 'ExtGState')).toEqual(['GSo']);
  });

  it('leaves the file alone when every see-through state is used', async () => {
    const prepared = await prepareForPdfa1(await sharedStates([1, 2, 3]));
    expect(prepared).toMatchObject({ pdf: null, cleanedPages: 0 });
  });

  it('drops an unused soft-masked image but keeps a plain one and a masked one that is drawn', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    page.node.Resources()!.set(
      PDFName.of('XObject'),
      doc.context.obj({ Unused: image(doc, true), Plain: image(doc, false), Drawn: image(doc, true) }),
    );
    page.pushOperators(drawObject('Drawn'));

    const prepared = await prepareForPdfa1(await doc.save());
    expect(names((await reload(prepared.pdf!))[0], 'XObject')).toEqual(['Drawn', 'Plain']);
  });

  it('reads a name the content writes with # escapes as the same name', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const seeThrough = doc.context.register(doc.context.obj({ Type: 'ExtGState', ca: 0.3 }));
    page.node.Resources()!.set(PDFName.of('ExtGState'), doc.context.obj({ GSa: seeThrough }));
    // "/G#53a" is "/GSa" with the S escaped (#53).
    page.node.addContentStream(doc.context.register(doc.context.stream('q /G#53a gs Q')));

    expect(await prepareForPdfa1(await doc.save())).toMatchObject({ pdf: null, cleanedPages: 0 });
  });
});

describe('flattenedPages', () => {
  async function output(pictureOnly: number[], pageCount = 3): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= pageCount; n++) {
      const page = doc.addPage([200, 200]);
      if (pictureOnly.includes(n)) {
        page.node.Resources()!.set(PDFName.of('XObject'), doc.context.obj({ Im0: image(doc, false) }));
        page.pushOperators(drawObject('Im0'));
      } else {
        page.drawText(`Page ${n}`, { x: 20, y: 100, size: 12, font });
      }
    }
    return doc.save();
  }

  it('counts the pages that had fonts and came back as a picture without any', async () => {
    expect(await flattenedPages([true, true, true], await output([3]))).toEqual([3]);
    expect(await flattenedPages([true, true, true], await output([]))).toEqual([]);
  });

  it('does not count a page that was a picture already, like a scan', async () => {
    expect(await flattenedPages([true, false, true], await output([2]))).toEqual([]);
  });

  it('does not count a page that simply came back empty: only a picture means flattened', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([200, 200]);
    expect(await flattenedPages([true], await doc.save())).toEqual([]);
  });

  it('counts nothing when the page count changed', async () => {
    expect(await flattenedPages([true, true], await output([1, 2, 3]))).toEqual([]);
  });
});
