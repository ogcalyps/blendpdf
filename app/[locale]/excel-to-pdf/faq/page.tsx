'use client';

import { Navigation } from '@/components/Navigation';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function ExcelToPDFFAQ() {
  const faqs = [
    {
      question: 'How to convert Excel to PDF online',
      answer: 'Upload your spreadsheet (.xls, .xlsx, .ods, or .csv) by dragging it onto the upload area or clicking "Select File", then click the convert button. The conversion runs on our servers and your PDF downloads in seconds.'
    },
    {
      question: 'What spreadsheet formats are supported?',
      answer: 'BlendPDF supports Microsoft Excel files (.xls and .xlsx), OpenDocument Spreadsheet files (.ods), and plain CSV files. All sheets in your workbook are included in the PDF.'
    },
    {
      question: 'How are wide spreadsheets handled?',
      answer: 'The PDF follows your sheet\'s page setup, the same as printing from Excel. Sheets wider than a page are split across multiple PDF pages. For a tighter fit, set the print area or scaling in your spreadsheet before converting.'
    },
    {
      question: 'What happens to formulas?',
      answer: 'The PDF shows each cell\'s calculated value, not the formula behind it. Recipients see the numbers, and your formula logic stays private inside the original spreadsheet.'
    },
    {
      question: 'Are all sheets in my workbook included?',
      answer: 'Yes, all sheets in the workbook are included in the PDF. If you only want certain sheets, delete or hide the others in a copy of the file before converting, or split the resulting PDF afterwards.'
    },
    {
      question: 'Is cell formatting preserved?',
      answer: 'Yes, cell formatting carries over: colors, borders, fonts, number formats, and charts are rendered into the PDF, producing a clean, printable snapshot of your spreadsheet.'
    },
    {
      question: 'Can I convert CSV files to PDF?',
      answer: 'Yes. CSV files are opened as a spreadsheet on the server and exported to PDF the same way as Excel files. Since CSV carries no formatting, the PDF shows a plain table of the data.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'You can convert spreadsheets up to 50MB in size. There is no limit on the number of sheets or rows, though larger files take longer to process.'
    },
    {
      question: 'How long does conversion take?',
      answer: 'Most spreadsheets convert in a few seconds. Very large workbooks with many sheets or thousands of rows take longer, and total time also depends on your upload speed since conversion happens on our servers.'
    },
    {
      question: 'Can I upload spreadsheets from Google Drive?',
      answer: 'Yes, the upload area includes a Google Drive picker so you can select an Excel file stored in your Drive without downloading it to your device first.'
    },
    {
      question: 'Is my original spreadsheet modified?',
      answer: 'No, your original file is never modified. BlendPDF creates a new PDF while your spreadsheet stays untouched on your device, with all formulas and data intact.'
    },
    {
      question: 'Can I convert Excel to PDF on mobile devices?',
      answer: 'Yes, BlendPDF works on smartphones and tablets. Because the conversion runs on our servers, even large workbooks convert reliably from a phone — only upload and download speed depend on your connection.'
    },
    {
      question: 'Is converting Excel to PDF free?',
      answer: 'Yes, completely free — no sign-up, no credit card, no watermarks, and no premium tiers today. Convert as many spreadsheets as you need.'
    },
    {
      question: 'What happens to my files after conversion?',
      answer: 'All uploaded files are automatically deleted from our servers within one hour, most immediately after processing. We never read, store, or share the contents of your spreadsheets. No permanent storage is maintained.'
    },
    {
      question: 'What if the conversion fails or produces errors?',
      answer: 'Common causes are files over 50MB, corrupted workbooks, or unsupported formats. Verify the file opens correctly in Excel or LibreOffice, check your connection, and retry. Error messages indicate the specific problem.'
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Excel to PDF', url: '/excel-to-pdf' },
        { name: 'FAQ', url: '/excel-to-pdf/faq' },
      ]} />
      <Navigation />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Excel to PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-convert" className="text-blue-600 hover:text-blue-800">How to convert Excel to PDF online</a></li>
              <li><a href="#supported-formats" className="text-blue-600 hover:text-blue-800">What spreadsheet formats are supported?</a></li>
              <li><a href="#wide-sheets" className="text-blue-600 hover:text-blue-800">How are wide spreadsheets handled?</a></li>
              <li><a href="#formulas" className="text-blue-600 hover:text-blue-800">What happens to formulas?</a></li>
              <li><a href="#multiple-sheets" className="text-blue-600 hover:text-blue-800">Are all sheets in my workbook included?</a></li>
              <li><a href="#formatting" className="text-blue-600 hover:text-blue-800">Is cell formatting preserved?</a></li>
              <li><a href="#csv-files" className="text-blue-600 hover:text-blue-800">Can I convert CSV files to PDF?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#processing-time" className="text-blue-600 hover:text-blue-800">How long does conversion take?</a></li>
              <li><a href="#google-drive" className="text-blue-600 hover:text-blue-800">Can I upload spreadsheets from Google Drive?</a></li>
              <li><a href="#original-file" className="text-blue-600 hover:text-blue-800">Is my original spreadsheet modified?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I convert Excel to PDF on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is converting Excel to PDF free?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">What happens to my files after conversion?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if the conversion fails or produces errors?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-convert" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to convert Excel to PDF online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Turning a spreadsheet into a shareable PDF with BlendPDF takes three steps and works from any browser — no Excel installation, no account, no configuration. Here's the full workflow:
                </p>
                <p>
                  <strong>Upload Your Spreadsheet</strong><br />
                  Click "Select File" or drag and drop your spreadsheet onto the upload area. BlendPDF accepts Excel files (.xls and .xlsx), OpenDocument Spreadsheets (.ods), and CSV files up to 50MB. If the file lives in Google Drive, use the built-in Drive picker to select it directly. Your file is validated the moment you choose it, so format and size problems surface immediately with a clear message instead of a failed conversion later.
                </p>
                <p>
                  <strong>Convert on Our Servers</strong><br />
                  Click the convert button and your workbook is uploaded to BlendPDF's servers, where a full spreadsheet engine opens it and exports it to PDF — the same rendering path as printing from a desktop spreadsheet application. Cell values, formatting, charts, and each sheet's page setup are all respected. Because the work happens server-side, conversion is equally fast whether you're on a workstation or a phone.
                </p>
                <p>
                  <strong>Download Your PDF</strong><br />
                  Within seconds your PDF is ready to download directly, or you can optionally have it sent to your email address. The output keeps your original filename with a .pdf extension — "budget-2026.xlsx" becomes "budget-2026.pdf". The PDF is a fixed snapshot: recipients see exactly the numbers and layout you exported, they can't accidentally edit a cell or break a formula, and it prints identically everywhere.
                </p>
              </div>
            </section>

            <section id="supported-formats" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. What spreadsheet formats are supported?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF accepts the four most common spreadsheet formats: modern Excel (.xlsx), legacy Excel (.xls), OpenDocument Spreadsheet (.ods), and plain CSV. All sheets in a workbook are included in the conversion.
                </p>
                <p>
                  <strong>Modern Excel (.xlsx)</strong><br />
                  The .xlsx format has been Excel's default since 2007 and offers the most faithful conversion — formatting, charts, and multi-sheet workbooks all come through cleanly. BlendPDF verifies the internal structure of every .xlsx upload before converting, so a renamed or corrupted file is caught with a clear error rather than producing a broken PDF.
                </p>
                <p>
                  <strong>Legacy Excel (.xls)</strong><br />
                  The binary .xls format used by Excel 97 through 2003 is fully supported. Old financial archives, exported reports from legacy systems, and decades-old records in .xls format convert directly — no need to open and re-save them in a modern Excel first. Like .xlsx, the file's actual content is verified against its extension before conversion begins.
                </p>
                <p>
                  <strong>OpenDocument Spreadsheet (.ods)</strong><br />
                  The .ods format is the open standard used by LibreOffice Calc and other free office suites. If your organization works with open-source tools, your spreadsheets convert to PDF directly without an intermediate save-as-Excel step.
                </p>
                <p>
                  <strong>CSV Files</strong><br />
                  Plain comma-separated values files are accepted too — a convenient way to turn a raw data export from a database, web app, or script into a readable, printable document. Since CSV is a data-only format with no styling, the resulting PDF is a clean, plain table; see the dedicated CSV section below for details.
                </p>
              </div>
            </section>

            <section id="wide-sheets" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. How are wide spreadsheets handled?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Spreadsheets grow sideways in a way documents don't, so this is the most important question for Excel-to-PDF conversion. The short answer: the PDF follows your sheet's page setup, exactly the same as printing from Excel, and sheets wider than a page are split across multiple PDF pages.
                </p>
                <p>
                  <strong>Print Behavior, Not Screen Behavior</strong><br />
                  A PDF page has fixed dimensions, so a 40-column sheet can't simply stretch the way it does on screen. The conversion engine paginates your sheet using its stored print settings — page size, orientation, margins, scaling, and print area — just as Excel or LibreOffice Calc would when printing. Columns that don't fit the page width continue on subsequent pages. This is standard, expected behavior for any spreadsheet-to-PDF conversion, including Excel's own "Save as PDF".
                </p>
                <p>
                  <strong>Control the Output From Inside Your Spreadsheet</strong><br />
                  Because the conversion honors your sheet's page setup, you control the PDF layout before uploading. The three most effective tools, all under Excel's Page Layout tab: switch Orientation to Landscape for wide tables; use "Fit Sheet on One Page" or "Fit All Columns on One Page" under scaling to shrink content to the page width; and set a Print Area to export only the range that matters instead of every populated cell. Excel's Print Preview shows you almost exactly what the PDF will look like.
                </p>
                <p>
                  <strong>A Practical Recipe for Wide Tables</strong><br />
                  For a typical wide report: select the data range and set it as the Print Area, switch to Landscape, choose "Fit All Columns on One Page", and check Print Preview. Save, then upload to BlendPDF. This produces a PDF where each page shows every column, and rows flow down across pages — by far the most readable layout for wide data. If the font becomes too small when fitting many columns, consider splitting the sheet into two logical column groups instead.
                </p>
              </div>
            </section>

            <section id="formulas" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. What happens to formulas?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The PDF shows each cell's calculated value, not the formula behind it. A cell containing =SUM(B2:B48) appears in the PDF as the number it evaluates to, formatted exactly as it is in your spreadsheet.
                </p>
                <p>
                  <strong>Values, Not Logic</strong><br />
                  PDF is a presentation format with no concept of computation, so formulas can't survive conversion in any spreadsheet-to-PDF tool — what gets rendered is the result. Number formats are honored in full: currency symbols, thousands separators, percentages, decimal places, dates, and custom formats all appear in the PDF as they do on screen. What you see in Excel's cells is what the PDF shows.
                </p>
                <p>
                  <strong>This Protects Your Intellectual Property</strong><br />
                  Converting to PDF is one of the cleanest ways to share results without sharing your workings. Pricing models, financial projections, and scoring formulas often embody significant know-how; sending the .xlsx exposes every formula, named range, and hidden helper column to anyone who opens it. The PDF exposes only the rendered output. For quotes, invoices, and reports built on top of a calculation model, this is usually exactly the sharing behavior you want.
                </p>
                <p>
                  <strong>Make Sure Values Are Current Before Converting</strong><br />
                  The conversion renders the workbook's calculated state. In normal use this is a non-issue since Excel recalculates automatically, but if you use manual calculation mode, press F9 and save before uploading so the stored values are up to date. The same applies to formulas that depend on external links or refresh-on-open data connections — refresh, save, then convert, and the PDF will reflect the numbers you intend.
                </p>
              </div>
            </section>

            <section id="multiple-sheets" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Are all sheets in my workbook included?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. When you convert a multi-sheet workbook, all of its sheets are included in the PDF, one after another in workbook order. A workbook with Summary, Data, and Charts tabs produces a single PDF containing all three sections.
                </p>
                <p>
                  <strong>How Sheets Become Pages</strong><br />
                  Each sheet is paginated independently according to its own page setup — orientation, scaling, and print area are per-sheet settings in Excel, and the conversion respects each one. So your Summary sheet can be a portrait page while your wide Data sheet is landscape with fit-to-width scaling, all within the same PDF. The sheets appear in the same left-to-right order as their tabs in the workbook.
                </p>
                <p>
                  <strong>Converting Only Some Sheets</strong><br />
                  If you only want certain sheets in the PDF, the most reliable approach is to prepare a copy of the workbook with just those sheets — right-click a tab in Excel and use Move or Copy to build a trimmed copy, or simply delete the unwanted tabs from a duplicate file. Alternatively, convert the whole workbook and cut the result down with BlendPDF's Split PDF tool. Both approaches take under a minute.
                </p>
                <p>
                  <strong>Watch Out for Forgotten Tabs</strong><br />
                  Because every sheet is included, it's worth glancing at your tab bar before converting a workbook you intend to share. Scratch sheets, old drafts, and raw-data tabs you'd rather keep private will otherwise appear in the PDF. A quick review of the workbook — or building that trimmed copy — ensures the PDF contains exactly what you want recipients to see and nothing more.
                </p>
              </div>
            </section>

            <section id="formatting" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Is cell formatting preserved?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. The conversion renders your spreadsheet with its formatting intact, producing a PDF that looks like a professionally printed version of your sheet rather than a plain data dump.
                </p>
                <p>
                  <strong>Visual Formatting</strong><br />
                  Cell background colors, font choices, bold and italic text, font sizes, text colors, borders, gridline styling, merged cells, and cell alignment all carry over into the PDF. A color-coded status column stays color-coded; a bordered summary box stays boxed. Header rows, title bands, and the visual structure that makes a spreadsheet readable are preserved.
                </p>
                <p>
                  <strong>Number Formats</strong><br />
                  Number formatting is rendered exactly as configured: currency symbols and their placement, thousands separators, decimal precision, percentage displays, date and time formats, and custom format codes. This matters enormously for financial documents — $1,234.50 stays $1,234.50, not 1234.5. Negative-number styling such as parentheses or red text also comes through.
                </p>
                <p>
                  <strong>Charts and Graphics</strong><br />
                  Charts embedded in your sheets are rendered into the PDF as part of the page, keeping their colors, labels, and legends. The same applies to shapes and images placed on the sheet. Since the PDF is a static snapshot, charts are naturally no longer interactive — they're high-quality pictures of the chart in its state at conversion time.
                </p>
                <p>
                  <strong>Honest Caveats</strong><br />
                  As with any conversion between office formats, extremely elaborate styling can render with minor differences — uncommon fonts may be substituted with similar ones, and conditional-formatting visuals reflect the values at conversion time. For the overwhelming majority of business spreadsheets, the PDF is visually indistinguishable from the sheet's print preview. When exact appearance is critical, convert once and inspect — it costs seconds and nothing else.
                </p>
              </div>
            </section>

            <section id="csv-files" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. Can I convert CSV files to PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes — CSV is a first-class input format. The file is opened by the spreadsheet engine on the server and exported to PDF the same way an Excel file is, turning a raw data file into a readable, printable document in seconds.
                </p>
                <p>
                  <strong>Why This Is Useful</strong><br />
                  CSV is the universal export format of databases, web applications, banking portals, and scripts — but a raw CSV opened in a text editor is nearly unreadable, and not everyone you send it to knows what to do with one. Converting it to PDF produces a document anyone can open, read, and print: transaction exports become statements you can file, and data dumps become tables you can review on any device.
                </p>
                <p>
                  <strong>What the Output Looks Like</strong><br />
                  CSV carries pure data — no fonts, colors, column widths, or number formats — so the PDF is a clean, plain table: your rows and columns laid out in a default grid and paginated across pages as needed. Wide CSVs paginate horizontally just like wide sheets do. If the file is genuinely huge, expect a correspondingly long PDF.
                </p>
                <p>
                  <strong>When You Want a Styled Result</strong><br />
                  If you want headers bolded, columns sized, numbers formatted as currency, or a landscape layout, open the CSV in Excel or LibreOffice Calc first, apply the formatting and page setup you want, save as .xlsx, and convert that instead. The two-step route gives you full control over the PDF's appearance; the direct CSV route is the fast path when readable-and-printable is all you need.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF accepts spreadsheet files up to 50MB. There is no separate limit on sheets, rows, or columns — the ceiling is purely on the file's byte size.
                </p>
                <p>
                  <strong>What 50MB Means for Spreadsheets</strong><br />
                  Spreadsheets are compact: .xlsx is a compressed format, and pure data compresses extremely well. A workbook with tens of thousands of rows across multiple sheets typically weighs a few megabytes. Files approaching 50MB almost always contain something other than data — embedded images, huge numbers of charts, or years of accumulated formatting cruft. For everyday budgets, reports, exports, and models, the limit is effectively invisible.
                </p>
                <p>
                  <strong>If Your Workbook Is Too Large</strong><br />
                  First check for embedded images and objects, the usual culprits. Second, save a copy as .xlsx if the file is an old .xls — the modern compressed format is often dramatically smaller for the same content. Third, delete unused sheets and clear "ghost" formatting beyond your data range (select the empty rows/columns below and right of your data and delete them; Excel sometimes tracks vast empty ranges as used). If the data itself is genuinely enormous, split the workbook and convert in parts.
                </p>
                <p>
                  <strong>Output Size and Page Count</strong><br />
                  The PDF's file size is usually modest — text and numbers render compactly. Page count is the thing to watch with big data: thousands of rows produce a PDF with many pages, exactly as printing would. If you don't need every row in document form, set a Print Area around the summary that matters before converting; nobody actually reads page 300 of a raw data export.
                </p>
              </div>
            </section>

            <section id="processing-time" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. How long does conversion take?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Most spreadsheets convert in a few seconds. The conversion runs on BlendPDF's servers, so your own device's speed doesn't matter — the variables are workbook size and your connection.
                </p>
                <p>
                  <strong>Typical Times</strong><br />
                  An ordinary workbook — a handful of sheets, normal data volumes, some charts — is converted and downloading within seconds of clicking the button. Bigger inputs scale gracefully: workbooks with many sheets or tens of thousands of rows take longer to paginate, and files near the 50MB limit spend additional time in upload. Even heavyweight conversions complete well within the processing window the server allows.
                </p>
                <p>
                  <strong>What Drives the Duration</strong><br />
                  Three phases add up: uploading the file (your connection speed times file size), rendering (driven mostly by total page count the sheets produce — a thousand-page data dump takes longer than a two-page summary), and downloading the PDF. Since rendering is server-side, converting from a phone on good Wi-Fi is just as fast as from a desktop.
                </p>
                <p>
                  <strong>Fair-Use Limits</strong><br />
                  To keep the free service responsive, conversions are limited to 10 per 15-minute window per user. Converting a batch of monthly reports fits comfortably; if you do hit the limit, the tool tells you clearly and the window resets on its own within minutes. There are no daily caps or accounts to manage.
                </p>
              </div>
            </section>

            <section id="google-drive" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Can I upload spreadsheets from Google Drive?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. The upload area includes a Google Drive picker, so an Excel file stored in Drive can be selected there directly — no need to download it to your device and re-upload it.
                </p>
                <p>
                  <strong>How It Works</strong><br />
                  Click the Google Drive option under the main upload button, sign in to Google if prompted, and choose your spreadsheet from the standard Drive file dialog. The file then flows through the same validation and conversion pipeline as a local upload: same supported Excel formats via the picker, same 50MB limit, same speed. It's particularly handy on phones and Chromebooks, where files tend to live in the cloud rather than in local folders.
                </p>
                <p>
                  <strong>Permissions and Privacy</strong><br />
                  The picker is Google's own file-selection dialog, which means BlendPDF receives only the single file you explicitly select — it has no ability to browse or list the rest of your Drive. Once fetched, the file is treated like every other upload: processed automatically with no human access and deleted from our servers within an hour, most immediately after processing.
                </p>
                <p>
                  <strong>Native Google Sheets Files</strong><br />
                  The picker handles Excel files stored in Drive, not native Google Sheets documents. If your spreadsheet was created in Google Sheets, export it first from within Sheets via File &gt; Download &gt; Microsoft Excel (.xlsx), then upload the exported file. Sheets' own File &gt; Download &gt; PDF is also an option, though exporting to .xlsx and converting here keeps your workflow consistent when you're producing PDFs from mixed sources.
                </p>
              </div>
            </section>

            <section id="original-file" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Is my original spreadsheet modified?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No. The conversion is entirely non-destructive: BlendPDF produces a new PDF file, and your workbook — data, formulas, formatting, everything — remains exactly as it was.
                </p>
                <p>
                  <strong>How the Process Works</strong><br />
                  Uploading sends a copy of your file to our servers; the conversion works on that copy and nothing is ever written back to your device or cloud storage. The PDF arrives as a separate download: "forecast.xlsx" stays untouched while "forecast.pdf" lands in your downloads folder. There is no scenario in which converting damages, locks, or alters the source workbook.
                </p>
                <p>
                  <strong>Spreadsheet Stays Live, PDF Is the Snapshot</strong><br />
                  This split is exactly how spreadsheet workflows should work. The .xlsx remains your living model — formulas keep calculating, data keeps updating, and you keep editing. The PDF is a frozen record of what the numbers said at one moment: ideal for month-end reporting, quotes, invoices, and anything that needs to be preserved as-sent. When the numbers change, convert again and you have a fresh snapshot.
                </p>
                <p>
                  <strong>Convert as Often as You Like</strong><br />
                  Since the service is free and the original is never at risk, you can iterate freely: convert, check the pagination, tweak the print area or scaling in Excel, and convert again until the layout is exactly right. Many users also generate a PDF from the same workbook on a schedule — a weekly snapshot of a tracker, for instance — precisely because each conversion is independent and side-effect-free.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I convert Excel to PDF on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes. BlendPDF is a responsive web tool that works in the browser on iPhones, Android phones, and tablets — no app to install, no account to create.
                </p>
                <p>
                  <strong>Server-Side Conversion Suits Mobile Perfectly</strong><br />
                  Opening and paginating a large workbook is heavy work, and phone spreadsheet apps are limited — but with BlendPDF your phone only uploads the file and downloads the finished PDF. All rendering happens on our servers, so a thousand-row workbook converts just as reliably from a three-year-old phone as from a desktop. The only mobile-specific factor is connection speed for the upload and download.
                </p>
                <p>
                  <strong>Getting Files In and Out</strong><br />
                  Upload from your device's file storage, from an email attachment saved to Files (iOS) or Downloads (Android), or straight from Google Drive with the built-in picker — usually the most natural path on mobile, where spreadsheets tend to live in cloud storage. After conversion, download the PDF to your device or use the email delivery option to send it to your inbox and pick it up on your laptop later.
                </p>
                <p>
                  <strong>A Common Real-World Scenario</strong><br />
                  A client asks for the latest price list while you're away from your desk. The .xlsx is in your Drive; sending it raw would expose formulas and cost columns. From your phone: open BlendPDF, pick the file from Drive, convert, and forward the clean PDF showing exactly the sheet you'd print — done in under two minutes without touching a computer.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Is converting Excel to PDF free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, converting Excel to PDF with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today. Every capability described on this page is available to every user at no charge.
                </p>
                <p>
                  <strong>No Payment and No Upsell</strong><br />
                  There's no credit card field anywhere, no trial countdown, and no feature matrix where the useful column costs money. Multi-sheet workbooks, charts, CSV input, Google Drive upload, email delivery — all included. The only operational constraint is a fair-use rate limit of 10 conversions per 15 minutes, which exists to keep shared servers responsive, not to sell an upgrade.
                </p>
                <p>
                  <strong>Clean, Unbranded Output</strong><br />
                  Your PDF contains your spreadsheet and nothing else — no watermark stamped across your financial data, no advertising page appended to your invoice. That matters for business documents: a quote or statement carrying a converter's logo looks unprofessional, and with BlendPDF that simply doesn't happen.
                </p>
                <p>
                  <strong>No Account Needed</strong><br />
                  You can convert without registering, verifying an email, or signing in — visit the page, upload, download. After conversion you'll see an optional email-delivery step for receiving the file in your inbox, but direct download is always available and no personal information is required to use the tool. This makes it usable on shared or borrowed devices, too.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What happens to my files after conversion?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Spreadsheets are among the most sensitive files people handle — salaries, revenue, customer lists, account numbers. BlendPDF's data handling is built around that reality: your file exists on our servers only as long as the conversion needs it.
                </p>
                <p>
                  <strong>Automatic Deletion Within One Hour</strong><br />
                  Every uploaded file is automatically deleted from our servers within one hour of upload, and most are removed immediately after processing completes — success or failure alike. Deletion is enforced by the system, requires nothing from you, and is irreversible: there is no archive, trash folder, or backup from which an uploaded spreadsheet could be recovered.
                </p>
                <p>
                  <strong>No Permanent Storage</strong><br />
                  We keep no copies of your workbooks or of the PDFs generated from them. Uploads are not backed up, not archived, and not used for anything beyond producing the file you asked for. The temporary working files created during conversion are cleaned up as part of the conversion itself, so the total lifetime of your data on our infrastructure is typically seconds.
                </p>
                <p>
                  <strong>No Human Access</strong><br />
                  The pipeline is fully automated: no BlendPDF employee opens, views, or analyzes your spreadsheet's contents. Your workbook is data flowing through a conversion engine, not a document anyone reads. We don't extract cell values, formulas, or metadata for any purpose other than rendering your PDF.
                </p>
                <p>
                  <strong>Encrypted Transfer, Isolated Processing</strong><br />
                  Files move to and from our servers over encrypted HTTPS, and conversion happens in an isolated server environment with restricted access. Combined with immediate deletion, the practical exposure window for a converted spreadsheet is as narrow as the operation allows. For data governed by internal policy, note that processing is server-side — the honest description is: encrypted in transit, processed automatically, deleted within the hour.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if the conversion fails or produces errors?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  The vast majority of spreadsheets convert on the first attempt. When something goes wrong, the cause is usually identifiable from the error message, and the fixes are quick.
                </p>
                <p>
                  <strong>Validation Errors Before Conversion</strong><br />
                  An error at upload time means the file didn't pass validation: it exceeds 50MB, is empty, has an unsupported extension, or its content doesn't match its extension (a renamed file pretending to be .xlsx, for example). Confirm the file is a genuine .xls, .xlsx, .ods, or .csv and within the size limit. Re-saving from Excel or LibreOffice produces a fresh, well-formed file and clears most content-mismatch problems.
                </p>
                <p>
                  <strong>Failures During Conversion</strong><br />
                  If the upload succeeds but conversion fails, the workbook may be corrupted or contain an element the engine can't process. Check that the file opens cleanly in Excel or LibreOffice Calc; if it does, save a copy as .xlsx (the most robust format for conversion) and upload that. Password-protected workbooks can't be opened by the converter — remove the protection in Excel first, convert, and re-protect the PDF afterwards if needed.
                </p>
                <p>
                  <strong>Unexpected Layout Rather Than Errors</strong><br />
                  Sometimes the conversion succeeds but the PDF isn't laid out how you expected — columns spill onto extra pages, or an empty region adds blank pages. These aren't failures; they're page-setup issues. Set the print area, adjust orientation and scaling in your spreadsheet (see the wide-spreadsheets section above), and convert again. Excel's Print Preview is a reliable predictor of what the PDF will look like.
                </p>
                <p>
                  <strong>Rate Limits and Connectivity</strong><br />
                  Converting many files rapidly can hit the fair-use limit of 10 conversions per 15 minutes, which returns a clear "too many requests" message — just wait a few minutes. Failures during upload or download on an unstable connection also masquerade as conversion errors; retrying on a solid connection resolves them. If a specific file repeatedly fails while others succeed, copy its sheets into a new workbook and convert that — rebuilt files shed most forms of internal corruption.
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
