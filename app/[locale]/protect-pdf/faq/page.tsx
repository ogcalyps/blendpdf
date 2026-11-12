'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function ProtectPDFFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How do I password protect a PDF online?',
      answer: 'Upload your PDF (up to 50MB), type the password you want to use, and click "Protect PDF". BlendPDF encrypts the file with AES-256 and gives you a protected copy to download. No account or email is required.'
    },
    {
      question: 'What encryption does BlendPDF use to protect PDFs?',
      answer: 'BlendPDF encrypts your PDF with AES-256, the strongest encryption level defined in the PDF standard, using the qpdf engine. The password you set is required to open the file in any PDF viewer.'
    },
    {
      question: 'Is it safe to protect a PDF online?',
      answer: 'Yes. Uploads travel over an encrypted HTTPS connection, your password is used once to encrypt the file and is never stored, and files are deleted from our servers within one hour, most immediately after processing. We never read, store, or share document contents. We only collect aggregate, anonymous usage analytics.'
    },
    {
      question: 'Is protecting a PDF free? Is there a watermark?',
      answer: 'Yes, it is completely free. There is no watermark, no page limit, no daily quota that pushes you to a paid plan, and no premium tier. The protected file you download is your document, unchanged except for the encryption.'
    },
    {
      question: 'Do I need an account or email address?',
      answer: 'No. You can protect a PDF without creating an account or entering an email address. An optional email-delivery feature exists if you want the file sent to your inbox, but downloading directly never requires an email.'
    },
    {
      question: 'What happens if I forget the password?',
      answer: 'The password cannot be recovered. AES-256 encryption has no backdoor, and BlendPDF does not keep a copy of your password or your file. Store the password in a password manager and keep an unprotected copy of important documents somewhere safe.'
    },
    {
      question: 'What makes a strong PDF password?',
      answer: 'Length matters most. Use at least 12 characters mixing letters, numbers, and symbols, and avoid names, dates, or dictionary words. BlendPDF accepts passwords up to 128 characters, so a long passphrase works well.'
    },
    {
      question: 'Can I protect a PDF that already has a password?',
      answer: 'No. If the PDF is already encrypted, the tool returns an error asking you to unlock it first. Use the Unlock PDF tool with the current password, then protect the unlocked file with your new password.'
    },
    {
      question: 'Can I remove the password later?',
      answer: 'Yes, if you know the password. Upload the protected file to our Unlock PDF tool, enter the password, and download an unprotected copy. Without the password, removal is not possible.'
    },
    {
      question: 'Does this stop people from printing or copying my PDF?',
      answer: 'Not separately. BlendPDF sets an open password: nobody can open the file without it. It does not currently offer print-only or copy-only restrictions, and anyone who knows the password can use the document normally once it is open.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'One PDF per operation, up to 50MB. If your file is larger, run it through the Compress PDF tool first and then protect the compressed copy.'
    },
    {
      question: 'Will protecting the PDF change its content or quality?',
      answer: 'No. Encryption wraps the existing content without re-rendering it. Text, images, fonts, links, and layout are unchanged, and the file size stays roughly the same.'
    },
    {
      question: 'Can a password-protected PDF be opened on any device?',
      answer: 'Any reasonably modern PDF viewer can open AES-256 protected files, including Adobe Acrobat Reader, macOS Preview, Chrome, Edge, Firefox, and the standard iOS and Android viewers. Only very old software from before roughly 2010 may fail to open AES-256 files.'
    },
    {
      question: 'How does BlendPDF compare to protecting a PDF in Adobe Acrobat or Word?',
      answer: 'The encryption result is equivalent: all three can produce AES-256 protected PDFs. Adobe Acrobat Pro requires a paid subscription and offers extra permission controls; Word can only protect documents it exports itself. BlendPDF is free, works on any existing PDF, and needs no installation or account.'
    },
    {
      question: 'What should I do if I get an error?',
      answer: 'Check that the file is a valid PDF under 50MB and not already encrypted. If you see a "too many requests" message, wait a few minutes; protection is limited to 20 files per 15 minutes per user. If a valid file still fails, it may be corrupted; try the Repair PDF tool first.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Protect PDF', url: '/protect-pdf' },
        { name: 'FAQ', url: '/protect-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Protect PDF
          </h1>
          <p className="mb-8">
            <Link href="/protect-pdf" className="text-blue-600 hover:text-blue-800">
              &larr; Back to the Protect PDF tool
            </Link>
          </p>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-protect" className="text-blue-600 hover:text-blue-800">How do I password protect a PDF online?</a></li>
              <li><a href="#encryption" className="text-blue-600 hover:text-blue-800">What encryption does BlendPDF use to protect PDFs?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to protect a PDF online?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is protecting a PDF free? Is there a watermark?</a></li>
              <li><a href="#account-required" className="text-blue-600 hover:text-blue-800">Do I need an account or email address?</a></li>
              <li><a href="#forgot-password" className="text-blue-600 hover:text-blue-800">What happens if I forget the password?</a></li>
              <li><a href="#strong-password" className="text-blue-600 hover:text-blue-800">What makes a strong PDF password?</a></li>
              <li><a href="#already-protected" className="text-blue-600 hover:text-blue-800">Can I protect a PDF that already has a password?</a></li>
              <li><a href="#remove-password" className="text-blue-600 hover:text-blue-800">Can I remove the password later?</a></li>
              <li><a href="#print-copy-restrictions" className="text-blue-600 hover:text-blue-800">Does this stop people from printing or copying my PDF?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#quality" className="text-blue-600 hover:text-blue-800">Will protecting the PDF change its content or quality?</a></li>
              <li><a href="#compatibility" className="text-blue-600 hover:text-blue-800">Can a password-protected PDF be opened on any device?</a></li>
              <li><a href="#comparison" className="text-blue-600 hover:text-blue-800">How does BlendPDF compare to Adobe Acrobat or Word?</a></li>
              <li><a href="#troubleshooting" className="text-blue-600 hover:text-blue-800">What should I do if I get an error?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-protect" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How do I password protect a PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Protecting a PDF with BlendPDF takes three steps and usually finishes in a few seconds.
                </p>
                <p>
                  <strong>Upload Your File</strong><br />
                  Click "Choose File" or drag and drop a PDF onto the upload area. The tool works on one PDF at a time, up to 50MB. The upload happens over an encrypted HTTPS connection, so the file is protected in transit before it is ever encrypted at rest.
                </p>
                <p>
                  <strong>Set a Password</strong><br />
                  Type the password you want in the password field. There is an eye icon to show or hide what you typed, which is worth using: once the file is encrypted, a typo in the password locks you out just as effectively as it locks out everyone else. Passwords can be up to 128 characters long.
                </p>
                <p>
                  <strong>Protect and Download</strong><br />
                  Click "Protect PDF". BlendPDF encrypts the file with AES-256 and prepares a download named after your original file with "_protected" added. You can download it directly or, optionally, have it emailed to you. From that point on, every PDF viewer will ask for your password before opening the document.
                </p>
              </div>
            </section>

            <section id="encryption" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. What encryption does BlendPDF use to protect PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF uses real AES-256 encryption, applied by qpdf, a widely used open-source PDF engine. AES-256 is the strongest encryption level defined in the PDF specification and the same algorithm class used for banking and government data. This is not a cosmetic lock: the document contents are actually encrypted, and without the password the data inside the file is unreadable.
                </p>
                <p>
                  <strong>What Gets Encrypted</strong><br />
                  The page contents, text, images, and embedded resources of the PDF are all encrypted. When someone opens the file, their PDF viewer asks for the password, derives the decryption key from it, and only then can render the document. This behavior is part of the PDF standard, so it works in any compliant viewer, not just ours.
                </p>
                <p>
                  <strong>How Strong Is It in Practice?</strong><br />
                  Brute-forcing AES-256 itself is not feasible with current technology. The realistic weak point is the password you choose: an attacker will try guessing passwords, not breaking the cipher. A short or common password can be guessed by automated tools; a long, unique one cannot. See the strong-password question below for practical guidance.
                </p>
                <p>
                  <strong>One Honest Caveat</strong><br />
                  Encryption controls who can open the file. It cannot stop someone who legitimately knows the password from copying, photographing, or re-sharing the content once the document is open. No PDF protection tool, paid or free, can prevent that.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Is it safe to protect a PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, and because you are trusting us with a document you clearly consider sensitive, here is exactly how it is handled rather than a vague reassurance.
                </p>
                <p>
                  <strong>In Transit</strong><br />
                  Your file and password travel to our server over an encrypted HTTPS (TLS) connection, the same protection online banking uses. They are not sent anywhere else.
                </p>
                <p>
                  <strong>During Processing</strong><br />
                  The password is used once, to run the encryption, and is not written to logs or stored anywhere. Processing is fully automated; no person views your document. Temporary files created during encryption are removed as soon as the job finishes.
                </p>
                <p>
                  <strong>After Processing</strong><br />
                  Files are deleted from our servers within one hour at most, and in most cases immediately after your download is ready. We keep no backups and no archive, so there is nothing to recover or leak later.
                </p>
                <p>
                  <strong>What We Do and Do Not Collect</strong><br />
                  We never read, store, or share the contents of your documents, and no account or personal details are required to use the tool. To be fully transparent: like most websites, BlendPDF uses Google Analytics to measure aggregate, anonymous usage, such as how many people used a tool on a given day. That measurement never includes your files, their contents, or your password.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Is protecting a PDF free? Is there a watermark?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, it is genuinely free, and no, there is no watermark. The protected file you download is your document, byte-for-byte the same content, just encrypted.
                </p>
                <p>
                  <strong>No Paywall Tricks</strong><br />
                  Many "free" PDF sites let you protect one or two files and then ask for a subscription, or stamp their logo on your document. BlendPDF does neither. There is no daily quota designed to run out, no premium tier holding back the real features, and no trial that converts to a paid plan. AES-256 encryption, the 50MB limit, and every option on the page are available to everyone at no cost.
                </p>
                <p>
                  <strong>Use It as Often as You Need</strong><br />
                  You can protect as many files as you want. The only limit is a fair-use rate limit of 20 protection jobs per 15 minutes per user, which exists to keep the service responsive for everyone and is far above normal usage.
                </p>
              </div>
            </section>

            <section id="account-required" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Do I need an account or email address?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. You can open the page, upload a file, set a password, and download the protected result without registering, confirming an email, or entering any personal information.
                </p>
                <p>
                  <strong>About the Email Prompt</strong><br />
                  After processing, BlendPDF offers to email the finished file to you as a convenience, for example if you want it on another device. This is optional. You can always choose the direct download instead, and the download never requires an email address.
                </p>
                <p>
                  <strong>Why This Matters for a Protection Tool</strong><br />
                  If you are encrypting a document, you probably care about privacy. Not requiring an account means there is no profile linking you to the documents you process, no password to reuse, and no marketing list to end up on.
                </p>
              </div>
            </section>

            <section id="forgot-password" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. What happens if I forget the password?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  There is no recovery. This is the honest, important answer: AES-256 encryption has no backdoor, BlendPDF does not store your password, and we do not keep a copy of your file. If the password is lost, the encrypted document is effectively lost with it.
                </p>
                <p>
                  <strong>Why We Cannot Help</strong><br />
                  This is by design, and it is what makes the protection meaningful. If we could open your file without the password, so could anyone who compromised our servers. The same property that keeps your document safe from others also means we genuinely cannot rescue it for you.
                </p>
                <p>
                  <strong>Practical Precautions</strong><br />
                  Save the password in a password manager at the moment you create it. Keep an unprotected copy of important documents in a location you already trust, such as an encrypted disk or a private cloud folder, and treat the protected copy as the one you share. If you distribute a protected PDF to others, send the password through a different channel than the file itself.
                </p>
              </div>
            </section>

            <section id="strong-password" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. What makes a strong PDF password?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Since attackers guess passwords rather than break AES-256 itself, the strength of your protection is exactly the strength of your password.
                </p>
                <p>
                  <strong>Length Beats Complexity</strong><br />
                  A 16-character passphrase of random words is stronger than an 8-character jumble of symbols, and much easier to type correctly. Aim for at least 12 characters; BlendPDF accepts up to 128, so long passphrases are fine.
                </p>
                <p>
                  <strong>Avoid the Predictable</strong><br />
                  Skip names, birthdays, phone numbers, the document title, your company name, and single dictionary words with a number bolted on. Password-guessing tools try all of these first. Also avoid reusing a password you use for any online account: if you share the PDF and its password with someone, you have shared that password.
                </p>
                <p>
                  <strong>A Good Pattern</strong><br />
                  Three or four unrelated words plus a number and a symbol, for example a phrase only you would associate together, gives strong protection and stays memorable. Generate and store it in a password manager if the document matters.
                </p>
              </div>
            </section>

            <section id="already-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Can I protect a PDF that already has a password?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly. If you upload a PDF that is already encrypted, the tool stops and tells you the file is already password protected, because it cannot read the existing content to re-encrypt it.
                </p>
                <p>
                  <strong>How to Change a PDF's Password</strong><br />
                  The workflow is a two-step round trip. First, open our <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF tool</Link>, upload the file, and enter its current password to get an unprotected copy. Second, bring that copy back to Protect PDF and encrypt it with the new password. The whole process takes under a minute.
                </p>
                <p>
                  <strong>A Note on Permissions-Only Protection</strong><br />
                  Some PDFs open without a password but block printing or copying. Those files carry a different kind of protection (an owner password). The Unlock PDF tool can remove those restrictions too, after which you can apply a proper open password here if that is what you actually want.
                </p>
              </div>
            </section>

            <section id="remove-password" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. Can I remove the password later?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, as long as you know the password. Upload the protected file to our <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF tool</Link>, enter the password, and download a copy that opens without one.
                </p>
                <p>
                  <strong>The Password Is Required</strong><br />
                  Unlocking is decryption, and decryption needs the key. Neither BlendPDF nor any other legitimate tool can strip an open password from a PDF without knowing it. If a site claims it can remove any password instantly, it is either only removing permission restrictions (which never required the password) or overpromising.
                </p>
                <p>
                  <strong>When This Is Useful</strong><br />
                  Removing protection makes sense when a document no longer needs to be confidential, when you need to process it with other tools (most PDF tools, including ours, cannot operate on encrypted files), or when you want to re-protect it with a stronger password.
                </p>
              </div>
            </section>

            <section id="print-copy-restrictions" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Does this stop people from printing or copying my PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not as a separate control. BlendPDF sets an open password: the document cannot be opened at all without it. It does not currently offer the granular permission flags (allow opening but block printing, copying, or editing) that some desktop tools expose.
                </p>
                <p>
                  <strong>What That Means in Practice</strong><br />
                  People without the password see nothing, which is the strongest protection PDF offers. People with the password can read, print, and copy the document normally. If your goal is "only these people can see this file", an open password does exactly that. If your goal is "everyone can read it but nobody can print it", this tool is not the right fit today.
                </p>
                <p>
                  <strong>Honest Advice About Permission Restrictions</strong><br />
                  It is worth knowing that print/copy restrictions on an openable PDF are advisory rather than enforceable. Because the viewer must be able to display the content, tools can and do strip those restrictions; our own Unlock PDF tool removes them without a password. If a document truly must stay confidential, an open password (what this tool does) is the meaningful protection, not permission flags.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  You can protect one PDF at a time, up to 50MB per file. There is no page-count limit; a 500-page contract under 50MB encrypts as easily as a one-page letter.
                </p>
                <p>
                  <strong>If Your File Is Larger</strong><br />
                  Run it through our <Link href="/compress-pdf" className="text-blue-600 hover:text-blue-800">Compress PDF tool</Link> first. Compression keeps text selectable and, if it cannot make the file smaller, returns your original unchanged, so there is no downside to trying. Then protect the compressed copy.
                </p>
                <p>
                  <strong>Processing Time</strong><br />
                  Encryption is fast. Typical documents finish in a couple of seconds; files near the 50MB limit may take slightly longer, mostly for upload and download time on your connection rather than the encryption itself.
                </p>
              </div>
            </section>

            <section id="quality" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Will protecting the PDF change its content or quality?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. Encryption does not re-render, recompress, or reflow anything. It wraps the existing bytes of your document in an encrypted container defined by the PDF standard.
                </p>
                <p>
                  <strong>Everything Is Preserved</strong><br />
                  Text stays selectable (for anyone who opens the file with the password), fonts remain embedded, images keep their original resolution, and links, bookmarks, and form fields continue to work. Arabic and other right-to-left content is untouched, since the page content is encrypted as-is rather than reprocessed.
                </p>
                <p>
                  <strong>File Size</strong><br />
                  The protected file is roughly the same size as the original, sometimes a few kilobytes different due to the encryption dictionary and restructuring. If you see a dramatic size change, something else is going on and it is worth comparing the files.
                </p>
              </div>
            </section>

            <section id="compatibility" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Can a password-protected PDF be opened on any device?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Any modern PDF viewer can open AES-256 protected files. That includes Adobe Acrobat Reader, macOS Preview, the built-in viewers in Chrome, Edge, Firefox, and Safari, and the standard PDF apps on iOS and Android. The recipient just gets a password prompt before the document renders.
                </p>
                <p>
                  <strong>The One Compatibility Caveat</strong><br />
                  AES-256 for PDF was standardized around 2008-2010 (Acrobat 9/X era). Genuinely ancient viewers, or some minimal embedded PDF renderers, may not support it and will report the file as unreadable rather than asking for a password. In practice this is rare; any software updated in the last decade handles it.
                </p>
                <p>
                  <strong>Sharing Tips</strong><br />
                  Tell recipients the file is password protected so the prompt does not surprise them, and send the password through a different channel than the file (for example, file by email, password by text message). That way, intercepting one channel is not enough to read the document.
                </p>
              </div>
            </section>

            <section id="comparison" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. How does BlendPDF compare to Adobe Acrobat or Word?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  For the core job, encrypting a PDF so it needs a password to open, the result is equivalent: all three produce standards-compliant encrypted PDFs that any viewer can open with the password.
                </p>
                <p>
                  <strong>Adobe Acrobat Pro</strong><br />
                  Acrobat Pro offers the same AES-256 encryption plus extras BlendPDF does not have: separate owner passwords with granular print/copy permissions, and certificate-based security. It costs a monthly subscription and requires installation. If you need those enterprise controls, Acrobat is the right tool; if you need a file password-protected, it is overkill.
                </p>
                <p>
                  <strong>Microsoft Word</strong><br />
                  Word can encrypt a PDF only when exporting a document it created ("Save As" PDF with password, on some platforms). It cannot add a password to an existing PDF you received from someone else, which is the more common need. Word's PDF encryption also varies by version and platform.
                </p>
                <p>
                  <strong>BlendPDF</strong><br />
                  Free, no installation, no account, works on any existing PDF up to 50MB, and deletes your file within the hour. The trade-off is honest: you get one strong option (AES-256 open password) rather than a menu of enterprise permission settings.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What should I do if I get an error?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Errors are uncommon and almost always fall into one of a few categories, each with a clear fix.
                </p>
                <p>
                  <strong>"This PDF is already password protected"</strong><br />
                  The file is already encrypted. Unlock it first with the <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF tool</Link> (you need its current password), then protect the unlocked copy.
                </p>
                <p>
                  <strong>"File size limit is 50MB"</strong><br />
                  Compress the file with our Compress PDF tool and protect the smaller copy.
                </p>
                <p>
                  <strong>"This file doesn't appear to be a valid PDF" or a generic failure</strong><br />
                  The file may be corrupted, mislabeled (for example, a Word file renamed to .pdf), or damaged in transfer. Confirm it opens in a PDF viewer. If it opens but still fails here, run it through our <Link href="/repair-pdf" className="text-blue-600 hover:text-blue-800">Repair PDF tool</Link>, which attempts recovery but honestly cannot fix every damaged file, and try again.
                </p>
                <p>
                  <strong>"Too many protection requests"</strong><br />
                  You hit the fair-use rate limit of 20 jobs per 15 minutes. Wait a few minutes and continue; nothing is lost.
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
