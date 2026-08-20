'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function SignPDFFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How do I sign a PDF online?',
      answer: 'Upload your PDF (up to 50MB), then draw, type, or upload a signature and drag it exactly where you want it on the page — you can place several signatures across different pages. Click apply and download the signed copy. Everything runs in your browser and no account is required.'
    },
    {
      question: 'Is a BlendPDF signature legally binding?',
      answer: 'It can be, for many routine documents. BlendPDF adds a simple visual signature, and laws like the US ESIGN Act and the EU eIDAS regulation recognize simple electronic signatures for most everyday agreements. It carries no digital certificate or audit trail, so for high-stakes contracts or documents with formal requirements, use a certificate-based signing service and consult a legal professional.'
    },
    {
      question: 'Is this a digital signature or a visual signature?',
      answer: 'A visual signature. BlendPDF draws your name or signature image onto the page. It is not a cryptographic (PKI) digital signature: there is no certificate, no tamper-evident seal, and PDF viewers will not show a signature-validation panel.'
    },
    {
      question: 'What is the difference between text and image signatures?',
      answer: 'You can create a signature three ways: draw it with your mouse or finger, type your name in a signature font, or upload an image of your handwritten signature. Typed signatures are fastest; drawn and image signatures look handwritten. A PNG with a transparent background looks best.'
    },
    {
      question: 'How do I make a good signature image?',
      answer: 'Sign with a dark pen on white paper, photograph or scan it in good light, and crop tightly around the signature. A PNG with a transparent background looks best because the page shows through; a JPEG will carry a white rectangle behind the ink.'
    },
    {
      question: 'Where can I position the signature?',
      answer: 'Anywhere. The signature appears on a live preview of the page and you drag it to the exact spot you want; a corner handle resizes it. Bottom-right is the classic signature spot, but placement is completely free, so you can land it precisely on a form\'s signature line.'
    },
    {
      question: 'Can I sign more than one page?',
      answer: 'Yes, in a single pass. Navigate between pages in the preview, place a signature on every page that needs one, and apply them all at once. Each signature can be positioned and sized independently.'
    },
    {
      question: 'Can I sign in Arabic or other non-Latin scripts?',
      answer: 'Yes. Type your name in Arabic, Hebrew, Chinese, or any other script and it renders correctly — your browser shapes the text with proper letter joining and right-to-left direction before it is placed on the page. For a handwritten look in any script, an image signature works too.'
    },
    {
      question: 'Is signing PDFs free? Is there a watermark?',
      answer: 'Yes, completely free, with no watermark, no signature limit, and no trial-then-paywall. No account or email is required; downloads are direct, with an optional email-delivery feature if you want one.'
    },
    {
      question: 'Is it safe to sign documents online?',
      answer: 'Yes. Signing happens entirely in your browser — your PDF and your signature are never uploaded to a server, so nothing needs to be deleted afterward because nothing ever leaves your device. We only collect aggregate anonymous usage analytics.'
    },
    {
      question: 'Can I sign a password-protected PDF?',
      answer: 'No, encrypted PDFs cannot be processed. Remove the password first with the Unlock PDF tool (you need the password), sign the unlocked copy, and re-protect it afterward with the Protect PDF tool if needed.'
    },
    {
      question: 'Can I sign a scanned PDF?',
      answer: 'Yes. The signature is drawn on top of the page, so it works on scanned documents exactly as on digital ones. This is the classic use case: someone emails you a scanned form, you sign it and send it back without printing.'
    },
    {
      question: 'What are the file limits?',
      answer: 'One PDF up to 50MB per operation. Signature images can be any common format your browser can display — they are converted automatically. There is no page-count limit, and you can place signatures on any pages in the document.'
    },
    {
      question: 'How does this compare to printing and scanning, or Adobe Fill & Sign?',
      answer: 'Versus print-sign-scan: same visual result, no printer, and the document keeps its quality and selectable text. Versus Adobe Fill & Sign: similar simple e-signature, but BlendPDF runs in the browser with no app or Adobe account. For certificate-based digital signatures, a dedicated service is the right tool.'
    },
    {
      question: 'What should I do if signing fails?',
      answer: 'Check that the PDF is under 50MB and not password protected — encrypted files must be unlocked first with the Unlock PDF tool. Corrupted files can be run through the Repair PDF tool first, though repair cannot fix everything.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Sign PDF', url: '/sign-pdf' },
        { name: 'FAQ', url: '/sign-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Sign PDF
          </h1>
          <p className="mb-8">
            <Link href="/sign-pdf" className="text-blue-600 hover:text-blue-800">
              &larr; Back to the Sign PDF tool
            </Link>
          </p>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-sign" className="text-blue-600 hover:text-blue-800">How do I sign a PDF online?</a></li>
              <li><a href="#is-it-legal" className="text-blue-600 hover:text-blue-800">Is a BlendPDF signature legally binding?</a></li>
              <li><a href="#visual-vs-digital" className="text-blue-600 hover:text-blue-800">Is this a digital signature or a visual signature?</a></li>
              <li><a href="#text-vs-image" className="text-blue-600 hover:text-blue-800">What is the difference between text and image signatures?</a></li>
              <li><a href="#signature-image" className="text-blue-600 hover:text-blue-800">How do I make a good signature image?</a></li>
              <li><a href="#position" className="text-blue-600 hover:text-blue-800">Where can I position the signature?</a></li>
              <li><a href="#multiple-pages" className="text-blue-600 hover:text-blue-800">Can I sign more than one page?</a></li>
              <li><a href="#arabic-signatures" className="text-blue-600 hover:text-blue-800">Can I sign in Arabic or other non-Latin scripts?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is signing PDFs free? Is there a watermark?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to sign documents online?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I sign a password-protected PDF?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Can I sign a scanned PDF?</a></li>
              <li><a href="#file-limits" className="text-blue-600 hover:text-blue-800">What are the file limits?</a></li>
              <li><a href="#comparison" className="text-blue-600 hover:text-blue-800">How does this compare to printing and scanning, or Adobe Fill &amp; Sign?</a></li>
              <li><a href="#troubleshooting" className="text-blue-600 hover:text-blue-800">What should I do if signing fails?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-sign" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How do I sign a PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Signing a PDF with BlendPDF takes about a minute, and you never need to print anything.
                </p>
                <p>
                  <strong>Upload the Document</strong><br />
                  Click "Choose File" or drag your PDF onto the upload area (Google Drive import is also available). The file can be up to 50MB, a live preview shows every page, and the file stays in your browser — it is never uploaded to a server.
                </p>
                <p>
                  <strong>Create Your Signature</strong><br />
                  Pick one of three ways. Draw your signature with your mouse or finger, type your name and choose a signature style, or upload a picture of your real handwritten signature — ideally a PNG with a transparent background.
                </p>
                <p>
                  <strong>Place It and Sign</strong><br />
                  Drag the signature to the exact spot you want on the page and resize it with the corner handle. Navigate between pages to place signatures wherever they are needed — you can add several, plus a date stamp. Click apply, and the signatures are embedded into the pages themselves; they become part of the document, not floating annotations someone can delete with one click.
                </p>
                <p>
                  <strong>Download</strong><br />
                  The signed file downloads with "_signed" added to the name. Your original file stays untouched on your device, so you can always start over.
                </p>
              </div>
            </section>

            <section id="is-it-legal" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. Is a BlendPDF signature legally binding?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  For many everyday documents, yes; for high-stakes ones, you should use more. Here is the honest picture rather than a one-word answer.
                </p>
                <p>
                  <strong>What the Law Generally Says</strong><br />
                  Most major jurisdictions recognize simple electronic signatures. In the United States, the ESIGN Act and UETA give electronic signatures the same legal effect as ink for most transactions. In the EU, the eIDAS regulation explicitly says a signature cannot be denied legal effect solely because it is electronic. Similar laws exist in the UK, Canada, Australia, and many other countries. A typed name or an image of your signature, placed with intent to sign, is a "simple electronic signature" under these frameworks.
                </p>
                <p>
                  <strong>Where It Is Typically Fine</strong><br />
                  Routine business and personal documents: internal approvals, quotes and invoices, permission slips, freelance agreements, rental applications, sign-off forms, and documents where the other party asked you to "sign and send back". In practice, most of these are signed exactly this way every day.
                </p>
                <p>
                  <strong>Where You Should Use More</strong><br />
                  Some documents carry formal requirements, wills, deeds, notarized documents, certain court filings, and some jurisdictions require "qualified" or certificate-based signatures for specific transactions. And because a BlendPDF signature has no identity verification or audit trail, it proves little about who signed if a dispute arises. For contracts with significant money or legal exposure, use a certificate-based signing service, and when in doubt, consult a legal professional in your jurisdiction. We would rather tell you that plainly than oversell a simple tool.
                </p>
              </div>
            </section>

            <section id="visual-vs-digital" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Is this a digital signature or a visual signature?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  A visual signature. The distinction matters, and plenty of tools blur it, so here is exactly what BlendPDF does and does not do.
                </p>
                <p>
                  <strong>What BlendPDF Does</strong><br />
                  It draws your signature, typed text or an image, directly into the page content of the PDF. The result looks the same as a document you signed on paper and scanned: the signature is visibly there, embedded in the file.
                </p>
                <p>
                  <strong>What It Does Not Do</strong><br />
                  It does not apply a cryptographic (PKI) digital signature. There is no digital certificate tied to your identity, no tamper-evident seal that invalidates if the document is edited afterward, no timestamp authority, and no green check mark or signature panel in Adobe Reader. The document also remains editable after signing, nothing locks it.
                </p>
                <p>
                  <strong>Which One Do You Need?</strong><br />
                  If the other party expects a signature they can see, which covers most routine paperwork, a visual signature is exactly right, and it is what print-sign-scan produces too. If you need to prove cryptographically who signed and that nothing changed since, that requires certificate-based signing from a dedicated provider or an ID-linked national signature scheme. We say this plainly because a signature tool you trust should be honest about what its signatures are.
                </p>
              </div>
            </section>

            <section id="text-vs-image" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. What is the difference between text and image signatures?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  All signatures are embedded into the page the same way; they differ in how they look and what they need from you. There are three ways to create one: draw, type, or upload.
                </p>
                <p>
                  <strong>Typed Signatures</strong><br />
                  You type your name and pick one of several signature fonts, from elegant script to modern handwriting styles. It takes ten seconds and needs no preparation, appropriate for approvals, acknowledgments, and forms. Typed signatures work in any script — Arabic, Hebrew, Chinese, and more (see the Arabic question below).
                </p>
                <p>
                  <strong>Drawn and Image Signatures</strong><br />
                  You can draw your signature directly on screen with a mouse, trackpad, or finger — instant and personal. Or upload a picture of your actual handwritten signature; any common image format works, and it is converted automatically. Both look like real ink, which many recipients expect, especially on contracts and official-looking forms. A good signature image requires a one-time setup, which the next question covers.
                </p>
                <p>
                  <strong>Which to Choose</strong><br />
                  If the document just needs your name and assent, typing is quickest. If the recipient expects to see "a signature", or the document has a signature line meant for handwriting, draw one or use an image.
                </p>
              </div>
            </section>

            <section id="signature-image" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. How do I make a good signature image?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Five minutes of setup gives you a signature image you can reuse forever.
                </p>
                <p>
                  <strong>Capture</strong><br />
                  Sign your name with a dark pen (black or blue gel pens work best) on plain white paper, larger than you normally would, big signatures downscale cleanly, small ones enlarge badly. Photograph it from directly above in good, even light, or scan it. Avoid shadows across the signature.
                </p>
                <p>
                  <strong>Crop and Clean</strong><br />
                  Crop the image tightly around the signature so it does not import with acres of white space. If your phone or an image editor offers background removal, use it to make the background transparent and export as PNG, a transparent PNG lets the document show through around the pen strokes, which looks like real ink on the page. A JPEG works too, but it will carry a white rectangle behind the signature, visible if the page area under it is not white.
                </p>
                <p>
                  <strong>Format and Size</strong><br />
                  Save as PNG (preferred, supports transparency) or JPEG, under 5MB, which is generous, a cropped signature photo is typically well under 1MB. Keep the file somewhere handy; you can reuse the same image for every document you sign from now on.
                </p>
              </div>
            </section>

            <section id="position" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Where can I position the signature?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Anywhere you like. The signature sits on a live preview of the page, and you position it by hand before anything is committed.
                </p>
                <p>
                  <strong>Free Drag-and-Drop Placement</strong><br />
                  Drag the signature to the exact spot it belongs — precisely on a form's signature line, next to a checkbox, or in the traditional bottom-right corner of a contract. A corner handle resizes it while keeping its proportions, and the ✕ removes it. Placement works with a mouse or a finger on touch screens.
                </p>
                <p>
                  <strong>Choosing the Page</strong><br />
                  Use the page navigation under the preview to move through the document, contracts usually want the last page, forms often the first. The preview shows each page with its own signatures, so you can confirm you are signing the right page of, say, a 40-page agreement before applying.
                </p>
                <p>
                  <strong>Multiple Signatures at Once</strong><br />
                  You are not limited to a single stamp: place several signatures — and a date stamp — across different pages, then apply them all in one pass.
                </p>
              </div>
            </section>

            <section id="multiple-pages" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Can I sign more than one page?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — as many pages as you need, all in a single pass.
                </p>
                <p>
                  <strong>The Multi-Page Workflow</strong><br />
                  Create your signature once, then navigate through the pages and place it wherever it is needed: the signature line on the last page, initials on every page of a contract, a date stamp next to each one. When everything is in place, click apply once and download the finished document. Each signature is embedded permanently into its page.
                </p>
                <p>
                  <strong>Same Signature, Reused</strong><br />
                  Once you have created a signature, placing it again on another page takes one click — and each copy can be moved and resized independently, so initials can be small in a corner while the main signature sits full-size on the signature line.
                </p>
                <p>
                  <strong>If You Sign Many Long Documents</strong><br />
                  For heavy multi-party signing workflows (routing a contract to several signers with an audit trail), a dedicated signing service is the right tool. For signing and initialing a document yourself, even a long one, this tool does the job in a couple of minutes.
                </p>
              </div>
            </section>

            <section id="arabic-signatures" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Can I sign in Arabic or other non-Latin scripts?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Type your name in Arabic, Hebrew, Chinese, Japanese, or any other script and the typed signature renders correctly on the page.
                </p>
                <p>
                  <strong>How It Works</strong><br />
                  Standard PDF fonts cannot encode non-Latin scripts, so instead of pushing your name through a font that would break it, BlendPDF shapes the text in your browser — where Arabic letter joining and right-to-left direction are handled natively — and places the result on the page. Arabic names come out properly connected and ordered, not as disconnected or reversed letters.
                </p>
                <p>
                  <strong>Prefer a Handwritten Look?</strong><br />
                  An image signature works in any script too: write your signature by hand, photograph it, and upload it. Many people find a real handwritten Arabic signature looks more personal than typed text — both options work.
                </p>
                <p>
                  <strong>The Document Itself Can Be in Any Language</strong><br />
                  The PDF you are signing can be in Arabic or any other language, with right-to-left layout, and it is preserved untouched — the signature is drawn on top without reprocessing the page content.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. Is signing PDFs free? Is there a watermark?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Completely free, and there is no watermark. The signed document contains your signature and nothing else added.
                </p>
                <p>
                  <strong>Why This Is Worth Stating</strong><br />
                  E-signing is a category where "free" usually means a trial: three signatures and then a subscription prompt, or a "Signed with X" banner stamped on your legal document. BlendPDF does neither. There is no signature quota, no premium tier, and nothing added to your file beyond the signatures you placed. And because signing runs entirely in your browser, there is no server queue or job limit to worry about either.
                </p>
                <p>
                  <strong>No Sign-Up Either</strong><br />
                  No account, no email verification, no personal details. After signing, you can optionally have the file emailed to you, but the direct download works without entering anything, an email is never required to get your document.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Is it safe to sign documents online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Documents you sign, contracts, agreements, forms, are often sensitive, so here is precisely how they are handled.
                </p>
                <p>
                  <strong>Nothing Is Uploaded</strong><br />
                  Signing runs entirely in your browser: the PDF, your signature, and the finished document never leave your device. There is no upload, no server-side processing, and therefore no copy of your document anywhere but your own machine.
                </p>
                <p>
                  <strong>Nothing to Delete Afterward</strong><br />
                  Because the file is never sent to a server, there is no retention window, no backups, and no archive to worry about; your signed contract cannot sit in storage somewhere, because it was never stored.
                </p>
                <p>
                  <strong>What We Collect, Honestly</strong><br />
                  No account or personal information is required. We never see the contents of your documents or your signature. For transparency: BlendPDF uses Google Analytics for aggregate, anonymous usage measurement (how many people used the tool), which never includes your files or their contents.
                </p>
                <p>
                  <strong>One Sensible Precaution</strong><br />
                  Your signature image is worth treating like a signature: keep the file somewhere private on your device, and share signed documents only with their intended recipients, the same care you would take with a wet-ink signature.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I sign a password-protected PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly. An encrypted PDF cannot be read by the signing engine, so a password-protected file will fail with an error rather than sign.
                </p>
                <p>
                  <strong>The Three-Step Workflow</strong><br />
                  First, remove the password with our <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF tool</Link>, you need to know the password. Second, sign the unlocked copy here. Third, if the signed document should be confidential again, re-protect it with the <Link href="/protect-pdf" className="text-blue-600 hover:text-blue-800">Protect PDF tool</Link>, which applies real AES-256 encryption. The whole round trip takes a couple of minutes.
                </p>
                <p>
                  <strong>If You Do Not Know the Password</strong><br />
                  Then it cannot be unlocked, by us or any honest tool, and it cannot be signed. Ask the sender for the password or for an unprotected copy. If the file merely restricts editing but opens without a password, the Unlock tool's "Remove Restrictions" mode clears that without any password.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I sign a scanned PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, and this is one of the most common uses of the tool. Because the signature is drawn on top of the page, it does not matter whether the page underneath is digital text or a scanned image.
                </p>
                <p>
                  <strong>The Classic Scenario</strong><br />
                  Someone emails you a scanned form or agreement and asks you to sign and return it. Without this tool, that means print, sign, scan, email, assuming you own a printer. With it: upload, place your signature image on the right page, download, reply. The result is visually identical to the print-and-scan version, and usually cleaner.
                </p>
                <p>
                  <strong>One Honest Limitation</strong><br />
                  Scanned pages are pictures, so the text in them is not selectable or searchable, and signing does not change that. BlendPDF does not currently offer OCR (text recognition). If you need the scanned document's text to be searchable or editable, run it through an OCR tool first; if you just need it signed, no OCR is needed at all.
                </p>
                <p>
                  <strong>Positioning on Scans</strong><br />
                  Scanned forms often have a signature line in a specific spot. Drag the signature directly onto that line in the live preview and resize it to fit — placement is free, so landing exactly on the line is easy.
                </p>
              </div>
            </section>

            <section id="file-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. What are the file limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The limits are simple and generous enough that most users never meet them.
                </p>
                <p>
                  <strong>The Numbers</strong><br />
                  One PDF per operation, up to 50MB. Signature images can be any common format your browser can display (PNG, JPEG, WebP, and more) — they are converted automatically before being placed. No page-count limit, you can sign page 1 or page 500, and place signatures on as many pages as you like.
                </p>
                <p>
                  <strong>If Your PDF Is Over 50MB</strong><br />
                  Oversized PDFs are usually scan-heavy. Run the file through our <Link href="/compress-pdf" className="text-blue-600 hover:text-blue-800">Compress PDF tool</Link> first, it keeps text selectable and returns your original unchanged if it cannot shrink the file, then sign the compressed copy.
                </p>
                <p>
                  <strong>Processing Time</strong><br />
                  Signing is fast, typically a couple of seconds. Because everything happens in your browser, there is no upload or download wait at all — even a large scanned file is signed at the speed of your own device.
                </p>
              </div>
            </section>

            <section id="comparison" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. How does this compare to printing and scanning, or Adobe Fill &amp; Sign?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Three honest comparisons, since these are the alternatives people actually weigh.
                </p>
                <p>
                  <strong>Versus Print, Sign, Scan</strong><br />
                  The end result is legally and visually equivalent, both produce a document bearing a picture of your signature. BlendPDF skips the printer and scanner, takes a minute instead of ten, and preserves the document's quality: text stays selectable and pages stay crisp, whereas a re-scan degrades everything to a photograph. If you do not own a printer, this is not even a comparison.
                </p>
                <p>
                  <strong>Versus Adobe Fill &amp; Sign</strong><br />
                  Adobe's Fill &amp; Sign produces the same class of signature, a simple visual e-signature, not a certificate-based one. Both offer freehand drag-and-drop placement with drawn, typed, or uploaded signatures; Adobe adds saved signatures, but also involves installing an app or signing in to an Adobe account, and its free tier nudges toward subscriptions. BlendPDF runs in any browser with no account and no installation. Pick based on how often you sign: daily heavy use may justify Adobe's tooling, occasional signing does not.
                </p>
                <p>
                  <strong>Versus Certificate-Based Signing Services</strong><br />
                  Dedicated e-signature platforms provide things BlendPDF deliberately does not: identity verification, cryptographic seals, audit trails, and multi-party signing workflows. They also cost money per month or per envelope. For a high-stakes contract, they are worth it, and we will tell you so rather than pretend a visual overlay is the same thing. For the everyday "sign this and send it back," BlendPDF does the job free.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What should I do if signing fails?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Failures are rare and nearly always have one of these causes.
                </p>
                <p>
                  <strong>The PDF Is Password Protected</strong><br />
                  Encrypted files cannot be processed. Unlock the file first with the <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF tool</Link>, then sign the unlocked copy.
                </p>
                <p>
                  <strong>Image Problems</strong><br />
                  Uploaded signature images can be in any format your browser can display — PNG, JPEG, WebP, and more — and are converted automatically. If an image fails to load, it is usually an unsupported format like a HEIC photo straight from an iPhone or a PDF "image"; export or share it as JPEG or PNG first, most phones can do that in one step. Or skip the image entirely and draw your signature directly on screen.
                </p>
                <p>
                  <strong>Corrupted or Oversized Files</strong><br />
                  Files over 50MB are rejected, compress first. A file that fails despite meeting the limits may be damaged; try our <Link href="/repair-pdf" className="text-blue-600 hover:text-blue-800">Repair PDF tool</Link>, which attempts recovery with multiple engines but honestly cannot fix every broken file.
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
