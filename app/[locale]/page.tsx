'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { GitMerge, FileMinus, Image as ImageIcon, Scissors, RotateCw, ArrowUpDown, Trash2, FileImage, ChevronDown, Lock, Shield, Zap, FileText, File, Table, Wrench, Key, Unlock, Hash, Droplets, PenTool, LayoutGrid, FileType, Edit3, Presentation, FileSpreadsheet, AlignLeft, FileOutput, Images, Crop, Layers as LayersIcon, EyeOff, ScanText, FilePenLine, FileBadge } from 'lucide-react';
import { Navigation } from '@/components/Navigation';
import { ToolCard } from '@/components/ToolCard';
import { Button } from '@/components/ui/Button';
import { ItemListSchema } from '@/components/ItemListSchema';
import { TrustpilotWidget } from '@/components/TrustpilotWidget';
import { ProofSection } from '@/components/ProofSection';
import { Footer } from '@/components/Footer';
import { HomeDropZone } from '@/components/HomeDropZone';

type Category = 'all' | 'organize' | 'optimize' | 'convert' | 'edit' | 'security';

export default function Home() {
  const t = useTranslations();
  const locale = useLocale();
  const [activeCategory, setActiveCategory] = useState<Category>('all');

  const tools = [
    { id: 'merge', name: t('nav.tools.mergePdf.title'), url: '/merge-pdf', description: t('nav.tools.mergePdf.description'), icon: <GitMerge className="w-full h-full" />, category: 'organize' },
    { id: 'split', name: t('nav.tools.splitPdf.title'), url: '/split-pdf', description: t('nav.tools.splitPdf.description'), icon: <Scissors className="w-full h-full" />, category: 'organize' },
    { id: 'compress', name: t('nav.tools.compressPdf.title'), url: '/compress-pdf', description: t('nav.tools.compressPdf.description'), icon: <FileMinus className="w-full h-full" />, category: 'optimize', badge: t('home.save90'), badgeColor: 'orange' },
    { id: 'pdf-to-word', name: t('nav.tools.pdfToWord.title'), url: '/pdf-to-word', description: t('nav.tools.pdfToWord.description'), icon: <FileText className="w-full h-full" />, category: 'convert' },
    { id: 'pdf-to-excel', name: t('nav.tools.pdfToExcel.title'), url: '/pdf-to-excel', description: t('nav.tools.pdfToExcel.description'), icon: <Table className="w-full h-full" />, category: 'convert' },
    { id: 'word-to-pdf', name: t('nav.tools.wordToPdf.title'), url: '/word-to-pdf', description: t('nav.tools.wordToPdf.description'), icon: <File className="w-full h-full" />, category: 'convert' },
    { id: 'pdf-to-images', name: t('nav.tools.pdfToImages.title'), url: '/pdf-to-images', description: t('nav.tools.pdfToImages.description'), icon: <ImageIcon className="w-full h-full" />, category: 'convert' },
    { id: 'images-to-pdf', name: t('nav.tools.imagesToPdf.title'), url: '/images-to-pdf', description: t('nav.tools.imagesToPdf.description'), icon: <FileImage className="w-full h-full" />, category: 'convert' },
    { id: 'edit-pdf', name: t('nav.tools.editPdf.title'), url: '/edit-pdf', description: t('nav.tools.editPdf.description'), icon: <FilePenLine className="w-full h-full" />, category: 'edit', badge: t('home.new'), badgeColor: 'green' },
    { id: 'edit', name: t('nav.tools.addPageNumbers.title'), url: '/add-page-numbers', description: t('nav.tools.addPageNumbers.description'), icon: <Hash className="w-full h-full" />, category: 'edit' },
    { id: 'watermark', name: t('nav.tools.addWatermark.title'), url: '/watermark-pdf', description: t('nav.tools.addWatermark.description'), icon: <Droplets className="w-full h-full" />, category: 'edit' },
    { id: 'rotate', name: t('nav.tools.rotatePdf.title'), url: '/rotate-pdf', description: t('nav.tools.rotatePdf.description'), icon: <RotateCw className="w-full h-full" />, category: 'organize' },
    { id: 'reorder', name: t('nav.tools.reorderPages.title'), url: '/reorder-pdf', description: t('nav.tools.reorderPages.description'), icon: <ArrowUpDown className="w-full h-full" />, category: 'organize' },
    { id: 'delete', name: t('nav.tools.deletePages.title'), url: '/delete-pages', description: t('nav.tools.deletePages.description'), icon: <Trash2 className="w-full h-full" />, category: 'organize' },
    { id: 'ocr', name: t('nav.tools.ocrPdf.title'), url: '/ocr-pdf', description: t('nav.tools.ocrPdf.description'), icon: <ScanText className="w-full h-full" />, category: 'optimize', badge: t('home.new'), badgeColor: 'green' },
    { id: 'repair', name: t('nav.tools.repairPdf.title'), url: '/repair-pdf', description: t('nav.tools.repairPdf.description'), icon: <Wrench className="w-full h-full" />, category: 'optimize' },
    { id: 'protect', name: t('nav.tools.protectPdf.title'), url: '/protect-pdf', description: t('nav.tools.protectPdf.description'), icon: <Shield className="w-full h-full" />, category: 'security' },
    { id: 'unlock', name: t('nav.tools.unlockPdf.title'), url: '/unlock-pdf', description: t('nav.tools.unlockPdf.description'), icon: <Unlock className="w-full h-full" />, category: 'security' },
    { id: 'sign', name: t('nav.tools.signPdf.title'), url: '/sign-pdf', description: t('nav.tools.signPdf.description'), icon: <PenTool className="w-full h-full" />, category: 'security' },
    { id: 'powerpoint-to-pdf', name: t('nav.tools.powerpointToPdf.title'), url: '/powerpoint-to-pdf', description: t('nav.tools.powerpointToPdf.description'), icon: <Presentation className="w-full h-full" />, category: 'convert', badge: t('home.new'), badgeColor: 'green' },
    { id: 'excel-to-pdf', name: t('nav.tools.excelToPdf.title'), url: '/excel-to-pdf', description: t('nav.tools.excelToPdf.description'), icon: <FileSpreadsheet className="w-full h-full" />, category: 'convert', badge: t('home.new'), badgeColor: 'green' },
    { id: 'pdf-to-text', name: t('nav.tools.pdfToText.title'), url: '/pdf-to-text', description: t('nav.tools.pdfToText.description'), icon: <AlignLeft className="w-full h-full" />, category: 'convert' },
    { id: 'pdf-to-pdfa', name: t('nav.tools.pdfToPdfa.title'), url: '/pdf-to-pdfa', description: t('nav.tools.pdfToPdfa.description'), icon: <FileBadge className="w-full h-full" />, category: 'convert', badge: t('home.new'), badgeColor: 'green' },
    { id: 'extract-images', name: t('nav.tools.extractImages.title'), url: '/extract-images', description: t('nav.tools.extractImages.description'), icon: <Images className="w-full h-full" />, category: 'convert' },
    { id: 'extract-pages', name: t('nav.tools.extractPages.title'), url: '/extract-pages', description: t('nav.tools.extractPages.description'), icon: <FileOutput className="w-full h-full" />, category: 'organize' },
    { id: 'crop', name: t('nav.tools.cropPdf.title'), url: '/crop-pdf', description: t('nav.tools.cropPdf.description'), icon: <Crop className="w-full h-full" />, category: 'edit', badge: t('home.new'), badgeColor: 'green' },
    { id: 'flatten', name: t('nav.tools.flattenPdf.title'), url: '/flatten-pdf', description: t('nav.tools.flattenPdf.description'), icon: <LayersIcon className="w-full h-full" />, category: 'edit' },
    { id: 'remove-metadata', name: t('nav.tools.removeMetadata.title'), url: '/remove-metadata', description: t('nav.tools.removeMetadata.description'), icon: <EyeOff className="w-full h-full" />, category: 'security' },
  ];

  const categories: { id: Category; label: string; icon: any }[] = [
    { id: 'all', label: t('common.allTools'), icon: LayoutGrid },
    { id: 'organize', label: t('common.organize'), icon: Layers },
    { id: 'optimize', label: t('common.optimize'), icon: Zap },
    { id: 'convert', label: t('common.convert'), icon: FileType },
    { id: 'edit', label: t('common.edit'), icon: Edit3 },
    { id: 'security', label: t('common.security'), icon: Shield },
  ];

  const filteredTools = activeCategory === 'all'
    ? tools
    : tools.filter(tool => tool.category === activeCategory);

  // Cold arrivals land here from links and search with no idea the tools exist
  // below the hero, so the highest-intent few are repeated above the fold.
  // Pulled from `tools` by id so names, URLs and icons stay single-sourced.
  const quickPickIds = ['merge', 'split', 'compress', 'pdf-to-word'];
  const quickPicks = quickPickIds
    .map((id) => tools.find((tool) => tool.id === id))
    .filter((tool): tool is (typeof tools)[number] => tool !== undefined);

  // The jobs Arabic searchers come for, under the RTL proof. On /ar they also
  // give the home page Arabic anchor text into those tools.
  const arabicFiles = [
    { id: 'ocr', url: '/ocr-pdf', icon: <ScanText className="w-full h-full" /> },
    { id: 'edit', url: '/edit-pdf', icon: <FilePenLine className="w-full h-full" /> },
    { id: 'compress', url: '/compress-pdf', icon: <FileMinus className="w-full h-full" /> },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <ItemListSchema tools={tools.map(t => ({ name: t.name, url: t.url, description: t.description }))} />
      <Navigation />

      {/* Hero Section */}
      <section className="pt-10 pb-8 sm:pt-20 sm:pb-12 px-4 bg-gradient-to-b from-orange-50/50 to-white">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4 sm:mb-6 tracking-tight">
            {t('hero.title')}
          </h1>

          <p className="text-lg sm:text-xl text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>

          <HomeDropZone />

          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t('hero.mostUsed')}
          </p>
          <div className="mb-6 sm:mb-8 flex flex-wrap justify-center gap-2">
            {quickPicks.map((tool) => (
              <Link
                key={tool.id}
                href={tool.url}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all duration-200 hover:bg-gray-100 hover:text-gray-900"
              >
                <span className="h-4 w-4 shrink-0">{tool.icon}</span>
                {tool.name}
              </Link>
            ))}
          </div>

          <Button
            size="lg"
            onClick={() => document.getElementById('tools')?.scrollIntoView({ behavior: 'smooth' })}
          >
            {t('hero.cta')}
          </Button>
        </div>
      </section>

      {/* Tool Grid */}
      <section id="tools" className="pb-20 px-4">
        <div className="max-w-7xl mx-auto">

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-all duration-200
                    ${activeCategory === category.id
                      ? 'bg-gray-900 text-white shadow-lg scale-105'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {category.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTools.map((tool) => (
              <ToolCard
                key={tool.id}
                href={tool.url}
                icon={tool.icon}
                title={tool.name}
                description={tool.description}
                badge={tool.badge}
                badgeColor={tool.badgeColor as any}
                iconBgColor="bg-orange-100"
                iconColor="text-primary"
              />
            ))}
          </div>
        </div>
      </section>

      {/* RTL proof section */}
      <section className="bg-gray-50 py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              {t('technical.title')}
            </h2>
            <p className="text-lg text-gray-600">
              {t('technical.subtitle')}
            </p>
          </div>
          <ProofSection />

          <div className="mt-16">
            <h3 className="mb-8 text-center text-2xl font-bold text-gray-900">
              {t('home.arabicFiles.title')}
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
              {arabicFiles.map((card) => (
                <ToolCard
                  key={card.id}
                  href={card.url}
                  icon={card.icon}
                  title={t(`home.arabicFiles.${card.id}.title`)}
                  description={t(`home.arabicFiles.${card.id}.description`)}
                  iconBgColor="bg-orange-100"
                  iconColor="text-primary"
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Why BlendPDF */}
      <section className="bg-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            {t('why.title')}
          </h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-xl bg-gray-50 p-8 shadow-sm">
              <h3 className="mb-3 text-xl font-semibold text-gray-900">
                {t('why.noSignup.title')}
              </h3>
              <p className="text-gray-600">
                {t('why.noSignup.description')}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-8 shadow-sm">
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

      {/* Trustpilot reviews */}
      {process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID && (
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">
            <TrustpilotWidget variant="mini" locale={locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US'} />
          </div>
        </section>
      )}

      {/* Footer */}
      <Footer />

    </div>
  );
}

// Helper icons
function Layers(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  )
}
