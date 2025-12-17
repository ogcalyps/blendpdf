import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes using clsx and tailwind-merge
 * @param inputs - Array of class values to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Convert bytes to human-readable file size format
 * @param bytes - File size in bytes
 * @returns Formatted string (Bytes, KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
 * Trigger browser download of a blob
 * @param blob - Blob to download
 * @param filename - Name for the downloaded file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

