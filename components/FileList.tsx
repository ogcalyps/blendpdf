'use client';

import { GripVertical, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFileStore } from '@/store/use-file-store';
import { formatFileSize } from '@/lib/utils';

export function FileList() {
  const t = useTranslations();
  const files = useFileStore((state) => state.files);
  const removeFile = useFileStore((state) => state.removeFile);

  const truncateFileName = (name: string, maxLength: number = 30): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + '...';
  };

  return (
    <div className="mt-6 rounded-xl border-2 border-gray-200 bg-white">
      {/* Heading */}
      <div className="px-4 pt-4 pb-3">
        <h3 className="text-lg font-semibold text-gray-900">
          {t('fileList.title')}
          {files.length > 0 && (
            <span className="ms-2 text-sm font-normal text-gray-500">
              ({files.length} {files.length === 1 ? t('fileList.file') : t('fileList.files')})
            </span>
          )}
        </h3>
      </div>

      {/* File list or empty state */}
      {files.length === 0 ? (
        <div className="px-4 pb-4 text-center">
          <p className="text-gray-500">{t('fileList.empty')}</p>
        </div>
      ) : (
        <div>
          {files.map((file, index) => (
            <div
              key={file.id}
              className={`
                flex items-center gap-3 py-3 px-4 border-b border-gray-100 transition-colors hover:bg-gray-50
                ${index === files.length - 1 ? 'border-b-0' : ''}
              `}
            >
              {/* GripVertical icon */}
              <GripVertical className="h-5 w-5 text-gray-400" />

              {/* File name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {truncateFileName(file.name)}
                </p>
              </div>

              {/* File size */}
              <p className="text-xs text-gray-600">
                {formatFileSize(file.size)}
              </p>

              {/* Trash button */}
              <button
                onClick={() => removeFile(file.id)}
                className="p-1 text-gray-400 transition-colors hover:text-red-600"
                aria-label={`Remove ${file.name}`}
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

