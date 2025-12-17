import { PDFDocument, degrees } from 'pdf-lib';
import { createCanvas } from 'canvas';
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

// Try to use pdf.js, but if it fails, we'll use fallback compression
let pdfjsLib: any = null;
let pdfjsAvailable = true;

async function getPdfJs() {
  if (pdfjsLib !== null) {
    return pdfjsLib;
  }
  
  if (!pdfjsAvailable) {
    throw new Error('pdf.js is not available');
  }
  
  try {
    // Use older version (3.11.174) which has better Next.js compatibility
    // Use require for CommonJS module (server-side only)
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    // Use require for older version (CommonJS) - add type assertion
    pdfjsLib = require('pdfjs-dist/build/pdf.js') as any;
    
    // Set worker path (server-side only)
    if (typeof window === 'undefined') {
      try {
        const workerPath = require.resolve('pdfjs-dist/build/pdf.worker.js');
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
      } catch (workerError) {
        // If worker resolution fails, disable it
        console.warn('Could not resolve worker, using synchronous mode');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      }
    }
    
    return pdfjsLib;
  } catch (importError) {
    console.warn('pdf.js not available, will use fallback compression:', importError);
    pdfjsAvailable = false;
    pdfjsLib = null;
    throw importError;
  }
}

/**
 * Compress a PDF based on compression level using pdf.js and canvas for image optimization
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
    console.log(`[compressPDF] Starting compression with level: ${level}`);
    
    // Compression settings based on level
    const compressionSettings = {
      low: {
        scale: 1.5, // Higher resolution for quality
        imageQuality: 0.85,
        useObjectStreams: true,
        removeMetadata: false,
      },
      medium: {
        scale: 1.2,
        imageQuality: 0.65,
        useObjectStreams: true,
        removeMetadata: false,
      },
      high: {
        scale: 1.0,
        imageQuality: 0.45,
        useObjectStreams: true,
        removeMetadata: false,
      },
    };

    const settings = compressionSettings[level];
    
    // Validate compression level
    if (!settings) {
      throw new Error(`Invalid compression level: ${level}. Valid levels are: low, medium, high`);
    }
    
    // Try to get pdf.js library
    let pdfjs: any;
    let pdf: any;
    let numPages: number;
    
    try {
      pdfjs = await getPdfJs();
      
      // Load PDF with pdf.js - catch worker errors
      const loadingTask = pdfjs.getDocument({ 
        data: pdfBuffer,
        verbosity: 0,
        // Disable worker completely
        useWorkerFetch: false,
        isEvalSupported: false,
      });
      
      pdf = await loadingTask.promise;
      numPages = pdf.numPages;
    } catch (pdfjsError) {
      // If pdf.js fails (worker issue), throw to trigger fallback
      throw new Error(`pdf.js failed: ${pdfjsError instanceof Error ? pdfjsError.message : 'Unknown error'}`);
    }

    // Create new PDF with pdf-lib
    const compressedPdf = await PDFDocument.create();
    
    // Process each page: render to canvas, compress, and re-embed
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: settings.scale });
      
      // Create canvas to render the page
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');
      
      // Render PDF page to canvas (synchronous mode, no worker needed)
      const renderContext = {
        canvasContext: context as any,
        viewport: viewport,
      };
      
      await page.render(renderContext).promise;
      
      // Convert canvas to JPEG buffer with compression
      const imageBuffer = canvas.toBuffer('image/jpeg', {
        quality: Math.round(settings.imageQuality * 100), // Convert 0-1 to 0-100
      });
      
      // Embed compressed image as a page in the new PDF
      const image = await compressedPdf.embedJpg(imageBuffer);
      const newPage = compressedPdf.addPage([viewport.width, viewport.height]);
      
      // Scale image to fit page
      const imageDims = image.scale(1);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: imageDims.width,
        height: imageDims.height,
      });
    }
    
    // Handle metadata
    if (!settings.removeMetadata) {
      try {
        const sourcePdf = await PDFDocument.load(pdfBuffer);
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
        if (keywords) compressedPdf.setKeywords(Array.isArray(keywords) ? keywords : [keywords]);
        if (creator) compressedPdf.setCreator(creator);
        if (producer) compressedPdf.setProducer(producer);
        if (creationDate) compressedPdf.setCreationDate(creationDate);
        if (modificationDate) compressedPdf.setModificationDate(modificationDate);
      } catch (metaError) {
        console.warn('Failed to copy some metadata:', metaError);
      }
    }
    
    // Save with compression settings
    const compressed = await compressedPdf.save({
      useObjectStreams: settings.useObjectStreams,
      addDefaultPage: false,
    });
    
    const originalSize = pdfBuffer.byteLength;
    const compressedSize = compressed.length;
    const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);
    
    console.log(`Compression complete: ${level} - Original: ${originalSize} bytes, Compressed: ${compressedSize} bytes, Reduction: ${reduction}%`);
    
    return compressed;
  } catch (error) {
    // pdf.js compression failed (likely worker issue), use enhanced pdf-lib compression
    console.warn('Advanced compression unavailable, using enhanced pdf-lib compression');
    
    // Enhanced pdf-lib compression with level-based optimization
    try {
      const sourcePdf = await PDFDocument.load(pdfBuffer);
      const compressedPdf = await PDFDocument.create();
      const pageCount = sourcePdf.getPageCount();
      const pageIndices = Array.from({ length: pageCount }, (_, i) => i);
      
      const pages = await compressedPdf.copyPages(sourcePdf, pageIndices);
      pages.forEach((page) => {
        compressedPdf.addPage(page);
      });
      
      const compressionSettings = {
        low: { useObjectStreams: true, removeMetadata: false },
        medium: { useObjectStreams: true, removeMetadata: false },
        high: { useObjectStreams: true, removeMetadata: true },
      };
      
      const settings = compressionSettings[level] || compressionSettings.medium;
      
      if (!settings.removeMetadata) {
        try {
          const title = sourcePdf.getTitle();
          if (title) compressedPdf.setTitle(title);
        } catch {
          // Ignore metadata errors
        }
      }
      
      return await compressedPdf.save({
        useObjectStreams: settings.useObjectStreams,
        addDefaultPage: false,
      });
    } catch (fallbackError) {
      if (fallbackError instanceof Error) {
        throw new Error(`Failed to compress PDF: ${fallbackError.message}`);
      }
      throw new Error('Failed to compress PDF: Unknown error');
    }
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

