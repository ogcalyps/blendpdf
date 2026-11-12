/**
 * detectTextLines (lib/edit-pdf/lines.ts) on real files: Chrome (Skia) and
 * LibreOffice Arabic and English, a /Rotate 90 page with an offset CropBox,
 * a Form XObject, a slanted stamp, invisible (OCR-layer) text. pdf.js 3.11's
 * legacy build runs in Node with its OPS table injected; the box is checked
 * against pdf.js's own viewport, never against lib/pdf-geometry.
 * Fixtures: tests/fixtures/edit-pdf/replace (synthetic, from the Phase C spike).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, TextRenderingMode, rgb, setTextRenderingMode } from 'pdf-lib';
import { detectTextLines } from '../lib/edit-pdf';
import type { DetectedTextPage, SourceTextLine } from '../lib/edit-pdf';

const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const FIXTURES = join(__dirname, 'fixtures', 'edit-pdf', 'replace');
const tasks: Array<{ destroy(): Promise<void> }> = [];
afterAll(async () => {
  await Promise.all(tasks.map((task) => task.destroy()));
});

async function openPage(bytes: Uint8Array, pageNumber = 1) {
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, verbosity: 0 });
  tasks.push(task);
  const doc = await task.promise;
  return doc.getPage(pageNumber);
}

const fixture = (name: string) => new Uint8Array(readFileSync(join(FIXTURES, name)));

async function detect(bytes: Uint8Array, pageNumber = 1): Promise<DetectedTextPage> {
  return detectTextLines(await openPage(bytes, pageNumber), pageNumber - 1, { ops: pdfjs.OPS });
}

/** What a prefill/source comparison ignores: presentation forms, controls, tatweel, runs of spaces. */
const norm = (s: string) => s.normalize('NFKC').replace(/[​-‏‪-‮⁦-⁩ـ]/g, '').replace(/\s+/g, ' ').trim();

/** Every line's prefill is either exactly one of the source lines, or empty with textUnsure: never confidently wrong. */
function scorePrefills(lines: SourceTextLine[], source: string[]) {
  const wanted = new Set(source.map(norm));
  const exact = lines.filter((line) => wanted.has(norm(line.text)));
  const unsure = lines.filter((line) => line.textUnsure);
  const wrong = lines.filter((line) => !line.textUnsure && !wanted.has(norm(line.text)));
  return { exact: exact.length, unsure: unsure.length, wrong: wrong.map((line) => line.text) };
}

const CHROME_ARABIC = [
  'إشعار تحديث الحساب', 'نشكركم على تعاملكم معنا خلال هذا العام.', 'تم تأكيد موعد التسوية رقم ٤٤٧١ يوم الثلاثاء القادم.',
  'يرجى إحضار نسخة موقعة من الاتفاقية وبطاقة الهوية إلى المكتب الرئيسي.', 'إذا كان في هذه الرسالة أي خطأ فراسلونا وسنصححه.',
  'المبلغ الإجمالي هو 250 دولار شاملا الضريبة عبر BlendPDF.', 'مع خالص التحية والتقدير.', 'البند', 'الكمية', 'السعر',
  'اشتراك سنوي', '١٢', '1,250.00', 'رسوم الخدمة', '3', '75.50',
];
const LIBREOFFICE_ARABIC = [
  'شركة النور للخدمات المالية', 'التاريخ: ١٥ أكتوبر ٢٠٢٦', 'السيد أحمد المحترم،',
  'تحية طيبة وبعد، نود إعلامكم بأن طلبكم رقم 4471 قد تمت الموافقة عليه بعد مراجعة المستندات المرفقة.',
  'سيتم تحويل المبلغ الإجمالي وقدره 1,250 ريال إلى حسابكم خلال ثلاثة أيام عمل.', 'نشكركم على ثقتكم بنا، ونتمنى لكم دوام التوفيق.',
  'وتفضلوا بقبول فائق الاحترام والتقدير.', 'المدير العام: خالد بن سعيد ____________',
];

describe('detectTextLines: prefills', () => {
  it('Chrome Arabic: 13 of 16 lines prefilled exactly, the 3 whose dots are separate glyphs start empty, none wrong', async () => {
    const { lines } = await detect(fixture('b-arabic-chrome.pdf'));
    expect(lines).toHaveLength(16);
    const score = scorePrefills(lines, CHROME_ARABIC);
    expect(score.wrong).toEqual([]);
    expect(score.exact).toBeGreaterThanOrEqual(13);
    expect(score.exact + score.unsure).toBe(16);
    expect(lines.find((l) => l.text.startsWith('المبلغ'))?.direction).toBe('rtl');
  });

  it('LibreOffice Arabic: 8 of 8 exact (lam-alef, Arabic-Indic dates, Latin numbers inside RTL)', async () => {
    const { lines } = await detect(fixture('c-arabic-letter.pdf'));
    expect(scorePrefills(lines, LIBREOFFICE_ARABIC)).toEqual({ exact: 8, unsure: 0, wrong: [] });
    expect(lines.every((l) => l.direction === 'rtl' && l.color === '#000000' && l.turn === 0 && !l.invisible)).toBe(true);
  });

  it("Chrome Times New Roman Arabic: letters its ToUnicode names by their Persian look-alikes come back Arabic", async () => {
    // Chrome writes the font's reverse cmap: heh as heh doachashmee (U+FBAD, U+06BE), yeh as Farsi yeh (U+FBFE/F).
    const { lines } = await detect(fixture('i-arabic-times-chrome.pdf'));
    expect(lines.map((l) => l.text)).toEqual([
      'شهادة عمل',
      'تشهد شركة الأطلس للتجارة بأن السيد محمد العلوي يعمل لديها بصفة محاسب منذ 1 يناير 2021.',
      'رقم البطاقة الوطنية: BK123456',
      'سلمت هذه الشهادة للمعني بالأمر بطلب منه لاستعمالها فيما يسمح به القانون.',
      'حرر بالدار البيضاء في 5 نوفمبر 2026',
    ]);
    expect(lines.every((l) => !l.textUnsure && l.direction === 'rtl')).toBe(true);
  });

  it('English: invoice lines read exactly, in reading order, with sequential ids', async () => {
    const { pageIndex, lines } = await detect(fixture('c-english-invoice.pdf'));
    expect(pageIndex).toBe(0);
    expect(lines.map((l) => l.id)).toEqual(lines.map((_, n) => `0:${n}`));
    expect(lines[0].text).toBe('Northwind Supplies Ltd.');
    expect(lines.map((l) => l.text)).toContain('Bank transfer to account 4471 0098 2231, sort code 20-44-71.');
    for (let i = 1; i < lines.length; i++) expect(lines[i].geometry.baseline).toBeLessThanOrEqual(lines[i - 1].geometry.baseline + 1e-6);
  });

  it('text inside a Form XObject is found where the form puts it', async () => {
    const { lines } = await detect(fixture('d1-form-xobject.pdf'));
    const line = lines.find((l) => l.text === 'Line two holds the secret code ORCHID-77 here.')!;
    expect(line).toBeDefined();
    // drawPage at (72, 450) scaled 1.2: the form's y = 140 baseline lands at 450 + 1.2 * 140.
    expect(line.geometry.baseline).toBeCloseTo(618, 1);
    expect(line.geometry.size).toBeCloseTo(14.4, 1);
  });
});

describe('detectTextLines: geometry', () => {
  it('splits table cells on one baseline into their own lines', async () => {
    const arabic = await detect(fixture('b-arabic-chrome.pdf'));
    const header = arabic.lines.filter((l) => ['البند', 'الكمية', 'السعر'].includes(l.text));
    expect(header).toHaveLength(3);
    expect(new Set(header.map((l) => l.geometry.baseline.toFixed(2))).size).toBe(1);
    const english = await detect(fixture('c-english-invoice.pdf'));
    const row = english.lines.filter((l) => Math.abs(l.geometry.baseline - 685.5) < 1);
    expect(row.map((l) => l.text)).toEqual(['Flour, 25 kg sack 4', '18.50', '74.00']);
  });

  it('lists the baselines of the lines above and below as neighbours (exact line spacing)', async () => {
    const { lines } = await detect(fixture('c4-english-tight.pdf'));
    // The second paragraph is set solid: 11 pt from baseline to baseline.
    const [first, second, third] = lines.slice(6, 9);
    expect(first.geometry.baseline - second.geometry.baseline).toBeCloseTo(11, 0);
    expect(second.geometry.neighbours).toContain(first.geometry.baseline);
    expect(second.geometry.neighbours).toContain(third.geometry.baseline);
    expect(second.geometry.neighbours).not.toContain(second.geometry.baseline);
    // The ink boxes overlap on this spacing: removal must go by baseline, never by rect.
    expect(first.geometry.rect.y).toBeLessThan(second.geometry.rect.y + second.geometry.rect.height);
  });

  it('a /Rotate 90 page with an offset CropBox: text drawn turned reads normally (turn 0), and the box is where pdf.js shows it', async () => {
    const page = await openPage(fixture('d2-rotate90-cropbox.pdf'));
    const { lines } = await detectTextLines(page, 0, { ops: pdfjs.OPS });
    expect(lines.map((l) => l.text)).toEqual([
      'Landscape report, first line stays.',
      'Second line carries invoice MANGO-310 for removal.',
      'Third line stays where it is.',
    ]);
    const viewport = page.getViewport({ scale: 1 });
    for (const line of lines) {
      expect(line.turn).toBe(0);
      expect([line.geometry.ux, line.geometry.uy]).toEqual([0, 1]);
      const { x, y, width, height } = line.geometry.rect;
      const [a, b, c, d] = viewport.convertToViewportRectangle([x, y, x + width, y + height]) as number[];
      const want = { xPct: Math.min(a, c) / viewport.width, yPct: Math.min(b, d) / viewport.height, wPct: Math.abs(c - a) / viewport.width, hPct: Math.abs(d - b) / viewport.height };
      for (const key of ['xPct', 'yPct', 'wPct', 'hPct'] as const) expect(line.box[key], `${line.text} ${key}`).toBeCloseTo(want[key], 6);
    }
  });

  it('a slanted stamp gets turn null; its colour is read from the fill', async () => {
    const { lines } = await detect(fixture('h-chrome-complex.pdf'));
    const stamp = lines.find((l) => l.text === 'ختم مائل')!;
    expect(stamp.turn).toBeNull();
    expect(stamp.color).toBe('#b91c1c');
    expect(lines.find((l) => l.text.startsWith('السطر الأخير'))?.color).toBe('#555555');
    // The shadowed lines (every glyph drawn twice) start empty.
    expect(lines.filter((l) => l.textUnsure).length).toBeGreaterThanOrEqual(2);
  });

  it('invisible text (render mode 3, the OCR layer of a scan) is flagged; visible text on the same page is not', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Visible heading stays visible', { x: 72, y: 700, size: 14, font, color: rgb(0.86, 0.15, 0.15) });
    page.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
    page.drawText('Hidden OCR words under a scan', { x: 72, y: 600, size: 12, font });
    const { lines } = await detect(await doc.save());
    expect(lines.map((l) => [l.text, l.invisible])).toEqual([
      ['Visible heading stays visible', false],
      ['Hidden OCR words under a scan', true],
    ]);
    expect(lines[0].color).toBe('#db2626');
  });

  it('takes the page\'s main direction for a line of only digits (a number cell in an Arabic table)', async () => {
    const { lines } = await detect(fixture('b-arabic-chrome.pdf'));
    expect(lines.find((l) => l.text === '1,250.00')?.direction).toBe('rtl');
  });

  it('runs in tens of milliseconds a page', async () => {
    const page = await openPage(fixture('h-chrome-complex.pdf'));
    await page.getOperatorList(); // the editor has already rendered the page
    const start = performance.now();
    await detectTextLines(page, 0, { ops: pdfjs.OPS });
    const ms = performance.now() - start;
    console.log(`detectTextLines h-chrome-complex: ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(500);
  });
});
