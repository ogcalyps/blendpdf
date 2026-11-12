'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function WatermarkPDFFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How does adding a watermark to a PDF work?',
      answer: 'BlendPDF draws your watermark directly into the content of every page. Text watermarks are rendered in bold gray type at the size and opacity you choose; image watermarks embed a PNG or JPEG you upload. The watermark becomes part of the PDF itself, so it shows up in every viewer and in print.'
    },
    {
      question: 'How do I add a watermark to a PDF online?',
      answer: 'Upload your PDF (up to 50MB), choose text or image mode, type the text or upload a PNG/JPEG, pick a position (center, diagonal, or tiled), adjust opacity and size while watching the live preview, then click to apply and download the watermarked copy. No account or email is required.'
    },
    {
      question: 'Is the watermark tool free? Does BlendPDF add its own branding?',
      answer: 'Yes, it is completely free, and no, BlendPDF never adds its own watermark or branding. The only watermark on the output is the one you chose. There are no page limits, daily quotas, or premium tiers.'
    },
    {
      question: 'What is the difference between text and image watermarks?',
      answer: 'A text watermark is a phrase like DRAFT or CONFIDENTIAL rendered as bold gray text — quick and ideal for status labels. An image watermark is a PNG or JPEG you upload, such as a company logo — PNG is better because it supports transparency. Both can be positioned and adjusted for opacity.'
    },
    {
      question: 'What watermark positions are available?',
      answer: 'Three: center (horizontal, middle of the page), diagonal (rotated 45 degrees across the middle — the classic DRAFT look), and tiled (repeated in a grid across the whole page, which is the hardest to crop out). The same position is applied to every page.'
    },
    {
      question: 'Can I control the opacity and size of the watermark?',
      answer: 'Yes. Opacity runs from 10% to 100% (30% is the default and works well for labels that should not obscure content). Text size is adjustable from 12 to 120 points. A live preview shows the effect on your actual first page before you commit.'
    },
    {
      question: 'Can I use Arabic or other non-Latin text in a watermark?',
      answer: 'Yes. Type Arabic, Hebrew, Chinese, or any other script directly into the text field and it just works — the watermark is shaped and rendered right in your browser, with correct Arabic letter joining and right-to-left direction, then stamped onto every page. No workaround needed.'
    },
    {
      question: 'Does the watermark appear on every page?',
      answer: 'Yes, the watermark is applied to all pages of the document. There is currently no option to watermark only a page range. If you need that, split the PDF first, watermark the part that needs it, and merge the parts back together with our Split and Merge tools.'
    },
    {
      question: 'Can a watermark be removed later? Does it protect my document?',
      answer: 'Be realistic: a watermark deters casual misuse but is not security. It becomes part of the page content and cannot be removed in a viewer, but someone with a PDF editor and time can remove it — especially a single centered mark. Tiled watermarks at moderate opacity are harder to clean. For actual protection, use the Protect PDF tool, which encrypts the file with AES-256.'
    },
    {
      question: 'Is it safe to watermark confidential documents online?',
      answer: 'Yes. Files travel over an encrypted HTTPS connection and are deleted from our servers within one hour, most immediately after processing. We never read, store, or share document contents, and no account is needed. We only measure usage as anonymous totals, through Google Analytics and our own count of tool runs, never your documents.'
    },
    {
      question: 'Can I watermark a password-protected PDF?',
      answer: 'No — remove the password first using the Unlock PDF tool (you need to know the password), apply the watermark, then re-protect the file with the Protect PDF tool if you want it encrypted again.'
    },
    {
      question: 'Does watermarking work on scanned PDFs?',
      answer: 'Yes, and it works well. The watermark is drawn on top of each page, and a scanned page is just an image, so the mark sits over the scan exactly as it would over regular text. No OCR is involved or needed for watermarking (note that BlendPDF has no OCR feature yet, so scanned text stays unsearchable either way).'
    },
    {
      question: 'What are the file size limits?',
      answer: 'One PDF per operation, up to 50MB, and up to 20 files per 15 minutes per user. Watermark images must be PNG or JPEG. If your PDF is over 50MB, run it through the Compress PDF tool first.'
    },
    {
      question: 'How does this compare to watermarking in Word or Adobe Acrobat?',
      answer: 'Word can only watermark documents it can open and edit, and re-exporting a PDF through Word often changes the layout. Acrobat Pro has powerful watermark options but requires a paid subscription. BlendPDF works on any existing PDF without touching its layout, is free, and needs no installation or account.'
    },
    {
      question: 'What should I do if I get an error while watermarking?',
      answer: 'The most common errors: a watermark image that is not PNG/JPEG, a file over 50MB, or a "too many requests" message (wait a few minutes; the limit is 20 files per 15 minutes). If a valid file still fails, it may be corrupted — try the Repair PDF tool first.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Watermark PDF', url: '/watermark-pdf' },
        { name: 'FAQ', url: '/watermark-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Watermark PDF
          </h1>
          <p className="mb-8">
            <Link href="/watermark-pdf" className="text-blue-600 hover:text-blue-800">
              &larr; Back to the Watermark PDF tool
            </Link>
          </p>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-it-works" className="text-blue-600 hover:text-blue-800">How does adding a watermark to a PDF work?</a></li>
              <li><a href="#how-to-watermark" className="text-blue-600 hover:text-blue-800">How do I add a watermark to a PDF online?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is the watermark tool free? Does BlendPDF add its own branding?</a></li>
              <li><a href="#text-vs-image" className="text-blue-600 hover:text-blue-800">What is the difference between text and image watermarks?</a></li>
              <li><a href="#positions" className="text-blue-600 hover:text-blue-800">What watermark positions are available?</a></li>
              <li><a href="#opacity-and-size" className="text-blue-600 hover:text-blue-800">Can I control the opacity and size of the watermark?</a></li>
              <li><a href="#arabic-text" className="text-blue-600 hover:text-blue-800">Can I use Arabic or other non-Latin text in a watermark?</a></li>
              <li><a href="#every-page" className="text-blue-600 hover:text-blue-800">Does the watermark appear on every page?</a></li>
              <li><a href="#removal-and-protection" className="text-blue-600 hover:text-blue-800">Can a watermark be removed later? Does it protect my document?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to watermark confidential documents online?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I watermark a password-protected PDF?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Does watermarking work on scanned PDFs?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#comparison" className="text-blue-600 hover:text-blue-800">How does this compare to watermarking in Word or Adobe Acrobat?</a></li>
              <li><a href="#troubleshooting" className="text-blue-600 hover:text-blue-800">What should I do if I get an error while watermarking?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-it-works" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How does adding a watermark to a PDF work?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF draws the watermark directly into the content of each page, so it becomes a permanent part of the document — visible in every PDF viewer, on every platform, and in print.
                </p>
                <p>
                  <strong>Text Watermarks</strong><br />
                  Text watermarks are rendered in bold gray type (Helvetica Bold) at the size and opacity you pick. Because the mark is real vector text drawn into the page — not a picture of text — it stays crisp at any zoom level and adds almost nothing to the file size.
                </p>
                <p>
                  <strong>Image Watermarks</strong><br />
                  Image watermarks embed a PNG or JPEG file you upload, drawn at half its original pixel dimensions at the opacity you choose. A transparent PNG of a logo works best: the transparency lets the underlying page show through where the logo has no pixels.
                </p>
                <p>
                  <strong>Part of the File, Not a Layer You Can Toggle</strong><br />
                  Once applied, the watermark is stitched into the page content stream. There is no watermark "layer" a reader can hide or a viewer setting that turns it off. This is exactly the behavior you want for DRAFT stamps and branding — see question 9 for an honest discussion of whether that means the watermark is removable by a determined person (short answer: with effort and a PDF editor, yes).
                </p>
              </div>
            </section>

            <section id="how-to-watermark" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. How do I add a watermark to a PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The whole flow takes about a minute:
                </p>
                <p>
                  <strong>Step 1: Upload Your PDF</strong><br />
                  Drag your file onto the upload area or click to browse. One file at a time, up to 50MB.
                </p>
                <p>
                  <strong>Step 2: Choose Text or Image</strong><br />
                  For a text watermark, type your text — DRAFT, CONFIDENTIAL, a client name, whatever you need, in any script including Arabic (see question 7). For an image watermark, upload a PNG or JPEG; a transparent PNG of your logo gives the cleanest result.
                </p>
                <p>
                  <strong>Step 3: Position and Tune</strong><br />
                  Pick center, diagonal, or tiled placement, then adjust opacity (10-100%) and, for text, the font size (12-120pt). The live preview on the left shows the watermark over your actual first page, so you can see exactly how strong it looks before committing. For a label that should be visible but not distracting, 30% opacity diagonal is the classic combination.
                </p>
                <p>
                  <strong>Step 4: Apply and Download</strong><br />
                  Click the watermark button and download the result, which is named after your original with "_watermarked" appended. Your original file is untouched — the tool always produces a new copy. No account or email is required; an optional email-delivery feature exists if you would rather have the file sent to your inbox.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Is the watermark tool free? Does BlendPDF add its own branding?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, it is completely free — and this question deserves a direct answer because the irony is real: many "free" watermark tools stamp their own logo on your file unless you pay.
                </p>
                <p>
                  <strong>Your Watermark, and Only Yours</strong><br />
                  BlendPDF never adds its own watermark, logo, footer, or branded page to your document. The only mark on the output is the one you configured. If you searched for "add watermark to PDF without watermark," this is the honest answer: the output contains your watermark and nothing else.
                </p>
                <p>
                  <strong>No Paywall Mechanics</strong><br />
                  There are no daily limits that force an upgrade, no locked "premium positions," and no file size teaser. Every option on the page — text and image modes, all three positions, the full opacity and size ranges — is available to everyone, free.
                </p>
                <p>
                  <strong>No Sign-Up</strong><br />
                  No account, no email required to download, no personal information collected. Visit, upload, watermark, download.
                </p>
              </div>
            </section>

            <section id="text-vs-image" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. What is the difference between text and image watermarks?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Both do the same fundamental job — marking every page — but they suit different situations.
                </p>
                <p>
                  <strong>Text Watermarks: Fast Status Labels</strong><br />
                  Type a word or phrase and you are done. Text is the right choice for status stamps (DRAFT, CONFIDENTIAL, APPROVED, VOID, SAMPLE), recipient marks ("For review by Legal only"), or dates. The text renders in bold gray, which reads clearly over most content without hiding it, and you control the size from small corner-stamp scale up to page-dominating 120pt.
                </p>
                <p>
                  <strong>Image Watermarks: Logos and Custom Marks</strong><br />
                  Upload a PNG or JPEG and it is embedded on every page at half its original pixel size. This is the choice for company logos, seals, or any mark that needs exact brand appearance. Use a PNG with a transparent background — a JPEG always has a solid rectangle behind it, which looks heavy over page content. Tip: since the image is placed at 50% of its pixel dimensions, upload an image roughly twice as large as you want it to appear.
                </p>
                <p>
                  <strong>Which Should You Pick?</strong><br />
                  If the mark is words, use text — it is sharper, lighter, and quicker, and it works in any script including Arabic (see question 7). If the mark is a visual identity, use an image.
                </p>
              </div>
            </section>

            <section id="positions" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. What watermark positions are available?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Three placements, each with a distinct use case. The same placement is applied to every page of the document.
                </p>
                <p>
                  <strong>Center</strong><br />
                  The watermark sits horizontally in the middle of the page. This is the subtlest option — good for logos and for marks that should be present without shouting.
                </p>
                <p>
                  <strong>Diagonal</strong><br />
                  The watermark is rotated 45 degrees across the middle of the page — the classic look for DRAFT and CONFIDENTIAL stamps. The rotation makes the mark noticeable over any layout, because it cuts across text lines instead of hiding between them. This is the default and the most popular choice.
                </p>
                <p>
                  <strong>Tiled</strong><br />
                  The watermark repeats in a grid across the entire page. Tiling is the strongest deterrent: a single centered mark can be cropped or covered, but a tiled pattern touches every region of every page. Use a lower opacity (10-30%) with tiling, since the repetition adds visual weight fast.
                </p>
                <p>
                  <strong>What About Custom Placement?</strong><br />
                  There is currently no free-drag custom positioning or corner placement — the three presets cover the standard cases. If you need a one-off mark in an exact spot on one page, a PDF editor is the better tool for that job.
                </p>
              </div>
            </section>

            <section id="opacity-and-size" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Can I control the opacity and size of the watermark?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — opacity and size are the two dials that make the difference between a professional watermark and an unreadable page.
                </p>
                <p>
                  <strong>Opacity: 10% to 100%</strong><br />
                  The slider runs from barely-there 10% to fully opaque 100%, in 10% steps. The default of 30% is a sensible starting point: clearly visible, but the content underneath stays readable. Go lighter (10-20%) for tiled patterns and dense text documents; go heavier (50%+) only when the point is to make the document hard to reuse, such as a VOID stamp on a sample.
                </p>
                <p>
                  <strong>Text Size: 12 to 120 Points</strong><br />
                  For text watermarks you can set the font size anywhere from 12pt (a discreet label) to 120pt (fills the width of a letter-size page with a short word). The default 48pt suits one-word diagonal stamps. Image watermarks are sized automatically at half the uploaded image's pixel dimensions, so control their size by scaling the image you upload.
                </p>
                <p>
                  <strong>Use the Live Preview</strong><br />
                  The preview pane shows your watermark over the actual first page of your PDF and updates as you move the sliders. Judge readability there before applying — it is much faster than downloading, checking, and redoing.
                </p>
              </div>
            </section>

            <section id="arabic-text" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Can I use Arabic or other non-Latin text in a watermark?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — type your text in any script and it just works.
                </p>
                <p>
                  <strong>How It Works</strong><br />
                  Standard PDF fonts cannot encode Arabic, Hebrew, Chinese, Japanese, Korean, or emoji, so instead of forcing them through a font that would break the script, BlendPDF renders non-Latin watermark text right in your browser — where Arabic letter joining, right-to-left direction, and every other script rule are handled natively — and stamps the result onto every page. The size, position, and opacity controls behave exactly the same as for Latin text.
                </p>
                <p>
                  <strong>Correct Shaping, Guaranteed</strong><br />
                  Because the shaping is done by your browser's own text engine (the same one that displays this page), Arabic comes out properly connected and ordered — no disconnected letters, no reversed words, no boxes. This also means non-Latin watermark text never leaves your device as text: it is processed locally.
                </p>
                <p>
                  <strong>Your Document's Own Text Is Never Touched</strong><br />
                  This applies to the watermark text you add on top. PDFs whose content is in Arabic or any other language watermark perfectly — the tool does not touch, reflow, or re-encode your document's existing text.
                </p>
              </div>
            </section>

            <section id="every-page" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Does the watermark appear on every page?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. The watermark is applied uniformly to all pages of the document, with the same position, size, and opacity throughout.
                </p>
                <p>
                  <strong>No Page-Range Option Yet</strong><br />
                  There is currently no built-in way to watermark only pages 2-10, skip a cover page, or vary the mark between sections. For most watermarking purposes — status stamps, confidentiality labels, branding — uniform coverage is what you want anyway, since an unmarked page is the one that escapes into the wild.
                </p>
                <p>
                  <strong>Workaround for Partial Watermarking</strong><br />
                  If you genuinely need to watermark only part of a document, chain BlendPDF tools: use <Link href="/split-pdf" className="text-blue-600 hover:text-blue-800">Split PDF</Link> to separate the pages that need the mark, watermark that portion, then use <Link href="/merge-pdf" className="text-blue-600 hover:text-blue-800">Merge PDF</Link> to reassemble the document in order. It is three steps instead of one, but each step takes seconds and all three tools are free.
                </p>
              </div>
            </section>

            <section id="removal-and-protection" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. Can a watermark be removed later? Does it protect my document?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  This deserves a straight answer, because watermarks are often trusted to do more than they can.
                </p>
                <p>
                  <strong>What a Watermark Actually Does</strong><br />
                  Once applied, the watermark is part of the page content. It cannot be toggled off in a viewer, it survives printing and re-saving, and removing it from your own copy requires recreating the PDF or editing it with dedicated software. For everyday purposes — marking drafts, labeling confidential material, branding deliverables — that is exactly the permanence you need.
                </p>
                <p>
                  <strong>What a Watermark Does Not Do</strong><br />
                  A watermark is a deterrent, not a lock. Someone with a PDF editor and motivation can remove a watermark, especially a single centered or diagonal text mark, and no online tool can honestly claim otherwise. Tiled watermarks at moderate opacity are meaningfully harder to clean up because they overlap the content everywhere, but "harder" is not "impossible."
                </p>
                <p>
                  <strong>If You Need Real Protection</strong><br />
                  For confidentiality, use our <Link href="/protect-pdf" className="text-blue-600 hover:text-blue-800">Protect PDF</Link> tool, which encrypts the file with real AES-256 encryption so it cannot be opened at all without the password. A sensible combination for sensitive drafts: watermark the document so every page carries its status, then encrypt it so only intended recipients can open it.
                </p>
                <p>
                  <strong>Removing a Watermark You Added</strong><br />
                  If you watermarked a file and later need a clean version, the reliable answer is to keep your original un-watermarked file — the tool never modifies it, so the clean copy is the one you started with.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Is it safe to watermark confidential documents online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — and since the documents people watermark are often exactly the confidential ones, here is precisely how your file is handled.
                </p>
                <p>
                  <strong>Encrypted Transfer</strong><br />
                  Your file travels to our servers over HTTPS (SSL/TLS) and the watermarked copy comes back over the same encrypted channel. Nothing moves in plain text.
                </p>
                <p>
                  <strong>Fast, Automatic Deletion</strong><br />
                  Uploaded files and outputs are deleted from our servers within one hour, and most are removed immediately after processing. We keep no backups and no archive of your documents.
                </p>
                <p>
                  <strong>What We Do and Do Not Collect</strong><br />
                  Processing is fully automated — no person at BlendPDF sees your files, and we never read, store, or share the contents of your documents. No account or email is required, so uploads are not tied to an identity. We do use Google Analytics for aggregate, anonymous usage measurement (page views, which tools are used) to guide improvements; that measurement never includes your documents or anything in them.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I watermark a password-protected PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No — encrypted PDFs need to be unlocked before they can be modified, watermarking included.
                </p>
                <p>
                  <strong>The Three-Step Path</strong><br />
                  First, remove the password with our <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</Link> tool — you need to know the current password; the tool removes protection, it does not crack it. Second, watermark the unlocked copy normally. Third, if the document should stay protected, re-encrypt the watermarked file with the <Link href="/protect-pdf" className="text-blue-600 hover:text-blue-800">Protect PDF</Link> tool, using the same password or a new one.
                </p>
                <p>
                  <strong>Why This Restriction Exists</strong><br />
                  Password protection means the document owner restricted modification. Requiring the password first respects that: only someone who can already open the file can watermark it. Only unlock and modify documents you own or have permission to change.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Does watermarking work on scanned PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — this is one task where scanned PDFs behave exactly like any other PDF.
                </p>
                <p>
                  <strong>Why It Just Works</strong><br />
                  A scanned PDF is a series of page-size images, and the watermark is drawn on top of each page's content. Whether that content is selectable text or a photograph of a paper page makes no difference to the overlay: the mark lands on top either way, at the position and opacity you chose. Scanned contracts, ID copies, and paper records watermark cleanly.
                </p>
                <p>
                  <strong>One Practical Tip</strong><br />
                  Scans are often darker and busier than born-digital documents, so a watermark that reads well over white pages can get lost over a gray scan. Nudge the opacity up a step or two and check the live preview against your actual scan.
                </p>
                <p>
                  <strong>A Note on OCR</strong><br />
                  Watermarking neither needs nor performs text recognition. BlendPDF currently has no OCR feature at all, so a scanned PDF's text remains unsearchable before and after watermarking. If you need searchable scans, run OCR in another tool — watermark before or after; the order does not matter for the overlay, though OCR tools generally prefer unmarked input.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The limits are simple and generous enough for nearly all real-world use.
                </p>
                <p>
                  <strong>File Limits</strong><br />
                  One PDF per operation, up to 50MB. There is no page-count limit — long documents simply take a few extra seconds, since the watermark is drawn on every page. Watermark images must be PNG or JPEG.
                </p>
                <p>
                  <strong>Usage Limits</strong><br />
                  To keep the service fast and free, watermarking is limited to 20 files per 15 minutes per user. Hit the limit and you will see a "too many requests" message — wait a few minutes and continue. There is no daily or lifetime cap.
                </p>
                <p>
                  <strong>If Your File Is Over 50MB</strong><br />
                  Run it through our <Link href="/compress-pdf" className="text-blue-600 hover:text-blue-800">Compress PDF</Link> tool first — it keeps text selectable and returns your original file unchanged if it cannot make it smaller — then watermark the compressed copy.
                </p>
              </div>
            </section>

            <section id="comparison" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. How does this compare to watermarking in Word or Adobe Acrobat?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  All three can put a mark on a page. The differences are about what file you start with and what you pay.
                </p>
                <p>
                  <strong>Microsoft Word</strong><br />
                  Word's watermark feature (Design → Watermark) is fine when the document lives in Word and you export to PDF afterward. But to watermark an existing PDF, Word must first convert the PDF into an editable document — a lossy process that frequently rearranges layout, especially for complex or scanned files. If your document is already a PDF, converting it to Word just to stamp it is the long way around.
                </p>
                <p>
                  <strong>Adobe Acrobat Pro</strong><br />
                  Acrobat Pro has the most powerful watermark options available: page ranges, exact placement, scaling relative to page size, and batch actions. It also requires a paid subscription and a desktop installation. If you already pay for Acrobat Pro and need page-range watermarking, use it — it is genuinely good at this.
                </p>
                <p>
                  <strong>BlendPDF</strong><br />
                  BlendPDF works directly on any existing PDF without converting or re-rendering it, so your layout is never touched — the watermark is added on top of pages that otherwise stay byte-for-byte intact. It is free, runs in any browser on any OS with nothing to install, requires no account, and includes a live preview. The trade-off is fewer placement options than Acrobat Pro (three presets, whole document only). For the common cases — DRAFT stamps, confidentiality labels, logo marks — it does the job in under a minute at no cost.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What should I do if I get an error while watermarking?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Watermarking errors are almost always one of the following, each with a quick fix.
                </p>
                <p>
                  <strong>Non-Latin Text Fails to Render</strong><br />
                  Arabic, Chinese, and other non-Latin watermark text is rendered locally in your browser (see question 7), so on very old browsers it can occasionally fail. Update your browser or try another one; as a fallback, render your text as a transparent PNG and apply it as an image watermark.
                </p>
                <p>
                  <strong>Image Watermark Rejected</strong><br />
                  Watermark images must be PNG or JPEG. Convert other formats (WebP, SVG, HEIC, GIF) to PNG in any image editor first. If the image uploads but looks wrong — a solid white box around a logo, for instance — the source was a JPEG; re-export it as a PNG with transparency.
                </p>
                <p>
                  <strong>File Too Large or Not a PDF</strong><br />
                  The document must be a valid PDF under 50MB. Compress oversized files first. If a file will not upload at all, confirm it is really a PDF and not another format with a renamed extension.
                </p>
                <p>
                  <strong>"Too Many Requests"</strong><br />
                  You have hit the limit of 20 files per 15 minutes. Wait a few minutes and try again.
                </p>
                <p>
                  <strong>Valid PDF Still Fails</strong><br />
                  If a genuine, correctly sized PDF errors out, the file may have structural damage. Run it through the <Link href="/repair-pdf" className="text-blue-600 hover:text-blue-800">Repair PDF</Link> tool, then watermark the repaired copy.
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
