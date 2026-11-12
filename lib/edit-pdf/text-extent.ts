/**
 * Where a page's text sits, for the letterhead's room (model.ts
 * letterheadRoom): its topmost and bottommost text in points from the
 * visible top (y down), the page turned by its own /Rotate as pdf.js shows
 * it, or null for a page without text (a scan: its picture is left alone).
 * Glyph tops and bottoms come from the font size (0.9 above the baseline,
 * 0.25 below): close enough to clear a rule. Pictures and drawn lines are
 * not counted.
 */
import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextExtent } from './types';

type Matrix = number[];

/** m1 · m2 as pdf.js Util.transform: m2 first, then m1. */
function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

export async function textExtentOf(page: Pick<PDFPageProxy, 'getViewport' | 'getTextContent'>): Promise<TextExtent | null> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  let top = Infinity;
  let bottom = -Infinity;
  for (const item of content.items) {
    if (!('str' in item) || item.str.trim() === '') continue;
    const [, , c, d, , f] = multiply(viewport.transform, item.transform);
    const size = Math.hypot(c, d);
    if (!(size > 0)) continue;
    top = Math.min(top, f - 0.9 * size);
    bottom = Math.max(bottom, f + 0.25 * size);
  }
  return Number.isFinite(top) ? { top: Math.max(0, top), bottom: Math.min(viewport.height, bottom) } : null;
}
