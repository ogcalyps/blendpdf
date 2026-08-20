'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function PdfToTextFAQ() {
  const faqs = [
    {
      question: 'How to extract text from a PDF online',
      answer: 'Upload your PDF and the text is extracted automatically, page by page, directly in your browser. A live preview shows the result with character and word counts. Click "Copy to clipboard" or "Download as .txt" to save the text. Nothing is uploaded to a server.'
    },
    {
      question: 'Is my PDF uploaded to a server?',
      answer: 'No. The PDF to Text tool runs 100% in your browser using client-side text extraction. Your file never leaves your device — the text is read locally, which makes the tool both fast and private.'
    },
    {
      question: 'Why is no text extracted from my scanned PDF?',
      answer: 'Scanned PDFs are images of pages and have no text layer, so there is nothing for a text extractor to read. Those documents need OCR (optical character recognition). Use the BlendPDF OCR tool at /ocr-pdf, which recognizes Arabic, English, and French, then extract the text.'
    },
    {
      question: 'Can I copy the text instead of downloading it?',
      answer: 'Yes. After extraction, click "Copy to clipboard" to copy the full text at once, or select just a portion of the preview and copy it manually. You can also download everything as a .txt file named after your PDF.'
    },
    {
      question: 'Will the layout and formatting be preserved?',
      answer: 'You get plain text. Paragraphs and line breaks are reconstructed as well as possible, but fonts, colors, columns, tables, and images are not preserved. If you need editable formatting, use the BlendPDF PDF to Word tool instead.'
    },
    {
      question: 'Does it extract Arabic text?',
      answer: 'Yes, Arabic text is extracted when the PDF contains a proper Unicode text layer, and the preview automatically switches to right-to-left display. Some Arabic PDFs store text in non-standard ways, so results can vary; scanned Arabic documents should go through the OCR tool first.'
    },
    {
      question: 'What are the page separators?',
      answer: 'The "Insert page separators" option adds a "--- Page N ---" marker between pages in the output, so you can tell where each page starts. Untick the checkbox to get one continuous text without markers. The preview updates instantly either way.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'You can load PDF files up to 50MB. There is no page limit — a progress bar shows extraction advancing page by page. Because processing is local, large files depend on your device\'s speed rather than on any server.'
    },
    {
      question: 'How long does text extraction take?',
      answer: 'Most PDFs are done in a few seconds. Since everything runs in your browser, speed depends on your device and the document\'s size and complexity — there is no upload or download wait, and no server queue.'
    },
    {
      question: 'Is my original file modified?',
      answer: 'No. The tool only reads your PDF to extract its text; the file itself is never changed. The extracted text is saved as a separate .txt file, and your original PDF stays exactly as it was on your device.'
    },
    {
      question: 'Can I extract text from password-protected PDFs?',
      answer: 'Not directly. Encrypted PDFs cannot be opened without the password, so the tool will show a hint instead of a result. Remove the password first with the BlendPDF Unlock PDF tool, then extract the text.'
    },
    {
      question: 'Can I extract text on mobile devices?',
      answer: 'Yes, the tool works on smartphones and tablets. Extraction runs locally in your mobile browser, and you can copy the text to your clipboard or download the .txt file just like on desktop.'
    },
    {
      question: 'Is the PDF to text converter free?',
      answer: 'Yes — completely free, with no sign-up, no watermarks, and no premium tiers today. Files up to 50MB are supported, and because everything runs in your browser there is nothing to wait for on a server.'
    },
    {
      question: 'What happens to my file after extraction?',
      answer: 'Nothing is uploaded, so there is nothing to delete server-side. Your PDF is read locally in your browser\'s memory and released when you close or reload the page. The file and the extracted text stay entirely on your device.'
    },
    {
      question: 'What if extraction fails or the text looks wrong?',
      answer: 'Common causes are scanned PDFs without a text layer (use the OCR tool), password protection (unlock first), corrupted files, or the 50MB limit. Odd word order or spacing usually reflects how text is stored inside the PDF. Refresh the page and try again if extraction fails unexpectedly.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'PDF to Text', url: '/pdf-to-text' },
        { name: 'FAQ', url: '/pdf-to-text/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: PDF to Text
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-extract" className="text-blue-600 hover:text-blue-800">How to extract text from a PDF online</a></li>
              <li><a href="#in-browser-privacy" className="text-blue-600 hover:text-blue-800">Is my PDF uploaded to a server?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Why is no text extracted from my scanned PDF?</a></li>
              <li><a href="#copy-text" className="text-blue-600 hover:text-blue-800">Can I copy the text instead of downloading it?</a></li>
              <li><a href="#formatting" className="text-blue-600 hover:text-blue-800">Will the layout and formatting be preserved?</a></li>
              <li><a href="#arabic-support" className="text-blue-600 hover:text-blue-800">Does it extract Arabic text?</a></li>
              <li><a href="#page-separators" className="text-blue-600 hover:text-blue-800">What are the page separators?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#processing-time" className="text-blue-600 hover:text-blue-800">How long does text extraction take?</a></li>
              <li><a href="#original-file" className="text-blue-600 hover:text-blue-800">Is my original file modified?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I extract text from password-protected PDFs?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I extract text on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is the PDF to text converter free?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">What happens to my file after extraction?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if extraction fails or the text looks wrong?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-extract" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to extract text from a PDF online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Extracting text from a PDF with BlendPDF takes only a few clicks, and unlike most online converters, the whole process happens inside your own browser. Here's how it works from start to finish:
                </p>
                <p>
                  <strong>Select Your PDF</strong><br />
                  Click the "Select PDF" button or drag and drop your file onto the upload area. You can also pick a file straight from Google Drive. PDFs up to 50MB are accepted. The moment the file is selected, extraction begins automatically — there is no separate "convert" step to trigger and no upload to wait for, because the file is read directly on your device.
                </p>
                <p>
                  <strong>Watch the Extraction Progress</strong><br />
                  Your browser reads the document page by page and builds a plain-text version of it. A live progress indicator shows exactly which page is being processed ("Extracting page 3 of 12..."), so even long documents give you clear feedback. When extraction finishes, the full text appears in a preview box along with a character count and a word count, letting you verify the result before saving anything.
                </p>
                <p>
                  <strong>Copy or Download the Text</strong><br />
                  Once the preview is ready, you have two options. Click "Copy to clipboard" to grab the entire text in one go — ideal for pasting into an email, a document, or a chat. Or click "Download as .txt" to save a plain-text file named after your PDF (for example, report.pdf becomes report.txt). You can also toggle page separators on or off before saving, depending on whether you want "--- Page N ---" markers between pages.
                </p>
                <p>
                  <strong>No Account, No Waiting</strong><br />
                  There is no sign-up, no email requirement to get your text, and no processing queue. Because the extraction runs locally, the only thing that determines speed is your own device — most documents are done in seconds.
                </p>
              </div>
            </section>

            <section id="in-browser-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. Is my PDF uploaded to a server?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. The BlendPDF PDF to Text tool processes your file 100% in your browser. Your PDF never leaves your device, and no copy of it is ever sent to, stored on, or processed by a server.
                </p>
                <p>
                  <strong>How Local Extraction Works</strong><br />
                  When you select a PDF, your browser reads the file directly from your device's memory using a client-side PDF engine. The text layer of each page is parsed locally, on your own hardware, and the resulting text is assembled right there in the page you're looking at. At no point does the file travel over the internet. This is fundamentally different from traditional online converters, which upload your document to a remote server, process it there, and send a result back.
                </p>
                <p>
                  <strong>Why This Matters</strong><br />
                  PDFs often contain sensitive content — contracts, financial statements, medical records, CVs, internal reports. With server-based tools, you have to trust that the operator stores your file securely and deletes it on schedule. With in-browser extraction, that trust isn't needed: there is simply no server copy to secure or delete. If you disconnect from the internet after the page loads, extraction still works, which is the clearest proof that your file stays local.
                </p>
                <p>
                  <strong>Privacy as a Side Effect of Speed</strong><br />
                  Local processing isn't just more private — it's faster. There's no upload time, no server queue, and no download wait. The same design decision that protects your document also makes the tool feel instant, especially for small and medium-sized files.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Why is no text extracted from my scanned PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  If your PDF is a scan — pages photographed or scanned as images — the extractor will report that no text was found. This is expected behavior, and understanding why helps you pick the right tool for the job.
                </p>
                <p>
                  <strong>Text Layer vs. Image of Text</strong><br />
                  A "digital-native" PDF (exported from Word, Google Docs, or similar) contains a real text layer: the actual characters are stored inside the file, which is why you can select and search text in a PDF viewer. A scanned PDF, by contrast, contains pictures of pages. To your eyes it looks like text, but to software it's just pixels — there are no characters to extract. The PDF to Text tool reads the text layer, so when there is no layer, there is honestly nothing for it to return.
                </p>
                <p>
                  <strong>The Solution: OCR</strong><br />
                  Turning an image of text back into real characters requires OCR (optical character recognition). BlendPDF has a dedicated OCR tool at <a href="/ocr-pdf" className="text-blue-600 hover:text-blue-800">/ocr-pdf</a> that recognizes Arabic, English, and French. Run your scanned document through OCR to get a searchable PDF, and from there the text can be extracted, copied, and reused. Arabic OCR support is a first-class feature, which is rare among free tools.
                </p>
                <p>
                  <strong>How to Tell Which Kind of PDF You Have</strong><br />
                  Open the file in any PDF viewer and try to select a sentence with your cursor. If you can highlight individual words, the file has a text layer and this tool will extract it. If your selection draws a rectangle over the page image instead, it's a scan — head to the OCR tool first. Mixed documents also exist: some pages digital, some scanned. The extractor will return text from the digital pages and nothing from the scanned ones.
                </p>
              </div>
            </section>

            <section id="copy-text" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Can I copy the text instead of downloading it?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Copying is a first-class option, not an afterthought. After extraction, the full text sits in an on-page preview, and you can take it wherever you need it in whichever way suits your workflow.
                </p>
                <p>
                  <strong>One-Click Copy</strong><br />
                  Click "Copy to clipboard" and the entire extracted text — every page — is copied at once. A confirmation ("Copied!") appears so you know it worked. This is the fastest route when you're pasting the content into an email, a chat message, a translation tool, a note-taking app, or an AI assistant. There's no need to save a file at all if you only need the text once.
                </p>
                <p>
                  <strong>Partial Selection</strong><br />
                  The preview is a normal, scrollable text area, so you can also select just the paragraph or section you care about and copy it with your usual keyboard shortcut. This is handy for long documents where you only need a quote, a table of figures, or a single clause from a contract.
                </p>
                <p>
                  <strong>Download as .txt</strong><br />
                  If you'd rather keep a file, click "Download as .txt". The output is a plain-text file encoded in UTF-8, named after your original PDF, that opens in any text editor on any operating system. Plain text is the most portable format there is — perfect for archiving content, feeding scripts and data pipelines, or importing into other software.
                </p>
                <p>
                  <strong>Counts for Quick Checks</strong><br />
                  Above the preview you'll see live character and word counts. These are convenient when you're checking a document against a word limit, estimating translation costs, or just confirming that the extraction picked up the full document rather than a fragment.
                </p>
              </div>
            </section>

            <section id="formatting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Will the layout and formatting be preserved?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The output is deliberately plain text, so the honest answer is: the words are preserved, the visual design is not. Knowing exactly what carries over helps you decide whether this tool or a different one fits your task.
                </p>
                <p>
                  <strong>What Is Preserved</strong><br />
                  All readable text content comes through: headings, paragraphs, list items, captions, and numbers. The extractor also reconstructs line breaks by watching where text sits on the page — when the vertical position of the text changes noticeably, a new line is started. Paragraph structure therefore survives reasonably well in most documents, and the reading order follows the order in which text is stored in the PDF.
                </p>
                <p>
                  <strong>What Is Not Preserved</strong><br />
                  Fonts, font sizes, colors, bold and italic styling, images, headers and footers as distinct elements, multi-column layouts, and table borders are all gone — plain text simply has no way to represent them. Tables come out as lines of words rather than aligned grids, and multi-column pages can read in an unexpected order because columns are stored sequentially inside the file.
                </p>
                <p>
                  <strong>When Plain Text Is the Right Choice</strong><br />
                  Plain text is ideal when you want the content, not the presentation: quoting from a document, indexing or searching, feeding text to scripts or language models, counting words, or archiving in the most future-proof format possible. It's the wrong choice when you need to edit the document while keeping its look.
                </p>
                <p>
                  <strong>Need Editable Formatting?</strong><br />
                  If you want to keep styling, structure, and images in an editable form, use the BlendPDF <a href="/pdf-to-word" className="text-blue-600 hover:text-blue-800">PDF to Word</a> tool instead. It produces a .docx file that preserves layout far better than plain text ever could.
                </p>
              </div>
            </section>

            <section id="arabic-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Does it extract Arabic text?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. BlendPDF is built Arabic-first, and the PDF to Text tool extracts Arabic content whenever the PDF carries a genuine Unicode text layer. There are, however, honest caveats worth knowing about, because Arabic PDFs vary more than Latin-script ones in how they store text internally.
                </p>
                <p>
                  <strong>RTL-Aware Preview</strong><br />
                  The extraction preview automatically detects text direction, so Arabic output is displayed right-to-left as it should be, while mixed Arabic-English documents render each run in its natural direction. Character and word counts work for Arabic text just as they do for English.
                </p>
                <p>
                  <strong>When Arabic Extraction Works Well</strong><br />
                  PDFs generated by modern software with proper Unicode encoding — most documents exported from recent versions of Word, Google Docs, or InDesign — extract cleanly: letters keep their correct forms and order, and the text you copy is real, searchable Arabic. This covers the majority of contemporary Arabic documents.
                </p>
                <p>
                  <strong>When Results Can Vary</strong><br />
                  Some Arabic PDFs, especially older ones or those produced by unusual tools, store text as presentation forms or in visual rather than logical order. In those files the extracted characters may appear reversed or disconnected, because that's literally how they are stored inside the PDF. This is a limitation of the source file, not of your document's language — no text-layer extractor can recover ordering the file never recorded. If you hit this, running the document through the <a href="/ocr-pdf" className="text-blue-600 hover:text-blue-800">OCR tool</a> — which recognizes Arabic — often produces a cleaner result.
                </p>
                <p>
                  <strong>Scanned Arabic Documents</strong><br />
                  Scanned Arabic PDFs have no text layer at all, so use the OCR tool first. BlendPDF's OCR supports Arabic alongside English and French, making it a practical pipeline: OCR the scan, then extract, copy, or download the recognized text.
                </p>
              </div>
            </section>

            <section id="page-separators" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. What are the page separators?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Page separators are optional markers that show where each PDF page begins inside the extracted text. A checkbox below the preview — "Insert page separators (--- Page N ---)" — turns them on or off, and the preview updates instantly.
                </p>
                <p>
                  <strong>With Separators On</strong><br />
                  Each page's text is preceded by a line such as "--- Page 4 ---". This keeps the structure of the original document visible in the plain-text output, which is invaluable when you need to cite a specific page, cross-reference the text against the PDF, or split the text back into pages programmatically. For multi-page contracts, reports, and academic papers, separators make the output far easier to navigate.
                </p>
                <p>
                  <strong>With Separators Off</strong><br />
                  The pages flow together as one continuous text, separated only by blank lines. This is the better choice when you want clean prose for pasting into another document, feeding to a language model, or running through text analysis, where artificial "--- Page N ---" markers would just be noise to strip out later.
                </p>
                <p>
                  <strong>Applies to Both Copy and Download</strong><br />
                  The toggle affects whatever you take from the tool: the clipboard copy and the downloaded .txt file both respect the current setting. You can flip the checkbox and copy again to get both variants from a single extraction — the text is re-assembled instantly without re-processing the PDF. Single-page PDFs never get separators, since there is nothing to separate.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The PDF to Text tool accepts files up to 50MB, with no limit on the number of pages. For text extraction specifically, this limit is generous — text is compact, and even very long documents rarely approach it.
                </p>
                <p>
                  <strong>What 50MB Means in Practice</strong><br />
                  Text-heavy PDFs are small: a 300-page novel exported to PDF is typically just a few megabytes. Files approach 50MB mainly when they contain many high-resolution images or scans — and image-heavy scans usually need OCR rather than text extraction anyway. In other words, almost any PDF with a real text layer will fit comfortably under the limit.
                </p>
                <p>
                  <strong>No Page Limit</strong><br />
                  There is no cap on page count. The extractor works through the document page by page and shows live progress, so a 500-page PDF is perfectly fine — it just takes proportionally longer. The character and word counts update once extraction completes, however long the document.
                </p>
                <p>
                  <strong>Local Processing and Large Files</strong><br />
                  Because extraction happens in your browser, a very large file consumes your device's memory rather than a server's. Modern laptops and phones handle 50MB PDFs without trouble, but on older, memory-constrained devices, very large documents may process slowly. If a file is over the limit, compress it first with the BlendPDF compression tool or split it with the split tool, then extract each part.
                </p>
              </div>
            </section>

            <section id="processing-time" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. How long does text extraction take?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Most PDFs are fully extracted within a few seconds. Because the work happens on your device, the timing story is different from server-based tools — and usually better.
                </p>
                <p>
                  <strong>No Upload, No Queue, No Download</strong><br />
                  Traditional converters spend most of their time on the network: uploading your file, waiting in a processing queue, and downloading the result. In-browser extraction skips all three steps. The moment you select a file, extraction starts, and the result appears directly on the page. For a typical document, the text is ready before a server-based tool would have finished uploading.
                </p>
                <p>
                  <strong>What Determines the Speed</strong><br />
                  Extraction speed depends on your device's processor and the document itself: the number of pages, and how much text and drawing complexity each page contains. Server load is irrelevant — there is no server involved. A modern phone or laptop chews through dozens of pages per second on ordinary documents.
                </p>
                <p>
                  <strong>Live Progress for Long Documents</strong><br />
                  For longer files you'll see a real progress bar with a per-page counter ("Extracting page 42 of 180..."), so you always know how far along the extraction is. This is genuine progress, not an animation — it advances exactly as pages are completed.
                </p>
                <p>
                  <strong>Repeat Runs Are Instant</strong><br />
                  Toggling page separators or copying the text again after extraction requires no re-processing; the text is already in memory and is re-assembled instantly. Only selecting a new file starts a fresh extraction.
                </p>
              </div>
            </section>

            <section id="original-file" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Is my original file modified?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Text extraction is a strictly read-only operation. Your PDF is opened, read, and left completely untouched — nothing is written to it, and nothing about it changes.
                </p>
                <p>
                  <strong>Read-Only by Design</strong><br />
                  The tool loads your PDF into browser memory, reads the text layer of each page, and builds the plain-text output from what it finds. The file on your disk (or in your Google Drive) is never rewritten, re-saved, or altered in any way. There is no failure mode in which extraction could damage the source document.
                </p>
                <p>
                  <strong>Output Is a Separate File</strong><br />
                  When you download, you get a brand-new .txt file named after the original (invoice.pdf produces invoice.txt). The PDF and the text file live side by side; deleting or editing one has no effect on the other. If you only copy to the clipboard, no file is created at all.
                </p>
                <p>
                  <strong>Extract as Often as You Like</strong><br />
                  Because the source is never consumed or changed, you can re-run the extraction any time — for example, once with page separators for citation work and once without for clean prose. Each run reads the same pristine original.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I extract text from password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly. If a PDF requires a password to open, its contents — including the text layer — are encrypted, and the extractor cannot read them. The tool detects this situation and tells you clearly instead of returning empty or garbled output.
                </p>
                <p>
                  <strong>What You'll See</strong><br />
                  When you select an encrypted file, extraction stops and a hint appears explaining that the PDF is password-protected, along with a link to the BlendPDF <a href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</a> tool. No partial or corrupted text is produced.
                </p>
                <p>
                  <strong>The Two-Step Workflow</strong><br />
                  First, open the Unlock PDF tool and remove the password (you'll need to know it — unlocking is for documents you own or are authorized to modify). Then return to PDF to Text and extract from the unlocked copy. Both steps are free and quick, and the extraction step still happens entirely in your browser.
                </p>
                <p>
                  <strong>Why We Don't Ask for Your Password</strong><br />
                  Handling decryption inside the extraction tool would mean asking you to type a document password into a converter — a habit worth avoiding on any website. Keeping unlocking as an explicit, separate step makes the process transparent: you always know exactly which tool did what to your file.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I extract text on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. The PDF to Text tool works on smartphones and tablets, with the same in-browser extraction and the same privacy guarantee: your file never leaves the device, whether that device is a workstation or a phone.
                </p>
                <p>
                  <strong>Touch-Friendly Interface</strong><br />
                  The layout adapts to small screens. You can pick a PDF from your phone's files app, cloud storage, or Google Drive, watch the same per-page progress indicator, and read the extracted text in a scrollable preview. The copy and download buttons are large and easy to tap.
                </p>
                <p>
                  <strong>Copy Straight into Mobile Apps</strong><br />
                  Copying to the clipboard is especially useful on mobile: extract a paragraph from a PDF someone sent you, then paste it directly into WhatsApp, an email, a note, or a translation app — no computer needed. Downloaded .txt files land in your device's downloads folder and open in any text viewer.
                </p>
                <p>
                  <strong>Performance on Phones</strong><br />
                  Since extraction uses your device's processor, a modern phone handles typical documents in seconds. Very large PDFs (hundreds of pages, close to the 50MB limit) will take longer on a phone than on a laptop, and the progress bar keeps you informed either way. One genuine mobile advantage: because nothing is uploaded, extraction doesn't consume mobile data beyond loading the page itself, and it keeps working if your connection drops mid-way.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Is the PDF to text converter free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, completely free — no fees, no watermarks, and no premium tiers today. Extracting text is a basic need, and BlendPDF treats it that way.
                </p>
                <p>
                  <strong>No Payment, No Limits Games</strong><br />
                  There is no credit card form, no trial that expires, and no daily conversion cap designed to push you toward a subscription. You can extract text from as many PDFs as you like, as often as you like. Files up to 50MB and documents of any page count are included.
                </p>
                <p>
                  <strong>No Account Required</strong><br />
                  You don't need to register or sign in. Open the page, select a file, get your text. This makes the tool practical for one-off tasks — extracting a paragraph from a contract, grabbing references from a paper — without the friction of account creation.
                </p>
                <p>
                  <strong>Full Output, No Watermarks</strong><br />
                  The extracted text is yours, complete and unmarked. Some free tools truncate output or stamp branding into results; here the .txt file contains exactly what was extracted, nothing more and nothing less.
                </p>
                <p>
                  <strong>Why Free Is Sustainable Here</strong><br />
                  Because extraction runs in your browser, serving this tool costs BlendPDF almost nothing per use — there are no servers crunching your files. That efficiency is what makes a genuinely free, genuinely unlimited text extractor possible.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What happens to my file after extraction?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Nothing needs to happen to it, because it never went anywhere. The PDF to Text tool does not upload your file, so there is no server copy to delete, no retention window to worry about, and no data-handling policy to take on faith.
                </p>
                <p>
                  <strong>Your PDF Never Leaves Your Device</strong><br />
                  From selection to extraction to download, the file exists only on your device and in your browser's memory. It is not transmitted over the network, not cached by a server, and not visible to BlendPDF or anyone else. This is a stronger guarantee than "we delete files within one hour" — there is simply nothing to delete.
                </p>
                <p>
                  <strong>Memory Is Released When You're Done</strong><br />
                  The in-memory copy your browser uses during extraction is discarded when you close the tab, reload the page, or load a different file. It behaves like any other web page data: temporary, local, and gone when the page is.
                </p>
                <p>
                  <strong>The Extracted Text Is Local Too</strong><br />
                  The text preview, the clipboard copy, and the downloaded .txt file are all produced on your device. The content of your document is never analyzed, indexed, or stored by BlendPDF. If you choose the optional email delivery for the .txt file, only that generated text file is sent for delivery — extraction itself still happens locally, and the direct download option involves no transfer at all.
                </p>
                <p>
                  <strong>Verifiable, Not Just Promised</strong><br />
                  You can confirm this yourself: load the page, switch off your internet connection, and extract a PDF. It works — which is only possible because your file was never being uploaded in the first place.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if extraction fails or the text looks wrong?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Extraction problems almost always trace back to the source PDF rather than to anything you did. Here are the common cases and how to resolve each one.
                </p>
                <p>
                  <strong>"No text was found in this PDF"</strong><br />
                  This means the document has no text layer — it's a scanned or image-only PDF. The fix is OCR: run the file through the BlendPDF <a href="/ocr-pdf" className="text-blue-600 hover:text-blue-800">OCR tool</a> (Arabic, English, and French are supported), then extract text from the OCR'd result. If only some pages come back empty, those specific pages are scans inside an otherwise digital document.
                </p>
                <p>
                  <strong>Password-Protected or Corrupted Files</strong><br />
                  Encrypted PDFs trigger a clear hint pointing to the <a href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</a> tool — unlock first, then extract. If a file fails with a generic read error, verify it opens in a normal PDF viewer; a file that won't open anywhere is corrupted, and re-exporting or re-downloading it from its source usually fixes the problem. Files over 50MB are rejected at selection with a clear message.
                </p>
                <p>
                  <strong>Text Extracted, but Oddly Ordered or Spaced</strong><br />
                  Strange word order usually comes from multi-column layouts, text boxes, or tables — PDFs store text in internal order, which doesn't always match visual reading order. Extra or missing spaces reflect how the source file positioned its characters. These quirks originate in the PDF itself; trying the <a href="/pdf-to-word" className="text-blue-600 hover:text-blue-800">PDF to Word</a> tool can give better structure for complex layouts, since Word output preserves positioning that plain text cannot.
                </p>
                <p>
                  <strong>If Something Unexpected Happens</strong><br />
                  Refresh the page and try again — a fresh page state resolves most one-off glitches. Because processing is local, also make sure your browser is reasonably up to date; the extraction engine relies on modern browser features. If the clipboard copy fails (some browsers restrict clipboard access), select the text in the preview manually and copy it with your keyboard.
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
