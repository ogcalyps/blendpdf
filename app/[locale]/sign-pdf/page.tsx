'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, PenTool, Download, X, ChevronLeft, ChevronRight, CalendarDays, Lock, Zap, ShieldCheck } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { renderTextToImage } from '@/lib/text-to-image';
import { withToolTracking } from '@/lib/analytics';
import { Navigation } from '@/components/Navigation';
import { PDFLivePreview } from '@/components/PDFLivePreview';
import { SignaturePad } from '@/components/forms/SignaturePad';
import { useDropzone } from 'react-dropzone';
import { validateFile, formatFileSize, downloadBlob } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';
import { DeliveryChoiceModal } from '@/components/DeliveryChoiceModal';
import { useDeliveryChoice } from '@/hooks/useDeliveryChoice';
import { initializePdfJsWorker } from '@/lib/pdfjs-init';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

/**
 * A signature placed on a page. Position and size are stored as FRACTIONS of
 * the rendered page box (xPct/yPct = top-left corner, widthPct = width), so
 * they map cleanly to PDF points regardless of the on-screen preview scale.
 */
interface SignaturePlacement {
  id: string;
  pageNumber: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  /** Intrinsic height/width ratio of the PNG — keeps resize aspect-true. */
  aspect: number;
  /** Normalized PNG data URL. */
  dataUrl: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Normalize any signature image (drawn/typed canvas PNG, or an uploaded
 * JPEG/WebP/…) to a PNG data URL and measure its aspect ratio. Transparent
 * margins are trimmed so the draggable box hugs the ink instead of the whole
 * signature-pad canvas.
 */
async function normalizeSignatureImage(src: string): Promise<{ dataUrl: string; aspect: number }> {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load signature image'));
    img.src = src;
  });
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) throw new Error('Failed to load signature image');

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser');
  ctx.drawImage(img, 0, 0);

  // Trim fully transparent margins (no-op for opaque JPEG uploads).
  let minX = w, minY = h, maxX = -1, maxY = -1;
  try {
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  } catch {
    maxX = -1; // data URLs never taint the canvas, but stay safe anyway
  }
  if (maxX < 0) {
    // Fully transparent (nothing drawn) or unreadable — use the full image.
    minX = 0; minY = 0; maxX = w - 1; maxY = h - 1;
  }
  const pad = 4;
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);
  const cw = Math.min(w, maxX + pad + 1) - sx;
  const ch = Math.min(h, maxY + pad + 1) - sy;

  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('Canvas 2D is not supported in this browser');
  outCtx.drawImage(canvas, sx, sy, cw, ch, 0, 0, cw, ch);
  return { dataUrl: out.toDataURL('image/png'), aspect: ch / cw };
}

/**
 * Apply all placed signatures 100% client-side with pdf-lib — the file never
 * leaves the browser. Fractions are converted to PDF points per page, with
 * page rotation (0/90/180/270) mapped so the stamp lands exactly where the
 * (rotation-aware) preview showed it.
 */
const applySignaturesClientSide = withToolTracking(
  'sign_pdf',
  'client',
  async (file: File, placements: SignaturePlacement[]): Promise<Blob> => {
    const { PDFDocument, degrees } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer(), {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    if (pdfDoc.isEncrypted) {
      throw Object.assign(new Error('This PDF is password-protected'), { errorCode: 'ENCRYPTED_PDF' });
    }

    const pages = pdfDoc.getPages();
    const embedded = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();

    for (const p of placements) {
      const page = pages[p.pageNumber - 1];
      if (!page) continue;

      let image = embedded.get(p.dataUrl);
      if (!image) {
        image = await pdfDoc.embedPng(p.dataUrl);
        embedded.set(p.dataUrl, image);
      }

      const rot = ((page.getRotation().angle % 360) + 360) % 360;
      const { width: W, height: H } = page.getSize();
      // The preview (pdf.js) renders the page in its rotated, upright
      // orientation — fractions are relative to that visual box.
      const sideways = rot === 90 || rot === 270;
      const visW = sideways ? H : W;
      const visH = sideways ? W : H;
      const w = p.widthPct * visW;
      const h = w * p.aspect;
      const vx = p.xPct * visW;
      const vy = p.yPct * visH;

      if (rot === 90) {
        page.drawImage(image, { x: vy + h, y: vx, width: w, height: h, rotate: degrees(90) });
      } else if (rot === 180) {
        page.drawImage(image, { x: W - vx, y: vy + h, width: w, height: h, rotate: degrees(180) });
      } else if (rot === 270) {
        page.drawImage(image, { x: W - vy - h, y: H - vx, width: w, height: h, rotate: degrees(270) });
      } else {
        // Common 0° case: PDF origin is bottom-left, screen origin top-left.
        page.drawImage(image, { x: vx, y: H - vy - h, width: w, height: h });
      }
    }

    const bytes = await pdfDoc.save();
    return new Blob([bytes as unknown as ArrayBuffer], { type: 'application/pdf' });
  }
);

interface DragState {
  id: string;
  mode: 'move' | 'resize';
  startX: number;
  startY: number;
  rect: DOMRect;
  xPct: number;
  yPct: number;
  widthPct: number;
  aspect: number;
}

export default function SignPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing, clearFiles } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [placements, setPlacements] = useState<SignaturePlacement[]>([]);
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const [showPad, setShowPad] = useState(false);
  const [signedBlob, setSignedBlob] = useState<Blob | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const idRef = useRef(0);

  // Use delivery choice hook for consistent download experience
  const {
    showEmailCapture,
    showDeliveryChoice,
    capturedEmail,
    isSendingEmail,
    successType,
    handleEmailCaptured,
    handleSendViaEmail,
    handleDownloadDirectly,
    triggerEmailCapture,
  } = useDeliveryChoice({
    fileBlob: signedBlob,
    filename: file ? file.name.replace('.pdf', '_signed.pdf') : 'signed.pdf',
    onDownload: () => {
      if (signedBlob) {
        downloadBlob(signedBlob, file ? file.name.replace('.pdf', '_signed.pdf') : 'signed.pdf');
      }
    },
    onReset: () => {
      setSignedBlob(null);
    },
  });

  useEffect(() => {
    if (!file) {
      setPageCount(0);
      setPageNumber(1);
      return;
    }
    async function getPageCount() {
      if (!file) return;
      try {
        const pdfjsLib = await initializePdfJsWorker();
        if (!pdfjsLib) return;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        setPageCount(pdf.numPages);
        setPageNumber(1);
      } catch (error) {
        console.error('Error loading PDF:', error);
      }
    }
    getPageCount();
  }, [file]);

  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('signPdf.steps.upload.title'), description: t('signPdf.steps.upload.description') },
    { icon: <PenTool className="h-8 w-8 text-primary" />, title: t('signPdf.steps.sign.title'), description: t('signPdf.steps.sign.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('signPdf.steps.download.title'), description: t('signPdf.steps.download.description') },
  ];

  const faqData = useToolFaqs('signPdf');

  const acceptFile = useCallback((uploadedFile: File) => {
    const error = validateFile(uploadedFile, MAX_FILE_SIZE);
    if (error) { setInlineError(error); return; }
    setInlineError(null);
    setShowEncryptedHint(false);
    setFile(uploadedFile);
    setSignedBlob(null);
    setPlacements([]);
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    acceptFile(acceptedFiles[0]);
  }, [acceptFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: processing.isProcessing,
  });

  const handleRemoveFile = () => {
    setFile(null);
    setSignedBlob(null);
    setPlacements([]);
    setShowPad(false);
    clearFiles();
  };

  /** Add a placement on the currently-viewed page: centered, ~widthPct wide. */
  const addPlacement = useCallback((dataUrl: string, aspect: number, widthPct: number) => {
    const rect = overlayRef.current?.getBoundingClientRect();
    // hPct = widthPct * aspect / (rectH / rectW); fall back to A4 portrait.
    const rectAspect = rect && rect.width > 0 && rect.height > 0 ? rect.height / rect.width : Math.SQRT2;
    const hPct = (widthPct * aspect) / rectAspect;
    idRef.current += 1;
    setPlacements(prev => [
      ...prev,
      {
        id: `sig-${idRef.current}`,
        pageNumber,
        xPct: clamp((1 - widthPct) / 2, 0, 1),
        yPct: clamp((1 - hPct) / 2, 0, 0.9),
        widthPct,
        aspect,
        dataUrl,
      },
    ]);
    setSignedBlob(null);
  }, [pageNumber]);

  const handlePlaceSignature = async () => {
    if (!pendingSignature) return;
    try {
      const { dataUrl, aspect } = await normalizeSignatureImage(pendingSignature);
      addPlacement(dataUrl, aspect, 0.3);
    } catch {
      setInlineError(t('signPdf.textRenderError'));
    }
  };

  /** Insert today's date as a typed-text placement (Arabic-safe rendering). */
  const handleAddDate = async () => {
    try {
      const dateStr = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date());
      const rendered = await renderTextToImage(dateStr, { fontSizePx: 64, color: '#111111' });
      const blob = new Blob([rendered.bytes], { type: 'image/png' });
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read date image'));
        reader.readAsDataURL(blob);
      });
      addPlacement(dataUrl, rendered.height / rendered.width, 0.18);
    } catch {
      setInlineError(t('signPdf.textRenderError'));
    }
  };

  const removePlacement = (id: string) => {
    setPlacements(prev => prev.filter(p => p.id !== id));
    setSignedBlob(null);
  };

  // ── Drag / resize (pointer events; touch works via touch-action: none) ──
  const startDrag = (e: React.PointerEvent, p: SignaturePlacement, mode: 'move' | 'resize') => {
    if (processing.isProcessing) return;
    if (mode === 'resize') e.stopPropagation();
    e.preventDefault();
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* pointer capture is best-effort — dragging still works via bubbling */
    }
    dragRef.current = {
      id: p.id, mode,
      startX: e.clientX, startY: e.clientY,
      rect,
      xPct: p.xPct, yPct: p.yPct, widthPct: p.widthPct, aspect: p.aspect,
    };
  };

  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    e.preventDefault();
    const dx = (e.clientX - d.startX) / d.rect.width;
    const dy = (e.clientY - d.startY) / d.rect.height;
    const rectAspect = d.rect.height / d.rect.width;
    setPlacements(prev => prev.map(p => {
      if (p.id !== d.id) return p;
      if (d.mode === 'move') {
        const hPct = (p.widthPct * p.aspect) / rectAspect;
        return {
          ...p,
          xPct: clamp(d.xPct + dx, 0, Math.max(0, 1 - p.widthPct)),
          yPct: clamp(d.yPct + dy, 0, Math.max(0, 1 - hPct)),
        };
      }
      // Resize from the corner handle, keeping the PNG's intrinsic aspect
      // ratio; clamp so the box stays inside the page both ways.
      let w = clamp(d.widthPct + dx, 0.04, 1 - d.xPct);
      const maxWFromHeight = ((1 - d.yPct) * rectAspect) / d.aspect;
      w = Math.min(w, Math.max(0.04, maxWFromHeight));
      return { ...p, widthPct: w };
    }));
  };

  const endDrag = () => { dragRef.current = null; };

  const handleSign = async () => {
    if (!file || placements.length === 0) return;
    setShowEncryptedHint(false);
    try {
      setProcessing(true, 'convert');
      setProgress(30);
      const result = await applySignaturesClientSide(file, placements);
      setProgress(100);
      setSignedBlob(result);
      setResult(result, 'signed.pdf');
    } catch (error: any) {
      setSignedBlob(null);
      if (isEncryptedPdfError(error)) {
        setShowEncryptedHint(true);
        setError(t('errors.encryptedPdfHint'));
      } else {
        setError(error?.message || String(error));
      }
    }
  };

  const handleDownload = () => { triggerEmailCapture(); };

  const currentPagePlacements = placements.filter(p => p.pageNumber === pageNumber);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Sign PDF', url: '/sign-pdf' }]} />
      <HowToSchema name="How to Sign PDF" description="Learn how to add electronic signatures to PDF files online for free — draw, type, or upload a signature and drag it anywhere on any page" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('signPdf.title')}</h1>
            <p className="mt-4 text-lg text-gray-600">{t('signPdf.description')}</p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 text-sm font-medium text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              {t('signPdf.whyLocal.title')}
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              {inlineError && (
                <div className="mb-4 flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm text-red-600">{inlineError}</p>
                  <button
                    type="button"
                    onClick={() => setInlineError(null)}
                    className="text-red-600 hover:text-red-700 transition-colors"
                    aria-label={t('common.dismiss')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {showEncryptedHint && (
                <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-gray-700">
                  {t('errors.encryptedPdfHint')}{' '}
                  <Link href="/unlock-pdf" className="font-medium text-primary underline hover:no-underline">
                    {t('errors.unlockPdfCta')}
                  </Link>
                </div>
              )}
              {!file ? (
                <div {...getRootProps()} className={`relative flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16 border-2 border-dashed transition-colors duration-200 ${processing.isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}`}>
                  <input {...getInputProps()} disabled={processing.isProcessing} />
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`rounded-full p-4 ${isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <Upload className={`h-12 w-12 ${isDragActive ? 'text-green-600' : 'text-primary'}`} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold text-gray-900">{t('common.dropPdfHere')}</h2>
                      <p className="text-gray-700">{t('common.orClickToBrowse')}</p>
                    </div>
                    <div className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium text-center pointer-events-none">{t('signPdf.chooseFile')}</div>
                    <div className="mt-4">
                      <GoogleDrivePicker onFilesSelected={async (files) => { if (files.length === 0) return; acceptFile(files[0]); }} disabled={processing.isProcessing} multiple={false} accept={['application/pdf']} />
                    </div>
                    <p className="mt-4 text-sm text-gray-500">{t('signPdf.singleFile')}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-2 gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{file.name}</h3>
                      <p className="text-sm text-gray-600">{formatFileSize(file.size, locale)}</p>
                    </div>
                    <button onClick={handleRemoveFile} className="p-1 text-red-600 hover:text-red-700 transition-colors shrink-0" aria-label={t('common.removeFile')}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Page navigation */}
                  {pageCount > 0 && (
                    <div className="mb-3 flex items-center justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                        disabled={pageNumber <= 1 || processing.isProcessing}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label={t('signPdf.prevPage')}
                      >
                        <ChevronLeft className="h-5 w-5 rtl:rotate-180" />
                      </button>
                      <span className="text-sm font-medium text-gray-700 tabular-nums">
                        {t('signPdf.pageOf', { current: pageNumber, total: pageCount })}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPageNumber(p => Math.min(pageCount, p + 1))}
                        disabled={pageNumber >= pageCount || processing.isProcessing}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label={t('signPdf.nextPage')}
                      >
                        <ChevronRight className="h-5 w-5 rtl:rotate-180" />
                      </button>
                    </div>
                  )}

                  {/* Live preview + draggable signature overlay */}
                  <div className="relative select-none">
                    <PDFLivePreview file={file} pageNumber={pageNumber} />
                    <div ref={overlayRef} className="absolute inset-0 z-20">
                      {currentPagePlacements.map(p => (
                        <div
                          key={p.id}
                          className="absolute touch-none cursor-move group"
                          style={{ left: `${p.xPct * 100}%`, top: `${p.yPct * 100}%`, width: `${p.widthPct * 100}%` }}
                          onPointerDown={(e) => startDrag(e, p, 'move')}
                          onPointerMove={onDragMove}
                          onPointerUp={endDrag}
                          onPointerCancel={endDrag}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.dataUrl} alt="" className="block w-full h-auto pointer-events-none select-none" draggable={false} />
                          <div className="absolute inset-0 rounded border border-dashed border-primary/60 group-hover:border-primary transition-colors" />
                          <button
                            type="button"
                            aria-label={t('signPdf.deleteSignature')}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => removePlacement(p.id)}
                            className="absolute -top-2.5 -end-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {/* Corner resize handle — geometric bottom-right in both LTR and RTL */}
                          <div
                            role="slider"
                            aria-label={t('signPdf.resizeSignature')}
                            aria-valuenow={Math.round(p.widthPct * 100)}
                            tabIndex={-1}
                            onPointerDown={(e) => startDrag(e, p, 'resize')}
                            onPointerMove={onDragMove}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                            className="absolute -bottom-1.5 -right-1.5 h-3.5 w-3.5 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-primary shadow"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {placements.length > 0 && (
                    <p className="mt-3 text-xs text-gray-500 text-center">{t('signPdf.placeHint')}</p>
                  )}
                </div>
              )}
            </div>

            <div>
              {!file ? (
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                      <Lock className="h-5 w-5 text-teal-600" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{t('signPdf.whyLocal.title')}</h2>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{t('signPdf.whyLocal.description')}</p>
                  <div className="mt-6 space-y-4 border-t border-gray-100 pt-6">
                    {steps.map((step, index) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-50 border border-orange-100 text-sm font-bold text-primary">{index + 1}</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{step.title}</h4>
                          <p className="text-sm text-gray-500">{step.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">{t('signPdf.addSignature')}</h2>
                    <span className="text-sm text-gray-500">{t('signPdf.signaturesPlaced', { count: placements.length })}</span>
                  </div>

                  <div className="space-y-4">
                    {!showPad ? (
                      <Button onClick={() => setShowPad(true)} variant="secondary" size="lg" className="w-full" disabled={processing.isProcessing}>
                        <PenTool className="h-5 w-5 me-2" />
                        {t('signPdf.addSignature')}
                      </Button>
                    ) : (
                      <div className="rounded-xl border border-gray-200 p-4">
                        <SignaturePad
                          title={t('signPdf.signHere')}
                          onSave={(dataUrl) => setPendingSignature(dataUrl || null)}
                          onClear={() => setPendingSignature(null)}
                        />
                        <Button
                          onClick={handlePlaceSignature}
                          disabled={!pendingSignature || processing.isProcessing}
                          size="md"
                          className="w-full mt-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('signPdf.placeSignature')}
                        </Button>
                      </div>
                    )}

                    <Button onClick={handleAddDate} variant="secondary" size="md" className="w-full" disabled={processing.isProcessing}>
                      <CalendarDays className="h-5 w-5 me-2" />
                      {t('signPdf.addDate')}
                    </Button>

                    {placements.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setPlacements([]); setSignedBlob(null); }}
                        disabled={processing.isProcessing}
                        className="w-full text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                      >
                        {t('signPdf.clearAll')}
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 mt-6">
                    {!signedBlob ? (
                      <Button onClick={handleSign} disabled={placements.length === 0 || processing.isProcessing} size="lg" className="w-full disabled:opacity-50 disabled:cursor-not-allowed">
                        {processing.isProcessing && processing.currentTool === 'convert' ? t('signPdf.signing') : t('signPdf.applySign')}
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleDownload} size="lg" className="w-full bg-success-green hover:from-green-600 hover:to-green-700">
                          {t('signPdf.downloadSigned')}
                        </Button>
                        <Button onClick={handleRemoveFile} variant="secondary" size="md" className="w-full">
                          {t('signPdf.signAnother')}
                        </Button>
                      </>
                    )}
                  </div>

                  <p className="mt-4 text-xs text-gray-500 text-center">{t('signPdf.whyLocal.description')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/sign-pdf/faq" />

      {/* Why Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-dark mb-12">{t('why.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-orange-100 rounded-xl p-3 w-fit mb-4">
                <Zap className="w-7 h-7 text-primary" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">{t('why.noSignup.title')}</h3>
              <p className="text-gray-600 leading-relaxed">{t('why.noSignup.description')}</p>
            </div>
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-teal-100 rounded-xl p-3 w-fit mb-4">
                <Lock className="w-7 h-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">{t('signPdf.whyLocal.title')}</h3>
              <p className="text-gray-600 leading-relaxed">{t('signPdf.whyLocal.description')}</p>
            </div>
          </div>
        </div>
      </section>

      <RelatedTools currentTool="sign" />
      <Footer />

      <ProcessingModal isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)} progress={processing.progress} currentTool={processing.currentTool} error={processing.error} onClose={resetProcessing} onRetry={handleSign} />

      {/* Email Capture Modal */}
      <EmailCaptureModal
        isOpen={showEmailCapture}
        onEmailSubmitted={() => { }} // Not used when using delivery choice flow
        onEmailCaptured={handleEmailCaptured}
      />

      {/* Delivery Choice Modal */}
      <DeliveryChoiceModal
        isOpen={showDeliveryChoice}
        email={capturedEmail}
        filename={file ? file.name.replace('.pdf', '_signed.pdf') : 'signed.pdf'}
        fileBlob={signedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
