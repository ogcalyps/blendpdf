'use client';

import { useState, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlignLeft,
  ArrowUpDown,
  Crop,
  Droplets,
  EyeOff,
  FileMinus,
  FileOutput,
  FilePenLine,
  FileText,
  GitMerge,
  Hash,
  Image as ImageIcon,
  Images,
  Layers,
  PenTool,
  RotateCw,
  ScanText,
  Scissors,
  Shield,
  Table,
  Trash2,
} from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/routing';
import { trackEvent } from '@/lib/analytics';
import { setHandoff } from '@/lib/file-handoff';
import { KEEP_WORKING_SHOWN, keepWorkingTools, toolSlugFromPath } from '@/lib/keep-working';

/** Same icons as the home page tool grid. */
const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  'edit-pdf': FilePenLine,
  'split-pdf': Scissors,
  'merge-pdf': GitMerge,
  'compress-pdf': FileMinus,
  'sign-pdf': PenTool,
  'pdf-to-word': FileText,
  'watermark-pdf': Droplets,
  'add-page-numbers': Hash,
  'crop-pdf': Crop,
  'rotate-pdf': RotateCw,
  'reorder-pdf': ArrowUpDown,
  'delete-pages': Trash2,
  'extract-pages': FileOutput,
  'protect-pdf': Shield,
  'ocr-pdf': ScanText,
  'pdf-to-images': ImageIcon,
  'pdf-to-excel': Table,
  'pdf-to-text': AlignLeft,
  'extract-images': Images,
  'flatten-pdf': Layers,
  'remove-metadata': EyeOff,
};

interface KeepWorkingProps {
  fileBlob: Blob | null;
  filename: string;
}

/**
 * "Keep working on this file": opens another tool with this result already
 * loaded (lib/file-handoff), so there's nothing to download and pick again.
 * Renders nothing when the result isn't a single PDF the next tool can open.
 */
export function KeepWorking({ fileBlob, filename }: KeepWorkingProps) {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [showAll, setShowAll] = useState(false);
  const currentSlug = toolSlugFromPath(pathname);
  const tools = keepWorkingTools(currentSlug, fileBlob, filename);
  if (!fileBlob || tools.length === 0) return null;

  const shown = showAll ? tools : tools.slice(0, KEEP_WORKING_SHOWN);

  const open = (slug: string) => {
    setHandoff(new File([fileBlob], filename, { type: 'application/pdf' }), currentSlug);
    trackEvent('keep_working', { from_tool: currentSlug.replace(/-/g, '_'), to_tool: slug.replace(/-/g, '_') });
    router.push(`/${slug}`);
  };

  return (
    <section aria-labelledby="keep-working-title" className="w-full border-t border-gray-200 pt-4">
      <h3 id="keep-working-title" className="text-sm font-semibold text-gray-900">
        {t('keepWorking.title')}
      </h3>
      <p className="mt-1 text-xs text-gray-500">{t('keepWorking.hint')}</p>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {shown.map(({ slug, titleKey }) => {
          const Icon = ICONS[slug] ?? FileText;
          return (
            <li key={slug}>
              <button
                type="button"
                onClick={() => open(slug)}
                className="flex h-full min-h-[64px] w-full flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-1.5 py-2 text-center text-xs font-medium text-gray-700 transition-colors hover:border-primary hover:bg-orange-50 hover:text-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                <span className="leading-tight">{t(`nav.tools.${titleKey}.title`)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {tools.length > KEEP_WORKING_SHOWN && (
        <button
          type="button"
          onClick={() => setShowAll((all) => !all)}
          aria-expanded={showAll}
          className="mt-2 text-sm font-medium text-[#E85A2B] hover:underline"
        >
          {showAll ? t('keepWorking.fewerTools') : t('keepWorking.allTools', { count: tools.length })}
        </button>
      )}
    </section>
  );
}
