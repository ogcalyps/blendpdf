'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FileRejection } from 'react-dropzone';
import { Upload } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useTrackedDropzone } from '@/hooks/useTrackedDropzone';
import { trackEvent } from '@/lib/analytics';
import { setHandoff } from '@/lib/file-handoff';
import { startPageFor, START_ACCEPT } from '@/lib/home-start';

/** What a drop that can't start says: several files (one starts here; Merge PDF takes several), or a type no tool takes. */
export function startProblem(accepted: readonly File[], rejected: readonly FileRejection[]): 'oneFile' | 'unsupported' | null {
  if (rejected.some((r) => r.errors.some((e) => e.code === 'too-many-files'))) return 'oneFile';
  const file = accepted[0];
  if (!file || !startPageFor(file) || rejected.length > 0) return 'unsupported';
  return null;
}

/** home_start's to_tool: the start page as a GA-style slug ('/edit-pdf' → 'edit_pdf'). */
export function homeStartTool(page: string): string {
  return page.replace(/^\//, '').replace(/-/g, '_');
}

/**
 * "Drop a PDF to start" on the home page (a click anywhere in the box picks a
 * file too): a PDF opens in the editor with every
 * tool, other documents open in the converter that turns them into a PDF. The
 * file goes over like "Keep working" (lib/file-handoff), so nothing uploads here.
 */
export function HomeDropZone() {
  const t = useTranslations('hero.start');
  const router = useRouter();
  const [error, setError] = useState<'unsupported' | 'oneFile' | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      const problem = startProblem(accepted, rejected);
      setError(problem);
      if (problem) return;
      const file = accepted[0];
      const page = startPageFor(file)!;
      trackEvent('home_start', { to_tool: homeStartTool(page) });
      setHandoff(file, 'home');
      router.push(page);
    },
    [router]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useTrackedDropzone({
    onDrop,
    accept: START_ACCEPT,
    multiple: false,
  });

  return (
    <div className="mx-auto mb-6 max-w-2xl sm:mb-8">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed bg-white/80 px-6 py-8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
          isDragActive ? 'border-primary bg-orange-50' : 'border-orange-200 hover:border-primary'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-3 h-10 w-10 text-primary" aria-hidden="true" />
        <p className="text-lg font-semibold text-gray-900">{t('title')}</p>
        <p className="mt-1 text-sm text-gray-600">{t('subtitle')}</p>
        <button
          type="button"
          // The whole box opens the picker; the button is there to be seen and reached. Stop the click here so it opens once.
          onClick={(e) => {
            e.stopPropagation();
            open();
          }}
          className="mt-4 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {t('choose')}
        </button>
        <p className="mt-3 text-xs text-gray-500">{t('formats')}</p>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error === 'oneFile'
            ? t.rich('oneFile', {
                link: (chunks) => (
                  <Link href="/merge-pdf" className="font-medium underline hover:no-underline">
                    {chunks}
                  </Link>
                ),
              })
            : t('unsupported')}
        </p>
      )}
    </div>
  );
}
