// Tool types
export type ToolType = 'merge' | 'compress' | 'convert' | 'split';

// Compression levels
export type CompressionLevel = 'low' | 'medium' | 'high';

// Uploaded file interface
export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  preview?: string;
}

// Processing state interface
export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  currentTool: ToolType | null;
  error: string | null;
  result: Blob | null;
  resultFilename: string | null;
}

// PDF metadata interface
export interface PDFMetadata {
  pageCount: number;
  fileSize: number;
  fileName: string;
}

// Merge options interface
export interface MergeOptions {
  preserveMetadata?: boolean;
  order?: number[]; // Order of files to merge
}

// Compress options interface
export interface CompressOptions {
  compressionLevel: CompressionLevel;
  quality?: number; // Optional quality setting (0-100)
}

// Convert options interface
export interface ConvertOptions {
  outputFormat: 'pdf' | 'png' | 'jpg' | 'jpeg';
  quality?: number; // For image formats (0-100)
  dpi?: number; // Dots per inch for conversion
}

// Split options interface
export interface SplitOptions {
  pageRanges?: string[]; // e.g., ['1-5', '6-10']
  splitBy?: 'pages' | 'range' | 'all'; // How to split
  pagesPerFile?: number; // If splitting by pages
}

