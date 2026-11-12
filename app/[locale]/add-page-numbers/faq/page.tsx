'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function AddPageNumbersFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How does adding page numbers to a PDF work?',
      answer: 'BlendPDF draws the page number directly into the content of each page in clean black Helvetica, about 20 points in from the edge at the corner or center position you choose. The numbers become a permanent part of the PDF, so they appear in every viewer and in print.'
    },
    {
      question: 'How do I add page numbers to a PDF online?',
      answer: 'Upload your PDF (up to 50MB), pick one of six positions, choose a number format, set the starting number and font size, then click Add Page Numbers and download the numbered copy. The live preview shows the placement before you commit. No account or email is required.'
    },
    {
      question: 'Is adding page numbers free? Is there a watermark?',
      answer: 'Yes, completely free. No watermark is added, there are no page limits or daily quotas, no premium tier, and no sign-up. The output is your document with page numbers and nothing else.'
    },
    {
      question: 'Where can I place the page numbers?',
      answer: 'Six positions: top-left, top-center, top-right, bottom-left, bottom-center, and bottom-right. Bottom-center is the default and the most common convention. The same position is used on every page.'
    },
    {
      question: 'What page number formats are available, and can I change the size?',
      answer: 'Four formats: plain numbers (1, 2, 3), number with total (1 / 10), "Page 1", and "Page 1 of 10". Font size is adjustable from 8 to 36 points (12 is the default). Numbers render in black Helvetica.'
    },
    {
      question: 'Can I start numbering from a number other than 1?',
      answer: 'Yes. Set "Start From" to any number — useful when a document continues from another file, for example numbering a second volume starting at 151. Note that in the "of N" formats, N is always the real page count of the uploaded file, so combine a custom start with the plain or "Page 1" formats for cleaner results.'
    },
    {
      question: 'Can I skip the cover page or number only some pages?',
      answer: 'Not directly — numbers are applied to every page. Workaround: use the Split PDF tool to separate the cover from the body, add numbers to the body (starting at whatever value you need), then merge the parts back together with the Merge PDF tool.'
    },
    {
      question: 'What if my PDF already has page numbers?',
      answer: 'The tool does not detect or remove existing numbering — it draws new numbers on top. If your document already has numbers at bottom-center, either place the new ones in a different position, such as a top corner, or remove the old numbering at the source and re-export before numbering.'
    },
    {
      question: 'Can I use Arabic-Indic numerals or Arabic text in page numbers?',
      answer: 'Not yet. Page numbers currently use Western digits (1, 2, 3) and English labels ("Page") in Latin script only. Arabic text support is coming. PDFs whose content is in Arabic number fine — the limitation applies only to the added label, not to your document.'
    },
    {
      question: 'Is it safe to upload my document?',
      answer: 'Yes. Files travel over an encrypted HTTPS connection and are deleted from our servers within one hour, most immediately after processing. We never read, store, or share document contents, and no account is needed. We only measure usage as anonymous totals, through Google Analytics and our own count of tool runs, never your documents.'
    },
    {
      question: 'Can I add page numbers to a password-protected PDF?',
      answer: 'No. The tool detects encrypted PDFs and returns a clear error. Remove the password first with the Unlock PDF tool (you need to know the password), add the numbers, then re-protect the file with the Protect PDF tool if needed.'
    },
    {
      question: 'Does it work on scanned PDFs?',
      answer: 'Yes. The number is drawn on top of each page, and a scanned page is just an image, so numbering works exactly as it does for regular PDFs. No OCR is involved or needed — though note BlendPDF has no OCR feature yet, so scanned text stays unsearchable either way.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'One PDF per operation, up to 50MB, and up to 20 files per 15 minutes per user. There is no page-count limit. If your file is over 50MB, compress it first with the Compress PDF tool.'
    },
    {
      question: 'How does this compare to adding page numbers in Word or Adobe Acrobat?',
      answer: 'Word numbers documents it edits, but converting an existing PDF into Word often breaks the layout. Acrobat Pro has a flexible header/footer tool but requires a paid subscription. BlendPDF numbers any existing PDF without altering its layout, free, in the browser, with no account.'
    },
    {
      question: 'What should I do if I get an error?',
      answer: 'Check that the file is a valid PDF under 50MB and not password-protected (unlock it first if it is). A "too many requests" message means you hit the 20-files-per-15-minutes limit — wait a few minutes. If a valid file still fails, it may be corrupted; run it through the Repair PDF tool first.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Add Page Numbers', url: '/add-page-numbers' },
        { name: 'FAQ', url: '/add-page-numbers/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Add Page Numbers
          </h1>
          <p className="mb-8">
            <Link href="/add-page-numbers" className="text-blue-600 hover:text-blue-800">
              &larr; Back to the Add Page Numbers tool
            </Link>
          </p>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-it-works" className="text-blue-600 hover:text-blue-800">How does adding page numbers to a PDF work?</a></li>
              <li><a href="#how-to-add" className="text-blue-600 hover:text-blue-800">How do I add page numbers to a PDF online?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is adding page numbers free? Is there a watermark?</a></li>
              <li><a href="#positions" className="text-blue-600 hover:text-blue-800">Where can I place the page numbers?</a></li>
              <li><a href="#formats-and-size" className="text-blue-600 hover:text-blue-800">What page number formats are available, and can I change the size?</a></li>
              <li><a href="#start-from" className="text-blue-600 hover:text-blue-800">Can I start numbering from a number other than 1?</a></li>
              <li><a href="#skip-pages" className="text-blue-600 hover:text-blue-800">Can I skip the cover page or number only some pages?</a></li>
              <li><a href="#existing-numbers" className="text-blue-600 hover:text-blue-800">What if my PDF already has page numbers?</a></li>
              <li><a href="#arabic-numerals" className="text-blue-600 hover:text-blue-800">Can I use Arabic-Indic numerals or Arabic text in page numbers?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to upload my document?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I add page numbers to a password-protected PDF?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Does it work on scanned PDFs?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#comparison" className="text-blue-600 hover:text-blue-800">How does this compare to Word or Adobe Acrobat?</a></li>
              <li><a href="#troubleshooting" className="text-blue-600 hover:text-blue-800">What should I do if I get an error?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-it-works" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How does adding page numbers to a PDF work?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF draws each page's number directly into the page content — the same way a word processor prints a footer — so the numbers become a permanent, visible part of the document.
                </p>
                <p>
                  <strong>What Exactly Gets Added</strong><br />
                  The number is rendered in black Helvetica at the size you choose, placed about 20 points (roughly 7mm) in from the page edge at your chosen position. Centered positions are measured against the actual width of the number text, so "Page 12 of 240" lands as precisely centered as a bare "3". Because the text is drawn into the PDF rather than attached as an annotation, it displays identically in every viewer, prints correctly, and cannot be accidentally hidden or shifted.
                </p>
                <p>
                  <strong>Your Content Is Not Re-Rendered</strong><br />
                  The tool adds the numbers on top of your existing pages without converting, re-compressing, or reflowing anything. Text stays selectable, images keep their quality, links keep working, and the file size barely changes. Mixed page sizes are handled per page — the margin is measured from each page's own edges, so a document mixing letter and A3 pages gets consistent placement on both.
                </p>
                <p>
                  <strong>The Output</strong><br />
                  You download a new copy named after your original with "_numbered" appended. The original file on your device is never modified, so if you picked the wrong corner you can simply run the original again with different settings.
                </p>
              </div>
            </section>

            <section id="how-to-add" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. How do I add page numbers to a PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Four quick steps, about a minute end to end:
                </p>
                <p>
                  <strong>Step 1: Upload Your PDF</strong><br />
                  Drag your file onto the upload area or click to browse. You can also pick a file from Google Drive. One file at a time, up to 50MB.
                </p>
                <p>
                  <strong>Step 2: Pick a Position</strong><br />
                  Choose one of six placements — top or bottom, aligned left, center, or right. Bottom-center is the default and matches what most readers expect. The preview pane shows the number over your actual first page, so you can see immediately whether the position clashes with anything already printed there.
                </p>
                <p>
                  <strong>Step 3: Choose Format, Start Number, and Size</strong><br />
                  Pick a format — 1, or 1 / 10, or Page 1, or Page 1 of 10 — then set the starting number (1 unless the document continues from another file) and the font size (8 to 36 points; the default 12pt reads like a standard book footer).
                </p>
                <p>
                  <strong>Step 4: Apply and Download</strong><br />
                  Click Add Page Numbers and download the numbered copy. No account or email address is required to download; an optional email-delivery feature exists if you would rather have the file sent to your inbox.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Is adding page numbers free? Is there a watermark?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, it is completely free, and no watermark or branding of any kind is added.
                </p>
                <p>
                  <strong>What "Free" Means Here</strong><br />
                  No trial that expires, no daily task quota, no premium tier holding back features, no file size teaser designed to upsell you. Every option on the page — all six positions, all four formats, custom start numbers, the full size range — is available to everyone at no cost.
                </p>
                <p>
                  <strong>Nothing Added Except the Numbers</strong><br />
                  Several "free" PDF sites stamp their logo on your output unless you pay. BlendPDF does not: the downloaded file is your document plus the page numbers you configured, and nothing else. This matters when the document is going somewhere professional — a court filing, a thesis, a client deliverable — where a tool's advertising in the footer would be embarrassing.
                </p>
                <p>
                  <strong>No Sign-Up</strong><br />
                  No account, no email required, no personal information collected. Visit the page, upload, number, download.
                </p>
              </div>
            </section>

            <section id="positions" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Where can I place the page numbers?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Six positions are available: top-left, top-center, top-right, bottom-left, bottom-center, and bottom-right. The same position is applied to every page.
                </p>
                <p>
                  <strong>Choosing a Position</strong><br />
                  Bottom-center is the overwhelming convention for reports, books, and academic documents, and it is the default. Bottom-right suits business documents and letters. Top positions are useful when the bottom of your pages is already occupied — footers, signature lines, or existing numbering (see question 8).
                </p>
                <p>
                  <strong>Margins</strong><br />
                  Numbers sit about 20 points from the page edges — comfortably inside the printable area of every standard printer, so numbers will not be clipped when the document is printed. The margin is fixed rather than configurable, chosen to look right across letter, A4, and larger page sizes.
                </p>
                <p>
                  <strong>No Alternating Positions Yet</strong><br />
                  There is currently no mirrored or alternating option (outside edge on odd pages, inside edge on even pages) as used in bound books. If you are preparing a print-bound document with mirrored margins, Adobe Acrobat's header/footer tool handles that case; for everything else, a single consistent position is what readers expect.
                </p>
              </div>
            </section>

            <section id="formats-and-size" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. What page number formats are available, and can I change the size?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Four formats cover the standard conventions, and the size is adjustable to match your document's typography.
                </p>
                <p>
                  <strong>The Four Formats</strong><br />
                  Plain numbers (1, 2, 3) are the minimal, classic choice. Number with total (1 / 10) tells readers how much document remains — useful for handouts. "Page 1" is the formal label style. "Page 1 of 10" is the most explicit and is common for contracts and legal documents, where "of N" makes missing pages detectable.
                </p>
                <p>
                  <strong>Font and Size</strong><br />
                  Numbers render in Helvetica, black, at any size from 8 to 36 points. The default 12pt reads like a normal book footer. Go smaller (8-10pt) for dense professional documents, larger (18pt+) for presentation decks or documents that will be read at a distance. The live preview reflects your size choice before you commit.
                </p>
                <p>
                  <strong>Styling Limits, Stated Plainly</strong><br />
                  There is currently no choice of font family or color, no bold or italic, and no custom prefix text (like "Section A - Page 1"). The output is deliberately the standard, neutral page number that suits the vast majority of documents. If you need decorative or branded numbering, a desktop editor is the better tool for that job.
                </p>
              </div>
            </section>

            <section id="start-from" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Can I start numbering from a number other than 1?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — the "Start From" field accepts any starting number, and it exists precisely for multi-file documents.
                </p>
                <p>
                  <strong>When a Custom Start Helps</strong><br />
                  The classic case is a document split across files: volume one ends at page 150, so volume two starts at 151. It also helps when a separately produced section — appendices, exhibits, a translated half — must continue an existing sequence, or when the first file's front matter means the body of the second file should begin at, say, page 7.
                </p>
                <p>
                  <strong>How It Works</strong><br />
                  Set "Start From" to your chosen value and the first page gets that number, with every following page incrementing by one. Starting at 151, a 40-page file is numbered 151 through 190.
                </p>
                <p>
                  <strong>One Honest Caveat About "of N" Formats</strong><br />
                  In the "1 / 10" and "Page 1 of 10" formats, the total N is always the actual number of pages in the uploaded file — it is not adjusted for your starting number. Start a 10-page file at 151 and the labels read "Page 151 of 10," which is not what you want. When using a custom start, pair it with the plain number or "Page 1" format, or number the combined document in one pass instead: merge the files first with the <Link href="/merge-pdf" className="text-blue-600 hover:text-blue-800">Merge PDF</Link> tool, then add numbers to the merged file so both the sequence and the total come out right.
                </p>
              </div>
            </section>

            <section id="skip-pages" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Can I skip the cover page or number only some pages?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not in a single step — the tool numbers every page of the file it is given. But the common cases have a clean workaround using BlendPDF's other free tools.
                </p>
                <p>
                  <strong>The Workaround: Split, Number, Merge</strong><br />
                  Use <Link href="/split-pdf" className="text-blue-600 hover:text-blue-800">Split PDF</Link> to separate the pages that should stay unnumbered (the cover, a title section) from the body. Run the body through Add Page Numbers — and here the "Start From" option earns its keep: if the cover is one page and you want the body to begin at 2, start from 2; if you want the body to begin at 1, start from 1. Then reassemble the document with <Link href="/merge-pdf" className="text-blue-600 hover:text-blue-800">Merge PDF</Link>. Three steps, each a few seconds, all free.
                </p>
                <p>
                  <strong>A Caveat for "of N" Formats</strong><br />
                  With the split-number-merge approach, an "of N" total reflects only the numbered portion (the body), not the full reassembled document. That is often exactly right — "Page 1 of 12" counting only content pages — but check that it matches your intent.
                </p>
                <p>
                  <strong>Roman Numerals for Front Matter</strong><br />
                  The traditional book convention — i, ii, iii for front matter, then 1, 2, 3 for the body — is not supported; the tool produces Western digits only. If your style guide requires roman-numeral front matter, number the body with BlendPDF and handle the front matter in the source application.
                </p>
              </div>
            </section>

            <section id="existing-numbers" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. What if my PDF already has page numbers?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Be aware of this before you click: the tool does not detect, remove, or replace existing page numbers. It draws new numbers at the position you chose, on top of whatever is already printed there.
                </p>
                <p>
                  <strong>What Happens If They Collide</strong><br />
                  If your document already has numbers at bottom-center and you add new ones at bottom-center, the two will overprint each other — legible to no one. Nothing is corrupted, but the result looks wrong and there is no undo on the output file (your original, of course, is untouched).
                </p>
                <p>
                  <strong>The Practical Fixes</strong><br />
                  Option one: place the new numbers somewhere else. Existing numbering is usually at the bottom, so a top corner keeps the two sets apart — readers quickly adopt whichever is more prominent. Option two, and the cleaner result: remove the old numbering at the source (delete the footer in Word, LibreOffice, or whatever produced the PDF), re-export, and then number the clean file with BlendPDF. Option three, when renumbering a scanned or source-less document: if the old numbers sit in a margin, some users crop or cover them with a desktop editor first — more effort, but sometimes the only path for legacy scans.
                </p>
                <p>
                  <strong>Why We Do Not Auto-Remove</strong><br />
                  Existing numbers are baked into the page content, indistinguishable in general from any other text. Reliably deleting them without damaging nearby content is an editing problem, not an overlay problem, and tools that promise it silently fail on edge cases. We would rather tell you the honest constraint and give you working alternatives.
                </p>
              </div>
            </section>

            <section id="arabic-numerals" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. Can I use Arabic-Indic numerals or Arabic text in page numbers?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not yet — and since strong Arabic support is one of BlendPDF's priorities, we want to be precise about what works today and what does not.
                </p>
                <p>
                  <strong>The Current State</strong><br />
                  Page numbers are rendered with a standard PDF font that supports Latin characters only. That means Western digits (1, 2, 3) and the English word "Page" in the labeled formats. Arabic-Indic numerals (١، ٢، ٣) and Arabic label text (صفحة) are not yet available. Arabic text support in our stamping tools (page numbers, watermarks, typed signatures) is coming.
                </p>
                <p>
                  <strong>What Works Fine Today</strong><br />
                  Your document's own content is unaffected by this limitation. PDFs written in Arabic — right-to-left text, Arabic fonts, mixed Arabic-English content — pass through the tool untouched and correctly. Only the small number label that BlendPDF adds is Latin-only. In practice, many Arabic-language documents use Western digits for page numbers anyway, so for a large share of users the current behavior is already the desired one.
                </p>
                <p>
                  <strong>If You Need Arabic-Indic Numerals Now</strong><br />
                  The honest answer is that a desktop tool is required today: Adobe Acrobat with an Arabic-capable font, or adding the numbers in the source document (Word and InDesign both support Arabic-Indic numbering) before exporting to PDF.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Is it safe to upload my document?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Page numbering gets used on contracts, filings, and dissertations, so here is exactly how your file is handled.
                </p>
                <p>
                  <strong>Encrypted Transfer</strong><br />
                  Your file travels to our servers over HTTPS (SSL/TLS) — the same encryption used by online banking — and the numbered copy returns over the same encrypted channel.
                </p>
                <p>
                  <strong>Fast, Automatic Deletion</strong><br />
                  Uploaded files and outputs are deleted from our servers within one hour, and most are removed immediately after processing. We keep no backups and no archive of your documents; once deleted, they are gone from our systems.
                </p>
                <p>
                  <strong>What We Do and Do Not Collect</strong><br />
                  Processing is fully automated — no person at BlendPDF sees your files, and we never read, store, or share the contents of your documents. No account or email is required, so there is no identity attached to an upload. We do use Google Analytics for aggregate, anonymous usage measurement (page views, which tools get used) to guide what we improve; that measurement never includes your documents or anything in them.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I add page numbers to a password-protected PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No — and rather than failing mysteriously, the tool checks for encryption and tells you exactly what to do.
                </p>
                <p>
                  <strong>What You Will See</strong><br />
                  Uploading an encrypted PDF produces a clear error: the file is password-protected and needs to be unlocked first. Nothing is processed and nothing is changed.
                </p>
                <p>
                  <strong>The Three-Step Path</strong><br />
                  First, remove the password with our <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</Link> tool — you need to know the current password; the tool removes protection rather than cracking it. Second, add page numbers to the unlocked copy. Third, if the document should stay protected, re-encrypt the numbered file with the <Link href="/protect-pdf" className="text-blue-600 hover:text-blue-800">Protect PDF</Link> tool, which applies real AES-256 encryption.
                </p>
                <p>
                  <strong>A Note on Permissions</strong><br />
                  Encryption means the document owner restricted changes. Only unlock and modify documents you own or have explicit permission to change.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Does it work on scanned PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — numbering is one of the tasks where scanned PDFs work exactly like born-digital ones.
                </p>
                <p>
                  <strong>Why It Just Works</strong><br />
                  A scanned PDF is a sequence of page images, and the page number is drawn on top of each page's content. Whether that content is selectable text or a photograph of paper makes no difference to the overlay. Numbering a scanned contract, a digitized archive, or a stack of scanned receipts works out of the box — a common real-world use is numbering scanned exhibits so they can be referenced as "Exhibit page 14".
                </p>
                <p>
                  <strong>Two Practical Tips</strong><br />
                  Scans often have dark or noisy edges where the paper met the scanner. The numbers render in black about 20 points from the edge, so if your scan has a dark border there, pick the corner with the cleanest background — the preview shows your actual first page, so this is easy to check. Also, crooked scans stay crooked: the number is placed squarely on the PDF page, so it will look straight even when the scanned image inside the page is tilted.
                </p>
                <p>
                  <strong>A Note on OCR</strong><br />
                  Adding numbers involves no text recognition, and BlendPDF currently has no OCR feature at all. A scanned PDF's text remains unsearchable before and after numbering — the added page numbers are real text, but the scan stays an image. If you need searchable scans, run OCR in another tool such as Acrobat's Recognize Text or the open-source OCRmyPDF.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The limits are simple and cover nearly all real documents.
                </p>
                <p>
                  <strong>File Limits</strong><br />
                  One PDF per operation, up to 50MB. There is no page-count limit — a 500-page manuscript numbers fine; it just takes a few extra seconds since every page gets its own stamp. Adding numbers barely changes the file size, since each number is a few bytes of text.
                </p>
                <p>
                  <strong>Usage Limits</strong><br />
                  To keep the service fast and free for everyone, numbering is limited to 20 files per 15 minutes per user. If you hit it, you will see a "too many requests" message — wait a few minutes and continue. There is no daily or lifetime cap.
                </p>
                <p>
                  <strong>If Your File Is Over 50MB</strong><br />
                  Run it through our <Link href="/compress-pdf" className="text-blue-600 hover:text-blue-800">Compress PDF</Link> tool first — it keeps text selectable and returns your original file unchanged if it cannot make it smaller — then number the compressed copy.
                </p>
              </div>
            </section>

            <section id="comparison" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. How does this compare to Word or Adobe Acrobat?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The right tool depends on one question: does the document already exist as a PDF?
                </p>
                <p>
                  <strong>Microsoft Word</strong><br />
                  If the document lives in Word, add the numbers there (Insert → Page Number) and export to PDF — that is the right workflow, with full control over fonts and roman-numeral front matter. But for an existing PDF, Word must first convert it to an editable document, and that conversion regularly rearranges layout, especially for complex, multi-column, or scanned files. Converting a finished PDF to Word just to add footers risks far more than it adds.
                </p>
                <p>
                  <strong>Adobe Acrobat Pro</strong><br />
                  Acrobat Pro's header-and-footer tool is the most capable option: page ranges, alternating odd/even placement, roman numerals, custom fonts, and Bates numbering for legal work. It also requires a paid subscription and a desktop installation. If you already pay for it and need those advanced modes, use it.
                </p>
                <p>
                  <strong>BlendPDF</strong><br />
                  BlendPDF numbers any existing PDF directly, without conversion or re-rendering, so the layout is never at risk. It is free, works in any browser on any operating system, requires no installation or account, and takes about a minute. The trade-offs are the ones this FAQ has been upfront about: every page is numbered (no ranges without the split-merge workaround), Western digits in Latin script only for now, and a single consistent position rather than alternating placement. For the everyday case — "this PDF needs page numbers, now" — it is the fastest honest path.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What should I do if I get an error?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Errors here are rare and nearly always one of the following.
                </p>
                <p>
                  <strong>"This PDF is password-protected"</strong><br />
                  The file is encrypted. Unlock it first with the <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</Link> tool (you need the password), then add the numbers to the unlocked copy. See question 11.
                </p>
                <p>
                  <strong>File Too Large or Not a PDF</strong><br />
                  The file must be a valid PDF under 50MB. Compress oversized files first. If the upload is rejected as not a PDF, check the file's real format — files renamed to .pdf from other formats are a surprisingly common cause.
                </p>
                <p>
                  <strong>"Too Many Requests"</strong><br />
                  You have hit the limit of 20 files per 15 minutes. Wait a few minutes and try again.
                </p>
                <p>
                  <strong>Numbers in the Wrong Place or Overlapping Content</strong><br />
                  Not an error, but the most common do-over: the numbers landed on top of an existing footer or figure. Run your original file again with a different position — the original is never modified, so nothing is lost. Checking the live preview against a representative page before applying avoids most of these.
                </p>
                <p>
                  <strong>A Valid File Still Fails</strong><br />
                  If a genuine, correctly sized, unencrypted PDF errors out, the file may have structural damage. Run it through the <Link href="/repair-pdf" className="text-blue-600 hover:text-blue-800">Repair PDF</Link> tool, then number the repaired copy.
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
