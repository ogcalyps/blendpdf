import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { trackDownload } from '@/lib/analytics';

/**
 * Merge Tailwind CSS classes using clsx and tailwind-merge
 * @param inputs - Array of class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const FILE_SIZE_UNITS: Record<string, string[]> = {
  en: ['Bytes', 'KB', 'MB', 'GB'],
  ar: ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'],
  fr: ['octets', 'Ko', 'Mo', 'Go'],
  es: ['bytes', 'KB', 'MB', 'GB'],
};

/** Locales that write a decimal comma and a no-break space before the unit (1,5 Mo, 1,5 MB). */
const DECIMAL_COMMA: Record<string, string> = { fr: 'fr-FR', es: 'es-ES' };

/** A size limit in MB as the visitor reads it: 1.5, or 1,5 in French and Spanish. */
export function formatLimitMb(mb: number, locale: string): string {
  return mb.toLocaleString(DECIMAL_COMMA[locale] ?? 'en-US', { maximumFractionDigits: 1 });
}

/**
 * Convert bytes to human-readable file size format
 * @param bytes - File size in bytes
 * @param locale - Active locale for unit labels (defaults to 'en')
 * @returns Formatted string (Bytes, KB, MB, GB)
 */
export function formatFileSize(bytes: number, locale: string = 'en'): string {
  const sizes = FILE_SIZE_UNITS[locale] ?? FILE_SIZE_UNITS.en;

  if (bytes === 0) return `0${DECIMAL_COMMA[locale] ? '\u00a0' : ' '}${sizes[0]}`;

  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  // French writes 1,5 Mo and Spanish 1,5 MB, with a no-break space before the unit
  if (DECIMAL_COMMA[locale]) return `${value.toLocaleString(DECIMAL_COMMA[locale])}\u00a0${sizes[i]}`;
  return `${value} ${sizes[i]}`;
}

/**
 * Generate a random alphanumeric ID
 * @param length - Length of the ID (default: 8)
 * @returns Random alphanumeric string
 */
export function generateId(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Parse page ranges string into 0-indexed array of page numbers
 * @param rangesString - String like "1-5, 8, 12-15"
 * @param maxPages - Maximum number of pages (1-indexed)
 * @returns Array of 0-indexed page numbers
 * @throws Error if range is invalid or out of bounds
 */
export function parsePageRanges(rangesString: string, maxPages: number): number[] {
  const pages: number[] = [];
  const ranges = rangesString.split(',').map(r => r.trim());

  for (const range of ranges) {
    if (range.includes('-')) {
      const [start, end] = range.split('-').map(n => parseInt(n.trim(), 10));

      if (isNaN(start) || isNaN(end)) {
        throw new Error(`Invalid range format: ${range}`);
      }

      if (start < 1 || end < 1) {
        throw new Error(`Page numbers must be greater than 0: ${range}`);
      }

      if (start > end) {
        throw new Error(`Start page must be less than or equal to end page: ${range}`);
      }

      if (end > maxPages) {
        throw new Error(`Page ${end} exceeds maximum pages (${maxPages})`);
      }

      // Convert to 0-indexed and add all pages in range
      for (let i = start; i <= end; i++) {
        const pageIndex = i - 1;
        if (!pages.includes(pageIndex)) {
          pages.push(pageIndex);
        }
      }
    } else {
      const page = parseInt(range, 10);

      if (isNaN(page)) {
        throw new Error(`Invalid page number: ${range}`);
      }

      if (page < 1) {
        throw new Error(`Page numbers must be greater than 0: ${page}`);
      }

      if (page > maxPages) {
        throw new Error(`Page ${page} exceeds maximum pages (${maxPages})`);
      }

      // Convert to 0-indexed
      const pageIndex = page - 1;
      if (!pages.includes(pageIndex)) {
        pages.push(pageIndex);
      }
    }
  }

  return pages.sort((a, b) => a - b);
}

/**
 * Validate PDF file type and size
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes (optional)
 * @returns Error message string or null if valid
 */
export function validateFile(file: File, maxSize?: number): string | null {
  // Check file type
  if (file.type !== 'application/pdf') {
    return 'File must be a PDF';
  }

  // Check file size if maxSize is provided
  if (maxSize !== undefined && file.size > maxSize) {
    return `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`;
  }

  // Check if file is empty
  if (file.size === 0) {
    return 'File is empty';
  }

  return null;
}

/**
 * Validate Word document file type and size
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes (optional)
 * @returns Error message string or null if valid
 */
export function validateWordFile(file: File, maxSize?: number): string | null {
  // Allowed Word document MIME types
  const allowedTypes = [
    'application/msword', // .doc
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/vnd.oasis.opendocument.text', // .odt
    'application/rtf', // .rtf
    'text/rtf', // .rtf alternative
  ];

  // Allowed file extensions
  const allowedExtensions = ['.doc', '.docx', '.odt', '.rtf'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

  // Check file type
  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    return 'File must be a Word document (.doc, .docx, .odt, or .rtf)';
  }

  // Check file size if maxSize is provided
  if (maxSize !== undefined && file.size > maxSize) {
    return `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`;
  }

  // Check if file is empty
  if (file.size === 0) {
    return 'File is empty';
  }

  return null;
}

/**
 * Infer MIME type from filename extension
 * @param filename - Filename to infer MIME type from
 * @returns MIME type string
 */
function getMimeTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    csv: 'text/csv',
    zip: 'application/zip',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
  };
  return ext ? (mimeTypes[ext] ?? 'application/octet-stream') : 'application/octet-stream';
}

/**
 * Trigger browser download of a blob
 * @param blob - Blob to download
 * @param filename - Name for the downloaded file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  trackDownload(filename);
  // If the blob has no type, derive one from the filename extension
  // This prevents browsers from overriding the extension based on a wrong MIME type
  const typedBlob = blob.type ? blob : new Blob([blob], { type: getMimeTypeFromFilename(filename) });
  const url = URL.createObjectURL(typedBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate Spreadsheet file type and size
 * @param file - File to validate
 * @param maxSize - Maximum file size in bytes (optional)
 * @returns Error message string or null if valid
 */
export function validateSpreadsheetFile(file: File, maxSize?: number): string | null {
  // Allowed Spreadsheet MIME types
  const allowedTypes = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
  ];

  // Allowed file extensions
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

  // Check file type
  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    return 'File must be a CSV or Excel spreadsheet (.csv, .xlsx, or .xls)';
  }

  // Check file size if maxSize is provided
  if (maxSize !== undefined && file.size > maxSize) {
    return `File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`;
  }

  // Check if file is empty
  if (file.size === 0) {
    return 'File is empty';
  }

  return null;
}


