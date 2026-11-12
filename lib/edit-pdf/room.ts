/**
 * The letterhead's room (model.ts letterheadRoom) on a saved page: the page's
 * existing content is wrapped in one transform (q … cm … Q), and its
 * annotations move with it (Rect, QuadPoints), so links and form fields stay
 * on what they belong to. Upright, uncropped pages only: the export checks.
 * Reached only from ./export.
 */
import { PDFArray, PDFDict, PDFName, PDFNumber, concatTransformationMatrix, popGraphicsState, pushGraphicsState } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import type { PageGeometry } from '@/lib/pdf-geometry';
import type { LetterheadRoom } from './model';

/**
 * The room as a user-space matrix [k 0 0 k e f]. The room maps visual points
 * (y down from the visible top-left) to (dx + k·x, dy + k·y); on an upright
 * page visual y = top − Y, which gives e and f below.
 */
export function roomMatrix(g: PageGeometry, room: LetterheadRoom): [number, number, number, number, number, number] {
  const k = room.scale;
  const top = g.box.y + g.box.height;
  return [k, 0, 0, k, (1 - k) * g.box.x + room.dx, (1 - k) * top - room.dy];
}

export function moveContent(page: PDFPage, g: PageGeometry, room: LetterheadRoom): void {
  const m = roomMatrix(g, room);
  const { context } = page.doc;
  page.node.normalize();
  const start = context.register(context.contentStream([pushGraphicsState(), concatTransformationMatrix(...m)]));
  const end = context.register(context.contentStream([popGraphicsState()]));
  if (!page.node.wrapContentStreams(start, end)) return;
  // pdf-lib keeps drawing into the stream it last made, which is now inside the wrap: start a new one after it.
  const writer = page as unknown as { contentStream?: unknown; contentStreamRef?: unknown };
  writer.contentStream = undefined;
  writer.contentStreamRef = undefined;

  const annots = page.node.Annots();
  if (!annots) return;
  const [k, , , , e, f] = m;
  for (let i = 0; i < annots.size(); i++) {
    const annot = annots.lookupMaybe(i, PDFDict);
    if (!annot) continue;
    for (const key of ['Rect', 'QuadPoints']) {
      const values = annot.lookupMaybe(PDFName.of(key), PDFArray);
      if (!values) continue;
      const numbers = values.asArray().map((v) => context.lookupMaybe(v, PDFNumber)?.asNumber());
      if (numbers.some((n) => n === undefined) || numbers.length % 2 !== 0) continue;
      const moved = (numbers as number[]).map((n, j) => (j % 2 === 0 ? k * n + e : k * n + f));
      annot.set(PDFName.of(key), context.obj(moved));
    }
  }
}
