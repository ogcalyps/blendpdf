'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function WordToPDFFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How to convert Word to PDF online',
      answer: 'Upload your Word document by clicking the select button or dragging it onto the upload area, click "Convert to PDF", and download the result. Conversion takes seconds for typical documents. No account or email is required, and there is no watermark.'
    },
    {
      question: 'Which file formats are supported?',
      answer: 'Microsoft Word .doc and .docx, OpenDocument .odt, and Rich Text Format .rtf. All of them convert to a standard PDF that opens anywhere. Files can be up to 50MB.'
    },
    {
      question: 'Is the Word to PDF converter really free?',
      answer: 'Yes. No watermark on the PDF, no page limits, no conversion quota that pushes you to a paid plan, and no sign-up. The technical limits are 50MB per file and about 10 conversions per 15 minutes.'
    },
    {
      question: 'Is it safe to upload my document?',
      answer: 'Files are uploaded over an encrypted connection, document contents are never read, stored, or shared, and files are deleted from our servers within one hour, most immediately after processing. No account is needed. We use Google Analytics for aggregate, anonymous usage measurement only.'
    },
    {
      question: 'Will my formatting and layout be preserved?',
      answer: 'For typical documents, yes: text, headings, images, tables, headers, footers, and page breaks convert accurately. The conversion uses LibreOffice, so documents relying on uncommon fonts or the newest Word-specific features may show small differences; see the fonts question for the main caveat.'
    },
    {
      question: 'Why does my PDF look slightly different from the Word file?',
      answer: 'Almost always fonts. If your document uses a font that is not available on the conversion server, a similar font is substituted, which can shift line breaks and page breaks. Using widely available fonts, or checking the PDF before sharing it, avoids surprises.'
    },
    {
      question: 'Are hyperlinks, tables of contents, and page numbers kept?',
      answer: 'Yes for the common cases: hyperlinks remain clickable, page numbers and headers and footers are rendered, and a generated table of contents converts as it appeared when the file was last saved. Dynamic fields are rendered at their last-updated values.'
    },
    {
      question: 'Does it work with Arabic Word documents?',
      answer: 'Yes. The LibreOffice engine has mature right-to-left support, so Arabic text direction, alignment, and letter joining convert correctly. The main caveat is fonts: if your Arabic font is not available on the server, a substitute is used, which can slightly change the look.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'One document at a time, up to 50MB, which covers all but the most image-heavy files. There is no page limit; very long documents simply take a little longer within the roughly two-minute processing window.'
    },
    {
      question: 'Can I convert a password-protected Word document?',
      answer: 'No. A password-protected Word file cannot be opened by the converter. Remove the password in Word first (File > Info > Protect Document), convert it here, and then, if you want protection back, use the BlendPDF protect tool to encrypt the PDF with AES-256.'
    },
    {
      question: 'How do I password-protect the PDF I create?',
      answer: 'Convert your document first, then run the result through the BlendPDF protect tool, which applies real AES-256 encryption with a password you choose. Together the two tools take under a minute.'
    },
    {
      question: 'Can I edit the PDF afterward, or convert it back to Word?',
      answer: 'PDFs are not meant for heavy editing, so keep your original Word file as the master copy. If you no longer have it, the BlendPDF PDF to Word tool converts the PDF back to an editable DOCX, faithfully for typical documents though not always identically.'
    },
    {
      question: 'Why use this instead of Word\'s built-in Save as PDF?',
      answer: 'If you have desktop Word, its built-in PDF export is excellent and you should feel free to use it. BlendPDF is for everyone else: no Word license, working on a phone or a locked-down computer, converting .odt or .rtf files, or needing a quick conversion without opening an editor.'
    },
    {
      question: 'What should I check before and after converting?',
      answer: 'Before: accept or reject tracked changes and delete stray comments, since the PDF renders the document as it would print. After: skim the PDF for font substitutions or shifted page breaks. If something fails, check the file opens in a word processor and is under 50MB.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Word to PDF', url: '/word-to-pdf' },
        { name: 'FAQ', url: '/word-to-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Link href="/word-to-pdf" className="mb-6 inline-block text-blue-600 hover:text-blue-800">
            &larr; Back to the Word to PDF converter
          </Link>
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Word to PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-convert" className="text-blue-600 hover:text-blue-800">How to convert Word to PDF online</a></li>
              <li><a href="#supported-formats" className="text-blue-600 hover:text-blue-800">Which file formats are supported?</a></li>
              <li><a href="#is-it-free" className="text-blue-600 hover:text-blue-800">Is the Word to PDF converter really free?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to upload my document?</a></li>
              <li><a href="#formatting" className="text-blue-600 hover:text-blue-800">Will my formatting and layout be preserved?</a></li>
              <li><a href="#fonts" className="text-blue-600 hover:text-blue-800">Why does my PDF look slightly different from the Word file?</a></li>
              <li><a href="#links-toc" className="text-blue-600 hover:text-blue-800">Are hyperlinks, tables of contents, and page numbers kept?</a></li>
              <li><a href="#arabic-rtl" className="text-blue-600 hover:text-blue-800">Does it work with Arabic Word documents?</a></li>
              <li><a href="#file-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I convert a password-protected Word document?</a></li>
              <li><a href="#protect-output" className="text-blue-600 hover:text-blue-800">How do I password-protect the PDF I create?</a></li>
              <li><a href="#edit-afterward" className="text-blue-600 hover:text-blue-800">Can I edit the PDF afterward, or convert it back to Word?</a></li>
              <li><a href="#vs-word-builtin" className="text-blue-600 hover:text-blue-800">Why use this instead of Word's built-in Save as PDF?</a></li>
              <li><a href="#checklist" className="text-blue-600 hover:text-blue-800">What should I check before and after converting?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-convert" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to convert Word to PDF online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Converting a document takes three steps and, for most files, well under a minute.
                </p>
                <p>
                  <strong>Upload your document</strong><br />
                  Click the select button or drag and drop your file onto the upload area; you can also pick a file from Google Drive. Supported formats are .doc, .docx, .odt, and .rtf, up to 50MB.
                </p>
                <p>
                  <strong>Convert</strong><br />
                  Click "Convert to PDF". The document is rendered server-side by LibreOffice, the same engine behind a widely used desktop office suite, which lays out each page exactly as it would for printing and writes the result as a PDF.
                </p>
                <p>
                  <strong>Download</strong><br />
                  Download the PDF directly; no account or email is needed. An optional email-delivery choice exists if you would rather have the file sent to an inbox, but you can always skip it. The PDF keeps your original filename with a .pdf extension.
                </p>
              </div>
            </section>

            <section id="supported-formats" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. Which file formats are supported?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Four input formats, one output format.
                </p>
                <p>
                  <strong>Inputs</strong><br />
                  Microsoft Word's modern .docx and legacy .doc, OpenDocument Text .odt (the native format of LibreOffice and OpenOffice), and Rich Text Format .rtf. The .odt and .rtf support is worth highlighting, because many online converters handle only Word formats and leave those users stranded.
                </p>
                <p>
                  <strong>Output</strong><br />
                  A standard PDF that opens in any viewer on any device, prints predictably, and looks the same everywhere, which is the whole point of converting: your carefully formatted document stops being at the mercy of whatever software the recipient opens it with.
                </p>
                <p>
                  <strong>Not supported</strong><br />
                  Plain .txt, Google Docs links (download as .docx first from Google Docs via File &gt; Download), and spreadsheet or presentation formats. For images, use the BlendPDF images to PDF tool instead.
                </p>
              </div>
            </section>

            <section id="is-it-free" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Is the Word to PDF converter really free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, in the plain meaning of the word. The PDF you download carries no watermark or added branding, there is no page cap, no daily allowance that runs out at the worst moment, and no premium tier that the useful features are saved for.
                </p>
                <p>
                  <strong>The actual limits</strong><br />
                  50MB per file, one file per conversion, a processing window of about two minutes, and a rate limit of roughly 10 conversions per 15 minutes per user. These keep the service fast for everyone and are the same for every user on every visit.
                </p>
                <p>
                  <strong>And no sign-up</strong><br />
                  No account, no email verification, no installation. Open the page, convert, download.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Is it safe to upload my document?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Contracts, CVs, and reports are exactly what people convert, so here is the precise answer rather than a slogan.
                </p>
                <p>
                  <strong>How your file is handled</strong><br />
                  The upload travels over an encrypted HTTPS connection. Conversion is fully automated; no person views your document, and document contents are never read for any purpose beyond performing the conversion, never stored long-term, and never shared with anyone. Temporary files are removed immediately after processing, and everything is deleted from our servers within one hour.
                </p>
                <p>
                  <strong>What we measure</strong><br />
                  We use Google Analytics for aggregate, anonymous usage measurement, such as how many conversions ran and whether they succeeded. This never involves the contents of your documents. No account is needed, and downloads never require an email address.
                </p>
              </div>
            </section>

            <section id="formatting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Will my formatting and layout be preserved?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  For the large majority of documents, yes, and this direction of conversion is fundamentally more reliable than PDF to Word: the converter opens your document and lays it out for printing, exactly what a PDF is.
                </p>
                <p>
                  <strong>What converts accurately</strong><br />
                  Text and paragraph styles, headings, bold and italic, lists, tables, embedded images, margins, page sizes, page breaks, headers and footers, footnotes, and multi-column sections. LibreOffice, the engine we use, has handled Word formats for two decades.
                </p>
                <p>
                  <strong>Where small differences appear</strong><br />
                  Documents using uncommon fonts (see the next question, this is the main cause), the newest Word-only features like some SmartArt and advanced chart types, and heavily nested text boxes can render slightly differently. Macros do not run, and content controls are rendered at their current values.
                </p>
                <p>
                  <strong>Realistic summary</strong><br />
                  A typical letter, report, thesis, or CV converts indistinguishably from Word's own output. A design-heavy document built on niche fonts deserves a quick visual check before you send it anywhere important.
                </p>
              </div>
            </section>

            <section id="fonts" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Why does my PDF look slightly different from the Word file?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  In almost every case, the answer is fonts.
                </p>
                <p>
                  <strong>What happens</strong><br />
                  Word documents reference fonts by name but usually do not embed them. If your document uses a font that is not installed on the conversion server, LibreOffice substitutes the closest available font. Character widths then differ slightly, which can nudge line breaks, and occasionally page breaks, from what you saw in Word.
                </p>
                <p>
                  <strong>How to avoid it</strong><br />
                  Widely available fonts (Arial, Times New Roman, Calibri, Liberation fonts, and other common standards) convert without substitution. If your document depends on a specific purchased or branded font, either embed it in the .docx (in Word: File &gt; Options &gt; Save &gt; "Embed fonts in the file") before converting, or use Word's own PDF export on a machine that has the font.
                </p>
                <p>
                  <strong>Perspective</strong><br />
                  Substitution affects the look of letters, never the text itself. Your words, structure, images, and links are all intact; it is purely a typographic difference, and for most documents an invisible one.
                </p>
              </div>
            </section>

            <section id="links-toc" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Are hyperlinks, tables of contents, and page numbers kept?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes for the things people actually rely on, with one nuance about dynamic fields.
                </p>
                <p>
                  <strong>Hyperlinks</strong><br />
                  Web links in your document remain clickable in the PDF, including links on text and images. Internal cross-references and table-of-contents entries generally carry over as working links too.
                </p>
                <p>
                  <strong>Page numbers, headers, and footers</strong><br />
                  These are rendered exactly as they would print, including different first-page headers and odd and even page setups.
                </p>
                <p>
                  <strong>The nuance: fields render at their last-saved state</strong><br />
                  A table of contents, date field, or cross-reference is rendered as the document currently shows it. If you edited headings after last updating the TOC in Word, update it (select the TOC, press F9 in Word) and save before converting, so the PDF reflects the current page numbers. The converter does not silently regenerate fields for you, which is the predictable behavior you want when a document must match what you approved.
                </p>
              </div>
            </section>

            <section id="arabic-rtl" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Does it work with Arabic Word documents?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, well. Strong Arabic support is one of BlendPDF's priorities, and this tool delivers it, because the underlying engine matters here.
                </p>
                <p>
                  <strong>Proper RTL rendering</strong><br />
                  LibreOffice has mature, long-standing support for right-to-left scripts. Arabic, Hebrew, Persian, and Urdu documents convert with correct text direction, right-aligned paragraphs, proper letter joining and ligatures, and correct handling of mixed RTL and LTR content such as Arabic text containing English terms or numbers.
                </p>
                <p>
                  <strong>The usual font caveat</strong><br />
                  As with any document, if your specific Arabic font is not available on the server, a substitute Arabic font is used. The text remains correct and properly joined; the letterforms may just look slightly different. Common Arabic fonts convert without issue.
                </p>
                <p>
                  <strong>Note on other tools</strong><br />
                  This is the reverse direction of PDF to Word, where RTL extraction is genuinely hard and results need cleanup. Word to PDF does not have that problem: it renders rather than reconstructs, so what you wrote is what you get.
                </p>
              </div>
            </section>

            <section id="file-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  One document per conversion, up to 50MB.
                </p>
                <p>
                  <strong>What 50MB means in practice</strong><br />
                  Text-only documents almost never approach it; a 300-page thesis is typically a few megabytes. Files that get large are full of high-resolution photos. If yours is over the limit, compress the images inside Word (Picture Format &gt; Compress Pictures) and save again; that usually shrinks the file dramatically without visibly affecting the PDF.
                </p>
                <p>
                  <strong>Pages and time</strong><br />
                  There is no page limit. Processing is capped at about two minutes, which comfortably covers even long documents; only extreme cases, such as hundreds of pages dense with images, risk timing out. The rate limit is roughly 10 conversions per 15 minutes per user.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Can I convert a password-protected Word document?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. A Word file protected with an open-password is encrypted, and the converter cannot open it, so the conversion will fail.
                </p>
                <p>
                  <strong>The workflow that works</strong><br />
                  Open the document in Word with your password, remove the protection (File &gt; Info &gt; Protect Document &gt; Encrypt with Password, then clear the password), save, and convert the unprotected copy here. Only do this with documents you own or are authorized to modify.
                </p>
                <p>
                  <strong>Then protect the PDF properly</strong><br />
                  If the point of the password was confidentiality, protect the output instead of the input: run the converted PDF through the BlendPDF protect tool, which applies real AES-256 encryption. You end up with a shareable PDF that is at least as protected as the original Word file was.
                </p>
              </div>
            </section>

            <section id="protect-output" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. How do I password-protect the PDF I create?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Conversion and protection are two separate BlendPDF tools, used back to back.
                </p>
                <p>
                  <strong>The two-step flow</strong><br />
                  First convert your document here and download the PDF. Then open the BlendPDF protect tool, upload that PDF, and set a password. The protection is genuine AES-256 encryption, the standard used for sensitive documents, not a cosmetic lock, so a reader without the password cannot open the file.
                </p>
                <p>
                  <strong>Practical advice</strong><br />
                  Choose a password you can share with the recipient through a different channel than the file itself, for example the file by email and the password by message. And keep an unprotected copy for yourself; if you forget the password, real encryption has no back door, by design.
                </p>
              </div>
            </section>

            <section id="edit-afterward" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I edit the PDF afterward, or convert it back to Word?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  PDFs are a final-form format, designed to look identical everywhere rather than to be edited, so the right habit is simple: keep your Word file as the master and regenerate the PDF whenever the content changes.
                </p>
                <p>
                  <strong>Small additions are possible</strong><br />
                  You do not need Word for everything. BlendPDF has tools that work directly on the PDF: add a visual signature with the sign tool, stamp a watermark, add page numbers, merge it with other PDFs, or delete and reorder pages. Note that watermark, page-number, and typed-signature text currently supports Latin characters only; Arabic text support there is coming.
                </p>
                <p>
                  <strong>Lost the original?</strong><br />
                  The BlendPDF PDF to Word tool converts the PDF back into an editable DOCX. For a document that started life in Word this round trip works well, though it is honest to say the result will not be byte-for-byte identical to the file you lost; expect to touch up spacing or fonts.
                </p>
              </div>
            </section>

            <section id="vs-word-builtin" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Why use this instead of Word's built-in Save as PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  An honest answer: if you have desktop Microsoft Word in front of you, its built-in PDF export is excellent, and using it is completely reasonable. It renders with the exact fonts on your machine and needs no upload at all.
                </p>
                <p>
                  <strong>When BlendPDF is the better tool</strong><br />
                  You do not have Word: you are on a phone or tablet, a Chromebook, a locked-down work computer, or you simply never bought a license. You have a .odt or .rtf file and nothing installed that exports it nicely. Someone emailed you a .docx and you just need it as a PDF in the next thirty seconds without opening an editor. Or you are on a borrowed machine and do not want to install anything.
                </p>
                <p>
                  <strong>Versus other online converters</strong><br />
                  Plenty of sites convert Word to PDF; the common catches are watermarks, two-files-per-day limits, and email-gated downloads. BlendPDF has none of those: no watermark, no quota designed to upsell, no email required, and files deleted within the hour.
                </p>
              </div>
            </section>

            <section id="checklist" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What should I check before and after converting?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  A one-minute routine that prevents nearly every unpleasant surprise.
                </p>
                <p>
                  <strong>Before converting</strong><br />
                  Accept or reject all tracked changes and delete leftover comments; the PDF renders the document as it would print, and you do not want revision marks in the version you send out. Update any table of contents or cross-reference fields (F9 in Word) so page numbers are current. If the document uses unusual fonts, consider embedding them in the file.
                </p>
                <p>
                  <strong>After converting</strong><br />
                  Skim the PDF once: check the total page count matches expectations, glance at any page where layout is critical, and click one or two hyperlinks. Font substitutions and shifted breaks, the two realistic issues, are immediately visible when you look.
                </p>
                <p>
                  <strong>If the conversion fails</strong><br />
                  Confirm the file opens correctly in a word processor (a corrupted download will fail here too), is under 50MB, is not password-protected, and is one of the supported formats. A "too many requests" message means the rate limit of about 10 conversions per 15 minutes; wait a few minutes and try again.
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
