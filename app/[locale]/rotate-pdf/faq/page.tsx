'use client';

import { Navigation } from '@/components/Navigation';
import { useTranslations } from 'next-intl';
import { FAQSchema } from '@/components/FAQSchema';
import { BreadcrumbSchema } from '@/components/BreadcrumbSchema';
import { Footer } from '@/components/Footer';

export default function RotatePDFFAQ() {
  const t = useTranslations();
  
  const faqs = [
    {
      question: 'How to rotate PDF pages online',
      answer: 'Upload your PDF file, use rotation controls to rotate all pages globally or click rotation buttons on individual page thumbnails. Preview the changes, then click "Apply Rotation & Download". The process takes 5-10 seconds.'
    },
    {
      question: 'What rotation angles are available?',
      answer: 'Pages can be rotated in 90-degree increments: 90° (quarter turn), 180° (upside down), or 270° (three-quarter turn). You can rotate clockwise or counterclockwise, and rotate multiple times to achieve different angles.'
    },
    {
      question: 'Can I rotate individual pages differently?',
      answer: 'Yes, each page thumbnail has its own rotation buttons, allowing you to rotate pages independently. You can rotate page 1 by 90°, leave page 2 unchanged, rotate page 3 by 180°, and so on.'
    },
    {
      question: 'Can I rotate all pages at once?',
      answer: 'Yes, use the global rotation controls at the top to rotate all pages simultaneously. You can then fine-tune individual pages if needed. This is useful for correcting documents that were scanned in the wrong orientation.'
    },
    {
      question: 'Does rotation preserve PDF quality?',
      answer: 'Yes, rotation preserves all PDF quality including formatting, images, text, and interactive elements. The rotated PDF maintains the exact same quality as the original document.'
    },
    {
      question: 'Does rotation work with Arabic PDFs?',
      answer: 'Yes, BlendPDF works perfectly with Arabic PDFs and all RTL languages. Text direction, character order, and formatting are all preserved correctly after rotation.'
    },
    {
      question: 'What are the file size limits?',
      answer: 'You can upload PDF files up to 50MB in size. There\'s no limit on the number of pages you can rotate. Very large documents may take slightly longer to process.'
    },
    {
      question: 'How long does rotation take?',
      answer: 'Rotation typically takes 5-10 seconds, depending on the number of pages. The process is fast and efficient, with your rotated PDF ready for download almost immediately.'
    },
    {
      question: 'Is my original file modified?',
      answer: 'No, your original file is never modified. BlendPDF creates a new rotated PDF while leaving your original file completely untouched on your device.'
    },
    {
      question: 'Can I rotate password-protected PDFs?',
      answer: 'Password-protected PDFs cannot be rotated directly. You\'ll need to unlock the PDF first using an unlock tool, then rotate it. Support for protected PDFs may be added in future updates.'
    },
    {
      question: 'Can I rotate PDFs on mobile devices?',
      answer: 'Yes, BlendPDF works seamlessly on smartphones and tablets. The rotation interface is touch-friendly and works perfectly on mobile devices.'
    },
    {
      question: 'Is rotating PDFs free?',
      answer: 'Yes, rotating PDFs with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today. All features are available at no charge.'
    },
    {
      question: 'What happens to my files after rotation?',
      answer: 'All uploaded files are automatically deleted from our servers within one hour, most immediately after processing. We never read, store, or share the contents of your documents. No permanent storage is maintained.'
    },
    {
      question: 'Can I undo a rotation?',
      answer: 'You can rotate a page multiple times - rotating four times brings it back to the original orientation (0°). Before downloading, you can adjust rotations as needed. After download, you\'d need to rotate again to undo.'
    },
    {
      question: 'What if rotation fails or produces errors?',
      answer: 'Common issues include file size limits, corrupted PDFs, or network problems. Try refreshing and retrying. Verify your file opens correctly in a PDF viewer and check your internet connection.'
    },
  ];
  
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <FAQSchema faqs={faqs} />
      <BreadcrumbSchema items={[
        { name: 'Home', url: '/' },
        { name: 'Rotate PDF', url: '/rotate-pdf' },
        { name: 'FAQ', url: '/rotate-pdf/faq' },
      ]} />
      <Navigation />
      
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
          <h1 className="mb-8 text-4xl font-bold text-gray-900">
            Frequently Asked Questions: Rotate PDF
          </h1>

          <div className="mb-12 rounded-lg bg-gray-50 p-6">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Table of Contents</h2>
            <ol className="list-decimal space-y-2 ps-6 text-gray-700">
              <li><a href="#how-to-rotate" className="text-blue-600 hover:text-blue-800">How to rotate PDF pages online</a></li>
              <li><a href="#rotation-angles" className="text-blue-600 hover:text-blue-800">What rotation angles are available?</a></li>
              <li><a href="#individual-pages" className="text-blue-600 hover:text-blue-800">Can I rotate individual pages differently?</a></li>
              <li><a href="#global-rotation" className="text-blue-600 hover:text-blue-800">Can I rotate all pages at once?</a></li>
              <li><a href="#preserve-quality" className="text-blue-600 hover:text-blue-800">Does rotation preserve PDF quality?</a></li>
              <li><a href="#arabic-support" className="text-blue-600 hover:text-blue-800">Does rotation work with Arabic PDFs?</a></li>
              <li><a href="#file-size-limits" className="text-blue-600 hover:text-blue-800">What are the file size limits?</a></li>
              <li><a href="#processing-time" className="text-blue-600 hover:text-blue-800">How long does rotation take?</a></li>
              <li><a href="#original-file" className="text-blue-600 hover:text-blue-800">Is my original file modified?</a></li>
              <li><a href="#password-protected" className="text-blue-600 hover:text-blue-800">Can I rotate password-protected PDFs?</a></li>
              <li><a href="#mobile-devices" className="text-blue-600 hover:text-blue-800">Can I rotate PDFs on mobile devices?</a></li>
              <li><a href="#cost" className="text-blue-600 hover:text-blue-800">Is rotating PDFs free?</a></li>
              <li><a href="#data-privacy" className="text-blue-600 hover:text-blue-800">What happens to my files after rotation?</a></li>
              <li><a href="#undo-rotation" className="text-blue-600 hover:text-blue-800">Can I undo a rotation?</a></li>
              <li><a href="#technical-support" className="text-blue-600 hover:text-blue-800">What if rotation fails or produces errors?</a></li>
            </ol>
          </div>

          <div className="space-y-12">
            <section id="how-to-rotate" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">1. How to rotate PDF pages online</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Rotating PDF pages with BlendPDF is straightforward and gives you complete control over page orientation. Here's a comprehensive guide to help you rotate PDF pages efficiently:
                </p>
                <p>
                  <strong>Upload Your PDF</strong><br />
                  Start by clicking the "Select PDF" button or dragging and dropping your PDF file directly onto the upload area. BlendPDF accepts PDF files up to 50MB in size. Once uploaded, the system automatically analyzes your PDF and displays thumbnail previews of all pages, showing you the current orientation of each page. This visual representation makes it easy to identify which pages need rotation and in which direction.
                </p>
                <p>
                  <strong>Choose Rotation Method</strong><br />
                  BlendPDF offers two rotation methods: global rotation (rotate all pages at once) or individual page rotation (rotate specific pages). For global rotation, use the rotation controls at the top to rotate all pages 90 degrees clockwise or counterclockwise. For individual pages, click on the rotation buttons (left or right arrows) on each page thumbnail to rotate that specific page. You can combine both methods - apply a global rotation, then fine-tune individual pages as needed.
                </p>
                <p>
                  <strong>Preview and Adjust</strong><br />
                  As you rotate pages, the thumbnails update in real-time to show the new orientation. This visual feedback helps you see exactly how each page will look after rotation. You can rotate pages multiple times - each 90-degree rotation builds on the previous one, so rotating twice gives you 180 degrees, and three times gives you 270 degrees. The rotation indicator on each thumbnail shows the current rotation state, making it easy to track which pages have been rotated and by how much.
                </p>
                <p>
                  <strong>Apply and Download</strong><br />
                  Once you're satisfied with the rotations, click the "Apply Rotation & Download" button. The rotation process typically takes just 5-10 seconds, depending on the number of pages. Once complete, your rotated PDF will automatically download to your device. The file contains all pages with their rotations applied, with all formatting, images, and text preserved. The rotation is permanent in the downloaded file, so pages will display correctly in any PDF viewer.
                </p>
              </div>
            </section>

            <section id="rotation-angles" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">2. What rotation angles are available?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF supports rotation in 90-degree increments, giving you precise control over page orientation. You can rotate pages to any of the four standard orientations: 0° (original), 90° (quarter turn), 180° (upside down), or 270° (three-quarter turn).
                </p>
                <p>
                  <strong>90-Degree Increments</strong><br />
                  Pages can be rotated in 90-degree increments clockwise or counterclockwise. Each click of the rotation button rotates the page by 90 degrees. This means you can achieve 90°, 180°, or 270° rotations by clicking the button one, two, or three times respectively. The 90-degree increment system is standard for PDF rotation and ensures compatibility with all PDF viewers and printers. This system works perfectly for correcting scanned documents that were scanned upside down or sideways.
                </p>
                <p>
                  <strong>Clockwise and Counterclockwise</strong><br />
                  BlendPDF provides both clockwise and counterclockwise rotation options. Clockwise rotation turns pages to the right, while counterclockwise rotation turns pages to the left. Both directions achieve the same end result when rotated the same number of times - for example, rotating clockwise three times (270°) gives the same result as rotating counterclockwise once (90°). The choice of direction is a matter of preference and convenience, allowing you to rotate in whichever direction feels more intuitive for your workflow.
                </p>
                <p>
                  <strong>Combining Rotations</strong><br />
                  You can rotate pages multiple times to achieve different angles. Rotating once gives 90°, twice gives 180°, three times gives 270°, and four times brings the page back to 0° (original orientation). This cumulative rotation system makes it easy to fine-tune page orientation. If you rotate a page too far, just rotate it again to correct it. The rotation indicator on each thumbnail shows the current rotation state, helping you keep track of how many times each page has been rotated.
                </p>
                <p>
                  <strong>Use Cases for Different Angles</strong><br />
                  Different rotation angles serve different purposes. 90° rotation is commonly used to correct pages that were scanned sideways. 180° rotation fixes pages that were scanned upside down. 270° rotation is useful when you need to rotate a page that's already been rotated once but in the wrong direction. Understanding these angles helps you quickly correct document orientation issues, whether you're fixing scanned documents, correcting accidentally rotated pages, or preparing documents for specific viewing or printing requirements.
                </p>
              </div>
            </section>

            <section id="individual-pages" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">3. Can I rotate individual pages differently?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, you can rotate individual pages independently, giving you complete control over the orientation of each page in your PDF. This is one of BlendPDF's key features, allowing you to fix mixed-orientation documents where different pages need different rotations.
                </p>
                <p>
                  <strong>Individual Page Controls</strong><br />
                  Each page thumbnail has its own rotation buttons (left and right arrows) that allow you to rotate that specific page independently. Clicking the rotation button on a thumbnail rotates only that page, leaving all other pages unchanged. This granular control is perfect for documents where some pages are correctly oriented and others need rotation. You can rotate page 1 by 90°, leave page 2 as is, rotate page 3 by 180°, and so on, creating a document where each page has its optimal orientation.
                </p>
                <p>
                  <strong>Visual Feedback</strong><br />
                  As you rotate individual pages, the thumbnails update immediately to show the new orientation. Each thumbnail also displays a rotation indicator showing how many times that page has been rotated. This visual feedback makes it easy to see which pages have been rotated and by how much, helping you keep track of your changes across a multi-page document. You can easily identify pages that still need rotation and see at a glance which pages are correctly oriented.
                </p>
                <p>
                  <strong>Mixed Orientation Documents</strong><br />
                  Individual page rotation is particularly useful for scanned documents where pages may have been scanned in different orientations. For example, a document might have some pages scanned portrait and others landscape, or some pages might have been scanned upside down. With individual page rotation, you can fix each page independently, creating a document where all pages are correctly oriented regardless of how they were originally scanned. This saves you from having to rescan documents or manually fix orientation issues.
                </p>
                <p>
                  <strong>Combining with Global Rotation</strong><br />
                  You can combine individual page rotation with global rotation for maximum flexibility. For example, you might apply a global 90° rotation to correct most pages, then use individual rotation to fine-tune specific pages that need different treatment. This two-step approach is efficient when most pages need the same rotation but a few pages need adjustment. The system handles these combined rotations correctly, ensuring that each page ends up with its intended orientation.
                </p>
              </div>
            </section>

            <section id="global-rotation" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">4. Can I rotate all pages at once?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, BlendPDF provides global rotation controls that allow you to rotate all pages in your PDF simultaneously. This is perfect when all pages need the same rotation, saving you time and effort compared to rotating each page individually.
                </p>
                <p>
                  <strong>Global Rotation Controls</strong><br />
                  The global rotation controls are located at the top of the page grid, clearly labeled and easy to access. You can rotate all pages 90 degrees clockwise or counterclockwise with a single click. This is ideal when an entire document was scanned in the wrong orientation - for example, if all pages were scanned sideways or upside down. One global rotation can fix the entire document instantly, rather than requiring you to rotate each page individually.
                </p>
                <p>
                  <strong>Efficiency for Uniform Documents</strong><br />
                  Global rotation is most efficient when all pages in your document need the same rotation. This is common with scanned documents where the entire document was scanned in one orientation, or when a PDF was accidentally rotated as a whole. Using global rotation in these cases is much faster than rotating pages one by one, and it ensures consistency across all pages. The operation completes in the same time regardless of how many pages your document has.
                </p>
                <p>
                  <strong>Combining with Individual Rotation</strong><br />
                  After applying a global rotation, you can still rotate individual pages if needed. This gives you the best of both worlds: quick global correction followed by fine-tuning of specific pages. For example, you might rotate all pages 90° to fix the majority, then rotate a few specific pages that need different treatment. This hybrid approach is efficient and flexible, allowing you to handle both uniform and mixed-orientation documents effectively.
                </p>
                <p>
                  <strong>Rotation State Tracking</strong><br />
                  When you apply a global rotation, all pages are rotated by the same amount, and this rotation is reflected in each page's rotation indicator. If you then rotate individual pages, those rotations are added to the global rotation. For example, if you apply a global 90° rotation and then rotate page 5 by another 90°, page 5 will be rotated 180° total. This cumulative system ensures that all rotations are properly tracked and applied, giving you precise control over each page's final orientation.
                </p>
              </div>
            </section>

            <section id="preserve-quality" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">5. Does rotation preserve PDF quality?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, rotating PDFs with BlendPDF preserves 100% of the original quality. There is no quality loss when rotating PDFs, as the rotation process simply changes the page orientation metadata without altering the actual content.
                </p>
                <p>
                  <strong>Lossless Rotation</strong><br />
                  PDF rotation is a lossless operation that doesn't modify the actual content of your pages. Instead, it updates the page orientation metadata, which tells PDF viewers how to display each page. Text remains perfectly crisp and clear, images maintain their original resolution and quality, and all formatting elements are preserved. The rotation is applied at the page level, not by re-rendering or re-compressing content, which means there's absolutely no quality degradation.
                </p>
                <p>
                  <strong>All Elements Preserved</strong><br />
                  Every element of your pages is preserved during rotation: fonts, font sizes, colors, text formatting, images, graphics, layouts, margins, headers, footers, and page dimensions. Interactive elements like hyperlinks, bookmarks, and form fields are also maintained. The only thing that changes is the orientation - everything else remains exactly as it was in the original document. This ensures that your rotated PDF looks and functions exactly like the original, just with corrected orientation.
                </p>
                <p>
                  <strong>No Re-compression</strong><br />
                  Unlike some PDF tools that re-compress files during rotation, BlendPDF rotates pages without applying any compression or quality reduction. This ensures that image quality, text clarity, and document fidelity remain perfect. If your original PDF had high-resolution images, the rotated PDF will have the same high-resolution images. If text was sharp in the original, it remains sharp after rotation. The rotation process is purely a metadata change, not a content modification.
                </p>
                <p>
                  <strong>Vector Graphics Preservation</strong><br />
                  Vector graphics, which are common in PDFs for logos, diagrams, and illustrations, are preserved perfectly during rotation. Vector graphics are resolution-independent, meaning they can be rotated without any quality loss at any scale. This makes PDF rotation ideal for documents with complex graphics, technical drawings, or professional designs where maintaining visual quality is critical.
                </p>
              </div>
            </section>

            <section id="arabic-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">6. Does rotation work with Arabic PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, BlendPDF rotation works perfectly with Arabic PDFs and all other right-to-left (RTL) languages. Our rotation engine correctly handles RTL text, ensuring that rotated pages display correctly regardless of language.
                </p>
                <p>
                  <strong>Perfect RTL Support</strong><br />
                  Our rotation engine is specifically designed to handle RTL languages correctly. When you rotate an Arabic PDF, all text direction, character order, and formatting are preserved exactly as in the original. Arabic text reads correctly from right to left after rotation, numbers appear in the proper context, and mixed content (Arabic and English together) is displayed accurately. The rotation process understands the Unicode bidirectional algorithm and ensures that RTL text rendering remains perfect in rotated pages.
                </p>
                <p>
                  <strong>Text Quality Preservation</strong><br />
                  Arabic text is rotated with perfect quality preservation. All Arabic characters, diacritical marks, and special characters remain perfectly crisp and readable. Font rendering, text positioning, and character spacing are all maintained exactly as in the original document. This ensures that rotated Arabic pages are just as readable and professional-looking as the originals, with no text corruption or formatting issues.
                </p>
                <p>
                  <strong>Supported Languages</strong><br />
                  BlendPDF supports rotation for all RTL languages including Arabic (العربية), Hebrew (עברית), Persian/Farsi (فارسی), Urdu (اردو), and many others. We also support left-to-right languages like English, Spanish, French, German, Chinese, Japanese, and more. This multilingual capability makes BlendPDF an ideal choice for international users, businesses operating in multiple countries, and academic institutions with diverse language requirements.
                </p>
                <p>
                  <strong>Real-World Testing</strong><br />
                  We've extensively tested BlendPDF rotation with real-world Arabic documents including legal contracts, academic papers, business reports, and personal documents. Our testing ensures that complex layouts, tables, forms, and mixed-language content all rotate correctly while maintaining perfect readability. This commitment to quality means you can confidently use BlendPDF to rotate any Arabic PDF, knowing that the results will be accurate, readable, and professional.
                </p>
              </div>
            </section>

            <section id="file-size-limits" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">7. What are the file size limits?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF has generous file size limits designed to accommodate most real-world PDF rotation needs while ensuring fast processing times and reliable performance.
                </p>
                <p>
                  <strong>Upload Size Limit</strong><br />
                  You can upload PDF files up to 50MB in size for rotation. This limit applies to the original file size before rotation. The 50MB limit is sufficient for most documents including high-resolution scanned documents, detailed reports with embedded images, and complex multi-page documents. For reference, a typical 100-page text document is usually under 5MB, while a 50-page document with high-quality images might be 20-30MB. Most users find that 50MB is more than enough for their rotation needs.
                </p>
                <p>
                  <strong>Rotated File Size</strong><br />
                  The rotated PDF file will be approximately the same size as the original, as rotation doesn't significantly change file size. Rotation only modifies page orientation metadata, not the actual content, so the file size remains essentially unchanged. This means you don't need to worry about file size changes when rotating PDFs - the rotated file will be very similar in size to the original.
                </p>
                <p>
                  <strong>Page Count Considerations</strong><br />
                  There's no hard limit on the number of pages in a PDF you can rotate. However, very large documents (hundreds or thousands of pages) may take longer to process and generate thumbnails. Most users find that rotating documents with hundreds of pages completes in under 30 seconds. The processing time depends on factors like file complexity, image content, and the number of pages being rotated.
                </p>
                <p>
                  <strong>Optimization Tips</strong><br />
                  If you need to rotate files larger than 50MB, consider compressing them first using our PDF compression tool, then rotating the compressed version. Alternatively, you can split large documents into smaller sections first, rotate each section, then merge them back together if needed. These strategies help you work within the limits while achieving optimal rotation results.
                </p>
              </div>
            </section>

            <section id="processing-time" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">8. How long does rotation take?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  PDF rotation with BlendPDF is typically very fast, with most operations completing in just a few seconds. The exact time depends on several factors, but our optimized system ensures quick processing for the vast majority of documents.
                </p>
                <p>
                  <strong>Typical Processing Times</strong><br />
                  For most common rotation tasks, processing takes 5-15 seconds. This includes uploading the PDF, generating thumbnails, and applying rotations. The thumbnail generation happens automatically when you upload, and the actual rotation process is very fast. You'll often see your rotated PDF downloading before you've had time to think about waiting. This speed makes BlendPDF ideal for quick page orientation corrections.
                </p>
                <p>
                  <strong>Factors Affecting Speed</strong><br />
                  Several factors influence processing time: file size, number of pages, image content, number of pages being rotated, and your internet connection speed for uploading and downloading. Larger files with many high-resolution images may take 20-30 seconds for thumbnail generation, but the actual rotation process remains fast. The number of pages you rotate doesn't significantly affect processing time - rotating 1 page takes about the same time as rotating 100 pages.
                </p>
                <p>
                  <strong>Thumbnail Generation</strong><br />
                  The initial thumbnail generation happens when you upload your PDF and typically takes 5-10 seconds for most documents. Once thumbnails are generated, you can rotate pages and apply changes immediately. The thumbnail generation is a one-time process per upload, so if you want to rotate the same document multiple times with different rotations, you only wait for thumbnails once.
                </p>
                <p>
                  <strong>System Optimization</strong><br />
                  Our rotation system is optimized to handle files efficiently. We use parallel processing where possible, and our servers are configured for high performance. Even when rotating large, complex documents, most operations complete in under 30 seconds total. The visual progress indicators keep you informed about the status of your rotation operation, so you always know what's happening.
                </p>
              </div>
            </section>

            <section id="original-file" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">9. Is my original file modified?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  No, your original file is never modified. BlendPDF creates a new PDF with rotated pages while leaving your original file completely untouched on your device.
                </p>
                <p>
                  <strong>Non-Destructive Process</strong><br />
                  The rotation process is completely non-destructive. When you upload a PDF for rotation, we create a copy on our servers and work with that copy. Your original file remains on your computer, tablet, or mobile device exactly as it was before rotation. The rotated file is downloaded as a new, separate file with a different name (typically "rotated.pdf" or similar), so you can easily distinguish it from your original.
                </p>
                <p>
                  <strong>File Safety</strong><br />
                  This non-destructive approach ensures that you can always go back to your original file if needed. You can rotate the same file multiple times with different rotations, try different rotation combinations, or keep both the original and rotated versions. There's no risk of accidentally losing or damaging your original document, giving you complete peace of mind when using our rotation service.
                </p>
                <p>
                  <strong>Multiple Rotation Operations</strong><br />
                  Since your original file is never modified, you can rotate it multiple times with different settings to create different rotated versions. For example, you might create one version with all pages rotated 90°, then create another version with individual page rotations. Each rotation creates a new file, so you can experiment with different rotation strategies without affecting your original document.
                </p>
                <p>
                  <strong>File Management</strong><br />
                  After rotation, you'll have both your original file and the new rotated file. You can delete either one, rename them, or keep both for different purposes. For example, you might keep the original for reference and use the rotated version for viewing or printing. This flexibility makes it easy to manage your documents and use the right version for each specific need.
                </p>
              </div>
            </section>

            <section id="password-protected" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">10. Can I rotate password-protected PDFs?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Currently, BlendPDF does not support rotating password-protected PDFs. This is a security feature designed to protect your documents and ensure that only authorized users can access and modify PDF files.
                </p>
                <p>
                  <strong>Why Password Protection Exists</strong><br />
                  Password protection is added to PDFs to restrict access and prevent unauthorized viewing or editing. When a PDF is password-protected, it means the document owner has intentionally secured it. To maintain respect for these security measures and comply with privacy expectations, BlendPDF requires that PDFs be unlocked before they can be processed.
                </p>
                <p>
                  <strong>How to Rotate Protected PDFs</strong><br />
                  If you need to rotate password-protected PDFs, you'll first need to remove the password protection using a PDF unlocking tool. Once the PDF is unlocked, you can upload it to BlendPDF and rotate it normally. It's important to note that you should only unlock PDFs that you own or have explicit permission to modify. After rotation, you can add password protection back to the rotated file if needed using a PDF protection tool.
                </p>
                <p>
                  <strong>Security Best Practices</strong><br />
                  If you're working with sensitive documents, we recommend rotating them first (after unlocking if necessary), and then adding password protection to the final rotated document if needed. This approach maintains security while allowing you to use BlendPDF's rotation capabilities. Always ensure you're following your organization's security policies when working with protected documents, and never share passwords or unlock documents you don't have permission to modify.
                </p>
                <p>
                  <strong>Future Support</strong><br />
                  We're continuously working to improve BlendPDF's capabilities. Support for password-protected PDFs may be added in future updates, but for now, unlocking PDFs before rotation is the recommended approach. This ensures compatibility and maintains the security integrity of your documents while allowing you to benefit from our rotation service.
                </p>
              </div>
            </section>

            <section id="mobile-devices" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">11. Can I rotate PDFs on mobile devices?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, BlendPDF works seamlessly on mobile devices including smartphones and tablets. Our responsive design ensures that the rotation process is just as easy and intuitive on mobile as it is on desktop computers.
                </p>
                <p>
                  <strong>Mobile-Optimized Interface</strong><br />
                  The BlendPDF interface automatically adapts to your device's screen size, providing an optimized experience whether you're using an iPhone, Android phone, iPad, or tablet. Touch-friendly controls make it easy to upload files, rotate pages by tapping rotation buttons, and download rotated PDFs. The thumbnail grid adjusts to your screen size, showing an appropriate number of thumbnails per row for easy viewing and interaction on smaller screens.
                </p>
                <p>
                  <strong>File Upload on Mobile</strong><br />
                  On mobile devices, you can upload PDFs from various sources including your device's storage, cloud storage services (like Google Drive, iCloud, Dropbox), or email attachments. The file selection process is integrated with your device's operating system, making it familiar and easy to use. You can access files from your documents folder, downloads, or any other location where PDFs are stored on your device.
                </p>
                <p>
                  <strong>Rotation Controls on Mobile</strong><br />
                  The rotation controls work great on mobile devices. Each thumbnail has touch-friendly rotation buttons that are easy to tap. The global rotation controls are also easily accessible and work perfectly with touch interaction. The visual feedback is clear and immediate, making it easy to see which pages have been rotated and by how much. The interface is designed to be intuitive on mobile, allowing you to rotate pages quickly and accurately.
                </p>
                <p>
                  <strong>Performance on Mobile</strong><br />
                  Rotation speed is the same on mobile as on desktop since all processing happens on our servers. Your device's performance doesn't affect rotation speed. However, upload and download speeds will depend on your mobile internet connection. On Wi-Fi, the experience is typically very fast, while cellular connections may be slower depending on signal strength and data speeds. The rotation process itself is server-side, so even older mobile devices can rotate large PDFs efficiently.
                </p>
              </div>
            </section>

            <section id="cost" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">12. Is rotating PDFs free?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, rotating PDFs with BlendPDF is completely free — no fees, no watermarks, and no premium tiers today. We believe that basic PDF tools should be accessible to everyone, which is why we offer our rotation service at no charge.
                </p>
                <p>
                  <strong>No Payment Required</strong><br />
                  There are no credit card requirements, no trial periods that convert to paid subscriptions, and no "freemium" limitations that force you to upgrade. You can rotate as many PDFs as you want, as often as you want, without ever being asked for payment. This makes BlendPDF accessible to students, small businesses, individuals, and organizations of all sizes, regardless of budget constraints.
                </p>
                <p>
                  <strong>Full Feature Access</strong><br />
                  The free service includes all features: global and individual page rotation, rotation in 90-degree increments, support for files up to 50MB, RTL language support, and automatic file deletion. There are no feature restrictions or usage limits. Every user gets the same full-featured experience, regardless of how many times they use the service or how many pages they rotate.
                </p>
                <p>
                  <strong>No Account Required</strong><br />
                  The free service doesn't require you to create an account or provide any personal information. You can start rotating PDFs immediately without signing up, providing an email address, or going through any registration process. This instant access makes BlendPDF convenient for one-time users and regular users alike, eliminating barriers to use.
                </p>
                <p>
                  <strong>Sustainable Model</strong><br />
                  We're able to offer free PDF rotation through efficient server infrastructure and a focus on core functionality. By keeping our service simple and focused, we can provide it free while maintaining high quality and reliability. Our goal is to be the best free PDF rotation tool available, and we're committed to keeping it free for all users, ensuring that page orientation correction is accessible to everyone who needs it.
                </p>
              </div>
            </section>

            <section id="data-privacy" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">13. What happens to my files after rotation?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  BlendPDF is designed with privacy as a core principle. We've implemented strict data handling practices to ensure your files are processed securely and deleted promptly, giving you complete peace of mind about your document privacy.
                </p>
                <p>
                  <strong>Automatic Deletion</strong><br />
                  All uploaded files are automatically deleted from our servers within one hour of upload, and most are removed immediately after processing, regardless of whether rotation was successful or not. This automatic deletion happens without any action required from you. Once deleted, files cannot be recovered, ensuring that your documents don't remain on our systems longer than necessary for processing. This one-hour window provides enough time for rotation and download while minimizing the time your files spend on our servers.
                </p>
                <p>
                  <strong>No Permanent Storage</strong><br />
                  We don't maintain permanent storage of your files. Files exist on our servers only long enough to complete the rotation process and provide you with the download. We don't create backups of your files, and we don't archive them for any purpose. This means your documents are truly temporary on our systems, existing only for the brief time needed to process them. There's no risk of your files being stored indefinitely or accessed later.
                </p>
                <p>
                  <strong>No Access or Viewing</strong><br />
                  Our systems are designed to process files automatically without human access. No one at BlendPDF views, reads, or analyzes the content of your PDFs. The rotation is entirely automated, ensuring that your document contents remain completely private. We don't extract or store any text, images, or metadata from your files beyond what's necessary for the rotation operation. Your documents are processed as data, not as readable content.
                </p>
                <p>
                  <strong>Secure Processing Environment</strong><br />
                  Files are processed in secure, isolated environments with restricted access. Our servers use industry-standard security measures including encryption at rest and in transit. Even during the brief time files are on our servers, they're protected by multiple layers of security. This comprehensive approach ensures your documents are safe throughout their entire lifecycle on our platform, from upload through rotation to automatic deletion.
                </p>
              </div>
            </section>

            <section id="undo-rotation" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">14. Can I undo a rotation?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  Yes, you can undo rotations before applying them, and you can always rotate pages back to their original orientation. BlendPDF provides several ways to correct or reverse rotations.
                </p>
                <p>
                  <strong>Before Applying Rotations</strong><br />
                  Before you click "Apply Rotation & Download", you can easily undo any rotations you've made. Simply click the rotation button again on a page to rotate it back. Since rotation works in 90-degree increments, rotating a page four times brings it back to its original orientation (0°). You can also use the "Reset" button if available, which clears all rotations and returns all pages to their original state. This gives you complete freedom to experiment with rotations and correct mistakes before finalizing.
                </p>
                <p>
                  <strong>After Downloading</strong><br />
                  Once you've downloaded a rotated PDF, you can always upload it again and rotate it back. For example, if you rotated a page 90° clockwise and want to undo it, you can upload the rotated PDF and rotate that page 90° counterclockwise (or 270° clockwise) to bring it back to the original orientation. This works because rotation is cumulative - rotating in the opposite direction cancels out the previous rotation.
                </p>
                <p>
                  <strong>Rotation Indicators</strong><br />
                  The rotation indicators on each thumbnail help you track rotations and make it easy to undo them. If a page shows it's been rotated 90°, you know you need to rotate it three more times (or once in the opposite direction) to return it to 0°. The visual feedback makes it clear what rotations have been applied, helping you reverse them accurately if needed.
                </p>
                <p>
                  <strong>Best Practice</strong><br />
                  The best practice is to review your rotations carefully before applying them. The thumbnail previews show you exactly how pages will look after rotation, so you can verify everything is correct before downloading. If you notice a mistake, simply rotate the page again to correct it. This approach is faster than downloading, realizing there's an error, and having to upload and rotate again.
                </p>
              </div>
            </section>

            <section id="technical-support" className="scroll-mt-20">
              <h2 className="mb-4 text-3xl font-bold text-gray-900">15. What if rotation fails or produces errors?</h2>
              <div className="prose prose-lg max-w-none text-gray-700">
                <p>
                  While BlendPDF is designed to be reliable and handle a wide variety of PDF files, occasional errors can occur. Understanding common issues and how to resolve them helps ensure a smooth rotation experience.
                </p>
                <p>
                  <strong>Common Error Types</strong><br />
                  The most common errors include file size limits being exceeded, corrupted PDF files that can't be processed, unsupported file formats (non-PDF files), or network issues during upload or download. Our system provides clear error messages that explain what went wrong, making it easier to identify and fix the issue. These error messages are designed to be helpful and actionable, guiding you toward a solution.
                </p>
                <p>
                  <strong>File Size Issues</strong><br />
                  If you receive an error about file size, check that your file is under 50MB. If your file is too large, consider compressing it first using our PDF compression tool, then rotating the compressed version. Alternatively, you can split large documents into smaller sections first, rotate each section, then merge them back together if needed. The error message will clearly indicate if file size is the issue and provide guidance on how to proceed.
                </p>
                <p>
                  <strong>Corrupted Files</strong><br />
                  If a PDF file is corrupted or damaged, it may not rotate successfully. Try opening the file in a PDF viewer first to verify it's not corrupted. If the file opens correctly but still fails to rotate, try saving it again from your PDF viewer, which can sometimes repair minor corruption issues. Some PDFs may have internal structure problems that prevent rotation, and in these cases, recreating the PDF or using a PDF repair tool may be necessary.
                </p>
                <p>
                  <strong>Getting Help</strong><br />
                  If you continue to experience errors, try refreshing the page and attempting to rotate again. Sometimes temporary server issues or network problems can cause errors that resolve on retry. If problems persist, the error message will provide specific information about what went wrong, which can help you troubleshoot the issue. Our system is continuously monitored and improved to minimize errors and provide the best possible user experience. Most rotation operations complete successfully on the first attempt, but retrying is often effective for resolving temporary issues.
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

