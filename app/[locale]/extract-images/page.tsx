'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import {
  Upload,
  Images,
  Download,
  Zap,
  Lock,
  X,
  Loader2,
  UploadCloud,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { validateFile, downloadBlob } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { initializePdfJsWorker } from '@/lib/pdfjs-init';
import { createZipAndDownload } from '@/lib/zip-generation';
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PAGES = 200;
const MAX_IMAGES = 500;
const MIN_DIMENSION = 16; // skip tiny images (usually masks/artifacts)
const RESOLVE_TIMEOUT_MS = 3000;

/** Matches the ENCRYPTED_PDF errorCode contract used across the app. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string; name?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  (error as { name?: string } | null)?.name === 'PasswordException' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted|PasswordException/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

interface ExtractedImage {
  /** pdfjs object name — used to dedupe the same image reused across pages */
  name: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  pageFirstSeen: number;
}

/** Minimal structural types so we never statically import pdfjs-dist. */
interface PdfObjectStore {
  get: (objId: string, callback?: (data: unknown) => void) => unknown;
  has: (objId: string) => boolean;
}

interface PdfImageObject {
  width?: number;
  height?: number;
  kind?: number;
  data?: Uint8ClampedArray | Uint8Array | null;
  bitmap?: ImageBitmap | null;
}

// pdfjs ImageKind constants (stable across pdfjs versions)
const IMAGE_KIND_GRAYSCALE_1BPP = 1;
const IMAGE_KIND_RGB_24BPP = 2;
const IMAGE_KIND_RGBA_32BPP = 3;

/**
 * Resolve an image XObject by name from the page's object stores.
 * pdfjs 3.x: the synchronous objs.get(name) THROWS if the object hasn't been
 * resolved yet, so prefer has() + sync get, then fall back to the callback
 * form with a timeout (the callback never fires for objects that never resolve).
 * Globally-cached images (names prefixed "g_") live in page.commonObjs.
 */
async function resolveImageObject(
  objs: PdfObjectStore,
  commonObjs: PdfObjectStore,
  name: string
): Promise<PdfImageObject | null> {
  const stores = name.startsWith('g_') ? [commonObjs, objs] : [objs, commonObjs];

  // Fast path: already resolved in one of the stores
  for (const store of stores) {
    try {
      if (store.has(name)) {
        const value = store.get(name);
        if (value) return value as PdfImageObject;
      }
    } catch {
      // sync get threw (unresolved) — fall through to the callback form
    }
  }

  // Callback form on the most likely store, guarded by a timeout
  const primary = stores[0];
  return new Promise<PdfImageObject | null>((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, RESOLVE_TIMEOUT_MS);
    try {
      primary.get(name, (data: unknown) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve((data as PdfImageObject) ?? null);
        }
      });
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

/** Convert a resolved pdfjs image object into a PNG blob via canvas. */
async function imageObjectToPngBlob(img: PdfImageObject): Promise<Blob | null> {
  const width = img.width ?? 0;
  const height = img.height ?? 0;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (img.bitmap) {
    // Browser-decoded image (e.g. JPEG) — pdfjs hands us an ImageBitmap
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    const src =
      img.data instanceof Uint8ClampedArray
        ? img.data
        : new Uint8ClampedArray(img.data.buffer, img.data.byteOffset, img.data.byteLength);
    const pixels = width * height;
    // Fresh allocation so the backing buffer is a plain ArrayBuffer (ImageData requirement)
    let rgba: Uint8ClampedArray<ArrayBuffer>;

    if (img.kind === IMAGE_KIND_RGBA_32BPP || src.length === pixels * 4) {
      if (src.length < pixels * 4) return null;
      rgba = new Uint8ClampedArray(pixels * 4);
      rgba.set(src.subarray(0, pixels * 4));
    } else if (img.kind === IMAGE_KIND_RGB_24BPP || src.length === pixels * 3) {
      if (src.length < pixels * 3) return null;
      // Expand 3-channel RGB to RGBA
      rgba = new Uint8ClampedArray(pixels * 4);
      for (let i = 0, j = 0; i < pixels; i++, j += 3) {
        const k = i * 4;
        rgba[k] = src[j];
        rgba[k + 1] = src[j + 1];
        rgba[k + 2] = src[j + 2];
        rgba[k + 3] = 255;
      }
    } else if (img.kind === IMAGE_KIND_GRAYSCALE_1BPP || src.length === ((width + 7) >> 3) * height) {
      // 1 bit per pixel, rows padded to byte boundaries
      const rowBytes = (width + 7) >> 3;
      rgba = new Uint8ClampedArray(pixels * 4);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const bit = (src[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
          const v = bit ? 255 : 0;
          const k = (y * width + x) * 4;
          rgba[k] = v;
          rgba[k + 1] = v;
          rgba[k + 2] = v;
          rgba[k + 3] = 255;
        }
      }
    } else if (src.length === pixels) {
      // 8-bit grayscale
      rgba = new Uint8ClampedArray(pixels * 4);
      for (let i = 0; i < pixels; i++) {
        const v = src[i];
        const k = i * 4;
        rgba[k] = v;
        rgba[k + 1] = v;
        rgba[k + 2] = v;
        rgba[k + 3] = 255;
      }
    } else {
      return null; // unknown layout — skip rather than emit garbage
    }

    ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  } else {
    return null;
  }

  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export default function ExtractImagesPage() {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDone, setIsDone] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const [pageCapHit, setPageCapHit] = useState(false);
  const [imageCapHit, setImageCapHit] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);

  // Track every object URL we create so we can revoke them all
  const objectUrlsRef = useRef<string[]>([]);

  const revokeAllUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  }, []);

  // Revoke object URLs on unmount
  useEffect(() => revokeAllUrls, [revokeAllUrls]);

  const resetState = useCallback(() => {
    revokeAllUrls();
    setFile(null);
    setImages([]);
    setSelected(new Set());
    setIsDone(false);
    setProgress(null);
    setPageCapHit(false);
    setImageCapHit(false);
    setInlineError(null);
    setShowEncryptedHint(false);
  }, [revokeAllUrls]);

  const extractImages = useCallback(
    async (pdfFile: File) => {
      setIsProcessing(true);
      setInlineError(null);
      setShowEncryptedHint(false);
      setPageCapHit(false);
      setImageCapHit(false);
      const trackStart = Date.now();
      trackToolStart('extract_images');

      interface PdfDocLike {
        numPages: number;
        getPage: (n: number) => Promise<unknown>;
        destroy: () => Promise<void>;
      }
      let pdf: PdfDocLike | null = null;

      try {
        const pdfjsLib = await initializePdfJsWorker();
        if (!pdfjsLib) throw new Error(t('extractImages.failedToExtract'));

        const data = await pdfFile.arrayBuffer();
        pdf = (await pdfjsLib.getDocument({ data }).promise) as unknown as PdfDocLike;

        const totalPages = Math.min(pdf.numPages, MAX_PAGES);
        if (pdf.numPages > MAX_PAGES) setPageCapHit(true);

        const found = new Map<string, ExtractedImage>();
        const skipped = new Set<string>();
        let hitImageCap = false;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          setProgress({ current: pageNum, total: totalPages });

          const page = (await pdf.getPage(pageNum)) as {
            getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
            objs: PdfObjectStore;
            commonObjs: PdfObjectStore;
            cleanup: () => void;
          };

          const ops = await page.getOperatorList();
          const names: string[] = [];
          for (let i = 0; i < ops.fnArray.length; i++) {
            const fn = ops.fnArray[i];
            if (
              fn === pdfjsLib.OPS.paintImageXObject ||
              fn === pdfjsLib.OPS.paintImageXObjectRepeat
            ) {
              const name = ops.argsArray[i]?.[0];
              if (typeof name === 'string' && name) names.push(name);
            }
          }

          for (const name of names) {
            if (found.has(name) || skipped.has(name)) continue; // dedupe reused images
            if (found.size >= MAX_IMAGES) {
              hitImageCap = true;
              break;
            }

            const imgObj = await resolveImageObject(page.objs, page.commonObjs, name);
            if (!imgObj || !imgObj.width || !imgObj.height) {
              skipped.add(name);
              continue;
            }
            if (imgObj.width < MIN_DIMENSION || imgObj.height < MIN_DIMENSION) {
              skipped.add(name); // tiny images are usually masks/artifacts
              continue;
            }

            const blob = await imageObjectToPngBlob(imgObj);
            if (!blob) {
              skipped.add(name);
              continue;
            }

            const url = URL.createObjectURL(blob);
            objectUrlsRef.current.push(url);
            found.set(name, {
              name,
              blob,
              url,
              width: imgObj.width,
              height: imgObj.height,
              pageFirstSeen: pageNum,
            });
          }

          try {
            page.cleanup();
          } catch {
            // page.cleanup() can throw if resources are in use — safe to ignore
          }

          if (hitImageCap) {
            setImageCapHit(true);
            break;
          }
        }

        const result = Array.from(found.values());
        setImages(result);
        setSelected(new Set(result.map((img) => img.name)));
        setIsDone(true);
        trackToolComplete('extract_images', Date.now() - trackStart, {
          images_found: result.length,
        });
      } catch (error) {
        trackToolError('extract_images', error, Date.now() - trackStart);
        console.error('Error extracting images:', error);
        setInlineError(
          error instanceof Error && !isEncryptedPdfError(error)
            ? error.message
            : t('extractImages.failedToExtract')
        );
        if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
        setFile(null);
      } finally {
        if (pdf) {
          try {
            await pdf.destroy();
          } catch {
            // ignore cleanup failures
          }
        }
        setProgress(null);
        setIsProcessing(false);
      }
    },
    [t]
  );

  const handleNewFile = useCallback(
    async (newFile: File) => {
      const error = validateFile(newFile, MAX_FILE_SIZE);
      if (error) {
        setInlineError(`${newFile.name}: ${error}`);
        return;
      }
      resetState();
      setIsUploading(true);
      // Small delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 300));
      setFile(newFile);
      setIsUploading(false);
      extractImages(newFile);
    },
    [resetState, extractImages]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      handleNewFile(acceptedFiles[0]);
    },
    [handleNewFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading || isProcessing,
  });

  const toggleImage = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(images.map((img) => img.name)));
  const deselectAll = () => setSelected(new Set());

  const baseName = (file?.name ?? 'document.pdf').replace(/\.pdf$/i, '');

  async function handleDownloadSelected() {
    const chosen = images.filter((img) => selected.has(img.name));
    if (chosen.length === 0) return;

    // Exactly one image selected → download it directly as PNG, no ZIP
    if (chosen.length === 1) {
      downloadBlob(chosen[0].blob, `${baseName}_image_1.png`);
      return;
    }

    setIsZipping(true);
    try {
      const zipFiles = await Promise.all(
        chosen.map(async (img, idx) => ({
          name: `${baseName}_image_${String(idx + 1).padStart(3, '0')}_${img.width}x${img.height}.png`,
          bytes: new Uint8Array(await img.blob.arrayBuffer()),
        }))
      );
      await createZipAndDownload(zipFiles, `${baseName}_images.zip`);
    } catch (error) {
      console.error('Error creating ZIP:', error);
      setInlineError(t('extractImages.failedToExtract'));
    } finally {
      setIsZipping(false);
    }
  }

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('extractImages.steps.upload.title'),
      description: t('extractImages.steps.upload.description'),
    },
    {
      icon: <Images className="h-8 w-8 text-primary" />,
      title: t('extractImages.steps.extract.title'),
      description: t('extractImages.steps.extract.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('extractImages.steps.download.title'),
      description: t('extractImages.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('extractImages');

  const selectedCount = selected.size;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Extract Images from PDF', url: '/extract-images' }]} />
      <HowToSchema
        name="How to Extract Images from a PDF"
        description="Learn how to extract embedded images from a PDF for free, directly in your browser"
        steps={steps.map((step) => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('extractImages.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('extractImages.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col mx-auto max-w-5xl">
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
              <div className="flex flex-col">
                <div
                  {...getRootProps()}
                  className={`
                      relative flex min-h-[500px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16
                      border-2 border-dashed transition-colors duration-200
                      ${isUploading || isProcessing ? 'cursor-wait' : 'cursor-pointer'}
                      ${isProcessing ? 'opacity-50' : ''}
                      ${isUploading ? 'border-primary bg-orange-50' : isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}
                    `}
                >
                  <input {...getInputProps()} disabled={isUploading || isProcessing} />

                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`rounded-full p-4 ${isUploading ? 'bg-orange-100' : isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
                      {isUploading || isProcessing ? (
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                      ) : (
                        <UploadCloud className={`h-12 w-12 ${isDragActive ? 'text-green-600' : 'text-primary'}`} />
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('common.dropPdfHere')}
                      </h2>
                      <p className="text-gray-700">
                        {isProcessing
                          ? t('common.pleaseWait')
                          : isUploading
                            ? t('common.processingFile')
                            : t('common.orClickToBrowse')
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isUploading || isProcessing}
                      className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium hover:bg-[#FF8B68] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-none"
                    >
                      {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('common.selectPdf')}
                    </button>

                    {/* Google Drive Integration */}
                    <div className="mt-4">
                      <GoogleDrivePicker
                        onFilesSelected={(files) => {
                          if (files.length === 0) return;
                          handleNewFile(files[0]);
                        }}
                        disabled={isProcessing}
                        multiple={false}
                        accept={['application/pdf']}
                      />
                    </div>

                    <p className="mt-4 text-sm text-gray-500">
                      {t('extractImages.processedLocally')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-12">
                {/* Left Column: results */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  {/* File info header */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 truncate">{file.name}</h3>
                      {isDone && (
                        <p className="text-sm text-gray-500">
                          {t('extractImages.imagesFound', { count: images.length })}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={resetState}
                      disabled={isProcessing}
                      className="shrink-0 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('common.uploadDifferentFile')}
                    </button>
                  </div>

                  {/* Progress */}
                  {isProcessing && progress && (
                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
                      <div className="flex items-center gap-3 mb-3">
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        <p className="font-medium text-gray-900">
                          {t('extractImages.scanningPage', { current: progress.current, total: progress.total })}
                        </p>
                      </div>
                      <div className="h-2 w-full rounded-full bg-orange-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-200"
                          style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Honest cap notices */}
                  {pageCapHit && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-700">
                      {t('extractImages.pageLimitNotice', { count: MAX_PAGES })}
                    </div>
                  )}
                  {imageCapHit && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-700">
                      {t('extractImages.imageLimitNotice', { count: MAX_IMAGES })}
                    </div>
                  )}

                  {/* Results */}
                  {isDone && images.length === 0 && (
                    <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                        <Images className="h-7 w-7 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {t('extractImages.noImagesFound')}
                      </h3>
                      <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
                        {t('extractImages.noImagesFoundDesc')}
                      </p>
                      <Link
                        href="/pdf-to-images"
                        className="inline-block font-medium text-primary underline hover:no-underline"
                      >
                        {t('extractImages.tryPdfToImages')}
                      </Link>
                    </div>
                  )}

                  {isDone && images.length > 0 && (
                    <>
                      {/* Selection controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700">
                          {t('extractImages.selectedCount', { count: selectedCount })}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={selectAll}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            {t('extractImages.selectAll')}
                          </button>
                          <button
                            onClick={deselectAll}
                            className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            {t('extractImages.deselectAll')}
                          </button>
                        </div>
                      </div>

                      {/* Thumbnail grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[560px] overflow-y-auto p-2">
                        {images.map((img) => {
                          const isSelected = selected.has(img.name);
                          return (
                            <button
                              key={img.name}
                              type="button"
                              onClick={() => toggleImage(img.name)}
                              aria-pressed={isSelected}
                              className={`relative flex flex-col rounded-lg border-2 bg-gray-50 text-start transition-colors ${
                                isSelected ? 'border-primary' : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="absolute top-2 start-2 z-10 rounded bg-white/90 p-0.5">
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-primary" />
                                ) : (
                                  <Square className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                              <div className="aspect-square w-full overflow-hidden rounded-t-md bg-[repeating-conic-gradient(#f3f4f6_0%_25%,white_0%_50%)] bg-[length:16px_16px]">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img.url}
                                  alt={`${img.width}×${img.height}`}
                                  loading="lazy"
                                  className="h-full w-full object-contain"
                                />
                              </div>
                              <div className="flex items-center justify-between px-2 py-1.5 text-xs text-gray-500">
                                <span>{img.width}×{img.height}</span>
                                <span>{t('common.page')} {img.pageFirstSeen}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Download */}
                      <button
                        onClick={handleDownloadSelected}
                        disabled={selectedCount === 0 || isZipping}
                        className="w-full px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isZipping ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Download className="h-5 w-5" />
                        )}
                        {isZipping
                          ? t('common.processing')
                          : t('extractImages.downloadSelected', { count: selectedCount })}
                      </button>
                    </>
                  )}
                </div>

                {/* Right Column: Instructions Panel */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                        <Images className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{t('extractImages.howItWorks')}</h3>
                        <p className="text-sm text-gray-500">{t('extractImages.howItWorksDesc')}</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      {steps.map((step, index) => (
                        <div key={index} className="flex items-start gap-4">
                          <div className="flex-shrink-0 mt-1">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 border border-orange-100">
                              {step.icon}
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{step.title}</h4>
                            <p className="mt-1 text-sm text-gray-500 leading-relaxed">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                      <p className="text-sm text-gray-500 font-medium">
                        {t('extractImages.processedLocally')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/extract-images/faq" />

      {/* Why Section */}
      <section className="py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-dark mb-12">
            {t('why.title')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* No Sign-up Card */}
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-orange-100 rounded-xl p-3 w-fit mb-4">
                <Zap className="w-7 h-7 text-primary" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">
                {t('why.noSignup.title')}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {t('why.noSignup.description')}
              </p>
            </div>

            {/* Auto-delete Card */}
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-teal-100 rounded-xl p-3 w-fit mb-4">
                <Lock className="w-7 h-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">
                {t('why.autoDelete.title')}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {t('why.autoDelete.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Tools */}
      <RelatedTools currentTool="extractImages" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
