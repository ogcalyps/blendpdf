'use client';

import { useState, useCallback, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Zap, Download, CheckCircle, Scissors, Lock, X } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { splitPDF } from '@/lib/api-client';
import { runPdfOpInWorker, shouldUseClientPdf, ClientPdfError } from '@/lib/client-pdf';
import { withToolTracking } from '@/lib/analytics';
import JSZip from 'jszip';
import { Link } from '@/i18n/routing';
import { PDFDocument } from 'pdf-lib';
import { Navigation } from '@/components/Navigation';
import { PageThumbnail } from '@/components/PageThumbnail';
import { useDropzone } from 'react-dropzone';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { validateFile, formatFileSize } from '@/lib/utils';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

type SplitMode = 'combined' | 'separate';

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

/**
 * Separate-files mode: /api/split with mode=separate returns an application/zip.
 * Same analytics contract as api-client's splitPDF.
 */
const splitPDFSeparate = withToolTracking(
  'split_pdf',
  'server',
  async (file: File, ranges: string): Promise<Blob> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('ranges', ranges);
      formData.append('mode', 'separate');

      const response = await fetch('/api/split', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const error = new Error(
          errorData?.error || errorData?.message || 'Failed to split PDF'
        ) as Error & { errorCode?: string };
        if (errorData?.errorCode) error.errorCode = String(errorData.errorCode);
        throw error;
      }

      const rawBlob = await response.blob();
      return new Blob([rawBlob], { type: 'application/zip' });
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Connection failed');
      }
      throw error;
    }
  }
);

/** Groups sorted, unique 1-based page numbers into contiguous runs (e.g. [1,2,3,7] -> [[1,2,3],[7]]). */
function toContiguousRuns(sortedPages: number[]): number[][] {
  const runs: number[][] = [];
  for (const page of sortedPages) {
    const current = runs[runs.length - 1];
    if (current && page === current[current.length - 1] + 1) {
      current.push(page);
    } else {
      runs.push([page]);
    }
  }
  return runs;
}

/**
 * Client-side combined split via the pdf Web Worker — the file never leaves
 * the device. Same analytics contract as api-client's splitPDF (server variant).
 */
const splitPDFClientSide = withToolTracking(
  'split_pdf',
  'client',
  async (file: File, sortedPages: number[]): Promise<Blob> => {
    // The buffer is TRANSFERRED to the worker (detached after the call) —
    // on fallback, re-read from the original File object.
    const bytes = await runPdfOpInWorker({
      op: 'split',
      buffer: await file.arrayBuffer(),
      pageIndices: sortedPages.map((p) => p - 1),
    });
    return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  }
);

/**
 * Client-side separate-files split: one PDF per contiguous run of selected
 * pages, zipped in the browser. Mirrors the server's /api/split mode=separate
 * output (same per-range grouping and pages-NNN[-MMM].pdf entry names).
 */
const splitPDFSeparateClientSide = withToolTracking(
  'split_pdf',
  'client',
  async (
    file: File,
    sortedPages: number[],
    totalPageCount: number,
    onProgress: (percent: number) => void
  ): Promise<Blob> => {
    const runs = toContiguousRuns(sortedPages);
    const zip = new JSZip();
    const pad = Math.max(3, String(totalPageCount).length);

    for (let i = 0; i < runs.length; i++) {
      const run = runs[i];
      // Each worker call detaches its buffer, so read a FRESH copy per run.
      const bytes = await runPdfOpInWorker({
        op: 'split',
        buffer: await file.arrayBuffer(),
        pageIndices: run.map((p) => p - 1),
      });
      const first = String(run[0]).padStart(pad, '0');
      const last = String(run[run.length - 1]).padStart(pad, '0');
      const entryName = run.length === 1 ? `pages-${first}.pdf` : `pages-${first}-${last}.pdf`;
      zip.file(entryName, bytes);
      onProgress(20 + Math.round(((i + 1) / runs.length) * 60));
    }

    return zip.generateAsync({
      type: 'blob',
      mimeType: 'application/zip',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
  }
);

export default function SplitPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number>(0);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>('combined');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('splitPdf.steps.upload.title'),
      description: t('splitPdf.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('splitPdf.steps.select.title'),
      description: t('splitPdf.steps.select.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('splitPdf.steps.download.title'),
      description: t('splitPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('splitPdf');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const uploadedFile = acceptedFiles[0];
      const error = validateFile(uploadedFile, MAX_FILE_SIZE);

      if (error) {
        setInlineError(error);
        return;
      }

      try {
        const buffer = await uploadedFile.arrayBuffer();
        const pdf = await PDFDocument.load(buffer);
        setInlineError(null);
        setShowEncryptedHint(false);
        setPageCount(pdf.getPageCount());
        setFile(uploadedFile);
        setSelectedPages([]);
      } catch (error: any) {
        setInlineError(t('splitPdf.failedToRead'));
      }
    },
    [t]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: processing.isProcessing,
    noClick: false, // Allow clicking on the dropzone
  });

  const handleFileSelect = () => {
    // Use dropzone's open method instead of directly clicking the input
    open();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setPageCount(0);
    setSelectedPages([]);
    resetProcessing();
  };

  // Toggle single page selection
  function togglePageSelection(pageNumber: number) {
    setSelectedPages((prev) =>
      prev.includes(pageNumber)
        ? prev.filter((p) => p !== pageNumber)
        : [...prev, pageNumber].sort((a, b) => a - b)
    );
  }

  // Select all pages
  function selectAll() {
    setSelectedPages(Array.from({ length: pageCount }, (_, i) => i + 1));
  }

  // Clear selection
  function clearSelection() {
    setSelectedPages([]);
  }

  // Convert selected pages array to ranges string
  function pagesToRangesString(pages: number[]): string {
    if (pages.length === 0) return '';
    
    const sorted = [...pages].sort((a, b) => a - b);
    const ranges: string[] = [];
    let start = sorted[0];
    let end = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === end + 1) {
        end = sorted[i];
      } else {
        if (start === end) {
          ranges.push(String(start));
        } else {
          ranges.push(`${start}-${end}`);
        }
        start = sorted[i];
        end = sorted[i];
      }
    }

    if (start === end) {
      ranges.push(String(start));
    } else {
      ranges.push(`${start}-${end}`);
    }

    return ranges.join(', ');
  }

  // Extract selected pages
  async function handleExtract() {
    if (!file || selectedPages.length === 0) return;

    setShowEncryptedHint(false);
    try {
      setProcessing(true, 'split');

      // Client-first: process locally in a Web Worker when supported and small enough.
      if (shouldUseClientPdf(file.size)) {
        try {
          setProgress(20);
          const sortedPages = [...selectedPages].sort((a, b) => a - b);

          if (splitMode === 'separate') {
            const blob = await splitPDFSeparateClientSide(file, sortedPages, pageCount, setProgress);
            setProgress(100);
            setResult(blob, `${file.name.replace(/\.pdf$/i, '')}-split.zip`);
          } else {
            const blob = await splitPDFClientSide(file, sortedPages);
            setProgress(80);
            setProgress(100);
            setResult(blob, 'split.pdf');
          }
          return;
        } catch (clientError) {
          if (clientError instanceof ClientPdfError && !clientError.retryOnServer) {
            // The server would fail identically (e.g. encrypted input) — surface it.
            throw clientError;
          }
          console.warn('Client-side split failed, falling back to server:', clientError);
          // Fall through to the server path below (re-reads the original File,
          // since the client-path buffers were detached by the worker transfer).
        }
      }

      setProgress(30);

      // Convert selected pages to ranges string
      const rangesString = pagesToRangesString(selectedPages);

      if (splitMode === 'separate') {
        const result = await splitPDFSeparate(file, rangesString);
        setProgress(100);
        setResult(result, `${file.name.replace(/\.pdf$/i, '')}-split.zip`);
      } else {
        const result = await splitPDF(file, rangesString);
        setProgress(100);
        setResult(result, 'split.pdf');
      }
    } catch (error: any) {
      setError(error.message);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Split PDF', url: '/split-pdf' },
      ]} />
      <HowToSchema 
        name="How to Split PDF Files"
        description="Learn how to extract specific pages or divide PDF into multiple files online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('splitPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('splitPdf.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: Upload Zone or Page Grid */}
            <div className="flex flex-col gap-4">
              {inlineError && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
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
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-gray-700">
                  {t('errors.encryptedPdfHint')}{' '}
                  <Link href="/unlock-pdf" className="font-medium text-primary underline hover:no-underline">
                    {t('errors.unlockPdfCta')}
                  </Link>
                </div>
              )}
              {!file ? (
                // Upload zone
                <div
                  {...getRootProps()}
                  className={`
                    relative flex min-h-[500px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16
                    border-2 border-dashed transition-colors duration-200
                    ${processing.isProcessing ? 'cursor-wait' : 'cursor-pointer'}
                    ${processing.isProcessing ? 'opacity-50' : ''}
                    ${isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}
                  `}
                >
                  <input {...getInputProps()} disabled={processing.isProcessing} />
                  
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`rounded-full p-4 ${isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <Upload className={`h-12 w-12 ${isDragActive ? 'text-green-600' : 'text-primary'}`} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {t('splitPdf.dropPdfHere')}
                      </h2>
                      <p className="text-gray-700">
                        {t('splitPdf.orClickToBrowse')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={processing.isProcessing}
                      className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium hover:bg-[#FF8B68] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-none"
                    >
                      {t('splitPdf.chooseFile')}
                    </button>
                    
                    {/* Google Drive Integration */}
                    <div className="mt-4">
                      <GoogleDrivePicker
                        onFilesSelected={async (files) => {
                          if (files.length === 0) return;
                          const uploadedFile = files[0];
                          const error = validateFile(uploadedFile, MAX_FILE_SIZE);
                          if (error) {
                            setInlineError(error);
                            return;
                          }
                          try {
                            const buffer = await uploadedFile.arrayBuffer();
                            const pdf = await PDFDocument.load(buffer);
                            setInlineError(null);
                            setShowEncryptedHint(false);
                            setPageCount(pdf.getPageCount());
                            setFile(uploadedFile);
                            setSelectedPages([]);
                          } catch (error: any) {
                            setInlineError(t('splitPdf.failedToRead'));
                          }
                        }}
                        disabled={processing.isProcessing}
                        multiple={false}
                        accept={['application/pdf']}
                      />
                    </div>
                    
                    <p className="mt-4 text-sm text-gray-500">
                      {t('splitPdf.maxFileSize')}
                    </p>
                  </div>
                </div>
              ) : (
                // Page selection grid
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-8">
              {/* File info header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 truncate" title={file.name}>
                    {file.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {pageCount} {pageCount === 1 ? t('splitPdf.page') : t('splitPdf.pages')} • {formatFileSize(file.size, locale)}
                  </p>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {t('splitPdf.uploadDifferentFile')}
                </button>
              </div>

                {/* Selection counter and bulk actions */}
                {selectedPages.length > 0 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-semibold text-gray-900">
                        {t('splitPdf.pagesSelected', { count: selectedPages.length })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('splitPdf.pagesLabel')} {selectedPages.sort((a, b) => a - b).join(', ')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAll}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      {t('splitPdf.selectAll')}
                    </button>
                    <button
                      onClick={clearSelection}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                    >
                      {t('common.clear')}
                    </button>
                  </div>
                </div>
              )}

                  {/* Visual page grid */}
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNumber) => (
                      <PageThumbnail
                        key={pageNumber}
                        file={file}
                        pageNumber={pageNumber}
                        isSelected={selectedPages.includes(pageNumber)}
                        onToggle={() => togglePageSelection(pageNumber)}
                      />
                    ))}
                  </div>

                  {/* Output mode toggle */}
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-2">{t('splitPdf.outputMode')}</p>
                    <div className="inline-flex bg-orange-50 rounded-lg p-1 border border-orange-100">
                      <button
                        type="button"
                        onClick={() => setSplitMode('combined')}
                        disabled={processing.isProcessing}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${splitMode === 'combined' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-orange-100/50'}`}
                      >
                        {t('splitPdf.modeCombined')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSplitMode('separate')}
                        disabled={processing.isProcessing}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${splitMode === 'separate' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-orange-100/50'}`}
                      >
                        {t('splitPdf.modeSeparate')}
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleExtract}
                      disabled={selectedPages.length === 0 || processing.isProcessing}
                      className="flex-1 px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {t('splitPdf.extractSelected', { count: selectedPages.length })}
                    </button>
                    <button
                      onClick={handleRemoveFile}
                      className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>
              )}
              <p className="text-center text-xs text-gray-500">
                {t('clientSide.processedLocally')}{' '}
                <span className="text-gray-400">{t('clientSide.fallbackNote')}</span>
              </p>
            </div>

            {/* Right: Instructions Panel */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border-2 border-orange-100 bg-white p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <Scissors className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-dark">{t('splitPdf.howItWorks')}</h3>
                    <p className="text-sm text-gray-600">{t('splitPdf.howItWorksDesc')}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                          {step.icon}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-dark">{step.title}</h4>
                        <p className="mt-1 text-sm text-gray-600">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/split-pdf/faq" />

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
      <RelatedTools currentTool="split" />

      {/* Footer */}
      <Footer />

      <ProcessingModal
        isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)}
        progress={processing.progress}
        currentTool={processing.currentTool}
        error={processing.error}
        onClose={resetProcessing}
        onRetry={handleExtract}
      />
    </div>
  );
}
