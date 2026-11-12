'use client';

import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { GitMerge, FileMinus, Image as ImageIcon, Scissors, RotateCw, ArrowUpDown, Trash2, FileImage, FileText, File, Table, Wrench, Shield, Key, Unlock, Hash, Droplets, PenTool, Presentation, FileSpreadsheet, AlignLeft, FileOutput, Images, Crop, Layers, EyeOff, ScanText, FilePenLine, FileBadge } from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

interface RelatedToolsProps {
  currentTool: string;
}

// Curated per-tool relatedness map (keyed by the currentTool values pages pass in).
const relatedByTool: Record<string, string[]> = {
  merge: ['split', 'compress', 'reorder', 'delete-pages'],
  split: ['extract-pages', 'merge', 'delete-pages', 'rotate'],
  compress: ['merge', 'split', 'pdf-to-word', 'repair'],
  rotate: ['crop-pdf', 'reorder', 'split', 'delete-pages'],
  reorder: ['rotate', 'split', 'merge', 'delete-pages'],
  'delete-pages': ['extract-pages', 'split', 'reorder', 'merge'],
  'images-to-pdf': ['pdf-to-images', 'merge', 'compress', 'word-to-pdf'],
  'pdf-to-images': ['extract-images', 'images-to-pdf', 'split', 'compress'],
  'pdf-to-word': ['word-to-pdf', 'pdf-to-excel', 'pdf-to-text', 'pdf-to-images'],
  'word-to-pdf': ['powerpoint-to-pdf', 'excel-to-pdf', 'pdf-to-word', 'compress'],
  'pdf-to-excel': ['excel-to-pdf', 'pdf-to-word', 'pdf-to-text', 'compress'],
  repair: ['ocr-pdf', 'compress', 'unlock', 'merge'],
  protect: ['unlock', 'remove-metadata', 'sign', 'watermark'],
  unlock: ['protect', 'repair', 'sign', 'merge'],
  'add-page-numbers': ['watermark', 'sign', 'reorder', 'merge'],
  watermark: ['edit-pdf', 'add-page-numbers', 'protect', 'sign'],
  sign: ['edit-pdf', 'flatten-pdf', 'protect', 'watermark'],
  'fill-form': ['edit-pdf', 'flatten-pdf', 'sign', 'pdf-to-word'],
  // New tools (pages pass camelCase ids)
  powerpointToPdf: ['word-to-pdf', 'excel-to-pdf', 'pdf-to-images', 'compress'],
  excelToPdf: ['word-to-pdf', 'powerpoint-to-pdf', 'pdf-to-excel', 'compress'],
  pdfToText: ['ocr-pdf', 'pdf-to-word', 'pdf-to-excel', 'extract-images'],
  ocrPdf: ['pdf-to-text', 'pdf-to-word', 'pdf-to-excel', 'repair'],
  extractPages: ['split', 'delete-pages', 'merge', 'reorder'],
  extractImages: ['pdf-to-images', 'images-to-pdf', 'pdf-to-text', 'compress'],
  cropPdf: ['edit-pdf', 'rotate', 'delete-pages', 'reorder'],
  flattenPdf: ['edit-pdf', 'sign', 'remove-metadata', 'watermark'],
  removeMetadata: ['protect', 'flatten-pdf', 'unlock', 'compress'],
  editPdf: ['pdf-to-word', 'sign', 'compress', 'watermark'],
  pdfa: ['word-to-pdf', 'merge', 'compress', 'ocr-pdf'],
};

export function RelatedTools({ currentTool }: RelatedToolsProps) {
  const t = useTranslations('nav.tools');
  const tCommon = useTranslations('relatedTools');
  
  const allTools: Tool[] = [
    {
      id: 'merge',
      name: t('mergePdf.title'),
      href: '/merge-pdf',
      icon: <GitMerge className="h-6 w-6" />,
      description: t('mergePdf.description'),
    },
    {
      id: 'compress',
      name: t('compressPdf.title'),
      href: '/compress-pdf',
      icon: <FileMinus className="h-6 w-6" />,
      description: t('compressPdf.description'),
    },
    {
      id: 'split',
      name: t('splitPdf.title'),
      href: '/split-pdf',
      icon: <Scissors className="h-6 w-6" />,
      description: t('splitPdf.description'),
    },
    {
      id: 'rotate',
      name: t('rotatePdf.title'),
      href: '/rotate-pdf',
      icon: <RotateCw className="h-6 w-6" />,
      description: t('rotatePdf.description'),
    },
    {
      id: 'reorder',
      name: t('reorderPages.title'),
      href: '/reorder-pdf',
      icon: <ArrowUpDown className="h-6 w-6" />,
      description: t('reorderPages.description'),
    },
    {
      id: 'delete-pages',
      name: t('deletePages.title'),
      href: '/delete-pages',
      icon: <Trash2 className="h-6 w-6" />,
      description: t('deletePages.description'),
    },
    {
      id: 'images-to-pdf',
      name: t('imagesToPdf.title'),
      href: '/images-to-pdf',
      icon: <FileImage className="h-6 w-6" />,
      description: t('imagesToPdf.description'),
    },
    {
      id: 'pdf-to-images',
      name: t('pdfToImages.title'),
      href: '/pdf-to-images',
      icon: <ImageIcon className="h-6 w-6" />,
      description: t('pdfToImages.description'),
    },
    {
      id: 'pdf-to-word',
      name: t('pdfToWord.title'),
      href: '/pdf-to-word',
      icon: <FileText className="h-6 w-6" />,
      description: t('pdfToWord.description'),
    },
    {
      id: 'word-to-pdf',
      name: t('wordToPdf.title'),
      href: '/word-to-pdf',
      icon: <File className="h-6 w-6" />,
      description: t('wordToPdf.description'),
    },
    {
      id: 'pdf-to-excel',
      name: t('pdfToExcel.title'),
      href: '/pdf-to-excel',
      icon: <Table className="h-6 w-6" />,
      description: t('pdfToExcel.description'),
    },
    {
      id: 'pdf-to-pdfa',
      name: t('pdfToPdfa.title'),
      href: '/pdf-to-pdfa',
      icon: <FileBadge className="h-6 w-6" />,
      description: t('pdfToPdfa.description'),
    },
    {
      id: 'repair',
      name: t('repairPdf.title'),
      href: '/repair-pdf',
      icon: <Wrench className="h-6 w-6" />,
      description: t('repairPdf.description'),
    },
    {
      id: 'protect',
      name: t('protectPdf.title'),
      href: '/protect-pdf',
      icon: <Shield className="h-6 w-6" />,
      description: t('protectPdf.description'),
    },
    {
      id: 'unlock',
      name: t('unlockPdf.title'),
      href: '/unlock-pdf',
      icon: <Unlock className="h-6 w-6" />,
      description: t('unlockPdf.description'),
    },
    {
      id: 'add-page-numbers',
      name: t('addPageNumbers.title'),
      href: '/add-page-numbers',
      icon: <Hash className="h-6 w-6" />,
      description: t('addPageNumbers.description'),
    },
    {
      id: 'watermark',
      name: t('addWatermark.title'),
      href: '/watermark-pdf',
      icon: <Droplets className="h-6 w-6" />,
      description: t('addWatermark.description'),
    },
    {
      id: 'sign',
      name: t('signPdf.title'),
      href: '/sign-pdf',
      icon: <PenTool className="h-6 w-6" />,
      description: t('signPdf.description'),
    },
    {
      id: 'powerpoint-to-pdf',
      name: t('powerpointToPdf.title'),
      href: '/powerpoint-to-pdf',
      icon: <Presentation className="h-6 w-6" />,
      description: t('powerpointToPdf.description'),
    },
    {
      id: 'excel-to-pdf',
      name: t('excelToPdf.title'),
      href: '/excel-to-pdf',
      icon: <FileSpreadsheet className="h-6 w-6" />,
      description: t('excelToPdf.description'),
    },
    {
      id: 'pdf-to-text',
      name: t('pdfToText.title'),
      href: '/pdf-to-text',
      icon: <AlignLeft className="h-6 w-6" />,
      description: t('pdfToText.description'),
    },
    {
      id: 'extract-pages',
      name: t('extractPages.title'),
      href: '/extract-pages',
      icon: <FileOutput className="h-6 w-6" />,
      description: t('extractPages.description'),
    },
    {
      id: 'extract-images',
      name: t('extractImages.title'),
      href: '/extract-images',
      icon: <Images className="h-6 w-6" />,
      description: t('extractImages.description'),
    },
    {
      id: 'crop-pdf',
      name: t('cropPdf.title'),
      href: '/crop-pdf',
      icon: <Crop className="h-6 w-6" />,
      description: t('cropPdf.description'),
    },
    {
      id: 'flatten-pdf',
      name: t('flattenPdf.title'),
      href: '/flatten-pdf',
      icon: <Layers className="h-6 w-6" />,
      description: t('flattenPdf.description'),
    },
    {
      id: 'remove-metadata',
      name: t('removeMetadata.title'),
      href: '/remove-metadata',
      icon: <EyeOff className="h-6 w-6" />,
      description: t('removeMetadata.description'),
    },
    {
      id: 'ocr-pdf',
      name: t('ocrPdf.title'),
      href: '/ocr-pdf',
      icon: <ScanText className="h-6 w-6" />,
      description: t('ocrPdf.description'),
    },
    {
      id: 'edit-pdf',
      name: t('editPdf.title'),
      href: '/edit-pdf',
      icon: <FilePenLine className="h-6 w-6" />,
      description: t('editPdf.description'),
    },
  ];
  
  // Curate: use the per-tool relatedness map, never show the current tool, cap at 4 cards
  const relatedIds = relatedByTool[currentTool];
  const relatedTools = (relatedIds
    ? relatedIds
        .map((id) => allTools.find((tool) => tool.id === id))
        .filter((tool): tool is Tool => Boolean(tool))
    : allTools)
    .filter((tool) => tool.id !== currentTool)
    .slice(0, 4);

  if (relatedTools.length === 0) return null;

  return (
    <section className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="mb-12 text-center text-3xl font-bold text-dark">
          {tCommon('title')}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {relatedTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              className="group flex flex-col gap-4 rounded-2xl border-2 border-orange-100 bg-white p-6 transition-all duration-200 hover:border-primary hover:shadow-xl hover:-translate-y-1"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-primary">
                {tool.icon}
              </div>
              <div>
                <h3 className="mb-2 font-bold text-dark">{tool.name}</h3>
                <p className="text-sm text-gray-600">{tool.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

