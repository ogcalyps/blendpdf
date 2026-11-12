/**
 * A photo or scan of a signature or a stamp, with its paper made see-through,
 * so it can sit on a page without a white box hiding the text under it.
 *
 * The paper's brightness is read from the picture's edges (the median of the
 * border pixels: a stamp rarely touches all four sides). Pixels about that
 * bright become transparent, ink at least INK_GAP darker stays fully
 * opaque, and the band between fades, so edges stay smooth. Ink keeps its
 * colour (blue, purple and red stamps stay blue, purple and red).
 *
 * Left alone: a picture that already has transparency, and one whose edges
 * are dark (not paper: a photo, a logo on a dark background).
 */

/** Brightness 0..255 (Rec. 601). */
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Within this much of the paper's brightness: paper. */
const PAPER_GAP = 25;
/** This much darker than the paper or more: ink. */
const INK_GAP = 70;
/** Edges darker than this are not paper. */
const MIN_PAPER = 140;

/** True when it changed the pixels (RGBA, row by row). */
export function clearPaper(pixels: Uint8ClampedArray, width: number, height: number): boolean {
  if (width < 3 || height < 3) return false;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 250) return false;

  const border: number[] = [];
  const at = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    border.push(luma(pixels[i], pixels[i + 1], pixels[i + 2]));
  };
  const step = Math.max(1, Math.floor(Math.max(width, height) / 400));
  for (let x = 0; x < width; x += step) {
    at(x, 0);
    at(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    at(0, y);
    at(width - 1, y);
  }
  border.sort((a, b) => a - b);
  const paper = border[Math.floor(border.length / 2)];
  if (paper < MIN_PAPER) return false;

  for (let i = 0; i < pixels.length; i += 4) {
    const darker = paper - luma(pixels[i], pixels[i + 1], pixels[i + 2]);
    const ink = Math.min(1, Math.max(0, (darker - PAPER_GAP) / (INK_GAP - PAPER_GAP)));
    pixels[i + 3] = Math.round(255 * ink);
    // A faint edge pixel is ink mixed with paper: take the paper back out, so edges don't keep a pale halo
    if (ink > 0 && ink < 1) {
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.max(0, Math.min(255, Math.round(paper + (pixels[i + c] - paper) / ink)));
    }
  }
  return true;
}
