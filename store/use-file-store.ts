import { create } from 'zustand';
import type { UploadedFile, ProcessingState, ToolType } from '@/types';
import { generateId } from '@/lib/utils';

interface FileStore {
  // State
  files: UploadedFile[];
  processing: ProcessingState;

  // Actions
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  reorderFiles: (startIndex: number, endIndex: number) => void;
  setProcessing: (isProcessing: boolean, tool: ToolType | null) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setResult: (result: Blob | null, filename?: string | null) => void;
  resetProcessing: () => void;
}

const initialProcessingState: ProcessingState = {
  isProcessing: false,
  progress: 0,
  currentTool: null,
  error: null,
  result: null,
  resultFilename: null,
};

export const useFileStore = create<FileStore>((set) => ({
  // Initial state
  files: [],
  processing: initialProcessingState,

  // Add files with generated IDs
  addFiles: (newFiles: File[]) => {
    set((state) => {
      const uploadedFiles: UploadedFile[] = newFiles.map((file) => ({
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
      }));

      return {
        files: [...state.files, ...uploadedFiles],
      };
    });
  },

  // Remove file by ID
  removeFile: (id: string) => {
    set((state) => ({
      files: state.files.filter((file) => file.id !== id),
    }));
  },

  // Clear all files
  clearFiles: () => {
    set({ files: [] });
  },

  // Reorder files for drag-drop
  reorderFiles: (startIndex: number, endIndex: number) => {
    set((state) => {
      const newFiles = [...state.files];
      const [removed] = newFiles.splice(startIndex, 1);
      newFiles.splice(endIndex, 0, removed);

      return { files: newFiles };
    });
  },

  // Set processing state
  setProcessing: (isProcessing: boolean, tool: ToolType | null) => {
    set((state) => ({
      processing: {
        ...state.processing,
        isProcessing,
        currentTool: tool,
        // Reset error and result when starting new processing
        ...(isProcessing && { error: null, result: null, resultFilename: null, progress: 0 }),
      },
    }));
  },

  // Update progress
  setProgress: (progress: number) => {
    set((state) => ({
      processing: {
        ...state.processing,
        progress: Math.max(0, Math.min(100, progress)), // Clamp between 0 and 100
      },
    }));
  },

  // Set error message
  setError: (error: string | null) => {
    set((state) => ({
      processing: {
        ...state.processing,
        error,
        isProcessing: false, // Stop processing on error
      },
    }));
  },

  // Set processing result
  setResult: (result: Blob | null, filename: string | null = null) => {
    set((state) => ({
      processing: {
        ...state.processing,
        result,
        resultFilename: filename,
        isProcessing: false, // Stop processing when result is set
        progress: 100,
      },
    }));
  },

  // Reset processing state to initial
  resetProcessing: () => {
    set({
      processing: initialProcessingState,
    });
  },
}));

