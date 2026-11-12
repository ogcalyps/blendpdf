/**
 * Memory limits on the image routes (security review, 2026-11-12): one
 * request used to be able to run the Node process out of memory with a small
 * PNG of huge dimensions, a huge page at a high DPI, or a chunked upload that
 * skipped the Content-Length check.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
import { NextRequest } from 'next/server';
import { createCanvas, loadImage } from 'canvas';
import { PDFDocument } from 'pdf-lib';
import { MAX_DECODED_PIXELS, imageSize, tooManyPixels } from '../lib/image-size';
import { MAX_WAITING_HEAVY_JOBS, runHeavyJob } from '../lib/heavy-jobs';
import { readBodyText } from '../lib/read-body';

/** A PNG header claiming width x height; the data after it is never valid image data. */
function pngHeader(width: number, height: number): Uint8Array {
  const b = Buffer.alloc(64);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return new Uint8Array(b);
}

function chunked(parts: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const p of parts) controller.enqueue(new TextEncoder().encode(p));
      controller.close();
    },
  });
}

afterEach(() => vi.restoreAllMocks());

describe('lib/image-size', () => {
  it('reads PNG and JPEG sizes from the header', () => {
    expect(imageSize(pngHeader(8000, 8000))).toEqual({ width: 8000, height: 8000 });
    const jpeg = createCanvas(321, 123).toBuffer('image/jpeg');
    expect(imageSize(new Uint8Array(jpeg))).toEqual({ width: 321, height: 123 });
    expect(imageSize(new Uint8Array(Buffer.from('GIF89a')))).toBeNull();
  });

  it('flags images too big to decode, and unreadable ones', () => {
    expect(tooManyPixels(pngHeader(8000, 8000))).toBe(true);
    expect(tooManyPixels(pngHeader(4000, 4000))).toBe(false);
    expect(4000 * 4000).toBeLessThan(MAX_DECODED_PIXELS);
    expect(tooManyPixels(new Uint8Array([1, 2, 3]))).toBe(true);
  });
});

describe('lib/heavy-jobs', () => {
  it('runs jobs one at a time and turns away the overflow', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const first = runHeavyJob(async () => {
      order.push('first start');
      await gate;
      order.push('first end');
    })!;
    const waiting = Array.from({ length: MAX_WAITING_HEAVY_JOBS }, (_, i) => runHeavyJob(async () => void order.push(`wait ${i}`)));
    expect(waiting.every(Boolean)).toBe(true);
    expect(runHeavyJob(async () => undefined)).toBeNull();
    release();
    await Promise.all([first, ...waiting]);
    expect(order).toEqual(['first start', 'first end', ...waiting.map((_, i) => `wait ${i}`)]);
    // Room again once they've finished
    expect(runHeavyJob(async () => undefined)).not.toBeNull();
  });
});

describe('lib/read-body', () => {
  it('stops reading a chunked body once it passes the cap, whatever Content-Length says', async () => {
    const big = new Request('http://localhost/x', { method: 'POST', body: chunked(['a'.repeat(600), 'b'.repeat(600)]), duplex: 'half' } as RequestInit);
    expect(await readBodyText(big, 1000)).toBeNull();
    const small = new Request('http://localhost/x', { method: 'POST', body: chunked(['{"ok":', 'true}']), duplex: 'half' } as RequestInit);
    expect(await readBodyText(small, 1000)).toBe('{"ok":true}');
  });
});

describe('/api/images-to-pdf', () => {
  it('skips a PNG whose dimensions are too big, without decoding it', async () => {
    const embedPng = vi.spyOn(PDFDocument.prototype, 'embedPng');
    const { POST } = await import('../app/api/images-to-pdf/route');
    const form = new FormData();
    form.append('count', '2');
    form.append('image_0', new File([pngHeader(8000, 8000) as BlobPart], 'bomb.png', { type: 'image/png' }));
    form.append('image_1', new File([createCanvas(40, 20).toBuffer('image/png') as BlobPart], 'ok.png', { type: 'image/png' }));
    const res = await POST(new NextRequest('http://localhost/api/images-to-pdf', { method: 'POST', body: form, headers: { 'x-real-ip': '198.51.100.1' } }));
    expect(res.status).toBe(200);
    expect(decodeURIComponent(res.headers.get('X-Skipped-Files') ?? '')).toBe('bomb.png');
    expect(embedPng).toHaveBeenCalledTimes(1);
  });
});

describe('/api/pdf-to-images', () => {
  it('draws a huge page at a lower scale instead of allocating a giant canvas', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([1000, 1000]); // 1000 pt at 600 dpi would be 8333 x 8333 px (69 MP)
    const { POST } = await import('../app/api/pdf-to-images/route');
    const form = new FormData();
    form.append('file', new File([(await doc.save()) as BlobPart], 'big.pdf', { type: 'application/pdf' }));
    form.append('format', 'jpg');
    form.append('dpi', '600');
    const res = await POST(new NextRequest('http://localhost/api/pdf-to-images', { method: 'POST', body: form, headers: { 'x-real-ip': '198.51.100.2' } }));
    expect(res.status).toBe(200);
    const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
    const image = await loadImage(await zip.file('page-001.jpg')!.async('nodebuffer'));
    expect(image.width * image.height).toBeLessThanOrEqual(25_000_000);
    expect(image.width).toBeGreaterThan(4900);
  });

  it('removes its temp directory once the streamed ZIP has been read', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'pdf-to-images-test-'));
    const previous = process.env.TMPDIR;
    process.env.TMPDIR = tmp;
    try {
      const doc = await PDFDocument.create();
      doc.addPage([200, 100]);
      const { POST } = await import('../app/api/pdf-to-images/route');
      const form = new FormData();
      form.append('file', new File([(await doc.save()) as BlobPart], 'small.pdf', { type: 'application/pdf' }));
      form.append('format', 'png');
      form.append('dpi', '72');
      const res = await POST(new NextRequest('http://localhost/api/pdf-to-images', { method: 'POST', body: form, headers: { 'x-real-ip': '198.51.100.5' } }));
      expect(res.status).toBe(200);
      expect(readdirSync(tmp)).toHaveLength(1); // still there while the ZIP is being sent
      await res.arrayBuffer();
      await new Promise((r) => setTimeout(r, 200));
      expect(readdirSync(tmp)).toEqual([]);
    } finally {
      process.env.TMPDIR = previous;
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('/api/fill-form-chunk', () => {
  it('refuses a chunked body over the cap, with no Content-Length to check', async () => {
    const { POST } = await import('../app/api/fill-form-chunk/route');
    const parts = Array.from({ length: 90 }, () => 'x'.repeat(1024 * 1024));
    const req = new NextRequest('http://localhost/api/fill-form-chunk', {
      method: 'POST',
      body: chunked(parts),
      headers: { 'x-real-ip': '198.51.100.3', 'content-type': 'application/json' },
      duplex: 'half',
    } as ConstructorParameters<typeof NextRequest>[1]);
    expect(req.headers.get('content-length')).toBeNull();
    expect((await POST(req)).status).toBe(413);
  });

  it('refuses rows x template size beyond what it can hold in memory', async () => {
    const { POST } = await import('../app/api/fill-form-chunk/route');
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(3 * 1024 * 1024, 32)]);
    const body = JSON.stringify({ pdfBase64: pdf.toString('base64'), mapping: {}, rows: Array.from({ length: 50 }, () => ({})) });
    const res = await POST(new NextRequest('http://localhost/api/fill-form-chunk', { method: 'POST', body, headers: { 'x-real-ip': '198.51.100.4', 'content-type': 'application/json' } }));
    expect(res.status).toBe(413);
  });
});
