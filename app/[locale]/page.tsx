'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { GitMerge, FileMinus, Image as ImageIcon, Scissors } from 'lucide-react';
import { UploadZone } from '@/components/UploadZone';
import { FileList } from '@/components/FileList';
import { ToolCard } from '@/components/ToolCard';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProofSection } from '@/components/ProofSection';
import { ProcessingModal } from '@/components/ProcessingModal';
import { CompressDialog } from '@/components/CompressDialog';
import { SplitDialog } from '@/components/SplitDialog';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { useFileStore } from '@/store/use-file-store';
import { mergePDFs, compressPDF, splitPDF } from '@/lib/api-client';
import { PDFDocument } from 'pdf-lib';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type { CompressionLevel } from '@/types';

export default function Home() {
  const t = useTranslations();
  const { files, processing, setProcessing, setProgress, setError, setResult, resetProcessing } = useFileStore();

  const [showCompressDialog, setShowCompressDialog] = useState(false);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [isMounted, setIsMounted] = useState(false);

  // Check if component is mounted (store is ready)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function handleMerge() {
    if (files.length < 2) {
      alert('Please upload at least 2 PDFs');
      return;
    }
    try {
      setProcessing(true, 'merge');
      setProgress(30);
      const result = await mergePDFs(files.map(f => f.file));
      setProgress(100);
      setResult(result, 'merged.pdf');
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function handleCompressClick() {
    if (files.length === 0) {
      alert('Please upload a PDF');
      return;
    }
    setShowCompressDialog(true);
  }

  async function handleCompressWithLevel(level: CompressionLevel) {
    try {
      setProcessing(true, 'compress');
      setProgress(30);
      const result = await compressPDF(files[0].file, level);
      setProgress(100);
      setResult(result, 'compressed.pdf');
    } catch (error: any) {
      setError(error.message);
    }
  }

  async function handleSplitClick() {
    if (files.length === 0) {
      alert('Please upload a PDF');
      return;
    }
    try {
      const buffer = await files[0].file.arrayBuffer();
      const pdf = await PDFDocument.load(buffer);
      setPdfPageCount(pdf.getPageCount());
      setShowSplitDialog(true);
    } catch (error: any) {
      alert('Failed to read PDF');
    }
  }

  async function handleSplitWithRanges(ranges: string) {
    try {
      setProcessing(true, 'split');
      setProgress(30);
      const result = await splitPDF(files[0].file, ranges);
      setProgress(100);
      setResult(result, 'split.pdf');
    } catch (error: any) {
      setError(error.message);
    }
  }

  // Keyboard shortcuts
  const handleEscape = () => {
    if (showCompressDialog) {
      setShowCompressDialog(false);
    } else if (showSplitDialog) {
      setShowSplitDialog(false);
    } else if (processing.isProcessing) {
      // Don't close processing modal with Escape, let it complete
    }
  };

  useKeyboardShortcuts({
    onEscape: handleEscape,
    onMerge: handleMerge,
    onCompress: handleCompressClick,
  });

  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-bold text-gray-900">{t('nav.logo')}</h1>
          <LanguageSwitcher />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-blue-50 via-white to-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Headline */}
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t('hero.title')}
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              {t('hero.subtitle')}
            </p>
          </div>

          {/* Main Content Grid */}
          {!isMounted ? (
            <LoadingSkeleton />
          ) : (
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Upload Zone and File List - First on mobile, left on desktop */}
              <div className="flex flex-col gap-4 order-1 lg:order-1">
                <UploadZone />
                {files.length > 0 && <FileList />}
              </div>

              {/* Tool Cards - Second on mobile, right on desktop */}
              <div className="flex flex-col gap-4 order-2 lg:order-2">
                <h3 className="text-xl font-semibold text-gray-900">
                  {t('tools.title')}
                </h3>
                <div className="flex flex-col gap-3">
                  <ToolCard
                    tool="merge"
                    icon={<GitMerge className="h-6 w-6" />}
                    onClick={handleMerge}
                  />
                  <ToolCard
                    tool="compress"
                    icon={<FileMinus className="h-6 w-6" />}
                    onClick={handleCompressClick}
                  />
                  <ToolCard
                    tool="convert"
                    icon={<ImageIcon className="h-6 w-6" />}
                    onClick={() => {}}
                    comingSoon={true}
                  />
                  <ToolCard
                    tool="split"
                    icon={<Scissors className="h-6 w-6" />}
                    onClick={handleSplitClick}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Proof Section */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              {t('technical.title')}
            </h2>
            <p className="mt-4 text-gray-600">
              {t('technical.subtitle')}
            </p>
          </div>
          <ProofSection />
        </div>
      </section>

      {/* Why Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            {t('why.title')}
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            {/* No Sign-up Card */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <h3 className="mb-3 text-xl font-semibold text-gray-900">
                {t('why.noSignup.title')}
              </h3>
              <p className="text-gray-600">
                {t('why.noSignup.description')}
              </p>
            </div>

            {/* Auto-delete Card */}
            <div className="rounded-xl bg-white p-8 shadow-sm">
              <h3 className="mb-3 text-xl font-semibold text-gray-900">
                {t('why.autoDelete.title')}
              </h3>
              <p className="text-gray-600">
                {t('why.autoDelete.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm text-gray-600">
              {t('footer.builtBy')} <a href="https://twitter.com/adil" className="font-medium text-ocean-600 hover:text-ocean-700">@adil</a>
            </p>
            <div className="flex items-center gap-6">
              <a href="mailto:contact@blendpdf.com" className="text-sm text-gray-600 hover:text-gray-900">
                {t('footer.contact')}
              </a>
              <p className="text-sm text-gray-600">
                {t('footer.madeIn')}
              </p>
            </div>
          </div>
        </div>
      </footer>

      <CompressDialog 
        isOpen={showCompressDialog}
        onClose={() => setShowCompressDialog(false)}
        onCompress={handleCompressWithLevel}
      />
      <SplitDialog
        isOpen={showSplitDialog}
        onClose={() => setShowSplitDialog(false)}
        onSplit={handleSplitWithRanges}
        pageCount={pdfPageCount}
      />
      <ProcessingModal
        isOpen={processing.isProcessing || (processing.progress === 100 && processing.result !== null && !processing.error)}
        progress={processing.progress}
        currentTool={processing.currentTool}
        error={processing.error}
        onClose={resetProcessing}
      />
    </div>
  );
}

