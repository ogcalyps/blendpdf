/**
 * OCR that runs out of time. On 2026-11-04 a visitor's 42-page Arabic scan hit
 * the 240 s timeout; the editor said "Try again in a minute", they did, and it
 * timed out again. The answer now says to split the file (OCR_TIMEOUT), and
 * the editor's copy for it exists in every locale. ocrmypdf is a stand-in.
 */
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import en from '../messages/en.json';
import fr from '../messages/fr.json';
import ar from '../messages/ar.json';

vi.mock('child_process', async (original) => ({
  ...(await original<typeof import('child_process')>()),
  exec: (_cmd: string, _opts: unknown, done: (error: null, out: { stdout: string; stderr: string }) => void) =>
    done(null, { stdout: '/usr/bin/ocrmypdf\n', stderr: '' }),
}));
vi.mock('@/lib/run-process', () => ({
  withScratchDir: async (_prefix: string, run: (dir: string) => Promise<unknown>) => run('/tmp'),
  runProcess: async () => ({ stdout: '', stderr: '   12 redoing OCR\n', exitCode: null, signal: 'SIGTERM', timedOut: true }),
}));

describe('OCR timeout', () => {
  it('answers OCR_TIMEOUT (504) with a split-it message, not a retry', async () => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < 3; i++) doc.addPage([200, 200]);
    const form = new FormData();
    form.append('file', new File([(await doc.save()) as BlobPart], 'Scan.pdf', { type: 'application/pdf' }));
    form.append('languages', 'ara+eng');
    form.append('mode', 'redo');
    const { POST } = await import('../app/api/ocr-pdf/route');
    const response = await POST(
      new NextRequest('http://localhost/api/ocr-pdf', { method: 'POST', body: form, headers: { 'x-real-ip': '10.0.1.1' } })
    );
    expect(response.status).toBe(504);
    const body = await response.json();
    expect(body.errorCode).toBe('OCR_TIMEOUT');
    expect(body.error).toMatch(/split/i);
    expect(body.error).not.toMatch(/try again/i);
  });

  it('every locale has the editor copy for it', () => {
    for (const messages of [en, fr, ar]) {
      expect(messages.ocrPdf.errors.timeout).toMatch(/10/);
      expect(messages.ocrPdf.errors.pageLimitBeforeUpload).toContain('{max}');
    }
  });
});
