'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Layers, Download, Zap, Lock, X, FileText, Info, UploadCloud, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { PDFDocument } from 'pdf-lib';
import { validateFile, downloadBlob, formatFileSize } from '@/lib/utils';
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
const MAX_DISPLAYED_FIELDS = 50;

export default function FlattenPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [fieldNames, setFieldNames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [flattenedBlob, setFlattenedBlob] = useState<Blob | null>(null);
  const [flattenedFilename, setFlattenedFilename] = useState<string>('flattened.pdf');
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
    fileBlob: flattenedBlob,
    filename: flattenedFilename,
    onDownload: () => {
      if (flattenedBlob) {
        downloadBlob(flattenedBlob, flattenedFilename);
        setFlattenedBlob(null);
      }
    },
    onReset: () => {
      setFlattenedBlob(null);
    },
  });

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

        let names: string[] = [];
        try {
          names = pdfDoc.getForm().getFields().map((field) => field.getName());
        } catch {
          // No AcroForm (or an unreadable one) — treat as a PDF without form fields
          names = [];
        }

        setInlineError(null);
        setShowEncryptedHint(false);
        setPageCount(pdfDoc.getPageCount());
        setFieldNames(names);
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
    setFieldNames([]);
    setFlattenedBlob(null);
    setInlineError(null);
    setShowEncryptedHint(false);
  };

  async function handleFlatten() {
    if (!file) return;

    setIsProcessing(true);
    setInlineError(null);
    const trackStart = Date.now();
    trackToolStart('flatten_pdf');
    try {
      const buffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

      if (fieldNames.length > 0) {
        try {
          pdfDoc.getForm().flatten();
        } catch {
          // pdf-lib's flatten can throw on exotic appearance streams — be honest about it
          throw new Error(t('flattenPdf.flattenFieldsError'));
        }
      }

      const bytes = await pdfDoc.save();
      const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
      const filename = `flattened-${file.name}`;

      setFlattenedBlob(blob);
      setFlattenedFilename(filename);
      trackToolComplete('flatten_pdf', Date.now() - trackStart);
      triggerEmailCapture();
    } catch (error) {
      trackToolError('flatten_pdf', error, Date.now() - trackStart);
      console.error('Error flattening PDF:', error);
      setInlineError(error instanceof Error ? error.message : t('flattenPdf.failedToFlatten'));
    } finally {
      setIsProcessing(false);
    }
  }

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('flattenPdf.steps.upload.title'),
      description: t('flattenPdf.steps.upload.description'),
    },
    {
      icon: <Layers className="h-8 w-8 text-primary" />,
      title: t('flattenPdf.steps.flatten.title'),
      description: t('flattenPdf.steps.flatten.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('flattenPdf.steps.download.title'),
      description: t('flattenPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('flattenPdf');

  const hasFields = fieldNames.length > 0;
  const displayedFields = fieldNames.slice(0, MAX_DISPLAYED_FIELDS);
  const hiddenFieldCount = fieldNames.length - displayedFields.length;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Flatten PDF', url: '/flatten-pdf' }]} />
      <HowToSchema
        name="How to Flatten a PDF Form"
        description="Learn how to flatten PDF form fields and make a filled form non-editable online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('flattenPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('flattenPdf.description')}
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
                      {t('flattenPdf.localProcessingNote')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-8 lg:grid-cols-12">
                {/* Left Column: File Info + Field List + Actions */}
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

                  {hasFields ? (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="font-semibold text-gray-900 mb-1">
                        {t('flattenPdf.fieldsFound', { count: fieldNames.length })}
                      </p>
                      <p className="text-sm text-gray-600 mb-3">{t('flattenPdf.fieldsFoundDesc')}</p>
                      <ul className="max-h-56 overflow-y-auto rounded-lg border border-orange-100 bg-white divide-y divide-gray-100">
                        {displayedFields.map((name, index) => (
                          <li key={`${name}-${index}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700">
                            <FileText className="h-4 w-4 flex-shrink-0 text-primary" />
                            <span className="truncate" title={name}>{name || t('flattenPdf.unnamedField')}</span>
                          </li>
                        ))}
                      </ul>
                      {hiddenFieldCount > 0 && (
                        <p className="mt-2 text-xs text-gray-500">
                          {t('flattenPdf.moreFields', { count: hiddenFieldCount })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-start gap-3">
                        <Info className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-900">{t('flattenPdf.noFieldsTitle')}</p>
                          <p className="mt-1 text-sm text-gray-600">{t('flattenPdf.noFieldsDesc')}</p>
                          <p className="mt-2 text-sm text-gray-600">
                            {t('flattenPdf.fillFormHint')}{' '}
                            <Link href="/fill-form" className="font-medium text-primary underline hover:no-underline">
                              {t('flattenPdf.fillFormCta')}
                            </Link>
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-4 mt-2">
                    <button
                      onClick={handleFlatten}
                      disabled={isProcessing}
                      className="flex-1 px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isProcessing
                        ? t('common.processing')
                        : hasFields
                          ? t('flattenPdf.flattenButton')
                          : t('flattenPdf.saveAnywayButton')}
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
                        <Layers className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{t('flattenPdf.howItWorks')}</h3>
                        <p className="text-sm text-gray-500">{t('flattenPdf.howItWorksDesc')}</p>
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
                        {t('flattenPdf.localProcessingNote')}
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
      <ToolFAQ questions={faqData} faqPagePath="/flatten-pdf/faq" />

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
      <RelatedTools currentTool="flattenPdf" />

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
        filename={flattenedFilename}
        fileBlob={flattenedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
