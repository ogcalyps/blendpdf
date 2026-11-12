/**
 * Write the lib/pdf-text golden corpus as a review sheet, for checking the
 * engine in real renderers (PDFium, Quartz, Acrobat...) by eye.
 *
 *   npx tsx scripts/pdf-text-sheet.ts /path/to/sheet.pdf
 *
 * Page 1: every corpus entry, its id in grey on the left.
 * Page 2: a page with /Rotate 90; the text must read upright.
 * Page 3: alignment (start, center, end) in LTR and RTL boxes, and colour.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { drawTextBox, embedTextFont, layoutText, uprightTransform } from '../lib/pdf-text';
import { CORPUS, DEFAULT_WIDTH, FONT_SIZE } from '../tests/helpers/pdf-text-corpus';

async function main(out: string) {
  const fontBytes = new Uint8Array(readFileSync(join(__dirname, '..', 'public', 'fonts', 'Cairo-Regular.ttf')));
  const doc = await PDFDocument.create();
  const font = await embedTextFont(doc, fontBytes);
  const grey = rgb(0.55, 0.55, 0.55);
  const left = 150;
  const width = DEFAULT_WIDTH;

  // Page 1: the corpus.
  const pageWidth = left + width + 30;
  const heights = CORPUS.map(
    (entry) => layoutText(font.font, entry.text, { size: FONT_SIZE, maxWidth: entry.width ?? width, direction: entry.direction }).height + 10,
  );
  const page = doc.addPage([pageWidth, heights.reduce((a, b) => a + b, 0) + 60]);
  let top = page.getHeight() - 30;
  CORPUS.forEach((entry, i) => {
    drawTextBox(page, font, entry.id, { size: 8, width: left - 30, color: grey, transform: uprightTransform(20, top - 6) });
    drawTextBox(page, font, entry.text, { size: FONT_SIZE, width: entry.width ?? width, direction: entry.direction, transform: uprightTransform(left, top) });
    page.drawLine({ start: { x: 20, y: top - heights[i] + 4 }, end: { x: pageWidth - 20, y: top - heights[i] + 4 }, thickness: 0.3, color: grey });
    top -= heights[i];
  });

  // Page 2: /Rotate 90. MediaBox is 300 wide x 600 tall; it displays 600 x 300.
  const rotated = doc.addPage([300, 600]);
  rotated.setRotation(degrees(90));
  const lines = ['المبلغ: ٤٥٠٫٧٥ ريال (شامل الضريبة ١٥٪)', 'Hello (world)! Rotate 90 reads upright.'];
  lines.forEach((text, i) => {
    // Displayed top-left corner of the box at (40, 40 + 60i): on a /Rotate 90 page that is page point (40 + 60i, 40).
    drawTextBox(rotated, font, text, { size: 20, width: 520, transform: uprightTransform(40 + 60 * i, 40, 90) });
  });

  // Page 3: alignment and colour.
  const align = doc.addPage([pageWidth, 420]);
  const boxes: Array<{ text: string; align: 'start' | 'center' | 'end' }> = [
    { text: 'LTR start: Welcome to BlendPDF', align: 'start' },
    { text: 'LTR center: Welcome to BlendPDF', align: 'center' },
    { text: 'LTR end: Welcome to BlendPDF', align: 'end' },
    { text: 'بداية السطر: مرحبا بكم في BlendPDF', align: 'start' },
    { text: 'في المنتصف: مرحبا بكم في BlendPDF', align: 'center' },
    { text: 'نهاية السطر: مرحبا بكم في BlendPDF', align: 'end' },
  ];
  boxes.forEach((box, i) => {
    const y = 400 - i * 50;
    align.drawRectangle({ x: left, y: y - 34, width, height: 34, borderColor: grey, borderWidth: 0.5 });
    drawTextBox(align, font, box.text, { size: 16, width, align: box.align, transform: uprightTransform(left, y) });
  });
  drawTextBox(align, font, 'هذا النص باللون الأحمر (Red)', { size: 16, width, color: rgb(0.8, 0.1, 0.1), transform: uprightTransform(left, 90) });

  writeFileSync(out, await doc.save());
  console.log(`wrote ${out}`);
}

const out = process.argv[2];
if (!out) {
  console.error('usage: npx tsx scripts/pdf-text-sheet.ts <out.pdf>');
  process.exit(1);
}
main(out).catch((error) => {
  console.error(error);
  process.exit(1);
});
