#!/usr/bin/env node
/**
 * Rebuilds what the page and the download serve from the test files and
 * BlendPDF's saved files (public/arabic-pdf-editor-test/):
 * - lib/arabic-pdf-test/results.json: the checker's output on each saved file;
 * - the zip people download, with the same bytes every time;
 * - lib/arabic-pdf-test/zip.json: the zip's name and size, for the page.
 *
 *   node scripts/arabic-pdf-test/build.mjs
 *
 * Needs pdftotext and qpdf, like the checker.
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import { checkTask, findOriginal, loadCases, readPdf } from './check.mjs';

const ROOT = join(import.meta.dirname, '../..');
const HERE = import.meta.dirname;
const PUBLIC = join(ROOT, 'public/arabic-pdf-editor-test');
const ZIP = 'blendpdf-arabic-pdf-test-v1.zip';
const FOLDER = 'blendpdf-arabic-pdf-test-v1';

/** The run on blendpdf.com, with what the saved files can't show. */
const RUN = {
  tested: '2026-11-12',
  how: 'Edit PDF on blendpdf.com (main at 665f0eb), in Chrome',
  tasks: {
    // The line's box opened empty: the file's letter map doesn't say which letters are there
    3: { emptyBox: true },
    7: {
      refused: 'Changing text on this page would also change how other parts of it look, such as shadows or see-through effects. Use Hide (white box) and Text instead.',
    },
  },
};

const cases = loadCases();
const originals = new Map(cases.files.map((f) => [f.file, readPdf(findOriginal(f.file))]));
const results = {
  tested: RUN.tested,
  how: RUN.how,
  tasks: cases.tasks.map((task) => {
    const saved = join(PUBLIC, 'saved-by-blendpdf', `${task.id}.pdf`);
    const extra = RUN.tasks[task.id] ?? {};
    if (!existsSync(saved)) return { task: task.id, ...extra };
    const { checks, notes } = checkTask(cases, task, saved, originals.get(task.file));
    return { task: task.id, file: `saved-by-blendpdf/${task.id}.pdf`, ...extra, checks, notes };
  }),
};
const resultsJson = `${JSON.stringify(results, null, 2)}\n`;
writeFileSync(join(ROOT, 'lib/arabic-pdf-test/results.json'), resultsJson);

// Fixed dates and order, so the same files always make the same zip
const zip = new JSZip();
const date = new Date('2026-11-12T12:00:00Z');
const add = (path, data) => zip.file(`${FOLDER}/${path}`, data, { date, createFolders: false });
// The page link in the zip's README isn't counted as a GitHub visit
add('README.md', readFileSync(join(HERE, 'README.md'), 'utf8').replace(/\?utm_source=[^\s)]+/, ''));
add('cases.json', readFileSync(join(HERE, 'cases.json')));
add('check.mjs', readFileSync(join(HERE, 'check.mjs')));
for (const f of cases.files) add(f.file, readFileSync(join(PUBLIC, f.file)));
for (const r of results.tasks) if (r.file) add(r.file, readFileSync(join(PUBLIC, r.file)));
add('saved-by-blendpdf/results.json', resultsJson);
const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 }, platform: 'UNIX' });
writeFileSync(join(PUBLIC, ZIP), bytes);
writeFileSync(join(ROOT, 'lib/arabic-pdf-test/zip.json'), `${JSON.stringify({ file: ZIP, folder: FOLDER, bytes: statSync(join(PUBLIC, ZIP)).size }, null, 2)}\n`);

const failed = results.tasks.filter((r) => r.checks?.some((c) => c.status === 'fail')).map((r) => r.task);
console.log(`${ZIP}: ${bytes.length} bytes. Tasks with a failed check: ${failed.join(', ') || 'none'}.`);
