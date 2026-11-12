'use client';

/**
 * "Edit text (beta)": the field the new wording is typed in (phase-c-spec.md
 * section 7). One line, <input dir="auto"> at 16 px (iOS zooms the page on a
 * smaller field), prefilled with the detected line and all selected, so the
 * visitor either confirms it or types over it. Enter or leaving the field
 * keeps the text, Escape drops it.
 *
 * From 768 px it floats next to the line inside the page (like the mini-bar:
 * above, below when there's no room, clamped). Below 768 px it docks full
 * width at the bottom of the visible viewport, which is just above the
 * on-screen keyboard while it is open, and scrolls the page so the line
 * stays visible above it.
 *
 * Under the field (keep-font-spec.md section 9) a note says when the line will
 * NOT be in its own font: "Closest match: {font}" with why (the font lacks
 * some letters, or can't be reused at all), or that it will be saved as a
 * picture. Nothing when the original font is kept, or the closest match is
 * the line's own family. No font picker.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import type { ReplaceFontChoice } from '@/lib/edit-pdf';
import { dockReplaceField, placeReplaceField, replaceFieldDocked, type Rect, type VisibleViewport } from './interaction';
import { fontNote, isolateName } from './replace-preview';

export interface ReplaceFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Enter (`viaEnter`) or leaving the field. */
  onCommit: (viaEnter: boolean) => void;
  /** Escape. */
  onCancel: () => void;
  /** The prefill failed its sanity check: the field starts empty and says why. */
  unsure: boolean;
  /** How the typed text will be drawn (replace-preview.ts fieldChoice); null = no note (original font, or not known yet). */
  choice: ReplaceFontChoice | null;
  /** The old line's box, CSS px inside the page. */
  line: Rect;
  /** The page's CSS size. */
  container: { width: number; height: number };
  /** The page overlay, to find the line on screen when the field is docked. */
  overlayRef: RefObject<HTMLDivElement | null>;
}

function visibleViewport(): VisibleViewport {
  const vv = window.visualViewport;
  return vv
    ? { width: vv.width, height: vv.height, offsetLeft: vv.offsetLeft, offsetTop: vv.offsetTop }
    : { width: window.innerWidth, height: window.innerHeight, offsetLeft: 0, offsetTop: 0 };
}

export function ReplaceField({ value, onChange, onCommit, onCancel, unsure, choice, line, container, overlayRef }: ReplaceFieldProps) {
  const t = useTranslations('editPdf');
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);
  const notesId = useId();
  const note = fontNote(choice);
  const [docked, setDocked] = useState(() => replaceFieldDocked(window.innerWidth));
  const [height, setHeight] = useState(96);
  // A first guess from the viewport alone, so the field is on screen (and focusable) from its first paint.
  const [dock, setDock] = useState<{ left: number; top: number; width: number }>(() => {
    const { left, top, width } = dockReplaceField({ left: 0, top: 0, right: 0, bottom: 0 }, 96, visibleViewport());
    return { left, top, width };
  });

  // Focus with everything selected: Enter confirms the prefill, typing replaces it.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.select();
  }, []);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el && el.offsetHeight !== height) setHeight(el.offsetHeight);
  });

  const placeDock = useCallback(() => {
    const viewport = visibleViewport();
    const page = overlayRef.current?.getBoundingClientRect();
    const lineOnScreen = page
      ? { left: page.left + line.left, top: page.top + line.top, right: page.left + line.left + line.width, bottom: page.top + line.top + line.height }
      : { left: 0, top: 0, right: 0, bottom: 0 };
    const placement = dockReplaceField(lineOnScreen, height, viewport);
    if (placement.scrollBy > 0) window.scrollBy({ top: placement.scrollBy, behavior: 'instant' as ScrollBehavior });
    setDock((old) =>
      old.left === placement.left && old.top === placement.top && old.width === placement.width
        ? old
        : { left: placement.left, top: placement.top, width: placement.width },
    );
  }, [height, line.height, line.left, line.top, line.width, overlayRef]);

  useEffect(() => {
    const onResize = () => setDocked(replaceFieldDocked(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Docked: follow the visible viewport (the keyboard opening or closing, pinch zoom).
  useLayoutEffect(() => {
    if (!docked) return;
    placeDock();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', placeDock);
    vv?.addEventListener('scroll', placeDock);
    return () => {
      vv?.removeEventListener('resize', placeDock);
      vv?.removeEventListener('scroll', placeDock);
    };
  }, [docked, placeDock]);

  const finish = (commit: boolean, viaEnter: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (commit) onCommit(viaEnter);
    else onCancel();
  };

  const card = (style: CSSProperties) => (
    <div
      ref={cardRef}
      style={style}
      // A press on the card's text keeps the focus in the field; nothing reaches the page.
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target !== inputRef.current) e.preventDefault();
      }}
      className="z-50 select-text rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
    >
      <input
        ref={inputRef}
        type="text"
        dir="auto"
        value={value}
        placeholder={t('replace.placeholder')}
        aria-label={t('replace.field')}
        aria-describedby={notesId}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => finish(true, false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            finish(true, true);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(false, false);
          }
        }}
        className="block min-h-11 w-full rounded-lg border border-orange-200 bg-white px-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-[#FF6B35] focus:outline-none focus:ring-2 focus:ring-[#FF6B35]/30"
        style={{ fontSize: 16 }}
      />
      <div id={notesId} aria-live="polite" className="mt-1.5 space-y-1 px-1 text-xs leading-snug">
        {unsure && <p className="text-amber-800">{t('replace.unsure')}</p>}
        {note?.kind === 'image' && <p className="text-amber-800">{t('textAsImage')}</p>}
        {note?.kind === 'letters' && <p className="text-amber-800">{t('replace.closestMatch', { font: isolateName(note.font) })}</p>}
        {note?.kind === 'font' && <p className="text-amber-800">{t('replace.closestMatchFont', { font: isolateName(note.font) })}</p>}
        <p className="text-gray-600">{t('replace.note')}</p>
      </div>
    </div>
  );

  if (docked) {
    return createPortal(
      card({ position: 'fixed', left: dock.left, top: dock.top, width: dock.width }),
      document.body,
    );
  }

  const place = placeReplaceField(line, height, container);
  return card({ position: 'absolute', left: place.left, top: place.top, width: place.width });
}
