/**
 * What each tool page's workspace opens with: the view, the tool or panel,
 * the preset save options and the one primary button (workspace-spec.md,
 * section 6). Pure data: the shell (components/workspace/ToolWorkspace) and
 * the editor (components/edit-pdf) both read it, so it must stay free of
 * runtime imports.
 *
 * `primary.labelKey` is a full message key (workspace.primary.<mode>);
 * `workspace.primary.delete` takes `{count}`.
 */
import type { ModeConfig, WorkspaceMode } from './types';

export const MODES: Readonly<Record<WorkspaceMode, ModeConfig>> = {
  edit: {
    slug: 'edit-pdf',
    view: 'page',
    preset: {},
    primary: { labelKey: 'workspace.primary.edit', action: 'save', needs: 'change' },
    suffix: 'edited',
  },
  sign: {
    slug: 'sign-pdf',
    view: 'page',
    panel: 'signature',
    preset: {},
    primary: { labelKey: 'workspace.primary.sign', action: 'save', needs: 'objects' },
    suffix: 'signed',
  },
  crop: {
    slug: 'crop-pdf',
    view: 'page',
    tool: 'crop',
    preset: {},
    primary: { labelKey: 'workspace.primary.crop', action: 'save', needs: 'crop' },
    suffix: 'cropped',
  },
  rotate: {
    slug: 'rotate-pdf',
    view: 'grid',
    preset: {},
    primary: { labelKey: 'workspace.primary.rotate', action: 'save', needs: 'turn' },
    suffix: 'rotated',
  },
  delete: {
    slug: 'delete-pages',
    view: 'grid',
    preset: {},
    primary: { labelKey: 'workspace.primary.delete', action: 'deleteSelectedThenSave', needs: 'selection' },
    suffix: 'deleted',
  },
  reorder: {
    slug: 'reorder-pdf',
    view: 'grid',
    preset: {},
    primary: { labelKey: 'workspace.primary.reorder', action: 'save', needs: 'order' },
    suffix: 'reordered',
  },
  extract: {
    slug: 'extract-pages',
    view: 'grid',
    preset: { pages: 'selected' },
    primary: { labelKey: 'workspace.primary.extract', action: 'save', needs: 'selection' },
    suffix: 'extracted',
  },
  split: {
    slug: 'split-pdf',
    view: 'grid',
    // One PDF per page: the page's promise ("divide into multiple files") is one click after the drop.
    // The task card offers every N pages, a PDF per group of selected pages, or the selected pages in one PDF.
    preset: { pages: 'all', split: { kind: 'every', n: 1 } },
    primary: { labelKey: 'workspace.primary.split', action: 'save', needs: null },
    suffix: 'split',
  },
  merge: {
    slug: 'merge-pdf',
    view: 'grid',
    preset: {},
    primary: { labelKey: 'workspace.primary.merge', action: 'save', needs: 'secondFile' },
    multiple: true,
    suffix: 'merged',
  },
  watermark: {
    slug: 'watermark-pdf',
    view: 'page',
    panel: 'watermark',
    preset: {},
    primary: { labelKey: 'workspace.primary.watermark', action: 'save', needs: 'watermark' },
    suffix: 'watermarked',
  },
  numbers: {
    slug: 'add-page-numbers',
    view: 'page',
    panel: 'numbers',
    preset: {},
    primary: { labelKey: 'workspace.primary.numbers', action: 'save', needs: 'pageNumbers' },
    suffix: 'numbered',
  },
  compress: {
    slug: 'compress-pdf',
    view: 'page',
    preset: { compress: 'medium' },
    primary: { labelKey: 'workspace.primary.compress', action: 'save', needs: null },
    suffix: 'compressed',
  },
  protect: {
    slug: 'protect-pdf',
    view: 'page',
    // '' = the password option is on and still empty (planProblems: passwordEmpty). The task card has the field:
    // the primary saves directly once it is filled.
    preset: { password: '' },
    primary: { labelKey: 'workspace.primary.protect', action: 'save', needs: null },
    suffix: 'protected',
  },
  unlock: {
    slug: 'unlock-pdf',
    view: 'page',
    preset: {},
    primary: { labelKey: 'workspace.primary.unlock', action: 'save', needs: null },
    suffix: 'unlocked',
  },
  repair: {
    slug: 'repair-pdf',
    view: 'page',
    preset: {},
    primary: { labelKey: 'workspace.primary.repair', action: 'repair', needs: null },
    suffix: 'repaired',
  },
  ocr: {
    slug: 'ocr-pdf',
    view: 'page',
    panel: 'ocr',
    preset: {},
    primary: { labelKey: 'workspace.primary.ocr', action: 'ocr', needs: null },
    suffix: 'ocr',
  },
  flatten: {
    slug: 'flatten-pdf',
    view: 'page',
    preset: { flatten: true },
    primary: { labelKey: 'workspace.primary.flatten', action: 'save', needs: null },
    suffix: 'flattened',
  },
  metadata: {
    slug: 'remove-metadata',
    view: 'page',
    preset: { removeMetadata: true },
    primary: { labelKey: 'workspace.primary.metadata', action: 'save', needs: null },
    suffix: 'clean',
  },
  word: {
    slug: 'pdf-to-word',
    view: 'page',
    preset: { format: 'word' },
    primary: { labelKey: 'workspace.primary.word', action: 'save', needs: null },
    suffix: '',
  },
  excel: {
    slug: 'pdf-to-excel',
    view: 'page',
    preset: { format: 'excel' },
    primary: { labelKey: 'workspace.primary.excel', action: 'save', needs: null },
    suffix: '',
  },
  images: {
    slug: 'pdf-to-images',
    view: 'page',
    preset: { format: 'images', imageType: 'jpg' },
    primary: { labelKey: 'workspace.primary.images', action: 'save', needs: null },
    suffix: 'images',
  },
  text: {
    slug: 'pdf-to-text',
    view: 'page',
    preset: { format: 'text' },
    primary: { labelKey: 'workspace.primary.text', action: 'save', needs: null },
    suffix: '',
  },
  imagesInside: {
    slug: 'extract-images',
    view: 'page',
    preset: { format: 'imagesInside' },
    primary: { labelKey: 'workspace.primary.imagesInside', action: 'save', needs: null },
    suffix: 'images',
  },
  pdfa: {
    slug: 'pdf-to-pdfa',
    view: 'page',
    preset: { format: 'pdfa' },
    primary: { labelKey: 'workspace.primary.pdfa', action: 'save', needs: null },
    suffix: 'pdfa',
  },
  converted: {
    // word-to-pdf, powerpoint-to-pdf, excel-to-pdf, images-to-pdf: the page
    // made the PDF itself and hands it over with initialFile.
    slug: '',
    view: 'page',
    preset: {},
    primary: { labelKey: 'workspace.primary.converted', action: 'save', needs: 'change' },
    suffix: '',
  },
};
