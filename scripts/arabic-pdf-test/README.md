# Can your PDF editor handle Arabic?

Seven real PDFs, eleven editing tasks, and a checker that reads the file your
editor saved. Use it on any PDF editor, online or not. The results for
BlendPDF and the editors we compared are on
https://blendpdf.com/arabic-pdf-editor-test?utm_source=github&utm_medium=readme&utm_campaign=oss-launch&utm_content=testset

## Run it

1. Install pdftotext and qpdf, and Node 18 or later.
   - macOS: `brew install poppler qpdf`
   - Debian or Ubuntu: `sudo apt install poppler-utils qpdf`
2. Open a test PDF in the editor you want to check, do one task, and save.
3. Check the saved file:

   ```
   node check.mjs 1a saved.pdf
   ```

   `node check.mjs` with no task lists the tasks. `--json` prints the result
   as JSON. `node check.mjs --original 01-chrome-times-new-roman.pdf` shows
   how pdftotext reads a test file before any editing, so you know what is
   the reader's doing and what is the editor's.

The exit code is 0 when every check passes and 1 when one fails.

## The tasks

| Task | File | Do this |
|---|---|---|
| 1a | 01-chrome-times-new-roman.pdf | Change «محمد العلوي» to «يوسف الإدريسي» |
| 1b | 01-chrome-times-new-roman.pdf | Add «السيد يوسف الإدريسي» anywhere on the page |
| 2 | 02-libreoffice-arial.pdf | Change «السيدة سعاد بنعلي» to «السيد كريم التازي» |
| 3 | 03-word-tahoma.pdf | Change «التاسعة» to «الثامنة» |
| 4a | 04-lam-alef.pdf | Change «يوم الاثنين.» to «الأربعاء، ولا تأجيل بعده.» |
| 4b | 04-lam-alef.pdf | Add «لا تأجيل بعد الآن» |
| 5a | 05-harakat.pdf | Change «زَرَعَ حَصَدَ» to «صَبَرَ ظَفِرَ» |
| 5b | 05-harakat.pdf | Add «الصَّبْرُ مِفْتَاحُ الفَرَجِ» |
| 6a | 06-arabic-latin-numbers.pdf | Change «تصميم موقع إلكتروني على WordPress» to «متجر إلكتروني على Shopify لمدة 12 شهرا» |
| 6b | 06-arabic-latin-numbers.pdf | Add «تم الدفع عبر PayPal يوم 14 نوفمبر» |
| 7 | 07-text-shadow.pdf | Change «لجميع الزوار» to «للتلاميذ وأوليائهم» |

`cases.json` has the same tasks, the program that made each file, and the
true text of every line.

## What it checks

- **Search**: the new words are text, so a search finds them.
- **Copy**: copying gives the new text whole, in reading order.
- **Order**: on the page the words run right to left, the first word
  rightmost (from `pdftotext -bbox`). Latin words and numbers keep their own
  left-to-right order inside the line.
- **Letters**: with ActualText switched off, the fonts' letter maps still give
  Arabic letters. Chrome, for one, maps ي and ه to the Persian ی and ھ, so
  readers that ignore ActualText (pdf.js, the viewer in Firefox) can't find
  those words.
- **Harakat**: the vowel marks come out with the text, in order.
- **Removed** (when changing a line): the old words are out of the file, not
  hidden under a white box.
- **Kept**: every other line reads as it did in the original.

It doesn't judge how the line looks. Look at the page too: the letters should
be joined, and the line should sit where it belongs, in a font that fits.

pdftotext reads every lam-alef ligature back to front (األطلس for الأطلس),
in the original files too. The checks accept that order and say so.

## Files

- `01` to `07`: the test PDFs.
- `cases.json`: the tasks and the expected text.
- `check.mjs`: the checker. No dependencies besides pdftotext and qpdf.
- `saved-by-blendpdf/`: what BlendPDF saved for each task on 12 November 2026,
  and `results.json`, the checker's output on those files.
- `make-fixtures.mjs` (in the BlendPDF repository only): how files 02 to 07
  were made, with Chrome, LibreOffice and Microsoft Word on a Mac. File 01 is
  the test page of BlendPDF's comparison pages.

## Licence

`check.mjs` is under the GNU AGPL-3.0, like the rest of the BlendPDF
repository. The test PDFs and `cases.json` are under Creative Commons
Attribution 4.0 (CC BY 4.0): use them in reviews and articles, with a credit
to BlendPDF and a link to the page above. The names and details in the files
are made up.
