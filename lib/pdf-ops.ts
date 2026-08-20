import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';

/**
 * Pure pdf-lib operations shared by API routes and the client-side Web Worker.
 *
 * IMPORTANT: this module must stay isomorphic — no Node built-ins, no pdfjs,
 * no imports from lib/pdf-processor.ts (which contains a server-only require).
 * It runs in three environments: Node (API routes), the browser main thread,
 * and the pdf Web Worker.
 */

/** Thrown when the input PDF is password-protected. */
export class EncryptedPdfError extends Error {
  code = 'ENCRYPTED_PDF' as const;
  constructor() {
    super('This PDF is password-protected. Please use the Unlock PDF tool to remove the password first, then try again.');
    this.name = 'EncryptedPdfError';
  }
}

/** Thrown when text can't be drawn with the WinAnsi-encoded standard fonts. */
export class UnsupportedTextError extends Error {
  code = 'UNSUPPORTED_TEXT' as const;
  constructor(message = 'This text contains characters (e.g. Arabic or emoji) that the built-in PDF fonts cannot draw yet.') {
    super(message);
    this.name = 'UnsupportedTextError';
  }
}

/**
 * Unicode code points in the 0x80-0x9F CP-1252 block that WinAnsi can encode.
 * Everything else outside 0x20-0x7E and 0xA0-0xFF is not encodable by the
 * pdf-lib StandardFonts (Helvetica, etc.), which use WinAnsi encoding.
 */
const WINANSI_EXTRA_CODEPOINTS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

/**
 * Check whether text can be encoded with WinAnsi (the encoding used by
 * pdf-lib StandardFonts). Arabic, CJK, emoji, etc. are not encodable and
 * would crash page.drawText / font.widthOfTextAtSize.
 */
export function isWinAnsiEncodable(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp >= 0x20 && cp <= 0x7e) continue;
    if (cp >= 0xa0 && cp <= 0xff) continue;
    if (WINANSI_EXTRA_CODEPOINTS.has(cp)) continue;
    return false;
  }
  return true;
}

async function loadRejectingEncrypted(pdfBuffer: ArrayBuffer): Promise<PDFDocument> {
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  if (doc.isEncrypted) {
    throw new EncryptedPdfError();
  }
  return doc;
}

/**
 * Merge multiple PDFs into a single PDF.
 * @param pdfBuffers - Array of PDF file buffers to merge
 */
export async function mergePDFs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  if (pdfBuffers.length === 0) {
    throw new Error('No PDFs provided to merge');
  }

  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < pdfBuffers.length; i++) {
    try {
      const pdf = await PDFDocument.load(pdfBuffers[i], { ignoreEncryption: true });
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach((page) => mergedPdf.addPage(page));
    } catch (fileError) {
      const message = fileError instanceof Error ? fileError.message : 'Unknown error';
      throw new Error(`Failed to process file ${i + 1}: ${message}`);
    }
  }

  return mergedPdf.save();
}

/**
 * Extract specific pages into a new PDF.
 * @param pageIndices - Array of 0-indexed page numbers to extract
 */
export async function splitPDF(pdfBuffer: ArrayBuffer, pageIndices: number[]): Promise<Uint8Array> {
  if (pageIndices.length === 0) {
    throw new Error('No page indices provided');
  }

  const sourcePdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = sourcePdf.getPageCount();

  for (const index of pageIndices) {
    if (index < 0 || index >= totalPages) {
      throw new Error(`Page index ${index} is out of range (0-${totalPages - 1})`);
    }
  }

  const newPdf = await PDFDocument.create();
  const pages = await newPdf.copyPages(sourcePdf, pageIndices);
  pages.forEach((page) => newPdf.addPage(page));

  return newPdf.save();
}

/**
 * Rotate all pages by the same angle, composing with existing /Rotate.
 * @param pageIndices - Optional 0-indexed pages to rotate; all pages if omitted
 */
export async function rotatePDF(
  pdfBuffer: ArrayBuffer,
  rotation: 90 | 180 | 270,
  pageIndices?: number[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdf.getPageCount();
  const pagesToRotate = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);

  for (const index of pagesToRotate) {
    if (index < 0 || index >= totalPages) {
      throw new Error(`Page index ${index} is out of range (0-${totalPages - 1})`);
    }
  }

  for (const index of pagesToRotate) {
    const page = pdf.getPage(index);
    const newRotation = (page.getRotation().angle + rotation) % 360;
    page.setRotation(degrees(newRotation));
  }

  return pdf.save();
}

/**
 * Apply a per-page rotation map (as produced by the rotate tool UI).
 * Composes each delta with the page's existing /Rotate value so the output
 * matches the pdf.js preview. Rejects encrypted PDFs.
 * @param rotations - 1-indexed page number → rotation delta in degrees
 */
export async function rotatePages(
  pdfBuffer: ArrayBuffer,
  rotations: Record<number, number>
): Promise<Uint8Array> {
  const pdfDoc = await loadRejectingEncrypted(pdfBuffer);

  pdfDoc.getPages().forEach((page, index) => {
    const rotation = rotations[index + 1] || 0;
    if (rotation !== 0) {
      const currentRotation = page.getRotation().angle;
      const newRotation = (((currentRotation + rotation) % 360) + 360) % 360;
      page.setRotation(degrees(newRotation));
    }
  });

  return pdfDoc.save();
}

/**
 * Rebuild the PDF with pages in a new order. Rejects encrypted PDFs.
 * @param pageOrder - 1-indexed page numbers in the desired output order
 */
export async function reorderPages(pdfBuffer: ArrayBuffer, pageOrder: number[]): Promise<Uint8Array> {
  if (!Array.isArray(pageOrder) || pageOrder.length === 0) {
    throw new Error('Invalid page order format');
  }

  const srcDoc = await loadRejectingEncrypted(pdfBuffer);
  const totalPages = srcDoc.getPageCount();

  for (const pageNum of pageOrder) {
    if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > totalPages) {
      throw new Error(`Invalid page number ${pageNum}. The PDF has ${totalPages} page${totalPages !== 1 ? 's' : ''}.`);
    }
  }

  const newDoc = await PDFDocument.create();
  for (const pageNum of pageOrder) {
    const [copiedPage] = await newDoc.copyPages(srcDoc, [pageNum - 1]);
    newDoc.addPage(copiedPage);
  }

  return newDoc.save();
}

/**
 * Delete specified pages from a PDF.
 * @param pagesToDelete - 1-indexed page numbers to delete
 */
export async function deletePages(
  pdfBuffer: ArrayBuffer,
  pagesToDelete: Set<number> | number[]
): Promise<Uint8Array> {
  const toDelete = pagesToDelete instanceof Set ? pagesToDelete : new Set(pagesToDelete);
  const srcDoc = await loadRejectingEncrypted(pdfBuffer);
  const totalPages = srcDoc.getPageCount();

  if (toDelete.size === 0) {
    throw new Error('No pages selected for deletion');
  }
  if (toDelete.size >= totalPages) {
    throw new Error('Cannot delete all pages or more pages than exist');
  }

  const newDoc = await PDFDocument.create();
  for (let i = 1; i <= totalPages; i++) {
    if (!toDelete.has(i)) {
      const [copiedPage] = await newDoc.copyPages(srcDoc, [i - 1]);
      newDoc.addPage(copiedPage);
    }
  }

  return newDoc.save();
}

export type PageNumberPosition =
  | 'bottom-center' | 'bottom-left' | 'bottom-right'
  | 'top-center' | 'top-left' | 'top-right';
export type PageNumberFormat = '1' | '1 / 10' | 'Page 1' | 'Page 1 of 10';

export interface AddPageNumbersOptions {
  position?: PageNumberPosition;
  format?: PageNumberFormat;
  startFrom?: number;
  fontSize?: number;
}

function formatPageNumber(format: PageNumberFormat, pageNum: number, totalPages: number): string {
  switch (format) {
    case '1':
      return String(pageNum);
    case '1 / 10':
      return `${pageNum} / ${totalPages}`;
    case 'Page 1':
      return `Page ${pageNum}`;
    case 'Page 1 of 10':
      return `Page ${pageNum} of ${totalPages}`;
    default:
      return String(pageNum);
  }
}

/** Stamp page numbers on every page. Rejects encrypted PDFs. */
export async function addPageNumbers(
  pdfBuffer: ArrayBuffer,
  options: AddPageNumbersOptions = {}
): Promise<Uint8Array> {
  const position = options.position || 'bottom-center';
  const format = options.format || '1';
  const startFrom = options.startFrom ?? 1;
  const fontSize = options.fontSize ?? 12;

  const pdfDoc = await loadRejectingEncrypted(pdfBuffer);
  const pages = pdfDoc.getPages();
  const totalPages = pages.length;
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 20;

  pages.forEach((page, index) => {
    const pageNumber = startFrom + index;
    const text = formatPageNumber(format, pageNumber, totalPages);
    const { width, height } = page.getSize();

    const y = position.includes('bottom') ? margin : height - margin - fontSize;
    let x = margin;
    if (position.includes('center')) {
      x = (width - font.widthOfTextAtSize(text, fontSize)) / 2;
    } else if (position.includes('right')) {
      x = width - font.widthOfTextAtSize(text, fontSize) - margin;
    }

    page.drawText(text, { x, y, size: fontSize, font, color: rgb(0, 0, 0) });
  });

  return pdfDoc.save();
}

export interface WatermarkOptions {
  type: 'text' | 'image';
  text?: string;
  /** Image watermark payload — transferable, unlike File in some contexts. */
  image?: { bytes: ArrayBuffer; mimeType: string };
  /** Back-compat with existing server callers. */
  imageFile?: File;
  position: 'center' | 'diagonal' | 'tiled';
  opacity: number;
  fontSize: number;
}

/** Add a text or image watermark to every page. */
export async function watermarkPDF(pdfBuffer: ArrayBuffer, options: WatermarkOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (options.type === 'text') {
    const text = options.text || 'DRAFT';
    if (!isWinAnsiEncodable(text)) {
      throw new UnsupportedTextError();
    }
    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, options.fontSize);
      const textHeight = options.fontSize;

      let x = 0;
      let y = 0;
      let rotation = 0;

      if (options.position === 'center') {
        x = (width - textWidth) / 2;
        y = (height - textHeight) / 2;
      } else if (options.position === 'diagonal') {
        x = width / 2 - textWidth / 2;
        y = height / 2 - textHeight / 2;
        rotation = 45;
      } else if (options.position === 'tiled') {
        const cols = Math.ceil(width / (textWidth + 100));
        const rows = Math.ceil(height / (textHeight + 100));
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            page.drawText(text, {
              x: col * (textWidth + 100),
              y: height - (row + 1) * (textHeight + 100),
              size: options.fontSize,
              font,
              color: rgb(0.7, 0.7, 0.7),
              opacity: options.opacity,
              rotate: degrees(-45),
            });
          }
        }
        continue;
      }

      page.drawText(text, {
        x,
        y,
        size: options.fontSize,
        font,
        color: rgb(0.7, 0.7, 0.7),
        opacity: options.opacity,
        rotate: rotation ? degrees(rotation) : undefined,
      });
    }
  } else if (options.type === 'image') {
    let imageBytes: ArrayBuffer;
    let mimeType: string;
    if (options.image) {
      imageBytes = options.image.bytes;
      mimeType = options.image.mimeType;
    } else if (options.imageFile) {
      imageBytes = await options.imageFile.arrayBuffer();
      mimeType = options.imageFile.type;
    } else {
      throw new Error('Image file required for image watermark');
    }

    let image;
    if (mimeType === 'image/png') {
      image = await pdfDoc.embedPng(imageBytes);
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      image = await pdfDoc.embedJpg(imageBytes);
    } else {
      throw new Error('Image must be PNG or JPEG');
    }

    const { width: imgWidth, height: imgHeight } = image.scale(0.5);

    for (const page of pages) {
      const { width, height } = page.getSize();
      let x = 0;
      let y = 0;

      if (options.position === 'center' || options.position === 'diagonal') {
        x = (width - imgWidth) / 2;
        y = (height - imgHeight) / 2;
      } else if (options.position === 'tiled') {
        const cols = Math.ceil(width / (imgWidth + 50));
        const rows = Math.ceil(height / (imgHeight + 50));
        for (let row = 0; row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            page.drawImage(image, {
              x: col * (imgWidth + 50),
              y: height - (row + 1) * (imgHeight + 50),
              width: imgWidth,
              height: imgHeight,
              opacity: options.opacity,
            });
          }
        }
        continue;
      }

      page.drawImage(image, {
        x,
        y,
        width: imgWidth,
        height: imgHeight,
        opacity: options.opacity,
      });
    }
  } else {
    throw new Error('Image file required for image watermark');
  }

  return pdfDoc.save();
}
