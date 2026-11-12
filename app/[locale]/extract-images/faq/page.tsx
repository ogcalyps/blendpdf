'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function ExtractImagesFAQ() {
  const faqs = [
    {
      question: 'How to extract images from a PDF online',
      answer: 'Upload your PDF (up to 50MB) and BlendPDF automatically scans every page for embedded pictures, showing thumbnails as it goes. Select the images you want and download one directly as PNG or several bundled in a ZIP. Everything runs in your browser.'
    },
    {
      question: 'What format do the extracted images come in?',
      answer: 'All images are saved as PNG, a lossless format — nothing is recompressed, so you keep the full quality stored in the PDF. Images originally embedded as JPEG are converted to PNG on the way out, so files can be larger than the originals.'
    },
    {
      question: 'Why did I get no images, or just one big image per page?',
      answer: 'The tool extracts pictures embedded as image objects. Charts, logos, and diagrams are often vector graphics — drawn with shapes, not stored as images — so there\'s nothing to extract. Scanned PDFs store each page as one big photo, so you get one full-page image per page.'
    },
    {
      question: 'How is this different from the PDF to Images tool?',
      answer: 'PDF to Images renders each full page as one picture — text, graphics, and all. Extract Images pulls out only the original photos embedded inside the PDF, at their native stored resolution. Use Extract Images for the pictures, PDF to Images for whole pages.'
    },
    {
      question: 'Why do I see fewer images than the PDF appears to contain?',
      answer: 'Duplicates are removed automatically — a logo repeated on every page is extracted once. Tiny images under 16×16 pixels are skipped too, since they\'re usually masks or invisible artifacts. Vector graphics don\'t count as images at all.'
    },
    {
      question: 'Can I choose which images to download?',
      answer: 'Yes. Every found image appears as a selectable thumbnail showing its dimensions and the page it first appears on. Use Select all / Deselect all or toggle images individually — one selected image downloads directly as PNG, multiple download as a ZIP.'
    },
    {
      question: 'Is my PDF uploaded to your servers?',
      answer: 'No. The tool runs 100% in your browser — your PDF is opened, scanned, and converted locally on your device and never uploaded anywhere. There\'s nothing to delete server-side because nothing is ever sent.'
    },
    {
      question: 'Are there page or image limits?',
      answer: 'Files up to 50MB are accepted. To keep your browser responsive, scanning covers the first 200 pages and stops after 500 images — you\'ll see a clear notice if either cap is reached, and splitting the PDF lets you extract the rest.'
    },
    {
      question: 'Is the image quality preserved?',
      answer: 'Yes. Images are extracted at the exact resolution they\'re stored at inside the PDF and saved as lossless PNG — no scaling, no recompression. A 2000×1500 embedded photo comes out as a 2000×1500 PNG.'
    },
    {
      question: 'Does it work with Arabic PDFs?',
      answer: 'Yes. Image extraction reads embedded pictures, which are language-independent — Arabic and RTL documents are scanned exactly like any other PDF, and the fully localized Arabic interface is available too.'
    },
    {
      question: 'How fast is image extraction?',
      answer: 'The scan runs page by page with a live progress bar, typically finishing in seconds. Speed depends on your device and the document\'s size, not on server load — there\'s no upload or download wait.'
    },
    {
      question: 'Can I extract images from password-protected PDFs?',
      answer: 'No, encrypted PDFs are detected and rejected with a hint to unlock them first. If you have the password and permission, remove the protection with an unlock tool, then extract from the unlocked copy.'
    },
    {
      question: 'Can I extract images on mobile devices?',
      answer: 'Yes. The thumbnail grid is touch-friendly on phones and tablets — tap to select images, then download a single PNG or a ZIP straight to your device. Processing happens locally on the phone.'
    },
    {
      question: 'Is extracting images free?',
      answer: 'Yes, completely free — no fees, no watermarks, no account, and no premium tiers today. All features, including the ZIP download and selection controls, are included.'
    },
    {
      question: 'What if extraction fails or produces errors?',
      answer: 'Check that the file is a valid PDF under 50MB and not password-protected. If pages contain only vector graphics you\'ll get a "no images found" result rather than an error — try the PDF to Images tool instead. Refreshing and retrying resolves most one-off failures.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Extract Images from PDF', url: '/extract-images' },
        { name: 'FAQ', url: '/extract-images/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Extract Images from PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-extract" className="text-blue-600 hover:text-blue-800">How to extract images from a PDF online</a></li>
              <li><a href="#output-format" className="text-blue-600 hover:text-blue-800">What format do the extracted images come in?</a></li>
              <li><a href="#no-images" className="text-blue-600 hover:text-blue-800">Why did I get no images, or just one big image per page?</a></li>
              <li><a href="#vs-pdf-to-images" className="text-blue-600 hover:text-blue-800">How is this different from the PDF to Images tool?</a></li>
              <li><a href="#duplicates" className="text-blue-600 hover:text-blue-800">Why do I see fewer images than the PDF appears to contain?</a></li>
              <li><a href="#select-images" className="text-blue-600 hover:text-blue-800">Can I choose which images to download?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">Is my PDF uploaded to your servers?</a></li>
              <li><a href="#limits" className="text-blue-600 hover:text-blue-800">Are there page or image limits?</a></li>
              <li><a href="#image-quality" className="text-blue-600 hover:text-blue-800">Is the image quality preserved?</a></li>
              <li><a href="#arabic-support" className="text-blue-600 hover:text-blue-800">Does it work with Arabic PDFs?</a></li>
              <li><a href="#processing-speed" className="text-blue-600 hover:text-blue-800">How fast is image extraction?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I extract images from password-protected PDFs?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I extract images on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is extracting images free?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if extraction fails or produces errors?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-extract" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to extract images from a PDF online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Getting the pictures out of a PDF with BlendPDF is almost entirely automatic — you pick the file, the tool finds the images, and you choose what to download. Here's the complete flow:
                </p>
                <p>
                  <strong>Open Your PDF</strong><br />
                  Click "Select PDF" or drag and drop your file onto the upload area. Files up to 50MB are accepted. The document is opened directly in your browser — nothing is uploaded — and scanning begins immediately, so there's no separate "start" button to hunt for.
                </p>
                <p>
                  <strong>Watch the Scan</strong><br />
                  The tool walks through your document page by page, showing a live progress bar ("Scanning page 4 of 32…"). On each page it identifies every embedded picture, skips tiny artifacts, removes duplicates it has already seen, and converts each genuine image to a PNG. Thumbnails appear in a grid as images are found, each labeled with its pixel dimensions and the page where it first appears.
                </p>
                <p>
                  <strong>Select What You Want</strong><br />
                  When the scan finishes, all found images are selected by default. Tap or click any thumbnail to toggle it, or use the "Select all" / "Deselect all" buttons. The checkered background behind each thumbnail makes transparent areas visible, so you can tell exactly what each image contains.
                </p>
                <p>
                  <strong>Download</strong><br />
                  Click the download button. If exactly one image is selected, it downloads directly as a PNG file. If several are selected, they're bundled into a ZIP archive named after your document, with each file numbered and labeled with its dimensions (like "brochure_image_003_1200x800.png") so you can identify images without opening them.
                </p>
              </div>
            </section>

            <section id="output-format" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. What format do the extracted images come in?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Every extracted image is delivered as a PNG file. This is a deliberate choice that prioritizes quality and universal compatibility.
                </p>
                <p>
                  <strong>Why PNG</strong><br />
                  PNG is a lossless format: saving an image as PNG never degrades it, no matter what. Whatever pixel data is stored inside your PDF — a photo, a screenshot, a scanned page — comes out with every pixel intact. PNG also supports transparency and opens everywhere: every browser, every operating system, every design and office application.
                </p>
                <p>
                  <strong>JPEGs Are Converted, Not Recompressed</strong><br />
                  Many PDFs store photos internally as JPEG. During extraction those are decoded once and written out as PNG — they are <em>not</em> run through another round of JPEG compression, so no additional quality is lost. The trade-off is file size: PNG represents photographic content less compactly than JPEG, so an extracted photo can be a noticeably larger file than the JPEG bytes inside the PDF, at identical visual quality.
                </p>
                <p>
                  <strong>Need JPEG or Another Format?</strong><br />
                  If your workflow requires JPEG, WebP, or another format, extract as PNG first and convert with any image tool — starting from the lossless PNG means you only ever apply one round of lossy compression, on your terms, with your chosen quality setting.
                </p>
                <p>
                  <strong>Consistent Naming</strong><br />
                  In multi-image downloads, files are named systematically — your document's name, a sequence number, and the pixel dimensions (for example "report_image_012_640x480.png") — which makes sorting and picking out the image you need much easier than a folder of "untitled" files.
                </p>
              </div>
            </section>

            <section id="no-images" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Why did I get no images, or just one big image per page?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Both outcomes are normal for certain kinds of PDFs, and understanding why comes down to how PDFs store visual content internally.
                </p>
                <p>
                  <strong>Vector Graphics Aren't Images</strong><br />
                  PDFs can draw content two ways: as embedded raster images (grids of pixels, like photos) or as vector graphics (mathematical instructions for lines, curves, and fills). Charts, diagrams, logos, and illustrations exported from design or office software are very often vectors. They look like images on the page, but there is no picture file inside the PDF to extract — so a slide deck full of charts can genuinely contain zero extractable images.
                </p>
                <p>
                  <strong>Scanned PDFs: One Photo Per Page</strong><br />
                  Scanners work the opposite way: each scanned page is stored as one large photograph covering the entire page, with any visible text being part of that photo. Extracting images from a scanned PDF therefore yields one full-page image per page — which is technically correct, since that's exactly what the file contains.
                </p>
                <p>
                  <strong>The Tool Tells You Honestly</strong><br />
                  If the scan finds nothing, you get a clear "No embedded images found" explanation rather than a fake error — including a pointer to the likely reason and a suggested alternative. Some borderline cases exist too: images embedded with unusual encodings or used purely as masks may be skipped rather than extracted incorrectly.
                </p>
                <p>
                  <strong>The Right Alternative</strong><br />
                  If what you actually want is a picture of each page — vectors, text, and all — use BlendPDF's PDF to Images tool instead, which renders full pages to image files. The extract tool links you there directly when no embedded images are found.
                </p>
              </div>
            </section>

            <section id="vs-pdf-to-images" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. How is this different from the PDF to Images tool?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The two tools answer different questions. Extract Images asks "what pictures are stored inside this PDF?" PDF to Images asks "what does each page look like?"
                </p>
                <p>
                  <strong>Extract Images: The Originals</strong><br />
                  This tool pulls out the actual embedded picture files at their native stored resolution. If a brochure contains a 3000×2000 product photo displayed at quarter size on the page, you get the full 3000×2000 original — not a screenshot of how it appears. Text, backgrounds, and vector graphics around the photo are not included, because they aren't part of the embedded image.
                </p>
                <p>
                  <strong>PDF to Images: The Pages</strong><br />
                  PDF to Images renders each complete page — text, vectors, images, everything — into one picture per page. The output resolution is determined by the rendering settings, not by any embedded original, and everything on the page is flattened together.
                </p>
                <p>
                  <strong>Choosing Between Them</strong><br />
                  Want the photos out of a report to reuse in a presentation? Extract Images. Want page 3 of a contract as a picture to paste into a chat? PDF to Images. Working with a scanned document? The two converge — each page is one image either way — but PDF to Images gives you control over output resolution, while Extract Images hands you the raw scan exactly as stored.
                </p>
                <p>
                  <strong>They Work Well Together</strong><br />
                  A common workflow is trying Extract Images first to see whether the document carries reusable originals, and falling back to PDF to Images when the content turns out to be vector-drawn or when you want full-page snapshots. Both tools are free, so trying both costs nothing.
                </p>
              </div>
            </section>

            <section id="duplicates" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Why do I see fewer images than the PDF appears to contain?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The extractor applies two deliberate filters that usually make the result <em>more</em> useful, not less — deduplication and a tiny-image cutoff.
                </p>
                <p>
                  <strong>Duplicates Are Extracted Once</strong><br />
                  PDFs reuse image resources: a company logo in the header of every page, a watermark, a repeated divider graphic. Internally these are one image referenced many times, and the tool honors that — each unique image is extracted exactly once, labeled with the page where it first appears. A 40-page letterhead document thus yields one logo file instead of forty identical copies, which is almost always what you actually want.
                </p>
                <p>
                  <strong>Tiny Images Are Skipped</strong><br />
                  Images smaller than 16×16 pixels are ignored. Real content virtually never comes that small; images in that range are almost always technical artifacts — transparency masks, single-pixel spacers, gradient fragments — that would clutter your results with unusable specks.
                </p>
                <p>
                  <strong>What Looks Like an Image May Not Be One</strong><br />
                  As covered above, vector-drawn charts, logos, and decorations aren't stored as images at all, so they never appear in the count. A page can look richly illustrated and still contain only one true embedded image.
                </p>
                <p>
                  <strong>Large-Document Caps</strong><br />
                  For very large files, scanning covers the first 200 pages and stops after 500 unique images, with an explicit notice shown whenever a cap is hit. If your missing images live beyond those caps, split the PDF and run the parts separately — see the limits section for details.
                </p>
              </div>
            </section>

            <section id="select-images" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Can I choose which images to download?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — you never have to take everything. After the scan, the results grid gives you full control over exactly which images end up in your download.
                </p>
                <p>
                  <strong>A Visual, Informative Grid</strong><br />
                  Every found image appears as a thumbnail on a checkered background (so transparent regions are visible), labeled with its pixel dimensions and the page it first appears on. That metadata is often enough to identify what you're after — the big 2400×1600 image on page 1 is the cover photo; the small 200×80 one is the logo.
                </p>
                <p>
                  <strong>Flexible Selection</strong><br />
                  All images start selected. Click or tap any thumbnail to toggle it individually — a checkbox indicator shows its state — or use "Select all" and "Deselect all" to move in bulk. A counter keeps a running total of how many images are currently selected, and the download button reflects it.
                </p>
                <p>
                  <strong>Smart Download Behavior</strong><br />
                  The download adapts to your selection: exactly one image selected downloads directly as a single PNG file with no archive wrapper; two or more are bundled into one ZIP named after your document. You get the lightest-weight result either way.
                </p>
                <p>
                  <strong>Iterate Freely</strong><br />
                  Selection state stays live after a download, so you can grab one image, adjust the selection, and download a different set — all without rescanning, since the images are already extracted in your browser's memory.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Is my PDF uploaded to your servers?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Extract Images runs 100% in your browser. Your PDF — and every image inside it — stays on your device from start to finish.
                </p>
                <p>
                  <strong>The Entire Pipeline Is Local</strong><br />
                  Opening the document, scanning each page for embedded pictures, decoding the image data, converting it to PNG, rendering the thumbnails, and packaging the ZIP — every step is performed by code running in your browser on your own hardware. At no point is your document or any extracted image transmitted over the network.
                </p>
                <p>
                  <strong>No Server Copies, No Deletion Promises Needed</strong><br />
                  Server-based tools have to promise they'll delete your upload afterwards. This tool doesn't need to make that promise: nothing was uploaded, so there is nothing to delete. Your document's contents cannot be read, retained, or leaked from our infrastructure because they never reach it.
                </p>
                <p>
                  <strong>Why That Matters for Images Specifically</strong><br />
                  The images inside PDFs are often the most sensitive part — ID photos, signatures, medical imaging, site photographs, product designs. Extracting them shouldn't mean handing them to a third party. With BlendPDF, it doesn't: the trust model is the same as desktop software.
                </p>
                <p>
                  <strong>Verifiable, and Fast as a Side Effect</strong><br />
                  You can confirm this in your browser's developer tools — the network tab shows no requests carrying your file during extraction. The same architecture is why the tool starts scanning instantly: there's no upload to wait for, and no processed archive to download from a remote server.
                </p>
              </div>
            </section>

            <section id="limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Are there page or image limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, three sensible ones — a 50MB file size limit, a 200-page scanning cap, and a 500-image cap. All exist for the same reason: extraction runs in your browser, and these bounds keep it fast and stable on real-world devices.
                </p>
                <p>
                  <strong>50MB File Size</strong><br />
                  Files up to 50MB can be opened. Most documents fit easily; image-heavy files are precisely the ones that benefit most from extraction, and the majority still land under this ceiling.
                </p>
                <p>
                  <strong>First 200 Pages Scanned</strong><br />
                  For documents longer than 200 pages, the scan covers the first 200 and then stops, showing an explicit notice that later pages weren't scanned. This prevents extremely long documents from tying up your browser for minutes.
                </p>
                <p>
                  <strong>Up to 500 Unique Images</strong><br />
                  If a document yields 500 distinct images, the scan stops there — again with a clear notice. Since duplicates are already removed and thumbnails for every image are held in memory, 500 is a generous practical ceiling that protects your browser's responsiveness.
                </p>
                <p>
                  <strong>Working Beyond the Caps</strong><br />
                  The tool is always honest when a cap is hit — you'll never silently miss images. To extract from beyond page 200 or past the 500-image mark, split the PDF into parts with a split tool and run each part through extraction separately. Each part gets its own fresh 200-page and 500-image budget.
                </p>
              </div>
            </section>

            <section id="image-quality" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. Is the image quality preserved?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Extraction gives you each image at the exact resolution it's stored at inside the PDF, written to a lossless format. Nothing is scaled, sharpened, or recompressed.
                </p>
                <p>
                  <strong>Native Resolution, Not Display Size</strong><br />
                  PDFs often display images smaller than they really are — a 3000-pixel-wide photo placed into a small frame on the page. The extractor reads the stored image data, not the page rendering, so you receive the full 3000-pixel original. This is a key advantage over taking screenshots or rendering pages, both of which are limited to display resolution.
                </p>
                <p>
                  <strong>Lossless Output</strong><br />
                  The decoded pixels are written straight into PNG, which compresses without any loss. Grayscale images, color photos, images with transparency — each is converted faithfully, channel by channel. The only transformation applied is the format conversion itself, and PNG's losslessness guarantees it costs no quality.
                </p>
                <p>
                  <strong>The Ceiling Is the PDF Itself</strong><br />
                  One honest caveat: extraction can't restore quality the PDF never had. If a document was compressed aggressively when it was created — as many email-optimized PDFs are — its embedded images already carry those compression artifacts, and the extracted PNGs will show them too. You get exactly what's in the file: no better, and importantly, no worse.
                </p>
                <p>
                  <strong>Dimensions Up Front</strong><br />
                  Each thumbnail is labeled with the image's true pixel dimensions before you download, so you know immediately whether an image is high-resolution enough for your purpose — print, web, or presentation.
                </p>
              </div>
            </section>

            <section id="arabic-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Does it work with Arabic PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, completely. BlendPDF is built Arabic-first, and image extraction happens to be one of the most language-neutral operations there is.
                </p>
                <p>
                  <strong>Images Have No Text Direction</strong><br />
                  Extraction reads embedded picture data, which is identical regardless of the document's language. An Arabic report, a Hebrew brochure, or a bilingual Arabic-English contract is scanned exactly like an English one — pages are enumerated, embedded images found, duplicates removed. Text shaping and right-to-left layout simply don't enter the picture, because the tool never touches the text layer.
                </p>
                <p>
                  <strong>Scanned Arabic Documents</strong><br />
                  For scanned Arabic documents, each page extracts as one full-page image — the scan photo itself — with the Arabic content rendered inside it exactly as scanned. If your goal is editable or searchable Arabic text rather than pictures, BlendPDF's OCR tool with first-class Arabic support is the right companion; the extract tool gets you the raw page images, OCR gets you the words.
                </p>
                <p>
                  <strong>Arabic Interface Included</strong><br />
                  The tool's interface is fully localized in Arabic with a proper RTL layout — progress messages, selection controls, notices, and all — so the entire extraction workflow can be done in Arabic.
                </p>
                <p>
                  <strong>Regional Documents in Practice</strong><br />
                  We've paid particular attention to document types common across Arabic-speaking regions — official forms with photos and stamps, bilingual commercial documents, scanned records — where pulling out an embedded photo, seal, or signature image cleanly is a frequent need.
                </p>
              </div>
            </section>

            <section id="processing-speed" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. How fast is image extraction?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Fast — most documents finish scanning in a few seconds, and you watch it happen with a live per-page progress bar rather than staring at a spinner.
                </p>
                <p>
                  <strong>No Upload, No Queue</strong><br />
                  Because everything runs locally, the two slowest parts of conventional online tools — uploading your file and downloading the processed result from a server — don't exist here. Scanning starts the instant you choose a file, and downloads are generated straight from your browser's memory.
                </p>
                <p>
                  <strong>What Determines the Time</strong><br />
                  Three factors: page count (each page is analyzed for image references), how many images the document contains (each unique image is decoded and converted to PNG), and image size (a 4000-pixel photo takes longer to convert than an icon). Your device's speed matters too, since it's doing the work — a modern laptop chews through image-heavy documents quickly; an older phone takes proportionally longer.
                </p>
                <p>
                  <strong>Progress You Can Trust</strong><br />
                  The progress bar reports actual pages scanned ("Scanning page 12 of 60…"), and thumbnails appear as images are found — so even on a large document you see results accumulating immediately instead of waiting for a single all-or-nothing finish. The built-in 200-page and 500-image caps guarantee the scan always terminates promptly, with honest notices if a cap was reached.
                </p>
                <p>
                  <strong>ZIP Packaging</strong><br />
                  For multi-image downloads there's a brief packaging step while the ZIP is assembled on your device — typically a second or two, proportional to the total size of the selected images.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I extract images from password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly. If you open an encrypted PDF, the tool detects the protection and shows a clear message with a link to the unlock tool, rather than failing mysteriously partway through a scan.
                </p>
                <p>
                  <strong>Why Encryption Stops the Scan</strong><br />
                  Finding and decoding embedded images requires reading the document's page contents — precisely what encryption locks away. Copy-protection on PDFs frequently exists specifically to prevent content (including images) from being lifted out, and BlendPDF respects that: encrypted files are declined up front with an explanation.
                </p>
                <p>
                  <strong>The Unlock-First Route</strong><br />
                  If the document is yours or you're authorized to work with it, remove the password using a PDF unlock tool, then run the unlocked copy through image extraction normally. Only unlock documents you have the right to modify — a locked PDF from a third party is usually locked for a reason.
                </p>
                <p>
                  <strong>Consistent Across BlendPDF</strong><br />
                  This detect-and-redirect behavior is the same across BlendPDF's tools, so once you've unlocked a file you can crop it, extract pages from it, or pull its images without hitting the encryption wall again.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Can I extract images on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. The tool works on smartphones and tablets, and the thumbnail-based workflow translates naturally to touch screens.
                </p>
                <p>
                  <strong>Touch-First Selection</strong><br />
                  The results grid adapts to your screen — two thumbnail columns on phones, three on larger screens — and each thumbnail is a comfortable tap target for toggling selection. "Select all" and "Deselect all" keep bulk changes to a single tap, and the live counter confirms your selection as you go.
                </p>
                <p>
                  <strong>From Phone Storage or the Cloud</strong><br />
                  Open PDFs from your device's files or downloads. Downloads arrive through the browser's standard mechanism: a single selected image lands as a PNG you can immediately share or set as an attachment; multiple images arrive as a ZIP that both iOS and Android can open natively in their Files apps.
                </p>
                <p>
                  <strong>A Genuinely Useful Mobile Task</strong><br />
                  Extracting an image on the phone is often exactly where the need arises — someone sends you a PDF in chat and you need the photo, logo, or signature image inside it for another app. This tool covers that without a round trip through a desktop.
                </p>
                <p>
                  <strong>Performance Considerations</strong><br />
                  Processing runs on the phone itself, so heavy documents take longer than on a laptop, and thumbnails for hundreds of images consume device memory. The 200-page and 500-image caps exist partly for exactly this situation, keeping the tool responsive even on modest hardware. Nothing is uploaded, so mobile data usage is essentially nil.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. Is extracting images free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, extracting images with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today.
                </p>
                <p>
                  <strong>Everything Included</strong><br />
                  The full feature set is free: automatic page-by-page scanning, duplicate removal, lossless PNG output at native resolution, thumbnail previews with dimensions and page numbers, per-image selection, and ZIP bundling for multi-image downloads. There's no image-count paywall and no "upgrade to download in full quality" trick — full quality is the only quality.
                </p>
                <p>
                  <strong>No Account, No Personal Data</strong><br />
                  You don't need to register or sign in. Open the page, drop a file, download your images. Combined with the fully local processing, this means using the tool leaves neither your documents nor your identity on our servers.
                </p>
                <p>
                  <strong>Unlimited Use</strong><br />
                  Extract from one PDF or a hundred; run the same file repeatedly with different selections. Because your own device does the processing, there's no per-use cost on our side to meter — which is precisely why the tool can stay free without limits.
                </p>
                <p>
                  <strong>The Client-Side Dividend</strong><br />
                  Free, private, and fast all come from the same design decision: doing the work in your browser. No servers to pay for means nothing to charge you for; no uploads means nothing to protect or delete; no network round-trip means no waiting.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if extraction fails or produces errors?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Extraction handles a wide variety of PDFs, but when something does go wrong the cause is usually one of a small set. Here's how to work through them:
                </p>
                <p>
                  <strong>The File Won't Open</strong><br />
                  Check the basics first: the file must be a valid PDF under 50MB. Files merely renamed to .pdf, incomplete downloads, and corrupted documents fail to parse. Confirm the file opens in a normal PDF viewer; if it does but the tool still rejects it, re-saving from that viewer often repairs minor structural damage.
                </p>
                <p>
                  <strong>Password-Protected Files</strong><br />
                  Encrypted PDFs are detected and declined with a message linking to the unlock tool. Unlock the file first (with permission), then extract from the unlocked copy — see the section above.
                </p>
                <p>
                  <strong>"No Images Found" Isn't an Error</strong><br />
                  If the scan completes but reports no embedded images, the document most likely contains vector graphics rather than stored pictures — common for charts, logos, and generated documents. That's an accurate result, not a failure. If you want the pages as pictures anyway, follow the built-in link to the PDF to Images tool.
                </p>
                <p>
                  <strong>Some Images Seem Missing</strong><br />
                  Before suspecting a bug, review the deliberate filters: duplicates are extracted once, images under 16×16 pixels are skipped, and on very large files the 200-page / 500-image caps apply (with visible notices). Occasionally an image with an exotic internal encoding is skipped rather than extracted incorrectly — rendering that page via PDF to Images is the reliable fallback.
                </p>
                <p>
                  <strong>Browser Stalls on Big Files</strong><br />
                  Since your device does the processing, low memory or an overloaded tab can slow or stall extraction of image-heavy documents, especially on older phones. Close other tabs, refresh, and retry; use a current version of Chrome, Firefox, Safari, or Edge. Persistent trouble with one huge file is best solved by splitting it into parts and extracting from each.
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
