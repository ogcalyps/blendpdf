import type { ComparisonShot } from './types';

/**
 * Changing a line: the top of the saved Arabic test page, rendered at 2x from
 * each file (the original, ours, and theirs when we have a result we trust).
 * On phones, the right part of the page only (where Arabic lines start), its
 * cut side faded so it doesn't look like the edge of the page.
 */
export function editShots(them?: string): ComparisonShot[] {
  const shot = (key: ComparisonShot['key'], name: string): ComparisonShot => ({
    key,
    src: `/compare/edit-${name}.webp`,
    width: 1190,
    height: 170,
    phone: { src: `/compare/edit-${name}-phone.webp`, width: 750, height: 170 },
  });
  return [shot('original', 'original'), shot('blendpdf', 'blendpdf'), ...(them ? [shot('them', them)] : [])];
}

/** Adding a line: the part of each saved page where the new words went, readable on a phone as it is. */
export function addShots(them: string): ComparisonShot[] {
  const shot = (key: ComparisonShot['key'], name: string): ComparisonShot => ({ key, src: `/compare/add-${name}.webp`, width: 750, height: 180 });
  return [shot('blendpdf', 'blendpdf'), shot('them', them)];
}
