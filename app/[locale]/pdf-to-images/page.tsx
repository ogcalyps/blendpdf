'use client';

import { useState, useCallback, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Zap, Download, FileText, Image as ImageIcon, Loader2, X, Download as DownloadIcon } from 'lucide-react';
import { HowItWorks } from '../components/HowItWorks';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { validateFile, formatFileSize } from '@/lib/utils';
import { GoogleDrivePicker } from '@/components/GoogleDrivePicker';
import { Button } from '@/components/ui/Button';
import { Footer } from '@/components/Footer';
import { EmailCaptureModal } from '@/components/EmailCaptureModal';
import { DeliveryChoiceModal } from '@/components/DeliveryChoiceModal';
import { useDeliveryChoice } from '@/hooks/useDeliveryChoice';
import { trackToolStart, trackToolComplete, trackToolError } from '@/lib/analytics';
import { Link } from '@/i18n/routing';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** Matches the ENCRYPTED_PDF errorCode contract from the API routes. */
const isEncryptedPdfError = (error: unknown): boolean =>
  (error as { errorCode?: string } | null)?.errorCode === 'ENCRYPTED_PDF' ||
  /ENCRYPTED_PDF|password[\s-]?protected|encrypted/i.test(
    error instanceof Error ? error.message : String(error ?? '')
  );

interface ConvertedImage {
  id: string;
  pageNumber: number;
  url: string;
  format: 'jpg' | 'png';
}

interface ImageThumbnailProps {
  image: ConvertedImage;
  onDownload: (image: ConvertedImage) => void;
  t: (key: string) => string;
}

function ImageThumbnail({ image, onDownload, t }: ImageThumbnailProps) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
  };

  return (
    <div
      className="relative bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-primary transition-colors"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-[3/4] relative rounded-lg overflow-hidden">
        <img
          src={image.url}
          alt={`Page ${image.pageNumber}`}
          className="w-full h-full object-contain"
        />
        <div className="absolute top-2 start-2 bg-black/90 text-white text-xs px-2 py-1 rounded z-10">
          {t('common.page')} {image.pageNumber}
        </div>
        {/* Download button overlay - always visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownload(image);
          }}
          className="absolute bottom-2 end-2 bg-primary text-white px-2.5 py-1.5 rounded-md hover:bg-[#FF8B68] transition-all shadow-lg flex items-center justify-center gap-1.5 z-10"
          title={t('common.download')}
          type="button"
        >
          <DownloadIcon className="w-3.5 h-3.5" />
          <span className="text-xs font-medium">{t('common.download')}</span>
        </button>
      </div>

      {/* Hover preview - positioned above the thumbnail using absolute positioning */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50 pointer-events-none">
          <div className="bg-white rounded-lg shadow-2xl border-2 border-gray-300 p-2" style={{ maxWidth: '300px', maxHeight: '400px' }}>
            <img
              src={image.url}
              alt={`Page ${image.pageNumber} preview`}
              className="max-h-[400px] max-w-[300px] object-contain"
            />
          </div>
          {/* Arrow pointing down */}
          <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
            <div className="w-4 h-4 bg-white border-r-2 border-b-2 border-gray-300 transform rotate-45"></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PDFToImagesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [images, setImages] = useState<ConvertedImage[]>([]);
  const [imageFormat, setImageFormat] = useState<'jpg' | 'png'>('jpg');
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
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
    fileBlob: zipBlob,
    filename: 'images.zip',
    onDownload: () => {
      if (zipUrl) {
        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = 'images.zip';
        a.click();
        setZipBlob(null);
      }
    },
    onReset: () => {
      setZipBlob(null);
    },
  });

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('pdfToImages.steps.upload.title'),
      description: t('pdfToImages.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('pdfToImages.steps.convert.title'),
      description: t('pdfToImages.steps.convert.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('pdfToImages.steps.download.title'),
      description: t('pdfToImages.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('pdfToImages');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const uploadedFile = acceptedFiles[0];
      const error = validateFile(uploadedFile, MAX_FILE_SIZE);

      if (error) {
        setInlineError(error);
        return;
      }

      setInlineError(null);
      setShowEncryptedHint(false);
      setIsUploading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setFile(uploadedFile);
      setIsUploading(false);
      // Clear previous results
      setImages([]);
      setZipUrl(null);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
    disabled: isUploading || isProcessing,
  });

  const handleFileSelect = () => {
    open();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setIsProcessing(false);
    setImages([]);
    setZipUrl(null);
    // Cleanup object URLs
    images.forEach(img => URL.revokeObjectURL(img.url));
    if (zipUrl) URL.revokeObjectURL(zipUrl);
  };

  async function handleConvert() {
    if (!file) return;

    setIsProcessing(true);
    setImages([]);
    setZipUrl(null);
    setInlineError(null);
    setShowEncryptedHint(false);
    const trackStart = Date.now();
    trackToolStart('pdf_to_images');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', imageFormat);
      formData.append('dpi', '300');

      const response = await fetch('/api/pdf-to-images', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const error = new Error(
          errorData?.error || errorData?.message || t('pdfToImages.failedToConvert')
        ) as Error & { errorCode?: string };
        if (errorData?.errorCode) error.errorCode = String(errorData.errorCode);
        throw error;
      }

      // Get ZIP file
      const rawBlob = await response.blob();
      const zipBlob = new Blob([rawBlob], { type: 'application/zip' });
      const zipUrl = window.URL.createObjectURL(zipBlob);
      setZipUrl(zipUrl);
      setZipBlob(zipBlob); // Store for email capture

      // Extract images from ZIP for preview
      // We'll need to extract them client-side or get them from the API
      // For now, let's create a separate endpoint to get individual images
      // Or we can extract from ZIP using JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const zipData = await zip.loadAsync(zipBlob);

      const imagePromises: Promise<ConvertedImage>[] = [];
      let pageNum = 1;

      for (const [filename, file] of Object.entries(zipData.files)) {
        if (!file.dir && (filename.endsWith('.jpg') || filename.endsWith('.png'))) {
          const blob = await file.async('blob');
          const url = URL.createObjectURL(blob);
          imagePromises.push(
            Promise.resolve({
              id: `page-${pageNum}`,
              pageNumber: pageNum,
              url,
              format: filename.endsWith('.png') ? 'png' : 'jpg',
            })
          );
          pageNum++;
        }
      }

      const extractedImages = await Promise.all(imagePromises);
      trackToolComplete('pdf_to_images', Date.now() - trackStart);
      setImages(extractedImages);
    } catch (error) {
      trackToolError('pdf_to_images', error, Date.now() - trackStart);
      console.error('Error converting PDF to images:', error);
      setInlineError(error instanceof Error ? error.message : t('pdfToImages.failedToConvert'));
      if (isEncryptedPdfError(error)) setShowEncryptedHint(true);
    } finally {
      setIsProcessing(false);
    }
  }

  function handleDownloadImage(image: ConvertedImage) {
    const a = document.createElement('a');
    a.href = image.url;
    a.download = `page-${image.pageNumber}.${image.format}`;
    a.click();
  }

  function handleDownloadAll() {
    triggerEmailCapture();
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PDF to Images', url: '/pdf-to-images' }]} />
      <HowToSchema
        name="How to Convert PDF to Images"
        description="Learn how to convert PDF pages to high-quality images (JPG, PNG) online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('pdfToImages.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('pdfToImages.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* LEFT: Upload Zone / Results */}
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
                <div {...getRootProps()} className="cursor-pointer">
                  <input {...getInputProps()} />
                  <div
                    className={`
                      relative flex min-h-[400px] flex-col items-center justify-center rounded-2xl bg-white p-8 sm:p-16
                      border-2 border-dashed transition-colors duration-200
                      ${isDragActive ? 'border-green-500 bg-green-50' : 'border-orange-200 hover:border-primary hover:bg-orange-50'}
                    `}
                  >
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className={`rounded-full p-4 ${isDragActive ? 'bg-green-100' : 'bg-orange-100'}`}>
                        {isUploading || isProcessing ? (
                          <Loader2 className={`h-12 w-12 ${isUploading ? 'text-primary' : 'text-primary'} animate-spin`} />
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
                      <Button
                        type="button"
                        size="md"
                        className="mt-2 pointer-events-none"
                        disabled={isUploading || isProcessing}
                      >
                        {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('common.selectPdf')}
                      </Button>

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
                            setIsUploading(true);
                            await new Promise(resolve => setTimeout(resolve, 300));
                            setFile(uploadedFile);
                            setIsUploading(false);
                            setImages([]);
                            setZipUrl(null);
                          }}
                          disabled={isProcessing}
                          multiple={false}
                          accept={['application/pdf']}
                        />
                      </div>

                      <p className="mt-4 text-sm text-gray-500">
                        {t('common.maxFileSize')}
                      </p>
                    </div>
                  </div>
                </div>
              ) : images.length === 0 ? (
                // File preview before conversion
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">{t('pdfToImages.uploadedFile')}</h3>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      aria-label={t('common.removeFile')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* File card */}
                  <div className="bg-orange-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-8 h-8 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(file.size, locale)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Format selection */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('pdfToImages.imageFormat')}
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="format"
                          value="jpg"
                          checked={imageFormat === 'jpg'}
                          onChange={(e) => setImageFormat(e.target.value as 'jpg' | 'png')}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="text-sm text-gray-700">JPG</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="format"
                          value="png"
                          checked={imageFormat === 'png'}
                          onChange={(e) => setImageFormat(e.target.value as 'jpg' | 'png')}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="text-sm text-gray-700">PNG</span>
                      </label>
                    </div>
                  </div>

                  {/* Convert button */}
                  <Button
                    onClick={handleConvert}
                    size="lg"
                    className="w-full"
                    disabled={isProcessing}
                  >
                    {isProcessing ? t('common.processing') : t('pdfToImages.convertButton')}
                  </Button>
                </div>
              ) : (
                // Images grid
                <div className="bg-white rounded-2xl border-2 border-orange-100 p-6" style={{ overflow: 'visible' }}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900">
                      {t('pdfToImages.convertedImages', { count: images.length })}
                    </h3>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1 text-red-600 hover:text-red-700 transition-colors"
                      aria-label={t('common.removeFile')}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Download all button */}
                  {zipUrl && (
                    <div className="mb-4">
                      <Button
                        onClick={handleDownloadAll}
                        size="md"
                        className="w-full"
                      >
                        <DownloadIcon className="w-4 h-4 me-2" />
                        {t('pdfToImages.downloadAll')}
                      </Button>
                    </div>
                  )}

                  {/* Images grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto" style={{ overflowX: 'visible' }}>
                    {images.map((image) => (
                      <ImageThumbnail
                        key={image.id}
                        image={image}
                        onDownload={handleDownloadImage}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: Instructions Panel */}
            <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
              <h3 className="text-lg font-bold text-dark mb-4">{t('pdfToImages.howItWorks')}</h3>
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 rounded-full bg-orange-100 p-3 text-primary">
                      {step.icon}
                    </div>
                    <div>
                      <h4 className="text-md font-semibold text-gray-900">{step.title}</h4>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why BlendPDF Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-dark mb-8">
            {t('why.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <Zap className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.noSignup.title')}</h3>
                <p className="text-gray-700">{t('why.noSignup.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <ImageIcon className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.autoDelete.title')}</h3>
                <p className="text-gray-700">{t('why.autoDelete.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/pdf-to-images/faq" />

      {/* Related Tools Section */}
      <RelatedTools currentTool="pdf-to-images" />

      {/* Footer */}
      <Footer />

      {/* Email Capture Modal */}
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
        filename={file ? file.name.replace(/\.pdf$/i, '_images.zip') : 'images.zip'}
        fileBlob={zipBlob}
        onSendViaEmail={handleSendViaEmail}
        onDownloadDirectly={handleDownloadDirectly}
        isSending={isSendingEmail}
        successType={successType}
      />
    </div>
  );
}
