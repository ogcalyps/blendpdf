'use client';

import { useCallback, useState } from 'react';
import { ErrorCode, type FileRejection } from 'react-dropzone';
import { useTrackedDropzone } from '@/hooks/useTrackedDropzone';
import { useLocale, useTranslations } from 'next-intl';
import { UploadCloud, Loader2, X } from 'lucide-react';
import { useFileStore } from '@/store/use-file-store';
import { validateFile, formatFileSize } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

interface UploadZoneProps {
  maxFiles?: number; // Maximum number of files accepted at once (unlimited when omitted)
}

export function UploadZone({ maxFiles }: UploadZoneProps = {}) {
  const t = useTranslations('hero');
  const locale = useLocale();
  const tCommon = useTranslations('common');
  const tUpload = useTranslations('upload');
  const addFiles = useFileStore((state) => state.addFiles);
  const processing = useFileStore((state) => state.processing);
  const [isUploading, setIsUploading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const isProcessing = processing.isProcessing;

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

  // Surface files that react-dropzone rejected (oversized, wrong type, too many)
  const onDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      const errors: string[] = [];
      let tooManyReported = false;

      rejections.forEach(({ file, errors: fileErrors }) => {
        const codes = fileErrors.map((e) => e.code);

        if (codes.includes(ErrorCode.TooManyFiles)) {
          if (!tooManyReported) {
            tooManyReported = true;
            errors.push(tUpload('tooManyFiles', { max: maxFiles ?? 0 }));
          }
          return;
        }

        if (codes.includes(ErrorCode.FileTooLarge)) {
          errors.push(tUpload('fileTooLarge', { name: file.name, maxSize: formatFileSize(MAX_FILE_SIZE, locale) }));
        } else if (codes.includes(ErrorCode.FileInvalidType)) {
          errors.push(tUpload('fileInvalidType', { name: file.name }));
        } else {
          errors.push(tUpload('rejected', { name: file.name }));
        }
      });

      if (errors.length > 0) {
        setValidationErrors((prev) => [...prev, ...errors]);
      }
    },
    [tUpload, maxFiles, locale]
  );

  const { getRootProps, getInputProps, isDragActive } = useTrackedDropzone({
    onDrop,
    onDropRejected,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    maxFiles: maxFiles ?? 0,
    multiple: true,
    disabled: isUploading || isProcessing,
  });

  // Determine visual state
  const getBorderClass = () => {
    if (isUploading) return 'border-primary bg-orange-50';
    if (isDragActive) return 'border-green-500 bg-green-50';
    return 'border-orange-200 hover:border-primary hover:bg-orange-50';
  };

  const getIconBgClass = () => {
    if (isUploading) return 'bg-orange-100';
    if (isDragActive) return 'bg-green-100';
    return 'bg-orange-100';
  };

  const getIconClass = () => {
    if (isUploading) return 'text-primary';
    if (isDragActive) return 'text-green-600';
    return 'text-primary';
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
              {isProcessing ? tCommon('processing') : isUploading ? tCommon('uploading') : t('uploadTitle')}
            </h2>
            <p className="text-gray-700">
              {isProcessing
                ? tCommon('pleaseWait')
                : isUploading
                ? tCommon('processingFile')
                : t('uploadSubtitle')
              }
            </p>
          </div>

          <button
            type="button"
            disabled={isUploading || isProcessing}
            className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium hover:bg-[#FF8B68] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-none"
          >
            {isProcessing ? tCommon('processing') : isUploading ? tCommon('uploading') : t('chooseFile')}
          </button>

          <p className="mt-4 text-sm text-gray-500">
            {t('fileInfo')}
          </p>

          {/* Google Drive Integration */}
          <div className="mt-6">
            <GoogleDrivePicker
              onFilesSelected={(files) => {
                // Validate and add files
                const validFiles: File[] = [];
                const errors: string[] = [];

                files.forEach((file) => {
                  const error = validateFile(file, MAX_FILE_SIZE);
                  if (error === null) {
                    validFiles.push(file);
                  } else {
                    errors.push(`${file.name}: ${error}`);
                  }
                });

                if (errors.length > 0) {
                  setValidationErrors(errors);
                }

                if (validFiles.length > 0) {
                  addFiles(validFiles);
                }
              }}
              disabled={isUploading || isProcessing}
              multiple={true}
            />
          </div>
        </div>
      </div>

      {/* Validation Errors (dismissed manually, never auto-hidden) */}
      {validationErrors.length > 0 && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              {validationErrors.map((error, index) => (
                <p key={index} className="text-sm text-red-600">
                  {error}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setValidationErrors([])}
              aria-label={tUpload('dismiss')}
              className="shrink-0 rounded-full p-1 text-red-400 transition-colors hover:text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
