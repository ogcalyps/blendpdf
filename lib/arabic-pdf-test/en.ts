import type { TestSetText } from './types';

export const text: TestSetText = {
  metaTitle: 'Can Your PDF Editor Handle Arabic? A Test You Can Rerun | BlendPDF',
  description:
    'Seven real Arabic PDFs, eleven editing tasks and a checker that reads the saved file. Test any PDF editor, and see where BlendPDF passes and where it fails.',
  title: 'Can your PDF editor handle Arabic?',
  intro:
    'Many PDF editors show Arabic correctly on screen and then save something else, such as words in reverse order or a line turned into a picture. Here are seven real Arabic PDFs, made with Chrome, LibreOffice and Word, and eleven small tasks. Do a task in any editor, save, and the checker tells you what the saved file really holds.',
  home: 'Home',
  download: {
    zip: (size) => `Download the test set (ZIP, ${size})`,
    contents: 'The test PDFs, the tasks, the checker and the files BlendPDF saved.',
  },
  summary: {
    title: 'How BlendPDF did',
    tested: 'Tested on 12 November 2026 with Edit PDF on blendpdf.com, in Chrome.',
    items: [
      'Adding Arabic: every check passed on all four files, except that lines with harakat look right but copy out in pieces.',
      'Changing a line: the new line passed on every file we could change, harakat aside. But on files made by Chrome, the other lines then read in pieces in pdftotext. That’s a bug in BlendPDF.',
      'The page with a shadow: BlendPDF won’t change its text, and says what to do instead.',
    ],
  },
  run: {
    title: 'Run the checker',
    steps: [
      'Install Node 18 or later, pdftotext and qpdf. On a Mac: `brew install poppler qpdf`. On Debian or Ubuntu: `sudo apt install poppler-utils qpdf`.',
      'Unzip the test set. Open one of its PDFs in the editor you want to check, do the task, and save.',
      'In the unzipped folder, run the checker with the task and your saved file:',
    ],
    command: 'node check.mjs 1a saved.pdf',
    after:
      'Each check prints PASS or FAIL and what it found. `node check.mjs --original 01-chrome-times-new-roman.pdf` shows how a test file reads before anyone edits it.',
  },
  checks: {
    title: 'What the checker looks at',
    intro: 'It reads the saved file with pdftotext, the reader behind many Linux viewers and search tools, once with ActualText and once without.',
    items: {
      search: { label: 'Search', text: 'The new words are text, so a search finds them. If they were saved as a picture, it says so.' },
      copy: { label: 'Copy', text: 'Copying gives the new text whole and in reading order.' },
      order: {
        label: 'Order',
        text: 'On the page the words run right to left, so the first word is the rightmost. Latin words and numbers keep their own order inside the line.',
      },
      letters: {
        label: 'Arabic letters',
        text: 'Without ActualText, the fonts’ letter maps still give Arabic letters. Some files map ي and ه to the Persian ی and ھ, and then readers that skip ActualText, such as the viewer in Firefox, can’t find those words.',
      },
      harakat: { label: 'Harakat', text: 'The vowel marks come out with the text, in order.' },
      removed: { label: 'Old words removed', text: 'When you change a line, the old words are out of the file, not hidden under a white box.' },
      kept: { label: 'Rest of the page', text: 'Every other line reads as it did before the edit.' },
    },
    notCovered: 'It doesn’t judge how the line looks, so look at the page too: the letters should be joined and the line should sit where it belongs.',
    lamAlef: 'pdftotext reads every lam-alef (لا) back to front, in the original files too, so the checker accepts both orders.',
  },
  files: {
    title: 'The files, the tasks and BlendPDF’s results',
    intro:
      'Each file is one page with made-up names. File 01 is the page our comparison pages tested. Chrome maps ي to the Persian ی in Arial too, so files 04 to 07 share the trap of file 01.',
    madeWith: 'Made with',
    font: 'Font',
    open: 'Download this PDF',
    hard: {
      '01': 'Chrome writes the right letters in ActualText, but Times New Roman’s letter map gives the Persian ی and ھ for ي and ه. Readers that skip ActualText can’t find words with those letters.',
      '02': 'A clean file: pdftotext reads every line right. Anything wrong after editing comes from the editor.',
      '03': 'Word for Mac saves through macOS, which places each letter on its own and maps ي and ه to Persian letters. Even before editing, most lines don’t read right, so an editor may not know what a line says.',
      '04': 'Lam followed by alef is drawn as one shape (لا، لأ، لإ، لآ). An editor has to make that shape as you type and keep both letters in the text.',
      '05': 'Fully vowelled text. Each mark has to sit on its letter and come out with the text.',
      '06': 'Latin words and numbers read left to right inside an Arabic line, which still runs right to left around them.',
      '07': 'The title has a blurred shadow, which Chrome saves as a soft mask. Rewriting a page like this can change how it looks.',
    },
    change: ['Change', 'to'],
    add: ['Add', 'anywhere on the page'],
    blendpdf: 'BlendPDF',
    saved: 'BlendPDF’s saved file',
    refused: 'Refused',
    status: { pass: 'passed', fail: 'failed' },
    notes: {
      '1a': 'The new line passed. But the save drops some of Chrome’s ActualText, so pdftotext then reads the other lines in pieces. macOS Preview still reads them right.',
      '3': 'The line’s box opened empty, because the file doesn’t say which letters it shows. You type the whole line, and the saved file then passes.',
      '4a': 'As in 1a: the new line passed, and the other lines then read in pieces in pdftotext.',
      '5a': 'The marks sit right on the page but are saved as separate pieces, so copying breaks the words up, in macOS Preview too. As in 1a, the other lines then read in pieces in pdftotext.',
      '5b': 'It looks right and search finds the words, but the marks are saved as separate pieces, so copying breaks the words up, in macOS Preview too.',
      '6a': 'As in 1a: the new line passed, and the other lines then read in pieces in pdftotext.',
      '7': 'BlendPDF won’t change text on this page, because rewriting it would change the shadow. It says to cover the old words with Hide (white box) and type the new ones with Text.',
    },
  },
  others: {
    title: 'Other editors on the same page',
    intro: 'On 12 November 2026 we tried free online editors on test file 01. Here is what they saved, from our comparison pages:',
    items: [
      { name: 'PDF Candy', path: '/blendpdf-vs-pdfcandy', task: '1b', text: 'Real text with joined letters, but the three words in reverse order.' },
      { name: 'Smallpdf', path: '/blendpdf-vs-smallpdf', task: '1b', text: 'The last word was missing and the letters weren’t joined.' },
      { name: 'PDF24', path: '/blendpdf-vs-pdf24', task: '1b', text: 'The line was saved as a picture, so search can’t find it.' },
      { name: 'PdfBayt', path: '/blendpdf-vs-pdfbayt', task: '1b', text: 'The line was saved as a picture, so search can’t find it.' },
      { name: 'Sejda', path: '/blendpdf-vs-sejda', task: '1a', text: 'It warned that it doesn’t fully support Arabic, and the changed line ran off the page.' },
      { name: 'PDF Candy', path: '/blendpdf-vs-pdfcandy', task: '1a', text: 'We couldn’t change the line.' },
    ],
    after: 'Run on the files those editors saved, the checker flags the same faults. iLovePDF and Adobe Acrobat online are on the comparison pages, from what their own pages say.',
    all: 'All comparisons',
  },
  why: {
    title: 'Why the checker reads each file twice',
    paragraphs: [
      'A PDF stores the shapes of the letters and, separately, which letters they are. Search and copy use the second part. Chrome writes it twice: as ActualText next to each letter, and in each font’s letter map. pdftotext uses ActualText. pdf.js, the viewer in Firefox, uses the letter maps.',
      'In Chrome’s files the two disagree: ActualText says ي, the letter map says the Persian ی. So the same file is searchable in one reader and not in another. The checker reads it with ActualText, then with ActualText switched off, and reports both.',
    ],
  },
  reuse: {
    title: 'Use it in a review',
    text: 'The test PDFs and cases.json are under Creative Commons Attribution 4.0 (CC BY 4.0): use them in reviews, articles and your own tests, with a credit and a link to this page. The checker is under the GNU AGPL-3.0, like BlendPDF’s source code.',
    citation: 'Source: BlendPDF, “Can your PDF editor handle Arabic?”, https://blendpdf.com/arabic-pdf-editor-test (CC BY 4.0)',
    copy: 'Copy the credit line',
    copied: 'Copied',
  },
  correction: { before: 'Something here out of date or wrong? Email ', after: ' and we’ll check it and correct the page within 7 days.' },
  faq: [
    {
      question: 'Which online PDF editor handles Arabic best?',
      answer:
        'Of the free online editors we tried on 12 November 2026, BlendPDF was the only one whose added Arabic line was real text with all three words in order. Editors change, so run the test on the ones you use.',
    },
    {
      question: 'Do I need to install anything to take the test?',
      answer:
        'Not to do the tasks: use the editor as you normally would. To run the checker you need Node 18 or later, pdftotext and qpdf, which are all free.',
    },
    {
      question: 'Why does pdftotext show لا as ال?',
      answer:
        'It reads the lam-alef shape back to front, with files from Chrome, Word and LibreOffice alike. The checker accepts both orders, so this isn’t counted against the editor.',
    },
    {
      question: 'Can I add my own files?',
      answer: 'Yes. Put the PDF next to check.mjs, add it with the true text of its lines and a task to cases.json, and the checker works the same way.',
    },
  ],
};
