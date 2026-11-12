'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function OcrPDFFAQ() {
  const faqs = [
    {
      question: 'What is OCR and what does this tool do?',
      answer: 'OCR (optical character recognition) turns pictures of text — scanned pages or photographed documents — into real text a computer can read. This tool adds the recognized text as an invisible layer inside your PDF, so the file looks identical but becomes searchable, selectable, and copyable.'
    },
    {
      question: 'How to make a scanned PDF searchable',
      answer: 'Upload your scanned PDF, tick the recognition languages it contains (Arabic, English, French, or Spanish), and click the OCR button. Processing takes roughly 1-2 seconds per page, then the searchable PDF downloads with an invisible text layer added over each scan.'
    },
    {
      question: 'How good is the Arabic OCR?',
      answer: 'Arabic is a first-class language here, not an afterthought — the engine uses a dedicated Arabic model that handles connected script and right-to-left text properly. Accuracy depends on scan quality: clean 300-DPI scans of printed Arabic work far better than blurry photos or handwriting.'
    },
    {
      question: 'Which languages are supported?',
      answer: 'Four languages are supported: Arabic, English, French, and Spanish. You can select any combination for mixed-language documents, such as Arabic contracts with English clauses. At least one language must be selected before running OCR.'
    },
    {
      question: 'Does OCR change how my PDF looks?',
      answer: 'No. The recognized text is placed as an invisible layer exactly on top of the original scan, so the document looks identical — stamps, signatures, and layout untouched — but becomes searchable and copyable.'
    },
    {
      question: 'Why does it say my PDF already has text?',
      answer: 'If every page already contains a text layer (like a PDF exported from Word), there is nothing for OCR to add, so the tool tells you instead of silently returning the same file. If the existing text is wrong or garbled, enable the re-OCR option to replace it with freshly recognized text.'
    },
    {
      question: 'What are the file size and page limits?',
      answer: 'Files can be up to 50MB and 50 pages. OCR is computationally heavy — roughly 1-2 seconds per page — so larger documents would time out. Split bigger files with the Split PDF tool and OCR the parts separately, or compress oversized files first.'
    },
    {
      question: 'How long does OCR take?',
      answer: 'Expect roughly 1-2 seconds per page, so a 30-page scan can take about a minute. OCR jobs run one at a time on the server; at busy moments you may be asked to retry in a minute.'
    },
    {
      question: 'How accurate is the OCR?',
      answer: 'Accuracy is good but never perfect, and depends heavily on scan quality. Clean, straight, well-lit 300-DPI scans of printed text give excellent results; blurry photos, skewed pages, and low-resolution scans reduce accuracy in any OCR system.'
    },
    {
      question: 'Can OCR read handwriting?',
      answer: 'Not reliably. The recognition engine is designed for printed, typeset text. Neat block capitals may partially recognize, but cursive handwriting — in any language — generally will not. Handwritten notes and signatures stay visible in the PDF; they just will not become searchable text.'
    },
    {
      question: 'Can I OCR a password-protected PDF?',
      answer: 'No, encrypted PDFs are rejected with a clear message. Remove the password first with the Unlock PDF tool, run OCR on the unlocked file, then re-protect the result if needed.'
    },
    {
      question: 'Can I turn a scanned PDF into a Word document?',
      answer: 'Yes — OCR the scan here first, then run the searchable result through the PDF to Word tool. Without the OCR step a scanned PDF converts to Word as images; with it, you get editable text.'
    },
    {
      question: 'Is OCR free?',
      answer: 'Yes, completely free — no sign-up, no watermarks, and no premium tiers today. Because OCR is the heaviest tool on our servers, usage is limited to 5 documents per 15 minutes, which covers normal use comfortably.'
    },
    {
      question: 'What happens to my files after OCR?',
      answer: 'All uploaded files are automatically deleted from our servers within one hour, most immediately after processing. We never read, store, or share the contents of your documents. No permanent storage is maintained.'
    },
    {
      question: 'What if OCR fails or produces errors?',
      answer: 'The tool reports specific problems: files over 50MB or 50 pages, password-protected PDFs, pages that already have text, or a busy server. Each message says what to do — split, unlock, enable re-OCR, or retry in a minute.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'OCR PDF', url: '/ocr-pdf' },
        { name: 'FAQ', url: '/ocr-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: OCR PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#what-is-ocr" className="text-blue-600 hover:text-blue-800">What is OCR and what does this tool do?</a></li>
              <li><a href="#how-to-ocr" className="text-blue-600 hover:text-blue-800">How to make a scanned PDF searchable</a></li>
              <li><a href="#arabic-ocr" className="text-blue-600 hover:text-blue-800">How good is the Arabic OCR?</a></li>
              <li><a href="#supported-languages" className="text-blue-600 hover:text-blue-800">Which languages are supported?</a></li>
              <li><a href="#visual-output" className="text-blue-600 hover:text-blue-800">Does OCR change how my PDF looks?</a></li>
              <li><a href="#already-has-text" className="text-blue-600 hover:text-blue-800">Why does it say my PDF already has text?</a></li>
              <li><a href="#file-limits" className="text-blue-600 hover:text-blue-800">What are the file size and page limits?</a></li>
              <li><a href="#processing-time" className="text-blue-600 hover:text-blue-800">How long does OCR take?</a></li>
              <li><a href="#accuracy" className="text-blue-600 hover:text-blue-800">How accurate is the OCR?</a></li>
              <li><a href="#handwriting" className="text-blue-600 hover:text-blue-800">Can OCR read handwriting?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I OCR a password-protected PDF?</a></li>
              <li><a href="#pdf-to-word" className="text-blue-600 hover:text-blue-800">Can I turn a scanned PDF into a Word document?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is OCR free?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">What happens to my files after OCR?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if OCR fails or produces errors?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="what-is-ocr" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. What is OCR and what does this tool do?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  OCR — optical character recognition — is the technology that turns pictures of text into actual text a computer can work with. A scanned page is, to a computer, just a photograph: millions of pixels with no notion of words. OCR reads those pixels, recognizes the letter shapes, and reconstructs the text they form.
                </p>
                <p>
                  <strong>The Problem OCR Solves</strong><br />
                  A scanned PDF looks like a document but behaves like an image. You can't search it with Ctrl+F, can't select and copy a paragraph, can't have a screen reader speak it, and document-management systems can't index it. Anyone who has scrolled through a 40-page scanned contract hunting for one clause knows the pain. OCR fixes all of this in a single pass by making the text real.
                </p>
                <p>
                  <strong>What This Tool Produces</strong><br />
                  BlendPDF's OCR tool takes your scanned PDF and returns a searchable PDF: the recognized text is embedded as an invisible layer positioned exactly on top of the original scan. Visually, nothing changes — every stamp, signature, and coffee stain stays put — but underneath, each word now exists as selectable, searchable, copyable text. Search hits highlight in the right place on the page because the invisible text sits precisely over its printed counterpart.
                </p>
                <p>
                  <strong>The Engine Behind It</strong><br />
                  Recognition runs on our servers using the Tesseract OCR engine via ocrmypdf — a mature, widely trusted open-source pipeline used in production archiving systems worldwide. Four language models are installed: Arabic, English, French, and Spanish, selectable in any combination. Pages that already contain text are skipped by default, so running OCR on a partially digital document only processes the pages that need it.
                </p>
              </div>
            </section>

            <section id="how-to-ocr" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. How to make a scanned PDF searchable</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Making a scanned PDF searchable with BlendPDF takes a minute or two, most of which is the OCR engine doing its work. Here's the full workflow:
                </p>
                <p>
                  <strong>Upload Your Scanned PDF</strong><br />
                  Drag and drop your PDF onto the upload area or click "Select File". Files can be up to 50MB and 50 pages. The tool checks the file immediately — a password-protected or oversized PDF is flagged before any processing time is spent.
                </p>
                <p>
                  <strong>Choose Recognition Languages</strong><br />
                  Tick the languages that appear in your document: Arabic, English, French, or any combination. This matters more than people expect — OCR engines recognize text by matching shapes against language-specific models, so telling the engine what to look for significantly improves accuracy. For a French invoice, select French; for an Arabic contract with English clauses, select both Arabic and English. At least one language must be selected.
                </p>
                <p>
                  <strong>Run OCR and Wait Briefly</strong><br />
                  Click the OCR button. Your file is processed on our servers at roughly 1–2 seconds per page, so a 10-page scan finishes in well under a minute while a 50-page document may take a couple of minutes. If a page already contains digital text it's skipped by default; there's also a re-OCR option for replacing an existing bad text layer (covered in its own section below).
                </p>
                <p>
                  <strong>Download the Searchable PDF</strong><br />
                  When processing completes, download the result directly or have it emailed to you. The output file is named after your original with an "ocr-" prefix, looks pixel-identical to what you uploaded, and now responds to search, text selection, and copy-paste in any PDF viewer. It's also ready for follow-up steps like conversion to Word.
                </p>
              </div>
            </section>

            <section id="arabic-ocr" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. How good is the Arabic OCR?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Arabic OCR is BlendPDF's headline capability — a first-class language, not a checkbox afterthought. Most online OCR tools treat Arabic poorly or not at all, which leaves a huge amount of the world's scanned paperwork effectively unsearchable. This tool was built with Arabic documents as a primary use case.
                </p>
                <p>
                  <strong>Why Arabic OCR Is Genuinely Hard</strong><br />
                  Arabic script is cursive by design: letters connect within words and change shape depending on their position — initial, medial, final, or isolated. Add right-to-left text flow, optional diacritics (tashkeel), and ligatures, and you have a script that naive OCR pipelines mangle badly. Recognizing Arabic well requires a model trained specifically on the script's connected forms, not a Latin-alphabet engine with an Arabic dictionary bolted on.
                </p>
                <p>
                  <strong>How BlendPDF Handles It</strong><br />
                  The tool uses the Tesseract engine's dedicated Arabic model, which was trained on connected Arabic script and handles right-to-left text properly. The recognized text layer preserves the reading order, so searching for an Arabic word finds it and highlights the right spot on the scanned page, and copying a passage pastes coherent right-to-left text. Mixed documents are well supported too: select Arabic and English together for contracts, invoices, and government forms that interleave both scripts.
                </p>
                <p>
                  <strong>Honest Accuracy Expectations</strong><br />
                  Accuracy is good but not perfect, and scan quality dominates the outcome. Clean 300-DPI scans of printed Arabic — books, contracts, official documents — recognize very well. Blurry phone photos, skewed pages, small fonts, and heavy diacritics reduce accuracy, and handwritten Arabic is largely beyond any OCR engine today. For best results, scan straight, well-lit pages at 300 DPI, and select only the languages actually present in the document.
                </p>
                <p>
                  <strong>What This Unlocks for Arabic Documents</strong><br />
                  A searchable Arabic PDF changes how you work with it: find a clause in a 50-page contract in seconds, copy a paragraph into an email without retyping, index decades of Arabic archives in a document-management system, and make documents accessible to screen readers. Combined with BlendPDF's PDF to Word tool, an OCRed Arabic scan can even become an editable document — a workflow that's remarkably rare to find done properly online.
                </p>
              </div>
            </section>

            <section id="supported-languages" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Which languages are supported?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The tool supports exactly four recognition languages: Arabic, English, French, and Spanish. You select them with checkboxes before running OCR, and any combination is allowed.
                </p>
                <p>
                  <strong>Why These Three</strong><br />
                  Each supported language requires a trained recognition model installed and maintained on the OCR server, and quality beats quantity: these three models are the ones installed, verified, and tested on real documents. Arabic is the differentiator, English is the global default, and French rounds out the set — together they also cover the common bilingual document ecosystems of the Middle East and North Africa, where Arabic-French and Arabic-English paperwork is everyday reality.
                </p>
                <p>
                  <strong>Combining Languages for Mixed Documents</strong><br />
                  Real documents are often multilingual: an Arabic lease with English names and figures, a French invoice with English product descriptions. Tick every language that appears and the engine recognizes them together in one pass. A practical tip: select the languages the document actually contains and no more — adding unused languages gives the engine more ways to misread ambiguous characters and slows processing slightly.
                </p>
                <p>
                  <strong>What About Other Languages?</strong><br />
                  Languages outside these three — Spanish, German, Chinese, Urdu, and so on — are not supported, and the tool won't pretend otherwise: submitting an unsupported language code is rejected outright. Text in an unsupported language will either recognize poorly or come out as noise, since the engine tries to interpret it through the models it has. If your document is entirely in an unsupported language, this tool isn't the right fit for it today.
                </p>
              </div>
            </section>

            <section id="visual-output" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Does OCR change how my PDF looks?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No — and this is one of the most important things to understand about the tool. The output PDF is visually identical to the input. What changes is invisible: a text layer added underneath your search cursor, not on top of your document.
                </p>
                <p>
                  <strong>The Invisible Text Layer</strong><br />
                  The recognized text is embedded as invisible characters positioned precisely over the corresponding printed words in the scan. Your eyes see the original scanned image, exactly as before; the computer sees real text at the same coordinates. That's why searching highlights the right region of the page and why selecting with the mouse sweeps across the printed lines naturally — the invisible layer and the visible image are aligned word by word.
                </p>
                <p>
                  <strong>Everything Visual Is Preserved</strong><br />
                  Stamps, seals, signatures, handwritten margin notes, letterheads, photos, tables, and the exact appearance of the original scan all remain untouched. This matters for documents with legal or archival weight: the OCRed file still shows precisely what was on the paper. OCR here is additive — it never redraws, cleans up, or reflows your pages.
                </p>
                <p>
                  <strong>What You Gain Without Any Visual Cost</strong><br />
                  After OCR, the document responds like a born-digital PDF: Ctrl+F finds words, text can be selected and copied, screen readers can speak the content, and search indexes can ingest it. File size typically grows only modestly, since text data is tiny compared to scanned images. In short: same document to the eye, dramatically more useful document to the machine.
                </p>
              </div>
            </section>

            <section id="already-has-text" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Why does it say my PDF already has text?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  If you see this message, every page of your PDF already contains a digital text layer — meaning there is nothing for OCR to add. Rather than silently returning your file unchanged and letting you think work was done, the tool tells you explicitly.
                </p>
                <p>
                  <strong>Why This Happens</strong><br />
                  PDFs exported from Word, Google Docs, or any modern application are born digital: their text is already real text, and they're already searchable. Try Ctrl+F in your PDF viewer — if search works, the document doesn't need OCR. This check protects you from wasted processing and from the false impression that the file was improved.
                </p>
                <p>
                  <strong>Skip-by-Default for Mixed Documents</strong><br />
                  By default, the tool skips pages that already contain text and OCRs only the pages that don't. This is the right behavior for hybrid files — say, a digital report with scanned appendices stapled on: the scanned pages gain a text layer while the digital pages pass through untouched. The "already has text" message appears only when literally every page has text, leaving OCR nothing to do.
                </p>
                <p>
                  <strong>When the Existing Text Is Garbage: Re-OCR Mode</strong><br />
                  Sometimes a PDF has a text layer that's wrong — a previous tool's low-quality OCR, mis-encoded characters that copy as gibberish, or a bad text layer over an Arabic scan produced by a Latin-only engine. For these cases, enable the "Re-OCR pages that already have text" option before processing: existing recognized text is discarded and replaced with a fresh recognition pass using the languages you selected. This is frequently the fix for Arabic scans that were OCRed badly elsewhere.
                </p>
              </div>
            </section>

            <section id="file-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. What are the file size and page limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  OCR jobs are limited to 50MB per file and 50 pages per document. Unlike most PDF tools, OCR has a page limit as well as a size limit — and there's a good reason for it.
                </p>
                <p>
                  <strong>Why a Page Limit Exists</strong><br />
                  OCR is by far the most computationally expensive operation BlendPDF offers: every page is essentially a full image-analysis task taking one to two seconds of dedicated processing. A 500-page scan would monopolize the server for many minutes and time out long before finishing. Capping jobs at 50 pages keeps every user's job inside a window where it reliably completes — a deliberate honesty trade-off: a hard limit stated upfront beats accepting files that fail halfway.
                </p>
                <p>
                  <strong>Handling Documents Over 50 Pages</strong><br />
                  Split the file first with BlendPDF's Split PDF tool — for example, a 120-page archive becomes three ~40-page parts — then OCR each part separately. If you want a single file back at the end, merge the OCRed parts with the Merge PDF tool. It's an extra step, but each piece processes quickly and dependably, and the final result is identical to what a single giant job would have produced.
                </p>
                <p>
                  <strong>Handling Files Over 50MB</strong><br />
                  Scanned PDFs get large because of image resolution, and a 50-page scan at high DPI can exceed 50MB. Run the file through the Compress PDF tool first to bring it under the limit. One caution: OCR accuracy depends on image quality, so prefer moderate compression — a still-crisp 300-DPI scan compresses fine, while crushing a scan to a fraction of its size can degrade the text the OCR engine needs to read.
                </p>
              </div>
            </section>

            <section id="processing-time" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. How long does OCR take?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  OCR is genuinely slow compared to other PDF operations, and it's better to know that upfront: expect roughly 1–2 seconds per page. A 5-page scan finishes in seconds; a 50-page document can take a couple of minutes.
                </p>
                <p>
                  <strong>Why OCR Takes Longer Than Other Tools</strong><br />
                  Rotating or merging a PDF shuffles existing data; OCR performs image analysis on every page — locating text regions, segmenting lines and words, and running each character through a recognition model. Selecting multiple languages adds a little more work per page. This cost is inherent to OCR everywhere; desktop OCR software takes comparable time per page on similar hardware.
                </p>
                <p>
                  <strong>One Job at a Time</strong><br />
                  Because recognition is CPU- and memory-intensive, the server processes OCR jobs one at a time, with a short queue behind the active job. At busy moments your document may briefly wait its turn, and if the queue is full you'll get a clear "service is busy" message asking you to retry in a minute — the honest alternative to accepting your file and letting it stall. Retrying shortly after almost always goes straight through.
                </p>
                <p>
                  <strong>Practical Expectations</strong><br />
                  As a rule of thumb: under 10 pages feels quick, 10–30 pages is a short coffee-sip wait, and 30–50 pages can approach a couple of minutes — the progress state is shown while you wait, and the download starts the moment recognition completes. If you're processing a large split archive part by part, expect each ~40-page chunk to take about a minute, plus its upload time on your connection.
                </p>
              </div>
            </section>

            <section id="accuracy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. How accurate is the OCR?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Good but never perfect — and any OCR service claiming perfection is overselling. Recognition accuracy is dominated by one factor above all others: the quality of the scan you feed in.
                </p>
                <p>
                  <strong>What Excellent Input Looks Like</strong><br />
                  A flatbed scan at 300 DPI of a cleanly printed page — a book, a laser-printed contract, an official form — recognizes with very high accuracy in all three supported languages. The characteristics that matter: sharp focus, straight alignment, even lighting, standard-size printed fonts, and good contrast between ink and paper. Documents like this routinely come out with only occasional errors.
                </p>
                <p>
                  <strong>What Degrades Recognition</strong><br />
                  Blurry or low-resolution images (under ~200 DPI), pages photographed at an angle, shadows and uneven phone-camera lighting, very small print, decorative fonts, colored backgrounds, faded ink, and noisy photocopies-of-photocopies all cut into accuracy. Skew is especially damaging for Arabic, where the connected baseline carries much of the letter information. None of these make OCR useless — but expect more errors as quality drops.
                </p>
                <p>
                  <strong>Getting the Best Results</strong><br />
                  Three habits make the biggest difference. First, scan at 300 DPI with a scanner app or flatbed rather than snapping casual photos — scanner apps that flatten and straighten the page (like the built-in document mode in iOS Notes or Google Drive) count. Second, keep pages straight and evenly lit. Third, select exactly the languages present in the document — the engine reads ambiguous shapes better when it isn't juggling irrelevant models.
                </p>
                <p>
                  <strong>Verifying the Output</strong><br />
                  Since the original scan stays visible and unchanged, checking accuracy is easy: search for a few key terms you know are in the document, or select-and-copy a paragraph and read it. For critical documents — legal filings, records that feed downstream systems — spot-check the passages that matter. If the result disappoints and the source scan was poor, rescanning at higher quality and re-running OCR is usually worth far more than any post-processing.
                </p>
              </div>
            </section>

            <section id="handwriting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Can OCR read handwriting?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not reliably, and it's better to say so plainly: this tool's recognition engine is designed for printed, typeset text. Handwriting recognition is a fundamentally different and much harder problem.
                </p>
                <p>
                  <strong>Why Handwriting Defeats Print-Trained OCR</strong><br />
                  Printed characters are consistent — every "m" in a font looks like every other "m", which is exactly what recognition models learn. Handwriting has no such consistency: letterforms vary between writers, within a single writer's page, and even within a word. Cursive writing compounds this by joining letters unpredictably. The Tesseract models used here were trained on print, so handwritten passages typically produce fragments or nothing usable — in English, French, and Arabic alike.
                </p>
                <p>
                  <strong>What Happens to Handwriting in Your Document</strong><br />
                  Nothing bad — it just stays as it is. Handwritten signatures, margin notes, and filled-in form fields remain perfectly visible in the output PDF, because OCR never alters the scanned image. They simply won't become searchable text. For a typical printed contract with handwritten signatures, this is exactly the right outcome: the printed terms become searchable while the signatures remain as visual evidence.
                </p>
                <p>
                  <strong>Partial Exceptions and Alternatives</strong><br />
                  Very neat, separated block capitals — the style used on some hand-printed forms — sometimes recognize partially, but treat any success as a bonus rather than a plan. If your core need is digitizing handwritten material, dedicated handwriting-recognition (ICR) systems are the right category of tool. For the far more common case — printed documents that happen to contain some handwriting — this tool does precisely what you want.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I OCR a password-protected PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No — encrypted PDFs are detected before processing begins and rejected with a clear message. The fix is a quick two-step workflow using BlendPDF's own tools.
                </p>
                <p>
                  <strong>Why Encrypted Files Are Rejected</strong><br />
                  OCR has to read every page image and write a new text layer into the document — operations an encrypted file is specifically designed to prevent without authorization. Rather than failing cryptically halfway through, the tool checks for encryption upfront and tells you immediately, before any of your time or the server's processing window is spent.
                </p>
                <p>
                  <strong>The Unlock-Then-OCR Workflow</strong><br />
                  Use BlendPDF's Unlock PDF tool to remove the password first (the error message links you straight there). Once unlocked, upload the file to the OCR tool and process it normally. If the document should stay protected, re-apply password protection to the OCRed result afterwards — you end up with a file that is both searchable and secured. The two extra steps take under a minute combined.
                </p>
                <p>
                  <strong>Only Unlock What's Yours to Unlock</strong><br />
                  Password protection exists because someone chose to restrict the document. Only remove protection from PDFs you own or have explicit permission to modify, and follow your organization's document-security policies when handling protected material. For sensitive unlocked files, remember the standard privacy guarantee applies during OCR: automatic deletion within an hour, most immediately after processing, with no human access.
                </p>
              </div>
            </section>

            <section id="pdf-to-word" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I turn a scanned PDF into a Word document?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — and this is one of the most powerful workflows on BlendPDF: OCR the scan first, then convert the searchable result to Word. The order of operations is what makes it work.
                </p>
                <p>
                  <strong>Why the OCR Step Comes First</strong><br />
                  A PDF-to-Word converter can only extract text that exists as text. Feed it a raw scan and there is no text to extract — the pages arrive in Word as embedded pictures you can't edit. Run OCR first, though, and the scan gains a real text layer; the converter can then pull genuine, editable text into the Word document. Skipping the OCR step is the single most common reason people believe "scanned PDFs can't be converted to Word".
                </p>
                <p>
                  <strong>The Full Workflow</strong><br />
                  Step one: upload your scan here, select its languages, run OCR, and download the searchable PDF. Step two: feed that output into BlendPDF's PDF to Word tool and download the .docx. Total time for a typical document is a couple of minutes, and both steps are free. The resulting Word file contains the recognized text ready for editing, reformatting, or copying into other documents.
                </p>
                <p>
                  <strong>Set Expectations for the Result</strong><br />
                  The Word document's text quality mirrors the OCR accuracy — a clean 300-DPI scan yields clean editable text, while a rough scan yields text needing correction. Layout reconstruction is approximate for visually complex pages; multi-column layouts and dense tables may need manual tidying in Word. For Arabic documents this workflow is particularly valuable and rare to find done properly online: a scanned Arabic contract can become genuinely editable Arabic text, thanks to the first-class Arabic recognition underneath.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Is OCR free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — OCR on BlendPDF is completely free, with no fees, no watermarks, and no premium tiers today. That's notable because OCR is precisely the feature most competing services lock behind a paywall.
                </p>
                <p>
                  <strong>Free Where It Usually Isn't</strong><br />
                  Because OCR is computationally expensive, most online PDF services offer it only in paid plans, cap free users at a few pages, or stamp watermarks on output. BlendPDF's OCR — including the Arabic recognition that's genuinely hard to find elsewhere — is simply free: full documents up to the 50-page limit, all four languages, invisible-text-layer output, no branding added to your files.
                </p>
                <p>
                  <strong>The One Honest Constraint: Rate Limiting</strong><br />
                  The heaviest tool on the servers carries the tightest fair-use limit: 5 OCR jobs per 15-minute window per user. For normal use — a few documents in a sitting — you'll never notice it. If you're batch-processing a split archive, you may need to pause a few minutes between batches of five. The limit exists to keep the shared, free service responsive for everyone, and it resets automatically.
                </p>
                <p>
                  <strong>No Account, No Strings</strong><br />
                  There's no registration, no sign-in, and no personal information required to run OCR. Upload, select languages, process, download. After processing you'll see an optional email-delivery choice for receiving the file in your inbox — useful when you start a job on your phone and want the result on your laptop — but direct download is always available and nothing is gated behind providing an address.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What happens to my files after OCR?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Documents that need OCR are often exactly the sensitive kind — contracts, IDs, court filings, medical records that exist only on paper. BlendPDF's handling is built for that reality: your file lives on our servers only for the minutes the recognition takes.
                </p>
                <p>
                  <strong>Why OCR Runs on the Server At All</strong><br />
                  Some BlendPDF tools process files entirely in your browser, but text recognition is too heavy for that — the recognition models and the per-page image analysis need real server resources, especially for Arabic. So the honest description is: your file is uploaded, processed in temporary storage on our server, returned to you, and deleted. Given that, the deletion policy below is what makes the privacy story solid.
                </p>
                <p>
                  <strong>Automatic Deletion Within One Hour</strong><br />
                  All uploaded files are automatically deleted within one hour of upload, and most are removed immediately after processing — the temporary working files OCR creates are cleaned up as part of the job itself, whether it succeeds or fails. Deletion is systematic and irreversible; there is no archive or backup of user uploads from which a document could later be retrieved.
                </p>
                <p>
                  <strong>No Permanent Storage, No Human Access, No Text Retention</strong><br />
                  We keep no copies of your PDFs or of the OCRed versions. Critically for an OCR tool: the text the engine recognizes is written into your output PDF and nowhere else — it is not logged, indexed, analyzed, or stored on our side. No employee reads your documents; the pipeline is fully automated end to end. Files travel over encrypted HTTPS in both directions and are processed in an isolated server environment, so the practical exposure window is the few minutes of recognition itself.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if OCR fails or produces errors?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The OCR tool is deliberately talkative about failure: instead of a generic error, it reports the specific problem and what to do about it. Here's what each situation means.
                </p>
                <p>
                  <strong>Errors Before Processing Starts</strong><br />
                  These are validation checks that save you time. A file over 50MB is rejected with a pointer to the Compress PDF tool; a document over 50 pages is rejected with the page count and a suggestion to split it first; a password-protected PDF is flagged with a link to the Unlock PDF tool; and a file that isn't actually a valid PDF is caught immediately. Each of these has a straightforward fix described in the message itself.
                </p>
                <p>
                  <strong>"Already Has Text" and Bad Text Layers</strong><br />
                  If every page already contains text, the tool tells you there's nothing to OCR — usually meaning your document is already searchable (try Ctrl+F). If the existing text is wrong or garbled, re-run with the "Re-OCR pages that already have text" option enabled to replace it with a fresh recognition pass. See the dedicated section above for the full explanation.
                </p>
                <p>
                  <strong>Busy Server and Rate Limits</strong><br />
                  Because OCR jobs run one at a time, a burst of traffic can fill the short queue, producing a "service is busy" message — wait a minute and retry, which almost always succeeds. Separately, running more than 5 OCR jobs in 15 minutes trips the fair-use limit with a clear message and a wait time. Neither indicates anything wrong with your file.
                </p>
                <p>
                  <strong>Genuine Processing Failures</strong><br />
                  Rarely, recognition itself fails — typically with corrupted PDFs or unusual scan encodings. First verify the file opens normally in a PDF viewer. If it does, re-save or "print to PDF" a fresh copy and retry; regeneration fixes most structural quirks. If a specific file keeps failing, split out a few pages and test those to isolate whether one damaged page is poisoning the job. And if OCR is reported as temporarily unavailable, that's a server-side condition — your file is fine; try again a little later.
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
