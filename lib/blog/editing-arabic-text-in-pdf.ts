import type { BlogPost } from './types';

/**
 * Competitor results here are only the ones the live comparison pages make
 * (lib/comparisons/*.ts, tested 12 November 2026). Code facts were checked
 * against lib/pdf-text, lib/edit-pdf and tests/fixtures/edit-pdf on 12 November 2026.
 */
export const post: BlogPost = {
  slug: 'editing-arabic-text-in-pdf',
  lang: 'en',
  title: 'Editing Arabic text inside a PDF, in the browser',
  metaTitle: 'Editing Arabic text inside a PDF, in the browser | BlendPDF',
  description:
    'How BlendPDF changes Arabic lines in an existing PDF without uploading it: shaping, bidi, ToUnicode, the Persian letters Chrome writes into Arabic PDFs, look-alike fonts, and the pages it still refuses.',
  published: '2026-11-12',
  minutes: 9,
  cover: { src: '/compare/edit-blendpdf.webp', width: 1190, height: 170 },
  lead: [
    'BlendPDF’s editor lets you open a PDF, click a line of Arabic, type it again and save. The letters join, the line still starts at the right margin, it keeps the file’s own font when that font has the letters you typed, and the saved line can be searched and copied. It runs in the browser, so the file isn’t uploaded.',
    'Most online editors don’t do this yet. Sejda’s editor warns that right-to-left scripts “are not fully supported”, and iLovePDF says its Content Editor doesn’t support right-to-left languages. When we tested free editors on 12 November 2026, PDF24 and PdfBayt saved an added Arabic line as a picture, and PDF Candy saved real text with its words in reverse order. [The comparison pages](/compare) have the files.',
    'This post is about why it’s hard, what we did, and where it still fails. The code is [on GitHub](https://github.com/ogcalyps/blendpdf), open source under the AGPL-3.0.',
  ],
  body: [
    {
      type: 'video',
      src: '/blog/arabic-edit.mp4',
      poster: '/blog/arabic-edit.webp',
      width: 1280,
      height: 800,
      alt: 'The BlendPDF editor with an Arabic letter open: a new Arabic line is added, an existing line is changed, and the saved file is searched for words from both.',
      caption: 'Adding a line, changing a line, then searching the saved file.',
    },

    { type: 'h2', id: 'glyphs', text: 'A PDF has glyphs, not letters' },
    {
      type: 'p',
      text: 'Text in a PDF is a list of glyph codes drawn at positions in a font. Nothing in the page says which letters those glyphs are. To search or copy, a viewer looks each code up in the font’s **ToUnicode** map, a small table the producer writes next to the font.',
    },
    {
      type: 'p',
      text: 'For Latin text, glyph and letter are mostly one to one. For Arabic they aren’t. A letter has up to four shapes depending on whether it joins the letter before it, the one after, both or neither. Lam followed by alef is drawn as one glyph. Dots and vowel marks can be glyphs of their own. The ToUnicode map has to undo all of that, with one entry per glyph.',
    },
    {
      type: 'p',
      text: 'So editing Arabic in a PDF is two problems at once: drawing the right glyphs in the right places, and leaving a map behind that turns them back into the right letters. A page can look perfect and still be unsearchable.',
    },

    { type: 'h2', id: 'new-text', text: 'Writing new Arabic text' },
    {
      type: 'p',
      text: 'The **Text** tool writes new lines with three libraries. [bidi-js](https://github.com/lojjic/bidi-js) runs the Unicode bidi algorithm for each paragraph. Lines are broken on the logical text first, then each line is reordered for display, so a date inside an Arabic sentence still reads left to right. [fontkit](https://github.com/foliojs/fontkit) shapes each run with the font’s own GSUB and GPOS tables, which picks the joining forms and the lam-alef ligature and places the marks. Then every glyph goes into the page with its own text matrix through [pdf-lib](https://pdf-lib.js.org).',
    },
    {
      type: 'p',
      text: 'pdf-lib’s own `drawText` can’t be used for Arabic. It has no bidi, and it drops every GPOS offset. Placing glyphs one by one needs four of pdf-lib’s internals, so it is pinned to exactly 1.17.1, and a test fails if any of them moves. The font is Cairo, served from our own domain, and only the glyphs a document uses are embedded.',
    },
    { type: 'p', text: 'Two bugs from this part took a while to find.' },
    {
      type: 'p',
      text: '**The lam-alef that came back as alef-lam.** لا is one glyph for two characters. Viewers extract a line in display order, then flip right-to-left text back to logical order, and they flip the inside of a two-character ToUnicode entry along with it. Write the entry as لا and a search finds ال. So when one glyph stands for several right-to-left characters, we store them reversed, and the round trip comes out right. Chrome stores them in logical order, which is why pdftotext reads الأطلس in our Chrome-printed test page as األطلس.',
    },
    {
      type: 'p',
      text: '**Letters that lost their text on the second save.** fontkit caches one glyph object per glyph id for the life of a font. When pdf-lib’s subsetter embeds a composite glyph, it pulls in the glyph’s parts, and fontkit caches those parts with no code points. In Cairo many letters are such parts: ا ح د ر س ع ه و, most lowercase Latin, several digits. The first export was fine. A second export in the same session got those letters back from the cache with no code points, so they had no ToUnicode entry and dropped out of search. The fix was to lay text out with one fontkit instance and give the subsetter its own.',
    },

    { type: 'h2', id: 'existing-lines', text: 'Changing a line that’s already there' },
    {
      type: 'p',
      text: 'Adding text is the easy half. Changing an existing line means reading it, taking it out of the page without disturbing anything else, and drawing the new words so they match the rest of the line.',
    },
    {
      type: 'p',
      text: '**Reading it.** pdf.js gives you a page’s text with `getTextContent`, but it reverses right-to-left items character by character, which turns Chrome’s لا glyph into ال. So the edit box is filled glyph by glyph instead. We collect the glyphs in the order they are drawn and reverse whole glyphs, not characters, for right-to-left runs.',
    },
    {
      type: 'p',
      text: '**Taking it out.** The old line is removed with [PDFium](https://pdfium.googlesource.com/pdfium/) compiled to WebAssembly. It goes by whole text objects, picked by their baseline, not by a rectangle. Every page we’re about to rewrite is rendered first, then rendered again after the change and compared in 10 px tiles. If the colour of any tile outside the edited lines moves past a small threshold, the page is refused. After saving, the file is opened again, and if one old glyph is left on a replaced line, the save fails.',
    },
    {
      type: 'p',
      text: '**Drawing it back in its own font.** Most PDFs embed a subset of each font, only the glyphs the document used, so you can’t just shape new text with the file’s font: the glyphs you need may not be in it. Instead we read every line the document draws in that font and record which glyph it uses for each letter in each joining form, plus kerning pairs, where marks sit on each base letter, and ligatures. A changed word is shaped into those units. Words you didn’t touch are redrawn from their original glyphs at their original positions, and only the changed part of the line re-flows, from its right edge for Arabic.',
    },
    {
      type: 'p',
      text: 'Fonts make this messier than it sounds. Some draw two forms of a letter with one glyph: Arial’s beh uses the same glyph for its initial and medial forms, and a right-joining letter like reh can use its isolated glyph as the final one. A reverse cmap only names the first form, so the harvest accepts exactly those two pairings and nothing looser.',
    },

    { type: 'h2', id: 'persian-letters', text: 'The Persian letters in Chrome’s Arabic PDFs' },
    {
      type: 'p',
      text: 'We found this one on 12 November 2026, while testing our editor next to Sejda’s, and fixed it the same day.',
    },
    {
      type: 'p',
      text: 'Chrome writes a font’s reverse cmap into ToUnicode: for each glyph, a character the font maps to it. Times New Roman draws heh and heh doachashmee (a Persian and Urdu letter) with one glyph, and yeh and Farsi yeh with one glyph, and the reverse cmap lands on the Persian ones. Chrome also wraps each glyph in an `ActualText` span with the right Arabic letter. So the same glyph says two things:',
    },
    {
      type: 'code',
      code: [
        '% page content: the glyph, inside a span that says it is Arabic yeh',
        '/Span <</ActualText <FEFF064A>>> BDC',
        '<03F3> Tj',
        'EMC',
        '',
        '% the font’s ToUnicode map: the same glyph is Farsi yeh, initial form',
        '<03F3> <03F4> <FBFE>',
      ].join('\n'),
    },
    {
      type: 'table',
      head: ['Glyph on the page', 'ToUnicode says', 'After NFKC', 'An Arabic keyboard types'],
      rows: [
        ['yeh, initial form', 'U+FBFE Farsi yeh, initial', 'ی U+06CC', 'ي U+064A'],
        ['heh, medial form', 'U+FBAD heh doachashmee, medial', 'ھ U+06BE', 'ه U+0647'],
      ],
    },
    {
      type: 'p',
      text: 'Tools that read `ActualText`, like pdftotext, get Arabic letters. pdf.js reads the ToUnicode map, so once the presentation forms are folded, لديها comes out as لدیھا. On screen the two are the same word. To a search box they are different strings.',
    },
    {
      type: 'p',
      text: 'Our editor reads with pdf.js, so the edit box showed the Persian letters. If the line was then saved in a look-alike font, we wrote what was in the box, Persian code points and all, with no `ActualText` to correct them. The words of that line you hadn’t touched stopped matching an Arabic search, even in pdftotext, which had found them in the original.',
    },
    {
      type: 'p',
      text: 'The fix reads the letters back as Arabic when the line says it’s Arabic. If the line has letters only Arabic uses (ة ك ي ى) and none only Persian or Urdu use (پ چ ژ گ ے and the like), the look-alikes are mapped back form for form: a joined Farsi yeh becomes yeh, a dotless final one becomes alef maksura. Persian and Urdu documents are left alone. On the keep-the-font side, heh and heh doachashmee now match in every form but the isolated one, so a line kept in its own font still finds its glyphs.',
    },
    {
      type: 'p',
      text: 'One part is still open. A line kept in its own font keeps the file’s own ToUnicode map, which still says Persian, exactly like the lines around it. Fixing that means rewriting the font’s map for the whole page, and we haven’t done it yet.',
    },

    { type: 'h2', id: 'look-alikes', text: 'When the font can’t draw what you typed' },
    {
      type: 'p',
      text: 'Because fonts are subset, a changed word often needs a glyph the file doesn’t have: a name with a letter the document never used, or a digit. Then the line is redrawn in the closest font we ship, picked from the font’s name and its descriptor flags (serif, fixed pitch, bold, italic):',
    },
    {
      type: 'list',
      items: [
        'Liberation Sans, Serif and Mono for Arial, Times New Roman and Courier. They share the metrics, so the line keeps its length.',
        'Carlito for Calibri, and Caladea for Cambria.',
        'Noto Sans Arabic for Arabic, or Cairo when the file already used Cairo.',
      ],
    },
    {
      type: 'p',
      text: 'Arabic is the weak spot. Amiri would be the natural match for Times-style Arabic, but pdf-lib 1.17.1’s subsetter breaks it, and only one or two of its glyphs render. Noto Naskh Arabic draws the dots of most letters as separate glyphs and shares one dotless glyph between ب ت ث ن ي. With one ToUnicode entry per glyph, a line written that way can’t be mapped back to text, so it couldn’t be searched. That leaves a sans font for serif documents, and it shows. The editor tells you when it happens.',
    },
    {
      type: 'p',
      text: 'A changed word with vowel marks also goes to the look-alike, because we can’t place marks on a new letter combination reliably from what the file shows.',
    },
    {
      type: 'figure',
      src: '/compare/edit-original.webp',
      width: 1190,
      height: 170,
      alt: 'An Arabic work certificate printed from Chrome in Times New Roman: the title and the first line, right-aligned.',
      caption: 'Before: our Arabic test page, printed from Chrome in Times New Roman.',
    },
    {
      type: 'figure',
      src: '/compare/edit-blendpdf.webp',
      width: 1190,
      height: 170,
      alt: 'The same line after the name was changed in BlendPDF: right to left, inside the margins, letters joined, in a plainer sans-serif font.',
      caption: 'After changing the name: the letters join and the line still starts at the right margin, but it is now in Noto Sans Arabic, plainer than the original.',
    },

    { type: 'h2', id: 'limits', text: 'What still fails' },
    {
      type: 'list',
      items: [
        '**Pages with shadows or soft masks are refused.** PDFium 2.15.1 drops soft masks when it rewrites a page, so a CSS text shadow or a Word shape effect would disappear. The before-and-after render catches it, and the editor won’t change text on that page. The workaround is a white box over the old words and a new line with **Text**.',
        '**One line at a time.** Words don’t flow onto the next line, so rewriting a paragraph is still a job for a word processor.',
        '**The font can change**, as above, and for serif Arabic it’s visible.',
        '**Lines kept in their own font keep the file’s Persian letters** in their text layer, as above.',
        '**Lines drawn twice.** Some producers fake bold or a shadow by drawing every glyph twice. We can’t tell which copy is the text, so the edit box starts empty and you type the line yourself.',
      ],
    },

    { type: 'h2', id: 'try-it', text: 'Try it, or read the code' },
    {
      type: 'p',
      text: 'The editor is at [blendpdf.com/edit-pdf](/edit-pdf). Choose **Edit existing text** (still in beta), click a line and type. If you want a file to try, here is [the Arabic test page](/compare/arabic-test-page.pdf) we use for the comparisons.',
    },
    {
      type: 'p',
      text: 'The code is on GitHub at [ogcalyps/blendpdf](https://github.com/ogcalyps/blendpdf). New text is in `lib/pdf-text/`, keeping the font is in `lib/edit-pdf/keep-font/`, and the Persian fold is in `lib/edit-pdf/prefill.ts`. If you have a PDF the editor gets wrong, an issue with the file attached is the most useful thing you can send.',
    },
  ],
};
