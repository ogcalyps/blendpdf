'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Image as ImageIcon, Download, Zap, Lock } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { ImageToPDFGrid } from '@/components/ImageToPDFGrid';
import { Footer } from '@/components/Footer';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';
import { DeliveryChoiceModal } from '@/components/DeliveryChoiceModal';
import { useDeliveryChoice } from '@/hooks/useDeliveryChoice';
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { useToolFaqs } from '@/lib/tool-faqs';

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per image

/**
 * Normalize an image before upload:
 * - Decodes with EXIF orientation applied (createImageBitmap + 'from-image') so
 *   phone photos come out upright in the PDF instead of sideways/upside down.
 * - Re-encodes JPEG photos as JPEG (quality 0.92); PNG and WebP become PNG so
 *   transparency is preserved (the server only embeds JPEG/PNG).
 * Falls back to the original file if decoding is unavailable or fails; the
 * server reports anything it cannot embed via the X-Skipped-Files header.
 */
async function normalizeImage(file: File): Promise<File> {
  const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
  const isPng = file.type === 'image/png';
  const isWebp = file.type === 'image/webp';
  if (!isJpeg && !isPng && !isWebp) return file;

  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const outputType = isJpeg ? 'image/jpeg' : 'image/png';
    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(resolve, outputType, isJpeg ? 0.92 : undefined)
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.(jpe?g|png|webp)$/i, '');
    const extension = isJpeg ? '.jpg' : '.png';
    return new File([blob], `${baseName}${extension}`, { type: outputType });
  } catch {
    return file;
  }
}

export default function ImagesToPDFPage() {
  const t = useTranslations();
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [convertedFilename, setConvertedFilename] = useState<string>('images.pdf');
  const [pageSize, setPageSize] = useState<'a4' | 'fit'>('a4');
  const [skippedFiles, setSkippedFiles] = useState<string[]>([]);

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
      title: t('imagesToPdf.steps.upload.title'),
      description: t('imagesToPdf.steps.upload.description'),
    },
    {
      icon: <ImageIcon className="h-8 w-8 text-primary" />,
      title: t('imagesToPdf.steps.arrange.title'),
      description: t('imagesToPdf.steps.arrange.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('imagesToPdf.steps.download.title'),
      description: t('imagesToPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('imagesToPdf');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    setIsUploading(true);

    // Fix EXIF orientation and convert WebP to PNG before uploading
    const processedFiles = await Promise.all(acceptedFiles.map(normalizeImage));

    // Filter and validate images
    const imageFiles = processedFiles.filter(file => {
      const isValidType = file.type === 'image/jpeg' ||
        file.type === 'image/jpg' ||
        file.type === 'image/png' ||
        file.type === 'image/webp';
      const isValidSize = file.size <= MAX_FILE_SIZE;

      if (!isValidType) {
        alert(t('imagesToPdf.invalidImageType', { name: file.name }));
        return false;
      }
      if (!isValidSize) {
        alert(t('imagesToPdf.imageTooLarge', { name: file.name }));
        return false;
      }
      return true;
    });

    // Create preview URLs
    const newImages: ImageFile[] = imageFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      preview: URL.createObjectURL(file),
    }));

    await new Promise(resolve => setTimeout(resolve, 300));
    setImages(prev => [...prev, ...newImages]);
    setIsUploading(false);
  }, [t]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled: isUploading || isProcessing,
  });

  function removeImage(id: string) {
    setImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  }

  function reorderImages(newOrder: ImageFile[]) {
    setImages(newOrder);
  }

  async function handleConvert() {
    if (images.length === 0) return;

    setIsProcessing(true);
    setSkippedFiles([]);
    const trackStart = Date.now();
    trackToolStart('images_to_pdf');
    try {
      const formData = new FormData();

      // Add images in current order
      images.forEach((img, index) => {
        formData.append(`image_${index}`, img.file);
      });
      formData.append('count', images.length.toString());
      formData.append('pageSize', pageSize);

      const response = await fetch('/api/images-to-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Conversion failed');
      }

      // Surface any inputs the server could not embed instead of silently dropping them
      const skippedHeader = response.headers.get('X-Skipped-Files');
      if (skippedHeader) {
        setSkippedFiles(
          skippedHeader.split(',').map(name => {
            try { return decodeURIComponent(name); } catch { return name; }
          })
        );
      }

      const rawBlob = await response.blob();
      const blob = new Blob([rawBlob], { type: 'application/pdf' });
      const filename = 'images.pdf';

      // Store blob and trigger email capture
      setConvertedBlob(blob);
      setConvertedFilename(filename);
      trackToolComplete('images_to_pdf', Date.now() - trackStart);
      triggerEmailCapture();
    } catch (error) {
      trackToolError('images_to_pdf', error, Date.now() - trackStart);
      console.error('Error converting images to PDF:', error);
      alert(error instanceof Error ? error.message : t('imagesToPdf.failedToConvert'));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'Images to PDF', url: '/images-to-pdf' }]} />
      <HowToSchema
        name="How to Convert Images to PDF"
        description="Learn how to convert JPG, PNG and other images to PDF online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('imagesToPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('imagesToPdf.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left: Upload Zone or Image Grid */}
            <div className="flex flex-col gap-4">
              {images.length === 0 ? (
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
                          <Loader2 className={`h-12 w-12 ${isUploading ? 'text-primary' : 'text-primary'} animate-spin`} />
                        ) : (
                          <UploadCloud className={`h-12 w-12 ${isDragActive ? 'text-green-600' : 'text-primary'}`} />
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        <h2 className="text-2xl font-semibold text-gray-900">
                          {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('common.dropImagesHere')}
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
                        {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('common.selectImages')}
                      </button>

                      {/* Google Drive Integration */}
                      <div className="mt-4">
                        <GoogleDrivePicker
                          onFilesSelected={async (files) => {

                            // Fix EXIF orientation and convert WebP to PNG for Google Drive selected files
                            const processedFiles = await Promise.all(files.map(normalizeImage));

                            const imageFiles = processedFiles.filter(file => {
                              const isValidType = file.type === 'image/jpeg' ||
                                file.type === 'image/jpg' ||
                                file.type === 'image/png' ||
                                file.type === 'image/webp';
                              const isValidSize = file.size <= MAX_FILE_SIZE;

                              if (!isValidType) {
                                alert(t('imagesToPdf.invalidImageType', { name: file.name }));
                                return false;
                              }
                              if (!isValidSize) {
                                alert(t('imagesToPdf.imageTooLarge', { name: file.name }));
                                return false;
                              }
                              return true;
                            });

                            if (imageFiles.length > 0) {
                              const newImages: ImageFile[] = imageFiles.map(file => ({
                                id: Math.random().toString(36).substr(2, 9),
                                file,
                                preview: URL.createObjectURL(file),
                              }));
                              setImages(prev => [...prev, ...newImages]);
                            }
                          }}
                          disabled={isProcessing}
                          multiple={true}
                          accept={['image/jpeg', 'image/png', 'image/webp']}
                        />
                      </div>

                      <p className="mt-4 text-sm text-gray-500">
                        {t('imagesToPdf.supportedFormats')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* File info header */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">
                        {t('imagesToPdf.yourImages', { count: images.length })}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {t('imagesToPdf.dragToReorder')}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        images.forEach(img => URL.revokeObjectURL(img.preview));
                        setImages([]);
                        setSkippedFiles([]);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      {t('common.clearAll')}
                    </button>
                  </div>

                  {/* Instructions */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="font-semibold text-gray-900 mb-1">{t('imagesToPdf.imageOrderTitle')}</p>
                        <p className="text-sm text-gray-600">
                          {t('imagesToPdf.imageOrderDesc')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Draggable image grid */}
                  <ImageToPDFGrid
                    images={images}
                    onReorder={reorderImages}
                    onRemove={removeImage}
                  />

                  {/* Skipped files warning */}
                  {skippedFiles.length > 0 && (
                    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
                      <p className="font-semibold text-amber-900 mb-1">{t('imagesToPdf.skippedFilesTitle')}</p>
                      <p className="text-sm text-amber-800">
                        {t('imagesToPdf.skippedFilesDescription')} {skippedFiles.join(', ')}
                      </p>
                    </div>
                  )}

                  {/* Page size option */}
                  <div className="flex items-center gap-3">
                    <label htmlFor="page-size-select" className="text-sm font-medium text-gray-700">
                      {t('imagesToPdf.pageSizeLabel')}
                    </label>
                    <select
                      id="page-size-select"
                      value={pageSize}
                      onChange={(e) => setPageSize(e.target.value === 'fit' ? 'fit' : 'a4')}
                      disabled={isProcessing}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-primary focus:border-primary bg-white"
                    >
                      <option value="a4">{t('imagesToPdf.pageSizeA4')}</option>
                      <option value="fit">{t('imagesToPdf.pageSizeFit')}</option>
                    </select>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleConvert}
                      disabled={isProcessing || images.length === 0}
                      className="flex-1 px-8 py-4 bg-[#FF6B35] text-white rounded-xl font-semibold text-lg hover:bg-[#FF8B68] transition-colors shadow-lg hover:shadow-xl disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? t('imagesToPdf.creatingPdf') : t('imagesToPdf.convertImagesToPdf', { count: images.length })}
                    </button>
                    <button
                      onClick={() => {
                        images.forEach(img => URL.revokeObjectURL(img.preview));
                        setImages([]);
                        setSkippedFiles([]);
                      }}
                      className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Right: Instructions Panel */}
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border-2 border-orange-100 bg-white p-6">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100">
                    <ImageIcon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-dark">{t('imagesToPdf.howItWorks')}</h3>
                    <p className="text-sm text-gray-600">{t('imagesToPdf.howItWorksDesc')}</p>
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
      <ToolFAQ questions={faqData} faqPagePath="/images-to-pdf/faq" />

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
      <RelatedTools currentTool="images-to-pdf" />

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
