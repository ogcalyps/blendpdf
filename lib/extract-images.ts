/**
 * The pictures inside a PDF as PNGs, read in the browser with pdf.js and a
 * canvas (moved from app/[locale]/extract-images/page.tsx, same behaviour:
 * first 200 pages, up to 500 images, each image once, tiny ones skipped,
 * and the visitor told when a limit cut it short).
 * pdf.js comes through lib/pdfjs-init, never a static import.
 */
import { getPdfJs } from '@/lib/pdfjs-init';

export const MAX_IMAGE_SCAN_PAGES = 200;
export const MAX_EXTRACTED_IMAGES = 500;
const MIN_DIMENSION = 16; // skip tiny images (usually masks/artifacts)
const RESOLVE_TIMEOUT_MS = 3000;

/** Minimal structural types so we never statically import pdfjs-dist. */
interface PdfObjectStore {
  get: (objId: string, callback?: (data: unknown) => void) => unknown;
  has: (objId: string) => boolean;
}

interface PdfImageObject {
  width?: number;
  height?: number;
  kind?: number;
  data?: Uint8ClampedArray | Uint8Array | null;
  bitmap?: ImageBitmap | null;
}

interface PdfPageLike {
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  objs: PdfObjectStore;
  commonObjs: PdfObjectStore;
  cleanup: () => void;
}

// pdfjs ImageKind constants (stable across pdfjs versions)
const IMAGE_KIND_GRAYSCALE_1BPP = 1;
const IMAGE_KIND_RGB_24BPP = 2;
const IMAGE_KIND_RGBA_32BPP = 3;

/**
 * Resolve an image XObject by name from the page's object stores.
 * pdfjs 3.x: the synchronous objs.get(name) THROWS if the object hasn't been
 * resolved yet, so prefer has() + sync get, then fall back to the callback
 * form with a timeout (the callback never fires for objects that never resolve).
 * Globally-cached images (names prefixed "g_") live in page.commonObjs.
 */
async function resolveImageObject(
  objs: PdfObjectStore,
  commonObjs: PdfObjectStore,
  name: string
): Promise<PdfImageObject | null> {
  const stores = name.startsWith('g_') ? [commonObjs, objs] : [objs, commonObjs];

  // Fast path: already resolved in one of the stores
  for (const store of stores) {
    try {
      if (store.has(name)) {
        const value = store.get(name);
        if (value) return value as PdfImageObject;
      }
    } catch {
      // sync get threw (unresolved) — fall through to the callback form
    }
  }

  // Callback form on the most likely store, guarded by a timeout
  const primary = stores[0];
  return new Promise<PdfImageObject | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, RESOLVE_TIMEOUT_MS);
    try {
      primary.get(name, (data: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve((data as PdfImageObject) ?? null);
        }
      });
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

/** Convert a resolved pdfjs image object into a PNG blob via canvas. */
async function imageObjectToPngBlob(img: PdfImageObject): Promise<Blob | null> {
  const width = img.width ?? 0;
  const height = img.height ?? 0;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (img.bitmap) {
    // Browser-decoded image (e.g. JPEG) — pdfjs hands us an ImageBitmap
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const src =
      img.data instanceof Uint8ClampedArray
        ? img.data
        : new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength);
    const pixels = width * height;
    // Fresh allocation so the backing buffer is a plain ArrayBuffer (ImageData requirement)
    let rgba: Uint8ClampedArray<ArrayBuffer>;

    if (img.kind === IMAGE_KIND_RGBA_32BPP || src.length === pixels * 4) {
      if (src.length < pixels * 4) return null;
      rgba = new Uint8ClampedArray(pixels * 4);
      rgba.set(src.subarray(0, pixels * 4));
    } else if (img.kind === IMAGE_KIND_RGB_24BPP || src.length === pixels * 3) {
      if (src.length < pixels * 3) return null;
      // Expand 3-channel RGB to RGBA
      rgba = new Uint8ClampedArray(pixels * 4);
      for (let i = 0, j = 0; i < pixels; i++, j += 3) {
        const k = i * 4;
        rgba[k] = src[j];
        rgba[k + 1] = src[j + 1];
        rgba[k + 2] = src[j + 2];
        rgba[k + 3] = 255;
      }
    } else if (img.kind === IMAGE_KIND_GRAYSCALE_1BPP || src.length === ((width + 7) >> 3) * height) {
      // 1 bit per pixel, rows padded to byte boundaries
      const rowBytes = (width + 7) >> 3;
      rgba = new Uint8ClampedArray(pixels * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
          const v = bit ? 255 : 0;
          const k = (y * width + x) * 4;
          rgba[k] = v;
          rgba[k + 1] = v;
          rgba[k + 2] = v;
          rgba[k + 3] = 255;
        }
      }
    } else if (src.length === pixels) {
      // 8-bit grayscale
      rgba = new Uint8ClampedArray(pixels * 4);
      for (let i = 0; i < pixels; i++) {
        const v = src[i];
        const k = i * 4;
        rgba[k] = v;
        rgba[k + 1] = v;
        rgba[k + 2] = v;
        rgba[k + 3] = 255;
      }
    } else {
      return null; // unknown layout — skip rather than emit garbage
    }

    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else {
    return null;
  }

  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export interface ExtractedImages {
  images: { name: string; bytes: Uint8Array }[];
  /** Only the first MAX_IMAGE_SCAN_PAGES pages were read. */
  pageLimitHit: boolean;
  /** Reading stopped at MAX_EXTRACTED_IMAGES pictures. */
  imageLimitHit: boolean;
}

/**
 * Every picture, in the order first seen, as `image_001_<w>x<h>.png` (the
 * caller prefixes the visitor's base name, as the page did), and whether a
 * limit cut the scan short (the visitor is told, as the page did). `images`
 * is empty when the PDF has none.
 */
export async function extractImages(bytes: Uint8Array): Promise<ExtractedImages> {
  const pdfjsLib = await getPdfJs();
  // A copy: pdf.js hands its data to the worker, which detaches the caller's buffer.
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  try {
    const totalPages = Math.min(pdf.numPages, MAX_IMAGE_SCAN_PAGES);
    const found = new Map<string, { blob: Blob; width: number; height: number }>();
    const skipped = new Set<string>();
    let hitImageCap = false;

    for (let pageNum = 1; pageNum <= totalPages && !hitImageCap; pageNum++) {
      const page = (await pdf.getPage(pageNum)) as unknown as PdfPageLike;

      const ops = await page.getOperatorList();
      const names: string[] = [];
      for (let i = 0; i < ops.fnArray.length; i++) {
        const fn = ops.fnArray[i];
        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintImageXObjectRepeat) {
          const name = ops.argsArray[i]?.[0];
          if (typeof name === 'string' && name) names.push(name);
        }
      }

      for (const name of names) {
        if (found.has(name) || skipped.has(name)) continue; // dedupe reused images
        if (found.size >= MAX_EXTRACTED_IMAGES) {
          hitImageCap = true;
          break;
        }

        const imgObj = await resolveImageObject(page.objs, page.commonObjs, name);
        if (!imgObj || !imgObj.width || !imgObj.height) {
          skipped.add(name);
          continue;
        }
        if (imgObj.width < MIN_DIMENSION || imgObj.height < MIN_DIMENSION) {
          skipped.add(name); // tiny images are usually masks/artifacts
          continue;
        }

        const blob = await imageObjectToPngBlob(imgObj);
        if (!blob) {
          skipped.add(name);
          continue;
        }
        found.set(name, { blob, width: imgObj.width, height: imgObj.height });
      }

      try {
        page.cleanup();
      } catch {
        // page.cleanup() can throw if resources are in use — safe to ignore
      }
    }

    const images = await Promise.all(
      Array.from(found.values()).map(async (img, idx) => ({
        name: `image_${String(idx + 1).padStart(3, '0')}_${img.width}x${img.height}.png`,
        bytes: new Uint8Array(await img.blob.arrayBuffer()),
      }))
    );
    return { images, pageLimitHit: pdf.numPages > MAX_IMAGE_SCAN_PAGES, imageLimitHit: hitImageCap };
  } finally {
    void pdf.destroy().catch(() => undefined);
  }
}
