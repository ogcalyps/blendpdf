/**
 * Signatures and stamps: the paper made see-through on an uploaded photo or
 * scan (lib/clear-paper), and the ones kept on this device (lib/saved-marks).
 */
import { describe, expect, it } from 'vitest';
import { clearPaper } from '../lib/clear-paper';
import { MAX_SAVED_MARKS, parseSavedMarks, withMark } from '../lib/saved-marks';

/** A w x h picture of `paper` grey with an `ink` square in the middle (a third of each side). */
function picture(w: number, h: number, paper: [number, number, number], ink: [number, number, number], alpha = 255) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = x >= w / 3 && x < (2 * w) / 3 && y >= h / 3 && y < (2 * h) / 3;
      const [r, g, b] = inside ? ink : paper;
      px.set([r, g, b, alpha], (y * w + x) * 4);
    }
  }
  return px;
}
const alphaAt = (px: Uint8ClampedArray, w: number, x: number, y: number) => px[(y * w + x) * 4 + 3];

describe('clearPaper', () => {
  it('white paper goes, the ink stays fully opaque and keeps its colour (a blue stamp)', () => {
    const px = picture(30, 30, [248, 248, 246], [30, 60, 170]);
    expect(clearPaper(px, 30, 30)).toBe(true);
    expect(alphaAt(px, 30, 1, 1)).toBe(0);
    expect(alphaAt(px, 30, 15, 15)).toBe(255);
    expect([...px.slice((15 * 30 + 15) * 4, (15 * 30 + 15) * 4 + 3)]).toEqual([30, 60, 170]);
  });

  it('greyish paper from a phone photo goes too', () => {
    const px = picture(30, 30, [196, 194, 190], [40, 40, 40]);
    expect(clearPaper(px, 30, 30)).toBe(true);
    expect(alphaAt(px, 30, 0, 29)).toBe(0);
    expect(alphaAt(px, 30, 15, 15)).toBe(255);
  });

  it('a faint edge fades, with the paper taken back out of its colour', () => {
    // Ink mixed 50/50 with white paper: luma ~ 255 - 45 = 210, between paper and ink
    const px = picture(30, 30, [255, 255, 255], [210, 210, 210]);
    clearPaper(px, 30, 30);
    const a = alphaAt(px, 30, 15, 15);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
    expect(px[(15 * 30 + 15) * 4]).toBeLessThan(210);
  });

  it('leaves alone a picture that already has transparency, and one with dark edges', () => {
    const transparent = picture(30, 30, [255, 255, 255], [0, 0, 0], 0);
    expect(clearPaper(transparent, 30, 30)).toBe(false);
    const dark = picture(30, 30, [40, 40, 40], [250, 250, 250]);
    const before = dark.slice();
    expect(clearPaper(dark, 30, 30)).toBe(false);
    expect(dark).toEqual(before);
  });
});

describe('saved marks', () => {
  const png = (n: number) => `data:image/png;base64,${'A'.repeat(n)}`;

  it('newest first, a repeat moves up instead of doubling, never more than MAX_SAVED_MARKS', () => {
    let marks = withMark([], png(1), 'a');
    marks = withMark(marks, png(2), 'b');
    marks = withMark(marks, png(1), 'c');
    expect(marks.map((m) => m.id)).toEqual(['c', 'b']);
    for (let i = 3; i < 10; i++) marks = withMark(marks, png(i), `x${i}`);
    expect(marks).toHaveLength(MAX_SAVED_MARKS);
    expect(marks[0].dataUrl).toBe(png(9));
  });

  it('reads back only valid PNG entries', () => {
    expect(parseSavedMarks(null)).toEqual([]);
    expect(parseSavedMarks('nope')).toEqual([]);
    expect(parseSavedMarks(JSON.stringify({ id: 'a' }))).toEqual([]);
    const good = { id: 'a', dataUrl: png(4) };
    expect(parseSavedMarks(JSON.stringify([good, { id: 'b', dataUrl: 'data:image/svg+xml;base64,AAAA' }, { id: 3, dataUrl: png(1) }]))).toEqual([good]);
    expect(parseSavedMarks(JSON.stringify([{ id: 'big', dataUrl: png(2_000_000) }]))).toEqual([]);
  });
});
