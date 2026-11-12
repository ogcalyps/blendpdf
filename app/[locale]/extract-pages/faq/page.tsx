'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function ExtractPagesFAQ() {
  const faqs = [
    {
      question: 'How to extract pages from a PDF online',
      answer: 'Upload your PDF (up to 50MB), type the pages you want using numbers and ranges like "1-3, 5, 8-10", choose a single PDF or one file per page, then click Extract. Everything runs in your browser — the file is never uploaded.'
    },
    {
      question: 'How do I select which pages to extract?',
      answer: 'Type page numbers and ranges separated by commas — for example "1-3, 5, 8-10" selects pages 1, 2, 3, 5, 8, 9, and 10. A live counter below the box shows exactly how many pages are selected, and invalid input is flagged immediately.'
    },
    {
      question: 'Should I choose "Single PDF" or "One file per page (ZIP)"?',
      answer: 'Single PDF puts all selected pages into one new document, in order. One file per page saves each selected page as its own single-page PDF and bundles them into a ZIP that downloads immediately — handy when each page goes to a different recipient.'
    },
    {
      question: 'What order do the extracted pages come in?',
      answer: 'Pages appear in the order your input produces them, with duplicates removed. "1-3, 7" gives pages 1, 2, 3, 7 in sequence. Ranges must run low to high (like 2-6), so extraction follows the document\'s page order within each range.'
    },
    {
      question: 'What\'s the difference between Extract Pages, Split PDF, and Delete Pages?',
      answer: 'Extract Pages keeps the pages you type and builds a new PDF from them. Split PDF divides a document by picking pages visually from thumbnails. Delete Pages is the inverse of extract — remove pages and keep the rest.'
    },
    {
      question: 'Does extracting change my original PDF?',
      answer: 'No. The tool copies the selected pages into a brand-new PDF and leaves your original file completely untouched on your device.'
    },
    {
      question: 'Is my file uploaded to a server?',
      answer: 'No. Extract Pages runs 100% in your browser — the PDF is read and the new files are created locally on your device. Nothing is uploaded, so there\'s nothing to delete server-side.'
    },
    {
      question: 'Does extraction work with Arabic PDFs?',
      answer: 'Yes. Pages are copied as-is, so Arabic text, right-to-left layout, fonts, diacritics, and mixed Arabic-English content are preserved exactly — nothing is re-rendered or re-flowed.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'You can open PDFs up to 50MB with no page count limit. Since processing is local, very large files depend only on your device\'s memory and speed, not on any server.'
    },
    {
      question: 'How fast is page extraction?',
      answer: 'Usually a few seconds. There\'s no upload or download wait because everything happens on your device — speed depends on your hardware and how many pages you extract, not on server load.'
    },
    {
      question: 'Is the quality of extracted pages preserved?',
      answer: 'Yes. Pages are copied directly from the source document — text, images, vector graphics, and fonts are carried over without re-rendering or recompression, so extracted pages are identical in quality to the originals.'
    },
    {
      question: 'Can I extract pages from password-protected PDFs?',
      answer: 'No, encrypted PDFs are detected and rejected with a hint to unlock them first. If you have the password and permission, remove the protection with an unlock tool, then extract from the unlocked copy.'
    },
    {
      question: 'Can I extract pages on mobile devices?',
      answer: 'Yes. The tool works on smartphones and tablets — typing a page range works well on a phone keyboard, and both the single PDF and ZIP outputs download straight to your device.'
    },
    {
      question: 'Is extracting PDF pages free?',
      answer: 'Yes, completely free — no fees, no watermarks, no account, and no premium tiers today. All features, including the ZIP output mode, are available at no charge.'
    },
    {
      question: 'What if extraction fails or my range is invalid?',
      answer: 'Range errors show immediately under the input — use numbers between 1 and the page count, like "1-3, 5, 8-10". For other failures, check the file is a valid PDF under 50MB, unlock encrypted files first, then refresh and retry.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Extract Pages', url: '/extract-pages' },
        { name: 'FAQ', url: '/extract-pages/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Extract Pages from PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-extract" className="text-blue-600 hover:text-blue-800">How to extract pages from a PDF online</a></li>
              <li><a href="#page-ranges" className="text-blue-600 hover:text-blue-800">How do I select which pages to extract?</a></li>
              <li><a href="#output-modes" className="text-blue-600 hover:text-blue-800">Should I choose "Single PDF" or "One file per page (ZIP)"?</a></li>
              <li><a href="#page-order" className="text-blue-600 hover:text-blue-800">What order do the extracted pages come in?</a></li>
              <li><a href="#vs-split" className="text-blue-600 hover:text-blue-800">What's the difference between Extract Pages, Split PDF, and Delete Pages?</a></li>
              <li><a href="#original-file" className="text-blue-600 hover:text-blue-800">Does extracting change my original PDF?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">Is my file uploaded to a server?</a></li>
              <li><a href="#arabic-support" className="text-blue-600 hover:text-blue-800">Does extraction work with Arabic PDFs?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#processing-speed" className="text-blue-600 hover:text-blue-800">How fast is page extraction?</a></li>
              <li><a href="#preserve-quality" className="text-blue-600 hover:text-blue-800">Is the quality of extracted pages preserved?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I extract pages from password-protected PDFs?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I extract pages on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is extracting PDF pages free?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if extraction fails or my range is invalid?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-extract" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to extract pages from a PDF online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Extracting pages with BlendPDF takes four quick steps, and the whole process happens locally in your browser. Here's the full workflow:
                </p>
                <p>
                  <strong>Open Your PDF</strong><br />
                  Click "Select PDF" or drag and drop your file onto the upload area — files up to 50MB are accepted. The document is read directly in your browser: the tool shows the filename, page count, and file size immediately, without sending anything over the network.
                </p>
                <p>
                  <strong>Type the Pages You Want</strong><br />
                  In the "Pages to extract" box, enter page numbers and ranges separated by commas — for example, "1-3, 5, 8-10". As you type, a live counter shows exactly how many pages are currently selected out of the total (for instance, "7 pages selected of 24"), and invalid entries are flagged instantly with a helpful message. This live feedback means you always know precisely what you're about to extract before committing.
                </p>
                <p>
                  <strong>Pick an Output Mode</strong><br />
                  Choose between "Single PDF" (all selected pages combined into one new document, in order) and "One file per page (ZIP)" (each selected page saved as its own single-page PDF, bundled into a ZIP archive). The right choice depends on whether the pages belong together or need to be distributed separately — more on this in the output modes section below.
                </p>
                <p>
                  <strong>Extract and Download</strong><br />
                  Click the extract button — it even tells you how many pages it's about to extract. The new file is generated on your device in seconds. In single-PDF mode the result is named "extracted-" plus your original filename; in ZIP mode the archive downloads immediately with each page named after the original file and its page number (like "report-page-5.pdf").
                </p>
              </div>
            </section>

            <section id="page-ranges" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. How do I select which pages to extract?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Page selection uses a simple text syntax that will feel familiar from print dialogs: numbers and ranges separated by commas. It's compact, precise, and much faster than clicking through thumbnails for long documents.
                </p>
                <p>
                  <strong>The Syntax</strong><br />
                  Individual pages are plain numbers ("5"), consecutive runs are ranges with a hyphen ("8-10"), and you combine any mix of them with commas. So "1-3, 5, 8-10" selects pages 1, 2, 3, 5, 8, 9, and 10 — seven pages total. Spaces around commas are optional; "1-3,5,8-10" works just as well. Every number must be between 1 and the document's page count, and a range must run from low to high (write "2-6", not "6-2").
                </p>
                <p>
                  <strong>Live Validation</strong><br />
                  The input is parsed as you type. The counter under the box always shows the current selection size ("3 pages selected of 12"), so you can sanity-check your range math at a glance. If something's wrong — a page number beyond the document's length, a backwards range, a stray character — an inline error appears immediately with an example of valid input, and the extract button stays disabled until the range is fixed. You can never accidentally extract the wrong thing because of a silent parsing error.
                </p>
                <p>
                  <strong>Duplicates Are Handled</strong><br />
                  If your input mentions the same page twice — say "1-5, 3" — the page is only included once. The counter reflects the deduplicated total, so what it says is exactly what you get.
                </p>
                <p>
                  <strong>Practical Examples</strong><br />
                  Pull just the executive summary: "1-2". Grab a chapter: "12-28". Collect scattered references: "4, 17, 31, 56". Extract everything except the cover by typing "2-" plus the last page number (for a 40-page file, "2-40"). For very complex selections, it's often easiest to build the range up piece by piece while watching the live counter.
                </p>
              </div>
            </section>

            <section id="output-modes" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Should I choose "Single PDF" or "One file per page (ZIP)"?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Extract Pages offers two output modes, and picking the right one saves you a follow-up step. The question to ask is: do the extracted pages belong together, or does each page have its own destination?
                </p>
                <p>
                  <strong>Single PDF Mode</strong><br />
                  This is the default. All selected pages are copied into one new document, in order, and downloaded as a single file named "extracted-" plus your original filename. Choose this when the pages form a coherent unit — a chapter you're sharing, the relevant section of a contract, the three pages of a form someone actually needs to fill in.
                </p>
                <p>
                  <strong>One File Per Page (ZIP) Mode</strong><br />
                  Here, every selected page becomes its own standalone single-page PDF, and all of them are bundled into a ZIP archive named "extracted-" plus your document's name. Inside, files are named clearly by source page — "invoices-page-3.pdf", "invoices-page-7.pdf" — so you always know which page is which. The ZIP downloads immediately when extraction finishes.
                </p>
                <p>
                  <strong>When Per-Page Files Shine</strong><br />
                  The ZIP mode is built for distribution scenarios: a batch of invoices scanned into one PDF where each invoice goes to a different client; a stack of certificates where each recipient gets their own page; slide handouts split for individual upload; HR documents filed per employee. Instead of extracting one page at a time, you type one range and get every page as its own ready-to-send file.
                </p>
                <p>
                  <strong>You Can Do Both</strong><br />
                  Since extraction is instant and your original file never changes, there's no cost to running the tool twice — once in each mode — if you need both a combined document and individual pages from the same selection.
                </p>
              </div>
            </section>

            <section id="page-order" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. What order do the extracted pages come in?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The extracted PDF contains your pages in the order your input produces them, which for typical range input matches the document's own page order.
                </p>
                <p>
                  <strong>Order Follows Your Input</strong><br />
                  The selection is processed left to right through your comma-separated list, expanding each range as it goes. "1-3, 7" yields pages 1, 2, 3, 7 in that sequence. Because ranges must be written low-to-high, pages within a range always follow the document's natural order.
                </p>
                <p>
                  <strong>Duplicates Don't Repeat</strong><br />
                  Each page appears at most once in the output, at the position where your input first mentions it. Writing "1-5, 3" produces pages 1 through 5 — the second mention of page 3 is ignored rather than duplicated. If you need genuine duplication of a page, extract it separately and merge the results with a merge tool.
                </p>
                <p>
                  <strong>ZIP Mode Naming Keeps Things Clear</strong><br />
                  In "One file per page" mode, the question of order matters less because every page is a separate file named after its original page number ("contract-page-12.pdf"). Whatever order your file manager sorts them in, the source page is always visible in the name.
                </p>
                <p>
                  <strong>Reordering After Extraction</strong><br />
                  If you need the pages in a custom order different from the document's sequence, the reliable approach is to extract what you need and then reorder in a dedicated organize/merge tool, which gives you drag-and-drop control over the final arrangement.
                </p>
              </div>
            </section>

            <section id="vs-split" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. What's the difference between Extract Pages, Split PDF, and Delete Pages?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF has three closely related tools for slicing documents, each optimized for a different way of thinking about the task. Picking the right one makes the job faster.
                </p>
                <p>
                  <strong>Extract Pages: Type What You Keep</strong><br />
                  This tool is built around typed precision. You know exactly which pages you want — "1-3, 5, 8-10" — and you get them as one new PDF or as per-page files in a ZIP. It's the fastest option for long documents where scrolling through thumbnails would be tedious, and the only one with the one-file-per-page output mode.
                </p>
                <p>
                  <strong>Split PDF: Pick Visually</strong><br />
                  Split PDF is built around thumbnails: you see every page rendered and click to choose where the document divides. It's the better fit when you'd recognize the right pages by sight but don't know their numbers offhand — scanned bundles, mixed documents, anything where visual confirmation matters.
                </p>
                <p>
                  <strong>Delete Pages: Remove What You Don't Want</strong><br />
                  Delete Pages is the inverse operation. Instead of naming the pages to keep, you name the pages to remove and keep everything else. When your selection is "everything except pages 4 and 9", deleting two pages is far quicker than typing the ranges for the other thirty-eight.
                </p>
                <p>
                  <strong>A Simple Rule of Thumb</strong><br />
                  Keeping a few known pages? Extract. Choosing by eye or dividing a document into parts? Split. Dropping a few pages and keeping the rest? Delete. All three produce new files and leave your original untouched, so choosing "wrong" only costs you a minute.
                </p>
              </div>
            </section>

            <section id="original-file" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Does extracting change my original PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Extraction is a copy operation, not a cut operation. Your source document remains byte-for-byte identical after extracting from it.
                </p>
                <p>
                  <strong>Copies, Not Moves</strong><br />
                  When you extract pages, the tool creates a brand-new PDF and copies your selected pages into it. The original document keeps all of its pages — including the ones you extracted. Nothing is removed, reordered, or resaved in the source file. If you want the source to lose those pages, that's a different operation (see Delete Pages).
                </p>
                <p>
                  <strong>The Browser Guarantees It</strong><br />
                  Beyond the tool's design, there's a structural safeguard: web applications can't modify files on your disk. The tool reads your selected file into memory, works entirely on that in-memory copy, and hands you the result as a fresh download. Overwriting your original isn't just something the tool avoids — it's something it cannot do.
                </p>
                <p>
                  <strong>Freedom to Iterate</strong><br />
                  Because the source never changes, you can extract repeatedly from the same document with different ranges and modes: pages 1-5 as a single PDF for one purpose, pages 10-20 as per-page files for another. Each run produces an independent new file, and the "extracted-" prefix on output names keeps them clearly distinguished from your original.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Is my file uploaded to a server?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Extract Pages runs 100% in your browser. Your PDF never leaves your device — not during upload, not during extraction, not for the download.
                </p>
                <p>
                  <strong>Everything Happens Locally</strong><br />
                  When you pick a file, it is read directly into your browser's memory. Parsing the document, counting pages, copying your selected pages into a new PDF, and even building the ZIP archive in per-page mode — all of it is done by JavaScript running on your own device. No part of your document is transmitted over the network at any point.
                </p>
                <p>
                  <strong>No Server Copy Exists</strong><br />
                  Conventional online tools upload your file, process it remotely, and promise to delete it afterwards. This tool makes that promise unnecessary: there is nothing to delete server-side because nothing was ever uploaded. Your document's contents can't be stored, logged, scanned, or breached on our infrastructure, because they never touch it.
                </p>
                <p>
                  <strong>Suited to Confidential Documents</strong><br />
                  This matters most for exactly the documents people extract pages from: contracts, financial statements, medical records, legal filings. Extracting three pages of a confidential agreement to share with one party doesn't require trusting a third-party server with the whole agreement — the whole operation stays on your machine, like desktop software.
                </p>
                <p>
                  <strong>See For Yourself</strong><br />
                  If you're technically inclined, open your browser's developer tools and watch the network tab during an extraction: you'll see no request carrying your document. This local-first design is also why the tool feels instant — there's no upload or download wait at all.
                </p>
              </div>
            </section>

            <section id="arabic-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Does extraction work with Arabic PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, flawlessly. BlendPDF is built Arabic-first, and page extraction is inherently safe for Arabic and all right-to-left (RTL) content.
                </p>
                <p>
                  <strong>Pages Are Copied As-Is</strong><br />
                  Extraction copies entire pages — content streams, embedded fonts, images, and layout — directly from the source document into the new one. Nothing is re-rendered, re-flowed, or re-encoded. Arabic letterforms, ligatures, contextual character shaping, diacritics (tashkeel), and right-to-left reading order are all part of the page content being copied, so they arrive in the extracted file exactly as they were in the original.
                </p>
                <p>
                  <strong>Embedded Fonts Travel With the Pages</strong><br />
                  Arabic documents depend heavily on their embedded fonts for correct rendering. Because extraction carries the fonts used by the copied pages into the new file, extracted Arabic pages display identically on any device — even ones without Arabic fonts installed.
                </p>
                <p>
                  <strong>Mixed and Bilingual Documents</strong><br />
                  Arabic-English bilingual contracts, reports with Arabic body text and Latin numerals, documents combining RTL and LTR sections — all extract cleanly, since the tool makes no assumptions about language or direction. Page numbering in your range input always refers to physical page positions (1 is the first page in the file), regardless of the document's reading direction.
                </p>
                <p>
                  <strong>An RTL Interface Too</strong><br />
                  The BlendPDF interface itself is fully localized in Arabic with a proper right-to-left layout, and the page-range input is handled carefully so typing ranges like "1-3, 5" behaves predictably in the RTL interface as well.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Extract Pages accepts PDF files up to 50MB, with no restriction on page count or on how many pages you extract.
                </p>
                <p>
                  <strong>What Fits in 50MB</strong><br />
                  Text-heavy documents run small — hundreds of pages typically stay under 5MB — while scanned documents and image-rich reports are larger. Most real-world files fit comfortably. The limit exists because the whole document is processed in your browser's memory, and 50MB keeps that experience reliable across devices.
                </p>
                <p>
                  <strong>No Page or Selection Limits</strong><br />
                  There's no cap on the number of pages in the source document, and no cap on how many pages you select. Extracting 200 pages from a 500-page file works. In "one file per page" mode, note that many selected pages means many files in the ZIP — the tool handles it, but your selection size directly determines the archive's contents.
                </p>
                <p>
                  <strong>Output Size Depends on Content</strong><br />
                  The extracted file's size reflects what's on the pages you selected. Extracting 5 text pages from a 40MB scanned document yields a small file; extracting the 5 pages that carry the document's high-resolution images yields most of the original's weight. Shared resources like fonts are carried into the new file, so a one-page extract can be a bit larger than one-fortieth of a forty-page original.
                </p>
                <p>
                  <strong>Over the Limit?</strong><br />
                  For files above 50MB, compress the PDF first and extract from the compressed copy, or split the document into parts and extract from the relevant part. Since extraction preserves page content exactly, compressing first only affects quality to the degree the compression itself does.
                </p>
              </div>
            </section>

            <section id="processing-speed" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. How fast is page extraction?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Extraction typically completes in a few seconds — often faster than the file would have taken just to upload to a conventional server-based tool.
                </p>
                <p>
                  <strong>Zero Network Overhead</strong><br />
                  Because processing is entirely local, the usual bottlenecks of online tools — uploading your file, waiting in a server queue, downloading the result — simply don't exist. The moment you click extract, your device starts copying pages; the download begins as soon as the new file is assembled in memory.
                </p>
                <p>
                  <strong>Your Device Sets the Pace</strong><br />
                  Speed scales with your own hardware, not with how many other people are using the service. A modern laptop extracts dozens of pages from a large document almost instantly; older phones take a little longer on big files. There is never a "server busy" slowdown, because there is no shared server doing the work.
                </p>
                <p>
                  <strong>Mode and Selection Size Matter Slightly</strong><br />
                  Single-PDF mode does one copy pass and one save. Per-page ZIP mode creates a separate PDF for every selected page and then compresses them into an archive, so selecting many pages in ZIP mode is the slowest path — though "slow" here still usually means seconds. Page content matters too: image-heavy pages carry more data to copy than text pages.
                </p>
              </div>
            </section>

            <section id="preserve-quality" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Is the quality of extracted pages preserved?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, completely. Extraction is a lossless operation — the pages in your new PDF are exact copies of the pages in the source document.
                </p>
                <p>
                  <strong>Direct Page Copying</strong><br />
                  The tool copies pages at the PDF object level: content streams, images, vector graphics, fonts, and page dimensions move into the new document unchanged. There is no rendering to an image and back, no recompression of pictures, and no re-flowing of text. If a page had a 300-DPI scan on it, the extracted page has the same 300-DPI scan.
                </p>
                <p>
                  <strong>Formatting and Layout Intact</strong><br />
                  Margins, column layouts, headers and footers, tables, colors, and embedded fonts all come along with each page. An extracted page prints and displays exactly like the same page viewed in the original document — because it is the same page data.
                </p>
                <p>
                  <strong>What Doesn't Carry Over</strong><br />
                  Document-level extras that live outside the pages — bookmarks and the document outline, document metadata, or form/link behavior that depends on document-wide structures — may not be reproduced in the new file, since only the selected pages themselves are copied. For most extraction jobs (sharing content, filing, distribution) this is irrelevant, but it's worth knowing if your workflow depends on bookmarks.
                </p>
                <p>
                  <strong>Identical in Both Output Modes</strong><br />
                  Quality is the same whether you choose a single combined PDF or per-page files in a ZIP — both modes use the same lossless page-copy mechanism.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I extract pages from password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly. When you open an encrypted PDF, the tool detects the protection and shows a clear message with a link to the unlock tool instead of attempting a broken extraction.
                </p>
                <p>
                  <strong>Why Encryption Blocks Extraction</strong><br />
                  Extracting a page means reading and copying its full content — exactly what PDF encryption is designed to prevent without authorization. Rather than producing unreadable output or failing cryptically, BlendPDF checks for encryption as soon as the file is opened and tells you plainly what's needed.
                </p>
                <p>
                  <strong>Unlock First, Then Extract</strong><br />
                  If the document is yours or you're authorized to modify it, remove the password with a PDF unlock tool, then run the extraction on the unlocked copy — everything works normally from there. If the extracted pages are sensitive, you can re-protect the new file with a password afterwards. As always, only unlock documents you have the right to modify.
                </p>
                <p>
                  <strong>Both Kinds of Protection Count</strong><br />
                  PDFs can carry an open password (needed to view) or an owner password (restricting editing and copying). The tool declines to process encrypted files in either case, keeping its behavior consistent and respectful of the document author's protection choices.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Can I extract pages on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Extract Pages works on smartphones and tablets, and its typed-range interface actually suits small screens particularly well.
                </p>
                <p>
                  <strong>A Mobile-Friendly Interaction Model</strong><br />
                  On a phone, scrolling through dozens of page thumbnails to tap-select pages is fiddly. Typing "1-3, 5, 8-10" into a single text box is not. The number-and-dash syntax is quick on a mobile keyboard, and the live counter confirms your selection instantly, so the extraction workflow stays fast even on a small display.
                </p>
                <p>
                  <strong>Files From Anywhere</strong><br />
                  You can open PDFs from your phone's local storage, downloads, or the Files app. Extracted results save through your browser's normal download flow, after which you can share them by email, chat, or any app on your device.
                </p>
                <p>
                  <strong>ZIP Mode on Mobile</strong><br />
                  The "one file per page" ZIP output downloads on mobile like any other file. Both Android and iOS can open ZIP archives natively (via the Files apps), so you can inspect and share the individual page PDFs without extra software.
                </p>
                <p>
                  <strong>On-Device Performance</strong><br />
                  Processing happens on your phone, so speed depends on its hardware. Typical documents extract in seconds on any recent device; very large files near the 50MB limit may take longer on older phones. Battery and data usage are minimal — remember, nothing is uploaded.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. Is extracting PDF pages free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, extracting pages with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today.
                </p>
                <p>
                  <strong>No Payment, Ever, For Any Feature</strong><br />
                  Both output modes — single PDF and one-file-per-page ZIP — are included, along with unlimited extractions, files up to 50MB, and full Arabic/RTL support. There's no daily quota to hit, no locked "pro" mode, and no watermark stamped on your output pages.
                </p>
                <p>
                  <strong>No Account Needed</strong><br />
                  You can extract pages without registering, signing in, or providing personal details. Open the tool, pick a file, type a range, download — the entire flow is anonymous and immediate.
                </p>
                <p>
                  <strong>Why It Can Stay Free</strong><br />
                  Because extraction runs in your browser, we don't pay for servers to process your files — your device does the work. That client-side architecture keeps our costs near zero for this tool, which is exactly what makes a genuinely free, genuinely unlimited offering sustainable.
                </p>
                <p>
                  <strong>Free and Private Are the Same Feature Here</strong><br />
                  The same design that makes the tool free is what makes it private: no server processing means no server costs and no server copies of your documents. You're not paying with money, and you're not paying with your data either.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if extraction fails or my range is invalid?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Most problems announce themselves clearly in the interface. Here's how to read and fix the common ones:
                </p>
                <p>
                  <strong>"Invalid page range"</strong><br />
                  This message appears under the input the moment your range can't be parsed. Check the classic culprits: a page number larger than the document's page count, a backwards range like "9-3" (write "3-9"), a zero or negative number, or stray characters. Use only digits, hyphens, and commas — for example "1-3, 5, 8-10" — with every number between 1 and the page count shown in the message. The extract button re-enables as soon as the input is valid.
                </p>
                <p>
                  <strong>The File Won't Open</strong><br />
                  If the tool reports it couldn't read the PDF, verify the file is under 50MB and opens in a regular PDF viewer. Files that were renamed to .pdf, truncated downloads, or corrupted documents will fail to parse. Re-saving the file from a PDF viewer often repairs minor structural issues.
                </p>
                <p>
                  <strong>Password-Protected PDFs</strong><br />
                  Encrypted files are rejected with a specific message and a link to the unlock tool. Unlock first (with permission), then extract from the unlocked copy — see the section above for details.
                </p>
                <p>
                  <strong>Everything Looks Right But It Still Fails</strong><br />
                  Since processing is local, an overloaded browser tab or low device memory can occasionally cause failures on large files. Close other heavy tabs, refresh the page, and retry. Make sure your browser is up to date — the tool relies on modern browser APIs. If one particular file consistently fails while others work, that file likely has unusual internal structure; re-exporting it from any PDF application usually normalizes it.
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
