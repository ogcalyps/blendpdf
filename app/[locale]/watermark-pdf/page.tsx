'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Droplets, Download, FileText, X, Image as ImageIcon } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { ProcessingModal } from '@/components/ProcessingModal';
import { useFileStore } from '@/store/use-file-store';
import { watermarkPDF } from '@/lib/api-client';
import { runPdfOpInWorker, shouldUseClientPdf, ClientPdfError } from '@/lib/client-pdf';
import { isWinAnsiEncodable } from '@/lib/pdf-ops';
import { renderTextToImage } from '@/lib/text-to-image';
import { Navigation } from '@/components/Navigation';
import { PDFLivePreview } from '@/components/PDFLivePreview';
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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

export default function WatermarkPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const { processing, setProcessing, setProgress, setError, setResult, resetProcessing, clearFiles } = useFileStore();
  const [file, setFile] = useState<File | null>(null);
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('DRAFT');
  const [position, setPosition] = useState('diagonal');
  const [opacity, setOpacity] = useState(0.3);
  const [fontSize, setFontSize] = useState(48);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [watermarkedBlob, setWatermarkedBlob] = useState<Blob | null>(null);
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
    fileBlob: watermarkedBlob,
    filename: file ? file.name.replace('.pdf', '_watermarked.pdf') : 'watermarked.pdf',
    onDownload: () => {
      if (watermarkedBlob) {
        downloadBlob(watermarkedBlob, file ? file.name.replace('.pdf', '_watermarked.pdf') : 'watermarked.pdf');
      }
    },
    onReset: () => {
      setWatermarkedBlob(null);
    },
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('watermarkPdf.steps.upload.title'),
      description: t('watermarkPdf.steps.upload.description'),
    },
    {
      icon: <Droplets className="h-8 w-8 text-primary" />,
      title: t('watermarkPdf.steps.customize.title'),
      description: t('watermarkPdf.steps.customize.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('watermarkPdf.steps.download.title'),
      description: t('watermarkPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('watermarkPdf');

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
    setWatermarkedBlob(null);
  }, []);

  const onImageDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    const img = acceptedFiles[0];
    if (!img.type.startsWith('image/')) {
      setInlineError(t('watermarkPdf.imageRequired'));
      return;
    }
    if (img.size > MAX_IMAGE_SIZE) {
      setInlineError(t('watermarkPdf.imageTooLarge'));
      return;
    }
    setInlineError(null);
    setImageFile(img);
  }, [t]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    disabled: processing.isProcessing,
  });

  const { getRootProps: getImageRootProps, getInputProps: getImageInputProps, isDragActive: isImageDragActive } = useDropzone({
    onDrop: onImageDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
    disabled: processing.isProcessing || watermarkType !== 'image',
  });

  const handleRemoveFile = () => {
    setFile(null);
    setWatermarkedBlob(null);
    setImageFile(null);
    clearFiles();
  };

  const handleAddWatermark = async () => {
    if (!file) return;
    if (watermarkType === 'image' && !imageFile) {
      setInlineError(t('watermarkPdf.imageRequired'));
      return;
    }

    setShowEncryptedHint(false);

    // Non-WinAnsi watermark text (Arabic, CJK, emoji): pdf-lib's standard
    // fonts can't encode it, and embedding a Unicode font wouldn't shape or
    // bidi-reorder Arabic anyway. The browser IS a correct text shaper, so
    // render the text to a transparent PNG on a canvas and stamp it as an
    // IMAGE watermark. This path is client-only — the server route still
    // rejects non-WinAnsi text, so there is deliberately no server fallback.
    if (watermarkType === 'text' && !isWinAnsiEncodable(text)) {
      if (!shouldUseClientPdf(file.size)) {
        setError(t('watermarkPdf.textRenderError'));
        setWatermarkedBlob(null);
        return;
      }
      try {
        setProcessing(true, 'convert');
        setProgress(20);
        // SIZE MATCHING: the worker draws image watermarks at
        // image.scale(0.5) of the embedded pixel size. Rendering the glyphs
        // at (fontSize * 2) canvas pixels therefore stamps them at
        // fontSize * 2 * 0.5 = fontSize PDF points — the same visual size the
        // text path gives a Latin watermark at this fontSize — while keeping
        // 2 px per point of resolution so the stamp isn't blurry.
        let rendered;
        try {
          rendered = await renderTextToImage(text, {
            fontSizePx: fontSize * 2,
            color: '#b3b3b3', // matches the text path's rgb(0.7, 0.7, 0.7)
            direction: 'auto',
          });
        } catch {
          throw new Error(t('watermarkPdf.textRenderError'));
        }
        setProgress(40);
        // Fresh buffer per attempt — buffers are transferred to the worker
        // and detached. The rendered PNG bytes are structured-cloned (not
        // transferred), so they survive a retry.
        const runOnce = async () =>
          runPdfOpInWorker({
            op: 'watermark',
            buffer: await file.arrayBuffer(),
            options: {
              type: 'image',
              image: { bytes: rendered.bytes, mimeType: 'image/png' },
              position: position as 'center' | 'diagonal' | 'tiled',
              opacity,
              fontSize,
            },
          });
        let bytes: Uint8Array;
        try {
          bytes = await runOnce();
        } catch (error) {
          if (error instanceof ClientPdfError && !error.retryOnServer) throw error;
          // Retryable worker failure (timeout, crash): the server can't take
          // over — it rejects non-WinAnsi text — so retry once client-side,
          // then surface an honest error below.
          bytes = await runOnce();
        }
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        setProgress(100);
        setWatermarkedBlob(blob);
        setResult(blob, 'watermarked.pdf');
      } catch (error: any) {
        setError(error?.message || t('watermarkPdf.textRenderError'));
        setWatermarkedBlob(null);
        if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
      }
      return;
    }

    // Client-first: watermark locally in a Web Worker when supported.
    if (shouldUseClientPdf(file.size + (watermarkType === 'image' && imageFile ? imageFile.size : 0))) {
      try {
        setProcessing(true, 'convert');
        setProgress(30);
        // NOTE: buffers are transferred to the worker and detached — the
        // server fallback below rebuilds its FormData from the original Files.
        const buffer = await file.arrayBuffer();
        const bytes = await runPdfOpInWorker({
          op: 'watermark',
          buffer,
          options: {
            type: watermarkType,
            text,
            image:
              watermarkType === 'image' && imageFile
                ? { bytes: await imageFile.arrayBuffer(), mimeType: imageFile.type }
                : undefined,
            position: position as 'center' | 'diagonal' | 'tiled',
            opacity,
            fontSize,
          },
        });
        const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
        setProgress(100);
        setWatermarkedBlob(blob);
        setResult(blob, 'watermarked.pdf');
        return;
      } catch (error: any) {
        if (error instanceof ClientPdfError && !error.retryOnServer) {
          // Same failure would happen server-side — surface it through the
          // existing error UI instead of re-uploading.
          setError(error.code === 'UNSUPPORTED_TEXT' ? t('errors.unsupportedCharacters') : error.message);
          setWatermarkedBlob(null);
          if (error.code === 'ENCRYPTED_PDF' || isEncryptedPdfError(error)) setShowEncryptedHint(true);
          return;
        }
        console.warn('[client-pdf] falling back to server:', error);
      }
    }

    try {
      setProcessing(true, 'convert');
      setProgress(30);
      const result = await watermarkPDF(file, watermarkType, text, position, opacity, fontSize, imageFile || undefined);
      setProgress(100);
      setWatermarkedBlob(result);
      setResult(result, 'watermarked.pdf');
    } catch (error: any) {
      setError(error.message);
      setWatermarkedBlob(null);
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    }
  };

  const handleDownload = () => {
    triggerEmailCapture();
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Watermark PDF', url: '/watermark-pdf' }]} />
      <HowToSchema
        name="How to Add Watermark to PDF"
        description="Learn how to add text or image watermarks to PDF files online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('watermarkPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">{t('watermarkPdf.description')}</p>
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
                    <div className="mt-2 rounded-lg bg-[#FF6B35] px-6 py-3 text-white font-medium text-center pointer-events-none">
                      {t('watermarkPdf.chooseFile')}
                    </div>
                    <div className="mt-4">
                      <GoogleDrivePicker onFilesSelected={async (files) => { if (files.length === 0) return; const uploadedFile = files[0]; const error = validateFile(uploadedFile, MAX_FILE_SIZE); if (error) { setInlineError(error); return; } setInlineError(null); setShowEncryptedHint(false); setFile(uploadedFile); setWatermarkedBlob(null); }} disabled={processing.isProcessing} multiple={false} accept={['application/pdf']} />
                    </div>
                    <p className="mt-4 text-sm text-gray-500">{t('watermarkPdf.singleFile')}</p>
                    <p className="text-sm text-gray-600">{t('clientSide.processedLocally')}</p>
                    <p className="text-xs text-gray-400">{t('clientSide.fallbackNote')}</p>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('watermarkPdf.uploadedFile')}</h3>
                    <button onClick={handleRemoveFile} className="p-1 text-red-600 hover:text-red-700 transition-colors" aria-label={t('common.removeFile')}>
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-1/3 min-w-[150px]">
                      <PDFLivePreview file={file} pageNumber={1}>
                        <div className="absolute top-0 left-0 w-full h-full z-20 pointer-events-none" style={{ opacity }}>
                          {position === 'tiled' ? (
                            <div className="absolute inset-0 flex flex-wrap content-start overflow-hidden">
                              {Array.from({ length: 20 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-center pointer-events-none p-12">
                                  {watermarkType === 'text' ? (
                                    <span
                                      className="font-bold text-gray-900 pointer-events-none block"
                                      style={{
                                        fontSize: `${fontSize}px`,
                                        lineHeight: 1,
                                        transform: 'rotate(-45deg)',
                                        whiteSpace: 'nowrap',
                                        color: '#b3b3b3'
                                      }}
                                    >
                                      {text || 'DRAFT'}
                                    </span>
                                  ) : (
                                    imageFile && (
                                      <div
                                        className="pointer-events-none bg-contain bg-center bg-no-repeat w-full h-full"
                                        style={{
                                          backgroundImage: `url(${URL.createObjectURL(imageFile)})`,
                                          opacity: opacity
                                        }}
                                      />
                                    )
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={`absolute pointer-events-none transform
                                    ${position === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
                                    ${position === 'diagonal' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-45deg]' : ''}
                                `}>
                              {watermarkType === 'text' ? (
                                <span
                                  className="font-bold text-gray-900 pointer-events-none block"
                                  style={{
                                    fontSize: `${fontSize}px`,
                                    lineHeight: 1,
                                    whiteSpace: 'nowrap',
                                    color: '#b3b3b3'
                                  }}
                                >
                                  {text || 'DRAFT'}
                                </span>
                              ) : (
                                imageFile && (
                                  <div
                                    className="pointer-events-none bg-contain bg-center bg-no-repeat"
                                    style={{
                                      backgroundImage: `url(${URL.createObjectURL(imageFile)})`,
                                      width: '200px',
                                      height: '100px',
                                      opacity: opacity
                                    }}
                                  />
                                )
                              )}
                            </div>
                          )}
                        </div>
                      </PDFLivePreview>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 break-all">{file.name}</p>
                      <p className="text-sm text-gray-600">{formatFileSize(file.size, locale)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">{t('watermarkPdf.customize')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('watermarkPdf.typeLabel')}</label>
                    <select value={watermarkType} onChange={(e) => setWatermarkType(e.target.value as 'text' | 'image')} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" disabled={processing.isProcessing}>
                      <option value="text">{t('watermarkPdf.types.text')}</option>
                      <option value="image">{t('watermarkPdf.types.image')}</option>
                    </select>
                  </div>

                  {watermarkType === 'text' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('watermarkPdf.textLabel')}</label>
                        <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('watermarkPdf.textPlaceholder')} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" disabled={processing.isProcessing} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">{t('watermarkPdf.fontSizeLabel')}</label>
                        <input type="number" min="12" max="120" value={fontSize} onChange={(e) => setFontSize(parseInt(e.target.value) || 48)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" disabled={processing.isProcessing} />
                      </div>
                    </>
                  ) : (
                    <div {...getImageRootProps()} className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer ${isImageDragActive ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                      <input {...getImageInputProps()} />
                      {imageFile ? (
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-green-600" />
                          <span className="text-sm text-gray-700">{imageFile.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setImageFile(null); }} className="ms-auto text-red-600">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <ImageIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">{t('watermarkPdf.dropImage')}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('watermarkPdf.positionLabel')}</label>
                    <select value={position} onChange={(e) => setPosition(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" disabled={processing.isProcessing}>
                      <option value="center">{t('watermarkPdf.positions.center')}</option>
                      <option value="diagonal">{t('watermarkPdf.positions.diagonal')}</option>
                      <option value="tiled">{t('watermarkPdf.positions.tiled')}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('watermarkPdf.opacityLabel')} ({Math.round(opacity * 100)}%)</label>
                    <input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} className="w-full" disabled={processing.isProcessing} />
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  {!watermarkedBlob ? (
                    <Button onClick={handleAddWatermark} disabled={!file || (watermarkType === 'image' && !imageFile) || processing.isProcessing} size="lg" className="w-full disabled:opacity-50 disabled:cursor-not-allowed">
                      {processing.isProcessing && processing.currentTool === 'convert' ? t('watermarkPdf.processing') : t('watermarkPdf.addWatermark')}
                    </Button>
                  ) : (
                    <>
                      <Button onClick={handleDownload} size="lg" className="w-full bg-success-green hover:from-green-600 hover:to-green-700">
                        {t('watermarkPdf.downloadWatermarked')}
                      </Button>
                      <Button onClick={handleRemoveFile} variant="secondary" size="md" className="w-full">
                        {t('watermarkPdf.addAnother')}
                      </Button>
                    </>
                  )}
                  <p className="text-xs text-gray-500 text-center">
                    {t('clientSide.processedLocally')}{' '}
                    <span className="text-gray-400">{t('clientSide.fallbackNote')}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <HowItWorks steps={steps} />
      <ToolFAQ questions={faqData} faqPagePath="/watermark-pdf/faq" />
      <RelatedTools currentTool="watermark" />
      <Footer />

      <ProcessingModal isOpen={processing.isProcessing || processing.error !== null || (processing.progress === 100 && processing.result !== null)} progress={processing.progress} currentTool={processing.currentTool} error={processing.error} onClose={resetProcessing} onRetry={handleAddWatermark} />

      <EmailCaptureModal
        isOpen={showEmailCapture}
        onEmailSubmitted={() => { }} // Not used when using delivery choice flow
        onEmailCaptured={handleEmailCaptured}
      />

      <DeliveryChoiceModal
        isOpen={showDeliveryChoice}
        email={capturedEmail}
        filename={file ? file.name.replace('.pdf', '_watermarked.pdf') : 'watermarked.pdf'}
        fileBlob={watermarkedBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
