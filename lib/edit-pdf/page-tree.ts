/**
 * Page-tree hygiene for the in-place export, run before any page is moved.
 * Reached only through import() (from ./export).
 *
 * - Every kept page gets its own resources, listing only what it draws.
 *   LibreOffice (which BlendPDF's own Word, Excel and PowerPoint converters
 *   run) points every page at ONE resources dictionary, and puts it on the
 *   page tree for all pages to inherit as well. Left shared, a deleted page's
 *   images stay reachable from the pages that remain, so the prune keeps them
 *   in the file.
 * - Every /Pages node gets its true /Count. pdf-lib finds the page to remove
 *   or insert at by those counts, while the page list comes from walking
 *   /Kids; viewers repair a wrong count silently, so a file can look fine and
 *   still send removePage to the wrong page.
 * - The tree stops handing out inherited attributes, so a blank page added
 *   later cannot pick up a /CropBox or /Rotate meant for the original pages.
 */
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFPageLeaf, PDFPageTree, PDFRawStream, PDFStream, decodePDFRawStream } from 'pdf-lib';
import type { PDFContext, PDFDocument, PDFObject, PDFPage, PDFRef } from 'pdf-lib';

/** Attributes a page can inherit from the page tree (PDF 32000 Table 31). */
const INHERITABLE_KEYS = ['Resources', 'MediaBox', 'CropBox', 'Rotate'] as const;

/**
 * Resource categories a content stream can only use by name. ColorSpace is
 * left whole: /DefaultRGB and friends apply without being named.
 */
const NAMED_CATEGORIES = new Set(['XObject', 'Font', 'ExtGState', 'Pattern', 'Shading', 'Properties']);

/** A name token in a content stream: "/" then anything but PDF white-space and delimiters. */
const NAME_TOKEN = /\/([^\x00\x09\x0a\x0c\x0d\x20/[\]()<>{}%]*)/g;

const unescapeName = (name: string) => name.replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));

const nameIsUsed = (key: PDFName, used: ReadonlySet<string>) => {
  const text = key.decodeText();
  return used.has(text) || used.has(unescapeName(text));
};

/** A stream's decoded bytes as one char per byte, or null when pdf-lib cannot decode it faithfully. */
function streamText(stream: PDFObject | undefined): string | null {
  if (!(stream instanceof PDFRawStream)) return null;
  const dict = stream.dict;
  // pdf-lib's decoders ignore predictors, and an external file (/F) is not in the stream at all.
  if (dict.has(PDFName.of('DecodeParms')) || dict.has(PDFName.of('DP')) || dict.has(PDFName.of('F'))) return null;
  let bytes: Uint8Array;
  try {
    bytes = decodePDFRawStream(stream).decode();
  } catch {
    return null;
  }
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return text;
}

const lookup = (context: PDFContext, value: PDFObject | undefined) => (value === undefined ? undefined : context.lookup(value));

/** The page's content streams, or null when /Contents is something else. */
function contentStreams(page: PDFPage): PDFObject[] | null {
  const contents = lookup(page.node.context, page.node.get(PDFName.of('Contents')));
  if (contents === undefined) return [];
  if (contents instanceof PDFStream) return [contents];
  if (!(contents instanceof PDFArray)) return null;
  const streams: PDFObject[] = [];
  for (let i = 0; i < contents.size(); i++) {
    const stream = contents.lookup(i);
    if (stream !== undefined) streams.push(stream);
  }
  return streams;
}

/** Annotation appearance streams with no /Resources of their own: flattening a widget draws it with the page's. */
function borrowingAppearances(page: PDFPage): PDFObject[] {
  const context = page.node.context;
  const annots = lookup(context, page.node.get(PDFName.of('Annots')));
  if (!(annots instanceof PDFArray)) return [];
  const streams: PDFObject[] = [];
  const add = (value: PDFObject | undefined) => {
    const target = lookup(context, value);
    if (target instanceof PDFStream) {
      if (!target.dict.has(PDFName.of('Resources'))) streams.push(target);
    } else if (target instanceof PDFDict) {
      for (const [, state] of target.entries()) add(state); // on/off states
    }
  };
  for (let i = 0; i < annots.size(); i++) {
    const annot = annots.lookup(i);
    const ap = annot instanceof PDFDict ? lookup(context, annot.get(PDFName.of('AP'))) : undefined;
    if (ap instanceof PDFDict) for (const key of ['N', 'R', 'D']) add(ap.get(PDFName.of(key)));
  }
  return streams;
}

/**
 * Every name the page draws with: its content streams, plus any form XObject
 * or appearance that borrows the page's resources. Null when one of them
 * cannot be read, or a Type 3 font draws its glyphs with the page's resources.
 */
function usedNames(page: PDFPage, resources: PDFDict): Set<string> | null {
  const context = page.node.context;
  const contents = contentStreams(page);
  if (!contents) return null;
  const sub = (category: string) => {
    const dict = lookup(context, resources.get(PDFName.of(category)));
    return dict instanceof PDFDict ? dict : undefined;
  };
  const xobjects = sub('XObject');
  const fonts = sub('Font');

  const used = new Set<string>();
  const queue = [...contents, ...borrowingAppearances(page)];
  const seen = new Set<PDFObject>();
  while (queue.length > 0) {
    const stream = queue.pop()!;
    if (seen.has(stream)) continue;
    seen.add(stream);
    const text = streamText(stream);
    if (text === null) return null;
    for (const match of text.matchAll(NAME_TOKEN)) {
      used.add(match[1]);
      used.add(unescapeName(match[1]));
    }
    for (const [key, value] of xobjects?.entries() ?? []) {
      if (!nameIsUsed(key, used)) continue;
      const xobject = lookup(context, value);
      const borrows =
        xobject instanceof PDFStream &&
        xobject.dict.lookup(PDFName.of('Subtype')) === PDFName.of('Form') &&
        !xobject.dict.has(PDFName.of('Resources'));
      if (borrows && !seen.has(xobject)) queue.push(xobject);
    }
  }
  for (const [key, value] of fonts?.entries() ?? []) {
    if (!nameIsUsed(key, used)) continue;
    const font = lookup(context, value);
    if (font instanceof PDFDict && font.lookup(PDFName.of('Subtype')) === PDFName.of('Type3') && !font.has(PDFName.of('Resources'))) return null;
  }
  return used;
}

/**
 * Give a kept page its own copy of its resources (and of each category in
 * them), so nothing drawn on it later lands in a dictionary other pages share.
 * With `onlyUsed`, the copy lists only the names the page's content uses;
 * when those cannot all be read the page keeps every entry, since a page
 * that draws wrong is worse than a leftover.
 */
export function isolateResources(page: PDFPage, onlyUsed: boolean): void {
  const { node } = page;
  const context = node.context;
  const resources = lookup(context, node.getInheritableAttribute(PDFName.of('Resources')));
  if (!(resources instanceof PDFDict)) return;
  const used = onlyUsed ? usedNames(page, resources) : null;
  const own = resources.clone(context);
  for (const [category, value] of resources.entries()) {
    const entries = lookup(context, value);
    if (!(entries instanceof PDFDict)) continue;
    const filter = used !== null && NAMED_CATEGORIES.has(category.decodeText());
    const copy = PDFDict.withContext(context);
    for (const [key, entry] of entries.entries()) if (!filter || nameIsUsed(key, used)) copy.set(key, entry);
    own.set(category, copy);
  }
  node.set(PDFName.of('Resources'), own);
}

/**
 * Set every /Pages node's /Count to the pages under it, counted the way
 * pdf-lib walks /Kids, and drop the attributes the tree hands down. Call it
 * only once every kept page carries its own (see isolateResources and the
 * pinning in ./export).
 */
export function tidyPageTree(doc: PDFDocument): void {
  const visit = (node: PDFPageTree): number => {
    let count = 0;
    const kids = node.Kids();
    for (let i = 0; i < kids.size(); i++) {
      const kid = kids.lookup(i);
      if (kid instanceof PDFPageTree) count += visit(kid);
      else if (kid instanceof PDFPageLeaf) count += 1;
    }
    node.set(PDFName.of('Count'), PDFNumber.of(count));
    for (const key of INHERITABLE_KEYS) node.delete(PDFName.of(key));
    return count;
  };
  visit(doc.catalog.Pages());
}

/** The page refs in the order a fresh walk of the tree finds them. */
export function pageRefsInTree(doc: PDFDocument): PDFRef[] {
  const refs: PDFRef[] = [];
  doc.catalog.Pages().traverse((node, ref) => {
    if (node instanceof PDFPageLeaf) refs.push(ref);
  });
  return refs;
}
