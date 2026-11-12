import type { UploadLimitsChrome } from './types';

const day = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const chrome: UploadLimitsChrome = {
  title: 'PDF upload limits of common portals',
  metaTitle: 'PDF Upload Size Limits by Portal, With Sources | BlendPDF',
  description:
    'The largest PDF that government, visa and university portals accept, each with the portal’s own words and a link to check it. Free to reuse.',
  intro:
    'Upload forms refuse files over a set size, and the limit is often buried in a help page. Here are the limits of common portals, each with the sentence from the portal’s own site (or the government that runs it) and the date we last read it.',
  method:
    'A limit is listed only when the portal, its official help pages or the government that runs it states it publicly. Portals that show their limit only after you sign in, or whose limit we could only find on other sites, are left out. Here 1 MB is 1,000,000 bytes, which is also what “1 Mo” means. Aim a little under the limit: your computer and the portal don’t always count a megabyte the same way (1,000,000 or 1,048,576 bytes).',
  home: 'Home',
  jumpTo: 'Jump to',
  marks: ['“', '”'],
  columns: { portal: 'Portal', what: 'What you upload', limit: 'Largest file', source: 'Source' },
  per: { file: 'per file', total: 'in total' },
  categories: {
    government: 'Public services',
    immigration: 'Visas and immigration',
    education: 'Study and admissions',
    employment: 'Jobs',
    housing: 'Housing',
    tax: 'Tax',
    health: 'Health',
  },
  checked: (date) => `checked ${day(date)}`,
  compress: (label) => `Compress under ${label}`,
  compressHint: (label) => `In Compress PDF, choose “Under a size limit”, then enter ${label}.`,
  reuse: {
    title: 'Reuse this list',
    text: 'The table is free to reuse under the Creative Commons Attribution 4.0 licence (CC BY 4.0): put it on your help page or in an article, as long as you credit BlendPDF with a link to this page.',
    citation: 'Source: BlendPDF, “PDF upload limits of common portals”, https://blendpdf.com/pdf-upload-limits (CC BY 4.0)',
    copy: 'Copy the credit line',
    copied: 'Copied',
    csv: 'Download CSV',
    json: 'Download JSON',
  },
  report: { before: 'Has a portal changed its limit? Email ', after: ' and we’ll check the source and update the table within 7 days.' },
  faq: [
    {
      question: 'Why does the portal refuse my file when it’s under the limit?',
      answer:
        'Your computer and the portal don’t always count a megabyte the same way (1,000,000 or 1,048,576 bytes), so a file your computer shows as 1 MB can be over a “1 MB” limit. Aim about 5% under the limit. Check the format too: many portals accept only PDF, or one file per document.',
    },
    {
      question: 'Is there a difference between MB and Mo?',
      answer: 'No. Mo (mégaoctet) is the French for MB: 1 Mo = 1 MB = 1,000 KB.',
    },
    {
      question: 'How do I get my PDF under the limit?',
      answer:
        'Open Compress PDF, choose “Under a size limit” and enter the portal’s number. It compresses until the file fits, and tells you if it can’t.',
    },
    {
      question: 'Can I put this list on my own site?',
      answer:
        'Yes. It’s under CC BY 4.0: reuse it as you like, with a credit and a link to this page. The CSV and JSON files have the same rows, with their sources.',
    },
  ],
};
