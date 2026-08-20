'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, ArrowUpDown, Download, Zap, Lock, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { validateFile } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { ReorderPageGrid } from '@/components/ReorderPageGrid';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';
import { DeliveryChoiceModal } from '@/components/DeliveryChoiceModal';
import { useDeliveryChoice } from '@/hooks/useDeliveryChoice';
import { initializePdfJsWorker } from '@/lib/pdfjs-init';
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { runPdfOpInWorker, shouldUseClientPdf, ClientPdfError } from '@/lib/client-pdf';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function ReorderPDFPage() {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageOrder, setPageOrder] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [reorderedBlob, setReorderedBlob] = useState<Blob | null>(null);
  const [reorderedFilename, setReorderedFilename] = useState<string>('reordered.pdf');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);

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
    fileBlob: reorderedBlob,
    filename: reorderedFilename,
    onDownload: () => {
      if (reorderedBlob) {
        const url = window.URL.createObjectURL(reorderedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = reorderedFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        setReorderedBlob(null);
      }
    },
    onReset: () => {
      setReorderedBlob(null);
    },
  });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('reorderPdf.steps.upload.title'),
      description: t('reorderPdf.steps.upload.description'),
    },
    {
      icon: <ArrowUpDown className="h-8 w-8 text-primary" />,
      title: t('reorderPdf.steps.reorder.title'),
      description: t('reorderPdf.steps.reorder.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('reorderPdf.steps.download.title'),
      description: t('reorderPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('reorderPdf');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    const error = validateFile(file, MAX_FILE_SIZE);

    if (error) {
      setInlineError(`${file.name}: ${error}`);
      return;
    }

    setInlineError(null);
    setShowEncryptedHint(false);
    setIsUploading(true);
    await new Promise(resolve => setTimeout(resolve, 300));
    setFile(file);
    setIsUploading(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading || isProcessing,
  });

  // Get total page count and initialize page order
  useEffect(() => {
    if (!file) {
      setPageCount(0);
      setPageOrder([]);
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
        // Initialize with natural order [1, 2, 3, ...]
        setPageOrder(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
      } catch (error) {
        console.error('Error loading PDF:', error);
        setInlineError(t('errors.failedToReadPdf'));
        setFile(null);
      }
    }

    getPageCount();
  }, [file]);

  async function handleReorder() {
    if (!file) return;

    setIsProcessing(true);
    setInlineError(null);
    setShowEncryptedHint(false);
    const trackStart = Date.now();
    trackToolStart('reorder_pdf');

    // Client-first: run the reorder locally in a Web Worker when supported.
    if (shouldUseClientPdf(file.size)) {
      try {
        // NOTE: the buffer is transferred to the worker and detached — the
        // server fallback below rebuilds its FormData from the original File.
        const buffer = await file.arrayBuffer();
        const bytes = await runPdfOpInWorker({ op: 'reorder', buffer, pageOrder });
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        const filename = file.name.replace('.pdf', '_reordered.pdf');

        setReorderedBlob(blob);
        setReorderedFilename(filename);
        trackToolComplete('reorder_pdf', Date.now() - trackStart);
        triggerEmailCapture();
        setIsProcessing(false);
        return;
      } catch (err) {
        if (err instanceof ClientPdfError && !err.retryOnServer) {
          // Same failure would happen server-side (e.g. encrypted PDF) —
          // surface it through the existing error UI instead of re-uploading.
          trackToolError('reorder_pdf', err, Date.now() - trackStart);
          console.error('Error reordering PDF:', err);
          setInlineError(err.message || t('reorderPdf.failedToReorder'));
          if (err.code === 'ENCRYPTED_PDF' || isEncryptedPdfError(err)) setShowEncryptedHint(true);
          setIsProcessing(false);
          return;
        }
        console.warn('[client-pdf] falling back to server:', err);
      }
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pageOrder', JSON.stringify(pageOrder));

      const response = await fetch('/api/reorder-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const error = new Error(
          errorData?.error || errorData?.message || t('reorderPdf.failedToReorder')
        ) as Error & { errorCode?: string };
        if (errorData?.errorCode) error.errorCode = String(errorData.errorCode);
        throw error;
      }

      const rawBlob = await response.blob();
      const blob = new Blob([rawBlob], { type: 'application/pdf' });
      const filename = file.name.replace('.pdf', '_reordered.pdf');

      // Store blob and trigger email capture
      setReorderedBlob(blob);
      setReorderedFilename(filename);
      trackToolComplete('reorder_pdf', Date.now() - trackStart);
      triggerEmailCapture();
    } catch (error) {
      trackToolError('reorder_pdf', error, Date.now() - trackStart);
      console.error('Error reordering PDF:', error);
      setInlineError(error instanceof Error ? error.message : t('reorderPdf.failedToReorder'));
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    } finally {
      setIsProcessing(false);
    }
  }

  function resetOrder() {
    setPageOrder(Array.from({ length: pageCount }, (_, i) => i + 1));
  }

  const initialOrder = Array.from({ length: pageCount }, (_, i) => i + 1);
  const hasChanges = JSON.stringify(pageOrder) !== JSON.stringify(initialOrder);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Reorder PDF', url: '/reorder-pdf' }]} />
      <HowToSchema
        name="How to Reorder PDF Pages"
        description="Learn how to rearrange PDF pages by drag and drop online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('reorderPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('reorderPdf.description')}
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
                          <Loader2 className={`h-12 w-12 ${isUploading ? 'text-primary' : 'text-primary'} animate-spin`} />
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
                          onFilesSelected={async (files) => {
                            if (files.length === 0) return;
                            const uploadedFile = files[0];
                            const error = validateFile(uploadedFile, MAX_FILE_SIZE);
                            if (error) {
                              setInlineError(error);
                              return;
                            }
                            try {
                              const pdfjsLib = await initializePdfJsWorker();
                              if (!pdfjsLib) return;
                              const arrayBuffer = await uploadedFile.arrayBuffer();
                              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                              setInlineError(null);
                              setShowEncryptedHint(false);
                              setPageCount(pdf.numPages);
                              setPageOrder(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
                              setFile(uploadedFile);
                            } catch (error) {
                              setInlineError(t('errors.failedToReadPdf'));
                            }
                          }}
                          disabled={isProcessing}
                          multiple={false}
                          accept={['application/pdf']}
                        />
                      </div>

                      <p className="mt-4 text-sm text-gray-500">
                        {t('common.maxFileSize')}
                      </p>

                      <p className="text-sm text-gray-600">
                        {t('clientSide.processedLocally')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {t('clientSide.fallbackNote')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* File info header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{file.name}</h3>
                      <p className="text-sm text-gray-500">{pageCount} {pageCount === 1 ? t('common.page') : t('common.pages')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {hasChanges && (
                        <button
                          onClick={resetOrder}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                        >
                          {t('reorderPdf.resetOrder')}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setFile(null);
                          setPageOrder([]);
                          setPageCount(0);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        {t('common.uploadDifferentFile')}
                      </button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">{t('reorderPdf.howItWorks')}</p>
                        <p className="text-sm text-gray-600">
                          {t('reorderPdf.instructions')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Draggable page grid */}
                  <div className="p-2">
                    <ReorderPageGrid
                      file={file}
                      pageOrder={pageOrder}
                      onReorder={setPageOrder}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleReorder}
                      disabled={isProcessing || !hasChanges}
                      className="flex-1 px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? t('common.processing') : t('reorderPdf.applyReorder')}
                    </button>
                    <button
                      onClick={() => {
                        setFile(null);
                        setPageOrder([]);
                        setPageCount(0);
                      }}
                      className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    {t('clientSide.processedLocally')}{' '}
                    <span className="text-gray-400">{t('clientSide.fallbackNote')}</span>
                  </p>
                </>
              )}
            </div>

            {/* Right: Instructions Panel */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border-2 border-orange-100 bg-white p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <ArrowUpDown className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-dark">{t('reorderPdf.howItWorks')}</h3>
                    <p className="text-sm text-gray-600">{t('reorderPdf.howItWorksDesc')}</p>
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

                {file && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <p className="text-sm text-gray-500 text-center">
                      {!hasChanges ? t('reorderPdf.dragToReorder') : t('reorderPdf.pagesMoved', { count: pageOrder.filter((p, i) => p !== i + 1).length })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/reorder-pdf/faq" />

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
      <RelatedTools currentTool="reorder" />

      {/* Footer */}
      <Footer />

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
        filename={reorderedFilename}
        fileBlob={reorderedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
