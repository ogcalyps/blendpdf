import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { acceptsFile, setHandoff, takeHandoff } from '@/lib/file-handoff';
import { KEEP_WORKING_TOOLS, isPdfResult, keepWorkingTools, toolSlugFromPath } from '@/lib/keep-working';
import { autoCloseDelay, initialDeliveryState, deliveryReducer } from '@/lib/file-delivery';
import { START_ACCEPT, startPageFor } from '@/lib/home-start';

const pdf = new Blob(['%PDF-1.7'], { type: 'application/pdf' });

describe('file handoff', () => {
  it('is taken once', () => {
    const file = new File(['%PDF'], 'a.pdf', { type: 'application/pdf' });
    setHandoff(file, 'crop-pdf');
    expect(takeHandoff()).toEqual({ file, from: 'crop-pdf' });
    expect(takeHandoff()).toBeNull();
  });

  it('matches the dropzone accept the way the picker does', () => {
    const file = { name: 'Report.PDF', type: 'application/pdf' };
    expect(acceptsFile(undefined, file)).toBe(true);
    expect(acceptsFile({ 'application/pdf': ['.pdf'] }, file)).toBe(true);
    expect(acceptsFile({ 'application/pdf': [] }, { name: 'x', type: 'application/pdf' })).toBe(true);
    expect(acceptsFile({ 'image/*': ['.png', '.jpg'] }, file)).toBe(false);
    expect(acceptsFile({ 'image/*': [] }, { name: 'x.png', type: 'image/png' })).toBe(true);
    expect(acceptsFile({ 'application/octet-stream': ['.pdf'] }, { name: 'a.pdf', type: '' })).toBe(true);
  });
});

describe('keep working tools', () => {
  it('reads the tool from a path with or without the locale', () => {
    expect(toolSlugFromPath('/crop-pdf')).toBe('crop-pdf');
    expect(toolSlugFromPath('/ar/crop-pdf')).toBe('crop-pdf');
    expect(toolSlugFromPath('/en/split-pdf')).toBe('split-pdf');
    expect(toolSlugFromPath('/ar')).toBe('ar');
    expect(toolSlugFromPath('/')).toBe('');
  });

  it('offers only single-PDF results, never the tool itself', () => {
    const tools = keepWorkingTools('crop-pdf', pdf, 'a_cropped.pdf');
    expect(tools.length).toBe(KEEP_WORKING_TOOLS.length - 1);
    expect(tools.some((t) => t.slug === 'crop-pdf')).toBe(false);
    expect(tools[0].slug).toBe('edit-pdf');
    expect(keepWorkingTools('split-pdf', new Blob(['PK'], { type: 'application/zip' }), 'pages.zip')).toEqual([]);
    expect(keepWorkingTools('pdf-to-word', new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), 'a.docx')).toEqual([]);
    expect(keepWorkingTools('compress-pdf', null, 'a.pdf')).toEqual([]);
  });

  it('skips password-protected results the next tool could not open', () => {
    expect(keepWorkingTools('protect-pdf', pdf, 'a_protected.pdf')).toEqual([]);
  });

  it('falls back to the file name when the blob has no type', () => {
    expect(isPdfResult(new Blob(['%PDF']), 'out.pdf')).toBe(true);
    expect(isPdfResult(new Blob(['x']), 'out.txt')).toBe(false);
  });

  it('every offered tool is a real page with a name in both languages', () => {
    const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/en.json'), 'utf8'));
    const ar = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'messages/ar.json'), 'utf8'));
    for (const { slug, titleKey } of KEEP_WORKING_TOOLS) {
      expect(fs.existsSync(path.join(process.cwd(), 'app/[locale]', slug, 'page.tsx')), slug).toBe(true);
      expect(en.nav.tools[titleKey]?.title, titleKey).toBeTruthy();
      expect(ar.nav.tools[titleKey]?.title, titleKey).toBeTruthy();
    }
    for (const messages of [en, ar]) {
      expect(Object.keys(messages.keepWorking).sort()).toEqual(['allTools', 'fewerTools', 'hint', 'title']);
    }
  });
});

describe('result panel auto-close', () => {
  const downloaded = deliveryReducer(initialDeliveryState, { type: 'download', askForReview: false });

  it('still closes by itself when nothing else is on offer', () => {
    expect(autoCloseDelay(downloaded)).not.toBeNull();
  });

  it('stays open while Keep working is on offer', () => {
    expect(autoCloseDelay(downloaded, true)).toBeNull();
  });
});

describe('home page drop zone', () => {
  it('opens a PDF in the editor and other documents in their converter', () => {
    expect(startPageFor({ name: 'Contract.PDF', type: 'application/pdf' })).toBe('/edit-pdf');
    expect(startPageFor({ name: 'cv.docx', type: '' })).toBe('/word-to-pdf');
    expect(startPageFor({ name: 'deck.pptx', type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })).toBe('/powerpoint-to-pdf');
    expect(startPageFor({ name: 'sheet.xls', type: 'application/vnd.ms-excel' })).toBe('/excel-to-pdf');
    expect(startPageFor({ name: 'scan.webp', type: 'image/webp' })).toBe('/images-to-pdf');
    expect(startPageFor({ name: 'notes.txt', type: 'text/plain' })).toBeNull();
  });

  it('only offers files the target page itself accepts', () => {
    for (const [mime, extensions] of Object.entries(START_ACCEPT)) {
      const file = { name: `x${extensions[0]}`, type: mime };
      const page = startPageFor(file)!;
      let source = fs.readFileSync(path.join(process.cwd(), 'app/[locale]', page, 'page.tsx'), 'utf8');
      // A page whose dropzone is the workspace shell's accepts what the shell accepts
      if (/<ToolWorkspace\b/.test(source) && !/useTrackedDropzone\(/.test(source)) {
        source = fs.readFileSync(path.join(process.cwd(), 'components/workspace/ToolWorkspace.tsx'), 'utf8');
      }
      expect(source.includes(`'${mime}'`), `${page} accepts ${mime}`).toBe(true);
    }
  });
});
