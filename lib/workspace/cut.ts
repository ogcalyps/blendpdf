/**
 * Cut a saved PDF into several (workspace-spec.md 5.2 step 4), the way
 * split-pdf and extract-pages do today: a new pdf-lib document per group,
 * pages copied from the one loaded source. Groups are 0-based page positions.
 */

/** One new PDF per group, in order. pdf-lib loads once, with import(). */
export async function cutPdf(bytes: Uint8Array, groups: readonly (readonly number[])[]): Promise<Uint8Array[]> {
  const { PDFDocument } = await import('pdf-lib');
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out: Uint8Array[] = [];
  for (const group of groups) {
    const doc = await PDFDocument.create();
    const pages = await doc.copyPages(source, [...group]);
    pages.forEach((page) => doc.addPage(page));
    out.push(await doc.save());
  }
  return out;
}

/** "A PDF every n pages": [0..n-1], [n..2n-1], ... (n below 1 = one group). */
export function everyGroups(pageCount: number, n: number): number[][] {
  const size = n >= 1 ? Math.floor(n) : pageCount;
  const groups: number[][] = [];
  for (let start = 0; start < pageCount; start += size) {
    groups.push(Array.from({ length: Math.min(size, pageCount - start) }, (_, i) => start + i));
  }
  return groups;
}

/** "A PDF for each group of selected pages next to each other": consecutive runs of the sorted selection. */
export function runGroups(selected: readonly number[]): number[][] {
  const groups: number[][] = [];
  for (const position of [...new Set(selected)].sort((a, b) => a - b)) {
    const last = groups[groups.length - 1];
    if (last && position === last[last.length - 1] + 1) last.push(position);
    else groups.push([position]);
  }
  return groups;
}
