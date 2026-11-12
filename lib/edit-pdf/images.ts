/**
 * Turning an uploaded picture (or a SignaturePad PNG) into bytes pdf-lib can
 * embed. Reached through import() from ./index.
 *
 * pdf-lib embeds JPEG bytes as they are (DCTDecode) and PNG pixels as they
 * are, so nothing applies a phone photo's EXIF orientation for us: a portrait
 * photo saved as landscape pixels plus "turn 90°" would land sideways in the
 * PDF. Such a photo is decoded by the browser (which applies the turn) and
 * written again. A JPEG that needs no turn and no scaling keeps its image
 * data byte for byte, so photos keep their quality and size; only its
 * metadata segments (EXIF with GPS, XMP, comments) are left out.
 *
 * The byte readers (sniffImageType, jpegInfo, pngSize) are pure and run in
 * Node; prepareImage itself needs a browser for anything it has to redraw.
 */
import { IMAGE_MAX_SIDE } from './types';
import type { PreparedImage, PrepareImageOptions } from './types';

export type SniffedImageType = 'jpg' | 'png' | 'webp' | 'gif';

/** The image format from its first bytes, or null. */
export function sniffImageType(bytes: Uint8Array): SniffedImageType | null {
  const at = (i: number) => bytes[i];
  if (bytes.length >= 3 && at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'jpg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => at(i) === b)) return 'png';
  const ascii = (start: number, text: string) => [...text].every((ch, i) => at(start + i) === ch.charCodeAt(0));
  if (bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WEBP')) return 'webp';
  if (bytes.length >= 6 && (ascii(0, 'GIF87a') || ascii(0, 'GIF89a'))) return 'gif';
  return null;
}

export interface JpegInfo {
  /** Pixels, as stored (before any EXIF turn). */
  width: number;
  height: number;
  /** EXIF orientation 1-8, or null when there is none (or it is unreadable). */
  orientation: number | null;
  /** Start-of-frame marker: 0xC0 baseline, 0xC1 extended, 0xC2 progressive, others are rare codings. */
  frame: number;
}

const STANDALONE = (marker: number) => marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
const isStartOfFrame = (marker: number) => marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

/** EXIF orientation from an APP1 payload (starting at "Exif\0\0"), or null. Every read is bounds-checked. */
function exifOrientation(bytes: Uint8Array, start: number, end: number): number | null {
  if (end - start < 14) return null;
  const header = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  if (!header.every((b, i) => bytes[start + i] === b)) return null;
  const tiff = start + 6;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (at: number) => (at + 2 > end ? -1 : little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1]);
  const u32 = (at: number) =>
    at + 4 > end
      ? -1
      : little
        ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
        : ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  if (u16(tiff + 2) !== 42) return null;
  const ifd = u32(tiff + 4);
  if (ifd < 0) return null;
  const entries = u16(tiff + ifd);
  if (entries < 0) return null;
  for (let i = 0; i < entries; i++) {
    const entry = tiff + ifd + 2 + i * 12;
    if (entry + 12 > end) return null;
    if (u16(entry) !== 0x0112) continue;
    const value = u16(entry + 8); // type SHORT, count 1: the value sits in the first two bytes of the value field
    return value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

interface JpegScan {
  orientation: number | null;
  frame: { width: number; height: number; marker: number } | null;
}

/**
 * Walk a JPEG's marker segments up to the frame header (or the start of
 * scan), reading the EXIF orientation on the way. Stops quietly at the first
 * thing that does not parse, keeping what it found before it.
 */
function scanJpeg(bytes: Uint8Array): JpegScan {
  const scan: JpegScan = { orientation: null, frame: null };
  let offset = 2;
  while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
    let marker = bytes[offset + 1];
    // Fill bytes: any number of 0xFF may come before a marker.
    while (marker === 0xff && offset + 2 < bytes.length) marker = bytes[++offset + 1];
    if (STANDALONE(marker)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda || offset + 4 > bytes.length) break; // end of image, start of scan
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) break;
    const start = offset + 4;
    const end = Math.min(offset + 2 + length, bytes.length);
    if (marker === 0xe1 && scan.orientation === null) scan.orientation = exifOrientation(bytes, start, end);
    if (isStartOfFrame(marker)) {
      if (start + 5 <= bytes.length) {
        const height = (bytes[start + 1] << 8) | bytes[start + 2];
        const width = (bytes[start + 3] << 8) | bytes[start + 4];
        if (width && height) scan.frame = { width, height, marker };
      }
      break;
    }
    offset += 2 + length;
  }
  return scan;
}

/** Size, EXIF orientation and frame type of a JPEG. Null when the bytes are not a JPEG with a readable frame header. */
export function jpegInfo(bytes: Uint8Array): JpegInfo | null {
  if (sniffImageType(bytes) !== 'jpg') return null;
  const { orientation, frame } = scanJpeg(bytes);
  return frame ? { width: frame.width, height: frame.height, orientation, frame: frame.marker } : null;
}

/** EXIF orientation of a JPEG (1-8), or null when it has none or it cannot be read. */
export function jpegOrientation(bytes: Uint8Array): number | null {
  return sniffImageType(bytes) === 'jpg' ? scanJpeg(bytes).orientation : null;
}

/** Width and height of a PNG from its IHDR chunk, or null. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (sniffImageType(bytes) !== 'png' || bytes.length < 24) return null;
  const ihdr = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (ihdr !== 'IHDR') return null;
  const u32 = (at: number) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  const width = u32(16);
  const height = u32(20);
  return width && height ? { width, height } : null;
}

/** Baseline, extended or progressive Huffman JPEG: what every PDF viewer decodes. */
const PASSTHROUGH_FRAMES = new Set([0xc0, 0xc1, 0xc2]);

/**
 * Segments that only describe the photo: APP1-APP13 and APP15 (EXIF with
 * GPS position, camera and time, XMP, ICC, maker data) and COM. APP0 (JFIF)
 * and APP14 (Adobe: how to read the colours) stay. PDF viewers take the
 * colour space from the PDF, not from an ICC segment.
 */
const isMetadataSegment = (marker: number) => (marker >= 0xe1 && marker <= 0xef && marker !== 0xee) || marker === 0xfe;

/**
 * The JPEG without its metadata segments: everything up to the start of
 * scan is copied segment by segment, minus those; the image data after it
 * is copied as it is (lossless). The original array when nothing was
 * dropped; null when the header does not parse up to the scan.
 */
export function stripJpegMetadata(bytes: Uint8Array): Uint8Array | null {
  if (sniffImageType(bytes) !== 'jpg') return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let dropped = false;
  let offset = 2;
  while (offset + 1 < bytes.length && bytes[offset] === 0xff) {
    let at = offset;
    while (at + 2 < bytes.length && bytes[at + 1] === 0xff) at++; // fill bytes, left out
    if (at !== offset) dropped = true;
    const marker = bytes[at + 1];
    if (marker === 0xda) {
      if (!dropped) return bytes;
      parts.push(bytes.subarray(at));
      const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
      let o = 0;
      for (const part of parts) {
        out.set(part, o);
        o += part.length;
      }
      return out;
    }
    if (STANDALONE(marker)) {
      parts.push(bytes.subarray(at, at + 2));
      offset = at + 2;
      continue;
    }
    if (marker === 0xd9 || at + 4 > bytes.length) return null;
    const length = (bytes[at + 2] << 8) | bytes[at + 3];
    const end = at + 2 + length;
    if (length < 2 || end > bytes.length) return null;
    if (isMetadataSegment(marker)) dropped = true;
    else parts.push(bytes.subarray(at, end));
    offset = end;
  }
  return null;
}

/** True when an acTL chunk comes before the image data: an animated PNG, which pdf-lib refuses to embed. */
export function isAnimatedPng(bytes: Uint8Array): boolean {
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
    const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
    if (type === 'acTL') return true;
    if (type === 'IDAT' || type === 'IEND') return false;
    at += 12 + length;
  }
  return false;
}

/**
 * What prepareImage can hand pdf-lib without redrawing: an upright JPEG (no
 * EXIF turn; its metadata segments left out) or a still PNG, within
 * IMAGE_MAX_SIDE, when no trim is asked for. Null means the picture has to
 * be decoded and written again (an animated PNG keeps its first frame).
 */
export function passthroughImage(bytes: Uint8Array, options: PrepareImageOptions = {}): PreparedImage | null {
  if (options.trim) return null;
  const type = sniffImageType(bytes);
  if (type === 'jpg') {
    const info = jpegInfo(bytes);
    if (!info || !PASSTHROUGH_FRAMES.has(info.frame)) return null;
    if (info.orientation !== null && info.orientation !== 1) return null;
    if (Math.max(info.width, info.height) > IMAGE_MAX_SIDE) return null;
    const clean = stripJpegMetadata(bytes);
    return clean ? { format: 'jpg', bytes: clean, width: info.width, height: info.height } : null;
  }
  if (type === 'png') {
    const size = pngSize(bytes);
    if (!size || Math.max(size.width, size.height) > IMAGE_MAX_SIDE || isAnimatedPng(bytes)) return null;
    return { format: 'png', bytes, width: size.width, height: size.height };
  }
  return null;
}

/** Fully transparent margins are cut, leaving this much room around the ink (sign-pdf does the same). */
const TRIM_PAD = 4;
/** Alpha at or below this counts as transparent when trimming (anti-aliasing haze). */
const TRIM_ALPHA = 8;

/** The ink's bounding box in RGBA pixels, padded, or the whole image when nothing is drawn. */
export function trimBounds(data: Uint8ClampedArray | Uint8Array, width: number, height: number): { x: number; y: number; width: number; height: number } {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > TRIM_ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width, height };
  const x = Math.max(0, minX - TRIM_PAD);
  const y = Math.max(0, minY - TRIM_PAD);
  return { x, y, width: Math.min(width, maxX + TRIM_PAD + 1) - x, height: Math.min(height, maxY + TRIM_PAD + 1) - y };
}

type Drawable = ImageBitmap | HTMLImageElement;

/** Decode with the EXIF turn applied. createImageBitmap first; an <img> (which also applies it) where that fails. */
async function decode(blob: Blob): Promise<{ image: Drawable; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Older Safari rejects the options bag or the format; the <img> path below handles both.
    }
  }
  if (typeof document === 'undefined') throw new Error('prepareImage needs a browser to redraw this image');
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('The image could not be decoded'));
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('The image could not be decoded');
    await img.decode?.().catch(() => undefined);
    return { image: img, width: img.naturalWidth, height: img.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function newCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function canvasBytes(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg'): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('The image could not be encoded'));
        else blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      type,
      type === 'image/jpeg' ? 0.9 : undefined,
    );
  });
}

/**
 * The EXIF quarter turn (5-8) the decoder left out, or 0. Browsers apply the
 * turn when decoding (createImageBitmap 'from-image', <img>), but some Safari
 * versions hand createImageBitmap's pixels back as stored. A quarter turn
 * swaps width and height, so a decode that comes back at the stored size
 * gave the raw pixels. Half turns and mirrors (2-4) keep the size and cannot
 * be told apart; they are rare in phone photos and left to the browser.
 */
export function unappliedTurn(info: JpegInfo | null, decodedWidth: number, decodedHeight: number): 0 | 5 | 6 | 7 | 8 {
  const o = info?.orientation;
  if (!info || !o || o < 5 || info.width === info.height) return 0;
  return decodedWidth === info.width && decodedHeight === info.height ? (o as 5 | 6 | 7 | 8) : 0;
}

/**
 * Canvas transform that draws raw pixels (w x h) upright for EXIF
 * orientation 5-8, on a canvas h wide and w high.
 */
export function turnTransform(orientation: 5 | 6 | 7 | 8, w: number, h: number): [number, number, number, number, number, number] {
  switch (orientation) {
    case 5:
      return [0, 1, 1, 0, 0, 0]; // transpose
    case 6:
      return [0, 1, -1, 0, h, 0]; // turn 90° clockwise
    case 7:
      return [0, -1, -1, 0, h, w]; // transverse
    case 8:
      return [0, -1, 1, 0, 0, w]; // turn 90° counter-clockwise
  }
}

/**
 * Bytes ready for pdf-lib. JPEG passthrough (minus its metadata) when upright
 * and small enough; PNG passthrough when it is still and no scaling or trim
 * is needed; anything else is drawn
 * (EXIF turn applied), scaled to IMAGE_MAX_SIDE, optionally trimmed to its
 * ink, and saved as PNG when it has transparency (or was trimmed), JPEG
 * (quality 0.9) when it is opaque. Browser only for the redraw.
 */
export async function prepareImage(input: Blob, options: PrepareImageOptions = {}): Promise<PreparedImage> {
  const bytes = new Uint8Array(await input.arrayBuffer());
  const direct = passthroughImage(bytes, options);
  if (direct) return direct;

  const decoded = await decode(new Blob([bytes], { type: input.type }));
  try {
    const turn = unappliedTurn(sniffImageType(bytes) === 'jpg' ? jpegInfo(bytes) : null, decoded.width, decoded.height);
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(decoded.width, decoded.height));
    // Size of the decoded pixels once scaled, and of the result (sideways for the quarter turns).
    const drawnWidth = Math.max(1, Math.round(decoded.width * scale));
    const drawnHeight = Math.max(1, Math.round(decoded.height * scale));
    const [width, height] = turn ? [drawnHeight, drawnWidth] : [drawnWidth, drawnHeight];
    const canvas = newCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
    if (turn) ctx.setTransform(...turnTransform(turn, drawnWidth, drawnHeight));
    ctx.drawImage(decoded.image, 0, 0, drawnWidth, drawnHeight);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height).data;

    let hasAlpha = false;
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] < 255) {
        hasAlpha = true;
        break;
      }
    }

    if (options.trim) {
      const box = trimBounds(pixels, width, height);
      const out = newCanvas(box.width, box.height);
      const outCtx = out.getContext('2d');
      if (!outCtx) throw new Error('Canvas 2D is not supported in this browser');
      outCtx.drawImage(canvas, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
      return { format: 'png', bytes: await canvasBytes(out, 'image/png'), width: box.width, height: box.height };
    }
    if (hasAlpha) return { format: 'png', bytes: await canvasBytes(canvas, 'image/png'), width, height };
    return { format: 'jpg', bytes: await canvasBytes(canvas, 'image/jpeg'), width, height };
  } finally {
    decoded.close();
  }
}
