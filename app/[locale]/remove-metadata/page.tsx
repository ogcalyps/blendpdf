'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Download, Zap, Lock, X, Eraser, ShieldCheck, UploadCloud, Loader2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { validateFile, downloadBlob } from '@/lib/utils';
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

/** The document metadata fields shown in the before/after table. */
interface MetadataSnapshot {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: string;
  modificationDate?: string;
  hasXmp: boolean;
}

type PdfLibModule = typeof import('pdf-lib');

/** Read one metadata field, tolerating the getters that throw on malformed documents. */
function readField<T>(getter: () => T | undefined): string | undefined {
  try {
    const value = getter();
    if (value === undefined || value === null) return undefined;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? undefined : value.toLocaleString();
    }
    const str = String(value).trim();
    return str.length > 0 ? str : undefined;
  } catch {
    return undefined;
  }
}

function readMetadata(
  pdfDoc: import('pdf-lib').PDFDocument,
  pdfLib: PdfLibModule
): MetadataSnapshot {
  let hasXmp = false;
  try {
    hasXmp = pdfDoc.catalog.has(pdfLib.PDFName.of('Metadata'));
  } catch {
    hasXmp = false;
  }
  return {
    title: readField(() => pdfDoc.getTitle()),
    author: readField(() => pdfDoc.getAuthor()),
    subject: readField(() => pdfDoc.getSubject()),
    keywords: readField(() => pdfDoc.getKeywords()),
    creator: readField(() => pdfDoc.getCreator()),
    producer: readField(() => pdfDoc.getProducer()),
    creationDate: readField(() => pdfDoc.getCreationDate()),
    modificationDate: readField(() => pdfDoc.getModificationDate()),
    hasXmp,
  };
}

export default function RemoveMetadataPage() {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [metaBefore, setMetaBefore] = useState<MetadataSnapshot | null>(null);
  const [metaAfter, setMetaAfter] = useState<MetadataSnapshot | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [cleanedBlob, setCleanedBlob] = useState<Blob | null>(null);
  const [cleanedFilename, setCleanedFilename] = useState<string>('no-metadata.pdf');
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
    fileBlob: cleanedBlob,
    filename: cleanedFilename,
    onDownload: () => {
      if (cleanedBlob) {
        downloadBlob(cleanedBlob, cleanedFilename);
      }
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
      title: t('removeMetadata.steps.upload.title'),
      description: t('removeMetadata.steps.upload.description'),
    },
    {
      icon: <Eraser className="h-8 w-8 text-primary" />,
      title: t('removeMetadata.steps.remove.title'),
      description: t('removeMetadata.steps.remove.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('removeMetadata.steps.download.title'),
      description: t('removeMetadata.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('removeMetadata');

  // Read the current metadata client-side whenever a file is selected —
  // the PDF never leaves the browser
  useEffect(() => {
    if (!file) {
      setMetaBefore(null);
      setMetaAfter(null);
      setCleanedBlob(null);
      return;
    }

    let cancelled = false;

    async function inspectMetadata(f: File) {
      setIsReading(true);
      setInlineError(null);
      setShowEncryptedHint(false);
      setMetaBefore(null);
      setMetaAfter(null);
      setCleanedBlob(null);
      try {
        const pdfLib = await import('pdf-lib');
        const buf = await f.arrayBuffer();
        const pdfDoc = await pdfLib.PDFDocument.load(buf, {
          ignoreEncryption: true,
          updateMetadata: false,
        });
        if (cancelled) return;

        if (pdfDoc.isEncrypted) {
          setShowEncryptedHint(true);
          setInlineError(t('errors.encryptedPdfHint'));
          setFile(null);
          return;
        }

        setMetaBefore(readMetadata(pdfDoc, pdfLib));
      } catch (error) {
        if (cancelled) return;
        console.error('Error reading PDF metadata:', error);
        setInlineError(t('errors.failedToReadPdf'));
        setFile(null);
      } finally {
        if (!cancelled) setIsReading(false);
      }
    }

    inspectMetadata(file);

    return () => {
      cancelled = true;
    };
  }, [file]);

  async function handleRemoveMetadata() {
    if (!file) return;

    setIsProcessing(true);
    setInlineError(null);
    setShowEncryptedHint(false);
    const trackStart = Date.now();
    trackToolStart('remove_metadata');
    try {
      const pdfLib = await import('pdf-lib');
      const { PDFDocument, PDFName, PDFDict } = pdfLib;

      const buf = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buf, {
        ignoreEncryption: true,
        updateMetadata: false,
      });

      if (pdfDoc.isEncrypted) {
        setShowEncryptedHint(true);
        throw new Error(t('errors.encryptedPdfHint'));
      }

      // Blank out the document information dictionary fields
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setCreator('');
      pdfDoc.setProducer('');

      // Remove creation/modification timestamps from the Info dictionary
      try {
        const infoRef = pdfDoc.context.trailerInfo.Info;
        if (infoRef) {
          const info = pdfDoc.context.lookup(infoRef);
          if (info instanceof PDFDict) {
            info.delete(PDFName.of('CreationDate'));
            info.delete(PDFName.of('ModDate'));
          }
        }
      } catch (error) {
        console.warn('Could not remove Info dictionary dates:', error);
      }

      // Strip the XMP metadata stream from the document catalog
      try {
        pdfDoc.catalog.delete(PDFName.of('Metadata'));
      } catch (error) {
        console.warn('Could not remove XMP metadata stream:', error);
      }

      const cleanedBytes = await pdfDoc.save();
      const blob = new Blob([cleanedBytes as unknown as ArrayBuffer], { type: 'application/pdf' });

      if (blob.size === 0) {
        throw new Error(t('removeMetadata.failedToRemove'));
      }

      // Re-open the cleaned bytes and read the metadata back, proving the fields
      // really are gone in the file that will be downloaded
      const verifyDoc = await pdfLib.PDFDocument.load(cleanedBytes, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
      setMetaAfter(readMetadata(verifyDoc, pdfLib));

      setCleanedBlob(blob);
      setCleanedFilename(`no-metadata-${file.name}`);
      trackToolComplete('remove_metadata', Date.now() - trackStart);
      triggerEmailCapture();
    } catch (error) {
      trackToolError('remove_metadata', error, Date.now() - trackStart);
      console.error('Error removing PDF metadata:', error);
      setInlineError(error instanceof Error ? error.message : t('removeMetadata.failedToRemove'));
    } finally {
      setIsProcessing(false);
    }
  }

  function resetTool() {
    setFile(null);
    setMetaBefore(null);
    setMetaAfter(null);
    setCleanedBlob(null);
  }

  const fieldRows: Array<{ key: keyof Omit<MetadataSnapshot, 'hasXmp'>; label: string }> = [
    { key: 'title', label: t('removeMetadata.fields.title') },
    { key: 'author', label: t('removeMetadata.fields.author') },
    { key: 'subject', label: t('removeMetadata.fields.subject') },
    { key: 'keywords', label: t('removeMetadata.fields.keywords') },
    { key: 'creator', label: t('removeMetadata.fields.creator') },
    { key: 'producer', label: t('removeMetadata.fields.producer') },
    { key: 'creationDate', label: t('removeMetadata.fields.creationDate') },
    { key: 'modificationDate', label: t('removeMetadata.fields.modificationDate') },
  ];

  const foundCount = metaBefore
    ? fieldRows.filter(row => metaBefore[row.key]).length + (metaBefore.hasXmp ? 1 : 0)
    : 0;

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Remove Metadata', url: '/remove-metadata' }]} />
      <HowToSchema
        name="How to Remove Metadata from a PDF"
        description="Learn how to strip hidden author names, software traces and timestamps from a PDF before sharing it, entirely in your browser"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('removeMetadata.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('removeMetadata.description')}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 text-sm font-medium text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              {t('removeMetadata.privacyBadge')}
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
                      {t('removeMetadata.localProcessingNote')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-8 lg:grid-cols-12">
                  {/* Left Column: File Info + Metadata Table */}
                  <div className="lg:col-span-7 flex flex-col gap-6">

                    {/* File info header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{file.name}</h3>
                        {metaBefore && !metaAfter && (
                          <p className="text-sm text-gray-500">
                            {t('removeMetadata.fieldsFound', { count: foundCount })}
                          </p>
                        )}
                        {metaAfter && (
                          <p className="text-sm font-medium text-green-700">
                            {t('removeMetadata.cleaned')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={resetTool}
                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {t('common.uploadDifferentFile')}
                      </button>
                    </div>

                    {isReading && (
                      <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-6">
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                        <p className="font-medium text-gray-900">{t('removeMetadata.readingMetadata')}</p>
                      </div>
                    )}

                    {/* Metadata table: current values, plus an after column once cleaned */}
                    {metaBefore && (
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 text-start">
                              <th className="p-3 text-start font-semibold text-gray-700">
                                {t('removeMetadata.fieldColumn')}
                              </th>
                              <th className="p-3 text-start font-semibold text-gray-700">
                                {metaAfter ? t('removeMetadata.beforeColumn') : t('removeMetadata.valueColumn')}
                              </th>
                              {metaAfter && (
                                <th className="p-3 text-start font-semibold text-gray-700">
                                  {t('removeMetadata.afterColumn')}
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {fieldRows.map(row => (
                              <tr key={row.key} className="border-t border-gray-100">
                                <td className="p-3 font-medium text-gray-900 whitespace-nowrap">{row.label}</td>
                                <td className={`p-3 break-all ${metaBefore[row.key] ? (metaAfter ? 'text-gray-500 line-through' : 'text-gray-800') : 'text-gray-400'}`}>
                                  {metaBefore[row.key] ?? t('removeMetadata.notSet')}
                                </td>
                                {metaAfter && (
                                  <td className={`p-3 break-all ${metaAfter[row.key] ? 'text-gray-800' : 'text-green-700'}`}>
                                    {metaAfter[row.key] ?? t('removeMetadata.removed')}
                                  </td>
                                )}
                              </tr>
                            ))}
                            <tr className="border-t border-gray-100">
                              <td className="p-3 font-medium text-gray-900 whitespace-nowrap">
                                {t('removeMetadata.fields.xmp')}
                              </td>
                              <td className={`p-3 ${metaBefore.hasXmp ? (metaAfter ? 'text-gray-500 line-through' : 'text-gray-800') : 'text-gray-400'}`}>
                                {metaBefore.hasXmp ? t('removeMetadata.present') : t('removeMetadata.notSet')}
                              </td>
                              {metaAfter && (
                                <td className={`p-3 ${metaAfter.hasXmp ? 'text-gray-800' : 'text-green-700'}`}>
                                  {metaAfter.hasXmp ? t('removeMetadata.present') : t('removeMetadata.removed')}
                                </td>
                              )}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Action buttons */}
                    {metaBefore && (
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {!metaAfter ? (
                          <button
                            onClick={handleRemoveMetadata}
                            disabled={isProcessing}
                            className="flex-1 min-w-[200px] px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? t('common.processing') : t('removeMetadata.removeButton')}
                          </button>
                        ) : (
                          <button
                            onClick={() => triggerEmailCapture()}
                            disabled={!cleanedBlob}
                            className="flex-1 min-w-[200px] px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            {t('removeMetadata.downloadClean')}
                          </button>
                        )}
                        <button
                          onClick={resetTool}
                          className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Instructions Panel */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                      <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                          <Eraser className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{t('removeMetadata.howItWorks')}</h3>
                          <p className="text-sm text-gray-500">{t('removeMetadata.howItWorksDesc')}</p>
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
                          {t('removeMetadata.privacyBadge')}
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
      <ToolFAQ questions={faqData} faqPagePath="/remove-metadata/faq" />

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

            {/* In-browser Privacy Card */}
            <div className="bg-white rounded-2xl p-8 border-2 border-orange-100">
              <div className="bg-teal-100 rounded-xl p-3 w-fit mb-4">
                <Lock className="w-7 h-7 text-teal-600" strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-bold text-dark mb-3">
                {t('removeMetadata.whyLocal.title')}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {t('removeMetadata.whyLocal.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Tools */}
      <RelatedTools currentTool="removeMetadata" />

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
        filename={cleanedFilename}
        fileBlob={cleanedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
