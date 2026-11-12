'use client';

/**
 * The document stamps on the page on screen (workspace-spec.md 4.7), placed
 * by the same functions the export uses (lib/edit-pdf/model.ts:
 * pageNumberOrigin, watermarkPlacements, watermarkImageSize) inside the
 * page's visible box, its crop. Text is laid out by the engine (TextEngine,
 * Cairo, line height as the PDF's) and drawn in EDITOR_FONT_FAMILY: a text
 * watermark is not wrapped and its lines are centred, as stamps.ts draws
 * them; the page number's box starts at pageNumberOrigin. CSS rotates
 * clockwise with y down, so a watermark's angle (counter-clockwise for the
 * reader) is rotate(-angle). Image watermarks stay upright. Never takes the
 * pointer.
 */
import { memo, type CSSProperties } from 'react';
import {
  LETTERHEAD_FOOTER_SIZE,
  LETTERHEAD_NAME_SIZE,
  LETTERHEAD_RULE_COLOR,
  LETTERHEAD_TEXT_SIZE,
  LETTERHEAD_MARGIN_PT,
  WATERMARK_COLOR,
  letterheadFooterWidth,
  letterheadPlacement,
  letterheadSideWidth,
  splitLetterheadText,
  pageNumberOrigin,
  pageNumberText,
  visibleSize,
  watermarkImageSize,
  watermarkPlacements,
  type DocStamps,
  type EditorPage,
  type LetterheadPlacement,
  type LetterheadStamp,
  type PageSize,
  type SourcePageInfo,
  type TextBoxLayout,
} from '@/lib/edit-pdf';
import { EDITOR_FONT_STACK } from './TextBox';

interface StampPreviewProps {
  stamps: DocStamps | undefined;
  page: EditorPage;
  sourcePages: readonly SourcePageInfo[];
  /** This page's place among the doc's pages, for its number. */
  outputIndex: number;
  outputCount: number;
  /** CSS px per point on this page. */
  pxPerPt: number;
  /** The engine's layout of a text at a size, wrapped to `width` (unwrapped without); null until the engine and its font are ready. */
  layoutFor: (text: string, size: number, width?: number) => TextBoxLayout | null;
  /** The image watermark's picture and its size in pixels. */
  image?: { url: string; width: number; height: number };
  /** The letterhead's logo and its size in pixels. */
  logo?: { url: string; width: number; height: number };
}

/**
 * The engine's lines in a box `width` wide, each centred or from the start, as stamps.ts draws them.
 * 'left' and 'right' are the letterhead's sides: as stamps.ts drawBlock, the
 * first line's direction picks start or end, and each line aligns by its own.
 */
function Lines({
  layout,
  width,
  pxPerPt,
  size,
  color,
  align,
  firstRtl = layout.lines[0]?.direction === 'rtl',
}: {
  layout: TextBoxLayout;
  width: number;
  pxPerPt: number;
  size: number;
  color: string;
  align: 'center' | 'start' | 'left' | 'right';
  /** The block's first line: it picks start or end for the whole block (stamps.ts drawBlock). */
  firstRtl?: boolean;
}) {
  const lineHeight = layout.lineHeight * pxPerPt;
  const offset = (lineWidth: number, rtl: boolean) => {
    if (align === 'center') return (width - lineWidth) / 2;
    if (align === 'start') return 0;
    const start = (align === 'left') !== firstRtl;
    return start !== rtl ? 0 : width - lineWidth;
  };
  return (
    <>
      {layout.lines.map((line, i) => (
        <div
          key={i}
          dir={line.direction}
          style={{
            position: 'absolute',
            top: i * lineHeight,
            left: offset(line.width, line.direction === 'rtl') * pxPerPt,
            width: line.width * pxPerPt,
            height: lineHeight,
            fontFamily: EDITOR_FONT_STACK,
            fontSize: size * pxPerPt,
            lineHeight: `${lineHeight}px`,
            color,
            whiteSpace: 'pre',
            textAlign: 'start',
          }}
        >
          {line.text}
        </div>
      ))}
    </>
  );
}

/** One run of a letterhead block at one size, as stamps.ts LetterheadPart. */
interface PreviewPart {
  size: number;
  layout: TextBoxLayout;
}

export interface PreviewLetterhead {
  placed: LetterheadPlacement;
  left: PreviewPart[];
  right: PreviewPart[];
  footer: PreviewPart[];
}

/**
 * The letterhead on a page of this size, laid out as stamps.ts
 * letterheadLayout does: each side's name then details, wrapped to the
 * side's width, laid out again at a smaller scale when the placement says.
 * null until the engine can lay text out. The workspace also uses it for the
 * page's room (letterheadRoom).
 */
export function previewLetterhead(
  stamp: LetterheadStamp,
  visible: PageSize,
  logo: PageSize | undefined,
  layoutFor: (text: string, size: number, width?: number) => TextBoxLayout | null,
): PreviewLetterhead | null {
  const side = letterheadSideWidth(visible, logo);
  const inner = letterheadFooterWidth(visible);
  let ready = true;
  const parts = (text: string, column: number, sideBlock: boolean, scale: number): PreviewPart[] => {
    const { name, details } = sideBlock ? splitLetterheadText(text) : { name: '', details: text.trim() };
    const list: PreviewPart[] = [];
    const add = (t: string, size: number) => {
      const layout = layoutFor(t, size, column);
      if (layout) list.push({ size, layout });
      else ready = false;
    };
    if (name) add(name, LETTERHEAD_NAME_SIZE * scale);
    if (details) add(details, (sideBlock ? LETTERHEAD_TEXT_SIZE : LETTERHEAD_FOOTER_SIZE) * scale);
    return list;
  };
  const measure = (list: PreviewPart[]) =>
    list.length === 0
      ? undefined
      : { width: Math.max(...list.map((p) => Math.max(0, ...p.layout.lines.map((l) => l.width)))), height: list.reduce((h, p) => h + p.layout.height, 0) };
  const base = { left: parts(stamp.left, side, true, 1), right: parts(stamp.right, side, true, 1), footer: parts(stamp.footer, inner, false, 1) };
  if (!ready) return null;
  const placed = letterheadPlacement(visible, { left: measure(base.left), right: measure(base.right), footer: measure(base.footer), logo });
  const final = (list: PreviewPart[], box: LetterheadPlacement['left'], text: string, column: number, sideBlock: boolean) =>
    !box ? [] : box.scale === 1 ? list : parts(text, column, sideBlock, box.scale);
  return {
    placed,
    left: final(base.left, placed.left, stamp.left, side, true),
    right: final(base.right, placed.right, stamp.right, side, true),
    footer: final(base.footer, placed.footer, stamp.footer, inner, false),
  };
}

function StampPreviewImpl({ stamps, page, sourcePages, outputIndex, outputCount, pxPerPt, layoutFor, image, logo }: StampPreviewProps) {
  const watermark = stamps?.watermark;
  const numbers = stamps?.pageNumbers;
  const letterhead = stamps?.letterhead && (stamps.letterhead.pages === 'all' || outputIndex === 0) ? stamps.letterhead : undefined;
  if (!watermark && !numbers && !letterhead) return null;

  const visible = visibleSize(page, sourcePages);
  const crop = page.crop ?? { xPct: 0, yPct: 0, wPct: 1, hPct: 1 };
  const frame: CSSProperties = {
    left: `${crop.xPct * 100}%`,
    top: `${crop.yPct * 100}%`,
    width: `${crop.wPct * 100}%`,
    height: `${crop.hPct * 100}%`,
  };

  let marks: React.ReactNode = null;
  if (watermark?.type === 'text') {
    const layout = layoutFor(watermark.text, watermark.size);
    if (layout) {
      const w = Math.max(0, ...layout.lines.map((l) => l.width));
      const h = layout.height;
      marks = watermarkPlacements(watermark, visible, w, h).map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: (p.cx - w / 2) * pxPerPt,
            top: (p.cy - h / 2) * pxPerPt,
            width: w * pxPerPt,
            height: h * pxPerPt,
            transform: p.angle ? `rotate(${-p.angle}deg)` : undefined,
            opacity: watermark.opacity,
          }}
        >
          <Lines layout={layout} width={w} pxPerPt={pxPerPt} size={watermark.size} color={WATERMARK_COLOR} align="center" />
        </div>
      ));
    }
  } else if (watermark?.type === 'image' && image) {
    const size = watermarkImageSize(image, visible);
    marks = watermarkPlacements(watermark, visible, size.width, size.height).map((p, i) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={i}
        src={image.url}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: (p.cx - size.width / 2) * pxPerPt,
          top: (p.cy - size.height / 2) * pxPerPt,
          width: size.width * pxPerPt,
          height: size.height * pxPerPt,
          maxWidth: 'none',
          opacity: watermark.opacity,
        }}
      />
    ));
  }

  let number: React.ReactNode = null;
  if (numbers) {
    const text = pageNumberText(numbers, outputIndex, outputCount);
    const layout = layoutFor(text, numbers.size);
    if (layout) {
      const w = Math.max(0, ...layout.lines.map((l) => l.width));
      const o = pageNumberOrigin(numbers.position, visible, w, layout.height);
      number = (
        <div style={{ position: 'absolute', left: o.x * pxPerPt, top: o.y * pxPerPt, width: w * pxPerPt, height: layout.height * pxPerPt }}>
          <Lines layout={layout} width={w} pxPerPt={pxPerPt} size={numbers.size} color="#000000" align="start" />
        </div>
      );
    }
  }

  let head: React.ReactNode = null;
  const laid = letterhead ? previewLetterhead(letterhead, visible, letterhead.logoAssetId ? logo : undefined, layoutFor) : null;
  if (laid) {
    const { placed } = laid;
    // A block's parts stacked from the top of its column, as stamps.ts drawBlock
    const block = (list: PreviewPart[], box: LetterheadPlacement['left'], align: 'left' | 'right' | 'center', key: string) => {
      if (!box || list.length === 0) return null;
      let y = 0;
      return (
        <div key={key} style={{ position: 'absolute', left: box.x * pxPerPt, top: box.y * pxPerPt, width: box.w * pxPerPt, height: box.h * pxPerPt }}>
          {list.map((part, i) => {
            const top = y;
            y += part.layout.height;
            return (
              <div key={i} style={{ position: 'absolute', left: 0, top: top * pxPerPt, width: box.w * pxPerPt, height: part.layout.height * pxPerPt }}>
                <Lines layout={part.layout} width={box.w} pxPerPt={pxPerPt} size={part.size} color="#000000" align={align} firstRtl={list[0].layout.lines[0]?.direction === 'rtl'} />
              </div>
            );
          })}
        </div>
      );
    };
    const rule = (y: number | null, key: string) =>
      y === null ? null : (
        <div
          key={key}
          style={{
            position: 'absolute',
            left: LETTERHEAD_MARGIN_PT * pxPerPt,
            width: (visible.width - 2 * LETTERHEAD_MARGIN_PT) * pxPerPt,
            top: (y - 0.375) * pxPerPt,
            height: Math.max(1, 0.75 * pxPerPt),
            background: LETTERHEAD_RULE_COLOR,
          }}
        />
      );
    head = (
      <>
        {block(laid.left, placed.left, 'left', 'left')}
        {block(laid.right, placed.right, 'right', 'right')}
        {block(laid.footer, placed.footer, 'center', 'footer')}
        {placed.logo && logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo.url}
            alt=""
            draggable={false}
            style={{ position: 'absolute', left: placed.logo.x * pxPerPt, top: placed.logo.y * pxPerPt, width: placed.logo.w * pxPerPt, height: placed.logo.h * pxPerPt, maxWidth: 'none' }}
          />
        )}
        {rule(placed.headerRule, 'headerRule')}
        {rule(placed.footerRule, 'footerRule')}
      </>
    );
  }

  return (
    <div className="pointer-events-none absolute overflow-hidden select-none" style={frame} aria-hidden="true">
      {marks}
      {head}
      {number}
    </div>
  );
}

export const StampPreview = memo(StampPreviewImpl);
