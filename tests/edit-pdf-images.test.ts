/**
 * lib/edit-pdf/images.ts byte readers and the passthrough decision, in Node.
 * JPEGs are hand-built from marker segments (and node-canvas, already a
 * dependency, for real encoder output) so the EXIF cases are exact.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCanvas, loadImage } from 'canvas';
import {
  isAnimatedPng,
  jpegInfo,
  jpegOrientation,
  passthroughImage,
  pngSize,
  prepareImage,
  sniffImageType,
  stripJpegMetadata,
  trimBounds,
  unappliedTurn,
} from '../lib/edit-pdf/images';
import { IMAGE_MAX_SIDE } from '../lib/edit-pdf/types';

const bytes = (...parts: Array<number[] | Uint8Array>) => Uint8Array.from(parts.flatMap((p) => [...p]));
const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32le = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff];
const u32be = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

function segment(marker: number, payload: number[]): number[] {
  return [0xff, marker, ...u16be(payload.length + 2), ...payload];
}

/** APP1 with a minimal TIFF: IFD0 holding one or more SHORT tags. */
function exifApp1(tags: Array<[number, number]>, little = true): number[] {
  const u16 = little ? u16le : u16be;
  const u32 = little ? u32le : u32be;
  const ifd = [...u16(tags.length), ...tags.flatMap(([tag, value]) => [...u16(tag), ...u16(3), ...u32(1), ...u16(value), 0, 0]), ...u32(0)];
  const tiff = [...(little ? ascii('II') : ascii('MM')), ...u16(42), ...u32(8), ...ifd];
  return segment(0xe1, [...ascii('Exif'), 0, 0, ...tiff]);
}

const JFIF = segment(0xe0, [...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const sof = (width: number, height: number, marker = 0xc0) => segment(marker, [8, ...u16be(height), ...u16be(width), 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
const SCAN = [0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x12, 0x34, 0xff, 0xd9];
const jpegOf = (...segments: number[][]) => bytes([0xff, 0xd8], ...segments, SCAN);

function canvasJpeg(width: number, height: number): Uint8Array {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c33';
  ctx.fillRect(0, 0, width, height);
  return new Uint8Array(canvas.toBuffer('image/jpeg'));
}

/** Insert an APP1 right after SOI, the way cameras write it. */
const withExif = (jpeg: Uint8Array, orientation: number, little = true) =>
  bytes(jpeg.subarray(0, 2), exifApp1([[0x0112, orientation]], little), jpeg.subarray(2));

describe('sniffImageType', () => {
  it('knows JPEG, PNG, WebP and GIF by their first bytes', () => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('png');
    expect(sniffImageType(bytes(ascii('RIFF'), [1, 2, 3, 4], ascii('WEBPVP8 ')))).toBe('webp');
    expect(sniffImageType(bytes(ascii('GIF89a'), [0, 0]))).toBe('gif');
    expect(sniffImageType(bytes(ascii('GIF87a')))).toBe('gif');
  });

  it('returns null for anything else, including truncated signatures', () => {
    expect(sniffImageType(bytes([]))).toBeNull();
    expect(sniffImageType(bytes([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(sniffImageType(bytes(ascii('RIFF'), [1, 2, 3, 4], ascii('WAVE')))).toBeNull();
    expect(sniffImageType(bytes(ascii('%PDF-1.7')))).toBeNull();
  });
});

describe('jpegOrientation', () => {
  it('reads orientation 1 and 6, little- and big-endian', () => {
    expect(jpegOrientation(jpegOf(exifApp1([[0x0112, 1]]), sof(40, 30)))).toBe(1);
    expect(jpegOrientation(jpegOf(exifApp1([[0x0112, 6]]), sof(40, 30)))).toBe(6);
    expect(jpegOrientation(jpegOf(exifApp1([[0x0112, 6]], false), sof(40, 30)))).toBe(6);
    expect(jpegOrientation(jpegOf(exifApp1([[0x0112, 8]], false), sof(40, 30)))).toBe(8);
  });

  it('finds the tag among others, after a JFIF segment and fill bytes', () => {
    const app1 = exifApp1([[0x010f, 7], [0x0112, 3], [0x0131, 2]]);
    expect(jpegOrientation(jpegOf(JFIF, [0xff], app1, sof(40, 30)))).toBe(3);
  });

  it('is null when there is no EXIF, no orientation tag, or an out-of-range value', () => {
    expect(jpegOrientation(jpegOf(JFIF, sof(40, 30)))).toBeNull();
    expect(jpegOrientation(jpegOf(exifApp1([[0x010f, 6]]), sof(40, 30)))).toBeNull();
    expect(jpegOrientation(jpegOf(exifApp1([[0x0112, 0]]), sof(40, 30)))).toBeNull();
    expect(jpegOrientation(jpegOf(exifApp1([[0x0112, 9]]), sof(40, 30)))).toBeNull();
    // XMP is APP1 too: not EXIF.
    expect(jpegOrientation(jpegOf(segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x/>')), sof(40, 30)))).toBeNull();
    expect(jpegOrientation(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBeNull();
  });

  it('survives a truncated APP1: the segment claims more bytes than the file has', () => {
    const full = bytes([0xff, 0xd8], exifApp1([[0x0112, 6]]));
    for (let cut = 4; cut < full.length; cut++) {
      const value = jpegOrientation(full.subarray(0, cut));
      expect(value === null || value === 6, `cut at ${cut}`).toBe(true);
    }
    // Cut inside the IFD entry: the value is not there, so no orientation.
    expect(jpegOrientation(full.subarray(0, full.length - 8))).toBeNull();
    expect(jpegOrientation(full)).toBe(6);
  });

  it('reads what a real encoder writes with EXIF added', () => {
    const jpeg = canvasJpeg(8, 6);
    expect(jpegOrientation(jpeg)).toBeNull();
    expect(jpegOrientation(withExif(jpeg, 6))).toBe(6);
    expect(jpegOrientation(withExif(jpeg, 1, false))).toBe(1);
  });
});

describe('jpegInfo and pngSize', () => {
  it('reads the stored pixel size and the frame type', () => {
    expect(jpegInfo(jpegOf(exifApp1([[0x0112, 6]]), sof(4032, 3024)))).toEqual({ width: 4032, height: 3024, orientation: 6, frame: 0xc0 });
    expect(jpegInfo(jpegOf(JFIF, sof(640, 480, 0xc2)))).toEqual({ width: 640, height: 480, orientation: null, frame: 0xc2 });
    expect(jpegInfo(withExif(canvasJpeg(8, 6), 3))).toMatchObject({ width: 8, height: 6, orientation: 3 });
    expect(jpegInfo(jpegOf(JFIF))).toBeNull(); // no frame header before the scan
    expect(jpegInfo(jpegOf(JFIF, sof(0, 480)))).toBeNull();
  });

  it('reads a PNG size from IHDR', () => {
    const canvas = createCanvas(13, 7);
    expect(pngSize(new Uint8Array(canvas.toBuffer('image/png')))).toEqual({ width: 13, height: 7 });
    expect(pngSize(canvasJpeg(13, 7))).toBeNull();
  });
});

describe('passthrough decision', () => {
  it('passes an upright JPEG within IMAGE_MAX_SIDE through untouched', () => {
    const jpeg = canvasJpeg(30, 20);
    const prepared = passthroughImage(jpeg);
    expect(prepared).toEqual({ format: 'jpg', bytes: jpeg, width: 30, height: 20 });
    expect(prepared!.bytes).toBe(jpeg);
    expect(passthroughImage(withExif(jpeg, 1))).toMatchObject({ format: 'jpg', width: 30, height: 20 });
    expect(passthroughImage(jpegOf(JFIF, sof(IMAGE_MAX_SIDE, 10, 0xc2)))).toMatchObject({ format: 'jpg', width: IMAGE_MAX_SIDE });
  });

  it('redraws a JPEG with an EXIF turn, one that is too large, a rare coding, or a trimmed one', () => {
    for (const orientation of [2, 3, 4, 5, 6, 7, 8]) expect(passthroughImage(withExif(canvasJpeg(30, 20), orientation)), String(orientation)).toBeNull();
    expect(passthroughImage(jpegOf(JFIF, sof(IMAGE_MAX_SIDE + 1, 10)))).toBeNull();
    expect(passthroughImage(jpegOf(JFIF, sof(10, IMAGE_MAX_SIDE + 1)))).toBeNull();
    expect(passthroughImage(jpegOf(JFIF, sof(100, 100, 0xc3)))).toBeNull(); // lossless
    expect(passthroughImage(jpegOf(JFIF, sof(100, 100, 0xc9)))).toBeNull(); // arithmetic coding
    expect(passthroughImage(canvasJpeg(30, 20), { trim: true })).toBeNull();
  });

  it('passes a PNG through unless it is too large or trimmed; WebP and GIF are always redrawn', () => {
    const png = new Uint8Array(createCanvas(30, 20).toBuffer('image/png'));
    expect(passthroughImage(png)).toEqual({ format: 'png', bytes: png, width: 30, height: 20 });
    expect(passthroughImage(png, { trim: true })).toBeNull();
    expect(passthroughImage(new Uint8Array(createCanvas(IMAGE_MAX_SIDE + 1, 2).toBuffer('image/png')))).toBeNull();
    expect(passthroughImage(bytes(ascii('RIFF'), [1, 2, 3, 4], ascii('WEBPVP8 ')))).toBeNull();
    expect(passthroughImage(bytes(ascii('GIF89a'), [1, 0, 1, 0]))).toBeNull();
  });

  it('leaves out EXIF (GPS included), XMP, ICC and comments; keeps JFIF, Adobe and the image data byte for byte', async () => {
    const jpeg = canvasJpeg(30, 20);
    expect([jpeg[2], jpeg[3]]).toEqual([0xff, 0xe0]); // node-canvas writes JFIF first
    const afterJfif = 4 + ((jpeg[4] << 8) | jpeg[5]);
    const adobe = segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 1]);
    const metadata = [
      exifApp1([[0x0112, 1], [0x8825, 26]]), // upright, plus a GPS IFD pointer
      segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>SECRET-XMP 48.8583N 2.2945E</x:xmpmeta>')),
      segment(0xe2, ascii('ICC_PROFILE\0SECRET-ICC')),
      segment(0xed, ascii('Photoshop 3.0\0SECRET-IPTC')),
      segment(0xfe, ascii('SECRET-COMMENT')),
    ];
    const tagged = bytes(jpeg.subarray(0, afterJfif), metadata[0], adobe, ...metadata.slice(1), jpeg.subarray(afterJfif));

    const prepared = await prepareImage(new Blob([tagged], { type: 'image/jpeg' }));
    expect(prepared).toMatchObject({ format: 'jpg', width: 30, height: 20 });
    const out = Buffer.from(prepared.bytes);
    expect(out.equals(Buffer.from(bytes(jpeg.subarray(0, afterJfif), adobe, jpeg.subarray(afterJfif))))).toBe(true);
    const text = out.toString('latin1');
    for (const gone of ['Exif', 'http://ns.adobe.com/xap', 'ICC_PROFILE', 'Photoshop', 'SECRET']) expect(text, gone).not.toContain(gone);
    expect((await loadImage(out)).width).toBe(30);
  });

  it('leaves the bytes alone when there is nothing to leave out, and redraws a JPEG whose header does not parse to the scan', () => {
    const jpeg = canvasJpeg(30, 20);
    expect(stripJpegMetadata(jpeg)).toBe(jpeg);
    expect(stripJpegMetadata(bytes([0xff, 0xd8], JFIF, sof(10, 10)))).toBeNull(); // no scan
    expect(stripJpegMetadata(bytes([0xff, 0xd8], JFIF, sof(10, 10), [0xff, 0xe1, 0x40, 0x00, 1, 2]))).toBeNull(); // segment past the end
    expect(passthroughImage(bytes([0xff, 0xd8], JFIF, sof(10, 10)))).toBeNull();
  });

  it('redraws an animated PNG (pdf-lib refuses those): the redraw keeps its first frame', () => {
    const png = new Uint8Array(createCanvas(8, 8).toBuffer('image/png'));
    const afterIhdr = 8 + 25;
    const acTL = [...u32be(8), ...ascii('acTL'), ...u32be(2), ...u32be(0), 0, 0, 0, 0];
    const animated = bytes(png.subarray(0, afterIhdr), acTL, png.subarray(afterIhdr));
    expect(isAnimatedPng(animated)).toBe(true);
    expect(isAnimatedPng(png)).toBe(false);
    expect(passthroughImage(animated)).toBeNull();
    expect(passthroughImage(png)).not.toBeNull();
  });

  it('prepareImage returns the original bytes for an upright photo, and goes to the browser redraw for a turned one', async () => {
    const jpeg = canvasJpeg(30, 20);
    const prepared = await prepareImage(new Blob([jpeg.slice()], { type: 'image/jpeg' }));
    expect(prepared.format).toBe('jpg');
    expect(Buffer.from(prepared.bytes).equals(Buffer.from(jpeg))).toBe(true);
    // Node has no canvas decoder for prepareImage: reaching it proves the photo was not passed through sideways.
    await expect(prepareImage(new Blob([withExif(jpeg, 6)], { type: 'image/jpeg' }))).rejects.toThrow(/browser/);
  });
});

describe('trimBounds (signature trim)', () => {
  const rgba = (width: number, height: number, ink: Array<[number, number, number]>) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (const [x, y, alpha] of ink) data[(y * width + x) * 4 + 3] = alpha;
    return data;
  };

  it('cuts transparent margins and keeps 4 px around the ink, clamped to the image', () => {
    expect(trimBounds(rgba(100, 50, [[20, 10, 255], [60, 30, 200]]), 100, 50)).toEqual({ x: 16, y: 6, width: 49, height: 29 });
    expect(trimBounds(rgba(100, 50, [[1, 1, 255], [99, 49, 255]]), 100, 50)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });

  it('ignores near-transparent haze and keeps the whole image when nothing is drawn', () => {
    expect(trimBounds(rgba(100, 50, [[5, 5, 8], [50, 25, 9]]), 100, 50)).toEqual({ x: 46, y: 21, width: 9, height: 9 });
    expect(trimBounds(rgba(10, 10, []), 10, 10)).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });
});

/**
 * The redraw path needs browser canvas APIs. node-canvas stands in for them:
 * it decodes (applying the EXIF turn, as browsers do for
 * createImageBitmap with imageOrientation 'from-image'), draws, reads pixels
 * and encodes like a browser canvas.
 */
describe('prepareImage redraw (browser canvas stood in by node-canvas)', () => {
  const decodeOptions: unknown[] = [];

  /** Remove an APP1 right after SOI, so node-canvas decodes the pixels as stored (what an EXIF-blind decoder returns). */
  const withoutApp1 = (data: Uint8Array) =>
    data[2] === 0xff && data[3] === 0xe1 ? bytes(data.subarray(0, 2), data.subarray(4 + ((data[4] << 8) | data[5]))) : data;

  function stubBrowser(decoder: 'applies EXIF' | 'ignores EXIF' = 'applies EXIF') {
    decodeOptions.length = 0;
    vi.stubGlobal('createImageBitmap', async (blob: Blob, options: unknown) => {
      decodeOptions.push(options);
      const data = new Uint8Array(await blob.arrayBuffer());
      const image = await loadImage(Buffer.from(decoder === 'ignores EXIF' ? withoutApp1(data) : data));
      return Object.assign(image, { close: () => undefined });
    });
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        expect(tag).toBe('canvas');
        const canvas = createCanvas(1, 1);
        return Object.assign(canvas, {
          toBlob(callback: (blob: Blob | null) => void, type: string, quality?: number) {
            const buffer = type === 'image/jpeg' ? canvas.toBuffer('image/jpeg', { quality: quality ?? 0.92 }) : canvas.toBuffer('image/png');
            callback(new Blob([new Uint8Array(buffer)], { type }));
          },
        });
      },
    });
  }

  afterEach(() => vi.unstubAllGlobals());

  const png = (width: number, height: number, draw: (ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>) => void) => {
    const canvas = createCanvas(width, height);
    draw(canvas.getContext('2d'));
    return new Blob([new Uint8Array(canvas.toBuffer('image/png'))], { type: 'image/png' });
  };

  it('asks the browser to apply the EXIF turn, and writes the upright photo back as JPEG', async () => {
    stubBrowser();
    const turned = withExif(canvasJpeg(60, 40), 6);
    const prepared = await prepareImage(new Blob([turned], { type: 'image/jpeg' }));
    expect(decodeOptions).toEqual([{ imageOrientation: 'from-image' }]);
    expect(prepared.format).toBe('jpg');
    expect(sniffImageType(prepared.bytes)).toBe('jpg');
    expect(jpegOrientation(prepared.bytes)).toBeNull(); // the pixels are upright now; no turn left to apply
    // Stored 60 x 40 landscape with "turn 90°": the visitor's photo is portrait, and so is what the PDF gets.
    expect([prepared.width, prepared.height]).toEqual([40, 60]);
    expect(jpegInfo(prepared.bytes)).toMatchObject({ width: 40, height: 60 });
  });

  /** Raw 60 x 40: left half red, right half blue. Stored with EXIF 6, the visitor sees it turned clockwise: red on top. */
  function halvesJpeg() {
    const canvas = createCanvas(60, 40);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 30, 40);
    ctx.fillStyle = '#0000ff';
    ctx.fillRect(30, 0, 30, 40);
    return withExif(new Uint8Array(canvas.toBuffer('image/jpeg', { quality: 0.95 })), 6);
  }

  async function topAndBottom(jpeg: Uint8Array): Promise<{ size: [number, number]; top: number[]; bottom: number[] }> {
    const image = await loadImage(Buffer.from(jpeg));
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const at = (y: number) => [...ctx.getImageData(Math.floor(image.width / 2), y, 1, 1).data.slice(0, 3)];
    return { size: [image.width, image.height], top: at(5), bottom: at(image.height - 6) };
  }

  it.each(['applies EXIF', 'ignores EXIF'] as const)('a portrait phone photo comes out upright when the decoder %s', async (decoder) => {
    stubBrowser(decoder);
    const prepared = await prepareImage(new Blob([halvesJpeg()], { type: 'image/jpeg' }));
    expect([prepared.width, prepared.height]).toEqual([40, 60]);
    const { size, top, bottom } = await topAndBottom(prepared.bytes);
    expect(size).toEqual([40, 60]);
    expect(top[0]).toBeGreaterThan(200); // red on top
    expect(top[2]).toBeLessThan(60);
    expect(bottom[2]).toBeGreaterThan(200); // blue at the bottom
    expect(bottom[0]).toBeLessThan(60);
  });

  it('tells a decode that skipped the quarter turn from one that applied it', () => {
    const info = (orientation: number | null, width = 60, height = 40) => ({ width, height, orientation, frame: 0xc0 });
    expect(unappliedTurn(info(6), 60, 40)).toBe(6);
    expect(unappliedTurn(info(8), 60, 40)).toBe(8);
    expect(unappliedTurn(info(6), 40, 60)).toBe(0); // already turned
    expect(unappliedTurn(info(3), 60, 40)).toBe(0); // a half turn keeps the size: left to the browser
    expect(unappliedTurn(info(1), 60, 40)).toBe(0);
    expect(unappliedTurn(info(null), 60, 40)).toBe(0);
    expect(unappliedTurn(info(6, 50, 50), 50, 50)).toBe(0); // square: cannot tell
    expect(unappliedTurn(null, 60, 40)).toBe(0);
  });

  it('scales the longest side down to IMAGE_MAX_SIDE, keeping the aspect', async () => {
    stubBrowser();
    const prepared = await prepareImage(png(3000, 1200, (ctx) => {
      ctx.fillStyle = '#123456';
      ctx.fillRect(0, 0, 3000, 1200);
    }));
    expect([prepared.width, prepared.height]).toEqual([IMAGE_MAX_SIDE, 960]);
    expect(prepared.format).toBe('jpg'); // opaque
    expect(jpegInfo(prepared.bytes)).toMatchObject({ width: IMAGE_MAX_SIDE, height: 960 });
  });

  it('keeps transparency as PNG when a large picture with alpha is scaled', async () => {
    stubBrowser();
    const prepared = await prepareImage(png(2600, 100, (ctx) => {
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(100, 10, 400, 50);
    }));
    expect(prepared.format).toBe('png');
    expect(pngSize(prepared.bytes)).toEqual({ width: IMAGE_MAX_SIDE, height: 92 });
  });

  it('trims a signature to its ink plus 4 px, as PNG', async () => {
    stubBrowser();
    const prepared = await prepareImage(
      png(400, 150, (ctx) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(120, 50, 100, 30);
      }),
      { trim: true },
    );
    expect(prepared.format).toBe('png');
    expect([prepared.width, prepared.height]).toEqual([108, 38]);
    expect(pngSize(prepared.bytes)).toEqual({ width: 108, height: 38 });
  });
});
