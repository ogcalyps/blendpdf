'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Zap, Download, GitMerge } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { FileList } from '@/components/FileList';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { mergePDFs } from '@/lib/api-client';
import { runPdfOpInWorker, shouldUseClientPdf, ClientPdfError } from '@/lib/client-pdf';
import { useToolFaqs } from '@/lib/tool-faqs';
import { withToolTracking } from '@/lib/analytics';
import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/Button';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

/**
 * Client-side merge via the pdf Web Worker — files never leave the device.
 * Same analytics contract as api-client's mergePDFs (server variant).
 */
const mergePDFsClientSide = withToolTracking(
  'merge_pdf',
  'client',
  async (inputs: File[]): Promise<Blob> => {
    // These buffers are TRANSFERRED to the worker (detached after the call).
    // On fallback, rebuild from the original File objects — never reuse these.
    const buffers = await Promise.all(inputs.map((f) => f.arrayBuffer()));
    const bytes = await runPdfOpInWorker({ op: 'merge', buffers });
    return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  }
);

export default function MergePDFPage() {
  const t = useTranslations();
  const { files, processing, setProcessing, setProgress, setError, setResult, resetProcessing } = useFileStore();
  const [showEncryptedHint, setShowEncryptedHint] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
  }, []);

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('mergePdf.steps.upload.title'),
      description: t('mergePdf.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('mergePdf.steps.reorder.title'),
      description: t('mergePdf.steps.reorder.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('mergePdf.steps.download.title'),
      description: t('mergePdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('mergePdf');

  async function handleMerge() {
    // Button is disabled below 2 files; the right panel shows the hint text.
    if (files.length < 2) return;
    setShowEncryptedHint(false);
    try {
      setProcessing(true, 'merge');

      const inputs = files.map(f => f.file);
      const totalBytes = inputs.reduce((sum, f) => sum + f.size, 0);

      // Client-first: process locally in a Web Worker when supported and small enough.
      if (shouldUseClientPdf(totalBytes)) {
        try {
          setProgress(20);
          const blob = await mergePDFsClientSide(inputs);
          setProgress(80);
          setProgress(100);
          setResult(blob, 'merged.pdf');
          return;
        } catch (clientError) {
          if (clientError instanceof ClientPdfError && !clientError.retryOnServer) {
            // The server would fail identically (e.g. encrypted input) — surface it.
            throw clientError;
          }
          console.warn('Client-side merge failed, falling back to server:', clientError);
          // Fall through to the server path below (uses the original File objects,
          // since the client-path buffers were detached by the worker transfer).
        }
      }

      setProgress(30);
      const result = await mergePDFs(inputs);
      setProgress(100);
      setResult(result, 'merged.pdf');
    } catch (error: any) {
      setError(error.message);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  }

  function handleClearAll() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      clearTimerRef.current = setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    setConfirmingClear(false);
    useFileStore.getState().clearFiles();
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Merge PDF', url: '/merge-pdf' },
      ]} />
      <HowToSchema 
        name="How to Merge PDF Files"
        description="Learn how to combine multiple PDF files into one document online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('mergePdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('mergePdf.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Upload Zone Section - 2 Column Grid */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: Upload Zone */}
            <div className="flex flex-col gap-4">
              {showEncryptedHint && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-gray-700">
                  {t('errors.encryptedPdfHint')}{' '}
                  <Link href="/unlock-pdf" className="font-medium text-primary underline hover:no-underline">
                    {t('errors.unlockPdfCta')}
                  </Link>
                </div>
              )}
              {files.length === 0 && <UploadZone maxFiles={20} />}
              {files.length > 0 && (
                <>
                  <FileList />
                  {/* Action buttons */}
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={handleMerge}
                      disabled={files.length < 2 || processing.isProcessing}
                      size="lg"
                      className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing.isProcessing && processing.currentTool === 'merge' ? t('mergePdf.merging') : t('mergePdf.mergePdfs')}
                    </Button>
                    <Button
                      onClick={handleClearAll}
                      variant="secondary"
                      size="lg"
                      className={confirmingClear ? 'ring-2 ring-red-400' : ''}
                    >
                      {confirmingClear ? t('mergePdf.confirmClearAll') : t('mergePdf.clearAll')}
                    </Button>
                  </div>
                </>
              )}
              <p className="text-center text-xs text-gray-500">
                {t('clientSide.processedLocally')}{' '}
                <span className="text-gray-400">{t('clientSide.fallbackNote')}</span>
              </p>
            </div>

            {/* Right: Instructions Panel */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border-2 border-orange-100 bg-white p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <GitMerge className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-dark">{t('mergePdf.howItWorks')}</h3>
                    <p className="text-sm text-gray-600">{t('mergePdf.howItWorksDesc')}</p>
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

                {files.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-orange-100">
                    <p className="text-sm text-gray-500 text-center">
                      {files.length < 2 ? t('mergePdf.uploadAtLeast2Files') : t('mergePdf.filesReadyToMerge', { count: files.length })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <HowItWorks steps={steps} />

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/merge-pdf/faq" />

      {/* Related Tools */}
      <RelatedTools currentTool="merge" />

      {/* Footer */}
      <Footer />

      <ProcessingModal
        isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)}
        progress={processing.progress}
        currentTool={processing.currentTool}
        error={processing.error}
        onClose={resetProcessing}
        onRetry={handleMerge}
      />
    </div>
  );
}

