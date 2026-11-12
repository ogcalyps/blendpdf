/**
 * "Can your PDF editor handle Arabic?" (/arabic-pdf-editor-test): the tasks
 * match their files, the page explains every result that isn't a clean pass,
 * the zip holds exactly the repo's files, the checker's bidi and letter rules
 * hold, and (where pdftotext and qpdf are installed) the published results
 * are what the checker says about BlendPDF's saved files today.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import JSZip from 'jszip';
import cases from '../scripts/arabic-pdf-test/cases.json';
import { FILES, RESULTS, TASKS, TEST_SET_PATH, ZIP, fileNumber, testSetText } from '../lib/arabic-pdf-test';
import results from '../lib/arabic-pdf-test/results.json';
import zipInfo from '../lib/arabic-pdf-test/zip.json';
import sitemap from '../app/sitemap';
import * as checker from '../scripts/arabic-pdf-test/check.mjs';

const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public', TEST_SET_PATH);
const SCRIPTS = join(ROOT, 'scripts/arabic-pdf-test');
const CHECK_IDS = ['search', 'copy', 'order', 'letters', 'harakat', 'removed', 'kept'];

const installed = (command: string) => {
  try {
    execFileSync(command, ['-v'], { stdio: 'ignore' });
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ENOENT';
  }
};
const tools = installed('pdftotext') && installed('qpdf');

describe('test files and tasks', () => {
  it('every file is served, numbered in order, and has a task', () => {
    FILES.forEach((f, i) => {
      expect(fileNumber(f.file)).toBe(String(i + 1).padStart(2, '0'));
      expect(existsSync(join(PUBLIC, f.file)), f.file).toBe(true);
      expect(TASKS.some((t) => t.file === f.file), f.file).toBe(true);
    });
  });

  it('task ids are unique, and each change is found once, on one line', () => {
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length);
    for (const task of TASKS) {
      if (task.do !== 'change') continue;
      const doc = FILES.find((f) => f.file === task.file)!;
      const hits = doc.lines.flatMap((line) => line.split(task.from).length - 1);
      expect(hits.reduce((a, b) => a + b), task.id).toBe(1);
    }
  });

  it('file 01 is the comparison pages’ test page, byte for byte', () => {
    expect(readFileSync(join(PUBLIC, '01-chrome-times-new-roman.pdf')).equals(readFileSync(join(ROOT, 'public/compare/arabic-test-page.pdf')))).toBe(true);
  });
});

describe('BlendPDF’s results on the page', () => {
  const text = testSetText('en');

  it('has one result per task, with a saved file or a refusal', () => {
    expect(RESULTS.map((r) => r.task)).toEqual(TASKS.map((t) => t.id));
    for (const r of RESULTS) {
      expect(Boolean(r.file) !== Boolean(r.refused), r.task).toBe(true);
      if (r.file) expect(existsSync(join(PUBLIC, r.file)), r.file).toBe(true);
      for (const c of r.checks ?? []) {
        expect(CHECK_IDS).toContain(c.id);
        expect(['pass', 'fail', 'n/a']).toContain(c.status);
      }
    }
  });

  it('explains every task that isn’t a clean pass, and only those', () => {
    const needsNote = RESULTS.filter((r) => r.refused || r.emptyBox || r.checks?.some((c) => c.status === 'fail')).map((r) => r.task);
    expect(Object.keys(text.files.notes).sort()).toEqual(needsNote.sort());
  });

  it('says what makes each file hard and names every check', () => {
    expect(Object.keys(text.files.hard).sort()).toEqual(FILES.map((f) => fileNumber(f.file)));
    expect(Object.keys(text.checks.items).sort()).toEqual([...CHECK_IDS].sort());
  });

  it('compares only with editors whose comparison page states that result', () => {
    for (const item of text.others.items) {
      expect(['1a', '1b']).toContain(item.task);
      expect(existsSync(join(ROOT, 'app/[locale]', item.path)), item.path).toBe(true);
    }
  });

  it('is in house style: no dashes for punctuation', () => {
    const strings = JSON.stringify(text);
    expect(strings).not.toMatch(/[–—]/);
  });
});

describe('the zip', () => {
  it('holds exactly the repo’s files, and the page states its real size', async () => {
    const bytes = readFileSync(join(ROOT, 'public', ZIP.href));
    expect(bytes.length).toBe(zipInfo.bytes);
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files).map((n) => n.replace(`${zipInfo.folder}/`, ''));
    const saved = RESULTS.filter((r) => r.file).map((r) => r.file!);
    expect(names.sort()).toEqual(['README.md', 'cases.json', 'check.mjs', ...FILES.map((f) => f.file), ...saved, 'saved-by-blendpdf/results.json'].sort());
    const read = (name: string) => zip.file(`${zipInfo.folder}/${name}`)!.async('nodebuffer');
    expect((await read('check.mjs')).equals(readFileSync(join(SCRIPTS, 'check.mjs')))).toBe(true);
    expect((await read('cases.json')).equals(readFileSync(join(SCRIPTS, 'cases.json')))).toBe(true);
    expect(JSON.parse((await read('saved-by-blendpdf/results.json')).toString())).toEqual(results);
    for (const f of [...FILES.map((x) => x.file), ...saved]) expect((await read(f)).equals(readFileSync(join(PUBLIC, f))), f).toBe(true);
    // The README's page link is tagged on GitHub only
    const readme = readFileSync(join(SCRIPTS, 'README.md'), 'utf8');
    expect(readme).toContain('blendpdf.com/arabic-pdf-editor-test?utm_source=github&utm_medium=readme&utm_campaign=oss-launch&utm_content=testset');
    expect((await read('README.md')).toString()).not.toContain('utm_');
  });

  it('has a distinct name, so its downloads can be counted on their own', () => {
    expect(ZIP.href).toBe('/arabic-pdf-editor-test/blendpdf-arabic-pdf-test-v1.zip');
  });
});

describe('the checker’s rules', () => {
  it('orders an Arabic line right to left, keeping Latin and its numbers together', () => {
    // Positions left to right, as indexes into the logical order
    expect(checker.visualOrder(['السيد', 'يوسف', 'الإدريسي'])).toEqual([2, 1, 0]);
    expect(checker.visualOrder(['على', 'Shopify', 'لمدة', '12', 'شهرا'])).toEqual([4, 3, 2, 1, 0]);
    expect(checker.visualOrder(['رقم', 'INV', '2026', 'بتاريخ'])).toEqual([3, 1, 2, 0]);
    expect(checker.visualOrder(['من', '15', 'إلى', '20'])).toEqual([3, 2, 1, 0]);
  });

  it('accepts lam-alef read back to front, within a word only', () => {
    expect(checker.contains(checker.squash('اليقبل'), 'لا يقبل')).toBe('lamAlef');
    expect(checker.contains(checker.squash('الأطلس'), 'الأطلس')).toBe('exact');
    expect(checker.contains(checker.squash('األطلس'), 'الأطلس')).toBe('lamAlef');
    // استكمال + الوثائق: no ligature across the space
    expect(checker.contains(checker.squash('استكمال الوثائق'), 'استكمال الوثائق')).toBe('exact');
    expect(checker.contains(checker.squash('يوسف'), 'محمد')).toBe(false);
  });

  it('tells Persian look-alikes from Arabic letters', () => {
    const persian = 'السید';
    expect(checker.contains(checker.squash(persian), 'السيد')).toBe(false);
    expect(checker.contains(checker.squash(checker.toArabic(persian)), 'السيد')).toBe('exact');
    expect(checker.persianIn('ھذه السید')).toEqual(['ھ', 'ی']);
  });

  it('ignores direction marks, tatweel and harakat when searching', () => {
    const marked = `${String.fromCodePoint(0x202b)}مَنْ جَدَّ${String.fromCodePoint(0x202c)}`;
    expect(checker.squash(marked)).toBe('منجد');
    expect(checker.squash('محـــمد')).toBe('محمد');
    expect(checker.words('«الأربعاء، ولا تأجيل بعده.»')).toEqual(['الأربعاء', 'ولا', 'تأجيل', 'بعده']);
  });

  it('keeps invisible characters out of its source (they are written as escapes)', () => {
    const source = readFileSync(join(SCRIPTS, 'check.mjs'), 'utf8');
    expect(source).not.toMatch(/[\u{200b}-\u{200f}\u{202a}-\u{202e}\u{2066}-\u{2069}\u{feff}]/u);
  });
});

describe.skipIf(!tools)('the checker on real files (needs pdftotext and qpdf)', () => {
  const cases1 = checker.loadCases();

  it('gives today the results the page publishes', () => {
    for (const r of RESULTS) {
      if (!r.file) continue;
      const task = cases1.tasks.find((t: { id: string }) => t.id === r.task);
      const now = checker.checkTask(cases1, task, join(PUBLIC, r.file));
      expect(now.checks, r.task).toEqual(r.checks);
    }
  }, 60000);

  it('fails a file nobody edited: the new words are missing and the old ones still there', () => {
    const task = cases1.tasks.find((t: { id: string }) => t.id === '1a');
    const result = checker.checkTask(cases1, task, join(PUBLIC, task.file));
    const status = Object.fromEntries(result.checks.map((c: { id: string; status: string }) => [c.id, c.status]));
    expect(status).toMatchObject({ search: 'fail', copy: 'fail', removed: 'fail', kept: 'pass' });
  });

  it('reads the test files as the page describes them', () => {
    const read = (file: string) => checker.checkOriginal(cases1, join(PUBLIC, file));
    // 02 is the clean control
    expect(read('02-libreoffice-arial.pdf').lines.every((l: { withActualText: string }) => l.withActualText === 'reads right')).toBe(true);
    // 01: Arabic with ActualText, Persian letters without it
    const chrome = read('01-chrome-times-new-roman.pdf');
    expect(chrome.persian).toEqual(expect.arrayContaining(['ی', 'ھ']));
    expect(chrome.lines.every((l: { lettersOnly: string }) => l.lettersOnly === 'Persian letters')).toBe(true);
    // 07: the shadow is a soft mask
    const qdf = execFileSync('qpdf', ['--qdf', '--object-streams=disable', join(PUBLIC, '07-text-shadow.pdf'), '-']).toString('latin1');
    expect(qdf).toContain('/SMask');
  });
});

describe('sitemap', () => {
  it('lists the English page only (the others are noindexed copies)', async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    expect(urls.has(`https://blendpdf.com${TEST_SET_PATH}`)).toBe(true);
    for (const l of ['fr', 'ar', 'es']) expect(urls.has(`https://blendpdf.com/${l}${TEST_SET_PATH}`)).toBe(false);
  });

  it('serves the zip next to the page', () => {
    expect(statSync(join(PUBLIC, zipInfo.file)).size).toBe(zipInfo.bytes);
  });
});
