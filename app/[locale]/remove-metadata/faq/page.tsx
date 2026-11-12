'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function RemoveMetadataFAQ() {
  const faqs = [
    {
      question: 'How to remove metadata from a PDF online',
      answer: 'Upload your PDF and BlendPDF shows every hidden metadata field it contains — author, title, timestamps, software traces, and the XMP stream. Click "Remove metadata" to strip them, review the before/after table proving the fields are gone, then download the clean PDF. Everything happens in your browser.'
    },
    {
      question: 'What metadata does a PDF contain?',
      answer: 'Most PDFs carry hidden fields you never see on the page: the author\'s name (often a real personal or company account), title, subject, keywords, the creator and producer software, and creation and modification timestamps. Many also embed an XMP metadata stream repeating these details in XML form.'
    },
    {
      question: 'What exactly does this tool remove?',
      answer: 'It clears the document information fields (title, author, subject, keywords, creator, producer), deletes the creation and modification dates, and strips the embedded XMP metadata stream. The visible content of your pages is not changed.'
    },
    {
      question: 'Is my PDF uploaded to a server?',
      answer: 'No. The tool runs 100% in your browser — your file never leaves your device. For a privacy tool this matters most of all: a document you are cleaning for privacy should not travel over the internet at all.'
    },
    {
      question: 'Why should I remove metadata before sharing a PDF?',
      answer: 'Metadata can quietly reveal who wrote a document, which software and account created it, and exactly when it was made or edited. Stripping it before sharing a CV, contract, report, or public document prevents leaking names, timelines, and internal tooling.'
    },
    {
      question: 'How can I verify the metadata is really gone?',
      answer: 'After cleaning, BlendPDF re-opens the cleaned file and reads its metadata back, showing a before/after table where each removed field is confirmed. You can also check the downloaded file yourself in any PDF viewer\'s document properties.'
    },
    {
      question: 'Does removing metadata change the visible content?',
      answer: 'No. Pages, text, images, and formatting stay exactly as they were — only the hidden document information fields and the XMP stream are removed. Annotations, attachments, and the text itself are not touched.'
    },
    {
      question: 'What hidden data is NOT removed?',
      answer: 'The tool removes document-level metadata only. It does not delete annotations, comments, attachments, bookmarks, form data, or sensitive text visible on the pages. If the content itself contains private information, you need to redact it separately.'
    },
    {
      question: 'What is the XMP metadata stream?',
      answer: 'XMP is an XML block embedded in many PDFs that duplicates and extends the basic metadata — author, software, timestamps, and sometimes document history. Deleting only the info fields leaves XMP behind, which is why this tool strips the whole XMP stream from the document catalog as well.'
    },
    {
      question: 'Does it work with password-protected PDFs?',
      answer: 'Not directly — encrypted PDFs can\'t be modified without the password. Use the BlendPDF Unlock PDF tool to remove the password first, then clean the metadata here.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'PDF files up to 50MB are supported, with no page limit. Since processing is local, speed depends on your device rather than a server, and metadata removal is fast even for large documents.'
    },
    {
      question: 'Is my original file modified?',
      answer: 'No. The cleaned PDF is saved as a new file prefixed with "no-metadata-", and your original stays untouched on your device. You keep both versions.'
    },
    {
      question: 'Can I remove metadata on mobile devices?',
      answer: 'Yes, the tool works on smartphones and tablets. The metadata table, removal button, and download all work in mobile browsers, and processing stays local to your device.'
    },
    {
      question: 'Is removing PDF metadata free?',
      answer: 'Yes — completely free, with no sign-up, no watermarks, and no premium tiers today. Files up to 50MB are supported, and unlimited documents can be cleaned.'
    },
    {
      question: 'What if metadata removal fails?',
      answer: 'Common causes are password-protected files (unlock first), corrupted PDFs, or files over 50MB. Some malformed documents can\'t be re-saved by the cleaning engine. Verify the file opens in a PDF viewer, then try again; if a specific field resists removal, the before/after table will show it honestly.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Remove Metadata', url: '/remove-metadata' },
        { name: 'FAQ', url: '/remove-metadata/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Remove PDF Metadata
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-remove" className="text-blue-600 hover:text-blue-800">How to remove metadata from a PDF online</a></li>
              <li><a href="#what-is-metadata" className="text-blue-600 hover:text-blue-800">What metadata does a PDF contain?</a></li>
              <li><a href="#what-is-removed" className="text-blue-600 hover:text-blue-800">What exactly does this tool remove?</a></li>
              <li><a href="#in-browser-privacy" className="text-blue-600 hover:text-blue-800">Is my PDF uploaded to a server?</a></li>
              <li><a href="#why-remove" className="text-blue-600 hover:text-blue-800">Why should I remove metadata before sharing a PDF?</a></li>
              <li><a href="#verify-removal" className="text-blue-600 hover:text-blue-800">How can I verify the metadata is really gone?</a></li>
              <li><a href="#visible-content" className="text-blue-600 hover:text-blue-800">Does removing metadata change the visible content?</a></li>
              <li><a href="#not-removed" className="text-blue-600 hover:text-blue-800">What hidden data is NOT removed?</a></li>
              <li><a href="#xmp-metadata" className="text-blue-600 hover:text-blue-800">What is the XMP metadata stream?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Does it work with password-protected PDFs?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#original-file" className="text-blue-600 hover:text-blue-800">Is my original file modified?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I remove metadata on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is removing PDF metadata free?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if metadata removal fails?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-remove" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to remove metadata from a PDF online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Cleaning a PDF's hidden metadata with BlendPDF is a transparent, three-step process — and unusually for an online tool, you get to see exactly what is being removed before and after it happens.
                </p>
                <p>
                  <strong>Select Your PDF</strong><br />
                  Click "Select PDF" or drag and drop your file onto the upload area. Files up to 50MB are accepted. The moment the file is selected, BlendPDF reads its metadata locally in your browser — the document itself is never uploaded anywhere.
                </p>
                <p>
                  <strong>Review What Your PDF Reveals</strong><br />
                  A table appears listing every document-level metadata field: Title, Author, Subject, Keywords, Creator, Producer, Creation date, Modification date, and whether an XMP metadata stream is present. Fields that are set show their current values; empty fields are marked "Not set". Many people are surprised at this step — a personal name in the Author field, the exact software used, or a revealing modification timestamp are all common finds. A counter summarizes how many fields were found.
                </p>
                <p>
                  <strong>Remove and Verify</strong><br />
                  Click "Remove metadata". The tool clears the information fields, deletes the timestamps, and strips the XMP stream — then re-opens the cleaned file and reads the metadata back, updating the table into a before/after comparison. Each removed field shows its old value struck through and "Removed" in the after column, proving the file you're about to download really is clean.
                </p>
                <p>
                  <strong>Download the Clean PDF</strong><br />
                  Click "Download clean PDF" to save the cleaned copy, named with a "no-metadata-" prefix so you can't confuse it with the original. Your original file remains untouched, and the whole operation typically takes just a few seconds.
                </p>
              </div>
            </section>

            <section id="what-is-metadata" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. What metadata does a PDF contain?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Almost every PDF carries information about itself that never appears on its pages. This metadata is written automatically by the software that created the file, and most people are unaware it exists — which is precisely what makes it a privacy concern.
                </p>
                <p>
                  <strong>The Document Information Fields</strong><br />
                  The classic PDF metadata lives in the document information dictionary: Title, Author, Subject, Keywords, Creator (the application the document was authored in, like Word or InDesign), and Producer (the software that generated the PDF itself). The Author field is the most sensitive — it is typically auto-filled with the account name or license name of whoever created the document, which often means a real personal name or an employer's name.
                </p>
                <p>
                  <strong>Timestamps</strong><br />
                  PDFs record a creation date and a modification date, down to the second and including a timezone. These can reveal more than you'd expect: that a "final" contract was edited five minutes before sending, that a report was written at 3 a.m., or that a document predates or postdates some event. The timestamps persist through emailing, uploading, and copying the file.
                </p>
                <p>
                  <strong>The XMP Metadata Stream</strong><br />
                  Beyond the basic fields, many PDFs embed an XMP (Extensible Metadata Platform) stream — a block of XML inside the file that repeats the same details and can add more, such as document IDs and editing history, depending on the creating application. Because it's a separate structure, XMP survives even when the basic fields are cleared, which is why a thorough cleaning must remove it too.
                </p>
                <p>
                  <strong>See It for Yourself</strong><br />
                  You don't have to take this on faith: drop any PDF into the BlendPDF Remove PDF Metadata tool and it will display every one of these fields and their current values, read locally in your browser. Checking a document you're about to share takes seconds and costs nothing.
                </p>
              </div>
            </section>

            <section id="what-is-removed" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. What exactly does this tool remove?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The tool performs three distinct cleaning operations on your PDF, covering both the classic metadata fields and the modern XMP stream. Here is the precise list — no more, no less.
                </p>
                <p>
                  <strong>Document Information Fields Are Cleared</strong><br />
                  The six standard information fields — Title, Author, Subject, Keywords, Creator, and Producer — are all blanked. After cleaning, a PDF viewer's "Document Properties" dialog will show these fields empty. This is where personal names, company names, and software identifiers most commonly hide.
                </p>
                <p>
                  <strong>Timestamps Are Deleted</strong><br />
                  The creation date and modification date entries are removed from the document's information dictionary entirely. The cleaned file no longer discloses when it was made or last edited. (Your operating system will still show file-system dates for the downloaded file itself — those belong to your device, not to the PDF's internal data.)
                </p>
                <p>
                  <strong>The XMP Stream Is Stripped</strong><br />
                  The embedded XMP metadata stream is deleted from the document catalog. This matters because XMP duplicates the basic fields in XML form and can carry additional identifiers; tools that only blank the info dictionary leave this copy behind. BlendPDF removes the stream itself, and the before/after table explicitly shows "XMP metadata stream: Present → Removed" when one was found.
                </p>
                <p>
                  <strong>What Stays Untouched</strong><br />
                  The visible content of your pages — text, images, fonts, layout — is not modified in any way. Annotations, attachments, bookmarks, and form fields inside the document are also left as they are; this tool is scoped deliberately to document-level metadata. If sensitive information is visible on the pages themselves, that's a redaction task, not a metadata task.
                </p>
              </div>
            </section>

            <section id="in-browser-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Is my PDF uploaded to a server?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No — and for this tool in particular, that's the whole point. The Remove PDF Metadata tool runs 100% in your browser. Your file never leaves your device: not for reading the metadata, not for removing it, and not for producing the cleaned copy.
                </p>
                <p>
                  <strong>The Irony In-Browser Processing Avoids</strong><br />
                  Think about what a server-based metadata remover asks of you: to protect your privacy, first send your private document across the internet to a stranger's server. You'd be trading known metadata exposure for unknown server-side exposure. BlendPDF's design removes that trade-off entirely — the document you are cleaning for privacy reasons never travels over the network at all.
                </p>
                <p>
                  <strong>How It Works Locally</strong><br />
                  When you select a file, your browser parses the PDF structure on your own device, reads the information dictionary and checks for an XMP stream, and displays what it finds. When you click "Remove metadata", the same local engine rewrites the file in memory and hands you the cleaned bytes as a download. BlendPDF's servers never see the file, its metadata, or its contents.
                </p>
                <p>
                  <strong>Nothing to Delete, Nothing to Trust</strong><br />
                  Server-based tools answer privacy questions with retention policies — "files are deleted within X hours." Those policies require trust. Here there is no server copy, so there is no retention window, no deletion schedule, and no operator access to worry about. You can verify it: load the page, go offline, and the tool still reads and cleans your PDF.
                </p>
              </div>
            </section>

            <section id="why-remove" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Why should I remove metadata before sharing a PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Because metadata answers questions you may not want answered: who made this document, with what, and when. Removing it is a small step that closes a surprisingly common information leak.
                </p>
                <p>
                  <strong>Names and Identities</strong><br />
                  The Author field is auto-filled by most software with the logged-in user's name or the license holder's name. A freelancer sending a proposal under an agency brand, a job applicant whose CV was edited by a friend, an employee publishing a document that carries a colleague's name, or an author who wants to remain anonymous — all of them leak identity through this one field. Clearing it keeps the document about its content, not its creator.
                </p>
                <p>
                  <strong>Timelines You Didn't Mean to Share</strong><br />
                  Creation and modification timestamps tell stories: a "carefully prepared" report generated an hour before the meeting, a backdated-looking contract whose file says otherwise, or a document edited after it was supposedly finalized. Whether the story is embarrassing or merely nobody's business, deleting the timestamps ends it.
                </p>
                <p>
                  <strong>Tooling and Workflow Traces</strong><br />
                  Creator and Producer fields reveal your software stack — which word processor, which PDF generator, sometimes which version. For businesses, this discloses internal tooling; combined with old software versions it can even hint at unpatched systems. Keywords and Subject fields sometimes carry internal project names or classification labels that were never meant for external eyes.
                </p>
                <p>
                  <strong>When to Make It Routine</strong><br />
                  Clean metadata before sharing CVs and cover letters, contracts and legal documents, reports published on a website, documents sent to journalists or regulators, anonymous submissions, and anything shared with clients under a company brand. Because BlendPDF shows you the fields first, a quick check costs seconds — and if the table shows "No metadata fields found", you can share with confidence.
                </p>
              </div>
            </section>

            <section id="verify-removal" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. How can I verify the metadata is really gone?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Trust in a privacy tool should be verifiable, so BlendPDF builds verification into the workflow itself — and you can double-check independently with any PDF viewer.
                </p>
                <p>
                  <strong>Built-In Before/After Proof</strong><br />
                  After cleaning, the tool does something most metadata removers skip: it re-opens the cleaned file it just produced and reads the metadata back out of it. The results appear in a before/after table — each field's original value shown struck through in the "Before" column, and "Removed" in green in the "After" column. This isn't a claim about what the tool intended to do; it's a readout of what the downloadable file actually contains, including whether the XMP stream is still present (it shouldn't be).
                </p>
                <p>
                  <strong>Check It Yourself in a PDF Viewer</strong><br />
                  Open the downloaded "no-metadata-" file in Adobe Acrobat Reader, macOS Preview, or your browser's PDF viewer and look at the document properties (File → Properties, or Tools → Show Inspector). Title, Author, Subject, and the other fields should be empty, and the creation/modification dates should be absent. Independent verification with software you already trust is the strongest confirmation there is.
                </p>
                <p>
                  <strong>Re-Upload as a Final Check</strong><br />
                  You can also feed the cleaned file back into the Remove PDF Metadata tool itself. On a properly cleaned document, the inspection table will report no metadata fields found and no XMP stream present. This round-trip takes seconds and uses the same local, private inspection as the first pass.
                </p>
                <p>
                  <strong>Why Verification Matters</strong><br />
                  Metadata removal has a history of half-measures — tools that blank the visible fields but leave the XMP copy behind, so "cleaned" documents still carry author names in their XML. Reading the metadata back from the actual output file is the honest way to close that gap, and it's why the verification step is not optional in this tool's design.
                </p>
              </div>
            </section>

            <section id="visible-content" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Does removing metadata change the visible content?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Metadata removal is surgical: it operates on the document's hidden information structures and leaves every visible element of your PDF exactly as it was.
                </p>
                <p>
                  <strong>Pages Are Untouched</strong><br />
                  The text on your pages, fonts, images, colors, page dimensions, margins, headers and footers, tables, and graphics all pass through unmodified. The cleaning operations target the information dictionary and the XMP stream — structures that sit alongside the page content, not inside it. Your document will look pixel-for-pixel identical in any PDF viewer before and after cleaning.
                </p>
                <p>
                  <strong>Interactive Elements Survive Too</strong><br />
                  Bookmarks, internal links, hyperlinks, annotations, and form fields remain functional in the cleaned file. The tool does not flatten, re-render, or re-compress the document; it re-saves the same content with the metadata structures cleared. This also means Arabic and other right-to-left documents come through perfectly — the page content, text shaping, and layout are simply not touched.
                </p>
                <p>
                  <strong>One Visible Field to Be Aware Of</strong><br />
                  A subtle note: some PDF viewers display the document's Title metadata in the window or tab title bar. After cleaning, such viewers will fall back to showing the filename instead. That is the only user-visible difference you might notice, and it's the metadata removal working as intended.
                </p>
                <p>
                  <strong>File Size Stays Similar</strong><br />
                  Because only small metadata structures are removed, the cleaned file is approximately the same size as the original — typically marginally smaller. If you need to shrink the document itself, that's a job for the BlendPDF compression tool, which you can run on the cleaned file afterwards.
                </p>
              </div>
            </section>

            <section id="not-removed" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. What hidden data is NOT removed?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Honesty matters more in a privacy tool than anywhere else, so here is the explicit list of things this tool does not remove. Its scope is document-level metadata; other kinds of embedded or visible data need other treatments.
                </p>
                <p>
                  <strong>Content Inside the Pages</strong><br />
                  Text visible on the pages is never altered — including names, addresses, or account numbers written in the document body. Metadata removal is not redaction. If the sensitive information is part of the content itself, you must edit or redact the source document; no metadata tool can help with that, and any tool claiming otherwise should worry you.
                </p>
                <p>
                  <strong>Annotations, Comments, and Attachments</strong><br />
                  Sticky-note comments, highlights, drawing markups, and files attached inside the PDF are preserved, not stripped. Comments deserve attention before sharing: they can carry reviewer names and candid remarks. Check for them in your PDF viewer's comments panel if the document went through a review cycle.
                </p>
                <p>
                  <strong>Form Data and Bookmarks</strong><br />
                  Values typed into form fields, the field names themselves, and the document's bookmark tree are left intact. If you want form fields locked down or merged into the page, use the BlendPDF <a href="/flatten-pdf" className="text-blue-600 hover:text-blue-800">Flatten PDF</a> tool — a complementary step, not a substitute for metadata cleaning.
                </p>
                <p>
                  <strong>Metadata Inside Embedded Images</strong><br />
                  Images embedded in a PDF can theoretically carry their own EXIF-style data from the camera or editor that produced them. This tool cleans the PDF's document metadata, not the internals of each embedded image. For most documents this is a non-issue, but for photo-heavy files with strict anonymity requirements, it's worth knowing the boundary. The practical rule: use this tool to remove what the PDF says about itself, and review the document's actual content separately before sharing.
                </p>
              </div>
            </section>

            <section id="xmp-metadata" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. What is the XMP metadata stream?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  XMP (Extensible Metadata Platform) is a second, more modern metadata system that lives inside many PDFs — and it's the one that half-hearted cleaning tools forget. Understanding it explains why BlendPDF's before/after table gives it a dedicated row.
                </p>
                <p>
                  <strong>A Metadata Format Within the File</strong><br />
                  XMP is a block of XML embedded in the PDF's document catalog. Adobe introduced it to standardize metadata across file formats, and most professional software — Acrobat, InDesign, Word's PDF export, and many others — writes an XMP packet into every PDF it produces. It typically contains the document title, creator tool, author, creation and modification dates, and unique document identifiers, all in machine-readable XML.
                </p>
                <p>
                  <strong>Why It's a Second Leak</strong><br />
                  The trouble is duplication: the same facts exist in both the classic information dictionary and the XMP stream. A tool that only blanks the info fields produces a PDF whose Properties dialog looks clean, while the XML inside still says who made the document and when. Anyone who opens the file in a text editor or metadata inspector sees everything. This split is one of the most common ways "cleaned" documents still leak.
                </p>
                <p>
                  <strong>How BlendPDF Handles It</strong><br />
                  The tool checks whether an XMP stream exists and reports it in the inspection table ("XMP metadata stream: Present"). When you clean the file, the entire stream is deleted from the document catalog — not edited, removed. The verification pass then re-opens the cleaned file and confirms the stream is gone, showing "Removed" in the after column. Both the check and the removal happen locally in your browser.
                </p>
                <p>
                  <strong>If No XMP Is Found</strong><br />
                  Simpler PDF generators skip XMP entirely, so the table may show it as "Not set". In that case there is nothing extra to strip, and the cleaning covers just the information dictionary fields and timestamps — the complete metadata footprint of that particular file.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Does it work with password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly. An encrypted PDF cannot be modified without its password, so metadata removal on a locked file is technically impossible — and the tool tells you so clearly instead of failing silently.
                </p>
                <p>
                  <strong>What Happens with an Encrypted File</strong><br />
                  When you select a password-protected PDF, the tool detects the encryption during its initial local inspection and shows a hint explaining the situation, with a link to the BlendPDF <a href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</a> tool. No metadata table is shown and no cleaning is attempted, because the encrypted structures can't be safely rewritten.
                </p>
                <p>
                  <strong>The Recommended Workflow</strong><br />
                  Unlock first, clean second: open the Unlock PDF tool, remove the password (you need to know it — this is for documents you own or are authorized to modify), then bring the unlocked file back here to strip its metadata. If the document should stay protected after cleaning, re-apply a password with the Protect PDF tool as a final step. Clean-then-protect gives you a file that is both metadata-free and encrypted.
                </p>
                <p>
                  <strong>Why This Order Makes Sense</strong><br />
                  Encryption protects a document's contents in transit and at rest; metadata removal controls what the file discloses about its origins. They solve different problems and combine well — but the cleaning must happen while the file is unlocked, since that's the only state in which its internal structures can be rewritten. Keeping the steps explicit also means you always know exactly what state your document is in.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The Remove PDF Metadata tool accepts files up to 50MB, with no restriction on page count. For metadata work, this limit is rarely a constraint in practice.
                </p>
                <p>
                  <strong>50MB Covers Almost Everything</strong><br />
                  Metadata lives in a few small structures regardless of how big the document is, so the documents people typically clean — CVs, contracts, reports, papers — are usually a few hundred kilobytes to a few megabytes. Files that push toward 50MB are generally image-heavy scans or design-heavy brochures, and even those fit under the limit in most cases.
                </p>
                <p>
                  <strong>Page Count Doesn't Matter Much</strong><br />
                  Whether your PDF has 2 pages or 2,000, the metadata to remove is the same handful of fields plus the XMP stream. The main cost of a larger file is parsing and re-saving it in your browser's memory, which modern devices handle quickly. There is no per-page processing step in metadata removal the way there is in, say, text extraction.
                </p>
                <p>
                  <strong>Output Size Mirrors Input Size</strong><br />
                  The cleaned file is approximately the same size as the original — usually a whisker smaller, since metadata structures were deleted. If your goal is also a smaller file, run the cleaned PDF through the BlendPDF compression tool afterwards.
                </p>
                <p>
                  <strong>Over the Limit?</strong><br />
                  If a file exceeds 50MB, you'll get a clear message at selection time. Compress the PDF first, then clean the compressed copy — the metadata removal works identically on it. Since everything is processed locally, the limit exists to keep in-browser memory use sane rather than to protect any server.
                </p>
              </div>
            </section>

            <section id="original-file" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Is my original file modified?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Cleaning produces a brand-new file, and your original PDF — metadata and all — stays exactly as it was on your device.
                </p>
                <p>
                  <strong>A Clearly Named New File</strong><br />
                  The cleaned document downloads with a "no-metadata-" prefix added to the original filename: report.pdf becomes no-metadata-report.pdf. The naming makes it impossible to mix up the shared-safe version with the original, which is exactly what you want when the difference between the two files is invisible on the page.
                </p>
                <p>
                  <strong>Why Keeping the Original Can Be Useful</strong><br />
                  The original's metadata isn't always a liability — internally, the author field and timestamps can serve as a record of who produced a document and when. A sensible pattern is to archive the original for your own records and share only the cleaned copy. Because the tool never touches the source file, this pattern happens automatically.
                </p>
                <p>
                  <strong>Non-Destructive and Repeatable</strong><br />
                  You can re-clean the same original whenever you need a fresh shareable copy, or clean multiple different documents in a row — each run reads its source, produces its cleaned output, and changes nothing else. And since the entire process is local, "your device" is the complete list of places where either version of your file exists.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Can I remove metadata on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. The Remove PDF Metadata tool works on smartphones and tablets, with the same local processing and the same verification table you get on desktop.
                </p>
                <p>
                  <strong>Full Workflow on a Phone</strong><br />
                  You can select a PDF from your phone's files app, cloud storage, or Google Drive, review the metadata table (it scrolls horizontally on narrow screens), tap "Remove metadata", and download the cleaned file to your device. The before/after verification works identically — you see each field's old value and its "Removed" status before you share anything.
                </p>
                <p>
                  <strong>A Realistic Mobile Scenario</strong><br />
                  Metadata cleaning on mobile is more useful than it might sound: documents are increasingly received and forwarded entirely on phones. Someone emails you a contract, you need to pass it to a third party, and you'd rather not forward the author trail and timestamps along with it. Open the tool in your mobile browser, clean the file, and share the "no-metadata-" copy — all without a computer.
                </p>
                <p>
                  <strong>Privacy Doesn't Depend on the Device</strong><br />
                  Because processing is in-browser, your document stays on your phone just as it would stay on your laptop. Nothing is uploaded over your mobile connection, which also means the tool is light on data usage and keeps working on flaky connections once the page has loaded. Processing speed depends on your phone's processor, and metadata removal is a light operation — even budget devices handle it in seconds.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. Is removing PDF metadata free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, completely free — no fees, no watermarks, and no premium tiers today. Privacy protection shouldn't be a paid upgrade, and BlendPDF treats metadata cleaning as a basic right of anyone sharing documents.
                </p>
                <p>
                  <strong>No Payment, Ever, for This Tool</strong><br />
                  There's no credit card wall, no trial countdown, and no cap on how many documents you can clean per day. Whether you're cleaning one CV or a folder of client deliverables one by one, the tool works the same way at the same price: zero.
                </p>
                <p>
                  <strong>No Account, No Sign-Up</strong><br />
                  You don't need to register or hand over an email address to clean a file. For a privacy tool, requiring you to identify yourself would be a strange start — so the tool simply doesn't. Open the page, select the file, clean, download.
                </p>
                <p>
                  <strong>Everything Included</strong><br />
                  The free tool is the whole tool: the full metadata inspection table, removal of all information fields and timestamps, XMP stream stripping, and the before/after verification pass. There is no "deep clean" held back for a paid tier — what you see described on this page is what every user gets.
                </p>
                <p>
                  <strong>Why It Can Stay Free</strong><br />
                  Because the processing runs in your browser, each use costs BlendPDF essentially nothing in server resources. That economic reality — the same design choice that keeps your file private — is what makes a genuinely free, unlimited metadata remover sustainable.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if metadata removal fails?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Metadata removal is a robust operation, but PDFs in the wild are messy, and a few situations can stop the process. Here's what they look like and how to get past them.
                </p>
                <p>
                  <strong>Password-Protected Files</strong><br />
                  The most common blocker. Encrypted PDFs can't be rewritten, so the tool shows a hint pointing to the <a href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</a> tool rather than attempting a clean that would fail. Unlock the document first (with its password), then clean it.
                </p>
                <p>
                  <strong>Files Over 50MB or Non-PDF Files</strong><br />
                  Oversized files are rejected at selection with a clear message — compress or split them first, then clean the result. Files that aren't actually PDFs (or PDFs with a wrong extension) fail at the reading stage; check that the file opens in a normal PDF viewer.
                </p>
                <p>
                  <strong>Malformed or Corrupted PDFs</strong><br />
                  Some PDFs have damaged internal structures that the parsing engine can't safely read or re-save; these produce a "failed to read" error. The inspection is deliberately tolerant — individual metadata getters that misbehave on malformed documents are skipped rather than crashing the whole table — but a fundamentally broken file can't be cleaned. Re-exporting the PDF from its source application, or running it through the BlendPDF repair tool, usually produces a cleanable file.
                </p>
                <p>
                  <strong>Trust the Verification, Not the Button</strong><br />
                  If a rare edge case prevented part of the cleaning — say, an unusual structure protecting its dates — the before/after table will show it, because the "after" column is read from the actual output file rather than assumed. That honesty is your safety net: if every field shows "Removed", the file is clean; if something still shows a value, you know before you share. For persistent failures, refresh the page and retry, and make sure your browser is up to date, since all processing happens in it.
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
