/**
 * Width and height of a PNG or JPEG, read from its header without decoding
 * it. pdf-lib decodes a whole PNG into memory before embedding it, so a small
 * file with huge dimensions (a 249 KB PNG of 8000 × 8000 added ~500 MB to the
 * process) could take the server down (security review, 2026-11-12). Routes
 * check the size against MAX_DECODED_PIXELS before embedding. JPEGs are
 * embedded as they are, never decoded, but their size is read the same way.
 */

/** Largest image a route decodes: 25 MP covers an A3 scan at 300 dpi (17 MP) and a 24 MP photo. */
export const MAX_DECODED_PIXELS = 25_000_000;

export type ImageSize = { width: number; height: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function imageSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length >= 24 && PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    // IHDR is always the first chunk: width and height are big-endian at 16 and 20
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes);
  return null;
}

/** Walk the JPEG markers to the first start-of-frame (SOF0..SOF15 except DHT, JPG and DAC). */
function jpegSize(bytes: Uint8Array): ImageSize | null {
  let i = 2;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xff) return null;
    const marker = bytes[i + 1];
    if (marker === 0xff) {
      i++; // fill byte
      continue;
    }
    // Markers without a length: TEM, RST0..7
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image or scan data before any frame header
    const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (length < 2) return null;
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (i + 8 >= bytes.length) return null;
      return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    }
    i += 2 + length;
  }
  return null;
}

/** True when the image is unreadable or bigger than `max` pixels: don't decode it. */
export function tooManyPixels(bytes: Uint8Array, max = MAX_DECODED_PIXELS): boolean {
  const size = imageSize(bytes);
  return !size || size.width * size.height > max;
}
