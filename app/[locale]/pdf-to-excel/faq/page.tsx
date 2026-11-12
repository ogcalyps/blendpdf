'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';
import { Link } from '@/i18n/routing';

export default function PDFToExcelFAQ() {
  // FAQ data for structured data
  const faqs = [
    {
      question: 'How to convert PDF to Excel online',
      answer: 'Upload your PDF by clicking "Choose file" or dragging it onto the upload area, click "Convert to Excel", and download the resulting XLSX file. The tool scans every page for tables, extracts the data, and builds a spreadsheet. No account or email is required.'
    },
    {
      question: 'How does the table extraction work?',
      answer: 'BlendPDF analyzes the text layer of your PDF to detect table structures on every page, then rebuilds the rows and columns as real spreadsheet cells. It extracts data and structure, not visual styling, so you get an editable spreadsheet rather than a picture of a table.'
    },
    {
      question: 'Is the PDF to Excel converter free?',
      answer: 'Yes. No watermark, no row or page limits designed to upsell you, no sign-up, and no subscription. The practical limits are technical: 50MB per file and about 20 conversions per 15 minutes.'
    },
    {
      question: 'Is it safe to upload financial documents?',
      answer: 'Files are uploaded over an encrypted connection, document contents are never read, stored, or shared, and files are deleted from our servers within one hour, most immediately after processing. No account is needed. We only measure usage as anonymous totals, through Google Analytics and our own count of tool runs, never your documents.'
    },
    {
      question: 'What happens if my PDF has multiple tables?',
      answer: 'Each detected table is saved to its own sheet in the Excel file, named Table_1, Table_2, and so on, in the order they appear in the PDF. A PDF with a single table produces a single-sheet workbook.'
    },
    {
      question: 'Why do I get a "No tables found" error?',
      answer: 'The tool needs an actual table structure in the PDF\'s text layer. You will see this error if the PDF is a scan (no OCR support yet), if the data is laid out as plain text rather than a table, or if the file contains only images of tables.'
    },
    {
      question: 'Can I convert a scanned PDF to Excel?',
      answer: 'No. BlendPDF does not have OCR yet, so tables that exist only as scanned images cannot be extracted. Run the PDF through an OCR tool first to add a text layer, then convert it here, or use software with built-in OCR for scans.'
    },
    {
      question: 'Will formatting, colors, and formulas be preserved?',
      answer: 'No, and no converter can preserve formulas, because PDFs only store the calculated values, never the formulas behind them. You get the data and table structure. Cell colors, borders, and fonts are not carried over; add formatting and formulas in Excel afterward.'
    },
    {
      question: 'How accurate is the extraction?',
      answer: 'Clean, grid-like tables extract very reliably. Tables with merged cells, multi-line headers, nested sub-tables, or values that span columns can come out misaligned and need a few minutes of cleanup. Always spot-check totals against the original PDF.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'One PDF at a time, up to 50MB, with all pages scanned for tables. Processing is capped at about two minutes, so extremely long documents may time out; split them first and convert in parts.'
    },
    {
      question: 'Can I convert password-protected PDFs?',
      answer: 'Not directly. If you have the password and the right to use the document, remove the protection with the BlendPDF unlock tool first, then convert the unlocked file.'
    },
    {
      question: 'Does it work with Arabic or RTL tables?',
      answer: 'Partially, and we would rather be honest about it: right-to-left text is a hard case for table extraction. Arabic column order and text may need manual correction in Excel after conversion. Numeric data usually survives better than the text labels around it.'
    },
    {
      question: 'Is this better than copying and pasting from the PDF?',
      answer: 'For anything bigger than a few cells, yes. Copy-paste from a PDF typically collapses a table into one column or one long line, losing the structure. The converter preserves rows and columns and handles all pages at once.'
    },
    {
      question: 'What should I check after converting?',
      answer: 'Three quick checks: that numbers imported as numbers rather than text (look for left-aligned numerals), that no header rows slipped into the data, and that each expected table has its own sheet. Excel\'s "Convert to Number" and "Text to Columns" fix most import quirks in seconds.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'PDF to Excel', url: '/pdf-to-excel' },
        { name: 'FAQ', url: '/pdf-to-excel/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <Link href="/pdf-to-excel" className="mb-6 inline-block text-blue-600 hover:text-blue-800">
            &larr; Back to the PDF to Excel converter
          </Link>
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: PDF to Excel
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-convert" className="text-blue-600 hover:text-blue-800">How to convert PDF to Excel online</a></li>
              <li><a href="#how-it-works" className="text-blue-600 hover:text-blue-800">How does the table extraction work?</a></li>
              <li><a href="#is-it-free" className="text-blue-600 hover:text-blue-800">Is the PDF to Excel converter free?</a></li>
              <li><a href="#is-it-safe" className="text-blue-600 hover:text-blue-800">Is it safe to upload financial documents?</a></li>
              <li><a href="#multiple-tables" className="text-blue-600 hover:text-blue-800">What happens if my PDF has multiple tables?</a></li>
              <li><a href="#no-tables-found" className="text-blue-600 hover:text-blue-800">Why do I get a "No tables found" error?</a></li>
              <li><a href="#scanned-pdfs" className="text-blue-600 hover:text-blue-800">Can I convert a scanned PDF to Excel?</a></li>
              <li><a href="#formatting-formulas" className="text-blue-600 hover:text-blue-800">Will formatting, colors, and formulas be preserved?</a></li>
              <li><a href="#accuracy" className="text-blue-600 hover:text-blue-800">How accurate is the extraction?</a></li>
              <li><a href="#file-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I convert password-protected PDFs?</a></li>
              <li><a href="#arabic-rtl" className="text-blue-600 hover:text-blue-800">Does it work with Arabic or RTL tables?</a></li>
              <li><a href="#vs-copy-paste" className="text-blue-600 hover:text-blue-800">Is this better than copying and pasting from the PDF?</a></li>
              <li><a href="#after-converting" className="text-blue-600 hover:text-blue-800">What should I check after converting?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-convert" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to convert PDF to Excel online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Getting a PDF table into a spreadsheet takes three steps.
                </p>
                <p>
                  <strong>Upload your PDF</strong><br />
                  Click "Choose file" or drag and drop the PDF onto the upload area; you can also pick a file from Google Drive. One file at a time, up to 50MB. A thumbnail preview confirms you selected the right document.
                </p>
                <p>
                  <strong>Convert</strong><br />
                  Click "Convert to Excel". The tool scans every page of the PDF for table structures, extracts the rows and columns, and writes them into a spreadsheet. Most documents finish in seconds; long documents with many tables can take up to a couple of minutes.
                </p>
                <p>
                  <strong>Download the XLSX</strong><br />
                  Download the resulting Excel file directly, no email or account required (an optional email-delivery choice exists if you want the file sent to an inbox instead). The file opens in Microsoft Excel, Google Sheets, LibreOffice Calc, and Numbers.
                </p>
              </div>
            </section>

            <section id="how-it-works" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. How does the table extraction work?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  It helps to understand what the tool actually does, because that explains both its strengths and its limits.
                </p>
                <p>
                  <strong>Detection, then reconstruction</strong><br />
                  A PDF does not contain a "table" object the way Excel does; it contains text placed at coordinates, sometimes with ruled lines. The extraction engine analyzes those positions and lines to infer where the table grid is, which text belongs to which cell, and where rows and columns begin and end. It then rebuilds that structure as real spreadsheet cells.
                </p>
                <p>
                  <strong>Data and structure, not decoration</strong><br />
                  The output contains your values organized into the right rows and columns. It deliberately does not attempt to replicate visual styling like fill colors or fonts, which rarely survives inference accurately anyway. The goal is a spreadsheet you can immediately sort, filter, and calculate with.
                </p>
                <p>
                  <strong>Every page is scanned</strong><br />
                  You do not need to tell the tool where your tables are. It processes all pages and extracts every table it finds, in document order.
                </p>
              </div>
            </section>

            <section id="is-it-free" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Is the PDF to Excel converter free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, genuinely. No watermark in the spreadsheet, no cap on rows or tables, no "first three pages free" trick, and no account or credit card at any point.
                </p>
                <p>
                  <strong>The real limits</strong><br />
                  50MB per file, one file per conversion, roughly 20 conversions per 15 minutes per user, and a processing window of about two minutes. These exist to keep the service responsive for everyone, not to sell you an upgrade, because there is no upgrade to sell.
                </p>
              </div>
            </section>

            <section id="is-it-safe" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Is it safe to upload financial documents?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  PDF-to-Excel conversions often involve bank statements, invoices, and reports, so this question deserves a precise answer rather than a vague reassurance.
                </p>
                <p>
                  <strong>How your file is handled</strong><br />
                  The upload travels over an encrypted HTTPS connection. Extraction runs automatically on the server; no person views your document, and document contents are never read for any purpose other than the conversion itself, never stored long-term, and never shared. Temporary files are removed immediately after processing, and everything is deleted from our servers within one hour.
                </p>
                <p>
                  <strong>What we measure</strong><br />
                  We use Google Analytics for aggregate, anonymous usage statistics, such as how many conversions ran and whether they succeeded. That measurement never touches document contents. No account is needed, and downloading never requires an email address.
                </p>
                <p>
                  <strong>Your own policies still apply</strong><br />
                  If your organization prohibits uploading certain documents to any third-party service, that policy applies to BlendPDF like any other online tool. For those cases, use an offline converter.
                </p>
              </div>
            </section>

            <section id="multiple-tables" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. What happens if my PDF has multiple tables?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Each table gets its own sheet in the workbook.
                </p>
                <p>
                  <strong>Sheet naming and order</strong><br />
                  Sheets are named Table_1, Table_2, Table_3, and so on, in the order the tables appear in the PDF. A twelve-page report with a table on every page produces a twelve-sheet workbook. If the PDF contains exactly one table, you get a simple single-sheet file.
                </p>
                <p>
                  <strong>One thing to watch</strong><br />
                  A single logical table that continues across several pages is usually detected as one table per page, so it may arrive as several sheets that you then stack together. Copying the sheets one under another in Excel takes a moment; just delete the repeated header rows.
                </p>
              </div>
            </section>

            <section id="no-tables-found" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Why do I get a "No tables found" error?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  This error means the engine scanned every page and could not identify a table structure in the PDF's text layer. There are three common causes.
                </p>
                <p>
                  <strong>The PDF is a scan</strong><br />
                  If the document came from a scanner or a photo, the "table" is just pixels. BlendPDF has no OCR yet, so there is no text for the extractor to work with. Try selecting text in a PDF viewer; if you cannot, this is your cause. See the scanned PDF question below for workarounds.
                </p>
                <p>
                  <strong>The data is not structured as a table</strong><br />
                  Lists formatted with spaces or tabs, aligned by eye rather than laid out as a grid, often do not register as tables. In that case, the pragmatic route is our PDF to Word tool, then copy from Word into Excel and use "Text to Columns."
                </p>
                <p>
                  <strong>The table is an embedded image</strong><br />
                  Some reports paste charts and tables in as pictures even though the rest of the document is real text. Those are invisible to the extractor for the same no-OCR reason.
                </p>
              </div>
            </section>

            <section id="scanned-pdfs" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Can I convert a scanned PDF to Excel?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No, not today. BlendPDF does not include OCR, and table extraction needs actual text in the file. We would rather tell you that upfront than let the conversion fail mysteriously.
                </p>
                <p>
                  <strong>Workarounds that actually work</strong><br />
                  First OCR the document, then bring it here. Options include Adobe Acrobat's OCR, free tools built on the Tesseract engine, or opening the PDF with Google Docs in Google Drive, which attempts text recognition automatically. Be aware that OCR on tables is error-prone; digits like 0/8 and 1/7 are classic misreads, so verify totals afterward.
                </p>
                <p>
                  <strong>For small tables</strong><br />
                  If it is one table on one page, typing the numbers directly into Excel while viewing the PDF is often faster and more reliable than any OCR pipeline.
                </p>
              </div>
            </section>

            <section id="formatting-formulas" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. Will formatting, colors, and formulas be preserved?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No, and it is worth understanding why, so your expectations match what any converter can deliver.
                </p>
                <p>
                  <strong>Formulas are gone before we ever see the file</strong><br />
                  When a spreadsheet is exported to PDF, only the calculated values are printed. The formulas never make it into the PDF, so no tool on earth can recover them from one. If you need the formulas, you need the original spreadsheet file, not the PDF.
                </p>
                <p>
                  <strong>Styling is not reconstructed</strong><br />
                  Cell colors, borders, and fonts are visual decoration that does not survive extraction reliably, so the output is plain data in the correct rows and columns. Reapplying a header style and number formats in Excel takes less time than fixing badly guessed styling would.
                </p>
                <p>
                  <strong>What you do get</strong><br />
                  The part that matters: your values, in the right cells, ready for sorting, filtering, pivot tables, and new formulas.
                </p>
              </div>
            </section>

            <section id="accuracy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. How accurate is the extraction?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  It depends almost entirely on how the table is built in the PDF, so here is a calibrated guide.
                </p>
                <p>
                  <strong>Reliable cases</strong><br />
                  Clean grids with ruled lines, one value per cell, and a single header row, which describes most bank statements, invoices, and system-generated reports, extract with very high accuracy across all pages.
                </p>
                <p>
                  <strong>Cases that need cleanup</strong><br />
                  Merged cells, headers spanning multiple rows, cells containing several lines of text, side-by-side tables on one page, and tables without ruled lines can confuse the grid inference. Typical symptoms are values shifted one column over, or a header split across two rows. The data is present; it just needs realigning.
                </p>
                <p>
                  <strong>Always verify</strong><br />
                  Whatever tool you use for table extraction, spot-check a few rows and any totals against the original before relying on the numbers. Thirty seconds of checking beats an error in a report.
                </p>
              </div>
            </section>

            <section id="file-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  One PDF per conversion, up to 50MB, with every page scanned for tables.
                </p>
                <p>
                  <strong>Time limits</strong><br />
                  Processing is capped at roughly two minutes. Documents with hundreds of pages of dense tables can exceed that; if a conversion times out, split the PDF with the BlendPDF split tool and convert it in sections. There is also a rate limit of about 20 conversions per 15 minutes per user.
                </p>
                <p>
                  <strong>Oversized files</strong><br />
                  If your PDF is over 50MB, compress it first with the BlendPDF compress tool. Compression keeps text selectable, which is exactly what table extraction needs, and if the file cannot be shrunk you get the original back unchanged.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I convert password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Not directly; an encrypted PDF cannot be read by the extractor.
                </p>
                <p>
                  <strong>The two-step route</strong><br />
                  If you have the password and the right to use the document, remove the protection with the BlendPDF unlock tool, then convert the unlocked copy here. The unlock tool requires the correct password; it does not bypass or crack encryption.
                </p>
              </div>
            </section>

            <section id="arabic-rtl" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Does it work with Arabic or RTL tables?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Partially. Arabic and RTL support is a priority for BlendPDF as a whole, and we would rather describe this tool's real behavior than overpromise.
                </p>
                <p>
                  <strong>What to expect</strong><br />
                  Table extraction from RTL documents is genuinely hard: column order may come out mirrored, and Arabic text can arrive with reversed character order depending on how the PDF encoded it. Numbers usually survive better than the Arabic labels around them. Expect usable data that needs manual correction, not a clean one-click result.
                </p>
                <p>
                  <strong>Tips</strong><br />
                  In Excel, switch the sheet direction to right-to-left (Page Layout options) before fixing column order; it often makes the mirrored layout readable immediately. For scanned Arabic tables, remember there is no OCR yet, and third-party Arabic OCR quality varies widely.
                </p>
              </div>
            </section>

            <section id="vs-copy-paste" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Is this better than copying and pasting from the PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  For anything larger than a handful of cells, yes, and here is the honest comparison.
                </p>
                <p>
                  <strong>Why copy-paste usually fails</strong><br />
                  Selecting a table in a PDF viewer and pasting into Excel typically dumps everything into a single column, one long line, or a jumble where row boundaries are lost, because the clipboard receives plain text without the grid. You then spend longer untangling it than the conversion would have taken.
                </p>
                <p>
                  <strong>When copy-paste is fine</strong><br />
                  A few cells from one small table, into an existing sheet: paste and fix by hand, done. No tool needed.
                </p>
                <p>
                  <strong>Versus paid tools</strong><br />
                  Adobe Acrobat Pro exports PDF tables well and adds OCR for scans, but it is a paid subscription. Excel's own "Get Data from PDF" feature (available in Microsoft 365 on Windows) is also genuinely good if you have it. BlendPDF's advantage is that it is free, browser-based, works on any platform, and requires no sign-up.
                </p>
              </div>
            </section>

            <section id="after-converting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What should I check after converting?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Three quick checks catch nearly all import quirks before they cause problems.
                </p>
                <p>
                  <strong>Numbers stored as text</strong><br />
                  Values with currency symbols, thousands separators, or parentheses sometimes import as text; Excel usually flags them, or you can spot them because they align left. Select the range and use Excel's "Convert to Number," or strip the symbols with Find and Replace, so sums and pivot tables work.
                </p>
                <p>
                  <strong>Header and structure drift</strong><br />
                  Confirm the header row is where you expect it, that no header text landed in the data rows, and that multi-page tables that arrived as separate sheets have been stacked back together without duplicate headers.
                </p>
                <p>
                  <strong>Verify against the source</strong><br />
                  Compare a few rows and any totals with the original PDF. If a column looks systematically shifted, "Text to Columns" or a quick cut-and-paste realigns it. Once these checks pass, the spreadsheet is safe to build on.
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
