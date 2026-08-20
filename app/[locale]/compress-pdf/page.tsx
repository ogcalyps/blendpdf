'use client';

import { useState, useCallback, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Zap, Download, FileMinus, FileText, Check, X, Lock } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { withToolTracking } from '@/lib/analytics';
import { Navigation } from '@/components/Navigation';
import { Link } from '@/i18n/routing';
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
import type { CompressionLevel } from '@/types';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

interface CompressOutcome {
  blob: Blob;
  alreadyOptimized: boolean;
}

/**
 * Same request/analytics contract as api-client's compressPDF, but done here so
 * we can read the X-Reduction-Percent / X-Compression-Note response headers.
 */
const compressPDFWithMeta = withToolTracking(
  'compress_pdf',
  'server',
  async (file: File, level: CompressionLevel): Promise<CompressOutcome> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('level', level);

      const response = await fetch('/api/compress', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const error = new Error(
          errorData?.error || errorData?.message || 'Failed to compress PDF'
        ) as Error & { errorCode?: string };
        if (errorData?.errorCode) error.errorCode = String(errorData.errorCode);
        throw error;
      }

      const reductionHeader = response.headers.get('X-Reduction-Percent');
      const noteHeader = response.headers.get('X-Compression-Note');
      const alreadyOptimized =
        noteHeader === 'already-optimized' ||
        (reductionHeader !== null && parseFloat(reductionHeader) === 0);

      const rawBlob = await response.blob();
      return { blob: new Blob([rawBlob], { type: 'application/pdf' }), alreadyOptimized };
    } catch (error) {
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        throw new Error('Connection failed');
      }
      throw error;
    }
  }
);

export default function CompressPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing, clearFiles } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [alreadyOptimized, setAlreadyOptimized] = useState(false);
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
    fileBlob: compressedBlob,
    filename: 'compressed.pdf',
    onDownload: () => {
      if (compressedBlob) {
        downloadBlob(compressedBlob, 'compressed.pdf');
      }
    },
    onReset: () => {
      setCompressedBlob(null);
      setCompressedSize(null);
    },
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('compressPdf.steps.upload.title'),
      description: t('compressPdf.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('compressPdf.steps.choose.title'),
      description: t('compressPdf.steps.choose.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('compressPdf.steps.download.title'),
      description: t('compressPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('compressPdf');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const error = validateFile(file, MAX_FILE_SIZE);

      if (error) {
        setInlineError(error);
        return;
      }

      setInlineError(null);
      setShowEncryptedHint(false);
      setFile(file);
      setCompressedBlob(null);
      setCompressedSize(null);
      setAlreadyOptimized(false);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: processing.isProcessing,
  });

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setCompressedBlob(null);
    setCompressedSize(null);
    setAlreadyOptimized(false);
    setShowEncryptedHint(false);
  };

  const handleCompress = async () => {
    if (!file) return;

    setShowEncryptedHint(false);
    try {
      setProcessing(true, 'compress');
      setProgress(30);
      const { blob, alreadyOptimized: isAlreadyOptimized } = await compressPDFWithMeta(file, compressionLevel);
      setProgress(100);
      setCompressedBlob(blob);
      setCompressedSize(blob.size);
      setAlreadyOptimized(isAlreadyOptimized);
      setResult(blob, 'compressed.pdf');
    } catch (error: any) {
      setError(error.message);
      setCompressedBlob(null);
      setCompressedSize(null);
      setAlreadyOptimized(false);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  };

  const handleDownload = () => {
    // Trigger email capture (which will show delivery choice after)
    triggerEmailCapture();
  };

  const handleCompressAnother = () => {
    handleRemoveFile();
    resetProcessing();
  };

  const calculateReduction = (): string => {
    if (!file || !compressedSize) return '0';
    const reduction = Math.max(0, ((file.size - compressedSize) / file.size) * 100);
    return reduction.toFixed(0);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Compress PDF', url: '/compress-pdf' },
      ]} />
      <HowToSchema 
        name="How to Compress PDF Files"
        description="Learn how to reduce PDF file size online for free while maintaining quality"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('compressPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('compressPdf.description')}
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
                        {t('compressPdf.chooseFile')}
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
                            setCompressedBlob(null);
                            setCompressedSize(null);
                            setAlreadyOptimized(false);
                          }}
                          disabled={processing.isProcessing}
                          multiple={false}
                          accept={['application/pdf']}
                        />
                      </div>
                      
                      <p className="mt-4 text-sm text-gray-500">
                        {t('compressPdf.singleFile')}
                      </p>
                    </div>
                </div>
              ) : (
                // File preview
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('compressPdf.uploadedFile')}</h3>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      aria-label={t('common.removeFile')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* File card with thumbnail */}
                  <div className="bg-orange-50 rounded-xl p-4 mb-4">
                    <div className="mb-3">
                      <PDFThumbnail
                        file={file}
                        pageNumber={1}
                        showCheckbox={false}
                        showPageNumber={false}
                        showDragHandle={false}
                        thumbnailWidth={200}
                      />
                    </div>
                    <p className="font-medium text-gray-900 truncate mb-1" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t('compressPdf.originalSize')} {formatFileSize(file.size, locale)}
                    </p>
                  </div>

                  {/* After compression - show comparison */}
                  {compressedBlob && compressedSize && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Check className="w-5 h-5 text-green-600" />
                        <span className="font-semibold text-green-900">{t('compressPdf.compressedSuccessfully')}</span>
                      </div>
                      {alreadyOptimized ? (
                        <p className="text-sm text-gray-700">
                          {t('compressPdf.alreadyOptimized')}
                        </p>
                      ) : (
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700">
                            {t('compressPdf.newSize')} <span className="font-bold">{formatFileSize(compressedSize, locale)}</span>
                          </p>
                          <p className="text-gray-700">
                            {t('compressPdf.reducedBy')} <span className="font-bold text-green-600">{calculateReduction()}%</span>
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT: Compression Options */}
            <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
              <h3 className="text-lg font-bold text-dark mb-4">{t('compressPdf.compressionSettings')}</h3>

              {/* Quality selector */}
              <div className="space-y-3 mb-6">
                <label className={`flex items-start gap-3 cursor-pointer p-4 border-2 rounded-xl transition-all ${compressionLevel === 'high' ? 'border-primary bg-orange-50' : 'border-orange-100 hover:bg-orange-50'}`}>
                  <input
                    type="radio"
                    name="quality"
                    value="high"
                    checked={compressionLevel === 'high'}
                    onChange={() => setCompressionLevel('high')}
                    className="h-5 w-5 text-primary mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-dark">{t('compressPdf.highQuality')}</span>
                    <span className="text-sm text-gray-600 block mt-1">
                      {t('compressPdf.highQualityDesc')}
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 cursor-pointer p-4 border-2 rounded-xl transition-all ${compressionLevel === 'medium' ? 'border-primary bg-orange-50' : 'border-orange-100 hover:bg-orange-50'}`}>
                  <input
                    type="radio"
                    name="quality"
                    value="medium"
                    checked={compressionLevel === 'medium'}
                    onChange={() => setCompressionLevel('medium')}
                    className="h-5 w-5 text-primary mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-dark">{t('compressPdf.mediumQuality')}</span>
                      <span className="text-xs font-medium text-primary bg-orange-100 px-2 py-0.5 rounded-full">
                        {t('compressPdf.recommended')}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600 block mt-1">
                      {t('compressPdf.mediumQualityDesc')}
                    </span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 cursor-pointer p-4 border-2 rounded-xl transition-all ${compressionLevel === 'low' ? 'border-primary bg-orange-50' : 'border-orange-100 hover:bg-orange-50'}`}>
                  <input
                    type="radio"
                    name="quality"
                    value="low"
                    checked={compressionLevel === 'low'}
                    onChange={() => setCompressionLevel('low')}
                    className="h-5 w-5 text-primary mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-dark">{t('compressPdf.lowQuality')}</span>
                    <span className="text-sm text-gray-600 block mt-1">
                      {t('compressPdf.lowQualityDesc')}
                    </span>
                  </div>
                </label>
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                {!compressedBlob ? (
                  <Button
                    onClick={handleCompress}
                    disabled={!file || processing.isProcessing}
                    size="lg"
                    className="w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing.isProcessing && processing.currentTool === 'compress' ? t('compressPdf.compressing') : t('compressPdf.compressPdf')}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleDownload}
                      size="lg"
                      className="w-full bg-success-green hover:from-green-600 hover:to-green-700"
                    >
                      {t('compressPdf.downloadCompressed')}
                    </Button>
                    <Button
                      onClick={handleCompressAnother}
                      variant="secondary"
                      size="md"
                      className="w-full"
                    >
                      {t('compressPdf.compressAnother')}
                    </Button>
                  </>
                )}
              </div>

              {/* Info box */}
              <div className="mt-6 bg-orange-50 rounded-lg p-4 text-sm text-gray-700">
                <p className="font-medium mb-1">💡 {t('compressPdf.howCompressionWorks')}:</p>
                <p className="text-gray-600">
                  {t('compressPdf.howCompressionWorksDesc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/compress-pdf/faq" />

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
      <RelatedTools currentTool="compress" />

      {/* Footer */}
      <Footer />

      <ProcessingModal
        isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)}
        progress={processing.progress}
        currentTool={processing.currentTool}
        error={processing.error}
        onClose={resetProcessing}
        onRetry={handleCompress}
      />

      {/* Email Capture Modal */}
      <EmailCaptureModal
        isOpen={showEmailCapture}
        onEmailSubmitted={() => {}} // Not used when using delivery choice flow
        onEmailCaptured={handleEmailCaptured}
      />
      
      {/* Delivery Choice Modal */}
      <DeliveryChoiceModal
        isOpen={showDeliveryChoice}
        email={capturedEmail}
        filename="compressed.pdf"
        fileBlob={compressedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
