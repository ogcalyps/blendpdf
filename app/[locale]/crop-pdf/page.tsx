'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Crop, Download, Zap, Lock, X, ChevronLeft, ChevronRight, UploadCloud, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { validateFile, downloadBlob } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { CropPDFPreview, CropSelection } from '@/components/CropPDFPreview';
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
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

/** Matches the ENCRYPTED_PDF errorCode contract used across the tools. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  (error as { name?: string } | null)?.name === 'PasswordException' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function CropPDFPage() {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selection, setSelection] = useState<CropSelection | null>(null);
  const [applyToAll, setApplyToAll] = useState(true);
  const [pageInfo, setPageInfo] = useState<{ pdfWidth: number; pdfHeight: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
  const [croppedFilename, setCroppedFilename] = useState<string>('cropped.pdf');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);
  // pdfjs document proxy — kept for apply-time coordinate conversion
  const pdfDocRef = useRef<any>(null);

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
    fileBlob: croppedBlob,
    filename: croppedFilename,
    onDownload: () => {
      if (croppedBlob) {
        downloadBlob(croppedBlob, croppedFilename);
        setCroppedBlob(null);
      }
    },
    onReset: () => {
      setCroppedBlob(null);
    },
  });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const uploadedFile = acceptedFiles[0];
    const error = validateFile(uploadedFile, MAX_FILE_SIZE);

    if (error) {
      setInlineError(`${uploadedFile.name}: ${error}`);
      return;
    }

    setInlineError(null);
    setShowEncryptedHint(false);
    setIsUploading(true);
    // Small delay for visual feedback
    await new Promise(resolve => setTimeout(resolve, 300));
    setFile(uploadedFile);
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

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('cropPdf.steps.upload.title'),
      description: t('cropPdf.steps.upload.description'),
    },
    {
      icon: <Crop className="h-8 w-8 text-primary" />,
      title: t('cropPdf.steps.crop.title'),
      description: t('cropPdf.steps.crop.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('cropPdf.steps.download.title'),
      description: t('cropPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('cropPdf');

  // Manage object URL lifecycle
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setFileUrl(null);
    }
  }, [file]);

  // Load the document (page count + proxy for apply-time coordinate mapping)
  useEffect(() => {
    if (!file || !fileUrl) {
      setPageCount(0);
      setCurrentPage(1);
      setSelection(null);
      setPageInfo(null);
      pdfDocRef.current = null;
      return;
    }

    let cancelled = false;

    async function loadDocument() {
      if (!fileUrl) return;

      try {
        const pdfjsLib = await initializePdfJsWorker();
        if (!pdfjsLib || cancelled) return;
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        pdfDocRef.current = pdf;
        setPageCount(pdf.numPages);
        setCurrentPage(1);
        setSelection(null);
      } catch (error) {
        if (cancelled) return;
        console.error('Error loading PDF:', error);
        if (isEncryptedPdfError(error)) {
          setShowEncryptedHint(true);
          setInlineError(t('errors.encryptedPdf'));
        } else {
          setInlineError(t('errors.failedToReadPdf'));
        }
        setFile(null);
      }
    }

    loadDocument();

    return () => {
      cancelled = true;
      const pdf = pdfDocRef.current;
      pdfDocRef.current = null;
      if (pdf) {
        try {
          pdf.destroy();
        } catch {
          // Ignore teardown errors
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, fileUrl]);

  function resetTool() {
    setFile(null);
    setFileUrl(null);
    setPageCount(0);
    setCurrentPage(1);
    setSelection(null);
    setPageInfo(null);
  }

  async function handleCrop() {
    if (!file || !selection || !pdfDocRef.current) return;

    setIsProcessing(true);
    setInlineError(null);
    setShowEncryptedHint(false);
    const trackStart = Date.now();
    trackToolStart('crop_pdf');
    try {
      // 100% in-browser: pdf-lib is loaded on demand to keep first-load JS small.
      const { PDFDocument } = await import('pdf-lib');
      const bytes = await file.arrayBuffer();
      const libDoc = await PDFDocument.load(bytes);

      const pdf = pdfDocRef.current;
      const targetPages = applyToAll
        ? Array.from({ length: pageCount }, (_, i) => i + 1)
        : [currentPage];

      for (const pageNumber of targetPages) {
        // pdfjs renders from the page's CropBox with /Rotate baked into the
        // viewport. convertToPdfPoint applies the inverse viewport transform,
        // mapping visual (top-left origin, y-down) coordinates back to PDF
        // user space (y-up) — including rotation and CropBox origin offsets.
        const pjsPage = await pdf.getPage(pageNumber);
        const viewport = pjsPage.getViewport({ scale: 1 });

        // The same RELATIVE rectangle is applied to every page — pages can
        // differ in size, so project the fractions onto each page's viewport.
        const vx1 = selection.x * viewport.width;
        const vy1 = selection.y * viewport.height;
        const vx2 = (selection.x + selection.w) * viewport.width;
        const vy2 = (selection.y + selection.h) * viewport.height;

        const [px1, py1] = viewport.convertToPdfPoint(vx1, vy1) as [number, number];
        const [px2, py2] = viewport.convertToPdfPoint(vx2, vy2) as [number, number];

        const cropX = Math.min(px1, px2);
        const cropY = Math.min(py1, py2);
        const cropWidth = Math.abs(px2 - px1);
        const cropHeight = Math.abs(py2 - py1);

        // Only the CropBox changes — the MediaBox (and all content) is left
        // untouched, so cropping hides rather than deletes and is reversible.
        libDoc.getPage(pageNumber - 1).setCropBox(cropX, cropY, cropWidth, cropHeight);
      }

      const outBytes = await libDoc.save();
      const blob = new Blob([new Uint8Array(outBytes)], { type: 'application/pdf' });

      if (blob.size === 0) {
        throw new Error(t('cropPdf.failedToCrop'));
      }

      const filename = 'cropped-' + file.name;

      // Store blob and trigger email capture
      setCroppedBlob(blob);
      setCroppedFilename(filename);
      trackToolComplete('crop_pdf', Date.now() - trackStart);
      triggerEmailCapture();
    } catch (error) {
      trackToolError('crop_pdf', error, Date.now() - trackStart);
      console.error('Error cropping PDF:', error);
      setInlineError(error instanceof Error ? error.message : t('cropPdf.failedToCrop'));
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    } finally {
      setIsProcessing(false);
    }
  }

  // Live selection readout in PDF points and as % of the (visual) page
  const readout = selection && pageInfo
    ? {
        width: Math.round(selection.w * pageInfo.pdfWidth),
        height: Math.round(selection.h * pageInfo.pdfHeight),
        percentWidth: Math.round(selection.w * 100),
        percentHeight: Math.round(selection.h * 100),
      }
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Crop PDF', url: '/crop-pdf' }]} />
      <HowToSchema
        name="How to Crop PDF Pages"
        description="Learn how to crop PDF pages and trim margins online for free, directly in your browser"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('cropPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('cropPdf.description')}
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
                        onFilesSelected={async (files) => {
                          if (files.length === 0) return;
                          const uploadedFile = files[0];
                          const error = validateFile(uploadedFile, MAX_FILE_SIZE);
                          if (error) {
                            setInlineError(error);
                            return;
                          }
                          setInlineError(null);
                          setShowEncryptedHint(false);
                          setFile(uploadedFile);
                        }}
                        disabled={isProcessing}
                        multiple={false}
                        accept={['application/pdf']}
                      />
                    </div>

                    <p className="mt-4 text-sm text-gray-500">
                      {t('common.maxFileSize')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-8 lg:grid-cols-12">
                  {/* Left Column: File Info, Preview, Controls */}
                  <div className="lg:col-span-8 flex flex-col gap-6">

                    {/* File info header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{file.name}</h3>
                        <p className="text-sm text-gray-500">{pageCount} {pageCount === 1 ? t('common.page') : t('common.pages')}</p>
                      </div>
                      <button
                        onClick={resetTool}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('common.uploadDifferentFile')}
                      </button>
                    </div>

                    {/* Drag hint + selection readout */}
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm text-gray-700">{t('cropPdf.dragHint')}</p>
                      {readout ? (
                        <p className="text-sm font-semibold text-gray-900">
                          {t('cropPdf.selectionSize')}:{' '}
                          {t('cropPdf.selectionReadout', {
                            width: readout.width,
                            height: readout.height,
                            percentWidth: readout.percentWidth,
                            percentHeight: readout.percentHeight,
                          })}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">{t('cropPdf.noSelection')}</p>
                      )}
                    </div>

                    {/* Page preview with drag-to-crop overlay */}
                    {fileUrl && pageCount > 0 && (
                      <CropPDFPreview
                        fileUrl={fileUrl}
                        pageNumber={currentPage}
                        selection={selection}
                        onSelectionChange={setSelection}
                        onPageInfo={setPageInfo}
                      />
                    )}

                    {/* Page navigation */}
                    {pageCount > 1 && (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage <= 1 || isProcessing}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={t('cropPdf.previousPage')}
                        >
                          <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
                        </button>
                        <span className="text-sm font-medium text-gray-700">
                          {t('cropPdf.pageIndicator', { current: currentPage, total: pageCount })}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                          disabled={currentPage >= pageCount || isProcessing}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label={t('cropPdf.nextPage')}
                        >
                          <ChevronRight className="w-5 h-5 rtl:rotate-180" />
                        </button>
                      </div>
                    )}

                    {/* Apply-to scope */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <p className="font-semibold text-gray-900 mb-3">{t('cropPdf.applyTo')}</p>
                      <div className="flex flex-wrap items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="crop-scope"
                            checked={applyToAll}
                            onChange={() => setApplyToAll(true)}
                            className="h-4 w-4 accent-[#FF6B35]"
                          />
                          <span className="text-sm text-gray-700">{t('cropPdf.applyToAllPages')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="crop-scope"
                            checked={!applyToAll}
                            onChange={() => setApplyToAll(false)}
                            className="h-4 w-4 accent-[#FF6B35]"
                          />
                          <span className="text-sm text-gray-700">{t('cropPdf.currentPageOnly')}</span>
                        </label>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-4 mt-2">
                      <button
                        onClick={handleCrop}
                        disabled={isProcessing || !selection}
                        className="flex-1 min-w-[200px] px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? t('common.processing') : t('cropPdf.applyCrop')}
                      </button>
                      <button
                        onClick={() => setSelection(null)}
                        disabled={isProcessing || !selection}
                        className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t('cropPdf.resetSelection')}
                      </button>
                      <button
                        onClick={resetTool}
                        disabled={isProcessing}
                        className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Instructions Panel */}
                  <div className="lg:col-span-4 flex flex-col gap-4">
                    <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                      <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                          <Crop className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{t('cropPdf.howItWorks')}</h3>
                          <p className="text-sm text-gray-500">{t('cropPdf.howItWorksDesc')}</p>
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
                          {t('cropPdf.inBrowserNote')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/crop-pdf/faq" />

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
      <RelatedTools currentTool="cropPdf" />

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
        filename={croppedFilename}
        fileBlob={croppedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
