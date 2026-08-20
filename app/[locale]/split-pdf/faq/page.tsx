'use client';

import { Navigation } from '@/components/Navigation';
import { useTranslations } from 'next-intl';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function SplitPDFFAQ() {
  const t = useTranslations();
  
  const faqs = [
    {
      question: 'How to split PDF files online',
      answer: 'Upload your PDF file, use visual thumbnails to select the pages you want to extract, and click "Split PDF". The process takes 5-10 seconds and your new PDF with selected pages will download automatically.'
    },
    {
      question: 'How does visual page selection work?',
      answer: 'After uploading, you see thumbnail previews of all pages. Click on thumbnails to select pages - selected pages show a blue border and checkmark. You can select individual pages or use "Select All" for bulk selection.'
    },
    {
      question: 'Can I extract specific pages from a PDF?',
      answer: 'Yes, you can select any combination of pages. Click on individual page thumbnails to select them. Selected pages will appear in the new PDF in their original document order, maintaining the sequence from the source.'
    },
    {
      question: 'Can I select multiple page ranges?',
      answer: 'Yes, you can select pages from anywhere in the document, not just consecutive pages. For example, you can select pages 1-5, 10-15, and 20-25. The selected pages will appear in the new PDF in their original order.'
    },
    {
      question: 'Does splitting preserve PDF quality?',
      answer: 'Yes, splitting preserves all PDF quality including formatting, images, text, fonts, and interactive elements. The split PDF maintains the exact same quality as the original document.'
    },
    {
      question: 'Does splitting work with Arabic PDFs?',
      answer: 'Yes, BlendPDF works perfectly with Arabic PDFs and all RTL languages. Text direction, character order, and formatting are all preserved exactly as in the original document.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'You can upload PDF files up to 50MB in size. There\'s no limit on the number of pages you can split. Very large documents may take slightly longer to process.'
    },
    {
      question: 'How many pages can I split from a PDF?',
      answer: 'You can split any number of pages from a PDF. There\'s no limit on how many pages you can select for extraction. You can select individual pages or entire ranges.'
    },
    {
      question: 'How long does splitting take?',
      answer: 'Splitting typically takes 5-10 seconds, depending on the number of pages and file complexity. The process is fast and efficient, with your split PDF ready for download almost immediately.'
    },
    {
      question: 'Is my original file modified?',
      answer: 'No, your original file is never modified. BlendPDF creates a new PDF with selected pages while leaving your original file completely untouched on your device.'
    },
    {
      question: 'Can I split password-protected PDFs?',
      answer: 'Password-protected PDFs cannot be split directly. You\'ll need to unlock the PDF first using an unlock tool, then split it. Support for protected PDFs may be added in future updates.'
    },
    {
      question: 'Can I split PDFs on mobile devices?',
      answer: 'Yes, BlendPDF works seamlessly on smartphones and tablets. The visual page selection interface is touch-friendly and works perfectly on mobile devices.'
    },
    {
      question: 'Is splitting PDFs free?',
      answer: 'Yes, splitting PDFs with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today. All features are available at no charge.'
    },
    {
      question: 'What happens to my files after splitting?',
      answer: 'All uploaded files are automatically deleted from our servers within one hour, most immediately after processing. We never read, store, or share the contents of your documents. No permanent storage is maintained.'
    },
    {
      question: 'What if splitting fails or produces errors?',
      answer: 'Common issues include file size limits, corrupted PDFs, or network problems. Try refreshing and retrying. Verify your file opens correctly in a PDF viewer and check your internet connection.'
    },
  ];
  
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Split PDF', url: '/split-pdf' },
        { name: 'FAQ', url: '/split-pdf/faq' },
      ]} />
      <Navigation />
      
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Split PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-split" className="text-blue-600 hover:text-blue-800">How to split PDF files online</a></li>
              <li><a href="#visual-selection" className="text-blue-600 hover:text-blue-800">How does visual page selection work?</a></li>
              <li><a href="#extract-pages" className="text-blue-600 hover:text-blue-800">Can I extract specific pages from a PDF?</a></li>
              <li><a href="#multiple-ranges" className="text-blue-600 hover:text-blue-800">Can I select multiple page ranges?</a></li>
              <li><a href="#preserve-quality" className="text-blue-600 hover:text-blue-800">Does splitting preserve PDF quality?</a></li>
              <li><a href="#arabic-support" className="text-blue-600 hover:text-blue-800">Does splitting work with Arabic PDFs?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#page-count" className="text-blue-600 hover:text-blue-800">How many pages can I split from a PDF?</a></li>
              <li><a href="#processing-time" className="text-blue-600 hover:text-blue-800">How long does splitting take?</a></li>
              <li><a href="#original-file" className="text-blue-600 hover:text-blue-800">Is my original file modified?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I split password-protected PDFs?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I split PDFs on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is splitting PDFs free?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">What happens to my files after splitting?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if splitting fails or produces errors?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-split" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to split PDF files online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Splitting PDF files with BlendPDF is intuitive and visual, making it easy to extract exactly the pages you need. Here's a comprehensive guide to help you split PDFs efficiently:
                </p>
                <p>
                  <strong>Upload Your PDF</strong><br />
                  Start by clicking the "Select PDF" button or dragging and dropping your PDF file directly onto the upload area. BlendPDF accepts PDF files up to 50MB in size. Once uploaded, the system automatically analyzes your PDF and displays thumbnail previews of all pages, giving you a visual representation of your document. This visual approach makes it much easier to identify and select the pages you want to extract.
                </p>
                <p>
                  <strong>Select Pages Visually</strong><br />
                  After upload, you'll see a grid of page thumbnails showing all pages in your PDF. Simply click on the thumbnails of the pages you want to extract. Selected pages are highlighted with a blue border and checkmark, making it easy to see which pages you've chosen. You can select individual pages by clicking them, or use the "Select All" button to select all pages at once. The "Clear" button lets you start over if you change your mind. This visual selection method is much more intuitive than typing page numbers.
                </p>
                <p>
                  <strong>Split and Download</strong><br />
                  Once you've selected the pages you want, click the "Split PDF" button. The splitting process typically takes just 5-10 seconds, depending on the number of pages and file complexity. Once complete, your new PDF containing only the selected pages will automatically download to your device. The file contains all the pages you selected in their original order, with all formatting, images, and text preserved exactly as in the original document.
                </p>
                <p>
                  <strong>Privacy and Security</strong><br />
                  BlendPDF processes your files securely and automatically deletes them from our servers within one hour, most immediately after processing. We never read, store, or share the contents of your documents. No account creation or email is required.
                </p>
              </div>
            </section>

            <section id="visual-selection" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. How does visual page selection work?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF's visual page selection feature makes splitting PDFs intuitive and user-friendly. Instead of typing page numbers or ranges, you can see and click on the actual pages you want to extract.
                </p>
                <p>
                  <strong>Thumbnail Previews</strong><br />
                  When you upload a PDF, BlendPDF automatically generates thumbnail previews of every page in your document. These thumbnails show actual page content, not just page numbers, making it easy to identify the pages you need. You can see text, images, layouts, and formatting in the thumbnails, which helps you make accurate selections. The thumbnails are displayed in a responsive grid that adapts to your screen size, showing more thumbnails on larger screens and fewer on mobile devices.
                </p>
                <p>
                  <strong>Interactive Selection</strong><br />
                  Clicking on a thumbnail selects that page, and clicking again deselects it. Selected pages are clearly marked with a blue border and a checkmark icon, while unselected pages show a gray border. This visual feedback makes it immediately clear which pages are included in your selection. You can select pages in any order - the final PDF will contain them in their original document order, not the order you clicked them. This means you can click pages randomly and still get a properly ordered result.
                </p>
                <p>
                  <strong>Bulk Selection Tools</strong><br />
                  For convenience, BlendPDF provides bulk selection tools. The "Select All" button instantly selects every page in the document, which is useful when you want to extract all pages or when you want to select most pages and then deselect a few. The "Clear" button removes all selections, letting you start over quickly. These tools save time when working with large documents or when you need to make multiple selections.
                </p>
                <p>
                  <strong>Selection Counter</strong><br />
                  A selection counter shows how many pages you've selected out of the total, giving you immediate feedback on your selection. This helps you keep track of your choices, especially when working with large documents. The counter updates in real-time as you select or deselect pages, making it easy to see your progress and ensure you've selected the right number of pages.
                </p>
              </div>
            </section>

            <section id="extract-pages" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Can I extract specific pages from a PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, you can extract any specific pages from a PDF using BlendPDF's visual selection interface. This feature is perfect for creating new documents from selected pages of larger PDFs.
                </p>
                <p>
                  <strong>Selecting Individual Pages</strong><br />
                  You can select any combination of pages from your PDF. Want pages 1, 5, and 10? Just click on those thumbnails. Need pages 3-7 and 15-20? Click on each page in those ranges. There's no limit to how many individual pages you can select, and you can choose pages from anywhere in the document, not just consecutive pages. The selected pages will appear in your new PDF in their original document order, maintaining the sequence they had in the source document.
                </p>
                <p>
                  <strong>Use Cases</strong><br />
                  Extracting specific pages is useful for many scenarios. Students might extract specific chapters from a textbook. Professionals might extract relevant pages from a large report. Researchers might pull out specific sections from academic papers. Business users might extract particular pages from contracts or proposals. The visual interface makes it easy to identify and select exactly the pages you need, even in complex documents with hundreds of pages.
                </p>
                <p>
                  <strong>Page Order Preservation</strong><br />
                  When you select multiple non-consecutive pages, they appear in your extracted PDF in their original document order, not the order you clicked them. For example, if you click pages 10, 2, and 7, the resulting PDF will contain pages 2, 7, and 10 in that order. This ensures that extracted pages maintain their logical sequence, which is important for documents where page order matters.
                </p>
                <p>
                  <strong>Quality Preservation</strong><br />
                  Extracted pages maintain all the quality and formatting of the original document. Text remains crisp, images stay sharp, and all formatting elements like fonts, colors, and layouts are preserved. This means your extracted PDF looks exactly like those pages did in the original document, just in a new, smaller file containing only the pages you selected.
                </p>
              </div>
            </section>

            <section id="multiple-ranges" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Can I select multiple page ranges?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, you can select multiple page ranges and individual pages in a single operation. BlendPDF's visual selection interface makes it easy to select any combination of pages, whether they're consecutive, scattered, or in multiple ranges.
                </p>
                <p>
                  <strong>Selecting Multiple Ranges</strong><br />
                  You can select pages 1-5, then pages 10-15, then page 20, and pages 25-30 all in one operation. Simply click on all the pages you want, and they'll all be included in your extracted PDF. There's no need to split the document multiple times or merge separate extractions. The visual interface makes it easy to see which pages you've selected, even when selecting from different parts of a large document.
                </p>
                <p>
                  <strong>Flexible Selection</strong><br />
                  The selection system is completely flexible. You can select consecutive pages, non-consecutive pages, individual pages, multiple ranges, or any combination thereof. For example, you might want pages 1-3, page 7, pages 12-18, and page 25. Just click on each of those pages, and they'll all be included in your final extracted PDF. The system handles any selection pattern you need.
                </p>
                <p>
                  <strong>Visual Feedback</strong><br />
                  As you select pages from different ranges, the visual interface provides clear feedback. Selected pages are highlighted, and you can see your selection count update in real-time. This makes it easy to keep track of your selections, even when working with complex, multi-range selections across a large document. You can always deselect pages if you change your mind, making it easy to refine your selection.
                </p>
                <p>
                  <strong>Order in Result</strong><br />
                  When you select multiple ranges, the pages appear in your extracted PDF in their original document order, not grouped by range. For example, if you select pages 10-12 and pages 5-7, the resulting PDF will contain pages 5, 6, 7, 10, 11, 12 in that order. This maintains the logical flow of the document, which is important for readability and context.
                </p>
              </div>
            </section>

            <section id="preserve-quality" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Does splitting preserve PDF quality?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, splitting PDFs with BlendPDF preserves 100% of the original quality. There is no quality loss when splitting PDFs, as the process extracts pages exactly as they exist in the original document.
                </p>
                <p>
                  <strong>Perfect Quality Preservation</strong><br />
                  When you split a PDF, the selected pages are extracted exactly as they appear in the original document. Text remains perfectly crisp and clear, images maintain their original resolution and quality, and all formatting elements are preserved. There's no compression, downscaling, or quality reduction applied during the splitting process. The extracted pages are identical in quality to how they appeared in the source document.
                </p>
                <p>
                  <strong>All Elements Preserved</strong><br />
                  Every element of the original pages is preserved: fonts, font sizes, colors, text formatting, images, graphics, layouts, margins, headers, footers, and page dimensions. Interactive elements like hyperlinks, bookmarks, and form fields are also maintained. This means your extracted PDF functions exactly like the original pages did, with no loss of functionality or visual quality.
                </p>
                <p>
                  <strong>No Compression Applied</strong><br />
                  Unlike some PDF tools that compress files during splitting, BlendPDF extracts pages without applying any compression. This ensures that image quality, text clarity, and document fidelity remain perfect. If your original PDF had high-resolution images, the extracted PDF will have the same high-resolution images. If text was sharp in the original, it remains sharp in the extracted version.
                </p>
                <p>
                  <strong>File Size Considerations</strong><br />
                  The extracted PDF will be smaller than the original simply because it contains fewer pages, but the quality of those pages remains identical. If you extract 10 pages from a 100-page document, your new file will be approximately 10% of the original size, but each of those 10 pages will look exactly as they did in the original document. This makes splitting an ideal way to create smaller, focused documents without sacrificing quality.
                </p>
              </div>
            </section>

            <section id="arabic-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Does splitting work with Arabic PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, BlendPDF splitting works perfectly with Arabic PDFs and all other right-to-left (RTL) languages. This is one of our key differentiators, as many PDF splitting tools struggle with or break RTL language support.
                </p>
                <p>
                  <strong>Perfect RTL Support</strong><br />
                  Our splitting engine is specifically designed to handle RTL languages correctly. When you split an Arabic PDF, all text direction, character order, and formatting are preserved exactly as in the original. Arabic text reads correctly from right to left, numbers appear in the proper context, and mixed content (Arabic and English together) is displayed accurately. The splitting process understands the Unicode bidirectional algorithm and ensures that RTL text rendering remains perfect in extracted pages.
                </p>
                <p>
                  <strong>Text Quality Preservation</strong><br />
                  Arabic text is extracted with perfect quality preservation. All Arabic characters, diacritical marks, and special characters remain perfectly crisp and readable. Font rendering, text positioning, and character spacing are all maintained exactly as in the original document. This ensures that extracted Arabic pages are just as readable and professional-looking as the originals, with no text corruption or formatting issues.
                </p>
                <p>
                  <strong>Supported Languages</strong><br />
                  BlendPDF supports splitting for all RTL languages including Arabic (العربية), Hebrew (עברית), Persian/Farsi (فارسی), Urdu (اردو), and many others. We also support left-to-right languages like English, Spanish, French, German, Chinese, Japanese, and more. This multilingual capability makes BlendPDF an ideal choice for international users, businesses operating in multiple countries, and academic institutions with diverse language requirements.
                </p>
                <p>
                  <strong>Real-World Testing</strong><br />
                  We've extensively tested BlendPDF splitting with real-world Arabic documents including legal contracts, academic papers, business reports, and personal documents. Our testing ensures that complex layouts, tables, forms, and mixed-language content all split correctly while maintaining perfect readability. This commitment to quality means you can confidently use BlendPDF to split any Arabic PDF, knowing that the results will be accurate, readable, and professional.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF has generous file size limits designed to accommodate most real-world PDF splitting needs while ensuring fast processing times and reliable performance.
                </p>
                <p>
                  <strong>Upload Size Limit</strong><br />
                  You can upload PDF files up to 50MB in size for splitting. This limit applies to the original file size before splitting. The 50MB limit is sufficient for most documents including high-resolution scanned documents, detailed reports with embedded images, and complex multi-page documents. For reference, a typical 100-page text document is usually under 5MB, while a 50-page document with high-quality images might be 20-30MB. Most users find that 50MB is more than enough for their splitting needs.
                </p>
                <p>
                  <strong>Extracted File Size</strong><br />
                  There's no limit on the size of the extracted PDF file you can download. However, since you're selecting specific pages, the extracted file will typically be smaller than the original. If you extract 10 pages from a 100-page document, your new file will be approximately 10% of the original size. The extracted file size depends entirely on how many pages you select and the content of those pages.
                </p>
                <p>
                  <strong>Page Count Considerations</strong><br />
                  There's no hard limit on the number of pages in a PDF you can split, or on how many pages you can extract. However, very large documents (hundreds or thousands of pages) may take longer to process and generate thumbnails. Most users find that splitting documents with hundreds of pages completes in under 30 seconds. The processing time depends on factors like file complexity, image content, and the number of pages being extracted.
                </p>
                <p>
                  <strong>Optimization Tips</strong><br />
                  If you need to split files larger than 50MB, consider compressing them first using our PDF compression tool, then splitting the compressed version. Alternatively, you can split large documents into smaller sections first, then work with those sections. These strategies help you work within the limits while achieving optimal splitting results.
                </p>
              </div>
            </section>

            <section id="page-count" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. How many pages can I split from a PDF?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  You can split any number of pages from a PDF, from a single page to all pages in the document. There are no restrictions on how many pages you can extract in a single operation.
                </p>
                <p>
                  <strong>Flexible Page Selection</strong><br />
                  BlendPDF allows you to select any combination of pages for extraction. You can extract just one page if you need a single page document, or you can extract hundreds of pages if you're working with a large document. The "Select All" button makes it easy to extract all pages from a document, which is useful when you want to create a copy or when you're preparing to reorganize pages. There's no minimum or maximum number of pages you must select.
                </p>
                <p>
                  <strong>Single Page Extraction</strong><br />
                  Extracting a single page is perfect for creating standalone documents from larger PDFs. For example, you might extract a cover page, a specific chapter, or a particular section. The visual interface makes it easy to identify and select the exact page you need, and the extraction process is just as fast for one page as it is for many pages.
                </p>
                <p>
                  <strong>Multiple Page Extraction</strong><br />
                  You can extract multiple pages in various patterns: consecutive pages (like pages 5-10), scattered individual pages (like pages 1, 5, 10, 15), or multiple ranges (like pages 1-3 and 10-15). The system handles any selection pattern you need, and the extracted PDF will contain all selected pages in their original document order. This flexibility makes it easy to create new documents from any combination of pages.
                </p>
                <p>
                  <strong>Performance Considerations</strong><br />
                  The number of pages you extract doesn't significantly affect processing time. Whether you extract 1 page or 100 pages, the splitting process typically completes in 5-15 seconds. The main factor affecting processing time is the total file size and complexity, not the number of pages being extracted. This means you can extract large numbers of pages without worrying about long wait times.
                </p>
              </div>
            </section>

            <section id="processing-time" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. How long does splitting take?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  PDF splitting with BlendPDF is typically very fast, with most operations completing in just a few seconds. The exact time depends on several factors, but our optimized system ensures quick processing for the vast majority of documents.
                </p>
                <p>
                  <strong>Typical Processing Times</strong><br />
                  For most common splitting tasks, processing takes 5-15 seconds. This includes uploading the PDF, generating thumbnails, and extracting selected pages. The thumbnail generation happens automatically when you upload, and the actual splitting process is very fast. You'll often see your extracted PDF downloading before you've had time to think about waiting. This speed makes BlendPDF ideal for quick page extraction tasks.
                </p>
                <p>
                  <strong>Factors Affecting Speed</strong><br />
                  Several factors influence processing time: file size, number of pages, image content, number of pages being extracted, and your internet connection speed for uploading and downloading. Larger files with many high-resolution images may take 20-30 seconds for thumbnail generation, but the actual splitting process remains fast. The number of pages you extract doesn't significantly affect processing time - extracting 1 page takes about the same time as extracting 100 pages.
                </p>
                <p>
                  <strong>Thumbnail Generation</strong><br />
                  The initial thumbnail generation happens when you upload your PDF and typically takes 5-10 seconds for most documents. Once thumbnails are generated, you can select pages and split immediately. The thumbnail generation is a one-time process per upload, so if you want to split the same document multiple times with different page selections, you only wait for thumbnails once.
                </p>
                <p>
                  <strong>System Optimization</strong><br />
                  Our splitting system is optimized to handle files efficiently. We use parallel processing where possible, and our servers are configured for high performance. Even when splitting large, complex documents, most operations complete in under 30 seconds total. The visual progress indicators keep you informed about the status of your splitting operation, so you always know what's happening.
                </p>
              </div>
            </section>

            <section id="original-file" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Is my original file modified?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No, your original file is never modified. BlendPDF creates a new PDF containing only the selected pages while leaving your original file completely untouched on your device.
                </p>
                <p>
                  <strong>Non-Destructive Process</strong><br />
                  The splitting process is completely non-destructive. When you upload a PDF for splitting, we create a copy on our servers and work with that copy. Your original file remains on your computer, tablet, or mobile device exactly as it was before splitting. The extracted file is downloaded as a new, separate file with a different name (typically "split.pdf" or similar), so you can easily distinguish it from your original.
                </p>
                <p>
                  <strong>File Safety</strong><br />
                  This non-destructive approach ensures that you can always go back to your original file if needed. You can split the same file multiple times with different page selections, try different combinations of pages, or keep both the original and extracted versions. There's no risk of accidentally losing or damaging your original document, giving you complete peace of mind when using our splitting service.
                </p>
                <p>
                  <strong>Multiple Splitting Operations</strong><br />
                  Since your original file is never modified, you can split it multiple times with different page selections to create different extracted documents. For example, you might extract pages 1-10 for one purpose, then extract pages 15-20 for another purpose, all from the same original file. Each extraction creates a new file, so you can build a collection of extracted documents from a single source PDF.
                </p>
                <p>
                  <strong>File Management</strong><br />
                  After splitting, you'll have both your original file and the new extracted file. You can delete either one, rename them, or keep both for different purposes. For example, you might keep the original for reference and use the extracted version for sharing or further editing. This flexibility makes it easy to manage your documents and use the right version for each specific need.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I split password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Currently, BlendPDF does not support splitting password-protected PDFs. This is a security feature designed to protect your documents and ensure that only authorized users can access and modify PDF files.
                </p>
                <p>
                  <strong>Why Password Protection Exists</strong><br />
                  Password protection is added to PDFs to restrict access and prevent unauthorized viewing or editing. When a PDF is password-protected, it means the document owner has intentionally secured it. To maintain respect for these security measures and comply with privacy expectations, BlendPDF requires that PDFs be unlocked before they can be processed.
                </p>
                <p>
                  <strong>How to Split Protected PDFs</strong><br />
                  If you need to split password-protected PDFs, you'll first need to remove the password protection using a PDF unlocking tool. Once the PDF is unlocked, you can upload it to BlendPDF and split it normally. It's important to note that you should only unlock PDFs that you own or have explicit permission to modify. After splitting, you can add password protection back to the extracted file if needed using a PDF protection tool.
                </p>
                <p>
                  <strong>Security Best Practices</strong><br />
                  If you're working with sensitive documents, we recommend splitting them first (after unlocking if necessary), and then adding password protection to the final extracted document if needed. This approach maintains security while allowing you to use BlendPDF's splitting capabilities. Always ensure you're following your organization's security policies when working with protected documents, and never share passwords or unlock documents you don't have permission to modify.
                </p>
                <p>
                  <strong>Future Support</strong><br />
                  We're continuously working to improve BlendPDF's capabilities. Support for password-protected PDFs may be added in future updates, but for now, unlocking PDFs before splitting is the recommended approach. This ensures compatibility and maintains the security integrity of your documents while allowing you to benefit from our splitting service.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Can I split PDFs on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, BlendPDF works seamlessly on mobile devices including smartphones and tablets. Our responsive design ensures that the splitting process is just as easy and intuitive on mobile as it is on desktop computers.
                </p>
                <p>
                  <strong>Mobile-Optimized Interface</strong><br />
                  The BlendPDF interface automatically adapts to your device's screen size, providing an optimized experience whether you're using an iPhone, Android phone, iPad, or tablet. Touch-friendly controls make it easy to upload files, select pages by tapping thumbnails, and download extracted PDFs. The thumbnail grid adjusts to your screen size, showing an appropriate number of thumbnails per row for easy viewing and selection on smaller screens.
                </p>
                <p>
                  <strong>File Upload on Mobile</strong><br />
                  On mobile devices, you can upload PDFs from various sources including your device's storage, cloud storage services (like Google Drive, iCloud, Dropbox), or email attachments. The file selection process is integrated with your device's operating system, making it familiar and easy to use. You can access files from your documents folder, downloads, or any other location where PDFs are stored on your device.
                </p>
                <p>
                  <strong>Visual Selection on Mobile</strong><br />
                  The visual page selection works great on mobile devices. Thumbnails are sized appropriately for touch interaction, and you can easily tap to select or deselect pages. The selection feedback is clear and immediate, making it easy to see which pages you've chosen. The bulk selection tools (Select All, Clear) are also touch-friendly and work perfectly on mobile screens.
                </p>
                <p>
                  <strong>Performance on Mobile</strong><br />
                  Splitting speed is the same on mobile as on desktop since all processing happens on our servers. Your device's performance doesn't affect splitting speed. However, upload and download speeds will depend on your mobile internet connection. On Wi-Fi, the experience is typically very fast, while cellular connections may be slower depending on signal strength and data speeds. The splitting process itself is server-side, so even older mobile devices can split large PDFs efficiently.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. Is splitting PDFs free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, splitting PDFs with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today. We believe that basic PDF tools should be accessible to everyone, which is why we offer our splitting service at no charge.
                </p>
                <p>
                  <strong>No Payment Required</strong><br />
                  There are no credit card requirements, no trial periods that convert to paid subscriptions, and no "freemium" limitations that force you to upgrade. You can split as many PDFs as you want, as often as you want, without ever being asked for payment. This makes BlendPDF accessible to students, small businesses, individuals, and organizations of all sizes, regardless of budget constraints.
                </p>
                <p>
                  <strong>Full Feature Access</strong><br />
                  The free service includes all features: visual page selection, extraction of any number of pages, support for files up to 50MB, RTL language support, and automatic file deletion. There are no feature restrictions or usage limits. Every user gets the same full-featured experience, regardless of how many times they use the service or how many pages they extract.
                </p>
                <p>
                  <strong>No Account Required</strong><br />
                  The free service doesn't require you to create an account or provide any personal information. You can start splitting PDFs immediately without signing up, providing an email address, or going through any registration process. This instant access makes BlendPDF convenient for one-time users and regular users alike, eliminating barriers to use.
                </p>
                <p>
                  <strong>Sustainable Model</strong><br />
                  We're able to offer free PDF splitting through efficient server infrastructure and a focus on core functionality. By keeping our service simple and focused, we can provide it free while maintaining high quality and reliability. Our goal is to be the best free PDF splitting tool available, and we're committed to keeping it free for all users, ensuring that page extraction is accessible to everyone who needs it.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. What happens to my files after splitting?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF is designed with privacy as a core principle. We've implemented strict data handling practices to ensure your files are processed securely and deleted promptly, giving you complete peace of mind about your document privacy.
                </p>
                <p>
                  <strong>Automatic Deletion</strong><br />
                  All uploaded files are automatically deleted from our servers within one hour of upload, and most are removed immediately after processing, regardless of whether splitting was successful or not. This automatic deletion happens without any action required from you. Once deleted, files cannot be recovered, ensuring that your documents don't remain on our systems longer than necessary for processing. This one-hour window provides enough time for splitting and download while minimizing the time your files spend on our servers.
                </p>
                <p>
                  <strong>No Permanent Storage</strong><br />
                  We don't maintain permanent storage of your files. Files exist on our servers only long enough to complete the splitting process and provide you with the download. We don't create backups of your files, and we don't archive them for any purpose. This means your documents are truly temporary on our systems, existing only for the brief time needed to process them. There's no risk of your files being stored indefinitely or accessed later.
                </p>
                <p>
                  <strong>No Access or Viewing</strong><br />
                  Our systems are designed to process files automatically without human access. No one at BlendPDF views, reads, or analyzes the content of your PDFs. The splitting is entirely automated, ensuring that your document contents remain completely private. We don't extract or store any text, images, or metadata from your files beyond what's necessary for the splitting operation. Your documents are processed as data, not as readable content.
                </p>
                <p>
                  <strong>Secure Processing Environment</strong><br />
                  Files are processed in secure, isolated environments with restricted access. Our servers use industry-standard security measures including encryption at rest and in transit. Even during the brief time files are on our servers, they're protected by multiple layers of security. This comprehensive approach ensures your documents are safe throughout their entire lifecycle on our platform, from upload through splitting to automatic deletion.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if splitting fails or produces errors?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  While BlendPDF is designed to be reliable and handle a wide variety of PDF files, occasional errors can occur. Understanding common issues and how to resolve them helps ensure a smooth splitting experience.
                </p>
                <p>
                  <strong>Common Error Types</strong><br />
                  The most common errors include file size limits being exceeded, corrupted PDF files that can't be processed, unsupported file formats (non-PDF files), or network issues during upload or download. Our system provides clear error messages that explain what went wrong, making it easier to identify and fix the issue. These error messages are designed to be helpful and actionable, guiding you toward a solution.
                </p>
                <p>
                  <strong>File Size Issues</strong><br />
                  If you receive an error about file size, check that your file is under 50MB. If your file is too large, consider compressing it first using our PDF compression tool, then splitting the compressed version. Alternatively, you can split large documents into smaller sections first, then work with those sections. The error message will clearly indicate if file size is the issue and provide guidance on how to proceed.
                </p>
                <p>
                  <strong>Corrupted Files</strong><br />
                  If a PDF file is corrupted or damaged, it may not split successfully. Try opening the file in a PDF viewer first to verify it's not corrupted. If the file opens correctly but still fails to split, try saving it again from your PDF viewer, which can sometimes repair minor corruption issues. Some PDFs may have internal structure problems that prevent splitting, and in these cases, recreating the PDF or using a PDF repair tool may be necessary.
                </p>
                <p>
                  <strong>Getting Help</strong><br />
                  If you continue to experience errors, try refreshing the page and attempting to split again. Sometimes temporary server issues or network problems can cause errors that resolve on retry. If problems persist, the error message will provide specific information about what went wrong, which can help you troubleshoot the issue. Our system is continuously monitored and improved to minimize errors and provide the best possible user experience. Most splitting operations complete successfully on the first attempt, but retrying is often effective for resolving temporary issues.
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

