'use client';

/**
 * A text object on the page.
 *
 * Not editing: one absolutely placed div per line of the ENGINE's layout (the
 * one lib/pdf-text writes into the PDF), in the same Cairo file registered as
 * EDITOR_FONT_FAMILY with matching ascent/descent, so line breaks, widths and
 * baselines on screen are the PDF's. A width difference between the browser
 * and the engine can only show as overflow, never as a misplaced line.
 *
 * Editing: a <textarea dir="auto"> over the box with the same font, size and
 * line height. While typing the browser wraps; on blur the box goes back to
 * the engine's lines, which are what the PDF gets.
 *
 * Until the engine has loaded, or when the text has characters Cairo lacks,
 * the text is shown like the textarea shows it (and in the second case a note
 * says the box will be saved as a picture).
 */
import { useLayoutEffect, useRef, type CSSProperties, type HTMLAttributes } from 'react';
import { useTranslations } from 'next-intl';
import { DEFAULT_LINE_HEIGHT } from '@/lib/pdf-text/constants';
import { EDITOR_FONT_FAMILY, type TextBoxLayout, type TextObject } from '@/lib/edit-pdf';

export const EDITOR_FONT_STACK = `"${EDITOR_FONT_FAMILY}", var(--font-cairo), Cairo, sans-serif`;

interface TextEditing {
  value: string;
  onChange: (value: string) => void;
  /** Blur or Escape: the workspace commits the text. */
  onDone: () => void;
}

interface TextBoxProps {
  object: TextObject;
  /** CSS px per PDF point on the current page. */
  pxPerPt: number;
  /** The engine's layout of this text at this size and width; null until the engine and its font are ready. */
  layout: TextBoxLayout | null;
  editing?: TextEditing;
  /** Pointer handlers, aria and focus props for the box (not used while editing). */
  hitProps?: HTMLAttributes<HTMLDivElement>;
  /** The box takes pointer events (Select tool). */
  interactive: boolean;
}

function TextArea({ editing, style, placeholder, label }: { editing: TextEditing; style: CSSProperties; placeholder: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Focus on mount, inside the gesture that opened it (iOS only shows the keyboard then), caret at the end.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
  }, []);

  // Grow with the text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [editing.value, style.fontSize, style.width]);

  return (
    <textarea
      ref={ref}
      dir="auto"
      rows={1}
      value={editing.value}
      placeholder={placeholder}
      aria-label={label}
      spellCheck={false}
      onChange={(e) => editing.onChange(e.target.value)}
      onBlur={editing.onDone}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      // Clicks inside move the caret; they must not reach the page and end the edit.
      onPointerDown={(e) => e.stopPropagation()}
      className="block w-full resize-none overflow-hidden border-0 bg-white/40 p-0 outline-2 outline-offset-2 outline-[#FF6B35] outline-dashed placeholder:text-gray-400 focus:outline-dashed"
      style={style}
    />
  );
}

export function TextBox({ object, pxPerPt, layout, editing, hitProps, interactive }: TextBoxProps) {
  const t = useTranslations('editPdf');
  const fontSize = object.size * pxPerPt;
  const lineHeight = (layout?.lineHeight ?? object.size * DEFAULT_LINE_HEIGHT) * pxPerPt;
  const font: CSSProperties = {
    fontFamily: EDITOR_FONT_STACK,
    fontSize,
    lineHeight: `${lineHeight}px`,
    color: object.color,
    letterSpacing: 0,
    fontWeight: 400,
    fontStyle: 'normal',
  };
  const position: CSSProperties = {
    position: 'absolute',
    left: `${object.box.xPct * 100}%`,
    top: `${object.box.yPct * 100}%`,
    width: `${object.box.wPct * 100}%`,
  };
  const missing = (layout?.missing.length ?? 0) > 0;
  const browserFlow: CSSProperties = {
    ...font,
    whiteSpace: 'pre-wrap',
    unicodeBidi: 'plaintext',
    textAlign: 'start',
    overflowWrap: 'anywhere',
  };

  if (editing) {
    return (
      <div style={{ ...position, zIndex: 10 }}>
        <TextArea editing={editing} style={browserFlow} placeholder={t('textPlaceholder')} label={t('tools.text')} />
      </div>
    );
  }

  // Left empty for the next person (Fill again): a dashed "Type here" shows where it is
  if (object.text === '') {
    return (
      <div
        {...hitProps}
        style={{
          ...position,
          minHeight: lineHeight,
          pointerEvents: interactive ? 'auto' : 'none',
          touchAction: 'none',
          cursor: interactive ? 'text' : undefined,
          userSelect: 'none',
        }}
      >
        <div
          className="rounded-sm bg-orange-50/60 outline-1 outline-offset-1 outline-[#FF6B35] outline-dashed"
          style={{ ...font, color: '#9CA3AF', minHeight: lineHeight, whiteSpace: 'nowrap', overflow: 'hidden' }}
        >
          {t('textPlaceholder')}
        </div>
      </div>
    );
  }

  const engineLines = layout && !missing;
  const height = engineLines ? layout.height * pxPerPt : undefined;

  return (
    <div
      {...hitProps}
      style={{
        ...position,
        height: height ?? `${object.box.hPct * 100}%`,
        minHeight: lineHeight,
        pointerEvents: interactive ? 'auto' : 'none',
        touchAction: 'none',
        cursor: interactive ? 'move' : undefined,
        userSelect: 'none',
      }}
    >
      {engineLines ? (
        layout.lines.map((line, i) => (
          <div
            key={i}
            dir={line.direction}
            style={{
              ...font,
              position: 'absolute',
              top: i * lineHeight,
              left: line.x * pxPerPt,
              width: line.width * pxPerPt,
              height: lineHeight,
              whiteSpace: 'pre',
              textAlign: 'start',
            }}
          >
            {line.text}
          </div>
        ))
      ) : (
        <div dir="auto" style={browserFlow}>
          {object.text}
        </div>
      )}
      {missing && (
        <p
          className="absolute start-0 top-full mt-1 w-max max-w-[16rem] rounded-md bg-amber-50 px-2 py-1 text-xs leading-snug text-amber-800 shadow-sm ring-1 ring-amber-200"
          style={{ minWidth: '100%' }}
        >
          {t('textAsImage')}
        </p>
      )}
    </div>
  );
}
