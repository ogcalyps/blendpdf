'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Hash, Download, FileText, X } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { addPageNumbers } from '@/lib/api-client';
import { runPdfOpInWorker, shouldUseClientPdf, ClientPdfError } from '@/lib/client-pdf';
import { Navigation } from '@/components/Navigation';
import { PDFLivePreview } from '@/components/PDFLivePreview';
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
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function AddPageNumbersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing, clearFiles } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [position, setPosition] = useState<string>('bottom-center');
  const [format, setFormat] = useState<string>('1');
  const [startFrom, setStartFrom] = useState<number>(1);
  const [fontSize, setFontSize] = useState<number>(12);
  const [numberedBlob, setNumberedBlob] = useState<Blob | null>(null);
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
    fileBlob: numberedBlob,
    filename: file ? file.name.replace('.pdf', '_numbered.pdf') : 'numbered.pdf',
    onDownload: () => {
      if (numberedBlob) {
        downloadBlob(numberedBlob, file ? file.name.replace('.pdf', '_numbered.pdf') : 'numbered.pdf');
      }
    },
    onReset: () => {
      setNumberedBlob(null);
    },
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('addPageNumbers.steps.upload.title'),
      description: t('addPageNumbers.steps.upload.description'),
    },
    {
      icon: <Hash className="h-8 w-8 text-primary" />,
      title: t('addPageNumbers.steps.customize.title'),
      description: t('addPageNumbers.steps.customize.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('addPageNumbers.steps.download.title'),
      description: t('addPageNumbers.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('addPageNumbers');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const uploadedFile = acceptedFiles[0];
    const error = validateFile(uploadedFile, MAX_FILE_SIZE);

    if (error) {
      setInlineError(error);
      return;
    }

    setInlineError(null);
    setShowEncryptedHint(false);
    setFile(uploadedFile);
    setNumberedBlob(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: processing.isProcessing,
  });

  const handleRemoveFile = () => {
    setFile(null);
    setNumberedBlob(null);
    clearFiles();
  };

  const handleAddNumbers = async () => {
    if (!file) return;

    setShowEncryptedHint(false);

    // Client-first: add page numbers locally in a Web Worker when supported.
    if (shouldUseClientPdf(file.size)) {
      try {
        setProcessing(true, 'convert');
        setProgress(30);
        // NOTE: the buffer is transferred to the worker and detached — the
        // server fallback below rebuilds its FormData from the original File.
        const buffer = await file.arrayBuffer();
        const bytes = await runPdfOpInWorker({
          op: 'addPageNumbers',
          buffer,
          options: {
            position: position as 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right',
            format: format as '1' | '1 / 10' | 'Page 1' | 'Page 1 of 10',
            startFrom,
            fontSize,
          },
        });
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        setProgress(100);
        setNumberedBlob(blob);
        setResult(blob, 'numbered.pdf');
        return;
      } catch (error: any) {
        if (error instanceof ClientPdfError && !error.retryOnServer) {
          // Same failure would happen server-side — surface it through the
          // existing error UI instead of re-uploading.
          setError(error.message);
          setNumberedBlob(null);
          if (error.code === 'ENCRYPTED_PDF' || isEncryptedPdfError(error)) setShowEncryptedHint(true);
          return;
        }
        console.warn('[client-pdf] falling back to server:', error);
      }
    }

    try {
      setProcessing(true, 'convert');
      setProgress(30);
      const result = await addPageNumbers(file, position, format, startFrom, fontSize);
      setProgress(100);
      setNumberedBlob(result);
      setResult(result, 'numbered.pdf');
    } catch (error: any) {
      setError(error.message);
      setNumberedBlob(null);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  };

  const handleDownload = () => {
    triggerEmailCapture();
  };

  const handleAddAnother = () => {
    handleRemoveFile();
    resetProcessing();
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Add Page Numbers', url: '/add-page-numbers' },
      ]} />
      <HowToSchema
        name="How to Add Page Numbers to PDF"
        description="Learn how to add page numbers to PDF files online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('addPageNumbers.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('addPageNumbers.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section - 2 Column Layout */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* LEFT: Upload Zone / File Preview */}
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
                <div
                  {...getRootProps()}
                  className={`
                    relative flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16
                    border-2 border-dashed transition-colors duration-200
                    ${processing.isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
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
                        {t('common.dropPdfHere')}
                      </h2>
                      <p className="text-gray-700">
                        {t('common.orClickToBrowse')}
                      </p>
                    </div>
                    <div className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium text-center pointer-events-none">
                      {t('addPageNumbers.chooseFile')}
                    </div>

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
                          setNumberedBlob(null);
                        }}
                        disabled={processing.isProcessing}
                        multiple={false}
                        accept={['application/pdf']}
                      />
                    </div>

                    <p className="mt-4 text-sm text-gray-500">
                      {t('addPageNumbers.singleFile')}
                    </p>
                    <p className="text-sm text-gray-600">{t('clientSide.processedLocally')}</p>
                    <p className="text-xs text-gray-400">{t('clientSide.fallbackNote')}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('addPageNumbers.uploadedFile')}</h3>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      aria-label={t('common.removeFile')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div className="w-full max-w-[400px] border border-gray-200 shadow-sm rounded-lg overflow-hidden bg-gray-50 mx-auto">
                      <PDFLivePreview file={file} pageNumber={1}>
                        <div className="absolute inset-0 z-20 pointer-events-none p-4">
                          <div className={`absolute pointer-events-none transform transition-all duration-200
                                    ${position === 'top-left' ? 'top-4 left-4' : ''}
                                    ${position === 'top-right' ? 'top-4 right-4' : ''}
                                    ${position === 'top-center' ? 'top-4 left-1/2 -translate-x-1/2' : ''}
                                    ${position === 'bottom-left' ? 'bottom-4 left-4' : ''}
                                    ${position === 'bottom-right' ? 'bottom-4 right-4' : ''}
                                    ${position === 'bottom-center' ? 'bottom-4 left-1/2 -translate-x-1/2' : ''}
                                `}>
                            <span
                              className="font-medium text-gray-900 drop-shadow-sm bg-white/50 px-1 rounded"
                              style={{ fontSize: `${Math.max(8, fontSize / 3)}px` }}
                            >
                              {format === '1' && startFrom}
                              {format === '1 / 10' && `${startFrom} / 10`}
                              {format === 'Page 1' && `Page ${startFrom}`}
                              {format === 'Page 1 of 10' && `Page ${startFrom} of 10`}
                            </span>
                          </div>
                        </div>
                      </PDFLivePreview>
                    </div>
                    <div className="flex-1 space-y-2 text-center">
                      <p className="font-semibold text-gray-900 break-words">{file.name}</p>
                      <p className="text-sm text-gray-600 font-medium bg-gray-100 inline-block px-2 py-1 rounded">{formatFileSize(file.size, locale)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Options Panel */}
            <div>
              <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{t('addPageNumbers.customize')}</h2>

                <div className="space-y-6">
                  {/* Position Map Container */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      {t('addPageNumbers.positionLabel')}
                    </label>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <div className="grid grid-cols-3 gap-2 w-full max-w-[200px] mx-auto aspect-[1/1.4] bg-white border-2 border-dashed border-gray-300 rounded p-1">
                        {['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].map((pos) => (
                          <div
                            key={pos}
                            onClick={() => setPosition(pos)}
                            className={`cursor-pointer border-2 rounded transition-all flex items-center justify-center
                                ${position === pos ? 'border-primary bg-orange-50' : 'border-transparent hover:border-gray-300 hover:bg-gray-50'}
                                ${pos.startsWith('top') ? 'self-start h-8' : 'self-end h-8 mt-auto'}
                              `}
                          >
                            <div className={`w-3 h-3 rounded-sm ${position === pos ? 'bg-primary' : 'bg-gray-300'}`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Format Visual Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-3">
                      {t('addPageNumbers.formatLabel')}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { val: '1', label: '1, 2, 3...' },
                        { val: '1 / 10', label: '1 / 10' },
                        { val: 'Page 1', label: 'Page 1' },
                        { val: 'Page 1 of 10', label: 'Page 1 of 10' }
                      ].map((fmt) => (
                        <button
                          key={fmt.val}
                          onClick={() => setFormat(fmt.val)}
                          disabled={processing.isProcessing}
                          className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all
                            ${format === fmt.val ? 'border-primary bg-orange-50 text-primary' : 'border-gray-200 text-gray-700 hover:border-orange-200 hover:bg-orange-50'}
                          `}
                        >
                          {fmt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Range and Styling */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        {t('addPageNumbers.startFromLabel')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={startFrom}
                        onChange={(e) => setStartFrom(parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                        disabled={processing.isProcessing}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        {t('addPageNumbers.fontSizeLabel')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="8"
                          max="36"
                          value={fontSize}
                          onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
                          className="w-full accent-primary"
                          disabled={processing.isProcessing}
                        />
                        <span className="text-sm font-medium text-gray-700 w-8 text-end">{fontSize}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3 mt-6">
                  {!numberedBlob ? (
                    <Button
                      onClick={handleAddNumbers}
                      disabled={!file || processing.isProcessing}
                      size="lg"
                      className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing.isProcessing && processing.currentTool === 'convert' ? t('addPageNumbers.processing') : t('addPageNumbers.addNumbers')}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleDownload}
                        size="lg"
                        className="w-full bg-success-green hover:from-green-600 hover:to-green-700"
                      >
                        {t('addPageNumbers.downloadNumbered')}
                      </Button>
                      <Button
                        onClick={handleAddAnother}
                        variant="secondary"
                        size="md"
                        className="w-full"
                      >
                        {t('addPageNumbers.addAnother')}
                      </Button>
                    </>
                  )}
                  <p className="text-xs text-gray-500 text-center">
                    {t('clientSide.processedLocally')}{' '}
                    <span className="text-gray-400">{t('clientSide.fallbackNote')}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/add-page-numbers/faq" />
      <RelatedTools currentTool="add-page-numbers" />
      <Footer />

      <ProcessingModal
        isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)}
        progress={processing.progress}
        currentTool={processing.currentTool}
        error={processing.error}
        onClose={resetProcessing}
        onRetry={handleAddNumbers}
      />

      <EmailCaptureModal
        isOpen={showEmailCapture}
        onEmailSubmitted={() => { }} // Not used when using delivery choice flow
        onEmailCaptured={handleEmailCaptured}
      />

      <DeliveryChoiceModal
        isOpen={showDeliveryChoice}
        email={capturedEmail}
        filename={file ? file.name.replace('.pdf', '_numbered.pdf') : 'numbered.pdf'}
        fileBlob={numberedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
