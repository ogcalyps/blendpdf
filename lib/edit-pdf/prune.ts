/**
 * Drop every indirect object nothing refers to any more.
 *
 * pdf-lib writes every object it holds, whether or not anything still points
 * at it: the content of a deleted page, objects freed by earlier incremental
 * updates, fields removed while flattening. Without this pass "delete page"
 * would only hide the page; its text and images would still be in the file
 * for anyone who opens it with a text editor.
 */
import { PDFArray, PDFDict, PDFRef, PDFStream } from 'pdf-lib';
import type { PDFContext, PDFObject } from 'pdf-lib';

/**
 * Delete the objects not reachable from the trailer (Root, Info, Encrypt),
 * or from `keep` (objects a caller will point at again later). Returns how
 * many were deleted.
 */
export function pruneUnreachable(context: PDFContext, keep: readonly PDFRef[] = []): number {
  const reached = new Set<PDFRef>(); // PDFRef.of interns refs, so identity is enough
  const stack: PDFObject[] = [...keep];
  const { Root, Info, Encrypt } = context.trailerInfo;
  for (const root of [Root, Info, Encrypt]) if (root) stack.push(root);

  while (stack.length > 0) {
    const object = stack.pop()!;
    if (object instanceof PDFRef) {
      if (reached.has(object)) continue;
      reached.add(object);
      const target = context.lookup(object);
      if (target) stack.push(target);
    } else if (object instanceof PDFDict) {
      for (const [, value] of object.entries()) stack.push(value);
    } else if (object instanceof PDFArray) {
      for (let i = 0; i < object.size(); i++) stack.push(object.get(i));
    } else if (object instanceof PDFStream) {
      stack.push(object.dict);
    }
  }

  let deleted = 0;
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!reached.has(ref)) {
      context.delete(ref);
      deleted++;
    }
  }
  return deleted;
}
