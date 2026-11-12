'use client';

/**
 * "Your changes" in the Save dialog (workspace-spec.md 4.9): one row per kind
 * of change, from summarizeDoc, and nothing at all when there are none. Only
 * the cheap ones can be taken back here (crops, the watermark, the page
 * numbers, turned pages); the others show their count and point to Undo.
 */
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { DocSummary } from '@/lib/workspace/types';

interface ChangesPanelProps {
  summary: DocSummary;
  onClearCrops: () => void;
  onRemoveWatermark: () => void;
  onRemovePageNumbers: () => void;
  onRemoveLetterhead: () => void;
  onTurnBack: () => void;
}

function Row({ children, action }: { children: ReactNode; action?: { label: string; onClick: () => void } }) {
  return (
    <li className="flex min-h-11 items-center justify-between gap-3 text-sm text-gray-700">
      <span>{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-11 shrink-0 rounded-lg px-3 font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
        >
          {action.label}
        </button>
      )}
    </li>
  );
}

export function ChangesPanel({ summary, onClearCrops, onRemoveWatermark, onRemovePageNumbers, onRemoveLetterhead, onTurnBack }: ChangesPanelProps) {
  const t = useTranslations('workspace');
  const additions = Object.values(summary.objects).reduce((sum, n) => sum + n, 0);
  const remove = t('changes.remove');
  const undoOnly = summary.deletedPages > 0 || summary.moved || summary.blankPages > 0 || summary.insertedPages > 0 || additions > 0 || summary.changedLines > 0;
  const rows = [
    summary.deletedPages > 0 && <Row key="deleted">{t('changes.deleted', { count: summary.deletedPages })}</Row>,
    summary.turnedPages > 0 && (
      <Row key="turned" action={{ label: t('changes.turnBack'), onClick: onTurnBack }}>
        {t('changes.turned', { count: summary.turnedPages })}
      </Row>
    ),
    summary.moved && <Row key="moved">{t('changes.moved')}</Row>,
    summary.blankPages > 0 && <Row key="blank">{t('changes.blank', { count: summary.blankPages })}</Row>,
    summary.insertedPages > 0 && <Row key="inserted">{t('changes.inserted', { count: summary.insertedPages })}</Row>,
    summary.croppedPages > 0 && (
      <Row key="cropped" action={{ label: remove, onClick: onClearCrops }}>
        {t('changes.cropped', { count: summary.croppedPages })}
      </Row>
    ),
    summary.watermark && (
      <Row key="watermark" action={{ label: remove, onClick: onRemoveWatermark }}>
        {t('changes.watermark')}
      </Row>
    ),
    summary.pageNumbers && (
      <Row key="numbers" action={{ label: remove, onClick: onRemovePageNumbers }}>
        {t('changes.pageNumbers')}
      </Row>
    ),
    summary.letterhead && (
      <Row key="letterhead" action={{ label: remove, onClick: onRemoveLetterhead }}>
        {t('changes.letterhead')}
      </Row>
    ),
    additions > 0 && <Row key="objects">{t('changes.objects', { count: additions })}</Row>,
    summary.changedLines > 0 && <Row key="lines">{t('changes.lines', { count: summary.changedLines })}</Row>,
  ].filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="workspace-changes-title" className="border-t border-gray-100 pt-3">
      <h3 id="workspace-changes-title" className="text-sm font-semibold text-gray-900">
        {t('changes.title')}
      </h3>
      <ul className="mt-1 divide-y divide-gray-100">{rows}</ul>
      {undoOnly && <p className="mt-1 text-xs text-gray-500">{t('changes.undoHint')}</p>}
    </section>
  );
}
