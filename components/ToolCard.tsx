'use client';

import { useTranslations } from 'next-intl';
import { Loader2, Check } from 'lucide-react';
import type { ToolType } from '@/types';
import { useFileStore } from '@/store/use-file-store';

interface ToolCardProps {
  tool: ToolType;
  icon: React.ReactNode;
  badge?: string;
  onClick: () => void;
  isSelected?: boolean;
  comingSoon?: boolean;
}

export function ToolCard({ tool, icon, badge, onClick, isSelected = false, comingSoon = false }: ToolCardProps) {
  const t = useTranslations(`tools.${tool}`);
  const files = useFileStore((state) => state.files);
  const processing = useFileStore((state) => state.processing);

  // Check if this tool is currently processing
  const isProcessing = processing.isProcessing && processing.currentTool === tool;
  const isDisabled = processing.isProcessing;

  // Get badge from prop or translations
  // Badge key now exists for all tools (empty string for tools without badges)
  const badgeText = badge || (t('badge') as string) || undefined;

  const handleClick = () => {
    // Don't allow clicks if coming soon
    if (comingSoon) {
      return;
    }

    // Check if files are uploaded
    if (files.length === 0) {
      alert('Please upload files first');
      return;
    }

    // Check if already processing
    if (isDisabled) {
      return;
    }

    // Call parent onClick handler
    onClick();
  };

  // Color mapping for icon backgrounds based on tool type
  const iconBgColors: Record<ToolType, string> = {
    merge: 'bg-ocean-100',
    compress: 'bg-coral-100',
    convert: 'bg-emerald-100',
    split: 'bg-ocean-100',
  };

  const iconColors: Record<ToolType, string> = {
    merge: 'text-ocean-600',
    compress: 'text-coral-600',
    convert: 'text-emerald-600',
    split: 'text-ocean-600',
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled || comingSoon}
      className={`
        group relative flex w-full items-start gap-4 rounded-xl border-2 p-6 text-start 
        transition-all duration-200
        ${comingSoon
          ? 'border-gray-200 bg-white opacity-60 cursor-not-allowed'
          : isDisabled 
          ? 'border-gray-200 bg-white opacity-50 cursor-not-allowed' 
          : isSelected
          ? 'border-blue-500 bg-blue-50 cursor-pointer'
          : 'border-gray-200 bg-white hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
        }
      `}
    >
      {/* Coming Soon badge */}
      {comingSoon && (
        <div className="absolute end-4 top-4 rounded-full bg-gray-500 px-3 py-1 text-xs font-medium text-white">
          Coming Soon
        </div>
      )}
      
      {/* Gray overlay when coming soon */}
      {comingSoon && (
        <div className="absolute inset-0 rounded-xl bg-gray-200 opacity-20 pointer-events-none" />
      )}

      {/* Checkmark icon in top-end corner when selected */}
      {isSelected && !isDisabled && !comingSoon && (
        <div className="absolute end-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
      <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBgColors[tool]}`}>
        {isProcessing ? (
          <Loader2 className={`h-6 w-6 ${iconColors[tool]} animate-spin`} />
        ) : (
          <div className={iconColors[tool]}>{icon}</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-gray-900">{t('title')}</h3>
          {badgeText && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
              {badgeText}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700">{t('description')}</p>
      </div>
    </button>
  );
}

