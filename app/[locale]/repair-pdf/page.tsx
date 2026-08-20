'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Wrench, Download, FileText, X } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { repairPDF } from '@/lib/api-client';
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

const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function RepairPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing, clearFiles } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [repairedBlob, setRepairedBlob] = useState<Blob | null>(null);
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
    fileBlob: repairedBlob,
    filename: file ? file.name.replace('.pdf', '_repaired.pdf') : 'repaired.pdf',
    onDownload: () => {
      if (repairedBlob) {
        downloadBlob(repairedBlob, file ? file.name.replace('.pdf', '_repaired.pdf') : 'repaired.pdf');
      }
    },
    onReset: () => {
      setRepairedBlob(null);
    },
  });

  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('repairPdf.steps.upload.title'), description: t('repairPdf.steps.upload.description') },
    { icon: <Wrench className="h-8 w-8 text-primary" />, title: t('repairPdf.steps.repair.title'), description: t('repairPdf.steps.repair.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('repairPdf.steps.download.title'), description: t('repairPdf.steps.download.description') },
  ];

  const faqData = useToolFaqs('repairPdf');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const uploadedFile = acceptedFiles[0];
    const error = validateFile(uploadedFile, MAX_FILE_SIZE);
    if (error) { setInlineError(error); return; }
    setInlineError(null);
    setShowEncryptedHint(false);
    setFile(uploadedFile);
    setRepairedBlob(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: processing.isProcessing,
  });

  const handleRemoveFile = () => {
    setFile(null);
    setRepairedBlob(null);
    clearFiles();
  };

  const handleRepair = async () => {
    if (!file) return;
    setShowEncryptedHint(false);
    try {
      setProcessing(true, 'convert');
      setProgress(30);
      const result = await repairPDF(file);
      setProgress(100);
      setRepairedBlob(result);
      setResult(result, 'repaired.pdf');
    } catch (error: any) {
      setError(error.message);
      setRepairedBlob(null);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  };

  const handleDownload = () => { triggerEmailCapture(); };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Repair PDF', url: '/repair-pdf' }]} />
      <HowToSchema name="How to Repair PDF" description="Learn how to fix corrupted or damaged PDF files online for free" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('repairPdf.title')}</h1>
            <p className="mt-4 text-lg text-gray-600">{t('repairPdf.description')}</p>
          </div>
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
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
                <div {...getRootProps()} className={`relative flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16 border-2 border-dashed transition-colors duration-200 ${processing.isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'} ${isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}`}>
                  <input {...getInputProps()} disabled={processing.isProcessing} />
                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`rounded-full p-4 ${isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <Upload className={`h-12 w-12 ${isDragActive ? 'text-green-600' : 'text-primary'}`} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold text-gray-900">{t('common.dropPdfHere')}</h2>
                      <p className="text-gray-700">{t('common.orClickToBrowse')}</p>
                    </div>
                    <div className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium text-center pointer-events-none">{t('repairPdf.chooseFile')}</div>
                    <div className="mt-4">
                      <GoogleDrivePicker onFilesSelected={async (files) => { if (files.length === 0) return; const uploadedFile = files[0]; const error = validateFile(uploadedFile, MAX_FILE_SIZE); if (error) { setInlineError(error); return; } setInlineError(null); setShowEncryptedHint(false); setFile(uploadedFile); setRepairedBlob(null); }} disabled={processing.isProcessing} multiple={false} accept={['application/pdf']} />
                    </div>
                    <p className="mt-4 text-sm text-gray-500">{t('repairPdf.singleFile')}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('repairPdf.uploadedFile')}</h3>
                    <button onClick={handleRemoveFile} className="p-1 text-red-600 hover:text-red-700 transition-colors" aria-label={t('common.removeFile')}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
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

            <div>
              <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{t('repairPdf.repair')}</h2>
                <p className="text-sm text-gray-600 mb-6">{t('repairPdf.repairDescription')}</p>
                <div className="space-y-3">
                  {!repairedBlob ? (
                    <Button onClick={handleRepair} disabled={!file || processing.isProcessing} size="lg" className="w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      {processing.isProcessing && processing.currentTool === 'convert' ? t('repairPdf.repairing') : t('repairPdf.repairPdf')}
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleDownload} size="lg" className="w-full bg-success-green hover:from-green-600 hover:to-green-700">
                        {t('repairPdf.downloadRepaired')}
                      </Button>
                      <Button onClick={handleRemoveFile} variant="secondary" size="md" className="w-full">
                        {t('repairPdf.repairAnother')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/repair-pdf/faq" />
      <RelatedTools currentTool="repair" />
      <Footer />

      <ProcessingModal isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)} progress={processing.progress} currentTool={processing.currentTool} error={processing.error} onClose={resetProcessing} onRetry={handleRepair} />

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
        filename={file ? file.name.replace('.pdf', '_repaired.pdf') : 'repaired.pdf'}
        fileBlob={repairedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
