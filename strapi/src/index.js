'use strict';

const SAMPLE_ARTICLES = [
  {
    en: {
      title: 'How to Merge PDF Files Online for Free',
      slug: 'how-to-merge-pdf-files-online',
      excerpt: 'Learn how to combine multiple PDF documents into one file in seconds. No sign-up required, works in your browser.',
      content: `
        <p>Merging PDF files is one of the most common tasks when working with documents. Whether you're combining reports, merging scanned pages, or creating a single document from multiple sources, our free online tool makes it simple.</p>
        <h2>Step 1: Upload Your PDFs</h2>
        <p>Drag and drop your PDF files onto the upload area, or click to browse. You can add as many files as you need. The tool supports files up to 50MB each.</p>
        <h2>Step 2: Arrange the Order</h2>
        <p>Use the drag-and-drop interface to reorder your pages. You can also delete unwanted pages before merging.</p>
        <h2>Step 3: Download</h2>
        <p>Click the merge button and your combined PDF will be ready in seconds. Your files are automatically deleted after 1 hour for privacy.</p>
      `,
      metaTitle: 'How to Merge PDF Files Online | BlendPDF',
      metaDescription: 'Free guide to merging PDF files online. Combine multiple PDFs into one document in seconds. No sign-up required.',
      readingTime: 3,
    },
    ar: {
      title: 'كيفية دمج ملفات PDF عبر الإنترنت مجاناً',
      slug: 'how-to-merge-pdf-files-online-ar',
      excerpt: 'تعلم كيفية دمج عدة ملفات PDF في ملف واحد خلال ثوانٍ. بدون تسجيل، يعمل في متصفحك.',
      content: `
        <p>دمج ملفات PDF من المهام الأكثر شيوعاً عند العمل مع المستندات. سواء كنت تجمع التقارير أو تدمج الصفحات الممسوحة ضوئياً، أداتنا المجانية تجعل الأمر بسيطاً.</p>
        <h2>الخطوة 1: ارفع ملفاتك</h2>
        <p>اسحب وأفلت ملفات PDF على منطقة الرفع، أو انقر للتصفح. يمكنك إضافة عدد الملفات الذي تحتاجه.</p>
        <h2>الخطوة 2: رتب الترتيب</h2>
        <p>استخدم واجهة السحب والإفلات لإعادة ترتيب الصفحات.</p>
        <h2>الخطوة 3: التحميل</h2>
        <p>انقر على زر الدمج وستكون ملفاتك جاهزة خلال ثوانٍ.</p>
      `,
      metaTitle: 'كيفية دمج ملفات PDF | BlendPDF',
      metaDescription: 'دليل مجاني لدمج ملفات PDF عبر الإنترنت. دمج عدة ملفات في مستند واحد خلال ثوانٍ.',
      readingTime: 3,
    },
  },
  {
    en: {
      title: 'Compress PDF: Reduce File Size Without Losing Quality',
      slug: 'compress-pdf-reduce-file-size',
      excerpt: 'Discover how to shrink your PDF file size by up to 90% while keeping text and images readable. Perfect for email attachments.',
      content: `
        <p>Large PDF files can be frustrating—they're slow to upload, difficult to email, and take up storage space. Our compression tool reduces file size dramatically while preserving quality.</p>
        <h2>Why Compress PDFs?</h2>
        <p>Compressed PDFs load faster, send quicker, and save storage. Ideal for sharing via email or cloud storage where size limits apply.</p>
        <h2>How It Works</h2>
        <p>Our smart compression analyzes your PDF and optimizes images and embedded fonts. Most documents see 50–90% size reduction with minimal visual impact.</p>
      `,
      metaTitle: 'Compress PDF Online | BlendPDF',
      metaDescription: 'Reduce PDF file size by up to 90%. Free online compression with no quality loss. No sign-up required.',
      readingTime: 4,
    },
    ar: {
      title: 'ضغط PDF: تقليل حجم الملف دون فقدان الجودة',
      slug: 'compress-pdf-reduce-file-size-ar',
      excerpt: 'اكتشف كيفية تقليص حجم ملف PDF بنسبة تصل إلى 90% مع الحفاظ على وضوح النص والصور.',
      content: `
        <p>ملفات PDF الكبيرة قد تكون مزعجة—بطيئة في الرفع وصعبة الإرسال. أداة الضغط لدينا تقلل الحجم بشكل كبير مع الحفاظ على الجودة.</p>
        <h2>لماذا ضغط ملفات PDF؟</h2>
        <p>الملفات المضغوطة تُحمّل أسرع وتُرسل بسرعة وتوفر مساحة التخزين.</p>
      `,
      metaTitle: 'ضغط PDF عبر الإنترنت | BlendPDF',
      metaDescription: 'تقليل حجم ملف PDF بنسبة تصل إلى 90%. ضغط مجاني عبر الإنترنت.',
      readingTime: 3,
    },
  },
  {
    en: {
      title: 'Convert PDF to Word: Edit Your Documents Easily',
      slug: 'convert-pdf-to-word',
      excerpt: 'Transform PDF documents into editable Word files. Preserve formatting, tables, and layout for easy editing.',
      content: `
        <p>Need to edit a PDF? Converting to Word (DOCX) is the easiest way. Our tool maintains your document's structure so you can make changes without starting from scratch.</p>
        <h2>When to Use PDF to Word</h2>
        <p>Use this conversion when you need to edit text, update tables, or repurpose content. Perfect for contracts, reports, and forms.</p>
      `,
      metaTitle: 'PDF to Word Converter | BlendPDF',
      metaDescription: 'Convert PDF to Word (DOCX) online for free. Edit your documents with preserved formatting.',
      readingTime: 2,
    },
    ar: {
      title: 'تحويل PDF إلى Word: تحرير المستندات بسهولة',
      slug: 'convert-pdf-to-word-ar',
      excerpt: 'حوّل مستندات PDF إلى ملفات Word قابلة للتحرير. احتفظ بالتنسيق والجداول والتخطيط.',
      content: `
        <p>تحتاج لتحرير ملف PDF؟ التحويل إلى Word هو أسهل طريقة. أداتنا تحافظ على هيكل المستند.</p>
      `,
      metaTitle: 'تحويل PDF إلى Word | BlendPDF',
      metaDescription: 'تحويل PDF إلى Word مجاناً عبر الإنترنت. تحرير المستندات مع الحفاظ على التنسيق.',
      readingTime: 2,
    },
  },
  {
    en: {
      title: 'Split PDF: Extract Pages You Need',
      slug: 'split-pdf-extract-pages',
      excerpt: 'Extract specific pages from a PDF or split one document into multiple files. Quick and free.',
      content: `
        <p>Sometimes you only need a few pages from a large document. Our split tool lets you select exactly which pages to keep and create a new PDF with just those pages.</p>
        <h2>Use Cases</h2>
        <p>Extract a single chapter, split a scanned document into individual pages, or create separate files from a combined report.</p>
      `,
      metaTitle: 'Split PDF Online | BlendPDF',
      metaDescription: 'Extract pages from PDF or split into multiple files. Free online tool, no sign-up.',
      readingTime: 2,
    },
    ar: {
      title: 'تقسيم PDF: استخراج الصفحات التي تحتاجها',
      slug: 'split-pdf-extract-pages-ar',
      excerpt: 'استخرج صفحات محددة من ملف PDF أو قسّم ملفاً واحداً إلى عدة ملفات.',
      content: `
        <p>أحياناً تحتاج فقط لبعض الصفحات من مستند كبير. أداة التقسيم لدينا تتيح لك اختيار الصفحات بدقة.</p>
      `,
      metaTitle: 'تقسيم PDF عبر الإنترنت | BlendPDF',
      metaDescription: 'استخراج صفحات من PDF أو تقسيم إلى ملفات متعددة. أداة مجانية.',
      readingTime: 2,
    },
  },
];

async function ensureArticlePermissions(strapi) {
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: { type: 'public' },
    populate: ['permissions'],
  });
  if (!publicRole) return;

  const actions = ['api::article.article.find', 'api::article.article.findOne'];
  const existingActions = (publicRole.permissions || []).map((p) => p.action);
  const toCreate = actions.filter((a) => !existingActions.includes(a));

  for (const action of toCreate) {
    await strapi.query('plugin::users-permissions.permission').create({
      data: { action, role: publicRole.id },
    });
  }
}

async function seedArticles(strapi) {
  await ensureArticlePermissions(strapi);

  const existing = await strapi.entityService.findMany('api::article.article', {
    locale: 'en',
    limit: 1,
  });
  if (existing && existing.length > 0) {
    return; // Already seeded
  }

  const now = new Date().toISOString();
  for (const article of SAMPLE_ARTICLES) {
    // Create EN version (published) - default locale
    await strapi.entityService.create('api::article.article', {
      data: {
        title: article.en.title,
        slug: article.en.slug,
        excerpt: article.en.excerpt,
        content: article.en.content.trim(),
        metaTitle: article.en.metaTitle,
        metaDescription: article.en.metaDescription,
        readingTime: article.en.readingTime,
        publishedAt: now,
      },
    });
    // AR versions can be added via Strapi admin (Content Manager → Article → Add new locale)
  }
}

module.exports = {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }) {
    try {
      await seedArticles(strapi);
    } catch (err) {
      console.error('[SEED] Failed to seed articles:', err.message);
    }
  },
};
