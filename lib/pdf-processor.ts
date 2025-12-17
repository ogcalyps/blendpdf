import { PDFDocument, degrees } from 'pdf-lib';
import type { CompressionLevel } from '@/types';

/**
 * Merge multiple PDFs into a single PDF
 * @param pdfBuffers - Array of PDF file buffers to merge
 * @returns Merged PDF as Uint8Array
 * @throws Error if PDF loading or merging fails
 */
export async function mergePDFs(pdfBuffers: ArrayBuffer[]): Promise<Uint8Array> {
  try {
    if (pdfBuffers.length === 0) {
      throw new Error('No PDFs provided to merge');
    }

    const mergedPdf = await PDFDocument.create();

    for (const buffer of pdfBuffers) {
      const pdf = await PDFDocument.load(buffer);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      
      pages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    }

    return await mergedPdf.save();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to merge PDFs: ${error.message}`);
    }
    throw new Error('Failed to merge PDFs: Unknown error');
  }
}

/**
 * Compress a PDF based on compression level
 * @param pdfBuffer - PDF file buffer to compress
 * @param level - Compression level (low, medium, high)
 * @returns Compressed PDF as Uint8Array
 * @throws Error if PDF loading or compression fails
 */
export async function compressPDF(
  pdfBuffer: ArrayBuffer,
  level: CompressionLevel
): Promise<Uint8Array> {
  try {
    const sourcePdf = await PDFDocument.load(pdfBuffer);

    switch (level) {
      case 'low': {
        // Low compression: Save without object streams (faster, larger file)
        // This is useful when you want minimal processing time
        return await sourcePdf.save({
          useObjectStreams: false,
          addDefaultPage: false,
        });
      }

      case 'medium': {
        // Medium compression: Use object streams (balanced compression)
        // This provides good compression while maintaining quality
        return await sourcePdf.save({
          useObjectStreams: true,
          addDefaultPage: false,
        });
      }

      case 'high': {
        // High compression: Recreate PDF structure to remove unused objects
        // Copy only pages and essential resources, then save with object streams
        const compressedPdf = await PDFDocument.create();
        const pageCount = sourcePdf.getPageCount();
        const pageIndices = Array.from({ length: pageCount }, (_, i) => i);

        // Copy all pages (this automatically removes unused objects)
        const pages = await compressedPdf.copyPages(sourcePdf, pageIndices);
        pages.forEach((page) => {
          compressedPdf.addPage(page);
        });

        // Copy document metadata (optional, but preserves info)
        try {
          const title = sourcePdf.getTitle();
          const author = sourcePdf.getAuthor();
          const subject = sourcePdf.getSubject();
          const keywords = sourcePdf.getKeywords();
          const creator = sourcePdf.getCreator();
          const producer = sourcePdf.getProducer();
          const creationDate = sourcePdf.getCreationDate();
          const modificationDate = sourcePdf.getModificationDate();

          if (title) compressedPdf.setTitle(title);
          if (author) compressedPdf.setAuthor(author);
          if (subject) compressedPdf.setSubject(subject);
          if (keywords) compressedPdf.setKeywords(keywords);
          if (creator) compressedPdf.setCreator(creator);
          if (producer) compressedPdf.setProducer(producer);
          if (creationDate) compressedPdf.setCreationDate(creationDate);
          if (modificationDate) compressedPdf.setModificationDate(modificationDate);
        } catch {
          // Ignore metadata errors, compression is more important
        }

        // Save with object streams for maximum compression
        return await compressedPdf.save({
          useObjectStreams: true,
          addDefaultPage: false,
        });
      }

      default:
        // Fallback to medium compression
        return await sourcePdf.save({
          useObjectStreams: true,
          addDefaultPage: false,
        });
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to compress PDF: ${error.message}`);
    }
    throw new Error('Failed to compress PDF: Unknown error');
  }
}

/**
 * Split a PDF by extracting specific pages
 * @param pdfBuffer - PDF file buffer to split
 * @param pageIndices - Array of 0-indexed page numbers to extract
 * @returns New PDF containing only specified pages as Uint8Array
 * @throws Error if PDF loading or splitting fails
 */
export async function splitPDF(
  pdfBuffer: ArrayBuffer,
  pageIndices: number[]
): Promise<Uint8Array> {
  try {
    if (pageIndices.length === 0) {
      throw new Error('No page indices provided');
    }

    const sourcePdf = await PDFDocument.load(pdfBuffer);
    const totalPages = sourcePdf.getPageCount();

    // Validate page indices
    for (const index of pageIndices) {
      if (index < 0 || index >= totalPages) {
        throw new Error(`Page index ${index} is out of range (0-${totalPages - 1})`);
      }
    }

    const newPdf = await PDFDocument.create();
    const pages = await newPdf.copyPages(sourcePdf, pageIndices);

    pages.forEach((page) => {
      newPdf.addPage(page);
    });

    return await newPdf.save();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to split PDF: ${error.message}`);
    }
    throw new Error('Failed to split PDF: Unknown error');
  }
}

/**
 * Get metadata from a PDF file
 * @param pdfBuffer - PDF file buffer
 * @returns PDF metadata object
 * @throws Error if PDF loading or metadata extraction fails
 */
export async function getPDFMetadata(pdfBuffer: ArrayBuffer): Promise<{
  pageCount: number;
  title: string | undefined;
  author: string | undefined;
  subject: string | undefined;
  keywords: string | undefined;
  creator: string | undefined;
  producer: string | undefined;
}> {
  try {
    const pdf = await PDFDocument.load(pdfBuffer);
    const pageCount = pdf.getPageCount();
    const title = pdf.getTitle();
    const author = pdf.getAuthor();
    const subject = pdf.getSubject();
    const keywords = pdf.getKeywords();
    const creator = pdf.getCreator();
    const producer = pdf.getProducer();

    return {
      pageCount,
      title,
      author,
      subject,
      keywords,
      creator,
      producer,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get PDF metadata: ${error.message}`);
    }
    throw new Error('Failed to get PDF metadata: Unknown error');
  }
}

/**
 * Rotate pages in a PDF
 * @param pdfBuffer - PDF file buffer
 * @param rotation - Rotation angle in degrees (90, 180, or 270)
 * @param pageIndices - Optional array of 0-indexed page numbers to rotate. If not provided, rotates all pages
 * @returns Rotated PDF as Uint8Array
 * @throws Error if PDF loading or rotation fails
 */
export async function rotatePDF(
  pdfBuffer: ArrayBuffer,
  rotation: 90 | 180 | 270,
  pageIndices?: number[]
): Promise<Uint8Array> {
  try {
    const pdf = await PDFDocument.load(pdfBuffer);
    const totalPages = pdf.getPageCount();

    // Convert rotation to radians (pdf-lib uses degrees, but we'll use setRotation which accepts degrees)
    const pagesToRotate = pageIndices ?? Array.from({ length: totalPages }, (_, i) => i);

    // Validate page indices
    for (const index of pagesToRotate) {
      if (index < 0 || index >= totalPages) {
        throw new Error(`Page index ${index} is out of range (0-${totalPages - 1})`);
      }
    }

    // Rotate each specified page
    for (const index of pagesToRotate) {
      const page = pdf.getPage(index);
      const currentRotation = page.getRotation().angle;
      // Add rotation to current rotation (modulo 360)
      const newRotation = (currentRotation + rotation) % 360;
      // Use degrees helper to create proper Rotation object
      page.setRotation(degrees(newRotation));
    }

    return await pdf.save();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to rotate PDF: ${error.message}`);
    }
    throw new Error('Failed to rotate PDF: Unknown error');
  }
}

