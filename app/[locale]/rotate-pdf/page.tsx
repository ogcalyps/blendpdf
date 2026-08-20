'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, RotateCw, Download, RotateCcw, Zap, Lock, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { validateFile, downloadBlob } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { RotatePDFThumbnail } from '@/components/RotatePDFThumbnail';
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

export default function RotatePDFPage() {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageRotations, setPageRotations] = useState<{ [key: number]: number }>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [rotatedBlob, setRotatedBlob] = useState<Blob | null>(null);
  const [rotatedFilename, setRotatedFilename] = useState<string>('rotated.pdf');
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
    fileBlob: rotatedBlob,
    filename: rotatedFilename,
    onDownload: () => {
      if (rotatedBlob) {
        downloadBlob(rotatedBlob, rotatedFilename);
        setRotatedBlob(null);
      }
    },
    onReset: () => {
      setRotatedBlob(null);
    },
  });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

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
    // Small delay for visual feedback
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

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('rotatePdf.steps.upload.title'),
      description: t('rotatePdf.steps.upload.description'),
    },
    {
      icon: <RotateCw className="h-8 w-8 text-primary" />,
      title: t('rotatePdf.steps.rotate.title'),
      description: t('rotatePdf.steps.rotate.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('rotatePdf.steps.download.title'),
      description: t('rotatePdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('rotatePdf');

  const [fileUrl, setFileUrl] = useState<string | null>(null);

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

  // Get total page count when file is uploaded
  useEffect(() => {
    if (!file || !fileUrl) {
      setPageCount(0);
      setPageRotations({});
      return;
    }

    async function getPageCount() {
      if (!fileUrl) return;

      try {
        const pdfjsLib = await initializePdfJsWorker();
        if (!pdfjsLib) return;
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        const pdf = await loadingTask.promise;
        setPageCount(pdf.numPages);
        // Initialize all pages with 0 rotation
        const initialRotations: { [key: number]: number } = {};
        for (let i = 1; i <= pdf.numPages; i++) {
          initialRotations[i] = 0;
        }
        setPageRotations(initialRotations);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setInlineError(t('errors.failedToReadPdf'));
        setFile(null);
      }
    }

    getPageCount();
  }, [file, fileUrl]);

  function rotatePage(pageNum: number, degrees: number) {
    setPageRotations(prev => ({
      ...prev,
      [pageNum]: ((prev[pageNum] || 0) + degrees) % 360
    }));
  }

  function rotateAllPages(degrees: number) {
    const newRotations: { [key: number]: number } = {};
    for (let i = 1; i <= pageCount; i++) {
      newRotations[i] = ((pageRotations[i] || 0) + degrees) % 360;
    }
    setPageRotations(newRotations);
  }

  function resetRotations() {
    const resetRotations: { [key: number]: number } = {};
    for (let i = 1; i <= pageCount; i++) {
      resetRotations[i] = 0;
    }
    setPageRotations(resetRotations);
  }

  async function handleRotate() {
    if (!file) return;

    setIsProcessing(true);
    setInlineError(null);
    setShowEncryptedHint(false);
    const trackStart = Date.now();
    trackToolStart('rotate_pdf');

    // Client-first: run the rotation locally in a Web Worker when supported.
    if (shouldUseClientPdf(file.size)) {
      try {
        // NOTE: the buffer is transferred to the worker and detached — the
        // server fallback below rebuilds its FormData from the original File.
        const buffer = await file.arrayBuffer();
        const bytes = await runPdfOpInWorker({ op: 'rotate', buffer, rotations: pageRotations });
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        const filename = file.name.replace('.pdf', '_rotated.pdf');

        setRotatedBlob(blob);
        setRotatedFilename(filename);
        trackToolComplete('rotate_pdf', Date.now() - trackStart);
        triggerEmailCapture();
        setIsProcessing(false);
        return;
      } catch (err) {
        if (err instanceof ClientPdfError && !err.retryOnServer) {
          // Same failure would happen server-side (e.g. encrypted PDF) —
          // surface it through the existing error UI instead of re-uploading.
          trackToolError('rotate_pdf', err, Date.now() - trackStart);
          console.error('Error rotating PDF:', err);
          setInlineError(err.message || t('rotatePdf.failedToRotate'));
          if (err.code === 'ENCRYPTED_PDF' || isEncryptedPdfError(err)) setShowEncryptedHint(true);
          setIsProcessing(false);
          return;
        }
        console.warn('[client-pdf] falling back to server:', err);
      }
    }

    try {
      // Call API to rotate PDF with the rotations object
      const formData = new FormData();
      formData.append('file', file);
      formData.append('rotations', JSON.stringify(pageRotations));

      const response = await fetch('/api/rotate-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Try to get error message from response
        let errorMessage = t('rotatePdf.failedToRotate');
        let errorCode: string | undefined;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          if (errorData.errorCode) errorCode = String(errorData.errorCode);
        } catch {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        const error = new Error(errorMessage) as Error & { errorCode?: string };
        if (errorCode) error.errorCode = errorCode;
        throw error;
      }

      // Check if response has content
      const contentType = response.headers.get('content-type');

      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error(t('errors.unexpectedServerResponse'));
      }

      const rawBlob = await response.blob();
      const blob = new Blob([rawBlob], { type: 'application/pdf' });

      if (blob.size === 0) {
        throw new Error(t('errors.emptyServerResponse'));
      }

      const filename = file.name.replace('.pdf', '_rotated.pdf');

      // Store blob and trigger email capture
      setRotatedBlob(blob);
      setRotatedFilename(filename);
      trackToolComplete('rotate_pdf', Date.now() - trackStart);
      triggerEmailCapture();
    } catch (error) {
      trackToolError('rotate_pdf', error, Date.now() - trackStart);
      console.error('Error rotating PDF:', error);
      setInlineError(error instanceof Error ? error.message : t('rotatePdf.failedToRotate'));
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    } finally {
      setIsProcessing(false);
    }
  }


  const hasRotations = Object.values(pageRotations).some(r => r !== 0);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Rotate PDF', url: '/rotate-pdf' }]} />
      <HowToSchema
        name="How to Rotate PDF Pages"
        description="Learn how to rotate PDF pages 90, 180, or 270 degrees online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('rotatePdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('rotatePdf.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col mx-auto max-w-4xl">
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
                            setFile(uploadedFile);
                            // Rotations will be initialized when file is set
                          } catch (error: any) {
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
                <div className="grid gap-8 lg:grid-cols-12">
                  {/* Left Column: File Info, Global Controls, Thumbnails */}
                  <div className="lg:col-span-7 flex flex-col gap-6">

                    {/* File info header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{file.name}</h3>
                        <p className="text-sm text-gray-500">{pageCount} {pageCount === 1 ? t('common.page') : t('common.pages')}</p>
                      </div>
                      <button
                        onClick={() => {
                          setFile(null);
                          setPageRotations({});
                          setPageCount(0);
                          setFileUrl(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('common.uploadDifferentFile')}
                      </button>
                    </div>

                    {/* Global rotation controls */}
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">{t('rotatePdf.rotateAllPages')}</p>
                        <p className="text-sm text-gray-600">{t('rotatePdf.applyToAllDesc')}</p>
                      </div>
                      <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
                        <button
                          onClick={() => rotateAllPages(-90)}
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-700"
                          title={t('rotatePdf.rotateAllLeft')}
                        >
                          <RotateCcw className="w-5 h-5" />
                        </button>
                        <div className="w-px h-6 bg-gray-200" />
                        <button
                          onClick={() => rotateAllPages(90)}
                          className="p-2 hover:bg-gray-100 rounded-md transition-colors text-gray-700"
                          title={t('rotatePdf.rotateAllRight')}
                        >
                          <RotateCw className="w-5 h-5" />
                        </button>
                        <div className="w-px h-6 bg-gray-200" />
                        <button
                          onClick={resetRotations}
                          className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                        >
                          {t('rotatePdf.resetAll')}
                        </button>
                      </div>
                    </div>

                    {/* Page thumbnails grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto p-2">
                      {Array.from({ length: pageCount }, (_, i) => i + 1).map((pageNum) => (
                        <RotatePDFThumbnail
                          key={pageNum}
                          fileUrl={fileUrl!}
                          pageNumber={pageNum}
                          rotation={pageRotations[pageNum] || 0}
                          onRotate={(degrees) => rotatePage(pageNum, degrees)}
                        />
                      ))}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        onClick={handleRotate}
                        disabled={isProcessing || !hasRotations}
                        className="flex-1 px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? t('common.processing') : t('rotatePdf.applyRotation')}
                      </button>
                      <button
                        onClick={() => {
                          setFile(null);
                          setPageRotations({});
                          setPageCount(0);
                          setFileUrl(null);
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
                  </div>

                  {/* Right Column: Instructions Panel */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                      <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                          <RotateCw className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{t('rotatePdf.howItWorks')}</h3>
                          <p className="text-sm text-gray-500">{t('rotatePdf.howItWorksDesc')}</p>
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
                          {t('rotatePdf.pagesWillBeRotated', { count: Object.values(pageRotations).filter(r => r !== 0).length })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section >

      {/* How it works section */}
      < HowItWorks steps={steps} />

      {/* FAQ Section */}
      < ToolFAQ questions={faqData} faqPagePath="/rotate-pdf/faq" />

      {/* Why Section */}
      < section className="py-12 px-4" >
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
      </section >

      {/* Related Tools */}
      < RelatedTools currentTool="rotate" />

      {/* Footer */}
      < Footer />

      {/* Email Capture Modal */}
      < EmailCaptureModal
        isOpen={showEmailCapture}
        onEmailSubmitted={() => { }
        } // Not used when using delivery choice flow
        onEmailCaptured={handleEmailCaptured}
      />

      {/* Delivery Choice Modal */}
      < DeliveryChoiceModal
        isOpen={showDeliveryChoice}
        email={capturedEmail}
        filename={rotatedFilename}
        fileBlob={rotatedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div >
  );
}
