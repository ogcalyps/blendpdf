'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Download, Zap, Lock, X, FileOutput, CheckCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { validateFile, downloadBlob, parsePageRanges, formatFileSize } from '@/lib/utils';
import { createZipAndDownload } from '@/lib/zip-generation';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
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
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

type OutputMode = 'single' | 'zip';

export default function ExtractPagesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [rangeInput, setRangeInput] = useState('');
  const [outputMode, setOutputMode] = useState<OutputMode>('single');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [zipDownloaded, setZipDownloaded] = useState(false);
  const [extractedBlob, setExtractedBlob] = useState<Blob | null>(null);
  const [extractedFilename, setExtractedFilename] = useState<string>('extracted.pdf');
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
    fileBlob: extractedBlob,
    filename: extractedFilename,
    onDownload: () => {
      if (extractedBlob) {
        downloadBlob(extractedBlob, extractedFilename);
        setExtractedBlob(null);
      }
    },
    onReset: () => {
      setExtractedBlob(null);
    },
  });

  // Live range parsing: 0-indexed page numbers, or an inline error
  const { selectedPages, rangeError } = useMemo(() => {
    if (!rangeInput.trim() || pageCount === 0) {
      return { selectedPages: [] as number[], rangeError: null as string | null };
    }
    try {
      return { selectedPages: parsePageRanges(rangeInput, pageCount), rangeError: null };
    } catch {
      return { selectedPages: [] as number[], rangeError: t('extractPages.invalidRange', { max: pageCount }) };
    }
  }, [rangeInput, pageCount, t]);

  const loadPdf = useCallback(
    async (uploadedFile: File) => {
      try {
        const buffer = await uploadedFile.arrayBuffer();
        // Everything happens locally — the file is parsed in the browser with pdf-lib
        const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

        if (pdfDoc.isEncrypted) {
          setInlineError(t('errors.encryptedPdf'));
          setShowEncryptedHint(true);
          return;
        }

        setInlineError(null);
        setShowEncryptedHint(false);
        setPageCount(pdfDoc.getPageCount());
        setRangeInput('');
        setZipDownloaded(false);
        setFile(uploadedFile);
      } catch {
        setInlineError(t('errors.failedToReadPdf'));
      }
    },
    [t]
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const uploadedFile = acceptedFiles[0];
      const error = validateFile(uploadedFile, MAX_FILE_SIZE);

      if (error) {
        setInlineError(`${uploadedFile.name}: ${error}`);
        return;
      }

      setIsUploading(true);
      await loadPdf(uploadedFile);
      setIsUploading(false);
    },
    [loadPdf]
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

  const handleRemoveFile = () => {
    setFile(null);
    setPageCount(0);
    setRangeInput('');
    setZipDownloaded(false);
    setExtractedBlob(null);
    setInlineError(null);
    setShowEncryptedHint(false);
  };

  async function handleExtract() {
    if (!file || selectedPages.length === 0 || rangeError) return;

    setIsProcessing(true);
    setInlineError(null);
    setZipDownloaded(false);
    const trackStart = Date.now();
    trackToolStart('extract_pages');
    try {
      const buffer = await file.arrayBuffer();
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const baseName = file.name.replace(/\.pdf$/i, '');

      if (outputMode === 'single') {
        // One new PDF containing the selected pages, in order
        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(srcDoc, selectedPages);
        copiedPages.forEach((page) => newDoc.addPage(page));
        const bytes = await newDoc.save();
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });

        setExtractedBlob(blob);
        setExtractedFilename(`extracted-${file.name}`);
        trackToolComplete('extract_pages', Date.now() - trackStart);
        triggerEmailCapture();
      } else {
        // One single-page PDF per selected page, bundled as a ZIP.
        // ZIP outputs download directly (no email gate), matching the other ZIP flows.
        const files: { name: string; bytes: Uint8Array }[] = [];
        for (const pageIndex of selectedPages) {
          const pageDoc = await PDFDocument.create();
          const [copiedPage] = await pageDoc.copyPages(srcDoc, [pageIndex]);
          pageDoc.addPage(copiedPage);
          const bytes = await pageDoc.save();
          files.push({ name: `${baseName}-page-${pageIndex + 1}.pdf`, bytes });
        }
        await createZipAndDownload(files, `extracted-${baseName}.zip`);
        trackToolComplete('extract_pages', Date.now() - trackStart);
        setZipDownloaded(true);
      }
    } catch (error) {
      trackToolError('extract_pages', error, Date.now() - trackStart);
      console.error('Error extracting pages:', error);
      setInlineError(error instanceof Error ? error.message : t('extractPages.failedToExtract'));
    } finally {
      setIsProcessing(false);
    }
  }

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('extractPages.steps.upload.title'),
      description: t('extractPages.steps.upload.description'),
    },
    {
      icon: <FileOutput className="h-8 w-8 text-primary" />,
      title: t('extractPages.steps.extract.title'),
      description: t('extractPages.steps.extract.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('extractPages.steps.download.title'),
      description: t('extractPages.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('extractPages');

  const canExtract = selectedPages.length > 0 && !rangeError && !isProcessing;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Extract Pages', url: '/extract-pages' }]} />
      <HowToSchema
        name="How to Extract Pages from a PDF"
        description="Learn how to save certain pages of a PDF as a new file online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('extractPages.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('extractPages.description')}
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
                          await loadPdf(uploadedFile);
                        }}
                        disabled={isProcessing}
                        multiple={false}
                        accept={['application/pdf']}
                      />
                    </div>

                    <p className="mt-4 text-sm text-gray-500">
                      {t('extractPages.localProcessingNote')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-12">
                {/* Left Column: File Info + Range Input + Mode + Actions */}
                <div className="lg:col-span-7 flex flex-col gap-6">
                  {/* File info header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 truncate" title={file.name}>{file.name}</h3>
                      <p className="text-sm text-gray-500">
                        {pageCount} {pageCount === 1 ? t('common.page') : t('common.pages')} • {formatFileSize(file.size, locale)}
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {t('common.uploadDifferentFile')}
                    </button>
                  </div>

                  {/* Page range input */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <label htmlFor="page-ranges" className="block font-semibold text-gray-900 mb-1">
                      {t('extractPages.rangeLabel')}
                    </label>
                    <p className="text-sm text-gray-600 mb-3">{t('extractPages.rangeHint', { max: pageCount })}</p>
                    <input
                      id="page-ranges"
                      type="text"
                      dir="ltr"
                      value={rangeInput}
                      onChange={(e) => setRangeInput(e.target.value)}
                      placeholder={t('extractPages.rangePlaceholder')}
                      disabled={isProcessing}
                      className={`w-full rounded-lg border bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 ${
                        rangeError
                          ? 'border-red-300 focus:ring-red-200'
                          : 'border-orange-200 focus:ring-orange-200'
                      }`}
                    />
                    {rangeError ? (
                      <p className="mt-2 text-sm text-red-600">{rangeError}</p>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-gray-700">
                        {t('extractPages.pagesSelectedOfTotal', { count: selectedPages.length, total: pageCount })}
                      </p>
                    )}
                  </div>

                  {/* Output mode toggle */}
                  <div className="bg-white border border-orange-200 rounded-xl p-4">
                    <p className="font-semibold text-gray-900 mb-3">{t('extractPages.outputMode')}</p>
                    <div className="flex flex-col gap-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="output-mode"
                          value="single"
                          checked={outputMode === 'single'}
                          onChange={() => setOutputMode('single')}
                          disabled={isProcessing}
                          className="mt-1 h-4 w-4 text-primary accent-[#FF6B35]"
                        />
                        <span>
                          <span className="block font-medium text-gray-900">{t('extractPages.modeSingle')}</span>
                          <span className="block text-sm text-gray-600">{t('extractPages.modeSingleDesc')}</span>
                        </span>
                      </label>
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="radio"
                          name="output-mode"
                          value="zip"
                          checked={outputMode === 'zip'}
                          onChange={() => setOutputMode('zip')}
                          disabled={isProcessing}
                          className="mt-1 h-4 w-4 text-primary accent-[#FF6B35]"
                        />
                        <span>
                          <span className="block font-medium text-gray-900">{t('extractPages.modeZip')}</span>
                          <span className="block text-sm text-gray-600">{t('extractPages.modeZipDesc')}</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {zipDownloaded && (
                    <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4">
                      <CheckCircle className="h-5 w-5 flex-shrink-0 text-green-600" />
                      <p className="text-sm text-gray-700">{t('extractPages.zipDownloaded')}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-4 mt-2">
                    <button
                      onClick={handleExtract}
                      disabled={!canExtract}
                      className="flex-1 px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? t('common.processing') : t('extractPages.extractButton', { count: selectedPages.length })}
                    </button>
                    <button
                      onClick={handleRemoveFile}
                      className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </div>

                {/* Right Column: Instructions Panel */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                        <FileOutput className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{t('extractPages.howItWorks')}</h3>
                        <p className="text-sm text-gray-500">{t('extractPages.howItWorksDesc')}</p>
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
                        {t('extractPages.localProcessingNote')}
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
      <ToolFAQ questions={faqData} faqPagePath="/extract-pages/faq" />

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
      <RelatedTools currentTool="extractPages" />

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
        filename={extractedFilename}
        fileBlob={extractedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
