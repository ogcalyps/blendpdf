#!/usr/bin/env node
/**
 * Makes the test PDFs of "Can your PDF editor handle Arabic?" from the HTML
 * below, with the programs people really use: Chrome's Print to PDF,
 * LibreOffice Writer and Microsoft Word. macOS only (Word is driven with
 * AppleScript). The published files are in public/arabic-pdf-editor-test/;
 * run this only to make new ones, then update cases.json to match.
 *
 *   node scripts/arabic-pdf-test/make-fixtures.mjs <out dir> [file id …]
 *
 * 01 is not made here: it is the Chrome letter in Times New Roman that the
 * comparison pages tested (public/compare/arabic-test-page.pdf), copied as is.
 */
import { spawn, execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SOFFICE = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
const WORD_DOCS = join(homedir(), 'Library/Containers/com.microsoft.Word/Data/Documents');

const page = (font, body, extraCss = '') => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@page { size: A4; margin: 25mm; }
body { font-family: '${font}'; font-size: 14pt; line-height: 1.9; margin: 0; }
h1 { font-size: 22pt; margin: 0 0 18pt; text-align: center; }
p { margin: 0 0 10pt; }
${extraCss}
</style></head><body>
${body}
</body></html>
`;

const FIXTURES = {
  '02-libreoffice-arial': {
    via: 'libreoffice',
    font: 'Arial',
    html: page(
      'Arial',
      `<h1>جمعية النور للتنمية المحلية</h1>
<p>الرباط في 3 نوفمبر 2026</p>
<p>إلى السيدة سعاد بنعلي</p>
<p>يسعدنا أن ندعوكم إلى الجمع العام السنوي للجمعية يوم السبت 6 ديسمبر 2026.</p>
<p>يرجى تأكيد حضوركم قبل نهاية الشهر.</p>
<p>مع خالص التقدير.</p>`,
    ),
  },
  '03-word-tahoma': {
    via: 'word',
    html: page(
      'Tahoma',
      `<h1>مذكرة داخلية</h1>
<p>إلى: جميع الموظفين</p>
<p>الموضوع: مواعيد العمل في فصل الصيف</p>
<p>تبدأ مواعيد العمل من الساعة التاسعة صباحا إلى الساعة الثالثة بعد الظهر.</p>
<p>يبدأ العمل بهذه المواعيد يوم 1 يوليو.</p>
<p>قسم الموارد البشرية</p>`,
    ),
  },
  '04-lam-alef': {
    via: 'chrome',
    html: page(
      'Arial',
      `<h1>إعلان</h1>
<p>لا يقبل أي طلب إلا بعد استكمال الوثائق اللازمة.</p>
<p>آخر أجل لإيداع الملفات هو يوم الاثنين.</p>
<p>الآن يمكنكم تحميل الاستمارة من موقع الإدارة.</p>`,
    ),
  },
  '05-harakat': {
    via: 'chrome',
    html: page(
      'Arial',
      `<h1>ورقة عمل: القراءة بالشكل التام</h1>
<p>اقرأ المثلين الآتيين:</p>
<p>مَنْ جَدَّ وَجَدَ، وَمَنْ زَرَعَ حَصَدَ.</p>
<p>العِلْمُ نُورٌ وَالجَهْلُ ظَلَامٌ.</p>`,
      'p { font-size: 16pt; }',
    ),
  },
  '06-arabic-latin-numbers': {
    via: 'chrome',
    html: page(
      'Arial',
      `<h1>فاتورة رقم INV-2026-0147</h1>
<p>التاريخ: 12/11/2026</p>
<p>الخدمة: تصميم موقع إلكتروني على WordPress</p>
<p>المبلغ الإجمالي: 4,800.00 درهم</p>
<p>شكرا لثقتكم.</p>`,
    ),
  },
  '07-text-shadow': {
    via: 'chrome',
    html: page(
      'Arial',
      `<h1 class="shadow">معرض الكتاب المدرسي</h1>
<p>من 15 إلى 20 ديسمبر 2026 بقاعة المعارض</p>
<p>الدخول مجاني لجميع الزوار</p>`,
      'h1.shadow { font-size: 30pt; color: #1f4e79; text-shadow: 0 3px 8px rgba(0, 0, 0, 0.35); }',
    ),
  },
};

/** Chrome writes the PDF within seconds but doesn't always exit: wait for the file to stop growing, then kill it. */
async function viaChrome(htmlPath, pdfPath) {
  const profile = mkdtempSync(join(tmpdir(), 'chrome-'));
  const child = spawn(CHROME, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`, '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`], { stdio: 'ignore' });
  let last = -1;
  for (let i = 0; i < 120; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const size = existsSync(pdfPath) ? statSync(pdfPath).size : -1;
    if (size > 0 && size === last) break;
    last = size;
  }
  child.kill('SIGKILL');
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

const xml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/**
 * A flat Writer document (.fodt) with the same words: HTML import ignores
 * dir="rtl" and gives Arabic the default complex-script font, which isn't
 * what someone typing a letter in Writer gets.
 */
function fodt(font, html) {
  const title = html.match(/<h1[^>]*>(.*?)<\/h1>/)[1];
  const paragraphs = [...html.matchAll(/<p>(.*?)<\/p>/g)].map((m) => m[1]);
  const text = (size, weight = 'normal') =>
    `style:font-name="${font}" fo:font-size="${size}" fo:font-weight="${weight}" style:font-name-complex="${font}" style:font-size-complex="${size}" style:font-weight-complex="${weight}"`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.3" office:mimetype="application/vnd.oasis.opendocument.text">
<office:font-face-decls><style:font-face style:name="${font}" svg:font-family="${font}"/></office:font-face-decls>
<office:styles><style:default-style style:family="paragraph"><style:paragraph-properties style:writing-mode="rl-tb" fo:text-align="start"/><style:text-properties ${text('14pt')} style:language-complex="ar" style:country-complex="MA"/></style:default-style></office:styles>
<office:automatic-styles>
<style:style style:name="Title" style:family="paragraph"><style:paragraph-properties fo:text-align="center" fo:margin-bottom="0.6cm"/><style:text-properties ${text('22pt', 'bold')}/></style:style>
<style:style style:name="Body" style:family="paragraph"><style:paragraph-properties style:writing-mode="rl-tb" fo:text-align="right" fo:margin-bottom="0.35cm" fo:line-height="150%"/></style:style>
<style:page-layout style:name="A4"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2.5cm" fo:margin-bottom="2.5cm" fo:margin-left="2.5cm" fo:margin-right="2.5cm" style:writing-mode="rl-tb"/></style:page-layout>
</office:automatic-styles>
<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="A4"/></office:master-styles>
<office:body><office:text>
<text:p text:style-name="Title">${xml(title)}</text:p>
${paragraphs.map((p) => `<text:p text:style-name="Body">${xml(p)}</text:p>`).join('\n')}
</office:text></office:body>
</office:document>
`;
}

function viaLibreOffice(fodtPath, outDir) {
  execFileSync(SOFFICE, ['--headless', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', outDir, fodtPath], { stdio: 'ignore' });
}

/** Word opens the HTML and saves it as a PDF (it can only reach files in its sandbox). */
function viaWord(htmlPath, pdfPath, id) {
  mkdirSync(WORD_DOCS, { recursive: true });
  const inside = join(WORD_DOCS, `${id}.html`);
  const out = join(WORD_DOCS, `${id}.pdf`);
  copyFileSync(htmlPath, inside);
  execFileSync('osascript', [
    '-e', 'tell application "Microsoft Word"',
    '-e', `open (POSIX file "${inside}")`,
    '-e', `save as active document file name "${out}" file format format PDF`,
    '-e', 'close active document saving no',
    '-e', 'end tell',
  ]);
  copyFileSync(out, pdfPath);
  rmSync(inside);
  rmSync(out);
}

const [outArg, ...only] = process.argv.slice(2);
if (!outArg) {
  console.error('Usage: node scripts/arabic-pdf-test/make-fixtures.mjs <out dir> [file id …]');
  process.exit(2);
}
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });
for (const [id, fixture] of Object.entries(FIXTURES)) {
  if (only.length && !only.includes(id)) continue;
  const htmlPath = join(outDir, `${id}.html`);
  const pdfPath = join(outDir, `${id}.pdf`);
  writeFileSync(htmlPath, fixture.html);
  rmSync(pdfPath, { force: true });
  if (fixture.via === 'chrome') await viaChrome(htmlPath, pdfPath);
  if (fixture.via === 'libreoffice') {
    const fodtPath = join(outDir, `${id}.fodt`);
    writeFileSync(fodtPath, fodt(fixture.font, fixture.html));
    viaLibreOffice(fodtPath, outDir);
  }
  if (fixture.via === 'word') viaWord(htmlPath, pdfPath, id);
  console.log(existsSync(pdfPath) ? `${id}.pdf ${readFileSync(pdfPath).length} bytes (${fixture.via})` : `${id}.pdf MISSING`);
}
