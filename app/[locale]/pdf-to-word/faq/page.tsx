'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function PDFToWordFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How to convert PDF to Word online',
      answer: 'Upload your PDF by clicking "Select PDF" or dragging it onto the upload area, click "Convert to Word", and download the resulting DOCX file. Conversion usually takes a few seconds to a minute depending on the size and complexity of the document. No account or email is required.'
    },
    {
      question: 'Is BlendPDF\'s PDF to Word converter really free?',
      answer: 'Yes. There is no watermark on the output, no page limit, no daily quota that pushes you to a paid plan, and no sign-up. The only practical limits are technical ones: 50MB per file and a processing window of about two minutes.'
    },
    {
      question: 'Do I need an account or email address to download my file?',
      answer: 'No. You can convert and download without creating an account or entering an email. An optional email-delivery feature exists if you would rather receive the file in your inbox, but you can always skip it and download directly.'
    },
    {
      question: 'Is it safe to convert my PDF online?',
      answer: 'Uploads are encrypted in transit, document contents are never read, stored, or shared, and files are deleted from our servers within one hour, most immediately after processing. No account is needed. We use Google Analytics for aggregate, anonymous usage measurement only.'
    },
    {
      question: 'How accurate is the conversion?',
      answer: 'BlendPDF uses the pdf2docx engine, which reconstructs paragraphs, tables, and images from text-based PDFs with good fidelity. Simple, single-column documents convert very well. Complex multi-column layouts, heavy graphic design, and right-to-left text may need manual cleanup after conversion.'
    },
    {
      question: 'Will formatting, images, and tables be preserved?',
      answer: 'Text, images, and most tables carry over. Fonts are matched as closely as possible, and paragraph structure is rebuilt so the document is genuinely editable. Elements that commonly shift are text boxes, footnotes, multi-column sections, and decorative layouts.'
    },
    {
      question: 'Can I convert a scanned PDF to Word?',
      answer: 'Not into editable text. BlendPDF does not have OCR yet, so a scanned page is an image and the converter cannot extract words from it. The output will contain the page images rather than editable text. Run the file through an OCR tool first, then convert.'
    },
    {
      question: 'Does it work with Arabic and other RTL PDFs?',
      answer: 'You can convert them, but right-to-left text is one of the hardest cases for any PDF-to-Word engine, including ours. Expect the text to come through, with word order, joining, or alignment sometimes needing cleanup in Word. Simple Arabic documents fare much better than complex layouts.'
    },
    {
      question: 'What are the file size and page limits?',
      answer: 'One PDF at a time, up to 50MB. There is no fixed page limit, but processing is capped at about two minutes, so very long or very complex documents can time out. If that happens, split the PDF and convert it in parts.'
    },
    {
      question: 'Can I convert a password-protected PDF?',
      answer: 'No. Encrypted PDFs cannot be processed directly. If you have the password and the right to modify the document, use the BlendPDF unlock tool to remove the protection first, then convert the unlocked file.'
    },
    {
      question: 'What format do I get, and can I open it anywhere?',
      answer: 'You get a DOCX file, the standard Microsoft Word format. It opens in Word, Google Docs, LibreOffice, and Pages. If you need the older DOC format, open the DOCX in any of those apps and save it as DOC.'
    },
    {
      question: 'How does BlendPDF compare to Word or Adobe Acrobat?',
      answer: 'Microsoft Word can open PDFs directly and Adobe Acrobat Pro has a strong exporter, but Word\'s results vary and Acrobat requires a paid license. BlendPDF is free, works in the browser with no install, and handles text-based documents well. For extremely complex layouts, Acrobat Pro may still do better.'
    },
    {
      question: 'Why does my converted file look different from the PDF?',
      answer: 'The most common causes are fonts that were not embedded in the PDF (substituted fonts change line breaks), multi-column or designed layouts, and scanned pages, which convert as images because there is no OCR. Small spacing differences are normal and quick to fix in Word.'
    },
    {
      question: 'What if the conversion fails or I get an error?',
      answer: 'Check that the file is a valid, unencrypted PDF under 50MB. If the PDF is damaged, run it through the BlendPDF repair tool first. A "too many requests" message means you hit the limit of about 10 conversions per 15 minutes; wait a few minutes and try again.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'PDF to Word', url: '/pdf-to-word' },
        { name: 'FAQ', url: '/pdf-to-word/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Link href="/pdf-to-word" className="mb-6 inline-block text-blue-600 hover:text-blue-800">
            &larr; Back to the PDF to Word converter
          </Link>
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: PDF to Word
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-convert" className="text-blue-600 hover:text-blue-800">How to convert PDF to Word online</a></li>
              <li><a href="#is-it-free" className="text-blue-600 hover:text-blue-800">Is BlendPDF's PDF to Word converter really free?</a></li>
              <li><a href="#account-required" className="text-blue-600 hover:text-blue-800">Do I need an account or email address to download my file?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to convert my PDF online?</a></li>
              <li><a href="#accuracy" className="text-blue-600 hover:text-blue-800">How accurate is the conversion?</a></li>
              <li><a href="#formatting" className="text-blue-600 hover:text-blue-800">Will formatting, images, and tables be preserved?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Can I convert a scanned PDF to Word?</a></li>
              <li><a href="#arabic-rtl" className="text-blue-600 hover:text-blue-800">Does it work with Arabic and other RTL PDFs?</a></li>
              <li><a href="#file-limits" className="text-blue-600 hover:text-blue-800">What are the file size and page limits?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I convert a password-protected PDF?</a></li>
              <li><a href="#output-format" className="text-blue-600 hover:text-blue-800">What format do I get, and can I open it anywhere?</a></li>
              <li><a href="#comparison" className="text-blue-600 hover:text-blue-800">How does BlendPDF compare to Word or Adobe Acrobat?</a></li>
              <li><a href="#looks-different" className="text-blue-600 hover:text-blue-800">Why does my converted file look different from the PDF?</a></li>
              <li><a href="#troubleshooting" className="text-blue-600 hover:text-blue-800">What if the conversion fails or I get an error?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-convert" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to convert PDF to Word online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Converting a PDF to an editable Word document with BlendPDF takes three steps and usually well under a minute.
                </p>
                <p>
                  <strong>Upload your PDF</strong><br />
                  Click "Select PDF" or drag and drop your file onto the upload area. You can also pick a file straight from Google Drive. One PDF at a time, up to 50MB. You will see a thumbnail preview so you can confirm you grabbed the right document.
                </p>
                <p>
                  <strong>Convert</strong><br />
                  Click "Convert to Word". The conversion runs on our servers using the pdf2docx engine, which analyzes the PDF's text, tables, and images and rebuilds them as a native Word document. Simple documents finish in a few seconds; long or image-heavy files take longer, up to a couple of minutes.
                </p>
                <p>
                  <strong>Download the DOCX</strong><br />
                  When the conversion finishes, download the DOCX file directly. If you prefer, you can have it emailed to you instead, but that step is entirely optional; no email address is ever required to download. The file opens in Microsoft Word, Google Docs, LibreOffice, or any other DOCX-compatible editor, ready to edit.
                </p>
              </div>
            </section>

            <section id="is-it-free" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. Is BlendPDF's PDF to Word converter really free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, and free means free in the ordinary sense of the word: there is no watermark stamped on your converted document, no two-pages-then-paywall limit, no daily conversion quota designed to push you toward a subscription, and no "premium quality" tier that holds back the good output.
                </p>
                <p>
                  <strong>What the actual limits are</strong><br />
                  The limits that do exist are technical, not commercial: 50MB per file, one file per conversion, a processing window of about two minutes, and a rate limit of roughly 10 conversions per 15 minutes per user so the service stays fast for everyone. Those limits are the same whether it is your first conversion or your five hundredth.
                </p>
                <p>
                  <strong>No sign-up either</strong><br />
                  You do not need to create an account, confirm an email address, or install anything. Open the page, convert, download. That is the whole flow.
                </p>
              </div>
            </section>

            <section id="account-required" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Do I need an account or email address to download my file?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Downloads never require an email address, and there is no account system at all.
                </p>
                <p>
                  <strong>About the email option you may see</strong><br />
                  After a conversion finishes, BlendPDF offers a choice: download the file directly, or have it sent to an email address. The email option exists purely as a convenience, for example when you convert on a shared computer and want the file on your own machine. It is optional every time, and choosing direct download involves no email at all.
                </p>
                <p>
                  <strong>Why this matters</strong><br />
                  Many "free" converters gate the download behind an email signup and then market to that address. BlendPDF does not do this. If you skip the email option, we have no idea who you are, which is how it should be for a document tool.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Is it safe to convert my PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, within clearly stated boundaries. Here is exactly how your file is handled.
                </p>
                <p>
                  <strong>In transit and on the server</strong><br />
                  Files are uploaded over an encrypted HTTPS connection. On the server, the conversion runs automatically; no person views your document, and document contents are never read for any purpose other than performing the conversion you asked for. Contents are never stored long-term or shared with anyone.
                </p>
                <p>
                  <strong>Deletion</strong><br />
                  Temporary files created during conversion are removed immediately after processing, and anything remaining is deleted from our servers within one hour. We do not keep backups or archives of your documents.
                </p>
                <p>
                  <strong>What we do measure</strong><br />
                  We use Google Analytics to understand aggregate, anonymous usage, such as how many people used the converter and whether conversions succeeded. This measurement never involves the contents of your documents. No account is needed to use anything on the site.
                </p>
              </div>
            </section>

            <section id="accuracy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. How accurate is the conversion?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF converts PDFs with the pdf2docx engine, which parses the PDF's internal structure, detects paragraphs, tables, and images, and rebuilds them as native, editable Word elements rather than as one big picture of the page.
                </p>
                <p>
                  <strong>What converts well</strong><br />
                  Text-based PDFs with conventional layouts: reports, letters, contracts, essays, and documents that were originally created in a word processor. Paragraphs stay paragraphs, tables stay tables you can edit cell by cell, and embedded images come through at their original quality.
                </p>
                <p>
                  <strong>What needs cleanup</strong><br />
                  Complex multi-column layouts (magazines, brochures), heavy graphic design, forms with intricate positioning, and right-to-left text can come through with shifted elements or reflowed lines. The text is there, but plan on a few minutes of tidying in Word for these documents. Scanned PDFs are a separate case entirely; see the scanned PDF question below.
                </p>
                <p>
                  <strong>Honest bottom line</strong><br />
                  No PDF-to-Word converter is perfect, because PDF is a print format that throws away most of the structure Word needs. For typical office documents, expect output you can edit immediately. For designed layouts, expect a solid starting point rather than a pixel-perfect replica.
                </p>
              </div>
            </section>

            <section id="formatting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Will formatting, images, and tables be preserved?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Most of it, yes. Here is a realistic breakdown of what carries over and what tends to move.
                </p>
                <p>
                  <strong>Preserved reliably</strong><br />
                  Body text and its reading order, bold, italic, font sizes, headings, bullet and numbered lists, standard tables, and embedded images. Fonts are matched as closely as possible; if the exact font is not available, a visually similar one is substituted.
                </p>
                <p>
                  <strong>Frequently needs adjustment</strong><br />
                  Text boxes and callouts, footnotes and endnotes, headers and footers (these sometimes convert as body text), multi-column sections, watermarks, and precise line breaks in justified text. Hyperlinks may convert as plain text depending on how the PDF encoded them.
                </p>
                <p>
                  <strong>Practical tip</strong><br />
                  After converting, turn on formatting marks in Word (the &para; button) to quickly spot stray page breaks or misplaced section breaks. Fixing these first makes the rest of the cleanup much faster.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Can I convert a scanned PDF to Word?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not into editable text, no. BlendPDF does not have OCR (optical character recognition) yet, and we would rather say that plainly than let you waste time on a conversion that cannot work.
                </p>
                <p>
                  <strong>Why not</strong><br />
                  A scanned PDF contains photographs of pages, not text. The converter can only extract text that actually exists in the file. When you convert a scanned PDF, the output DOCX will contain the page images, which you can crop or resize in Word, but not the words as editable text.
                </p>
                <p>
                  <strong>How to tell if your PDF is scanned</strong><br />
                  Open it in any PDF viewer and try to select a sentence with your cursor. If you cannot select individual words, or selecting drags a rectangle over the whole page, it is a scan.
                </p>
                <p>
                  <strong>Workarounds</strong><br />
                  Run the file through an OCR tool first, then convert the OCR'd result here. Many options exist: Adobe Acrobat's built-in OCR, free desktop tools built on the Tesseract engine, or the OCR built into Google Drive (open the PDF with Google Docs and it will attempt text recognition). For a short document, retyping while viewing the PDF side-by-side is sometimes fastest of all.
                </p>
              </div>
            </section>

            <section id="arabic-rtl" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Does it work with Arabic and other RTL PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  You can convert Arabic, Hebrew, Persian, and Urdu PDFs, and we want to be straightforward about what to expect, because right-to-left text is the hardest case in PDF-to-Word conversion, for every tool on the market including ours.
                </p>
                <p>
                  <strong>The honest picture</strong><br />
                  PDFs store glyph positions, not logical text order, and RTL scripts add bidirectional ordering and letter joining on top. As a result, converted Arabic text can occasionally come through with reversed word order, broken letter joining, or left-aligned paragraphs that should be right-aligned. Simple, single-column Arabic documents usually convert acceptably; mixed Arabic-English content and complex layouts need more cleanup.
                </p>
                <p>
                  <strong>What to do after converting</strong><br />
                  In Word, select the affected paragraphs, set the paragraph direction to right-to-left, and reapply an Arabic-capable font. That fixes the most common issues. If the source document is a scan, remember there is no OCR yet, and Arabic OCR in external tools varies widely in quality.
                </p>
                <p>
                  <strong>Where BlendPDF's Arabic support is strongest</strong><br />
                  The site itself is fully localized in Arabic with proper RTL layout, and tools that do not need to reconstruct text, like merge, split, rotate, and PDF to images, handle Arabic documents perfectly because they never touch the text layer.
                </p>
              </div>
            </section>

            <section id="file-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. What are the file size and page limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The limits are simple: one PDF per conversion, up to 50MB.
                </p>
                <p>
                  <strong>Pages and processing time</strong><br />
                  There is no fixed page limit. Instead, each conversion gets a processing window of about two minutes. A 100-page text document fits comfortably; a 400-page PDF dense with images and tables might not. If a large document times out, split it into parts with the BlendPDF split tool, convert each part, and reassemble the sections in Word.
                </p>
                <p>
                  <strong>Reducing file size first</strong><br />
                  If your PDF is over 50MB, run it through the BlendPDF compress tool first. Compression keeps text selectable, and if the file cannot be made smaller, you simply get the original back, so there is no downside to trying.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Can I convert a password-protected PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. If the PDF is encrypted, the converter cannot read its contents and the conversion will fail.
                </p>
                <p>
                  <strong>The fix</strong><br />
                  If you know the password and have the right to modify the document, use the BlendPDF unlock tool to remove the protection, then convert the unlocked copy. The unlock tool requires the password; it does not crack or bypass encryption, and we do not offer anything that does.
                </p>
                <p>
                  <strong>A note on permissions</strong><br />
                  Converting a document you own or are authorized to edit is a normal, legitimate use. If a document was locked by someone else specifically to prevent editing, removing that protection without permission may violate an agreement or applicable law, so get permission first.
                </p>
              </div>
            </section>

            <section id="output-format" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. What format do I get, and can I open it anywhere?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The output is a DOCX file, the standard format used by Microsoft Word since 2007.
                </p>
                <p>
                  <strong>Compatibility</strong><br />
                  DOCX opens in Microsoft Word (desktop, web, and mobile), Google Docs, LibreOffice Writer, Apple Pages, and virtually every modern word processor. The converted file keeps the original filename with a .docx extension.
                </p>
                <p>
                  <strong>If you need a different format</strong><br />
                  We do not output the legacy DOC format directly, but any of the apps above can save the DOCX as DOC, ODT, RTF, or plain text in a couple of clicks. And if you later need to go back the other way, the BlendPDF Word to PDF tool converts DOCX back to PDF.
                </p>
              </div>
            </section>

            <section id="comparison" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. How does BlendPDF compare to Word or Adobe Acrobat?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  A fair question, because you have alternatives, and sometimes they are the better choice.
                </p>
                <p>
                  <strong>Microsoft Word itself</strong><br />
                  Word can open PDFs directly (File &gt; Open) and convert them on the fly. It is convenient if you own Word, but its PDF interpreter is inconsistent: some documents convert cleanly, others come out badly scrambled, and large PDFs can hang. Worth trying if you already have Word installed; results genuinely vary by document.
                </p>
                <p>
                  <strong>Adobe Acrobat Pro</strong><br />
                  Acrobat Pro has one of the best PDF-to-Word exporters available and includes OCR for scans. The catch is the price: it is a paid subscription. If you convert complex documents professionally every day, it may be worth paying for. For everyday conversions, it is overkill.
                </p>
                <p>
                  <strong>Where BlendPDF fits</strong><br />
                  BlendPDF is free with no watermark or sign-up, runs in the browser on any device, and uses the pdf2docx engine, which is genuinely strong on text-based documents. It does not have OCR yet, and Acrobat will beat it on extremely complex layouts. For the common case, converting a normal document into something you can edit right away, it does the job at no cost.
                </p>
              </div>
            </section>

            <section id="looks-different" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Why does my converted file look different from the PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Usually one of three reasons, all inherent to how PDFs work rather than bugs in your file.
                </p>
                <p>
                  <strong>Fonts were not embedded</strong><br />
                  Many PDFs reference fonts without embedding them. When the exact font is unavailable during conversion, a similar one is substituted, which changes character widths and therefore line breaks and page breaks. The text itself is intact; the flow just shifts slightly.
                </p>
                <p>
                  <strong>The layout is more complex than it looks</strong><br />
                  Multi-column text, sidebars, pull quotes, and precisely positioned elements have no direct equivalent in Word's flowing-text model. The converter approximates them with tables or text frames, which is editable but not identical.
                </p>
                <p>
                  <strong>Some pages are scans</strong><br />
                  Mixed PDFs, where some pages are digital and some are scanned, convert unevenly: digital pages become editable text, scanned pages become images, because there is no OCR yet. Selecting text in the original PDF page by page tells you which is which.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What if the conversion fails or I get an error?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Work through these checks in order; they cover nearly all failed conversions.
                </p>
                <p>
                  <strong>Check the basics</strong><br />
                  The file must be a real PDF (not a renamed image or another format), under 50MB, and not password-protected. If it is encrypted and you have the password, unlock it first with the BlendPDF unlock tool.
                </p>
                <p>
                  <strong>Damaged files</strong><br />
                  If the PDF will not open cleanly in a viewer either, it is likely corrupted. Run it through the BlendPDF repair tool, which attempts recovery using qpdf and pypdf. Repair fixes many structural problems, though honestly not everything; a severely damaged file may be unrecoverable.
                </p>
                <p>
                  <strong>Timeouts and rate limits</strong><br />
                  Very large or very complex documents can exceed the two-minute processing window; split them and convert in parts. A "too many conversion requests" message means you have hit the rate limit of about 10 conversions per 15 minutes; wait a few minutes and continue.
                </p>
                <p>
                  <strong>Still stuck?</strong><br />
                  Try re-saving the PDF from your viewer (Print to PDF works well as a normalizer) and converting the fresh copy. This resolves a surprising number of edge cases caused by unusual PDF generators.
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
