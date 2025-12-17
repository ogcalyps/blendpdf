'use client';

import { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslations } from 'next-intl';
import { UploadCloud, Loader2 } from 'lucide-react';
import { useFileStore } from '@/store/use-file-store';
import { validateFile } from '@/lib/utils';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

export function UploadZone() {
  const t = useTranslations('hero');
  const addFiles = useFileStore((state) => state.addFiles);
  const processing = useFileStore((state) => state.processing);
  const [isUploading, setIsUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  const isProcessing = processing.isProcessing;

  // Clear errors after 5 seconds
  useEffect(() => {
    if (validationErrors.length > 0) {
      const timer = setTimeout(() => {
        setValidationErrors([]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [validationErrors]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      // Clear previous errors
      setValidationErrors([]);

      // Filter and validate PDF files
      const validFiles: File[] = [];
      const errors: string[] = [];

      acceptedFiles.forEach((file) => {
        const error = validateFile(file, MAX_FILE_SIZE);
        if (error === null) {
          validFiles.push(file);
        } else {
          errors.push(`${file.name}: ${error}`);
        }
      });

      // Set validation errors to display
      if (errors.length > 0) {
        setValidationErrors(errors);
      }

      if (validFiles.length > 0) {
        setIsUploading(true);
        
        // Add files to store
        addFiles(validFiles);
        
        // Simulate upload delay for visual feedback
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setIsUploading(false);
      }
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled: isUploading || isProcessing,
  });

  // Determine visual state
  const getBorderClass = () => {
    if (isUploading) return 'border-blue-500 bg-blue-50';
    if (isDragActive) return 'border-green-500 bg-green-50';
    return 'border-gray-300 hover:border-blue-500 hover:bg-blue-50';
  };

  const getIconBgClass = () => {
    if (isUploading) return 'bg-blue-100';
    if (isDragActive) return 'bg-green-100';
    return 'bg-ocean-100';
  };

  const getIconClass = () => {
    if (isUploading) return 'text-blue-600';
    if (isDragActive) return 'text-green-600';
    return 'text-ocean-600';
  };

  return (
    <div className="flex flex-col">
      <div
        {...getRootProps()}
        className={`
          relative flex min-h-[500px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16
          border-2 border-dashed transition-colors duration-200
          ${isUploading || isProcessing ? 'cursor-wait' : 'cursor-pointer'}
          ${isProcessing ? 'opacity-50' : ''}
          ${getBorderClass()}
        `}
      >
        <input {...getInputProps()} disabled={isUploading || isProcessing} />
        
        <div className="flex flex-col items-center gap-4 text-center">
          <div className={`rounded-full p-4 ${getIconBgClass()}`}>
            {isUploading || isProcessing ? (
              <Loader2 className={`h-12 w-12 ${getIconClass()} animate-spin`} />
            ) : (
              <UploadCloud className={`h-12 w-12 ${getIconClass()}`} />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-gray-900">
              {isProcessing ? 'Processing...' : isUploading ? 'Uploading...' : t('uploadTitle')}
            </h2>
            <p className="text-gray-700">
              {isProcessing 
                ? 'Please wait while we process your files' 
                : isUploading 
                ? 'Processing your files...' 
                : t('uploadSubtitle')
              }
            </p>
          </div>

          <button
            type="button"
            disabled={isUploading || isProcessing}
            className="mt-2 rounded-lg bg-ocean-600 px-6 py-3 text-white font-medium hover:bg-ocean-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {isProcessing ? 'Processing...' : isUploading ? 'Uploading...' : t('chooseFile')}
          </button>

          <p className="mt-4 text-sm text-gray-500">
            {t('fileInfo')}
          </p>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex flex-col gap-2">
            {validationErrors.map((error, index) => (
              <p key={index} className="text-sm text-red-600">
                {error}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

