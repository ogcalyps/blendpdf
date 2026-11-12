/**
 * "Keep working on this file": the result of one tool, handed to the next
 * tool page in the same tab.
 *
 * Held in this module's memory only. It survives the client-side navigation
 * to the next tool and is gone on a reload or in another tab: nothing is
 * written to browser storage and nothing is uploaded by handing it over.
 */
import type { Accept } from 'react-dropzone';

export interface Handoff {
  file: File;
  /** Slug of the tool that made the file, e.g. 'crop-pdf'. */
  from: string;
}

let pending: Handoff | null = null;

export function setHandoff(file: File, from: string): void {
  pending = { file, from };
}

/** One-shot: the first main dropzone to mount takes it, whether or not it can use it. */
export function takeHandoff(): Handoff | null {
  const handoff = pending;
  pending = null;
  return handoff;
}

/** Same matching as the file picker's `accept`: a MIME type, a type/* wildcard, or an extension. */
export function acceptsFile(accept: Accept | undefined, file: Pick<File, 'name' | 'type'>): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return Object.entries(accept).some(([mime, extensions]) => {
    const m = mime.toLowerCase();
    if (m === type) return true;
    if (m.endsWith('/*') && type.startsWith(m.slice(0, -1))) return true;
    return extensions.some((ext) => name.endsWith(ext.toLowerCase()));
  });
}
