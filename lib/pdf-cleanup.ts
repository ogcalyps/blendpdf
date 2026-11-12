/**
 * Remove a PDF's hidden document info in the browser (moved from
 * app/[locale]/remove-metadata/page.tsx, same result): blank the Info fields,
 * drop its dates and the catalog's XMP stream. pdf-lib loads with import().
 */

/** The cleaned bytes. Rejects when the PDF is encrypted (pdf-lib can't write it). */
export async function removeMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFDict } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  if (pdfDoc.isEncrypted) {
    throw new Error('This PDF is encrypted');
  }

  // Blank out the document information dictionary fields
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setCreator('');
  pdfDoc.setProducer('');

  // Remove creation/modification timestamps from the Info dictionary
  try {
    const infoRef = pdfDoc.context.trailerInfo.Info;
    if (infoRef) {
      const info = pdfDoc.context.lookup(infoRef);
      if (info instanceof PDFDict) {
        info.delete(PDFName.of('CreationDate'));
        info.delete(PDFName.of('ModDate'));
      }
    }
  } catch (error) {
    console.warn('Could not remove Info dictionary dates:', error);
  }

  // Strip the XMP metadata stream from the document catalog
  try {
    pdfDoc.catalog.delete(PDFName.of('Metadata'));
  } catch (error) {
    console.warn('Could not remove XMP metadata stream:', error);
  }

  return pdfDoc.save();
}
