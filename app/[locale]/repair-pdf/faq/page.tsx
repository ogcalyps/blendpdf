'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function RepairPDFFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How does the PDF repair tool work?',
      answer: 'BlendPDF tries two recovery methods in order. First, the qpdf engine rewrites the file from scratch, rebuilding the cross-reference tables and recovering damaged objects — this fixes most structural corruption. If qpdf cannot process the file at all, a second pass using the pypdf library copies every page it can still read into a new PDF, skipping pages that are beyond recovery.'
    },
    {
      question: 'What kinds of PDF damage can be repaired?',
      answer: 'The tool handles structural damage best: broken cross-reference tables, damaged object references, malformed trailers, files that were not closed properly during saving, and PDFs that some viewers refuse to open even though most of the data is intact. It recovers what is still present in the file — it cannot reconstruct data that is missing.'
    },
    {
      question: 'What kinds of damage cannot be repaired?',
      answer: 'If the underlying data is gone, no tool can bring it back. Files truncated during download, files whose bytes were overwritten, encrypted files where the encryption data itself is damaged, and files that were never valid PDFs to begin with usually cannot be recovered. Repair restores structure around surviving content; it does not recreate lost content.'
    },
    {
      question: 'Is my PDF guaranteed to be fixed?',
      answer: 'No, and any tool that promises a 100% success rate is overselling. Success depends on how much of the original data survived. BlendPDF recovers everything it can and returns a rebuilt file, but severely damaged files may come back incomplete or may fail to repair at all.'
    },
    {
      question: 'Will I lose pages or content during repair?',
      answer: 'Possibly. If individual pages are too damaged to read, the fallback recovery skips them and keeps the rest, so the repaired PDF may have fewer pages than the original. When the primary qpdf repair succeeds, all pages are usually preserved. Always open the repaired file and check it against what you expected.'
    },
    {
      question: 'How do I repair a corrupted PDF online?',
      answer: 'Upload the damaged PDF (up to 50MB) by dragging it onto the page or clicking Choose File, then click Repair PDF. Processing usually takes a few seconds to a couple of minutes depending on file size. When it finishes, download the repaired copy. No account or email is required.'
    },
    {
      question: 'Is repairing a PDF free? Is there a watermark?',
      answer: 'Yes, it is completely free. There is no watermark on the output, no page limit, no daily quota that pushes you to a paid plan, and no sign-up. The repaired file is your document, rebuilt — nothing is added to it.'
    },
    {
      question: 'Is it safe to upload a corrupted PDF?',
      answer: 'Yes. Files travel over an encrypted HTTPS connection and are deleted from our servers within one hour, most immediately after processing. We never read, store, or share the contents of your documents, and no account is needed. We only measure usage as anonymous totals, through Google Analytics and our own count of tool runs, never your documents.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'One PDF per operation, up to 50MB. Repair is limited to 20 files per 15 minutes per user. Corrupted files sometimes cannot be compressed first, so if your file is over 50MB, try recovering it from its original source instead.'
    },
    {
      question: 'Why do PDFs get corrupted in the first place?',
      answer: 'Common causes are interrupted downloads or uploads, emailing a file that gets cut off, crashes while an application is saving, failing storage drives or USB sticks, and software that writes non-standard PDF structures. If a file keeps arriving corrupted, re-export it from the source application rather than repairing each copy.'
    },
    {
      question: 'Can you repair a password-protected PDF?',
      answer: 'Not directly. If the file opens with a password but misbehaves, remove the password first with the Unlock PDF tool, then repair the unlocked copy. If the encryption data itself is corrupted, the file usually cannot be recovered, because the contents are unreadable without intact encryption structures.'
    },
    {
      question: 'Does repair work on scanned PDFs? Do you do OCR?',
      answer: 'Repair works on scanned PDFs the same way it works on any PDF: it recovers the file structure and the page images inside it. It does not perform OCR — BlendPDF has no OCR feature yet — so a scanned PDF stays a set of images and its text will not become selectable or searchable after repair.'
    },
    {
      question: 'The repaired file still will not open. What now?',
      answer: 'Try re-downloading or re-exporting the file from its original source, check email or cloud storage for an earlier intact copy, look for previous versions in your backup or file-history tools, or ask the sender to resend it. If several independent tools cannot open the file, the data is most likely gone.'
    },
    {
      question: 'How does this compare to repairing in Adobe Acrobat?',
      answer: 'Adobe Acrobat quietly rebuilds mildly damaged files when it opens them, but it has no dedicated repair button and requires a paid license for editing features. BlendPDF gives you an explicit repair step, is free, and runs in the browser with nothing to install. For severe corruption, neither approach can recover data that no longer exists in the file.'
    },
    {
      question: 'What should I do if I get an error while repairing?',
      answer: 'Check that the file is under 50MB and actually a PDF — renaming a .docx to .pdf does not make it one. If you see a "too many requests" message, wait a few minutes; the limit is 20 files per 15 minutes. If a repair fails outright, the file is likely damaged beyond what automated recovery can do.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Repair PDF', url: '/repair-pdf' },
        { name: 'FAQ', url: '/repair-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Repair PDF
          </h1>
          <p className="mb-8">
            <Link href="/repair-pdf" className="text-blue-600 hover:text-blue-800">
              &larr; Back to the Repair PDF tool
            </Link>
          </p>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-it-works" className="text-blue-600 hover:text-blue-800">How does the PDF repair tool work?</a></li>
              <li><a href="#what-can-be-fixed" className="text-blue-600 hover:text-blue-800">What kinds of PDF damage can be repaired?</a></li>
              <li><a href="#what-cannot-be-fixed" className="text-blue-600 hover:text-blue-800">What kinds of damage cannot be repaired?</a></li>
              <li><a href="#guarantee" className="text-blue-600 hover:text-blue-800">Is my PDF guaranteed to be fixed?</a></li>
              <li><a href="#data-loss" className="text-blue-600 hover:text-blue-800">Will I lose pages or content during repair?</a></li>
              <li><a href="#how-to-repair" className="text-blue-600 hover:text-blue-800">How do I repair a corrupted PDF online?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is repairing a PDF free? Is there a watermark?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to upload a corrupted PDF?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#why-corruption-happens" className="text-blue-600 hover:text-blue-800">Why do PDFs get corrupted in the first place?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can you repair a password-protected PDF?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Does repair work on scanned PDFs? Do you do OCR?</a></li>
              <li><a href="#still-wont-open" className="text-blue-600 hover:text-blue-800">The repaired file still will not open. What now?</a></li>
              <li><a href="#comparison" className="text-blue-600 hover:text-blue-800">How does this compare to repairing in Adobe Acrobat?</a></li>
              <li><a href="#troubleshooting" className="text-blue-600 hover:text-blue-800">What should I do if I get an error while repairing?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-it-works" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How does the PDF repair tool work?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF runs two recovery strategies in order, starting with the one that fixes the most files with the least data loss.
                </p>
                <p>
                  <strong>Primary Repair: Structural Rebuild</strong><br />
                  The first pass uses qpdf, a well-established open-source PDF engine. It reads whatever it can from your file and writes a brand-new PDF around it: cross-reference tables are rebuilt, damaged object references are recovered where possible, and malformed structures are replaced with valid ones. Most corrupted-but-mostly-intact PDFs — the kind that make a viewer say "this file is damaged" even though the content is still in there — are fixed by this step. Importantly, qpdf reports when it had to recover from real damage, and we treat that recovery as a success rather than giving up.
                </p>
                <p>
                  <strong>Fallback: Page-by-Page Recovery</strong><br />
                  If the file is too damaged for a structural rewrite, a second pass uses the pypdf library in lenient mode. It walks through the document page by page, copies every page it can still parse into a fresh PDF, and skips pages that cannot be read at all. This is a more aggressive salvage operation: you may get back fewer pages than the original had, but you get back what survived.
                </p>
                <p>
                  <strong>What You Receive</strong><br />
                  Either way, the output is a newly written, standards-compliant PDF — not your original file with a patch on top. That is why repaired files often open in viewers that rejected the original. The repaired copy downloads with "_repaired" added to the filename so you can keep it separate from the damaged original.
                </p>
              </div>
            </section>

            <section id="what-can-be-fixed" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. What kinds of PDF damage can be repaired?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The tool is best at structural corruption — problems with how the file is organized rather than missing data. In practice, that covers a large share of real-world "this PDF won't open" cases.
                </p>
                <p>
                  <strong>Broken Cross-Reference Tables</strong><br />
                  A PDF contains an index (the "xref" table) that tells viewers where every object in the file lives. When that index is wrong or damaged — a very common failure after interrupted saves — the content is still present but viewers cannot find it. Rebuilding the index is exactly what the primary repair does, and success rates for this type of damage are high.
                </p>
                <p>
                  <strong>Malformed Structure from Buggy Software</strong><br />
                  Some applications generate PDFs that bend the specification: wrong object offsets, missing end-of-file markers, duplicated or conflicting trailers. Strict viewers reject these files even though nothing is really "lost." A structural rewrite normalizes them into clean, valid PDFs.
                </p>
                <p>
                  <strong>Partially Damaged Objects</strong><br />
                  When some objects in the file are unreadable but others are fine, the fallback recovery salvages the readable pages. A ten-page document with two destroyed pages can often come back as an eight-page document — not perfect, but far better than nothing when the original is gone.
                </p>
                <p>
                  <strong>Files That Open in One Viewer but Not Another</strong><br />
                  If a PDF opens in Chrome but not in Acrobat, or on your phone but not in your print shop's software, the file is usually structurally questionable. Running it through repair produces a clean rewrite that behaves consistently across viewers.
                </p>
              </div>
            </section>

            <section id="what-cannot-be-fixed" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. What kinds of damage cannot be repaired?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Honest answer: repair restores structure around surviving data. If the data itself is gone, no tool — ours, Adobe's, or anyone else's — can reconstruct it. Knowing the limits saves you time.
                </p>
                <p>
                  <strong>Truncated Files</strong><br />
                  If a download or email transfer was cut off, the missing bytes were simply never written to disk. A 5MB PDF that arrived as 1.2MB is missing most of its content. Repair may recover the pages contained in the portion that arrived, but the rest does not exist to recover. The fix is to re-download or ask the sender to resend.
                </p>
                <p>
                  <strong>Overwritten Data</strong><br />
                  If another program or a failing disk wrote garbage over parts of the file, those regions are permanently destroyed. Pages stored in the damaged regions are unrecoverable; pages elsewhere may still be salvaged.
                </p>
                <p>
                  <strong>Damaged Encrypted Files</strong><br />
                  An encrypted PDF whose encryption dictionary or encrypted streams are corrupted is usually a lost cause. Without intact encryption structures, the content cannot be decrypted, and without decryption there is nothing readable to salvage.
                </p>
                <p>
                  <strong>Files That Were Never PDFs</strong><br />
                  A surprising number of "corrupted PDFs" are actually Word documents, images, or HTML error pages that ended up with a .pdf extension. Repair cannot convert them — check the file in a text editor or try opening it with its real format's application.
                </p>
              </div>
            </section>

            <section id="guarantee" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Is my PDF guaranteed to be fixed?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. We would rather tell you that plainly than promise something no tool can deliver. Any service advertising a 100% PDF repair success rate is overselling.
                </p>
                <p>
                  <strong>What Determines Success</strong><br />
                  The single biggest factor is how much of the original data survived. Structural problems around intact data repair very well. Missing or overwritten data does not come back. Between those extremes are files where some pages survive and some do not — the tool recovers what it can.
                </p>
                <p>
                  <strong>What Happens When Repair Fails</strong><br />
                  If neither recovery method can produce a valid PDF, you get a clear error rather than a broken download. Nothing is charged and nothing is lost — your original file on your device is untouched, since the tool always works on a copy you upload.
                </p>
                <p>
                  <strong>Verify the Result</strong><br />
                  When repair succeeds, open the downloaded file and check it before deleting anything: page count, images, and any critical content. A repaired file is a reconstruction, and for badly damaged originals it may be missing pieces. Keep the damaged original until you have confirmed the repaired copy has everything you need.
                </p>
              </div>
            </section>

            <section id="data-loss" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Will I lose pages or content during repair?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  It depends on which recovery path your file needs and how badly it is damaged.
                </p>
                <p>
                  <strong>When Structure Is the Only Problem</strong><br />
                  If the primary structural rebuild succeeds — the most common outcome — all pages and content are normally preserved. The file is rewritten, but text, images, fonts, and layout come through intact because the underlying data was never damaged, only the scaffolding around it.
                </p>
                <p>
                  <strong>When Pages Are Damaged</strong><br />
                  The fallback page-by-page recovery deliberately skips pages it cannot parse. That is a feature, not a bug: recovering eight of ten pages beats failing on all ten. But it does mean the repaired PDF can have fewer pages than the original. Compare page counts after repair.
                </p>
                <p>
                  <strong>What About Interactive Features?</strong><br />
                  Aggressive recovery focuses on page content. Extras like bookmarks, form fields, annotations, and embedded attachments may not survive a deep salvage, especially if the parts of the file describing them were in the damaged region. If the file repairs via the structural path, these features usually survive.
                </p>
                <p>
                  <strong>Your Original Is Never Modified</strong><br />
                  Repair always produces a new file. The copy on your device stays exactly as it was, so trying a repair costs you nothing and risks nothing.
                </p>
              </div>
            </section>

            <section id="how-to-repair" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. How do I repair a corrupted PDF online?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The whole process takes under a minute for most files:
                </p>
                <p>
                  <strong>Step 1: Upload the Damaged File</strong><br />
                  Go to the Repair PDF tool and drag your file onto the upload area, or click "Choose File" to browse for it. You can also pick a file from Google Drive. One file at a time, up to 50MB. It does not matter that the file will not open on your device — the tool works on the raw bytes, not on a rendered view.
                </p>
                <p>
                  <strong>Step 2: Click Repair PDF</strong><br />
                  The tool tries the structural rebuild first and falls back to page-by-page recovery automatically if needed. You do not have to choose a method or understand the difference — it just tries the best option first. Small files finish in seconds; large or badly damaged files can take up to a couple of minutes.
                </p>
                <p>
                  <strong>Step 3: Download and Verify</strong><br />
                  Download the repaired file — it is named after your original with "_repaired" appended. Open it and check the page count and contents. If you prefer, you can have the file sent to your email instead, but that is optional; downloading directly never requires an email address or account.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Is repairing a PDF free? Is there a watermark?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, it is completely free, and no, there is no watermark. This question comes up a lot because several well-known PDF sites offer "free" repair that turns out to be limited.
                </p>
                <p>
                  <strong>No Paywall Mechanics</strong><br />
                  There is no trial that expires, no daily task quota that forces an upgrade, no "premium repair" tier with the good algorithm behind it, and no file size teaser. The repair you get is the full repair, every time.
                </p>
                <p>
                  <strong>Nothing Added to Your File</strong><br />
                  The output is your document, rebuilt. No watermark, no branded cover page, no metadata advertising. It would be a strange repair tool that damaged your file's appearance while fixing its structure.
                </p>
                <p>
                  <strong>No Sign-Up</strong><br />
                  You do not need to create an account, confirm an email, or hand over any personal information. Visit the page, upload, repair, download. An optional email-delivery feature exists if you want the result sent to your inbox, but it is genuinely optional.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Is it safe to upload a corrupted PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. Corrupted files are often important ones — contracts, theses, records you have no other copy of — so privacy matters here more than for most tools.
                </p>
                <p>
                  <strong>Encrypted Transfer</strong><br />
                  Files travel to our servers over HTTPS (SSL/TLS), the same encryption standard used for online banking. The repaired file comes back over the same encrypted channel.
                </p>
                <p>
                  <strong>Fast, Automatic Deletion</strong><br />
                  Uploaded files and repaired outputs are deleted from our servers within one hour, and most are removed immediately after processing. We keep no backups and no archive; once deleted, the files are gone from our systems.
                </p>
                <p>
                  <strong>What We Do and Do Not Collect</strong><br />
                  Processing is fully automated — no person at BlendPDF sees your files, and we never read, store, or share the contents of your documents. No account or email is required, so there is no identity to tie an upload to. We do use Google Analytics to measure aggregate, anonymous usage of the site (page views, which tools get used), which helps us decide what to improve. That measurement never includes your documents or anything in them.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Repair accepts one PDF per operation, up to 50MB.
                </p>
                <p>
                  <strong>Usage Limits</strong><br />
                  To keep the service fast and free for everyone, repair is limited to 20 files per 15 minutes per user. If you hit the limit, you will see a "too many requests" message — wait a few minutes and continue.
                </p>
                <p>
                  <strong>If Your File Is Over 50MB</strong><br />
                  Normally we would suggest compressing a large file first, but corrupted files often cannot be processed by other tools precisely because they are corrupted. If your damaged file exceeds 50MB, your best options are recovering an earlier copy from the original source, backups, or file history, or re-exporting from the application that created it.
                </p>
                <p>
                  <strong>Processing Time</strong><br />
                  Repair has generous time limits — up to two minutes of processing — because deep recovery on large files takes longer than routine PDF operations. Most files finish in well under 30 seconds.
                </p>
              </div>
            </section>

            <section id="why-corruption-happens" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Why do PDFs get corrupted in the first place?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Understanding the cause helps you prevent the next one — and sometimes points to a better fix than repair.
                </p>
                <p>
                  <strong>Interrupted Transfers</strong><br />
                  The most common cause. A download that stalled, an email attachment that was cut off, a cloud sync that ran out of battery mid-upload. The result is a truncated file. If this is your situation, re-transferring the file is more reliable than repairing the truncated copy.
                </p>
                <p>
                  <strong>Crashes During Save</strong><br />
                  If an application or the whole system crashes while writing a PDF, the file can be left half-written: old index, new content, or vice versa. These files often repair very well, because most of the data is present and only the structure is inconsistent.
                </p>
                <p>
                  <strong>Failing Storage</strong><br />
                  Aging hard drives, worn-out USB sticks, and cheap SD cards silently corrupt files by flipping or losing bits. If several files from the same drive are corrupted, back up everything on it immediately — repair the PDFs second, rescue the drive first.
                </p>
                <p>
                  <strong>Non-Standard Generators</strong><br />
                  Some software produces technically invalid PDFs that stricter viewers reject. These are the easiest "repairs" of all, since nothing is actually lost. If one program's exports constantly need repair, that program is the problem.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can you repair a password-protected PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly — encryption and repair do not mix well, and it is worth understanding why.
                </p>
                <p>
                  <strong>If the File Opens with Its Password</strong><br />
                  When a protected PDF opens correctly but behaves badly (rendering glitches, errors in some viewers), remove the password first using our <Link href="/unlock-pdf" className="text-blue-600 hover:text-blue-800">Unlock PDF</Link> tool — you will need to know the password — and then run the unlocked copy through repair. Once repaired, you can re-protect it with the <Link href="/protect-pdf" className="text-blue-600 hover:text-blue-800">Protect PDF</Link> tool.
                </p>
                <p>
                  <strong>If the Encryption Itself Is Damaged</strong><br />
                  When corruption hits the encryption structures of a protected PDF, the situation is usually unrecoverable. The content is stored encrypted; if the information needed to decrypt it is damaged, the content cannot be read by any tool, with or without the password. This is one of the hard limits of PDF recovery.
                </p>
                <p>
                  <strong>A Note on Permissions</strong><br />
                  Only unlock and repair documents you own or have permission to modify. Repair is for rescuing your own files, not for circumventing someone else's document protection.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Does repair work on scanned PDFs? Do you do OCR?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Repair works on scanned PDFs, but it is important to be clear about what "repair" means for them.
                </p>
                <p>
                  <strong>Structural Repair: Yes</strong><br />
                  A scanned PDF is a container of page images. If the container is corrupted — broken index, damaged structure — repair rebuilds it exactly as it would for any other PDF, and the recovered file will show your scanned pages again. If some page images sit in a damaged region of the file, those pages may come back blank or be skipped, while the rest are recovered.
                </p>
                <p>
                  <strong>OCR: No, We Do Not Have It Yet</strong><br />
                  BlendPDF currently has no OCR (optical character recognition) feature. Repairing a scanned PDF will not make its text selectable, searchable, or copyable — the pages remain images, exactly as scanned. We say this plainly because several tools blur the line between repair and OCR in their marketing.
                </p>
                <p>
                  <strong>Workarounds If You Need Searchable Text</strong><br />
                  After repairing, you can run the file through an OCR tool elsewhere: Adobe Acrobat's "Recognize Text," the free OCR built into many scanner utilities, or open-source options like OCRmyPDF. Repair first, OCR second — OCR tools generally refuse corrupted input.
                </p>
              </div>
            </section>

            <section id="still-wont-open" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. The repaired file still will not open. What now?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  If repair failed or the output is unusable, do not give up immediately — but shift your effort from fixing the copy to finding a better copy.
                </p>
                <p>
                  <strong>Go Back to the Source</strong><br />
                  Re-download the file from wherever it came from, or re-export it from the application that created it. A fresh copy beats a repaired copy every time. If it arrived by email, check whether the sender still has the original.
                </p>
                <p>
                  <strong>Check for Earlier Versions</strong><br />
                  Cloud storage services (Google Drive, Dropbox, OneDrive) keep version history — an earlier, intact version of the file may be one click away. The same goes for local backup tools like Time Machine and Windows File History, and for email attachments from before the corruption happened.
                </p>
                <p>
                  <strong>Try a Different Viewer</strong><br />
                  Some viewers are far more tolerant than others. A file Acrobat rejects may open in Chrome, Firefox, macOS Preview, or SumatraPDF. If any viewer can open it, use that viewer's "Save As" or print-to-PDF to produce a clean copy.
                </p>
                <p>
                  <strong>Accept the Hard Cases</strong><br />
                  If multiple independent tools and viewers all fail, the data is almost certainly gone. Commercial "advanced recovery" services rarely do better than good free tools on truly destroyed files — be skeptical of guarantees, especially paid ones.
                </p>
              </div>
            </section>

            <section id="comparison" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. How does this compare to repairing in Adobe Acrobat?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Adobe Acrobat is excellent software, but "repair" works differently there than most people expect.
                </p>
                <p>
                  <strong>Acrobat Has No Repair Button</strong><br />
                  Acrobat quietly attempts to rebuild mildly damaged files when opening them, and if it succeeds it prompts you to save the fixed version. That works well for light corruption, but there is no explicit repair feature to invoke when a file fails to open — if Acrobat cannot open it, Acrobat cannot fix it. Full editing features also require a paid Acrobat Pro subscription.
                </p>
                <p>
                  <strong>What BlendPDF Does Differently</strong><br />
                  BlendPDF gives you a deliberate repair step with two escalating strategies, including a page-by-page salvage mode that recovers partial content from files no viewer will open. It is free, requires no installation or account, and works from any browser on any operating system.
                </p>
                <p>
                  <strong>Honest Bottom Line</strong><br />
                  For a file with light structural damage, Acrobat's silent rebuild and BlendPDF's repair will both likely succeed. For files that refuse to open anywhere, BlendPDF's salvage pass gives you a recovery attempt Acrobat does not offer. And for files with genuinely destroyed data, neither will succeed — nor will anything else. Trying BlendPDF first costs nothing and takes under a minute.
                </p>
              </div>
            </section>

            <section id="troubleshooting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What should I do if I get an error while repairing?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Errors during repair usually fall into a few categories, each with a clear next step.
                </p>
                <p>
                  <strong>"File must be a PDF"</strong><br />
                  The upload is not being recognized as a PDF. Check the file's real format: open it in a text editor and look at the first characters — a real PDF starts with "%PDF-". If you see HTML, XML, or readable prose, the file is a mislabeled web page or document, and the fix is to get the actual PDF from the source.
                </p>
                <p>
                  <strong>File Too Large</strong><br />
                  The limit is 50MB per file. Since corrupted files often cannot be pre-processed by other tools, the practical fix for oversized damaged files is recovering an earlier copy rather than repairing this one.
                </p>
                <p>
                  <strong>"Too Many Requests"</strong><br />
                  Repair is limited to 20 files per 15 minutes per user. Wait a few minutes and try again.
                </p>
                <p>
                  <strong>Repair Failed Outright</strong><br />
                  If both recovery methods fail, the tool tells you rather than returning a broken file. At that point, work through the recovery checklist in question 13: re-download, check version history and backups, and try tolerant viewers. Trying the repair again with the same file will produce the same result — the tool is deterministic, so a second attempt only helps if you upload a different (fresher) copy of the file.
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
