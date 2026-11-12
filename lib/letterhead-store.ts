/**
 * The letterhead kept on this device (localStorage) and the file that shares
 * it with others ("Save as file", "Open a file"): the same JSON, the logo as
 * base64. Nothing here leaves the browser.
 */
import { LETTERHEAD_MAX_CHARS, type LetterheadStamp } from '@/lib/edit-pdf/types';

export interface SavedLogo {
  format: 'png' | 'jpg';
  width: number;
  height: number;
  bytes: Uint8Array;
}

export interface SavedLetterhead {
  left: string;
  right: string;
  footer: string;
  pages: LetterheadStamp['pages'];
  logo?: SavedLogo;
}

const STORAGE_KEY = 'blendpdf.letterhead.v1';
export const LETTERHEAD_FILE_NAME = 'letterhead.blendpdf.json';
/** A logo bigger than this (base64 included) is not worth a letterhead; it would also crowd localStorage. */
const MAX_LOGO_BYTES = 1024 * 1024;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function letterheadFileText(saved: SavedLetterhead): string {
  const { logo, ...text } = saved;
  return JSON.stringify({
    app: 'blendpdf',
    kind: 'letterhead',
    version: 1,
    letterhead: text,
    ...(logo ? { logo: { format: logo.format, width: logo.width, height: logo.height, base64: toBase64(logo.bytes) } } : {}),
  });
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length <= LETTERHEAD_MAX_CHARS;
const isSize = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 10000;

/** The letterhead in a saved file or the stored copy; null for anything else. */
export function parseLetterheadFile(text: string): SavedLetterhead | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (o.app !== 'blendpdf' || o.kind !== 'letterhead' || o.version !== 1) return null;
  const l = o.letterhead as Record<string, unknown> | undefined;
  if (!l || !isText(l.left) || !isText(l.right) || !isText(l.footer) || (l.pages !== 'all' && l.pages !== 'first')) return null;
  const saved: SavedLetterhead = { left: l.left, right: l.right, footer: l.footer, pages: l.pages };
  const logo = o.logo as Record<string, unknown> | undefined;
  if (logo) {
    if ((logo.format !== 'png' && logo.format !== 'jpg') || !isSize(logo.width) || !isSize(logo.height) || typeof logo.base64 !== 'string') return null;
    let bytes: Uint8Array;
    try {
      bytes = fromBase64(logo.base64);
    } catch {
      return null;
    }
    if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
    saved.logo = { format: logo.format, width: logo.width, height: logo.height, bytes };
  }
  return saved;
}

/** Longest side of a stored logo, in pixels: plenty for 48 points. */
export const LOGO_MAX_SIDE = 600;

/** The picked logo at most LOGO_MAX_SIDE on its longest side (a PNG then), or the file itself when already small. */
export async function smallLogo(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const k = LOGO_MAX_SIDE / Math.max(bitmap.width, bitmap.height);
    if (k >= 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('logo: toBlob failed'))), 'image/png'));
  } finally {
    bitmap.close();
  }
}

/** The copy kept on this device, or null (none, unreadable, or storage blocked). */
export function loadLetterhead(): SavedLetterhead | null {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    return text ? parseLetterheadFile(text) : null;
  } catch {
    return null;
  }
}

/** Keep it for next time. False when the browser refuses (private window, full storage). */
export function storeLetterhead(saved: SavedLetterhead): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, letterheadFileText(saved));
    return true;
  } catch {
    return false;
  }
}
