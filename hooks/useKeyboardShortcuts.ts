'use client';

import { useEffect } from 'react';
import { useFileStore } from '@/store/use-file-store';

interface UseKeyboardShortcutsProps {
  onEscape?: () => void;
  onMerge?: () => void;
  onCompress?: () => void;
}

export function useKeyboardShortcuts({
  onEscape,
  onMerge,
  onCompress,
}: UseKeyboardShortcutsProps) {
  const files = useFileStore((state) => state.files);
  const processing = useFileStore((state) => state.processing);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Escape: Close dialogs/modals
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Cmd/Ctrl + M: Merge
      if ((event.metaKey || event.ctrlKey) && event.key === 'm' && onMerge) {
        event.preventDefault();
        // Only trigger if files are uploaded and not processing
        if (files.length >= 2 && !processing.isProcessing) {
          onMerge();
        }
        return;
      }

      // Cmd/Ctrl + K: Compress
      if ((event.metaKey || event.ctrlKey) && event.key === 'k' && onCompress) {
        event.preventDefault();
        // Only trigger if files are uploaded and not processing
        if (files.length > 0 && !processing.isProcessing) {
          onCompress();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [files.length, processing.isProcessing, onEscape, onMerge, onCompress]);
}

