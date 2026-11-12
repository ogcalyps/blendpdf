/**
 * What still points at a page after it leaves the document, or at text
 * PDFium took off a page: the structure tree (tags, with their /Alt and
 * /ActualText), bookmarks, named destinations, link targets and the open
 * action. Run by the export on every save that deletes or rewrites a page,
 * before ./prune.ts drops whatever nothing reaches any more. Reached only
 * through ./export (itself loaded with import()).
 *
 * A replaced line that is also a bookmark's title (Chrome, Word and
 * LibreOffice turn headings into bookmarks) would keep its old words in
 * every viewer's sidebar: a bookmark that opens the line's page and reads
 * exactly the old line gets the new wording, or goes when the line was
 * only removed.
 *
 * Why it matters: deleting a page scrubs it and takes it out of the page
 * tree, but a tagged PDF's structure elements still hold a /Pg reference to
 * it, so the page object, and the figure's alt text describing what was on
 * it, stayed in the file. A bookmark's title is usually the deleted page's
 * own heading.
 */
import { PDFArray, PDFDict, PDFHexString, PDFName, PDFNull, PDFNumber, PDFRawStream, PDFRef, PDFString, decodePDFRawStream } from 'pdf-lib';
import type { PDFContext, PDFDocument, PDFObject } from 'pdf-lib';

export interface StructurePruneStats {
  droppedElements: number;
  droppedMarkedContent: number;
  droppedParentTreeEntries: number;
  droppedIds: number;
  droppedOutlines: number;
  retitledOutlines: number;
  droppedNamedDests: number;
  droppedLinkTargets: number;
}

/** A replaced line, for the bookmarks: the output page it is on, its old prefill and its new text. */
export interface RetitledLine {
  page: PDFRef;
  old: string;
  text: string;
}

/** What a title comparison ignores: compatibility forms, bidi controls, tatweel, all white space. */
const squash = (text: string) =>
  text
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u0640]/g, '')
    .replace(/\s+/g, '');

const N = (name: string) => PDFName.of(name);
const K = N('K');
const PG = N('Pg');
const S = N('S');
const TYPE = N('Type');

const resolve = (context: PDFContext, value: PDFObject | undefined): PDFObject | undefined => (value instanceof PDFRef ? context.lookup(value) : value);

function kidsOf(context: PDFContext, value: PDFObject | undefined): PDFObject[] {
  if (value === undefined) return [];
  const target = resolve(context, value);
  return target instanceof PDFArray ? target.asArray() : [value];
}

function setKids(context: PDFContext, holder: PDFDict, kids: PDFObject[]): void {
  if (kids.length === 0) holder.delete(K);
  else holder.set(K, kids.length === 1 ? kids[0] : context.obj(kids));
}

/** One char per byte of a content stream, or null when pdf-lib can't decode it faithfully. */
function contentText(stream: PDFObject | undefined): string | null {
  if (!(stream instanceof PDFRawStream)) return null;
  if (stream.dict.has(N('DecodeParms')) || stream.dict.has(N('DP')) || stream.dict.has(N('F'))) return null;
  try {
    const bytes = decodePDFRawStream(stream).decode();
    let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return text;
  } catch {
    return null;
  }
}

/**
 * The marked-content IDs a page's own content still opens (`/MCID n` in a
 * BDC property list, inline or through /Properties), or null when a stream
 * can't be read (then nothing on that page is dropped). Streams pdf-lib
 * created in this export (the new text, flattened fields) carry no MCIDs.
 */
function mcidsOnPage(context: PDFContext, page: PDFDict): Set<number> | null {
  const contents = resolve(context, page.get(N('Contents')));
  const streams = contents instanceof PDFArray ? contents.asArray().map((s) => resolve(context, s)) : contents === undefined ? [] : [contents];
  const resources = resolve(context, page.get(N('Resources')));
  const properties = resources instanceof PDFDict ? resolve(context, resources.get(N('Properties'))) : undefined;
  const found = new Set<number>();
  for (const stream of streams) {
    if (!(stream instanceof PDFRawStream)) continue; // pdf-lib's own appended content: no marked content
    const text = contentText(stream);
    if (text === null) return null;
    for (const match of text.matchAll(/\/MCID\s+(\d+)/g)) found.add(Number(match[1]));
    for (const match of text.matchAll(/\/[^\s/<>[\]()]+\s*\/([^\s/<>[\]()]+)\s*BDC/g)) {
      const named = properties instanceof PDFDict ? resolve(context, properties.get(N(match[1]))) : undefined;
      const mcid = named instanceof PDFDict ? resolve(context, named.get(N('MCID'))) : undefined;
      if (mcid instanceof PDFNumber) found.add(mcid.asNumber());
    }
  }
  return found;
}

/**
 * Drop structure elements left with nothing on a live page, and marked
 * content PDFium removed from a rewritten page. A kid survives when its page
 * (its own /Pg, else the nearest element's) is live, and on a rewritten page
 * an MCID must still be opened by the page's content. An element survives
 * while it has a surviving kid; one that loses every kid goes, with its
 * /Alt, /ActualText, /E and /T. ParentTree members of dropped elements
 * become null (an entry left all null goes); IDTree entries go.
 */
export function pruneStructTree(doc: PDFDocument, livePages: ReadonlySet<PDFRef>, rewritten: ReadonlySet<PDFRef>, stats: StructurePruneStats): void {
  const context = doc.context;
  const root = doc.catalog.lookupMaybe(N('StructTreeRoot'), PDFDict);
  if (!root) return;
  const pageOk = (pg: PDFObject | undefined) => !(pg instanceof PDFRef) || livePages.has(pg);
  const mcidCache = new Map<PDFRef, Set<number> | null>();
  const mcidPresent = (pg: PDFObject | undefined, mcid: number): boolean => {
    if (!(pg instanceof PDFRef) || !rewritten.has(pg)) return true;
    if (!mcidCache.has(pg)) {
      const page = context.lookup(pg);
      mcidCache.set(pg, page instanceof PDFDict ? mcidsOnPage(context, page) : null);
    }
    const present = mcidCache.get(pg);
    return present === null || present === undefined || present.has(mcid);
  };

  const kept = new Set<PDFDict>();
  const visited = new Set<PDFDict>();
  const keepKid = (entry: PDFObject, inheritedPg: PDFObject | undefined): boolean => {
    const kid = resolve(context, entry);
    if (kid instanceof PDFNumber) {
      if (!pageOk(inheritedPg)) return false;
      if (!mcidPresent(inheritedPg, kid.asNumber())) {
        stats.droppedMarkedContent++;
        return false;
      }
      return true;
    }
    if (!(kid instanceof PDFDict)) return true;
    const own = kid.get(PG);
    const pg = own instanceof PDFRef ? own : inheritedPg;
    const type = kid.lookupMaybe(TYPE, PDFName)?.decodeText();
    if (type === 'MCR') {
      if (!pageOk(pg)) return false;
      const mcid = resolve(context, kid.get(N('MCID')));
      // Marked content inside a form XObject (/Stm) is not on the page's own content: left alone.
      if (!kid.has(N('Stm')) && mcid instanceof PDFNumber && !mcidPresent(pg, mcid.asNumber())) {
        stats.droppedMarkedContent++;
        return false;
      }
      return true;
    }
    if (type === 'OBJR') {
      // /Pg is optional on an object reference (ISO 32000-1, 14.7.4.3); an annotation names its own page in /P,
      // which says more than a /Pg inherited from an element that may span pages.
      const object = resolve(context, kid.get(N('Obj')));
      const annotationPage = object instanceof PDFDict ? object.get(N('P')) : undefined;
      return pageOk(own instanceof PDFRef ? own : annotationPage instanceof PDFRef ? annotationPage : pg);
    }
    if (!kid.has(S)) return true; // not a structure element: leave it
    if (visited.has(kid)) return kept.has(kid);
    visited.add(kid);
    const kids = kidsOf(context, kid.get(K));
    const survivors = kids.filter((k) => keepKid(k, pg));
    if ((kids.length > 0 && survivors.length === 0) || (kids.length === 0 && !pageOk(pg))) {
      stats.droppedElements++;
      return false;
    }
    if (survivors.length !== kids.length) setKids(context, kid, survivors);
    if (own instanceof PDFRef && !livePages.has(own)) kid.delete(PG); // the kids left carry their own page
    kept.add(kid);
    return true;
  };

  const top = kidsOf(context, root.get(K));
  const survivors = top.filter((k) => keepKid(k, undefined));
  if (survivors.length !== top.length) setKids(context, root, survivors);

  const isKept = (value: PDFObject) => {
    const target = resolve(context, value);
    return !(target instanceof PDFDict) || !target.has(S) || kept.has(target);
  };
  const walk = (node: PDFObject | undefined, key: 'Nums' | 'Names', visit: (pairs: PDFArray, holder: PDFDict) => void, seen = new Set<PDFDict>()) => {
    const dict = resolve(context, node);
    if (!(dict instanceof PDFDict) || seen.has(dict)) return;
    seen.add(dict);
    const pairs = dict.lookupMaybe(N(key), PDFArray);
    if (pairs) visit(pairs, dict);
    const kids = dict.lookupMaybe(N('Kids'), PDFArray);
    for (let i = 0; i < (kids?.size() ?? 0); i++) walk(kids!.get(i), key, visit, seen);
  };

  walk(root.get(N('ParentTree')), 'Nums', (pairs, holder) => {
    const out: PDFObject[] = [];
    for (let i = 0; i + 1 < pairs.size(); i += 2) {
      const key = pairs.get(i);
      const value = pairs.get(i + 1);
      const target = resolve(context, value);
      if (target instanceof PDFArray) {
        const members = target.asArray().map((m) => (isKept(m) ? m : PDFNull));
        if (members.every((m) => m === PDFNull)) {
          stats.droppedParentTreeEntries++;
          continue;
        }
        const changed = members.some((m, j) => m !== target.get(j));
        if (changed && value instanceof PDFRef) context.assign(value, context.obj(members));
        out.push(key, changed && !(value instanceof PDFRef) ? context.obj(members) : value);
      } else if (isKept(value)) out.push(key, value);
      else stats.droppedParentTreeEntries++;
    }
    holder.set(N('Nums'), context.obj(out));
  });

  walk(root.get(N('IDTree')), 'Names', (pairs, holder) => {
    const out: PDFObject[] = [];
    for (let i = 0; i + 1 < pairs.size(); i += 2) {
      if (isKept(pairs.get(i + 1))) out.push(pairs.get(i), pairs.get(i + 1));
      else stats.droppedIds++;
    }
    holder.set(N('Names'), context.obj(out));
  });
}

/** The text of a name-tree key or a /Dests dictionary key. */
function keyText(context: PDFContext, value: PDFObject | undefined): string | undefined {
  const target = resolve(context, value);
  if (target instanceof PDFString || target instanceof PDFHexString || target instanceof PDFName) return target.decodeText();
  return undefined;
}

/**
 * Bookmarks, named destinations, link targets and the open action that lead
 * to a page no longer in the document. A bookmark leading there goes (its
 * title is usually that page's heading) and its children take its place; a
 * link on a kept page keeps its hotspot and loses its target.
 */
export function pruneDestinations(
  doc: PDFDocument,
  livePages: ReadonlySet<PDFRef>,
  stats: StructurePruneStats,
  retitled: readonly RetitledLine[] = [],
): void {
  const context = doc.context;
  const catalog = doc.catalog;
  const named = new Map<string, PDFObject>();
  const nameTreeRoot = catalog.lookupMaybe(N('Names'), PDFDict)?.get(N('Dests'));
  const eachNamePair = (node: PDFObject | undefined, visit: (pairs: PDFArray, holder: PDFDict) => void, seen = new Set<PDFDict>()) => {
    const dict = resolve(context, node);
    if (!(dict instanceof PDFDict) || seen.has(dict)) return;
    seen.add(dict);
    const pairs = dict.lookupMaybe(N('Names'), PDFArray);
    if (pairs) visit(pairs, dict);
    const kids = dict.lookupMaybe(N('Kids'), PDFArray);
    for (let i = 0; i < (kids?.size() ?? 0); i++) eachNamePair(kids!.get(i), visit, seen);
  };
  eachNamePair(nameTreeRoot, (pairs) => {
    for (let i = 0; i + 1 < pairs.size(); i += 2) {
      const key = keyText(context, pairs.get(i));
      if (key !== undefined) named.set(key, pairs.get(i + 1));
    }
  });
  const oldDests = catalog.lookupMaybe(N('Dests'), PDFDict);
  for (const [key, value] of oldDests?.entries() ?? []) named.set(key.decodeText(), value);

  /** The page a destination leads to (explicit, through a { D } dict, or by name), or undefined. */
  const pageOf = (destination: PDFObject | undefined, depth = 0): PDFObject | undefined => {
    if (depth > 4) return undefined;
    const target = resolve(context, destination);
    if (target instanceof PDFArray) return target.get(0) instanceof PDFRef ? target.get(0) : undefined;
    if (target instanceof PDFDict) return pageOf(target.get(N('D')), depth + 1);
    const name = keyText(context, target);
    return name !== undefined && named.has(name) ? pageOf(named.get(name), depth + 1) : undefined;
  };
  const targetOf = (holder: PDFDict): PDFObject | undefined => {
    if (holder.has(N('Dest'))) return pageOf(holder.get(N('Dest')));
    const action = resolve(context, holder.get(N('A')));
    if (action instanceof PDFDict && action.lookupMaybe(S, PDFName)?.decodeText() === 'GoTo') return pageOf(action.get(N('D')));
    return undefined;
  };
  const dead = (page: PDFObject | undefined) => page instanceof PDFRef && !livePages.has(page);
  const lines = retitled.flatMap((line) => {
    const old = squash(line.old);
    return old ? [{ page: line.page, old, text: line.text.trim() }] : [];
  });
  /** The new title of a bookmark that reads exactly like a line replaced on the page it opens, else undefined. */
  const newTitle = (item: PDFDict, page: PDFObject | undefined): string | undefined => {
    if (!(page instanceof PDFRef) || lines.length === 0) return undefined;
    const title = keyText(context, item.get(N('Title')));
    if (title === undefined) return undefined;
    const old = squash(title);
    return lines.find((line) => line.page === page && line.old === old)?.text;
  };

  // Outlines: each level's sibling chain rebuilt, children of a dropped item promoted.
  const rebuild = (parentRef: PDFRef, parent: PDFDict, seen: Set<PDFRef>): number => {
    const items: PDFRef[] = [];
    let current = parent.get(N('First'));
    while (current instanceof PDFRef && !seen.has(current)) {
      seen.add(current);
      const item = context.lookup(current);
      if (!(item instanceof PDFDict)) break;
      const next = item.get(N('Next'));
      rebuild(current, item, seen);
      const page = targetOf(item);
      const title = dead(page) ? undefined : newTitle(item, page);
      if (title) {
        item.set(N('Title'), PDFHexString.fromText(title));
        stats.retitledOutlines++;
      }
      if (dead(page) || title === '') {
        stats.droppedOutlines++;
        for (let child = item.get(N('First')); child instanceof PDFRef; ) {
          items.push(child);
          const childItem = context.lookup(child);
          child = childItem instanceof PDFDict ? childItem.get(N('Next')) : undefined;
        }
      } else items.push(current);
      current = next;
    }
    items.forEach((ref, i) => {
      const item = context.lookup(ref) as PDFDict;
      item.set(N('Parent'), parentRef);
      if (i > 0) item.set(N('Prev'), items[i - 1]);
      else item.delete(N('Prev'));
      if (i < items.length - 1) item.set(N('Next'), items[i + 1]);
      else item.delete(N('Next'));
    });
    if (items.length > 0) {
      parent.set(N('First'), items[0]);
      parent.set(N('Last'), items[items.length - 1]);
    } else {
      parent.delete(N('First'));
      parent.delete(N('Last'));
    }
    // Visible descendants: each child, plus its own when it is open.
    const total = items.reduce((sum, ref) => {
      const count = (context.lookup(ref) as PDFDict).lookupMaybe(N('Count'), PDFNumber)?.asNumber() ?? 0;
      return sum + 1 + Math.max(count, 0);
    }, 0);
    const before = parent.lookupMaybe(N('Count'), PDFNumber)?.asNumber();
    if (total === 0) parent.delete(N('Count'));
    else parent.set(N('Count'), PDFNumber.of(before !== undefined && before < 0 ? -total : total));
    return total;
  };
  const outlinesRef = catalog.get(N('Outlines'));
  const outlines = resolve(context, outlinesRef);
  if (outlinesRef instanceof PDFRef && outlines instanceof PDFDict) rebuild(outlinesRef, outlines, new Set());

  // Named destinations to dead pages.
  eachNamePair(nameTreeRoot, (pairs, holder) => {
    const out: PDFObject[] = [];
    for (let i = 0; i + 1 < pairs.size(); i += 2) {
      if (dead(pageOf(pairs.get(i + 1)))) stats.droppedNamedDests++;
      else out.push(pairs.get(i), pairs.get(i + 1));
    }
    holder.set(N('Names'), context.obj(out));
  });
  for (const [key, value] of oldDests?.entries() ?? []) {
    if (dead(pageOf(value))) {
      oldDests!.delete(key);
      stats.droppedNamedDests++;
    }
  }

  // Links on kept pages: the hotspot stays, a target on a dead page goes.
  for (const pageRef of livePages) {
    const page = context.lookup(pageRef);
    const annots = page instanceof PDFDict ? resolve(context, page.get(N('Annots'))) : undefined;
    if (!(annots instanceof PDFArray)) continue;
    for (let i = 0; i < annots.size(); i++) {
      const annot = resolve(context, annots.get(i));
      if (!(annot instanceof PDFDict) || annot.lookupMaybe(N('Subtype'), PDFName)?.decodeText() !== 'Link') continue;
      if (dead(targetOf(annot))) {
        annot.delete(N('Dest'));
        annot.delete(N('A'));
        stats.droppedLinkTargets++;
      }
    }
  }

  // The document's open action, when it opens a page that left (a destination, or a GoTo action).
  const open = resolve(context, catalog.get(N('OpenAction')));
  const opensDeadPage =
    (open instanceof PDFArray && dead(pageOf(open))) ||
    (open instanceof PDFDict && open.lookupMaybe(S, PDFName)?.decodeText() === 'GoTo' && dead(pageOf(open.get(N('D')))));
  if (opensDeadPage) catalog.delete(N('OpenAction'));
}

/**
 * Both passes, for the export. `livePages` = the output's page refs;
 * `rewritten` = pages PDFium rewrote; `retitled` = the replaced lines.
 */
export function pruneStructure(
  doc: PDFDocument,
  livePages: readonly PDFRef[],
  rewritten: ReadonlySet<PDFRef>,
  retitled: readonly RetitledLine[] = [],
): StructurePruneStats {
  const stats: StructurePruneStats = {
    droppedElements: 0,
    droppedMarkedContent: 0,
    droppedParentTreeEntries: 0,
    droppedIds: 0,
    droppedOutlines: 0,
    retitledOutlines: 0,
    droppedNamedDests: 0,
    droppedLinkTargets: 0,
  };
  const live = new Set(livePages);
  pruneStructTree(doc, live, rewritten, stats);
  pruneDestinations(doc, live, stats, retitled);
  return stats;
}
