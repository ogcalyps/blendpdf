import type { PortalSlug, PortalText, SizeChrome, SizeLimit, SizePageText, SizeTargetSlug } from './types';
import { sizeLabel } from './targets';

const label = (t: SizeLimit) => sizeLabel(t.limitMb, 'en');

export const chrome: SizeChrome = {
  label,
  summary: (t) =>
    `Open your PDF below: **Under a size limit** is already set to ${t.limitMb} MB${t.limitMb < 1 ? ` (${label(t)})` : ''}. Press **Compress PDF**. BlendPDF tries the sharpest setting first and only goes lower until the file fits, then shows you the new size before you download it.`,
  fitsTitle: 'How much fits',
  fits: (t) =>
    `About ${t.pagesGood === 1 ? 'one scanned page' : `${t.pagesGood} scanned pages`} at good quality, or up to ${t.pagesSmallest} at the smallest setting that still reads. That's a colour phone scan of an A4 page; black-and-white scans and typed documents take far less.`,
  tooBigTitle: 'Still too big?',
  tooBig: [
    {
      title: 'Remove pages you don’t need',
      text: 'Blank pages, instruction pages and second copies all count. Take them out before you compress.',
      link: { href: '/delete-pages', text: 'Delete pages' },
    },
    {
      title: 'Split it',
      text: 'Forms usually want one document per box. Split the file and upload each part where it belongs.',
      link: { href: '/split-pdf', text: 'Split PDF' },
    },
    {
      title: 'Crop photos of documents',
      text: 'A phone photo carries the table and the background too. Crop to the paper first.',
      link: { href: '/crop-pdf', text: 'Crop PDF' },
    },
    {
      title: 'Scan again, smaller',
      text: 'Scan in black and white or greyscale at 150 dpi. A colour scan at 300 dpi is several times bigger and no easier to read.',
    },
  ],
  faq: (t) => [
    {
      question: 'Will it still be readable?',
      answer:
        'Text stays text, so typed pages stay sharp at any size. Scans and photos lose detail as the size goes down, which is why BlendPDF stops at the sharpest setting that fits instead of going straight to the smallest.',
    },
    {
      question: `Is ${label(t)} counted as 1,000 or 1,024?`,
      answer: `Forms count both ways, so BlendPDF aims under the smaller one: ${(t.limitMb * 1_000_000).toLocaleString('en-US')} bytes. The file passes either way.`,
    },
    {
      question: 'Can I pick a different limit?',
      answer: 'Yes. Type any limit from 0.1 MB to 50 MB in the box after you open your PDF.',
    },
    {
      question: 'Is my file kept?',
      answer:
        'Compressing runs on our server. The file is deleted within an hour, most of the time right after it’s processed. There is no account, no watermark and nothing to pay.',
    },
  ],
  otherSizes: 'Other sizes',
  guide: 'Step-by-step guide with pictures',
  allLimits: 'The limits of other portals, with their sources',
  home: 'Home',
  compress: 'Compress PDF',
  rulesTitle: (name) => `What ${name} accepts`,
  source: (name, checked) =>
    `Source: ${name}, checked ${new Date(`${checked}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.`,
  otherSites: 'For a specific site',
};

const page = (n: string, whoAsks: string): SizePageText => ({
  title: `Compress a PDF to under ${n}`,
  metaTitle: `Compress PDF to ${n} Online, Free | BlendPDF`,
  description: `Get a PDF under ${n} for an upload form. Free, no sign-up: BlendPDF picks the sharpest quality that fits.`,
  whoAsks,
});

export const pages: Record<SizeTargetSlug, SizePageText> = {
  'to-100kb': page('100 KB', 'Some application forms only take tiny files, usually for a single scanned document like an ID card or a certificate.'),
  'to-200kb': page('200 KB', 'A common cap for one or two scanned pages on job, school and exam applications.'),
  'to-500kb': page('500 KB', 'Enough for a short document, like a payslip, a letter or a certificate with its translation.'),
  'to-1mb': page('1 MB', 'One of the most common limits on online forms, often per document.'),
  'to-2mb': page('2 MB', 'Some university programmes and visa forms cap each document at 2 MB.'),
};

export const portals: Partial<Record<PortalSlug, PortalText>> = {
  'for-ircc': {
    name: 'IRCC',
    short: 'IRCC',
    title: 'Compress a PDF for IRCC (under 4 MB)',
    metaTitle: 'Compress PDF for IRCC to 4 MB, Free | BlendPDF',
    description: 'The IRCC secure account and PR portal refuse files over 4 MB. Get your PDF under the limit for free, no sign-up.',
    whoAsks: 'The IRCC secure account and the Permanent Residence portal take 4 MB per file, and one file per upload box.',
    rules: [
      '4 MB per file on the IRCC secure account, the PR portal and citizenship applications; 5 MB on the IRCC Portal.',
      'One file per box: a second upload replaces the first, so merge the pages of one document first.',
      'Some forms go as low as 2 MB.',
      'IRCC suggests scanning at 150 dpi or less.',
    ],
    sourceName: 'IRCC Help Centre',
    link: { href: '/merge-pdf', text: 'Merge PDF' },
  },
};
