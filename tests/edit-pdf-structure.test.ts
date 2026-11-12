/**
 * Deleting a page really deletes it, tags included (lib/edit-pdf/structure.ts
 * through exportEditedPdf): structure elements, their /Alt and /ActualText,
 * ParentTree and IDTree entries, bookmarks, named destinations, link targets
 * and the open action that lead to the page all go, and so does the
 * scrubbed page object. Replacing a tagged line drops the marked content
 * PDFium took off the page, and any element left empty.
 *
 * Strings are DECODED before searching (alt text is often UTF-16BE hex, so
 * a byte grep misses it): every PDFString and PDFHexString of every object.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRawStream, PDFRef, PDFString, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import type { PDFObject } from 'pdf-lib';
import { exportEditedPdf, lineBoxAt, loadTextReplacer } from '../lib/edit-pdf';
import type { EditorPage, ExportRequest, ReplaceObject } from '../lib/edit-pdf';
import { readGraphics } from './helpers/edit-pdf-oracle';
import { CAIRO, PDFIUM_WASM, detectPage, findLine, fixture } from './helpers/replace-fixtures';

beforeAll(async () => {
  await loadTextReplacer({ pdfiumWasm: PDFIUM_WASM });
});

const OPTIONS = { fontBytes: CAIRO, pdfiumWasm: PDFIUM_WASM };
const page = (index: number): EditorPage => ({ id: `s${index}`, source: { kind: 'source', index }, rotation: 0 });
const request = (pages: EditorPage[], objects: ExportRequest['objects'] = []): ExportRequest => ({ pages, objects, assets: {}, fallbackDirection: 'ltr' });

interface Inspection {
  pages: number;
  /** Page dictionaries anywhere in the file that are not in the page tree. */
  strayPages: number;
  structElements: number;
  /** Every decoded text string in the file. */
  strings: string[];
  /** MCIDs the structure tree names on a live page that the page's content does not open. */
  danglingMcids: number;
  mcids: number;
}

async function inspect(bytes: Uint8Array): Promise<Inspection> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const context = doc.context;
  const live = new Set(doc.getPages().map((p) => p.ref));
  const result: Inspection = { pages: live.size, strayPages: 0, structElements: 0, strings: [], danglingMcids: 0, mcids: 0 };
  const opened = new Map<PDFRef, Set<number>>();
  for (const p of doc.getPages()) {
    const set = new Set<number>();
    const contents = p.node.lookup(PDFName.of('Contents'));
    const streams = contents instanceof PDFArray ? contents.asArray().map((r) => context.lookup(r)) : [contents];
    const properties = p.node.Resources()?.lookupMaybe(PDFName.of('Properties'), PDFDict);
    for (const s of streams) {
      if (!(s instanceof PDFRawStream)) continue;
      const text = Buffer.from(decodePDFRawStream(s).decode()).toString('latin1');
      for (const m of text.matchAll(/\/MCID\s+(\d+)/g)) set.add(Number(m[1]));
      for (const m of text.matchAll(/\/[^\s/<>[\]()]+\s*\/([^\s/<>[\]()]+)\s*BDC/g)) {
        const mcid = properties?.lookupMaybe(PDFName.of(m[1]), PDFDict)?.lookupMaybe(PDFName.of('MCID'), PDFNumber);
        if (mcid) set.add(mcid.asNumber());
      }
    }
    opened.set(p.ref, set);
  }
  const scan = (value: PDFObject | undefined) => {
    if (value instanceof PDFString || value instanceof PDFHexString) result.strings.push(value.decodeText());
    else if (value instanceof PDFDict) for (const [, v] of value.entries()) scan(v);
    else if (value instanceof PDFArray) for (const v of value.asArray()) scan(v);
  };
  for (const [ref, object] of context.enumerateIndirectObjects()) {
    const dict = object instanceof PDFRawStream ? object.dict : object;
    if (dict instanceof PDFDict && dict.lookupMaybe(PDFName.of('Type'), PDFName)?.decodeText() === 'Page' && !live.has(ref)) result.strayPages++;
    if (dict instanceof PDFDict && dict.has(PDFName.of('S')) && dict.has(PDFName.of('P'))) result.structElements++;
    scan(dict);
  }
  const root = doc.catalog.lookupMaybe(PDFName.of('StructTreeRoot'), PDFDict);
  const seen = new Set<PDFObject>();
  const walk = (node: PDFObject | undefined, pg: PDFObject | undefined) => {
    const target = node instanceof PDFRef ? context.lookup(node) : node;
    if (!target || seen.has(target)) return;
    seen.add(target);
    if (target instanceof PDFArray) return target.asArray().forEach((k) => walk(k, pg));
    if (target instanceof PDFNumber) {
      result.mcids++;
      if (pg instanceof PDFRef && live.has(pg) && !opened.get(pg)?.has(target.asNumber())) result.danglingMcids++;
      return;
    }
    if (!(target instanceof PDFDict)) return;
    const own = target.get(PDFName.of('Pg'));
    const here = own instanceof PDFRef ? own : pg;
    if (target.lookupMaybe(PDFName.of('Type'), PDFName)?.decodeText() === 'MCR' && !target.has(PDFName.of('Stm'))) {
      const mcid = target.lookupMaybe(PDFName.of('MCID'), PDFNumber);
      result.mcids++;
      if (mcid && here instanceof PDFRef && live.has(here) && !opened.get(here)?.has(mcid.asNumber())) result.danglingMcids++;
      return;
    }
    walk(target.get(PDFName.of('K')), here);
  };
  if (root) walk(root.get(PDFName.of('K')), undefined);
  return result;
}

const mentions = (strings: string[], marker: string) => strings.filter((s) => s.includes(marker));

describe('deleting a page removes what the structure tree and the navigation said about it', () => {
  it('LibreOffice tagged file: the deleted page\'s figure, its alt text (UTF-16BE) and the page object are gone', async () => {
    const source = fixture('f-tagged-3pages.pdf');
    const before = await inspect(source);
    expect(mentions(before.strings, 'EMERALD-77').length, 'the alt text is in the source, as a decoded string').toBeGreaterThan(0);
    const { bytes } = await exportEditedPdf(source, request([page(0), page(2)]), OPTIONS);
    const after = await inspect(bytes);
    expect(after.pages).toBe(2);
    expect(mentions(after.strings, 'EMERALD-77')).toEqual([]);
    expect(after.strayPages, 'the scrubbed page object').toBe(0);
    expect(before.structElements - after.structElements).toBeGreaterThanOrEqual(4);
    expect(after.danglingMcids).toBe(0);
    expect(after.mcids).toBeGreaterThan(0);
  });

  it('Chrome tagged file with bookmarks: the deleted page\'s bookmark and alt text are gone, the others still open the right pages', async () => {
    const source = fixture('g-chrome-tagged-outline.pdf');
    expect(mentions((await inspect(source)).strings, 'TOPAZ-55').length).toBeGreaterThanOrEqual(2);
    const { bytes } = await exportEditedPdf(source, request([page(0), page(2)]), OPTIONS);
    const after = await inspect(bytes);
    expect(mentions(after.strings, 'TOPAZ-55')).toEqual([]);
    expect(after.strayPages).toBe(0);
    expect(after.danglingMcids).toBe(0);
    const { outline } = await readGraphics(bytes);
    expect(outline).toEqual([
      { title: 'Chapter one public', pageIndex: 0 },
      { title: 'Chapter three public', pageIndex: 1 },
    ]);
  });

  it('named destinations, link targets and the open action that lead to the deleted page go; the link\'s hotspot stays', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const pages = [0, 1, 2].map((i) => {
      const p = doc.addPage([612, 792]);
      p.drawText(`Page ${i + 1}`, { x: 72, y: 700, size: 12, font });
      return p;
    });
    const ctx = doc.context;
    const dest = (i: number) => ctx.obj([pages[i].ref, PDFName.of('Fit')]);
    doc.catalog.set(PDFName.of('Names'), ctx.obj({ Dests: ctx.obj({ Names: [PDFHexString.fromText('secret-section'), dest(1), PDFHexString.fromText('intro'), dest(0)] }) }));
    doc.catalog.set(PDFName.of('Dests'), ctx.obj({ oldsecret: dest(1), oldintro: dest(0) }));
    doc.catalog.set(PDFName.of('OpenAction'), ctx.obj({ S: 'GoTo', D: dest(1) }));
    const link = (target: PDFObject) => ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [50, 50, 150, 70], Border: [0, 0, 0], A: ctx.obj({ S: 'GoTo', D: target }) }));
    pages[0].node.addAnnot(link(dest(1)));
    pages[0].node.addAnnot(link(PDFHexString.fromText('intro')));
    pages[2].node.addAnnot(ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [50, 50, 150, 70], Dest: PDFName.of('oldsecret') })));
    const source = await doc.save();

    const { bytes } = await exportEditedPdf(source, request([page(0), page(2)]), OPTIONS);
    const out = await PDFDocument.load(bytes);
    const names = out.catalog.lookup(PDFName.of('Names'), PDFDict).lookup(PDFName.of('Dests'), PDFDict).lookup(PDFName.of('Names'), PDFArray);
    expect(names.asArray().filter((v) => v instanceof PDFHexString || v instanceof PDFString).map((v) => (v as PDFHexString).decodeText())).toEqual(['intro']);
    expect([...out.catalog.lookup(PDFName.of('Dests'), PDFDict).keys()].map((k) => k.decodeText())).toEqual(['oldintro']);
    expect(out.catalog.has(PDFName.of('OpenAction'))).toBe(false);
    const annots = (i: number) => out.getPage(i).node.lookup(PDFName.of('Annots'), PDFArray).asArray().map((a) => out.context.lookup(a) as PDFDict);
    const [toDeleted, toIntro] = annots(0);
    expect(toDeleted.lookupMaybe(PDFName.of('Subtype'), PDFName)?.decodeText()).toBe('Link');
    expect(toDeleted.has(PDFName.of('A')) || toDeleted.has(PDFName.of('Dest'))).toBe(false);
    expect(toIntro.has(PDFName.of('A'))).toBe(true);
    const [fromThird] = annots(1);
    expect(fromThird.has(PDFName.of('Dest'))).toBe(false);
    expect((await inspect(bytes)).strayPages).toBe(0);
  });

  it.each([
    ['no element names a page', false],
    ['only the parent element names one (the kept page)', true],
  ])('a link on the deleted page whose object reference has no /Pg goes with its alt text: %s', async (_label, parentPg) => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const ctx = doc.context;
    const [kept, gone] = [0, 1].map((i) => {
      const p = doc.addPage([612, 792]);
      p.drawText(`Page ${i + 1}`, { x: 56, y: 700, size: 12, font });
      return p;
    });
    const annot = ctx.register(
      ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [56, 690, 300, 715], Contents: PDFString.of('Link note OPAL-99'), P: gone.ref, StructParent: 0, A: { S: 'URI', URI: PDFString.of('https://example.com/OPAL-99') } }),
    );
    gone.node.set(PDFName.of('Annots'), ctx.obj([annot]));
    const root = ctx.obj({ Type: 'StructTreeRoot' }) as PDFDict;
    const rootRef = ctx.register(root);
    const link = ctx.obj({ Type: 'StructElem', S: 'Link', Alt: PDFString.of('Alt OPAL-99'), K: { Type: 'OBJR', Obj: annot } }) as PDFDict;
    const linkRef = ctx.register(link);
    const body = ctx.register(ctx.obj({ Type: 'StructElem', S: 'Document', P: rootRef, ...(parentPg ? { Pg: kept.ref } : {}), K: [linkRef] }));
    link.set(PDFName.of('P'), body);
    root.set(PDFName.of('K'), body);
    root.set(PDFName.of('ParentTree'), ctx.obj({ Nums: [0, linkRef] }));
    doc.catalog.set(PDFName.of('StructTreeRoot'), rootRef);
    const source = await doc.save({ useObjectStreams: false });
    expect(mentions((await inspect(source)).strings, 'OPAL-99')).toHaveLength(3);

    const { bytes } = await exportEditedPdf(source, request([page(0)]), OPTIONS);
    expect(mentions((await inspect(bytes)).strings, 'OPAL-99')).toEqual([]);
  });

  it('leaves a file without tags or bookmarks alone', async () => {
    const source = fixture('a-latin-pdflib.pdf');
    const doc = await PDFDocument.load(source);
    doc.addPage([612, 792]);
    const { bytes } = await exportEditedPdf(await doc.save(), request([page(0)]), OPTIONS);
    const out = await PDFDocument.load(bytes);
    expect(out.catalog.has(PDFName.of('StructTreeRoot'))).toBe(false);
    expect(out.catalog.has(PDFName.of('Outlines'))).toBe(false);
  });
});

describe('replacing a tagged line', () => {
  it('drops the marked content PDFium took off the page, and the element it leaves empty', async () => {
    const source = fixture('f-tagged-3pages.pdf');
    const { lines } = await detectPage(source);
    const line = findLine(lines, 'Second paragraph on page one');
    const object: ReplaceObject = { id: 'r1', pageId: 's0', kind: 'replace', line, box: lineBoxAt(line, 0), text: 'A new second paragraph.', size: line.geometry.size, color: line.color };
    const before = await inspect(source);
    const { bytes, removedLines } = await exportEditedPdf(source, request([page(0), page(1), page(2)], [object]), OPTIONS);
    expect(removedLines).toBe(1);
    const after = await inspect(bytes);
    expect(after.danglingMcids, 'every MCID the tree names is still in the page').toBe(0);
    expect(after.mcids).toBeLessThan(before.mcids);
    expect(after.structElements).toBeLessThan(before.structElements);
    // The deleted-page case still holds on the same file: nothing else was dropped.
    expect(mentions(after.strings, 'EMERALD-77').length).toBeGreaterThan(0);
  });

  it('a replaced heading that is also a bookmark: the bookmark takes the new wording, or goes when the line was only removed', async () => {
    // Chrome turns <h1> into bookmarks. A bookmark on ANOTHER page with the same title is left alone.
    const doc = await PDFDocument.load(fixture('g-chrome-tagged-outline.pdf'));
    const first = doc.catalog.lookup(PDFName.of('Outlines'), PDFDict).lookup(PDFName.of('First'), PDFDict);
    first.set(PDFName.of('Title'), PDFString.of('Salary review TOPAZ-55'));
    const source = await doc.save();
    const { lines } = await detectPage(source, 2);
    const line = findLine(lines, 'Salary review');
    const replaced = (text: string): ReplaceObject => ({ id: 'r1', pageId: 's1', kind: 'replace', line, box: lineBoxAt(line, 0), text, size: line.geometry.size, color: line.color });

    const renamed = await exportEditedPdf(source, request([page(0), page(1), page(2)], [replaced('Pay review, revised')]), OPTIONS);
    expect((await readGraphics(renamed.bytes)).outline).toEqual([
      { title: 'Salary review TOPAZ-55', pageIndex: 0 },
      { title: 'Pay review, revised', pageIndex: 1 },
      { title: 'Chapter three public', pageIndex: 2 },
    ]);

    const removed = await exportEditedPdf(source, request([page(0), page(1), page(2)], [replaced('')]), OPTIONS);
    expect((await readGraphics(removed.bytes)).outline).toEqual([
      { title: 'Salary review TOPAZ-55', pageIndex: 0 },
      { title: 'Chapter three public', pageIndex: 2 },
    ]);
  });
});
