export interface NavItem {
  title: string;
  description: string;
  href: string;
  badge?: 'PRO' | 'SOON' | 'NEW';
}

type TranslationFunction = (key: string) => string;

export const getOrganizeTools = (t: TranslationFunction): NavItem[] => [
  {
    title: t('nav.tools.mergePdf.title'),
    description: t('nav.tools.mergePdf.description'),
    href: '/merge-pdf',
  },
  {
    title: t('nav.tools.splitPdf.title'),
    description: t('nav.tools.splitPdf.description'),
    href: '/split-pdf',
  },
  {
    title: t('nav.tools.rotatePdf.title'),
    description: t('nav.tools.rotatePdf.description'),
    href: '/rotate-pdf',
  },
  {
    title: t('nav.tools.reorderPages.title'),
    description: t('nav.tools.reorderPages.description'),
    href: '/reorder-pdf',
  },
  {
    title: t('nav.tools.deletePages.title'),
    description: t('nav.tools.deletePages.description'),
    href: '/delete-pages',
  },
  {
    title: t('nav.tools.extractPages.title'),
    description: t('nav.tools.extractPages.description'),
    href: '/extract-pages',
  },
];

export const getConvertTools = (t: TranslationFunction): NavItem[] => [
  {
    title: t('nav.tools.pdfToWord.title'),
    description: t('nav.tools.pdfToWord.description'),
    href: '/pdf-to-word',
  },
  {
    title: t('nav.tools.pdfToExcel.title'),
    description: t('nav.tools.pdfToExcel.description'),
    href: '/pdf-to-excel',
  },
  {
    title: t('nav.tools.pdfToImages.title'),
    description: t('nav.tools.pdfToImages.description'),
    href: '/pdf-to-images',
  },
  {
    title: t('nav.tools.imagesToPdf.title'),
    description: t('nav.tools.imagesToPdf.description'),
    href: '/images-to-pdf',
  },
  {
    title: t('nav.tools.wordToPdf.title'),
    description: t('nav.tools.wordToPdf.description'),
    href: '/word-to-pdf',
  },
  {
    title: t('nav.tools.powerpointToPdf.title'),
    description: t('nav.tools.powerpointToPdf.description'),
    href: '/powerpoint-to-pdf',
  },
  {
    title: t('nav.tools.excelToPdf.title'),
    description: t('nav.tools.excelToPdf.description'),
    href: '/excel-to-pdf',
  },
  {
    title: t('nav.tools.pdfToText.title'),
    description: t('nav.tools.pdfToText.description'),
    href: '/pdf-to-text',
  },
  {
    title: t('nav.tools.pdfToPdfa.title'),
    description: t('nav.tools.pdfToPdfa.description'),
    href: '/pdf-to-pdfa',
    badge: 'NEW',
  },
  {
    title: t('nav.tools.extractImages.title'),
    description: t('nav.tools.extractImages.description'),
    href: '/extract-images',
  },
];

export const getOptimizeTools = (t: TranslationFunction): NavItem[] => [
  {
    title: t('nav.tools.compressPdf.title'),
    description: t('nav.tools.compressPdf.description'),
    href: '/compress-pdf',
  },
  {
    title: t('nav.tools.ocrPdf.title'),
    description: t('nav.tools.ocrPdf.description'),
    href: '/ocr-pdf',
    badge: 'NEW',
  },
  {
    title: t('nav.tools.repairPdf.title'),
    description: t('nav.tools.repairPdf.description'),
    href: '/repair-pdf',
  },
];

export const getSecurityTools = (t: TranslationFunction): NavItem[] => [
  {
    title: t('nav.tools.protectPdf.title'),
    description: t('nav.tools.protectPdf.description'),
    href: '/protect-pdf',
  },
  {
    title: t('nav.tools.unlockPdf.title'),
    description: t('nav.tools.unlockPdf.description'),
    href: '/unlock-pdf',
  },
  {
    title: t('nav.tools.removeMetadata.title'),
    description: t('nav.tools.removeMetadata.description'),
    href: '/remove-metadata',
  },
];

export const getEditTools = (t: TranslationFunction): NavItem[] => [
  {
    title: t('nav.tools.editPdf.title'),
    description: t('nav.tools.editPdf.description'),
    href: '/edit-pdf',
    badge: 'NEW',
  },
  {
    title: t('nav.tools.cropPdf.title'),
    description: t('nav.tools.cropPdf.description'),
    href: '/crop-pdf',
  },
  {
    title: t('nav.tools.flattenPdf.title'),
    description: t('nav.tools.flattenPdf.description'),
    href: '/flatten-pdf',
  },
  {
    title: t('nav.tools.addPageNumbers.title'),
    description: t('nav.tools.addPageNumbers.description'),
    href: '/add-page-numbers',
  },
  {
    title: t('nav.tools.addWatermark.title'),
    description: t('nav.tools.addWatermark.description'),
    href: '/watermark-pdf',
  },
  {
    title: t('nav.tools.signPdf.title'),
    description: t('nav.tools.signPdf.description'),
    href: '/sign-pdf',
  },
];
