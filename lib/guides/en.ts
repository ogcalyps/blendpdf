import type { GuideChrome, GuideContent, GuideSlug } from './types';

export const chrome: GuideChrome = {
  guides: 'Guides',
  hubTitle: 'BlendPDF guides',
  hubMetaTitle: 'How to use BlendPDF: step-by-step guides with screenshots | BlendPDF',
  hubDescription:
    'Step-by-step guides with screenshots: add a letterhead, sign and stamp, make a PDF smaller than a size limit, merge and split pages, and change text in a PDF.',
  hubIntro:
    'Short, practical guides for the things people do most with a PDF. Each one shows the real screens, in the order you will see them.',
  home: 'Home',
  steps: 'Steps',
  goodToKnow: 'Good to know',
  moreGuides: 'More guides',
  minutes: (n) => `${n} min`,
  updated: 'Updated November 2026',
};

export const guides: Record<GuideSlug, GuideContent> = {
  'how-blendpdf-works': {
    title: 'How BlendPDF works: open a PDF once, use every tool',
    metaTitle: 'How to use BlendPDF: one file, every PDF tool | BlendPDF',
    description:
      'A quick tour of BlendPDF: open a PDF once, then edit, sign, organize pages, compress or convert it without opening it again. With screenshots.',
    summary:
      'Open your PDF once. Every tool then works on that same file: add text or a signature, move pages around, make it smaller or turn it into Word. Nothing changes in your file until you press Save.',
    steps: [
      {
        title: 'Drop your file on the home page',
        text: 'Drag a PDF onto **Drop a PDF to start**, or click anywhere in the box to pick one. Word, PowerPoint, Excel files and pictures work too: they open in the tool that turns them into a PDF.',
        shot: 1,
        alt: 'The box on the home page where you drop a PDF to start',
      },
      {
        title: 'Find your way around the toolbar',
        text: 'The first row works on the page in front of you: **Text**, **Edit existing text**, **Draw**, **Shapes**, **Highlight**, **Hide (white box)**, **Crop** and **Insert** (a picture, your signature, the date, a watermark, page numbers, a letterhead or another PDF). The second row works on the whole file: **Merge**, **Split**, **Rotate**, **Delete pages**, **Sign**, **Watermark**, **Page numbers**, **Compress**, **Convert** and **Protect**.',
        shot: 2,
        alt: 'A letter open in BlendPDF, with the two rows of tools above it and the pages on the left',
      },
      {
        title: 'Not sure where something is? Open All tools',
        text: '**All tools** lists everything BlendPDF can do with this file, grouped by what you want to do: change pages, add to pages, change the existing text, get a different file, or fix the file. Pick one and it opens right here, on the same file.',
        shot: 3,
        alt: 'The All tools panel, listing every tool in groups',
      },
      {
        title: 'Save, and choose what you get',
        text: '**Save PDF** gives you the PDF with every change. **Options** shows every choice: a Word, Excel, picture or text file instead, only some pages, one file per page, a smaller file, a password. The bottom of the window always says what you will get before you download it.',
        shot: 4,
        alt: 'The Save your file window: PDF, Word, Excel, Images, Text or Pictures inside, which pages and how many files',
      },
    ],
    tips: [
      {
        title: 'Changes wait until you save',
        text: 'Undo and Redo work across every tool, and you can save as many times as you like while you keep working.',
      },
      {
        title: 'Where your file goes',
        text: 'Editing, signing and organizing pages happen in your browser: the file stays on your device. A few tools, such as compressing and reading scanned text (OCR), use our server, and those files are deleted within an hour.',
      },
      {
        title: 'On a phone',
        text: 'Everything works on a phone. The page is at the top, and the panel for the tool you picked opens under it.',
      },
    ],
    cta: 'Open a PDF',
  },

  'add-letterhead-to-pdf': {
    title: 'How to add a letterhead to a PDF',
    metaTitle: 'Add a letterhead to a PDF, free: name, logo and footer | BlendPDF',
    description:
      'Put your name, logo and address on every page of a PDF, in Arabic, French or English. Set the letterhead up once, reuse it, and share it with your team.',
    summary:
      'Open the PDF, choose **Insert**, then **Letterhead**, and fill in the top left, the top right, the logo and the bottom of the page. It shows on the page as you type. BlendPDF keeps it on your device, so next time it goes on in one click.',
    steps: [
      {
        title: 'Choose Insert, then Letterhead',
        text: 'Open the letter or report on the Edit PDF page. In the toolbar, click **Insert**, then **Letterhead**. A panel opens beside the page, or under it on a phone.',
        shot: 1,
        alt: 'The Insert menu open, with Letterhead among Image, Signature, Watermark and Page numbers',
      },
      {
        title: 'Fill in both sides, the logo and the bottom line',
        text: 'The first line of each side is your name, written a little larger; the lines under it are your details. Many letterheads have the name in French or English on the left and in Arabic on the right. **Choose a logo** puts your logo in the middle. **Bottom of the page** is for the address, phone, email or registration number.',
        shot: 2,
        alt: 'A letter with a letterhead: the name in French on the left, in Arabic on the right, a logo in the middle and a thin line under it',
      },
      {
        title: 'Choose the pages, then save',
        text: 'Pick **Every page** or **First page only**, then click **Save PDF**. If a page has text where the letterhead goes, BlendPDF moves that page down a little, and makes it smaller only when there is no other way, so nothing is covered.',
        shot: 3,
        alt: 'The end of the letterhead panel: the bottom line, Every page or First page only, and Save as a file',
      },
      {
        title: 'Use it again, or share it with your team',
        text: 'The letterhead stays on this device: the next time you choose **Letterhead**, it goes on by itself. To use it on another computer or give it to a colleague, click **Save as a file** and send them the file; they open it with **Open a letterhead file**.',
      },
    ],
    tips: [
      {
        title: 'Arabic and French on one letterhead',
        text: 'Each side follows its own text direction, so Arabic reads right to left, and it stays real, searchable text in the saved PDF.',
      },
      {
        title: 'A long name',
        text: 'It goes onto a second line instead of getting tiny. Keep the bottom of the page to one line: it reads best.',
      },
      {
        title: 'Turned or cropped pages',
        text: 'On a page you turned or cropped in the editor, the letterhead is drawn in the top margin without moving the page.',
      },
    ],
    cta: 'Add a letterhead',
  },

  'sign-and-stamp-pdf': {
    title: 'How to sign and stamp a PDF',
    metaTitle: 'Sign and stamp a PDF online, free: signature and company stamp | BlendPDF',
    description:
      'Draw, type or upload your signature, add a photo of your stamp without its paper background, and keep both on your device for next time. Free, no account.',
    summary:
      'Open the PDF, choose **Insert**, then **Signature**, and draw, type or upload your signature or stamp. A photo of a stamp loses its paper background, so it sits on the page like ink. Tick **Keep it on this device for next time** and it is one click away next time.',
    steps: [
      {
        title: 'Open the signature window',
        text: 'Open the PDF, scroll to where the signature goes, then choose **Insert** and **Signature** (or **Sign** in the second row). **Draw** it with your mouse or finger, or **Type** your name and pick a handwriting style.',
        shot: 1,
        alt: 'The Add your signature or stamp window, with a name typed in a handwriting style',
      },
      {
        title: 'Add your stamp from a photo or a scan',
        text: 'On **Upload**, choose a photo or scan of your stamp, or of your signature on paper. BlendPDF clears the paper around it, white or the grey of a phone photo, and keeps the colour of the ink. Tick **Keep it on this device for next time** if you will need it again.',
        shot: 2,
        alt: 'A photographed stamp in the Upload tab, its paper background removed, with Keep it on this device ticked',
      },
      {
        title: 'Place it, then move and resize it',
        text: 'Click **Place it on the page**. Drag it where it belongs and pull a corner to resize it. The arrow keys move it one point at a time; with Shift held down, ten.',
        shot: 3,
        alt: 'A blue stamp on a letter, partly over the signature, with the text showing through',
      },
      {
        title: 'Next time: one click',
        text: 'The next time you open the window, what you kept is at the top, under **Saved on this device**. Click it to place it. The small cross removes it from this device, which matters on a shared office computer.',
        shot: 4,
        alt: 'The signature window with a stamp saved on this device, ready to place in one click',
      },
    ],
    tips: [
      {
        title: 'Does it count legally?',
        text: 'A signature placed this way is a simple electronic signature. It suits letters, receipts, certificates and documents for the public. When a document must carry a certified or legalized signature, use a qualified electronic certificate or the usual paper process.',
      },
      {
        title: 'Nothing is kept unless you ask',
        text: '**Keep it on this device for next time** stays off until you tick it. What you keep stays in this browser only and is never sent anywhere.',
      },
      {
        title: 'More than one signature',
        text: 'Place one signature, then the next: each one is its own item on the page, and you can move each one separately.',
      },
    ],
    cta: 'Sign a PDF',
  },

  'compress-pdf-under-size-limit': {
    title: 'How to make a PDF smaller than 2 MB (or any size limit)',
    metaTitle: 'Compress a PDF under 2 MB, 1 MB or any size limit, free | BlendPDF',
    description:
      'Upload forms often refuse files over 1, 2 or 5 MB. Type the limit and BlendPDF finds the best quality that fits. Works on scans and phone photos.',
    summary:
      'Open the PDF on Compress PDF, choose **Under a size limit**, type the limit the form asks for (for example 2) and click **Compress PDF**. BlendPDF tries several settings and keeps the best looking one that fits. If nothing fits, it says how small it could get.',
    steps: [
      {
        title: 'Choose Under a size limit and type the limit',
        text: 'On Compress PDF, pick **Under a size limit** and type the number of megabytes the form allows, for example 1 or 2. Decimals work too: 1.5.',
        shot: 1,
        alt: 'Compress PDF with Under a size limit chosen and 1 MB typed in',
      },
      {
        title: 'Compress, then check the new size',
        text: 'Click **Compress PDF**. A few seconds later you see the new size, for example "229.41 KB now, under your 1 MB limit". Download the file, send it by email, or keep working on it.',
        shot: 2,
        alt: 'Your file is ready: the new size, under the 1 MB limit, and the Download button',
      },
      {
        title: 'If it can’t get under the limit',
        text: 'Scans and photos get much smaller; files that are mostly text, much less. If even the smallest version is over the limit, BlendPDF says so and gives you that smallest version. Remove the pages you don’t need, or split the file into two parts and send them one by one.',
      },
    ],
    tips: [
      {
        title: 'Why 1 MB means 1,000,000 bytes here',
        text: 'Upload forms count a megabyte in two different ways. BlendPDF uses the smaller one, so the file passes either way.',
      },
      {
        title: 'Text stays sharp',
        text: 'Only the pictures inside the PDF get lighter. Text stays text: sharp, and searchable.',
      },
      {
        title: 'Already small enough',
        text: 'If the file is already under the limit, BlendPDF leaves it exactly as it is.',
      },
    ],
    cta: 'Compress a PDF',
  },

  'merge-split-reorder-pages': {
    title: 'How to merge, split and reorder PDF pages',
    metaTitle: 'Merge, split, reorder and delete PDF pages, free | BlendPDF',
    description:
      'Join several PDFs into one, split a PDF into several files, and move, turn or delete pages by dragging thumbnails. Free, in your browser, no account.',
    summary:
      'Open your PDF and click **All pages** to see every page: drag a page to move it, and tick pages to turn or delete them. To join files, use Merge PDF or **Add another PDF**. To cut one file into several, use **Split** and choose how.',
    steps: [
      {
        title: 'See every page, then drag to reorder',
        text: 'Click **All pages** above the page. Drag a page to move it. Tick one or more pages, then use **Turn left**, **Turn right** or **Delete selected** to change them all at once.',
        shot: 1,
        alt: 'All pages: a five-page report shown as thumbnails, ready to drag into a new order',
      },
      {
        title: 'Split a PDF into several files',
        text: 'Open the PDF on Split PDF, or click **Split**. Choose one PDF per page, one PDF every few pages, one per range of selected pages, or the selected pages in one PDF. The line under the choices tells you exactly which files you will get.',
        shot: 2,
        alt: 'Split PDF with One PDF per page chosen and the list of files you will get',
      },
      {
        title: 'Merge several PDFs into one',
        text: 'On Merge PDF, drop all your files at once, or open one and click **Add another PDF** for each of the others. Their pages join in a single list: drag them into the order you want, then click **Merge PDFs**.',
        shot: 3,
        alt: 'Merge PDF with two files joined into one list of pages',
      },
    ],
    tips: [
      {
        title: 'How many files',
        text: 'Up to 20 PDFs in one merge, 100 MB in total.',
      },
      {
        title: 'Pages scanned the wrong way up',
        text: 'Turn them in **All pages** before you save; the turn is saved in the file.',
      },
      {
        title: 'Keep only some pages',
        text: 'Tick them, open **Options** and choose **Only the selected pages**.',
      },
    ],
    cta: 'Merge PDFs',
  },

  'edit-pdf-text': {
    title: 'How to add or change text in a PDF',
    metaTitle: 'Add or change text in a PDF, in Arabic or English, free | BlendPDF',
    description:
      'Write anywhere on a PDF in Arabic, French or English, or change a line of the text already there. Step by step, with screenshots. Free, no account.',
    summary:
      'To add words, choose **Text**, click where they go and type. To change a line that is already in the PDF, choose **Edit existing text**, click the line and type the new wording: BlendPDF takes the old line out and writes the new one in the closest font it has.',
    steps: [
      {
        title: 'Add text anywhere',
        text: 'Click **Text**, then click on the page where the words go, and type. Arabic and English both work, even in the same box. Drag the box to move it; its size and colour are in the small bar above it.',
        shot: 1,
        alt: 'A note typed in the top margin of a letter, in a text box',
      },
      {
        title: 'Change a line that is already there',
        text: 'Click **Edit existing text**, then click the line to change. Type the new wording in the box that opens: the page shows the result as you type. When you save, the old line is taken out of the page, not just covered.',
        shot: 2,
        alt: 'Edit existing text: the subject line of a letter being changed, with the new wording shown on the page',
      },
      {
        title: 'Save',
        text: 'Click **Save PDF**. You can keep editing and save again as often as you like.',
      },
    ],
    tips: [
      {
        title: 'A whole paragraph to rewrite',
        text: '**Edit existing text** changes one line at a time. For a bigger rewrite, turn the PDF into Word, edit it there, and save it as a PDF again.',
      },
      {
        title: 'A scanned page',
        text: 'Its words are part of a picture. Put **Hide (white box)** over the old words and **Text** on top, or make the scan searchable with OCR first.',
      },
      {
        title: 'Fonts',
        text: 'When the original font can’t write a letter you typed, BlendPDF uses the closest font it has and tells you.',
      },
    ],
    cta: 'Edit a PDF',
  },
};
