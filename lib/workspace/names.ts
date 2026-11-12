/**
 * File names of what the workspace saves (workspace-spec.md 5.5): the
 * visitor's own name plus the mode's suffix (lib/workspace/modes.ts).
 * Pure: the shell and the pipeline both use it.
 */

/** The file name without .pdf in any case ('Report.PDF' → 'Report'); never empty. */
export function baseName(file: { name: string }): string {
  return file.name.replace(/\.pdf$/i, '') || 'document';
}

/** `${base}_${suffix}.${ext}`, or `${base}.${ext}` when the suffix is ''. */
export function outputName(base: string, suffix: string, ext: string): string {
  return `${suffix ? `${base}_${suffix}` : base}.${ext}`;
}

/** File k (1-based) of "a PDF every N pages". */
export function partName(base: string, k: number): string {
  return `${base}_part-${k}.pdf`;
}

/** A run of selected pages next to each other, by 1-based page numbers in the saved file. */
export function runName(base: string, first: number, last: number): string {
  return `${base}_pages-${first}-${last}.pdf`;
}

/** The second file of "also save the selected pages as their own PDF". */
export function selectedName(base: string): string {
  return `${base}_selected.pdf`;
}
