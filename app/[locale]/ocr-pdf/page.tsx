'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, ScanText, Download, FileText, Zap as ZapIcon, Lock, X, Info } from 'lucide-react';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { validateFile, formatFileSize } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { Button } from '@/components/ui/Button';
import { Footer } from '@/components/Footer';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';
import { DeliveryChoiceModal } from '@/components/DeliveryChoiceModal';
import { useDeliveryChoice } from '@/hooks/useDeliveryChoice';
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

type OcrLanguage = 'ara' | 'eng' | 'fra';

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function OcrPdfPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processedBlob, setProcessedBlob] = useState<Blob | null>(null);
  const [processedFilename, setProcessedFilename] = useState<string>('ocr-document.pdf');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);
  // Default: English on; Arabic also on for the Arabic locale (the moat use case).
  const [selectedLanguages, setSelectedLanguages] = useState<Record<OcrLanguage, boolean>>({
    ara: locale === 'ar',
    eng: true,
    fra: false,
  });
  const [redoMode, setRedoMode] = useState(false);

  // Fixed order keeps the string canonical for the API allowlist.
  const languagesParam = (['ara', 'eng', 'fra'] as OcrLanguage[])
    .filter((lang) => selectedLanguages[lang])
    .join('+');
  const hasLanguageSelected = languagesParam.length > 0;

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
    fileBlob: processedBlob,
    filename: processedFilename,
    onDownload: () => {
      if (processedBlob) {
        const url = window.URL.createObjectURL(processedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = processedFilename;
        a.click();
        window.URL.revokeObjectURL(url);
        setProcessedBlob(null);
      }
    },
    onReset: () => {
      setProcessedBlob(null);
    },
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('ocrPdf.steps.upload.title'),
      description: t('ocrPdf.steps.upload.description'),
    },
    {
      icon: <ScanText className="h-8 w-8 text-primary" />,
      title: t('ocrPdf.steps.ocr.title'),
      description: t('ocrPdf.steps.ocr.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('ocrPdf.steps.download.title'),
      description: t('ocrPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('ocrPdf');

  const acceptUploadedFile = useCallback(
    async (uploadedFile: File) => {
      const error = validateFile(uploadedFile, MAX_FILE_SIZE);
      if (error) {
        setInlineError(error);
        return;
      }
      setInlineError(null);
      setShowEncryptedHint(false);
      setIsUploading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setFile(uploadedFile);
      setIsUploading(false);
    },
    []
  );

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      await acceptUploadedFile(acceptedFiles[0]);
    },
    [acceptUploadedFile]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
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
    setIsProcessing(false);
    setShowEncryptedHint(false);
    setProcessedBlob(null);
  };

  const toggleLanguage = (lang: OcrLanguage) => {
    setSelectedLanguages((prev) => ({ ...prev, [lang]: !prev[lang] }));
  };

  async function handleOcr() {
    if (!file || !hasLanguageSelected) return;

    setIsProcessing(true);
    setInlineError(null);
    setShowEncryptedHint(false);
    const trackStart = Date.now();
    trackToolStart('ocr_pdf');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('languages', languagesParam);
      formData.append('mode', redoMode ? 'redo' : 'searchable');

      const response = await fetch('/api/ocr-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorCode = errorData?.errorCode ? String(errorData.errorCode) : undefined;
        let message = errorData?.error || errorData?.message || t('ocrPdf.failedToOcr');
        // Localized messages for the tool-specific error codes.
        if (errorCode === 'PAGE_LIMIT') message = t('ocrPdf.errors.pageLimit');
        else if (errorCode === 'ALREADY_HAS_TEXT') message = t('ocrPdf.errors.alreadyHasText');
        else if (errorCode === 'ENGINE_UNAVAILABLE') message = t('ocrPdf.errors.engineUnavailable');
        else if (errorCode === 'BUSY') message = t('ocrPdf.errors.busy');
        const error = new Error(message) as Error & { errorCode?: string };
        if (errorCode) error.errorCode = errorCode;
        throw error;
      }

      const rawBlob = await response.blob();
      const blob = new Blob([rawBlob], { type: 'application/pdf' });
      const filename = `ocr-${file.name.replace(/\.pdf$/i, '')}.pdf`;

      // Store blob and trigger email capture
      setProcessedBlob(blob);
      setProcessedFilename(filename);
      trackToolComplete('ocr_pdf', Date.now() - trackStart);
      triggerEmailCapture();
    } catch (error) {
      trackToolError('ocr_pdf', error, Date.now() - trackStart);
      const expectedCode = (error as { errorCode?: string })?.errorCode;
      if (expectedCode) {
        // Expected, user-facing states (engine down, page limit, …) — the
        // inline banner handles them; don't trip the dev error overlay.
        console.warn(`OCR request rejected (${expectedCode})`);
      } else {
        console.error('Error running OCR on PDF:', error);
      }
      if (isEncryptedPdfError(error)) {
        setShowEncryptedHint(true);
      } else {
        setInlineError(error instanceof Error ? error.message : t('ocrPdf.failedToOcr'));
      }
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'OCR PDF', url: '/ocr-pdf' }]} />
      <HowToSchema
        name="How to OCR a PDF"
        description="Learn how to make a scanned PDF searchable with OCR online for free, with support for Arabic, English, and French"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('ocrPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('ocrPdf.description')}
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
                // Upload zone
                <div {...getRootProps()} className="cursor-pointer">
                  <input {...getInputProps()} />
                  <div
                    className={`
                      relative flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16
                      border-2 border-dashed transition-colors duration-200
                      ${isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}
                    `}
                  >
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className={`rounded-full p-4 ${isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
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
                      <Button
                        type="button"
                        size="md"
                        className="mt-2 pointer-events-none"
                        disabled={isUploading || isProcessing}
                      >
                        {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('ocrPdf.selectFile')}
                      </Button>

                      {/* Google Drive Integration */}
                      <div className="mt-4">
                        <GoogleDrivePicker
                          onFilesSelected={async (files) => {
                            if (files.length === 0) return;
                            await acceptUploadedFile(files[0]);
                          }}
                          disabled={isProcessing}
                          multiple={false}
                          accept={['application/pdf']}
                        />
                      </div>

                      <p className="mt-4 text-sm text-gray-500">
                        {t('ocrPdf.supportedFormats')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // File preview + options
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('ocrPdf.uploadedFile')}</h3>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      aria-label={t('common.removeFile')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* File card */}
                  <div className="bg-orange-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {t('ocrPdf.fileSize')} {formatFileSize(file.size, locale)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Language selection */}
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-900 mb-2">{t('ocrPdf.languagesLabel')}</p>
                    <div className="flex flex-wrap gap-3">
                      {([
                        { id: 'ara' as OcrLanguage, label: t('ocrPdf.languages.arabic') },
                        { id: 'eng' as OcrLanguage, label: t('ocrPdf.languages.english') },
                        { id: 'fra' as OcrLanguage, label: t('ocrPdf.languages.french') },
                      ]).map(({ id, label }) => (
                        <label
                          key={id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                            selectedLanguages[id]
                              ? 'border-primary bg-orange-50 text-gray-900'
                              : 'border-gray-200 text-gray-700 hover:border-orange-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedLanguages[id]}
                            onChange={() => toggleLanguage(id)}
                            disabled={isProcessing}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {!hasLanguageSelected && (
                      <p className="mt-2 text-sm text-red-600">{t('ocrPdf.languagesRequired')}</p>
                    )}
                  </div>

                  {/* Re-OCR mode */}
                  <label className="mb-4 flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={redoMode}
                      onChange={() => setRedoMode(!redoMode)}
                      disabled={isProcessing}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span>
                      <span className="font-medium text-gray-900">{t('ocrPdf.redoMode')}</span>
                      <span className="block text-gray-500">{t('ocrPdf.redoModeHint')}</span>
                    </span>
                  </label>

                  {/* Honest expectations */}
                  <div className="mb-4 flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-400" />
                    <p>{t('ocrPdf.processingNote')}</p>
                  </div>

                  {/* OCR button */}
                  <Button
                    onClick={handleOcr}
                    size="lg"
                    className="w-full"
                    disabled={isProcessing || !hasLanguageSelected}
                  >
                    {isProcessing ? t('ocrPdf.processing') : t('ocrPdf.ocrButton')}
                  </Button>
                </div>
              )}
            </div>

            {/* RIGHT: Instructions Panel */}
            <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
              <h3 className="text-lg font-bold text-dark mb-4">{t('ocrPdf.howItWorks')}</h3>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-full bg-orange-100 p-3 text-primary">
                      {step.icon}
                    </div>
                    <div>
                      <h4 className="text-md font-semibold text-gray-900">{step.title}</h4>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-orange-50 p-4">
                <p className="text-sm text-gray-700">{t('ocrPdf.howItWorksDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why BlendPDF Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-dark mb-8">
            {t('why.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <ZapIcon className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.noSignup.title')}</h3>
                <p className="text-gray-700">{t('why.noSignup.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <Lock className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.autoDelete.title')}</h3>
                <p className="text-gray-700">{t('why.autoDelete.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/ocr-pdf/faq" />

      {/* Related Tools Section */}
      <RelatedTools currentTool="ocrPdf" />

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
        filename={processedFilename}
        fileBlob={processedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
