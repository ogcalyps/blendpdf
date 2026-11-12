'use client';

/**
 * The small bar that floats over the selected object. At most four controls:
 *   text                      Color, Smaller/Bigger, Edit text, Delete
 *   changed line (replace)    Color, Smaller/Bigger, Edit text, Keep the original,
 *                             plus the note on what saving does
 *   shape, line, arrow, ink   Color, Smaller/Bigger (stroke), Delete
 *   image, signature,
 *   highlight                 Delete
 *   cover                     Delete, plus the "what's underneath is still in the file" note
 * Color opens the six fixed swatches; none is checked while a changed line
 * keeps its original colour and that colour is not one of them.
 */
import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AArrowDown, AArrowUp, Minus, Palette, Plus, RotateCcw, SquarePen, Trash2 } from 'lucide-react';
import { PALETTE, type EditorObject, type PaletteColor } from '@/lib/edit-pdf';

interface MiniBarProps {
  object: EditorObject;
  canShrink: boolean;
  canGrow: boolean;
  onColor: (color: PaletteColor) => void;
  onSize: (direction: 1 | -1) => void;
  onEdit: () => void;
  onDelete: () => void;
  style?: CSSProperties;
}

function BarButton({
  label,
  onClick,
  children,
  disabled,
  onBlocked,
  pressed,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  /** A tap while disabled: say why. */
  onBlocked?: () => void;
  pressed?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-pressed={pressed}
      onClick={() => {
        if (disabled) onBlocked?.();
        else onClick();
      }}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35] ${
        disabled
          ? 'cursor-not-allowed text-gray-300'
          : pressed
            ? 'bg-orange-50 text-[#E85A2B]'
            : danger
              ? 'text-gray-700 hover:bg-red-50 hover:text-red-600'
              : 'text-gray-700 hover:bg-orange-50 hover:text-[#E85A2B]'
      }`}
    >
      {children}
    </button>
  );
}

const COLOR_KEYS: Record<PaletteColor, 'black' | 'blue' | 'red' | 'green' | 'orange' | 'white'> = {
  '#000000': 'black',
  '#1D4ED8': 'blue',
  '#DC2626': 'red',
  '#15803D': 'green',
  '#FF6B35': 'orange',
  '#FFFFFF': 'white',
};

export const MiniBar = forwardRef<HTMLDivElement, MiniBarProps>(function MiniBar(
  { object, canShrink, canGrow, onColor, onSize, onEdit, onDelete, style },
  ref,
) {
  const t = useTranslations('editPdf');
  const [swatchesOpen, setSwatchesOpen] = useState(false);
  // Why a dimmed size button did nothing, shown in the bar for 3 s.
  const [reason, setReason] = useState<string | null>(null);
  const reasonTimer = useRef<number | undefined>(undefined);
  const explain = (text: string) => {
    setReason(text);
    window.clearTimeout(reasonTimer.current);
    reasonTimer.current = window.setTimeout(() => setReason(null), 3000);
  };
  useEffect(() => () => window.clearTimeout(reasonTimer.current), []);
  const colorName = (color: PaletteColor) => {
    switch (COLOR_KEYS[color]) {
      case 'black':
        return t('colors.black');
      case 'blue':
        return t('colors.blue');
      case 'red':
        return t('colors.red');
      case 'green':
        return t('colors.green');
      case 'orange':
        return t('colors.orange');
      default:
        return t('colors.white');
    }
  };

  const isReplace = object.kind === 'replace';
  const colored = object.kind === 'text' || isReplace || object.kind === 'shape' || object.kind === 'line' || object.kind === 'ink';
  const current: string | null = colored ? object.color : null;
  const isText = object.kind === 'text' || isReplace;
  const matches = (color: PaletteColor) => current !== null && color.toLowerCase() === current.toLowerCase();

  return (
    <div
      ref={ref}
      style={style}
      // Taps on the bar must not reach the page (which would deselect or start a gesture).
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-20 flex w-max max-w-[calc(100vw-2rem)] flex-col items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-lg"
    >
      <div className="flex items-center gap-0.5">
        {colored && (
          <BarButton label={t('mini.color')} onClick={() => setSwatchesOpen((open) => !open)} pressed={swatchesOpen}>
            <span className="relative inline-flex">
              <Palette className="h-5 w-5" />
              <span
                className="absolute -bottom-1 -end-1 h-2.5 w-2.5 rounded-full ring-1 ring-gray-300"
                style={{ background: current ?? undefined }}
              />
            </span>
          </BarButton>
        )}
        {colored && (
          <div className="flex items-center rounded-lg bg-gray-50">
            <BarButton
              label={t('mini.smaller')}
              onClick={() => onSize(-1)}
              disabled={!canShrink}
              onBlocked={() => explain(t('disabled.smaller'))}
            >
              {isText ? <AArrowDown className="h-5 w-5" /> : <Minus className="h-5 w-5" />}
            </BarButton>
            <BarButton
              label={t('mini.bigger')}
              onClick={() => onSize(1)}
              disabled={!canGrow}
              onBlocked={() => explain(t('disabled.bigger'))}
            >
              {isText ? <AArrowUp className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </BarButton>
          </div>
        )}
        {isText && (
          <BarButton label={t('mini.edit')} onClick={onEdit}>
            <SquarePen className="h-5 w-5" />
          </BarButton>
        )}
        {isReplace ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-gray-700 transition hover:bg-orange-50 hover:text-[#E85A2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
          >
            <RotateCcw className="h-4 w-4 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
            <span className="whitespace-nowrap">{t('replace.keepOriginal')}</span>
          </button>
        ) : (
          <BarButton label={t('mini.delete')} onClick={onDelete} danger>
            <Trash2 className="h-5 w-5" />
          </BarButton>
        )}
      </div>

      {colored && swatchesOpen && (
        <div role="radiogroup" aria-label={t('mini.color')} className="flex items-center gap-0.5 border-t border-gray-100 pt-1">
          {PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={matches(color)}
              aria-label={colorName(color)}
              title={colorName(color)}
              onClick={() => {
                onColor(color);
                setSwatchesOpen(false);
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B35]"
            >
              <span
                className={`h-7 w-7 rounded-full ${
                  matches(color) ? 'ring-2 ring-[#FF6B35] ring-offset-2' : color === '#FFFFFF' ? 'ring-1 ring-gray-300' : ''
                }`}
                style={{ background: color }}
              />
            </button>
          ))}
        </div>
      )}

      {reason && (
        <p className="max-w-[15rem] px-2 pb-1 text-center text-xs leading-snug text-gray-500" role="status">
          {reason}
        </p>
      )}

      {object.kind === 'cover' && (
        <p className="max-w-[15rem] px-2 pb-1 text-center text-xs leading-snug text-gray-600">{t('coverNote')}</p>
      )}

      {isReplace && (
        <p className="max-w-[18rem] px-2 pb-1 text-center text-xs leading-snug text-gray-600">{t('replace.note')}</p>
      )}
    </div>
  );
});
