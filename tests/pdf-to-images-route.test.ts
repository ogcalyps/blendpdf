/**
 * /api/pdf-to-images draws pages with pdf.js on node-canvas. pdf.js paints a
 * gradient fill with `new DOMMatrix()`, which Node lacks, so every page with
 * a gradient (Chrome and Canva exports, the BlendPDF brochure) came back as
 * a 500 "DOMMatrix is not defined". The route is called directly here.
 */
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { NextRequest } from 'next/server';
import { loadImage, createCanvas } from 'canvas';
import { PDFDocument, PDFName } from 'pdf-lib';
import { POST } from '../app/api/pdf-to-images/route';

/** One 200 x 100 page filled by an axial gradient, red on the left to blue on the right. */
async function gradientPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 100]);
  const ctx = doc.context;
  const shading = ctx.obj({
    ShadingType: 2,
    ColorSpace: 'DeviceRGB',
    Coords: [0, 0, 200, 0],
    Function: { FunctionType: 2, Domain: [0, 1], C0: [1, 0, 0], C1: [0, 0, 1], N: 1 },
    Extend: [true, true],
  });
  const pattern = ctx.register(ctx.obj({ PatternType: 2, Shading: shading }));
  page.node.set(PDFName.of('Resources'), ctx.obj({ Pattern: { P0: pattern } }));
  const content = ctx.flateStream('/Pattern cs /P0 scn 0 0 200 100 re f');
  page.node.set(PDFName.of('Contents'), ctx.register(content));
  return doc.save();
}

async function convert(bytes: Uint8Array, format: 'png' | 'jpg') {
  const form = new FormData();
  form.append('file', new File([bytes as BlobPart], 'gradient.pdf', { type: 'application/pdf' }));
  form.append('format', format);
  form.append('dpi', '72');
  return POST(new NextRequest('http://localhost/api/pdf-to-images', { method: 'POST', body: form }));
}

describe('pdf-to-images draws gradients', () => {
  it('a gradient page converts, red on the left and blue on the right', async () => {
    const response = await convert(await gradientPdf(), 'png');
    expect(response.status, await response.clone().text().catch(() => '')).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    expect(Object.keys(zip.files)).toEqual(['page-001.png']);

    const image = await loadImage(await zip.file('page-001.png')!.async('nodebuffer'));
    const canvas = createCanvas(image.width, image.height);
    const draw = canvas.getContext('2d');
    draw.drawImage(image, 0, 0);
    const [lr, , lb] = draw.getImageData(5, 50, 1, 1).data;
    const [rr, , rb] = draw.getImageData(image.width - 5, 50, 1, 1).data;
    expect(lr).toBeGreaterThan(200);
    expect(lb).toBeLessThan(60);
    expect(rb).toBeGreaterThan(200);
    expect(rr).toBeLessThan(60);
  });

  it('as JPG too', async () => {
    const response = await convert(await gradientPdf(), 'jpg');
    expect(response.status).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()));
    expect(Object.keys(zip.files)).toEqual(['page-001.jpg']);
  });
});
