/**
 * The client modules moved out of the tool pages (workspace-spec.md 5.5):
 * lib/extract-text (pdf-to-text), lib/extract-images (extract-images) and
 * lib/pdf-cleanup (remove-metadata), directly and through runSave. pdf.js is
 * 3.11 in Node; the page's canvas is node-canvas with a toBlob shim.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';
import { createCanvas, ImageData as NodeImageData } from 'canvas';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
import { extractText } from '../lib/extract-text';
import { extractImages } from '../lib/extract-images';
import { removeMetadata } from '../lib/pdf-cleanup';
import { runSave } from '../lib/workspace/save';
import { summarizeDoc } from '../lib/workspace/summary';
import { DEFAULT_SAVE_PLAN } from '../lib/workspace/types';
import type { SaveInput, SavePlan } from '../lib/workspace/types';

vi.mock('@/lib/pdfjs-init', async () => {
  const { createRequire } = await import('node:module');
  const pdfjs = createRequire(import.meta.url)('pdfjs-dist/legacy/build/pdf.js');
  return { getPdfJs: async () => pdfjs, initializePdfJsWorker: async () => pdfjs };
});

/** The browser bits extract-images uses: a canvas with toBlob, ImageData, and the analytics window. */
function installBrowser() {
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag !== 'canvas') throw new Error(`unexpected element ${tag}`);
      const canvas = createCanvas(1, 1) as ReturnType<typeof createCanvas> & { toBlob?: unknown };
      canvas.toBlob = (done: (blob: Blob) => void, type: string) => done(new Blob([canvas.toBuffer('image/png') as BlobPart], { type }));
      return canvas;
    },
  });
  vi.stubGlobal('ImageData', NodeImageData);
  vi.stubGlobal('window', { location: { pathname: '/en/extract-images' }, localStorage: { getItem: () => null } });
  vi.stubGlobal('navigator', { globalPrivacyControl: false });
  vi.stubGlobal('fetch', async () => new Response(null, { status: 204 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function textPdf(pages: string[][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const lines of pages) {
    const page = doc.addPage([300, 300]);
    lines.forEach((line, i) => page.drawText(line, { x: 20, y: 250 - i * 30, size: 14, font }));
  }
  return doc.save();
}

const png = (width: number, height: number, color: string) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
  return canvas.toBuffer('image/png');
};

/** Pages of [width, height] pictures; the same size twice is the same image drawn twice. */
async function picturePdf(pages: [number, number][][]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const embedded = new Map<string, Awaited<ReturnType<PDFDocument['embedPng']>>>();
  for (const pictures of pages) {
    const page = doc.addPage([300, 300]);
    for (const [w, h] of pictures) {
      const key = `${w}x${h}`;
      if (!embedded.has(key)) embedded.set(key, await doc.embedPng(png(w, h, '#3366cc')));
      page.drawImage(embedded.get(key)!, { x: 10, y: 10, width: w, height: h });
    }
  }
  return doc.save();
}

const saveInput = (bytes: Uint8Array, pages: number, plan: Partial<SavePlan>): SaveInput => ({
  mode: plan.format === 'text' ? 'text' : 'imagesInside',
  source: new File([bytes as BlobPart], 'Report.pdf', { type: 'application/pdf' }),
  request: null,
  plan: { ...DEFAULT_SAVE_PLAN, ...plan },
  selected: [],
  pageCount: pages,
  baseName: 'Report',
  summary: summarizeDoc({ pages: [], objects: [] }, 0),
});

describe('extractText', () => {
  it('marks where each page starts, or joins pages with a blank line', async () => {
    const bytes = await textPdf([['Hello world'], ['Line one', 'Line two']]);
    expect(await extractText(bytes, { pageSeparators: true })).toBe(
      '--- Page 1 ---\n\nHello world\n\n--- Page 2 ---\n\nLine one\nLine two',
    );
    expect(await extractText(bytes, { pageSeparators: false })).toBe('Hello world\n\nLine one\nLine two');
  });

  it('a single page has no separator; no text at all is empty', async () => {
    expect(await extractText(await textPdf([['Only']]), { pageSeparators: true })).toBe('Only');
    expect(await extractText(await textPdf([[], []]), { pageSeparators: true })).toBe('');
  });

  /**
   * One line drawn run by run, the way Chrome writes a page: each word and
   * punctuation mark on its own, the gap after a run in em (0 = touching).
   */
  async function runsPdf(runs: [string, number][]): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 100]);
    let x = 20;
    for (const [text, gapAfter] of runs) {
      page.drawText(text, { x, y: 50, size: 14, font });
      x += font.widthOfTextAtSize(text, 14) + gapAfter * 14;
    }
    return doc.save();
  }

  it('one space between words, none before touching punctuation (Chrome writes each run apart)', async () => {
    const bytes = await runsPdf([['Vos', 0.28], ['documents', 0.28], ['fusionner', 0], [',', 0.28], ['blendpdf', 0], ['.', 0], ['com', 0.28], ['(', 0], ['OCR', 0], [')', 0]]);
    expect(await extractText(bytes, { pageSeparators: false })).toBe('Vos documents fusionner, blendpdf.com (OCR)');
  });

  it('a word drawn twice for a shadow stays two words', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([300, 100]);
    page.drawText('Titre', { x: 21.5, y: 50, size: 14, font });
    page.drawText('Titre', { x: 20, y: 50, size: 14, font });
    expect(await extractText(await doc.save(), { pageSeparators: false })).toBe('Titre Titre');
  });

  const fixture = (path: string) => new Uint8Array(readFileSync(join(__dirname, 'fixtures/edit-pdf', path)));

  it('Arabic printed by Chrome (one run per glyph, left to right) reads right to left, in plain letters', async () => {
    const lines = (await extractText(fixture('keep-font/k3-chrome-arial-times.pdf'), { pageSeparators: false })).split('\n');
    expect(lines.slice(0, 4)).toEqual([
      'فاتورة ضريبية مبسطة',
      'رقم الفاتورة: ٤٥١٢ بتاريخ ٢٠٢٦/٠٣/١٢',
      'اسم العميل: مؤسسة النخيل للمقاولات، الرياض',
      'نشكركم على تعاملكم معنا، ونأمل أن تنال خدماتنا رضاكم الدائم.',
    ]);
    expect(lines).toContain('Invoice 4512 issued on 12 March 2026 to Al Nakheel Contracting, Riyadh.');
  });

  it('Arabic from Word, already in reading order, stays as it was', async () => {
    const lines = (await extractText(fixture('replace/c-arabic-letter.pdf'), { pageSeparators: false })).split('\n');
    expect(lines.slice(0, 3)).toEqual(['شركة النور للخدمات المالية', 'التاريخ: ١٥ أكتوبر ٢٠٢٦', 'السيد أحمد المحترم،']);
    expect(lines[3]).toContain('طلبكم رقم 4471 قد تمت الموافقة');
  });

  it('leaves the caller\'s bytes readable', async () => {
    const bytes = await textPdf([['Hi']]);
    await extractText(bytes, { pageSeparators: false });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('runSave delivers <base>.txt on /pdf-to-text', async () => {
    installBrowser();
    const out = await runSave(saveInput(await textPdf([['A'], ['B']]), 2, { format: 'text', pageSeparators: false }));
    expect(out).toMatchObject({ filename: 'Report.txt', files: 1 });
    expect(out.blob.type).toBe('text/plain;charset=utf-8');
    expect(await out.blob.text()).toBe('A\n\nB');
  });
});

describe('extractImages', () => {
  it('each picture once, in order, tiny ones skipped', async () => {
    installBrowser();
    // pdf.js names an image per page (img_p0_1) until it caches it globally (g_), as the page deduped.
    const { images, pageLimitHit, imageLimitHit } = await extractImages(await picturePdf([[[40, 30], [8, 8], [40, 30]], [[50, 20]]]));
    expect(images.map((i) => i.name)).toEqual(['image_001_40x30.png', 'image_002_50x20.png']);
    expect([pageLimitHit, imageLimitHit]).toEqual([false, false]);
    expect([...images[0].bytes.subarray(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
  });

  it('says when only the first 200 pages were read, and the save passes it on', async () => {
    installBrowser();
    const pages = [[[40, 30]], ...Array.from({ length: 200 }, () => [])] as Parameters<typeof picturePdf>[0];
    const bytes = await picturePdf(pages);
    expect(await extractImages(bytes)).toMatchObject({ pageLimitHit: true, imageLimitHit: false });
    const out = await runSave(saveInput(bytes, 201, { format: 'imagesInside' }));
    expect(out.imageLimit).toEqual({ pages: 200 });
  });

  it('runSave: one picture is <base>_image_1.png', async () => {
    installBrowser();
    const out = await runSave(saveInput(await picturePdf([[[40, 30]]]), 1, { format: 'imagesInside' }));
    expect(out).toMatchObject({ filename: 'Report_image_1.png', files: 1 });
    expect(out.blob.type).toBe('image/png');
  });

  it('runSave: several pictures are a zip under the mode suffix', async () => {
    installBrowser();
    const steps: string[] = [];
    const out = await runSave({
      ...saveInput(await picturePdf([[[40, 30]], [[50, 20]]]), 2, { format: 'imagesInside' }),
      onStep: (s) => steps.push(s),
    });
    expect(out).toMatchObject({ filename: 'Report_images.zip', files: 2 });
    expect(steps).toEqual(['convert', 'zip']);
    const zip = await JSZip.loadAsync(await out.blob.arrayBuffer());
    expect(Object.keys(zip.files).sort()).toEqual(['Report_image_001_40x30.png', 'Report_image_002_50x20.png']);
  });

  it('runSave: no pictures is noImages', async () => {
    installBrowser();
    const error = await runSave(saveInput(await textPdf([['no pictures']]), 1, { format: 'imagesInside' })).catch((e) => e);
    expect(error).toMatchObject({ name: 'SaveError', code: 'noImages', step: 'convert' });
  });
});

describe('removeMetadata', () => {
  it('blanks the info fields, drops the dates and the XMP stream', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setTitle('Secret plan');
    doc.setAuthor('Someone');
    doc.setSubject('S');
    doc.setKeywords(['k']);
    doc.catalog.set(PDFName.of('Metadata'), doc.context.register(doc.context.stream('<x:xmpmeta/>')));
    const cleaned = await PDFDocument.load(await removeMetadata(await doc.save()), { updateMetadata: false });
    expect([cleaned.getTitle(), cleaned.getAuthor(), cleaned.getSubject(), cleaned.getKeywords(), cleaned.getCreator(), cleaned.getProducer()])
      .toEqual(['', '', '', '', '', '']);
    const info = cleaned.context.lookup(cleaned.context.trailerInfo.Info) as PDFDict;
    expect(info.has(PDFName.of('CreationDate')) || info.has(PDFName.of('ModDate'))).toBe(false);
    expect(cleaned.catalog.has(PDFName.of('Metadata'))).toBe(false);
  });
});
