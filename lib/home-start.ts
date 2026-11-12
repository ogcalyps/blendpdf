/**
 * Where a file dropped on the home page opens: a PDF in the editor (every
 * tool), anything else in the converter that makes it a PDF, whose result then
 * offers "Keep working".
 */
import type { Accept } from 'react-dropzone';

const START_PAGES: readonly { page: string; mimes: readonly string[]; extensions: readonly string[] }[] = [
  { page: '/edit-pdf', mimes: ['application/pdf'], extensions: ['.pdf'] },
  {
    page: '/word-to-pdf',
    mimes: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.doc', '.docx'],
  },
  {
    page: '/powerpoint-to-pdf',
    mimes: ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    extensions: ['.ppt', '.pptx'],
  },
  {
    page: '/excel-to-pdf',
    mimes: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    extensions: ['.xls', '.xlsx'],
  },
  { page: '/images-to-pdf', mimes: ['image/jpeg', 'image/png', 'image/webp'], extensions: ['.jpg', '.jpeg', '.png', '.webp'] },
];

/** The file picker's accept list for every start page. */
export const START_ACCEPT: Accept = Object.fromEntries(
  START_PAGES.flatMap(({ mimes, extensions }) => mimes.map((mime) => [mime, [...extensions]]))
);

/** The page a file opens in, or null when no tool takes it. Goes by extension first: some systems send no MIME type. */
export function startPageFor(file: Pick<File, 'name' | 'type'>): string | null {
  const name = file.name.toLowerCase();
  const byExtension = START_PAGES.find(({ extensions }) => extensions.some((ext) => name.endsWith(ext)));
  if (byExtension) return byExtension.page;
  return START_PAGES.find(({ mimes }) => mimes.includes(file.type))?.page ?? null;
}
