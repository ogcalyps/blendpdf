/**
 * Signatures and stamps kept on this device ("Keep it on this device for
 * next time" in the signature dialog), newest first, at most MAX_SAVED_MARKS.
 * Only in this browser's localStorage: never sent anywhere, never in the
 * letterhead file. Each is a PNG data URL, stored at most STORED_MAX_SIDE px.
 */

export interface SavedMark {
  id: string;
  /** PNG data URL. */
  dataUrl: string;
}

const STORAGE_KEY = 'blendpdf.marks.v1';
export const MAX_SAVED_MARKS = 4;
/** A stored copy's longest side, in pixels: plenty for a signature or a stamp on a page. */
export const STORED_MAX_SIDE = 800;
/** A data URL longer than this is not kept (a broken or huge picture would crowd out the rest). */
const MAX_DATA_URL_CHARS = 1_500_000;

const isMark = (value: unknown): value is SavedMark =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as SavedMark).id === 'string' &&
  typeof (value as SavedMark).dataUrl === 'string' &&
  (value as SavedMark).dataUrl.startsWith('data:image/png;base64,') &&
  (value as SavedMark).dataUrl.length <= MAX_DATA_URL_CHARS;

/** What a stored value holds: the valid marks, newest first, at most MAX_SAVED_MARKS. */
export function parseSavedMarks(text: string | null): SavedMark[] {
  if (!text) return [];
  try {
    const data: unknown = JSON.parse(text);
    return Array.isArray(data) ? data.filter(isMark).slice(0, MAX_SAVED_MARKS) : [];
  } catch {
    return [];
  }
}

/** The list with `dataUrl` first (moved up if it was there already), the oldest dropped past the limit. */
export function withMark(marks: readonly SavedMark[], dataUrl: string, id: string): SavedMark[] {
  return [{ id, dataUrl }, ...marks.filter((m) => m.dataUrl !== dataUrl)].slice(0, MAX_SAVED_MARKS);
}

export function loadSavedMarks(): SavedMark[] {
  try {
    return parseSavedMarks(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

/** False when the browser refuses (private window, full storage). */
export function storeSavedMarks(marks: readonly SavedMark[]): boolean {
  try {
    if (marks.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(marks));
    return true;
  } catch {
    return false;
  }
}

/** The PNG at most STORED_MAX_SIDE on its longest side, for keeping. */
export async function smallMark(dataUrl: string): Promise<string> {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const k = STORED_MAX_SIDE / Math.max(bitmap.width, bitmap.height);
    if (!(k < 1)) return dataUrl;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
