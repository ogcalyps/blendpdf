'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Unlock, Download, FileText, X, Eye, EyeOff, Key } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { FAQSchema } from '@/components/FAQSchema';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { unlockPDF } from '@/lib/api-client';
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
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function UnlockPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing, clearFiles } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'remove-restrictions' | 'unlock-password'>('remove-restrictions');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [unlockedBlob, setUnlockedBlob] = useState<Blob | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

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
    fileBlob: unlockedBlob,
    filename: file ? file.name.replace('.pdf', '_unlocked.pdf') : 'unlocked.pdf',
    onDownload: () => {
      if (unlockedBlob) {
        downloadBlob(unlockedBlob, file ? file.name.replace('.pdf', '_unlocked.pdf') : 'unlocked.pdf');
      }
    },
    onReset: () => {
      setUnlockedBlob(null);
    },
  });

  const steps = [
    { icon: <Upload className="h-8 w-8 text-primary" />, title: t('unlockPdf.steps.upload.title'), description: t('unlockPdf.steps.upload.description') },
    { icon: <Unlock className="h-8 w-8 text-primary" />, title: t('unlockPdf.steps.choose.title'), description: t('unlockPdf.steps.choose.description') },
    { icon: <Download className="h-8 w-8 text-primary" />, title: t('unlockPdf.steps.download.title'), description: t('unlockPdf.steps.download.description') },
  ];

  const faqData = useToolFaqs('unlockPdf');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const uploadedFile = acceptedFiles[0];
    const error = validateFile(uploadedFile, MAX_FILE_SIZE);
    if (error) { setInlineError(error); return; }
    setInlineError(null);
    setFile(uploadedFile);
    setUnlockedBlob(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: processing.isProcessing,
  });

  const handleRemoveFile = () => {
    setFile(null);
    setUnlockedBlob(null);
    setPassword('');
    clearFiles();
  };

  const handleUnlock = async () => {
    if (!file || (mode === 'unlock-password' && !password)) return;
    try {
      setProcessing(true, 'convert');
      setProgress(30);
      const result = await unlockPDF(file, mode, password);
      setProgress(100);
      setUnlockedBlob(result);
      setResult(result, 'unlocked.pdf');
    } catch (error: any) {
      setError(error.message);
      setUnlockedBlob(null);
      setProgress(0);

      if (mode === 'remove-restrictions' && error.message.includes('Switch to')) {
        setTimeout(() => setMode('unlock-password'), 500); // give them a brief moment to see the error then auto-switch
      }
    }
  };

  const handleDownload = () => { triggerEmailCapture(); };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Unlock PDF', url: '/unlock-pdf' }]} />
      <HowToSchema name="How to Unlock PDF" description="Learn how to remove password protection from PDF files online for free" steps={steps.map(step => ({ title: step.title, description: step.description }))} />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">{t('unlockPdf.heroTitle')}</h1>
            <p className="mt-4 text-lg text-gray-600">{t('unlockPdf.heroDescription')}</p>
          </div>
        </div>
      </section>

      <section className="bg-white py-4 pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-orange-50 rounded-lg p-1 border border-orange-100">
              <button
                onClick={() => setMode('remove-restrictions')}
                className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-all ${mode === 'remove-restrictions' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-orange-100/50'}`}
              >
                <Unlock className="w-5 h-5" /> {t('unlockPdf.modeRestrictions')}
              </button>
              <button
                onClick={() => setMode('unlock-password')}
                className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-all ${mode === 'unlock-password' ? 'bg-white text-primary shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-orange-100/50'}`}
              >
                <Key className="w-5 h-5" /> {t('unlockPdf.modePassword')}
              </button>
            </div>
          </div>

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
                    <div className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium text-center pointer-events-none">{t('unlockPdf.chooseFile')}</div>
                    <div className="mt-4">
                      <GoogleDrivePicker onFilesSelected={async (files) => { if (files.length === 0) return; const uploadedFile = files[0]; const error = validateFile(uploadedFile, MAX_FILE_SIZE); if (error) { setInlineError(error); return; } setInlineError(null); setFile(uploadedFile); setUnlockedBlob(null); }} disabled={processing.isProcessing} multiple={false} accept={['application/pdf']} />
                    </div>
                    <p className="mt-4 text-sm text-gray-500">{t('unlockPdf.singleFile')}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('unlockPdf.uploadedFile')}</h3>
                    <button onClick={handleRemoveFile} className="p-1 text-red-600 hover:text-red-700 transition-colors" aria-label={t('common.removeFile')}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <PDFThumbnail file={file} pageNumber={1} showCheckbox={false} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{file.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(file.size, locale)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="bg-white rounded-2xl border-2 border-orange-100 p-6 min-h-[400px] flex flex-col">
                {mode === 'remove-restrictions' ? (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('unlockPdf.modeRestrictions')}</h2>
                    <p className="text-gray-600 mb-8">{t('unlockPdf.restrictionsDescription')}</p>
                  </>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('unlockPdf.modePassword')}</h2>
                    <p className="text-gray-600 mb-8">{t('unlockPdf.passwordModeDescription')}</p>
                    <div className="space-y-4 mb-4">
                      <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">{t('unlockPdf.passwordLabel')}</label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} id="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('unlockPdf.passwordPlaceholder')} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent pe-10" disabled={processing.isProcessing} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute end-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" aria-label={showPassword ? t('common.hidePassword') : t('common.showPassword')}>
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-3 mt-auto">
                  {!unlockedBlob ? (
                    <Button onClick={handleUnlock} disabled={!file || (mode === 'unlock-password' && !password) || processing.isProcessing} size="lg" className="w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      {processing.isProcessing && processing.currentTool === 'convert' ? t('common.processing') : (mode === 'remove-restrictions' ? t('unlockPdf.modeRestrictions') : t('unlockPdf.unlockPdf'))}
                    </Button>
                  ) : (
                    <>
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm mb-4">
                        {t('unlockPdf.successUnlocked')}
                      </div>
                      <Button onClick={handleDownload} size="lg" className="w-full bg-success-green hover:from-green-600 hover:to-green-700">
                        {t('unlockPdf.downloadUnlocked')}
                      </Button>
                      <Button onClick={handleRemoveFile} variant="secondary" size="md" className="w-full">
                        {t('unlockPdf.unlockAnother')}
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
      {/* We use FAQ component directly on page instead of linking away, matching the new requirements */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* This page renders its own FAQ layout rather than using ToolFAQ,
              so it has to emit the FAQPage schema itself. */}
          <FAQSchema faqs={faqData} />
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-10">{t('faq.title')}</h2>
          <div className="space-y-6">
            {faqData.map((faq, index) => (
              <div key={index} className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedTools currentTool="unlock" />
      <Footer />

      <ProcessingModal isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)} progress={processing.progress} currentTool={processing.currentTool} error={processing.error} onClose={resetProcessing} onRetry={handleUnlock} />

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
        filename={file ? file.name.replace('.pdf', '_unlocked.pdf') : 'unlocked.pdf'}
        fileBlob={unlockedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
