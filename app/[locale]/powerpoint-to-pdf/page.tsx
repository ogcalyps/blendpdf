'use client';

import { useState, useCallback } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Upload, Zap, Download, Presentation, Zap as ZapIcon, Lock, X } from 'lucide-react';
import { ToolFAQ } from '../components/ToolFAQ';
import { RelatedTools } from '../components/RelatedTools';
import { Navigation } from '@/components/Navigation';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { HowToSchema } from '@/components/HowToSchema';
import { useTrackedDropzone } from '@/hooks/useTrackedDropzone';
import { UploadCloud, Loader2 } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Footer } from '@/components/Footer';
import { ToolWorkspace } from '@/components/workspace/ToolWorkspace';
import { trackToolStart, trackToolComplete, trackToolError, responseError } from '@/lib/analytics';
import { useToolFaqs } from '@/lib/tool-faqs';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB in bytes

// Local validator (mirrors validateWordFile in lib/utils; kept local because this
// change is scoped to new files only).
function validatePowerPointFile(file: File, maxSize?: number): string | null {
  const allowedTypes = [
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.oasis.opendocument.presentation', // .odp
  ];

  const allowedExtensions = ['.ppt', '.pptx', '.odp'];
  const fileName = file.name.toLowerCase();
  const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

  if (!allowedTypes.includes(file.type) && !hasValidExtension) {
    return 'File must be a PowerPoint presentation';
  }

  if (maxSize !== undefined && file.size > maxSize) {
    return 'File size exceeds';
  }

  if (file.size === 0) {
    return 'File is empty';
  }

  return null;
}

export default function PowerPointToPDFPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [converted, setConverted] = useState<File | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const steps = [
    {
      icon: <Upload className="h-8 w-8 text-primary" />,
      title: t('powerpointToPdf.steps.upload.title'),
      description: t('powerpointToPdf.steps.upload.description'),
    },
    {
      icon: <Zap className="h-8 w-8 text-primary" />,
      title: t('powerpointToPdf.steps.convert.title'),
      description: t('powerpointToPdf.steps.convert.description'),
    },
    {
      icon: <Download className="h-8 w-8 text-primary" />,
      title: t('powerpointToPdf.steps.download.title'),
      description: t('powerpointToPdf.steps.download.description'),
    },
  ];

  const faqData = useToolFaqs('powerpointToPdf');

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const uploadedFile = acceptedFiles[0];
      const error = validatePowerPointFile(uploadedFile, MAX_FILE_SIZE);

      if (error) {
        // Translate common error messages
        let translatedError = error;
        if (error.includes('File must be a PowerPoint presentation')) {
          translatedError = t('powerpointToPdf.errors.invalidFileType');
        } else if (error.includes('File size exceeds')) {
          translatedError = t('powerpointToPdf.errors.fileTooLarge');
        } else if (error.includes('File is empty')) {
          translatedError = t('powerpointToPdf.errors.emptyFile');
        }
        setInlineError(translatedError);
        return;
      }

      setInlineError(null);
      setIsUploading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setFile(uploadedFile);
      setIsUploading(false);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive, open } = useTrackedDropzone({
    onDrop,
    accept: {
      'application/vnd.ms-powerpoint': ['.ppt'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.oasis.opendocument.presentation': ['.odp'],
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
  };

  async function handleConvert() {
    if (!file) return;

    setIsProcessing(true);
    setInlineError(null);
    const trackStart = Date.now();
    trackToolStart('powerpoint_to_pdf');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/powerpoint-to-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw responseError(response, t('powerpointToPdf.failedToConvert'), errorData?.errorCode);
      }

      const rawBlob = await response.blob();
      const blob = new Blob([rawBlob], { type: 'application/pdf' });
      const filename = file.name.replace(/\.(pptx?|odp)$/i, '.pdf');

      // Open it in the workspace, which offers the download at once
      setConverted(new File([blob], filename, { type: 'application/pdf' }));
      trackToolComplete('powerpoint_to_pdf', Date.now() - trackStart);
    } catch (error) {
      trackToolError('powerpoint_to_pdf', error, Date.now() - trackStart);
      console.error('Error converting PowerPoint to PDF:', error);
      setInlineError(error instanceof Error ? error.message : t('powerpointToPdf.failedToConvert'));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <BreadcrumbSchema items={[{ name: 'Home', url: '/' }, { name: 'PowerPoint to PDF', url: '/powerpoint-to-pdf' }]} />
      <HowToSchema
        name={t('powerpointToPdf.howToTitle')}
        description="Learn how to convert PowerPoint presentations (PPT, PPTX, ODP) to PDF format online for free"
        steps={steps.map(step => ({ title: step.title, description: step.description }))}
      />
      <Navigation />

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('powerpointToPdf.title')}
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              {t('powerpointToPdf.answer')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Section - 2 Column Layout */}
      {converted ? (
        <ToolWorkspace
          mode="converted"
          initialFile={converted}
          deliverOnOpen
          onClose={() => {
            setConverted(null);
            setFile(null);
          }}
        />
      ) : (
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
                            {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('common.dropFileHere')}
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
                          {isProcessing ? t('common.processing') : isUploading ? t('common.uploading') : t('powerpointToPdf.selectFile')}
                        </Button>

                        <p className="mt-4 text-sm text-gray-500">
                          {t('powerpointToPdf.supportedFormats')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // File preview
                  <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-gray-900">{t('powerpointToPdf.uploadedFile')}</h3>
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
                        <Presentation className="w-8 h-8 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {t('powerpointToPdf.fileSize')} {formatFileSize(file.size, locale)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Convert button */}
                    <Button
                      onClick={handleConvert}
                      size="lg"
                      className="w-full"
                      disabled={isProcessing}
                    >
                      {isProcessing ? t('common.processing') : t('powerpointToPdf.convertButton')}
                    </Button>
                  </div>
                )}
              </div>

              {/* RIGHT: Instructions Panel */}
              <div className="bg-white rounded-2xl border-2 border-orange-100 p-6">
                <h3 className="text-lg font-bold text-dark mb-4">{t('powerpointToPdf.howToTitle')}</h3>
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
      )}

      {/* Why BlendPDF Section */}
      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-dark mb-8">
            {t('why.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <ZapIcon className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.noSignup.title')}</h3>
                <p className="text-gray-700">{t('why.noSignup.description')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4 bg-orange-50 p-6 rounded-xl border border-orange-100">
              <Lock className="w-8 h-8 text-primary flex-shrink-0" />
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{t('why.autoDelete.title')}</h3>
                <p className="text-gray-700">{t('why.autoDelete.description')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <ToolFAQ questions={faqData} faqPagePath="/powerpoint-to-pdf/faq" />

      {/* Related Tools Section */}
      <RelatedTools currentTool="powerpointToPdf" />

      {/* Footer */}
      <Footer />
    </div>
  );
}
