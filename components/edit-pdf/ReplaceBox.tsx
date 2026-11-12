'use client';

/**
 * "Edit text (beta)": one changed line on the page (phase-c-spec.md section 7,
 * keep-font-spec.md section 8).
 *
 * A white mask over the old line's box (preview only: the saved file has the
 * old text objects taken out, it does not get a white box; anything else
 * drawn under the line, such as shading or an underline, stays in the file)
 * and the new text on top, on the old baseline, from the old start edge (left
 * for a left-to-right line, right for a right-to-left one).
 *
 * The new text is the engine's own render of what the save will write
 * (previewReplacement: the line's original font when it can draw every
 * character, else the closest look-alike, else Cairo), a transparent canvas
 * placed by the preview's box in points. Until the first render of the line
 * comes back nothing is drawn, and the old line stays unmasked while the
 * field still holds it unchanged; while a newer render is on its way the last
 * one stays. When the engine can't make one, the Phase C text in the
 * editor's Cairo at the object's size is shown instead.
 *
 * The box is anchored to its line: it is never moved or resized, so there are
 * no handles and no drag. Dashed orange outline while it is being typed or is
 * selected, red when the last save refused it.
 */
import { useLayoutEffect, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { replaceAnchor, type ReplaceObject, type ReplacePreview, type TextBoxLayout } from '@/lib/edit-pdf';
import { EDITOR_FONT_STACK } from './TextBox';
import type { PreviewView } from './replace-preview';
import { cleanReplaceText } from './state';

export type ReplaceOutline = 'none' | 'active' | 'refused';

interface ReplaceBoxProps {
  object: ReplaceObject;
  /** What to show: the field's value while typing, else object.text. */
  text: string;
  /** The engine's render of `text` (replace-preview.ts). */
  view: PreviewView;
  /** CSS px per PDF point on the current page. */
  pxPerPt: number;
  /** The page's CSS size (the box and the baseline are fractions of it). */
  cssWidth: number;
  cssHeight: number;
  /** The CSS path only: the engine's Cairo layout of `text` at the object's size (null until the engine and its font are ready). */
  layout: TextBoxLayout | null;
  /** The CSS path only: Cairo's ascent and descent in em (TextEngine), so the baseline lands where the PDF puts it. */
  metrics: { ascent: number; descent: number } | null;
  outline: ReplaceOutline;
  /** Hide the old line. Off while the field is still empty, so the line being retyped stays readable. */
  masked: boolean;
  interactive: boolean;
  hitProps?: HTMLAttributes<HTMLDivElement>;
}

/** Until the editor font is registered: roughly Cairo's metrics. */
const FALLBACK_METRICS = { ascent: 1.303, descent: 0.571 };

const OUTLINES: Record<ReplaceOutline, CSSProperties> = {
  none: {},
  active: { outline: '2px dashed #FF6B35', outlineOffset: 2 },
  refused: { outline: '2px solid #DC2626', outlineOffset: 2 },
};

/** The engine's canvas, copied into one this component owns (the engine's may be cached and shown again elsewhere). */
function PreviewCanvas({ preview, style }: { preview: ReplacePreview; style: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const target = ref.current;
    const source = preview.canvas;
    if (!target || !source) return;
    // Setting the size clears the canvas.
    target.width = source.width;
    target.height = source.height;
    target.getContext('2d')?.drawImage(source, 0, 0);
  }, [preview]);
  // Gone from the page: give the copy's pixels back now (iOS frees canvas memory only on collection).
  useLayoutEffect(() => {
    const target = ref.current;
    return () => {
      if (!target) return;
      target.width = 0;
      target.height = 0;
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" style={style} />;
}

export function ReplaceBox({ object, text, view, pxPerPt, cssWidth, cssHeight, layout, metrics, outline, masked, interactive, hitProps }: ReplaceBoxProps) {
  const { box } = object;
  const anchor = replaceAnchor(object);
  // Before the first render of this line: the old line is still what the field says, so leave it in view.
  const untouched = cleanReplaceText(text) === cleanReplaceText(object.line.text);
  const showMask = masked && !(view.kind === 'waiting' && untouched);
  const typed = text.trim() !== '';

  let drawn: ReactNode = null;
  if (view.kind === 'canvas' && view.preview.canvas && typed) {
    const { preview } = view;
    drawn = (
      <PreviewCanvas
        preview={preview}
        style={{
          position: 'absolute',
          // left: from the line's left ink edge (box.xPct, the start of an upright line); top: up from the baseline.
          left: box.xPct * cssWidth + preview.left * pxPerPt,
          top: anchor.baseline * cssHeight - preview.top * pxPerPt,
          width: preview.width * pxPerPt,
          height: preview.height * pxPerPt,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
    );
  } else if (view.kind === 'css' && typed) {
    const { ascent, descent } = metrics ?? FALLBACK_METRICS;
    const fontPx = object.size * pxPerPt;
    const line = layout && layout.missing.length === 0 ? layout.lines[0] : undefined;
    const horizontal: CSSProperties =
      anchor.edge === 'left' ? { left: `${anchor.x * 100}%` } : { right: `${(1 - anchor.x) * 100}%` };
    drawn = (
      <div
        aria-hidden="true"
        dir={line?.direction ?? 'auto'}
        style={{
          position: 'absolute',
          ...horizontal,
          // Line box exactly ascent + descent tall, so its baseline sits `ascent` below its top.
          top: anchor.baseline * cssHeight - ascent * fontPx,
          height: (ascent + descent) * fontPx,
          lineHeight: `${(ascent + descent) * fontPx}px`,
          fontFamily: EDITOR_FONT_STACK,
          fontSize: fontPx,
          fontWeight: 400,
          fontStyle: 'normal',
          letterSpacing: 0,
          color: object.color,
          whiteSpace: 'pre',
          unicodeBidi: line ? undefined : 'plaintext',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {text}
      </div>
    );
  }

  return (
    <>
      <div
        {...hitProps}
        data-replace-id={object.id}
        data-replace-preview={view.kind}
        className={`absolute ${interactive ? 'cursor-pointer' : ''} focus:outline-none`}
        style={{
          left: `${box.xPct * 100}%`,
          top: `${box.yPct * 100}%`,
          width: `${box.wPct * 100}%`,
          height: `${box.hPct * 100}%`,
          background: showMask ? '#FFFFFF' : 'transparent',
          // One more CSS pixel of white all round: the box edges fall between device pixels, and
          // without it the tops of tall letters of the old line show as a faint row of dots.
          boxShadow: showMask ? '0 0 0 1px #FFFFFF' : undefined,
          pointerEvents: interactive ? 'auto' : 'none',
          // Anchored, never dragged: a finger on it may still scroll the page.
          touchAction: 'auto',
          ...OUTLINES[outline],
        }}
      />
      {drawn}
    </>
  );
}
