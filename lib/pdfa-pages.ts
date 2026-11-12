/**
 * PDF/A-1 forbids transparency, and Ghostscript meets that by drawing every
 * page whose resources *list* something see-through as one picture: the
 * fonts go, and with them the text a reader can select or search. veraPDF
 * still passes the page, because a picture is valid PDF/A-1b.
 *
 * Two things follow, both only for PDF/A-1b:
 * - Before the conversion, drop the see-through resources a page lists but
 *   never draws with. pgf/TikZ (LaTeX) attaches one shared ExtGState with its
 *   opacities to every page once a single figure uses one, so without this a
 *   whole thesis comes back as pictures, not just the figure's page.
 * - After it, count the pages that had fonts and came back as a picture with
 *   none, so the visitor is told instead of shown a plain pass.
 *
 * Server only (pdf-lib parses the whole file).
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, decodePDFRawStream, type PDFObject, type PDFPage } from 'pdf-lib';

const RESOURCES = PDFName.of('Resources');
const FONT = PDFName.of('Font');
const XOBJECT = PDFName.of('XObject');
const EXTGSTATE = PDFName.of('ExtGState');
const SUBTYPE = PDFName.of('Subtype');

const NORMAL_BLEND = new Set(['/Normal', '/Compatible']);

function lookupDict(doc: PDFDocument, value: PDFObject | undefined): PDFDict | undefined {
  const obj = value ? doc.context.lookup(value) : undefined;
  if (obj instanceof PDFDict) return obj;
  if (obj instanceof PDFRawStream) return obj.dict;
  return undefined;
}

function below1(doc: PDFDocument, value: PDFObject | undefined): boolean {
  const obj = value ? doc.context.lookup(value) : undefined;
  return obj instanceof PDFNumber && obj.asNumber() < 1;
}

/** An ExtGState that makes what it paints see-through. */
function isSeeThroughState(doc: PDFDocument, state: PDFDict): boolean {
  if (below1(doc, state.get(PDFName.of('ca'))) || below1(doc, state.get(PDFName.of('CA')))) return true;
  const mask = state.get(PDFName.of('SMask'));
  if (mask && mask.toString() !== '/None') return true;
  const blend = state.get(PDFName.of('BM'));
  const modes = blend instanceof PDFArray ? blend.asArray() : blend ? [blend] : [];
  return modes.some((mode) => !NORMAL_BLEND.has(mode.toString()));
}

/** An image with a soft mask, or a form drawn as a transparency group. */
function isSeeThroughXObject(doc: PDFDocument, xobject: PDFDict): boolean {
  const subtype = xobject.get(SUBTYPE)?.toString();
  if (subtype === '/Image') {
    const inData = doc.context.lookup(xobject.get(PDFName.of('SMaskInData')));
    return !!xobject.get(PDFName.of('SMask')) || (inData instanceof PDFNumber && inData.asNumber() > 0);
  }
  if (subtype === '/Form') {
    const group = lookupDict(doc, xobject.get(PDFName.of('Group')));
    return group?.get(PDFName.of('S'))?.toString() === '/Transparency';
  }
  return false;
}

/**
 * Every name the page's content mentions (`/GS0 gs`, `/Im1 Do` ...), or null
 * when the content can't be read, in which case nothing is dropped. A name
 * inside a string counts too: that only ever keeps a resource.
 */
function namesUsed(page: PDFPage): Set<string> | null {
  const contents = page.node.Contents();
  if (!contents) return new Set();
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => page.doc.context.lookup(ref)) : [contents];
  const names = new Set<string>();
  for (const stream of streams) {
    if (!(stream instanceof PDFRawStream)) return null;
    let text: string;
    try {
      text = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
    } catch {
      return null;
    }
    for (const [, raw] of text.matchAll(/\/([^\s/[\]()<>{}%]*)/g)) {
      names.add(PDFName.of(raw).decodeText());
    }
  }
  return names;
}

function hasEntries(dict: PDFDict | undefined): boolean {
  return !!dict && dict.keys().length > 0;
}

/** Fonts on the page itself or in a form it draws (one level down, where Word and Chrome put them). */
function hasFonts(page: PDFPage): boolean {
  const doc = page.doc;
  const resources = page.node.Resources();
  if (!resources) return false;
  if (hasEntries(lookupDict(doc, resources.get(FONT)))) return true;
  const xobjects = lookupDict(doc, resources.get(XOBJECT));
  return (xobjects?.values() ?? []).some((value) => {
    const xobject = lookupDict(doc, value);
    return xobject?.get(SUBTYPE)?.toString() === '/Form' && hasEntries(lookupDict(doc, lookupDict(doc, xobject.get(RESOURCES))?.get(FONT)));
  });
}

function hasImage(page: PDFPage): boolean {
  const doc = page.doc;
  const xobjects = lookupDict(doc, page.node.Resources()?.get(XOBJECT));
  return (xobjects?.values() ?? []).some((value) => lookupDict(doc, value)?.get(SUBTYPE)?.toString() === '/Image');
}

export interface Pdfa1Preparation {
  /** The file to convert, or null when nothing needed dropping (convert the original). */
  pdf: Uint8Array | null;
  /** Pages whose see-through resources were all unused and are now gone. */
  cleanedPages: number;
  /** Which pages carry fonts, for flattenedPages() once Ghostscript is done. */
  fontPages: boolean[];
}

/**
 * Drops the see-through ExtGStates and XObjects each page lists but never
 * uses. Shared dictionaries are copied per page, never edited in place, so a
 * page that does use one keeps it.
 */
export async function prepareForPdfa1(input: Uint8Array): Promise<Pdfa1Preparation> {
  const doc = await PDFDocument.load(input, { updateMetadata: false });
  const pages = doc.getPages();
  const fontPages = pages.map(hasFonts);
  let cleanedPages = 0;

  for (const page of pages) {
    const resources = page.node.Resources();
    if (!resources) continue;
    const used = namesUsed(page);
    if (!used) continue;

    const replacements: [PDFName, PDFDict][] = [];
    for (const [category, isSeeThrough] of [
      [EXTGSTATE, isSeeThroughState],
      [XOBJECT, isSeeThroughXObject],
    ] as const) {
      const entries = lookupDict(doc, resources.get(category));
      if (!entries) continue;
      const unused = entries.keys().filter((name) => {
        if (used.has(name.decodeText())) return false;
        const target = lookupDict(doc, entries.get(name));
        return !!target && isSeeThrough(doc, target);
      });
      if (unused.length === 0) continue;
      const kept = entries.clone();
      for (const name of unused) kept.delete(name);
      replacements.push([category, kept]);
    }
    if (replacements.length === 0) continue;

    const ownResources = resources.clone();
    for (const [category, kept] of replacements) ownResources.set(category, kept);
    page.node.set(RESOURCES, ownResources);
    cleanedPages++;
  }

  if (cleanedPages === 0) return { pdf: null, cleanedPages, fontPages };
  return { pdf: await doc.save({ updateFieldAppearances: false }), cleanedPages, fontPages };
}

/**
 * 1-based numbers of the pages that had fonts before and came back as a
 * picture without any. Empty when the page count changed (nothing to pair).
 */
export async function flattenedPages(fontPages: boolean[], output: Uint8Array): Promise<number[]> {
  const pages = (await PDFDocument.load(output, { updateMetadata: false })).getPages();
  if (pages.length !== fontPages.length) return [];
  return pages.flatMap((page, i) => (fontPages[i] && !hasFonts(page) && hasImage(page) ? [i + 1] : []));
}
