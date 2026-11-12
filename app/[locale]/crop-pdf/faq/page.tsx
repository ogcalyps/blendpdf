'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function CropPDFFAQ() {
  const faqs = [
    {
      question: 'How to crop PDF pages online',
      answer: 'Upload your PDF (up to 50MB), drag a rectangle on the page preview to select the area you want to keep, choose whether to apply the crop to all pages or just the current page, then click "Apply Crop & Download". Everything runs in your browser.'
    },
    {
      question: 'Does cropping remove content or reduce the file size?',
      answer: 'No. Cropping sets the page\'s crop box, which hides content outside your selection without deleting it. The content is still stored in the file, which is also why cropping doesn\'t reduce file size. Use a compression tool if you need a smaller file.'
    },
    {
      question: 'Can I undo a crop?',
      answer: 'Yes. Because cropping only changes the crop box and never touches the underlying content, it\'s reversible — you can restore the hidden area later by cropping again with a larger selection or resetting the crop box in any PDF editor. Your original file also stays untouched.'
    },
    {
      question: 'Can I crop all pages at once?',
      answer: 'Yes. Select "All pages" and the same crop area is applied to every page in the document — ideal for trimming uniform margins. You draw the selection once and it\'s projected onto each page.'
    },
    {
      question: 'What if my pages have different sizes?',
      answer: 'When cropping all pages, your selection is applied as the same relative area on each page — for example, the middle 80% — so it scales correctly even when pages have different dimensions or orientations.'
    },
    {
      question: 'Can I crop just one page?',
      answer: 'Yes. Choose "Current page only" and the crop is applied solely to the page you\'re viewing. Use the page navigation arrows to move to the page you want before applying.'
    },
    {
      question: 'Is my PDF uploaded to a server?',
      answer: 'No. The Crop PDF tool runs 100% in your browser. Your file is opened, previewed, and cropped locally on your device and is never uploaded anywhere. There\'s nothing to delete server-side because nothing ever reaches a server.'
    },
    {
      question: 'Does cropping work with Arabic PDFs?',
      answer: 'Yes. Cropping only adjusts the visible page area, so Arabic text, right-to-left layout, diacritics, and mixed-language content are preserved exactly as they are in the original document.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'You can open PDF files up to 50MB. There\'s no limit on the number of pages. Since processing happens on your own device, very large files simply depend on your device\'s memory and speed.'
    },
    {
      question: 'How fast is cropping?',
      answer: 'Cropping is nearly instant because there\'s no upload or download wait — the crop box update happens locally on your device. Speed depends on your device and browser, not on server load, and even large documents typically finish in seconds.'
    },
    {
      question: 'Is my original file modified?',
      answer: 'No. The tool creates a new PDF (named "cropped-" plus your original filename) with the crop applied, while your original file remains completely untouched on your device.'
    },
    {
      question: 'Can I crop password-protected PDFs?',
      answer: 'No, encrypted PDFs can\'t be opened for cropping. If you have the password and permission, unlock the PDF first with an unlock tool, then crop the unlocked copy.'
    },
    {
      question: 'Can I crop PDFs on mobile devices?',
      answer: 'Yes. The crop interface is touch-friendly — you can drag the crop rectangle with your finger on smartphones and tablets, and processing happens right on your device.'
    },
    {
      question: 'Is cropping PDFs free?',
      answer: 'Yes, cropping PDFs with BlendPDF is completely free — no fees, no watermarks, no account required, and no premium tiers today. All features are available at no charge.'
    },
    {
      question: 'What if cropping fails or produces errors?',
      answer: 'Common causes are files over 50MB, corrupted PDFs, or password-protected files. Verify the file opens in a PDF viewer, check the size, unlock encrypted files first, and try refreshing the page and cropping again.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Crop PDF', url: '/crop-pdf' },
        { name: 'FAQ', url: '/crop-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Crop PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-crop" className="text-blue-600 hover:text-blue-800">How to crop PDF pages online</a></li>
              <li><a href="#removes-content" className="text-blue-600 hover:text-blue-800">Does cropping remove content or reduce the file size?</a></li>
              <li><a href="#undo-crop" className="text-blue-600 hover:text-blue-800">Can I undo a crop?</a></li>
              <li><a href="#all-pages" className="text-blue-600 hover:text-blue-800">Can I crop all pages at once?</a></li>
              <li><a href="#different-sizes" className="text-blue-600 hover:text-blue-800">What if my pages have different sizes?</a></li>
              <li><a href="#single-page" className="text-blue-600 hover:text-blue-800">Can I crop just one page?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">Is my PDF uploaded to a server?</a></li>
              <li><a href="#arabic-support" className="text-blue-600 hover:text-blue-800">Does cropping work with Arabic PDFs?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#processing-speed" className="text-blue-600 hover:text-blue-800">How fast is cropping?</a></li>
              <li><a href="#original-file" className="text-blue-600 hover:text-blue-800">Is my original file modified?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I crop password-protected PDFs?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I crop PDFs on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is cropping PDFs free?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if cropping fails or produces errors?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-crop" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to crop PDF pages online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Cropping a PDF with BlendPDF is a visual, drag-based process — you see exactly what you're keeping before anything is applied. Here's how it works from start to finish:
                </p>
                <p>
                  <strong>Open Your PDF</strong><br />
                  Click the "Select PDF" button or drag and drop your file onto the upload area. BlendPDF accepts PDF files up to 50MB. The important difference from most online tools: your file is opened directly in your browser using a built-in PDF renderer — it is never uploaded to a server. As soon as the file loads, you'll see a live preview of the first page along with the total page count.
                </p>
                <p>
                  <strong>Draw Your Crop Area</strong><br />
                  Drag a rectangle directly on the page preview to select the area you want to keep. Everything outside the rectangle will be trimmed away visually. As you drag, a live readout shows the selection size in PDF points and as a percentage of the page (for example, "400 × 550 pt (65% × 70% of page)"), so you can be precise about how much margin you're removing. If you're not happy with the selection, use the "Reset Selection" button and draw again — nothing is applied until you confirm.
                </p>
                <p>
                  <strong>Choose the Scope</strong><br />
                  Under "Apply crop to", pick either "All pages" or "Current page only". If your document has multiple pages, you can navigate between them with the previous/next arrows to preview how the crop area sits on different pages before committing. Applying to all pages is the fastest way to trim uniform white margins across an entire document.
                </p>
                <p>
                  <strong>Apply and Download</strong><br />
                  Click "Apply Crop & Download". The crop is computed locally on your device — the tool updates each page's crop box and saves a new PDF named "cropped-" followed by your original filename. Because there is no upload or server round-trip, the whole operation typically completes in a few seconds, and the result opens correctly in any standard PDF viewer.
                </p>
              </div>
            </section>

            <section id="removes-content" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. Does cropping remove content or reduce the file size?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No — and this is one of the most important things to understand about PDF cropping in general. Cropping changes what is <em>displayed</em>, not what is <em>stored</em> in the file.
                </p>
                <p>
                  <strong>Cropping Hides, It Doesn't Delete</strong><br />
                  Technically, BlendPDF's crop tool adjusts each page's crop box — the rectangle that tells PDF viewers which part of the page to display. The underlying media box and all of the page's content (text, images, graphics) are left completely untouched. Content outside your selection is hidden from view in every standards-compliant PDF viewer, but it still exists inside the file. This is how the PDF specification defines cropping, and it's the same behavior you get in professional tools like Adobe Acrobat.
                </p>
                <p>
                  <strong>Why File Size Doesn't Shrink</strong><br />
                  Because no content is removed, the cropped file is roughly the same size as the original. If your goal is a smaller file rather than a tighter visible page area, cropping is the wrong tool — use a PDF compression tool instead, which actually re-encodes images and streams to reduce bytes on disk.
                </p>
                <p>
                  <strong>A Privacy Consideration</strong><br />
                  The hide-don't-delete behavior has a practical implication: cropping is <em>not</em> a redaction tool. If you crop out sensitive information — a signature, an address, an account number — that information is still present in the file and can be recovered by anyone who resets the crop box. Never rely on cropping to permanently remove confidential content; use a proper redaction workflow for that.
                </p>
                <p>
                  <strong>The Upside: Reversibility</strong><br />
                  The same property that makes cropping unsuitable for redaction makes it wonderfully safe for layout work. You can crop aggressively, change your mind, and restore the full page later without any quality loss, because the original content was never destroyed.
                </p>
              </div>
            </section>

            <section id="undo-crop" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Can I undo a crop?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Cropping with BlendPDF is a non-destructive, reversible operation at every stage — before you apply it, and even after you've downloaded the result.
                </p>
                <p>
                  <strong>Before Applying</strong><br />
                  While you're working, nothing is committed until you click "Apply Crop & Download". You can redraw the selection rectangle as many times as you like, or click "Reset Selection" to clear it entirely and start over. Navigating between pages doesn't lose your selection, so you can check how the crop area looks across the document before deciding.
                </p>
                <p>
                  <strong>After Downloading</strong><br />
                  Because cropping only sets the crop box and leaves the page content intact, the crop in a downloaded file is reversible. You can restore hidden content by cropping the file again with a larger selection area, or by resetting the crop box in any PDF editor that exposes page boxes. The full original page content is still in the file, waiting to be revealed.
                </p>
                <p>
                  <strong>Your Original Is Always Safe</strong><br />
                  Independently of all this, your original file is never modified. The tool produces a new file ("cropped-yourfile.pdf") and leaves the source document untouched on your device. The simplest undo of all is to just go back to the original and crop again differently.
                </p>
                <p>
                  <strong>One Caveat</strong><br />
                  Some tools and print workflows "flatten" PDFs, which can permanently discard content outside the crop box. If you pass a cropped file through such a tool, the hidden content may then be truly gone. As long as the file stays a normal PDF, though, the crop remains reversible.
                </p>
              </div>
            </section>

            <section id="all-pages" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Can I crop all pages at once?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Applying one crop to every page is the default mode and by far the most common use case — perfect for trimming consistent margins from an entire document in a single operation.
                </p>
                <p>
                  <strong>How All-Pages Cropping Works</strong><br />
                  Draw your selection on any page, make sure "All pages" is selected under "Apply crop to", and click "Apply Crop & Download". The tool takes your selection and applies it to every page in the document. You don't need to redraw anything per page — one rectangle defines the crop for the whole file.
                </p>
                <p>
                  <strong>Relative, Not Absolute</strong><br />
                  The selection is stored as a relative area — a fraction of the page's width and height — rather than fixed coordinates. That means "the middle 80% of the page" stays "the middle 80%" on every page, even if some pages are A4, some are Letter, and some are landscape. This makes all-pages cropping robust for real-world documents with mixed page geometry.
                </p>
                <p>
                  <strong>Typical Use Cases</strong><br />
                  All-pages cropping shines for: removing oversized white margins from scanned books or lecture notes to make them more readable on tablets and e-readers; trimming scanner edge artifacts and black borders; cutting off repeated headers, footers, or watermarking bands; and tightening two-column academic papers for small-screen reading.
                </p>
                <p>
                  <strong>Previewing Across Pages</strong><br />
                  Before applying, use the page navigation arrows to flip through the document and see where the crop rectangle falls on each page. If one specific page needs different treatment, you can crop the document in two passes — all pages first, then re-open the result and apply a "Current page only" crop to the exception.
                </p>
              </div>
            </section>

            <section id="different-sizes" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. What if my pages have different sizes?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Mixed page sizes are handled gracefully. BlendPDF applies your crop as a proportional area on each page, so documents that combine different formats still crop sensibly.
                </p>
                <p>
                  <strong>Proportional Projection</strong><br />
                  When you draw a crop rectangle, the tool records it as fractions of the page — for example, "start 10% from the left, keep 80% of the width, start 5% from the top, keep 90% of the height." When applying to all pages, those same fractions are projected onto each page's own dimensions. A selection covering the central area of an A4 page covers the equivalent central area of a Letter or landscape page.
                </p>
                <p>
                  <strong>Rotated Pages Are Handled Too</strong><br />
                  PDFs frequently contain pages with a rotation flag (common in scans). The crop tool maps your visual selection through each page's rotation and coordinate system, so what you see in the preview is what gets kept — the math of converting screen coordinates to PDF coordinates, including rotation and existing crop box offsets, is handled for you.
                </p>
                <p>
                  <strong>When Proportional Isn't What You Want</strong><br />
                  If your pages differ drastically — say, a document mixing full-size pages with small receipt scans — a single relative crop may not suit every page. In that case, use "Current page only" mode and crop the outlier pages individually, or split the document by size first, crop each part, and merge the results back together.
                </p>
                <p>
                  <strong>Checking the Result</strong><br />
                  The live readout showing the selection in both PDF points and percentages helps here: the percentage tells you what will happen on every page, while the point measurement tells you the exact physical size on the page you're currently viewing.
                </p>
              </div>
            </section>

            <section id="single-page" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Can I crop just one page?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Alongside all-pages cropping, BlendPDF offers a "Current page only" mode that applies your selection to exactly one page and leaves every other page untouched.
                </p>
                <p>
                  <strong>How Single-Page Cropping Works</strong><br />
                  Use the previous/next arrows to navigate to the page you want to crop — the indicator shows "Page X of Y" so you always know where you are. Draw your selection on that page's preview, select "Current page only" under "Apply crop to", and apply. The downloaded PDF contains all original pages, with only the current page's visible area changed.
                </p>
                <p>
                  <strong>When to Use It</strong><br />
                  Single-page cropping is useful when one page breaks the pattern: a cover page with printer marks, a single landscape chart in a portrait report, an appendix scan with heavy borders, or a page where you want to focus attention on one figure. It's also the mechanism for fine-tuning after an all-pages crop, as described above.
                </p>
                <p>
                  <strong>Cropping Several Specific Pages</strong><br />
                  If you need different crops on several different pages, apply them one at a time: crop page 3, download, re-open the result, crop page 7, and so on. Because processing is local and instant, iterating like this is quick. For the same crop on many (but not all) pages, consider extracting those pages first, cropping them in one pass, and merging back.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Is my PDF uploaded to a server?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. This is the defining privacy property of BlendPDF's Crop PDF tool: it runs 100% in your browser, and your file never leaves your device.
                </p>
                <p>
                  <strong>Fully Local Processing</strong><br />
                  When you select a PDF, it is opened directly in your browser's memory. The page previews are rendered locally, your crop selection is computed locally, and the final cropped PDF is generated locally using an in-browser PDF library. At no point is the document — or any part of it — transmitted over the network to BlendPDF or anyone else.
                </p>
                <p>
                  <strong>Nothing to Delete, Because Nothing Was Sent</strong><br />
                  Many online PDF tools promise to delete your upload after an hour. With this tool, that promise isn't needed: there is no upload, so there is nothing sitting on a server to delete in the first place. Your document's contents cannot be read, stored, logged, or leaked server-side, because they never reach a server.
                </p>
                <p>
                  <strong>What This Means for Sensitive Documents</strong><br />
                  This architecture makes the tool suitable for confidential material — contracts, medical records, financial statements, ID scans — where sending the file to a third-party server would be unacceptable or even non-compliant with your organization's policies. The trust model is the same as using a desktop application: the file stays on your machine.
                </p>
                <p>
                  <strong>Verify It Yourself</strong><br />
                  You don't have to take this on faith. Open your browser's developer tools, watch the network tab while cropping, and you'll see that no request carrying your document is made. The processing happens in JavaScript on your own hardware, which is also why the tool works so quickly — there's no upload or download wait.
                </p>
              </div>
            </section>

            <section id="arabic-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Does cropping work with Arabic PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, perfectly. BlendPDF is built Arabic-first, and cropping is one of the safest possible operations for Arabic and other right-to-left (RTL) documents.
                </p>
                <p>
                  <strong>Why Cropping Is RTL-Safe</strong><br />
                  Cropping never touches the text layer of your document. It only changes which rectangular area of each page is visible. Arabic letterforms, ligatures, diacritics (tashkeel), character shaping, and right-to-left reading order are all stored in the page content, which the crop operation leaves byte-for-byte intact. There is no re-rendering, no font substitution, and no text re-flow — so there is nothing that could corrupt Arabic text.
                </p>
                <p>
                  <strong>Mind the Margins Direction</strong><br />
                  One practical tip for RTL documents: page margins in Arabic layouts are often mirrored compared to English documents (the binding margin sits on the right). Since you draw the crop area visually on a preview of the actual page, you can see exactly where the text block sits and place your selection accordingly — no guesswork about which side the wider margin is on.
                </p>
                <p>
                  <strong>An Interface That Speaks Your Language</strong><br />
                  Beyond the document itself, BlendPDF's interface is fully localized in Arabic with proper RTL layout, including mirrored navigation controls. You can run the entire crop workflow in Arabic if you prefer.
                </p>
                <p>
                  <strong>All Languages Welcome</strong><br />
                  The same content-preserving behavior applies to Hebrew, Persian, Urdu, and any other script — as well as mixed bilingual documents like Arabic-English contracts, which are common in legal and business settings across the region.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The Crop PDF tool accepts files up to 50MB, which comfortably covers the vast majority of real-world documents.
                </p>
                <p>
                  <strong>The 50MB Limit in Practice</strong><br />
                  A typical text-based document runs well under 5MB even at hundreds of pages; scanned documents with images are larger but usually still fit. The 50MB ceiling mainly exists to keep the in-browser experience smooth — since your device does the processing, extremely large files would consume significant browser memory.
                </p>
                <p>
                  <strong>No Page Count Limit</strong><br />
                  There is no hard cap on the number of pages. Whether your PDF has 2 pages or 500, you can crop it. Longer documents take slightly more time when applying an all-pages crop since each page's crop box is computed individually, but the operation remains fast because there's no network involved.
                </p>
                <p>
                  <strong>Output Size Matches Input</strong><br />
                  As explained above, cropping doesn't remove content, so the cropped file is approximately the same size as the original. Don't expect the download to be smaller — and don't worry about it being meaningfully larger either.
                </p>
                <p>
                  <strong>Working Around the Limit</strong><br />
                  If your file exceeds 50MB, compress it first with a PDF compression tool and crop the compressed version, or split the document into parts, crop each part (the relative selection makes it easy to apply the same crop consistently), and merge the results back together.
                </p>
              </div>
            </section>

            <section id="processing-speed" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. How fast is cropping?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Very fast — usually a few seconds from clicking "Apply Crop & Download" to having the file in your downloads folder. The reason is architectural: there is no upload, no server queue, and no download of a processed file from a remote machine.
                </p>
                <p>
                  <strong>No Network Wait</strong><br />
                  With server-based tools, most of the time you spend "processing" is actually spent transferring your file up and back down. BlendPDF's crop tool eliminates both transfers entirely. The moment you pick a file, it's already where it needs to be — in your browser's memory.
                </p>
                <p>
                  <strong>Speed Depends on Your Device</strong><br />
                  Because processing is local, performance scales with your own hardware and browser rather than with server load. A modern laptop crops even large documents almost instantly; older phones may take a bit longer on big files. Crucially, the tool is never slow because "the service is busy" — there's no shared server to be busy.
                </p>
                <p>
                  <strong>What Takes the Time</strong><br />
                  The two phases are rendering the page preview when you open the file (proportional to page complexity) and writing the new PDF when you apply the crop (proportional to file size and page count). The crop box change itself is a lightweight metadata update per page, which is why even an all-pages crop on a long document completes quickly.
                </p>
              </div>
            </section>

            <section id="original-file" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Is my original file modified?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Your original PDF is never changed in any way. Cropping produces a brand-new file and leaves the source document exactly as it was.
                </p>
                <p>
                  <strong>A New File, Clearly Named</strong><br />
                  When you apply a crop, BlendPDF generates a separate PDF named "cropped-" followed by your original filename — so "report.pdf" becomes "cropped-report.pdf". This naming makes it impossible to confuse the two versions, and the original stays untouched wherever it lives on your device or in Google Drive.
                </p>
                <p>
                  <strong>Browsers Can't Overwrite Your Files Anyway</strong><br />
                  There's a structural guarantee behind this: web pages cannot silently modify files on your disk. The tool reads the file you selected into memory, works on that in-memory copy, and offers the result as a download. Writing over your original is not something the tool does — or even could do.
                </p>
                <p>
                  <strong>Experiment Freely</strong><br />
                  Because every crop yields a new file from an unchanged original, you can iterate without risk: try a tight crop, compare it to a looser one, produce different versions for screen reading versus printing. If a result isn't right, just re-open the original and try again.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I crop password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly. If you select an encrypted PDF, the tool will show a clear message explaining that the file is password-protected and can't be opened for cropping.
                </p>
                <p>
                  <strong>Why Encrypted Files Are Rejected</strong><br />
                  An encrypted PDF's content — including the page data the crop tool needs to render previews and rewrite crop boxes — is unreadable without the password. Rather than silently failing or producing a broken file, BlendPDF detects the encryption up front and tells you exactly what's going on, with a link to the unlock tool.
                </p>
                <p>
                  <strong>The Unlock-First Workflow</strong><br />
                  If you own the document or have permission to modify it, unlock it first: remove the password with a PDF unlock tool, then crop the unlocked copy normally. If the cropped result needs to remain confidential, re-apply password protection to it afterwards with a protect tool. Only ever unlock documents you're authorized to modify.
                </p>
                <p>
                  <strong>Owner Passwords vs. Open Passwords</strong><br />
                  PDFs can be protected in two ways: an open password (required just to view the file) and an owner password (restricting editing or printing). Both forms of encryption prevent the crop tool from processing the file, so the unlock-first workflow applies in either case.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Can I crop PDFs on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. The crop tool works on smartphones and tablets, with a responsive interface designed for touch.
                </p>
                <p>
                  <strong>Touch-Friendly Cropping</strong><br />
                  Drawing the crop rectangle works with your finger just as it does with a mouse: touch and drag across the page preview to define the area you want to keep. The live size readout, the page navigation arrows, and the scope options ("All pages" / "Current page only") are all sized for comfortable tapping on small screens.
                </p>
                <p>
                  <strong>Files From Anywhere on Your Phone</strong><br />
                  You can open PDFs from your device's local storage, from the Files app, or from downloads. The cropped result downloads to your device like any other file.
                </p>
                <p>
                  <strong>Performance on Mobile</strong><br />
                  Since processing happens on-device, speed depends on your phone's hardware. Modern phones handle typical documents effortlessly; for very large scans near the 50MB limit, an older device may take noticeably longer to render previews. A tablet's larger screen makes precise crop selection easier, but phones work fine — you can zoom your view for accuracy.
                </p>
                <p>
                  <strong>A Practical Mobile Use Case</strong><br />
                  Cropping is especially valuable <em>for</em> mobile reading: trimming wide margins from a paper or book scan makes the text substantially larger when the page is fitted to a phone or e-reader screen, often the difference between readable and not.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. Is cropping PDFs free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, cropping PDFs with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today. We believe essential PDF tools should be accessible to everyone.
                </p>
                <p>
                  <strong>No Payment, No Watermarks</strong><br />
                  There are no credit card prompts, no trial periods, and no stamped watermarks on your output. The cropped PDF you download is clean and yours. You can crop as many documents as you like, as often as you like.
                </p>
                <p>
                  <strong>All Features Included</strong><br />
                  The free tool includes everything: visual drag-to-crop selection with a live size readout, all-pages and single-page modes, proportional cropping across mixed page sizes, files up to 50MB, and full RTL/Arabic support. There is no feature gate to hit.
                </p>
                <p>
                  <strong>No Account Required</strong><br />
                  You don't need to register, sign in, or hand over personal information to crop a PDF. Open the page, pick a file, crop, download — that's the entire flow.
                </p>
                <p>
                  <strong>Why Free Is Sustainable Here</strong><br />
                  Because cropping runs entirely in your browser, serving this tool costs almost nothing on our side — your device does the work. That client-side architecture is what lets us keep the tool free without compromising on capability or privacy.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if cropping fails or produces errors?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Cropping is a robust operation, but a few situations can cause errors. Here's how to diagnose and fix the common ones:
                </p>
                <p>
                  <strong>File Won't Open</strong><br />
                  If the tool reports it couldn't read your PDF, first check the two usual suspects: the file exceeds the 50MB limit, or it isn't actually a valid PDF (files renamed to .pdf, or corrupted downloads, are common). Verify the file opens in a normal PDF viewer. If it opens there but not in the tool, re-saving it from that viewer often repairs minor structural damage.
                </p>
                <p>
                  <strong>Password-Protected Files</strong><br />
                  Encrypted PDFs are detected and rejected with a specific message and a link to the unlock tool. Unlock the file first (assuming you have the right to), then crop the unlocked copy. See the password-protection section above for the full workflow.
                </p>
                <p>
                  <strong>The Apply Button Is Disabled</strong><br />
                  "Apply Crop & Download" stays disabled until you've drawn a selection. If you can't click it, drag a rectangle on the page preview first — the readout above the preview will switch from "No area selected yet" to the selection dimensions once you have.
                </p>
                <p>
                  <strong>Browser or Memory Issues</strong><br />
                  Because processing is local, an overloaded browser tab can occasionally stall on very large files, particularly on older devices. Close other heavy tabs, refresh the page, and try again. Using an up-to-date version of Chrome, Firefox, Safari, or Edge helps — the tool relies on modern browser PDF and rendering APIs. If a specific file consistently fails while others work, the file itself likely has structural quirks; re-exporting it from any PDF viewer usually normalizes it.
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
