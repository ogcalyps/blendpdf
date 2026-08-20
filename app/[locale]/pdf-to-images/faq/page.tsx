'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function PDFToImagesFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How to convert PDF pages to images online',
      answer: 'Upload your PDF, choose JPG or PNG, and click convert. Every page is rendered as a separate 300 DPI image. You can preview each page, download individual images, or grab all of them at once as a ZIP file. No account or email is required.'
    },
    {
      question: 'Should I choose JPG or PNG?',
      answer: 'PNG is lossless and best for pages with text, line art, or diagrams, where crisp edges matter. JPG produces smaller files and works well for photo-heavy pages. If you are unsure, PNG for documents, JPG for photos.'
    },
    {
      question: 'What resolution and quality do I get?',
      answer: 'Pages are rendered at a true 300 DPI, meaning an A4 page becomes an image of roughly 2480 x 3508 pixels. That is print-quality resolution, and JPG output uses a high quality setting of 95 to keep compression artifacts minimal.'
    },
    {
      question: 'Is the PDF to images converter free, without a watermark?',
      answer: 'Yes. No watermark on any image, no per-page fees, no sign-up, and no paid tier. The technical limits are 50MB per file and 100 pages per conversion.'
    },
    {
      question: 'Is it safe to convert my PDF online?',
      answer: 'Files are uploaded over an encrypted connection, document contents are never read, stored, or shared, and files are deleted from our servers within one hour, most immediately after processing. No account is needed. We use Google Analytics for aggregate, anonymous usage measurement only.'
    },
    {
      question: 'How many pages can I convert?',
      answer: 'Up to 100 pages per conversion, with each page becoming one image. If your PDF is longer, split it with the BlendPDF split tool and convert it in parts. The file itself can be up to 50MB.'
    },
    {
      question: 'How do I receive the images?',
      answer: 'All pages arrive in a single ZIP file with zero-padded names like page-001.jpg so they sort in the correct order. You can also preview every page in the browser and download any single page individually without downloading the whole ZIP.'
    },
    {
      question: 'Can I convert only specific pages?',
      answer: 'Not directly; the tool converts every page. To convert a subset, first extract the pages you want using the BlendPDF split or delete-pages tool, then convert the smaller PDF. That also keeps the ZIP small.'
    },
    {
      question: 'Does it work with Arabic and RTL PDFs?',
      answer: 'Yes, very well. Rendering to an image is a faithful visual snapshot of each page, so Arabic, Hebrew, Persian, and Urdu text appears exactly as it does in the PDF, with no text reconstruction involved and nothing to reflow or misorder.'
    },
    {
      question: 'Will scanned PDFs convert properly?',
      answer: 'Yes. A scanned PDF is already images inside a PDF wrapper, so conversion simply exports each page. Output quality mirrors the original scan; rendering at 300 DPI cannot add detail that the scanner did not capture.'
    },
    {
      question: 'Can I search or copy text from the images?',
      answer: 'No. JPG and PNG files contain pixels only, with no text layer, so the images are not searchable and text cannot be selected. If you need editable text, use the BlendPDF PDF to Word tool on a text-based PDF; note there is no OCR yet for scans.'
    },
    {
      question: 'Can I convert a password-protected PDF to images?',
      answer: 'No. Encrypted PDFs cannot be rendered. If you have the password and the right to use the document, remove the protection with the BlendPDF unlock tool first, then convert.'
    },
    {
      question: 'Why not just take screenshots?',
      answer: 'Screenshots are capped at your screen resolution, typically 100-150 DPI of effective detail, and capturing a long document page by page is slow and error-prone. This tool renders every page at a true 300 DPI in one pass, with consistent sizing and correct ordering.'
    },
    {
      question: 'What if the conversion fails or the ZIP is huge?',
      answer: 'Check the file is a valid, unencrypted PDF under 50MB and 100 pages. For a smaller ZIP, choose JPG instead of PNG. Repeated failures on a damaged file can often be fixed by running it through the BlendPDF repair tool first. The rate limit is about 10 conversions per 15 minutes.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'PDF to Images', url: '/pdf-to-images' },
        { name: 'FAQ', url: '/pdf-to-images/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Link href="/pdf-to-images" className="mb-6 inline-block text-blue-600 hover:text-blue-800">
            &larr; Back to the PDF to Images converter
          </Link>
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: PDF to Images
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-convert" className="text-blue-600 hover:text-blue-800">How to convert PDF pages to images online</a></li>
              <li><a href="#jpg-or-png" className="text-blue-600 hover:text-blue-800">Should I choose JPG or PNG?</a></li>
              <li><a href="#resolution-quality" className="text-blue-600 hover:text-blue-800">What resolution and quality do I get?</a></li>
              <li><a href="#is-it-free" className="text-blue-600 hover:text-blue-800">Is the PDF to images converter free, without a watermark?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to convert my PDF online?</a></li>
              <li><a href="#page-limits" className="text-blue-600 hover:text-blue-800">How many pages can I convert?</a></li>
              <li><a href="#how-delivered" className="text-blue-600 hover:text-blue-800">How do I receive the images?</a></li>
              <li><a href="#specific-pages" className="text-blue-600 hover:text-blue-800">Can I convert only specific pages?</a></li>
              <li><a href="#arabic-rtl" className="text-blue-600 hover:text-blue-800">Does it work with Arabic and RTL PDFs?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Will scanned PDFs convert properly?</a></li>
              <li><a href="#searchable-text" className="text-blue-600 hover:text-blue-800">Can I search or copy text from the images?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I convert a password-protected PDF to images?</a></li>
              <li><a href="#vs-screenshots" className="text-blue-600 hover:text-blue-800">Why not just take screenshots?</a></li>
              <li><a href="#troubleshooting" className="text-blue-600 hover:text-blue-800">What if the conversion fails or the ZIP is huge?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-convert" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to convert PDF pages to images online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Turning a PDF into a set of images takes under a minute for most documents.
                </p>
                <p>
                  <strong>Upload and choose a format</strong><br />
                  Drag and drop your PDF onto the upload area or click to browse; Google Drive is also supported. One PDF at a time, up to 50MB and 100 pages. Then pick your output format: JPG or PNG.
                </p>
                <p>
                  <strong>Convert</strong><br />
                  Click convert. Each page is rendered server-side at a true 300 DPI, high enough for printing, and the pages appear as previews in your browser as soon as the conversion finishes.
                </p>
                <p>
                  <strong>Download</strong><br />
                  Hover over any page to preview it larger, download single pages individually, or download everything at once as a ZIP file with the images named in page order. No account or email is required; an optional email-delivery choice exists if you want the ZIP sent to an inbox.
                </p>
              </div>
            </section>

            <section id="jpg-or-png" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. Should I choose JPG or PNG?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Both are rendered from the same 300 DPI source, so the difference is purely in how each format stores the result.
                </p>
                <p>
                  <strong>Choose PNG for documents</strong><br />
                  PNG is lossless: text edges, thin lines, and diagrams stay perfectly crisp with no compression artifacts. The trade-off is larger files, especially for pages containing photographs.
                </p>
                <p>
                  <strong>Choose JPG for photos and smaller files</strong><br />
                  JPG compresses photographic content efficiently, and our quality setting of 95 keeps artifacts barely perceptible. On pages that are mostly text you may notice slight softness around letters if you zoom in, which is normal for JPG.
                </p>
                <p>
                  <strong>Rule of thumb</strong><br />
                  Text, forms, diagrams, anything you might print: PNG. Photo-heavy pages, web use, or email attachments where size matters: JPG. You can convert the same PDF twice with different formats if you need both.
                </p>
              </div>
            </section>

            <section id="resolution-quality" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. What resolution and quality do I get?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Pages are rendered at a true 300 DPI, and "true" is worth emphasizing: the render scale is computed exactly from the PDF's own page dimensions, so 300 DPI means 300 real dots per inch of page, not an upscaled lower-resolution render.
                </p>
                <p>
                  <strong>What that means in pixels</strong><br />
                  An A4 page (8.27 x 11.69 inches) becomes an image of roughly 2480 x 3508 pixels; a US Letter page becomes about 2550 x 3300 pixels. That is the same resolution print shops typically request, so the images are suitable for printing, archiving, or zooming into fine detail.
                </p>
                <p>
                  <strong>Vector content shines</strong><br />
                  Text and vector graphics in a PDF have no inherent resolution, so rendering them at 300 DPI produces genuinely sharp output. Embedded photos, on the other hand, can only be as sharp as they were in the PDF; rendering cannot invent detail that is not there.
                </p>
              </div>
            </section>

            <section id="is-it-free" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Is the PDF to images converter free, without a watermark?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes on both counts. The images you download are clean, exactly what was on the PDF page, with no watermark, badge, or footer added, at full 300 DPI resolution.
                </p>
                <p>
                  <strong>No sign-up, no paywall</strong><br />
                  There is no account system, no trial that expires, and no premium tier holding back quality or page count. The real limits are technical: 50MB per file, 100 pages per conversion, and roughly 10 conversions per 15 minutes per user so the service stays responsive for everyone.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Is it safe to convert my PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Here is precisely how your file is handled, so you can judge for yourself.
                </p>
                <p>
                  <strong>Processing and deletion</strong><br />
                  Your PDF is uploaded over an encrypted HTTPS connection and rendered to images automatically on the server; no person views your document, and document contents are never read for any purpose beyond the conversion, never stored long-term, and never shared. The temporary page images created during processing are removed immediately after the ZIP is built, and all files are deleted from our servers within one hour.
                </p>
                <p>
                  <strong>What we measure</strong><br />
                  We use Google Analytics for aggregate, anonymous usage statistics, like how many conversions ran, never anything involving document contents. No account is needed, and downloading never requires an email address.
                </p>
              </div>
            </section>

            <section id="page-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. How many pages can I convert?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Up to 100 pages per conversion, with each page becoming one image file.
                </p>
                <p>
                  <strong>Why the limit exists</strong><br />
                  Rendering at 300 DPI is memory-intensive, roughly 25 megapixels per A4 page, and the limit keeps conversions fast and reliable rather than failing halfway through. If your PDF has more than 100 pages, the tool tells you before doing any work instead of silently truncating.
                </p>
                <p>
                  <strong>Converting longer documents</strong><br />
                  Split the PDF into chunks of up to 100 pages with the BlendPDF split tool, convert each chunk, and you will have a complete image set. The zero-padded filenames within each ZIP keep the ordering unambiguous.
                </p>
              </div>
            </section>

            <section id="how-delivered" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. How do I receive the images?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Two ways, and you can use both in the same session.
                </p>
                <p>
                  <strong>Everything at once: the ZIP</strong><br />
                  All pages are packaged into a single ZIP download. Inside, images are named page-001.jpg, page-002.jpg, and so on (or .png), zero-padded so they sort in correct page order in any file manager, which matters once a document passes page 10.
                </p>
                <p>
                  <strong>One page at a time</strong><br />
                  After conversion, every page appears as a thumbnail in the browser. Hover to see a larger preview, and click the download button on any thumbnail to save just that page, handy when you only need page 7 of a 60-page document but want to eyeball the rest first.
                </p>
              </div>
            </section>

            <section id="specific-pages" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Can I convert only specific pages?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  There is no page-range picker on this tool; it converts every page of whatever PDF you give it. But you have two practical options.
                </p>
                <p>
                  <strong>Option 1: download selectively</strong><br />
                  Convert the whole document, then download only the individual pages you need from the preview grid. Simple, and fine for short documents.
                </p>
                <p>
                  <strong>Option 2: trim the PDF first</strong><br />
                  For long documents, extract the pages you want using the BlendPDF split tool (or remove unwanted ones with delete-pages), then convert the trimmed PDF. This is faster, keeps you well under the 100-page limit, and produces a ZIP containing exactly the pages you care about.
                </p>
              </div>
            </section>

            <section id="arabic-rtl" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. Does it work with Arabic and RTL PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, and this is one of the tools where Arabic support is at its strongest, for a structural reason worth understanding.
                </p>
                <p>
                  <strong>Rendering does not touch the text</strong><br />
                  Converting a page to an image is a visual snapshot: the renderer draws the page exactly as a PDF viewer would, then saves the pixels. There is no text extraction, no reordering, and no reflowing, which are the steps where right-to-left text goes wrong in other tools. Arabic, Hebrew, Persian, and Urdu pages come out looking exactly like the original, ligatures and all.
                </p>
                <p>
                  <strong>One caveat about fonts</strong><br />
                  If the PDF did not embed its fonts, the renderer substitutes standard ones, which can subtly change letterforms. Nearly all professionally produced PDFs embed their fonts, so this is rare in practice, but it is the one case where the image may differ slightly from what you see in a viewer using the same missing font.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Will scanned PDFs convert properly?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Unlike our PDF to Word and PDF to Excel tools, which need a text layer and therefore cannot handle scans (there is no OCR yet), converting to images works perfectly on scanned PDFs, because a scan is already an image wrapped in PDF pages.
                </p>
                <p>
                  <strong>Quality expectations</strong><br />
                  The output mirrors the original scan. If the document was scanned at 200 DPI, rendering at 300 DPI will not add detail; you will get a faithful copy of what the scanner captured, slightly resampled. Crooked or dark scans stay crooked and dark, since this tool reproduces pages rather than enhancing them.
                </p>
                <p>
                  <strong>A common use case</strong><br />
                  Extracting scanned pages from a PDF back into standalone image files, for example to re-crop them, run them through an external OCR tool, or insert single pages into a presentation, is exactly what this tool is for.
                </p>
              </div>
            </section>

            <section id="searchable-text" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I search or copy text from the images?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. This is inherent to the format, not a limitation we could toggle off: JPG and PNG files contain pixels only. Once a page becomes an image, there is no text layer to search, select, or copy.
                </p>
                <p>
                  <strong>If you need the text</strong><br />
                  For a text-based PDF, use the BlendPDF PDF to Word tool, which produces an editable document. For scanned PDFs, neither tool can extract text today because BlendPDF has no OCR yet; an external OCR tool is the way to go.
                </p>
                <p>
                  <strong>Sometimes pixels are the point</strong><br />
                  The absence of a text layer is occasionally exactly what you want: an image of a page cannot have its text quietly edited, which is why some workflows share critical pages as images deliberately.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I convert a password-protected PDF to images?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No; an encrypted PDF cannot be rendered without being decrypted first.
                </p>
                <p>
                  <strong>The fix</strong><br />
                  If you have the password and the right to use the document, remove the protection with the BlendPDF unlock tool, then convert the unlocked copy. The unlock tool requires the correct password; it does not crack or bypass encryption, and we do not offer anything that does.
                </p>
              </div>
            </section>

            <section id="vs-screenshots" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Why not just take screenshots?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  For a single page you need quickly at modest quality, a screenshot is fine, and we will not pretend otherwise. For anything beyond that, rendering wins on three counts.
                </p>
                <p>
                  <strong>Resolution</strong><br />
                  A screenshot captures your screen, which caps a full page at roughly 100-150 effective DPI on typical displays, and less if the page does not fit the window. Rendering at 300 DPI produces two to three times the linear detail, the difference between text that survives printing and text that turns fuzzy.
                </p>
                <p>
                  <strong>Consistency and effort</strong><br />
                  Screenshots inherit whatever zoom, window size, and cropping you had at the moment of capture, so page 3 rarely matches page 14. Rendering produces identically sized, perfectly cropped images for every page, and converting 80 pages takes one click instead of 80 careful captures.
                </p>
                <p>
                  <strong>Ordering</strong><br />
                  The ZIP names files page-001, page-002, and so on. Screenshots named "Screen Shot 2026-08-10 at 14.03.22" do not sort themselves.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What if the conversion fails or the ZIP is huge?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Most problems trace back to a short list of causes.
                </p>
                <p>
                  <strong>Conversion fails outright</strong><br />
                  Confirm the file is a valid PDF under 50MB and 100 pages, and not password-protected (unlock it first if you have the password). If the PDF is damaged and fails repeatedly, run it through the BlendPDF repair tool, which attempts recovery with qpdf and pypdf; it fixes many structural issues, though not every file can be saved.
                </p>
                <p>
                  <strong>The ZIP is larger than expected</strong><br />
                  300 DPI PNGs of photo-heavy pages are big; that is the cost of lossless print quality. Switching to JPG typically cuts the ZIP size dramatically with little visible difference on photographic content. Converting fewer pages at a time (see the split-first workflow) also helps.
                </p>
                <p>
                  <strong>"Too many requests"</strong><br />
                  The rate limit is about 10 conversions per 15 minutes per user. Wait a few minutes and continue; nothing is lost.
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
