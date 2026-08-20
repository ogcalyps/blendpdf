'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Zap, Download, FileText, Zap as ZapIcon, Lock, X } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { PDFThumbnail } from '@/components/PDFThumbnail';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { validateFile, formatFileSize } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { Footer } from '@/components/Footer';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';
import { DeliveryChoiceModal } from '@/components/DeliveryChoiceModal';
import { useDeliveryChoice } from '@/hooks/useDeliveryChoice';
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function PDFToWordPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedFilename, setConvertedFilename] = useState<string>('converted.docx');
  const [compatibilityMode, setCompatibilityMode] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);
  const isProcessing = processing.isProcessing;

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
    fileBlob: convertedBlob,
    filename: convertedFilename,
    onDownload: () => {
      if (convertedBlob) {
        const url = window.URL.createObjectURL(convertedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = convertedFilename;
        a.click();
        window.URL.revokeObjectURL(url);
        setConvertedBlob(null);
      }
    },
    onReset: () => {
      setConvertedBlob(null);
    },
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('pdfToWord.steps.upload.title'),
      description: t('pdfToWord.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('pdfToWord.steps.convert.title'),
      description: t('pdfToWord.steps.convert.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('pdfToWord.steps.download.title'),
      description: t('pdfToWord.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('pdfToWord');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const uploadedFile = acceptedFiles[0];
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

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading || isProcessing,
  });

  const handleFileSelect = () => {
    open();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setConvertedBlob(null);
    setCompatibilityMode(false);
    setShowEncryptedHint(false);
    resetProcessing();
  };

  async function handleConvert() {
    if (!file) return;

    setShowEncryptedHint(false);
    setCompatibilityMode(false);
    const trackStart = Date.now();
    trackToolStart('pdf_to_word');
    try {
      setProcessing(true, 'convert');
      setProgress(30);

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/pdf-to-word', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const error = new Error(
          errorData?.error || errorData?.message || t('pdfToWord.failedToConvert')
        ) as Error & { errorCode?: string };
        if (errorData?.errorCode) error.errorCode = String(errorData.errorCode);
        throw error;
      }

      const conversionMethod = response.headers.get('X-Conversion-Method');
      const rawBlob = await response.blob();
      const blob = new Blob([rawBlob], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const filename = file.name.replace('.pdf', '.docx');

      setConvertedBlob(blob);
      setConvertedFilename(filename);
      setCompatibilityMode(conversionMethod === 'libreoffice');
      setProgress(100);
      setResult(blob, filename);
      trackToolComplete('pdf_to_word', Date.now() - trackStart);
    } catch (error: any) {
      trackToolError('pdf_to_word', error, Date.now() - trackStart);
      setError(error instanceof Error ? error.message : t('pdfToWord.failedToConvert'));
      setConvertedBlob(null);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  }

  const handleDownload = () => {
    // Trigger email capture (which will show delivery choice after)
    triggerEmailCapture();
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PDF to Word', url: '/pdf-to-word' }]} />
      <HowToSchema
        name="How to Convert PDF to Word"
        description="Learn how to convert PDF files to Word DOCX format online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('pdfToWord.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('pdfToWord.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: Upload Zone or File Preview */}
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
                          <Loader2 className={`h-12 w-12 text-primary animate-spin`} />
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
                            setIsUploading(true);
                            await new Promise(resolve => setTimeout(resolve, 300));
                            setFile(uploadedFile);
                            setIsUploading(false);
                          }}
                          disabled={isProcessing}
                          multiple={false}
                          accept={['application/pdf']}
                        />
                      </div>

                      <p className="mt-4 text-sm text-gray-500">
                        {t('pdfToWord.maxFileSize')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* File info header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 truncate" title={file.name}>
                        {file.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(file.size, locale)}
                      </p>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {t('pdfToWord.uploadDifferentFile')}
                    </button>
                  </div>

                  {/* File preview */}
                  <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                    <div className="flex items-center justify-center mb-4">
                      <PDFThumbnail file={file} pageNumber={1} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">
                        {t('pdfToWord.fileReady')}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!convertedBlob ? (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={handleConvert}
                        disabled={isProcessing}
                        className="flex-1 px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? t('pdfToWord.converting') : t('pdfToWord.convertToWord')}
                      </button>
                      <button
                        onClick={handleRemoveFile}
                        className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={handleDownload}
                        className="w-full px-8 py-4 bg-success-green text-white rounded-xl font-semibold text-lg hover:bg-green-600 transition-colors shadow-lg hover:shadow-xl"
                      >
                        {t('pdfToWord.downloadWord')}
                      </button>
                      {compatibilityMode && (
                        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                          {t('pdfToWord.compatibilityMode')}
                        </p>
                      )}
                      <button
                        onClick={handleRemoveFile}
                        className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
                      >
                        {t('pdfToWord.convertAnother')}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: Instructions Panel */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border-2 border-orange-100 bg-white p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-dark">{t('pdfToWord.howItWorks')}</h3>
                    <p className="text-sm text-gray-600">{t('pdfToWord.howItWorksDesc')}</p>
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

      {/* How it works */}
      <HowItWorks steps={steps} />

      {/* FAQ */}
      <ToolFAQ questions={faqData} faqPagePath="/pdf-to-word/faq" />

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
                <ZapIcon className="w-7 h-7 text-primary" strokeWidth={2.5} />
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
      <RelatedTools currentTool="pdf-to-word" />

      {/* Footer */}
      <Footer />

      <ProcessingModal
        isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)}
        progress={processing.progress}
        currentTool={processing.currentTool}
        error={processing.error}
        onClose={resetProcessing}
        onRetry={handleConvert}
      />

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
        filename={convertedFilename}
        fileBlob={convertedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
