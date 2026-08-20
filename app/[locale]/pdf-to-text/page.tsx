'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, FileText, Download, Zap, Lock, X, Copy, Check, ShieldCheck, UploadCloud, Loader2 } from 'lucide-react';
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
import { initializePdfJsWorker } from '@/lib/pdfjs-init';
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

/** pdfjs throws a PasswordException when a PDF requires a password to open. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { name?: string } | null)?.name === 'PasswordException' ||
  /password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function PdfToTextPage() {
  const t = useTranslations();
  const [file, setFile] = useState<File | null>(null);
  const [pageTexts, setPageTexts] = useState<string[] | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [includeSeparators, setIncludeSeparators] = useState(true);
  const [copied, setCopied] = useState(false);
  const [textBlob, setTextBlob] = useState<Blob | null>(null);
  const [textFilename, setTextFilename] = useState<string>('extracted.txt');
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
    fileBlob: textBlob,
    filename: textFilename,
    onDownload: () => {
      if (textBlob) {
        downloadBlob(textBlob, textFilename);
        setTextBlob(null);
      }
    },
    onReset: () => {
      setTextBlob(null);
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
    disabled: isUploading || isExtracting,
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('pdfToText.steps.upload.title'),
      description: t('pdfToText.steps.upload.description'),
    },
    {
      icon: <FileText className="h-8 w-8 text-primary" />,
      title: t('pdfToText.steps.extract.title'),
      description: t('pdfToText.steps.extract.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('pdfToText.steps.download.title'),
      description: t('pdfToText.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('pdfToText');

  // Extract text client-side whenever a file is selected — the PDF never leaves the browser
  useEffect(() => {
    if (!file) {
      setPageTexts(null);
      setProgress(null);
      return;
    }

    let cancelled = false;

    async function extractText(f: File) {
      setIsExtracting(true);
      setInlineError(null);
      setShowEncryptedHint(false);
      setPageTexts(null);
      const trackStart = Date.now();
      trackToolStart('pdf_to_text');
      try {
        const pdfjsLib = await initializePdfJsWorker();
        if (!pdfjsLib) throw new Error(t('errors.failedToReadPdf'));

        const data = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;
        setProgress({ current: 0, total: pdf.numPages });

        const texts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          setProgress({ current: i, total: pdf.numPages });
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();

          let text = '';
          let lastY: number | null = null;
          for (const item of content.items) {
            if (!('str' in item)) continue;
            const y = Array.isArray(item.transform) ? item.transform[5] : undefined;
            // Infer a line break when the vertical position changes noticeably
            if (
              lastY !== null &&
              typeof y === 'number' &&
              Math.abs(y - lastY) > 2 &&
              text &&
              !text.endsWith('\n')
            ) {
              text = text.replace(/[ \t]+$/, '') + '\n';
            } else if (text && item.str && !text.endsWith('\n') && !text.endsWith(' ')) {
              text += ' ';
            }
            text += item.str;
            if (item.hasEOL && !text.endsWith('\n')) {
              text += '\n';
            }
            if (typeof y === 'number') lastY = y;
          }
          texts.push(text.trim());
        }

        if (cancelled) return;
        setPageTexts(texts);
        trackToolComplete('pdf_to_text', Date.now() - trackStart);
      } catch (error) {
        if (cancelled) return;
        trackToolError('pdf_to_text', error, Date.now() - trackStart);
        console.error('Error extracting text from PDF:', error);
        if (isEncryptedPdfError(error)) {
          setShowEncryptedHint(true);
          setInlineError(t('errors.encryptedPdfHint'));
        } else {
          setInlineError(t('pdfToText.failedToExtract'));
        }
        setFile(null);
      } finally {
        if (!cancelled) {
          setIsExtracting(false);
          setProgress(null);
        }
      }
    }

    extractText(file);

    return () => {
      cancelled = true;
    };
  }, [file]);

  const fullText = useMemo(() => {
    if (!pageTexts) return '';
    if (includeSeparators && pageTexts.length > 1) {
      return pageTexts
        .map((text, index) => `--- Page ${index + 1} ---\n\n${text}`)
        .join('\n\n');
    }
    return pageTexts.join('\n\n');
  }, [pageTexts, includeSeparators]);

  const charCount = fullText.length;
  const wordCount = useMemo(
    () => (fullText.trim() ? fullText.trim().split(/\s+/).filter(Boolean).length : 0),
    [fullText]
  );
  const hasText = Boolean(pageTexts && pageTexts.some(text => text.length > 0));

  async function handleCopy() {
    if (!fullText) return;
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      setInlineError(t('pdfToText.failedToCopy'));
    }
  }

  function handleDownload() {
    if (!file || !fullText) return;
    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const basename = file.name.replace(/\.pdf$/i, '');
    setTextBlob(blob);
    setTextFilename(`${basename}.txt`);
    triggerEmailCapture();
  }

  function resetTool() {
    setFile(null);
    setPageTexts(null);
    setProgress(null);
    setTextBlob(null);
    setCopied(false);
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PDF to Text', url: '/pdf-to-text' }]} />
      <HowToSchema
        name="How to Extract Text from a PDF"
        description="Learn how to convert a PDF to plain text and copy or download it, entirely in your browser"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('pdfToText.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('pdfToText.description')}
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-teal-50 border border-teal-200 px-4 py-1.5 text-sm font-medium text-teal-700">
              <ShieldCheck className="h-4 w-4" />
              {t('pdfToText.privacyBadge')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col mx-auto max-w-4xl">
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
                      ${isUploading || isExtracting ? 'cursor-wait' : 'cursor-pointer'}
                      ${isExtracting ? 'opacity-50' : ''}
                      ${isUploading ? 'border-primary bg-orange-50' : isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}
                    `}
                >
                  <input {...getInputProps()} disabled={isUploading || isExtracting} />

                  <div className="flex flex-col items-center gap-4 text-center">
                    <div className={`rounded-full p-4 ${isUploading ? 'bg-orange-100' : isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
                      {isUploading || isExtracting ? (
                        <Loader2 className="h-12 w-12 text-primary animate-spin" />
                      ) : (
                        <UploadCloud className={`h-12 w-12 ${isDragActive ? 'text-green-600' : 'text-primary'}`} />
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {isExtracting ? t('common.processing') : isUploading ? t('common.uploading') : t('common.dropPdfHere')}
                      </h2>
                      <p className="text-gray-700">
                        {isExtracting
                          ? t('common.pleaseWait')
                          : isUploading
                            ? t('common.processingFile')
                            : t('common.orClickToBrowse')
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={isUploading || isExtracting}
                      className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium hover:bg-[#FF8B68] transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed pointer-events-none"
                    >
                      {isExtracting ? t('common.processing') : isUploading ? t('common.uploading') : t('common.selectPdf')}
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
                        disabled={isExtracting}
                        multiple={false}
                        accept={['application/pdf']}
                      />
                    </div>

                    <p className="mt-4 text-sm text-gray-500">
                      {t('pdfToText.localProcessingNote')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-8 lg:grid-cols-12">
                  {/* Left Column: File Info, Extraction Result */}
                  <div className="lg:col-span-7 flex flex-col gap-6">

                    {/* File info header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{file.name}</h3>
                        {pageTexts && (
                          <p className="text-sm text-gray-500">
                            {pageTexts.length} {pageTexts.length === 1 ? t('common.page') : t('common.pages')}
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

                    {/* Real per-page extraction progress */}
                    {isExtracting && progress && (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <Loader2 className="h-5 w-5 text-primary animate-spin" />
                          <p className="font-medium text-gray-900">
                            {t('pdfToText.extractingPage', { current: progress.current, total: progress.total })}
                          </p>
                        </div>
                        <div className="h-2 w-full rounded-full bg-orange-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#FF6B35] transition-all duration-200"
                            style={{ width: `${progress.total ? Math.round((progress.current / progress.total) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {pageTexts && !isExtracting && (
                      <>
                        {!hasText && (
                          <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-gray-700">
                            {t('pdfToText.noTextFound')}
                          </div>
                        )}

                        {/* Extracted text preview */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <h4 className="font-semibold text-gray-900">{t('pdfToText.textPreview')}</h4>
                            <p className="text-sm text-gray-500">
                              {t('pdfToText.charCount', { count: charCount })} · {t('pdfToText.wordCount', { count: wordCount })}
                            </p>
                          </div>
                          <textarea
                            readOnly
                            value={fullText}
                            dir="auto"
                            className="h-80 w-full resize-y rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                            aria-label={t('pdfToText.textPreview')}
                          />
                          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={includeSeparators}
                              onChange={(e) => setIncludeSeparators(e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            {t('pdfToText.pageSeparators')}
                          </label>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <button
                            onClick={handleDownload}
                            disabled={!hasText}
                            className="flex-1 min-w-[200px] px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            {t('pdfToText.downloadTxt')}
                          </button>
                          <button
                            onClick={handleCopy}
                            disabled={!hasText}
                            className="inline-flex items-center justify-center gap-2 px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {copied ? (
                              <>
                                <Check className="h-5 w-5 text-green-600" />
                                {t('pdfToText.copied')}
                              </>
                            ) : (
                              <>
                                <Copy className="h-5 w-5" />
                                {t('pdfToText.copyToClipboard')}
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Right Column: Instructions Panel */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-sm">
                      <div className="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">{t('pdfToText.howItWorks')}</h3>
                          <p className="text-sm text-gray-500">{t('pdfToText.howItWorksDesc')}</p>
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
                          {t('pdfToText.privacyBadge')}
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
      <ToolFAQ questions={faqData} faqPagePath="/pdf-to-text/faq" />

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
                {t('pdfToText.whyLocal.title')}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {t('pdfToText.whyLocal.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Related Tools */}
      <RelatedTools currentTool="pdfToText" />

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
        filename={textFilename}
        fileBlob={textBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
