'use client';

import { useState, useCallback, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Lock, Download, FileText, Check, X, Eye, EyeOff } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { protectPDF } from '@/lib/api-client';
import { Navigation } from '@/components/Navigation';
import { PDFThumbnail } from '@/components/PDFThumbnail';
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

export default function ProtectPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing, clearFiles } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [protectedBlob, setProtectedBlob] = useState<Blob | null>(null);
  const [protectedFilename, setProtectedFilename] = useState<string>('protected.pdf');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    fileBlob: protectedBlob,
    filename: protectedFilename,
    onDownload: () => {
      if (protectedBlob) {
        downloadBlob(protectedBlob, protectedFilename);
      }
    },
    onReset: () => {
      setProtectedBlob(null);
      setPassword('');
      clearFiles();
    },
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('protectPdf.steps.upload.title'),
      description: t('protectPdf.steps.upload.description'),
    },
    {
      icon: <Lock className="h-8 w-8 text-primary" />,
      title: t('protectPdf.steps.password.title'),
      description: t('protectPdf.steps.password.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('protectPdf.steps.download.title'),
      description: t('protectPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('protectPdf');

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
    setProtectedBlob(null);
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
    setProtectedBlob(null);
    setPassword('');
    clearFiles();
  };

  const handleProtect = async () => {
    // Button is disabled until a file and password are provided.
    if (!file || !password) return;

    setShowEncryptedHint(false);
    try {
      setProcessing(true, 'protect');
      setProgress(30);
      const result = await protectPDF(file, password);
      setProgress(100);
      setProtectedBlob(result);
      const filename = file.name.replace('.pdf', '_protected.pdf');
      setProtectedFilename(filename);
      setResult(result, filename);
    } catch (error: any) {
      setError(error.message);
      setProtectedBlob(null);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  };

  const handleDownload = () => {
    // Trigger email capture (which will show delivery choice after)
    triggerEmailCapture();
  };

  const handleProtectAnother = () => {
    handleRemoveFile();
    resetProcessing();
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Protect PDF', url: '/protect-pdf' },
      ]} />
      <HowToSchema 
        name="How to Protect PDF with Password"
        description="Learn how to add password protection to PDF files online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('protectPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('protectPdf.description')}
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
                        {t('protectPdf.chooseFile')}
                      </div>
                      
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
                            setProtectedBlob(null);
                          }}
                          disabled={processing.isProcessing}
                          multiple={false}
                          accept={['application/pdf']}
                        />
                      </div>
                      
                      <p className="mt-4 text-sm text-gray-500">
                        {t('protectPdf.singleFile')}
                      </p>
                    </div>
                </div>
              ) : (
                // File preview
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('protectPdf.uploadedFile')}</h3>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      aria-label={t('common.removeFile')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* File card with thumbnail */}
                  <div className="flex gap-4">
                    <PDFThumbnail file={file} pageNumber={1} showCheckbox={false} />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(file.size, locale)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Options Panel */}
            <div>
              <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{t('protectPdf.setPassword')}</h2>

                {/* Password Input */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                      {t('protectPdf.passwordLabel')}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('protectPdf.passwordPlaceholder')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent pe-10"
                        disabled={processing.isProcessing}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {t('protectPdf.passwordHint')}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="space-y-3 mt-6">
                  {!protectedBlob ? (
                    <Button
                      onClick={handleProtect}
                      disabled={!file || !password || processing.isProcessing}
                      size="lg"
                      className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing.isProcessing && processing.currentTool === 'protect' ? t('protectPdf.protecting') : t('protectPdf.protectPdf')}
                    </Button>
                  ) : (
                    <>
                      <Button
                        onClick={handleDownload}
                        size="lg"
                        className="w-full bg-success-green hover:from-green-600 hover:to-green-700"
                      >
                        {t('protectPdf.downloadProtected')}
                      </Button>
                      <Button
                        onClick={handleProtectAnother}
                        variant="secondary"
                        size="md"
                        className="w-full"
                      >
                        {t('protectPdf.protectAnother')}
                      </Button>
                    </>
                  )}
                </div>

                {/* Info box */}
                <div className="mt-6 bg-orange-50 rounded-lg p-4 text-sm text-gray-700">
                  <p className="font-medium mb-1">🔒 {t('protectPdf.securityInfo')}:</p>
                  <p className="text-gray-600">
                    {t('protectPdf.securityInfoDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/protect-pdf/faq" />

      {/* Related Tools */}
      <RelatedTools currentTool="protect" />

      {/* Footer */}
      <Footer />

      <ProcessingModal
        isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)}
        progress={processing.progress}
        currentTool={processing.currentTool}
        error={processing.error}
        onClose={resetProcessing}
        onRetry={handleProtect}
      />

      {/* Email Capture Modal */}
      <EmailCaptureModal
        isOpen={showEmailCapture}
        onEmailSubmitted={() => {}} // Not used when using delivery choice flow
        onEmailCaptured={handleEmailCaptured}
      />
      <DeliveryChoiceModal
        isOpen={showDeliveryChoice}
        email={capturedEmail}
        filename={protectedFilename}
        fileBlob={protectedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
