/**
 * /blendpdf-vs-pdf24: the same Arabic line added in PDF24's editor and in
 * Edit PDF on 12 November 2026 (PDF24 saved it as a 576×99 px picture), plus
 * PDF24's own pages read that day. PDF24 matches us on price, account,
 * watermark and deletion, and the page says so.
 */
import { CHROME } from './chrome';
import type { Comparison } from './types';

export const pdf24: Comparison = {
  slug: 'pdf24',
  path: '/blendpdf-vs-pdf24',
  name: 'PDF24',
  howTo: 'add',
  // Its saved line looks right: a render shows nothing, the difference is that it's a picture
  shots: [],
  quotes: [
    { text: 'The best way to do this is to convert a PDF to Word format', lang: 'en', source: 'https://tools.pdf24.org/en/edit-pdf' },
    { text: 'The PDF24 Online Tools process files on special PDF24 servers.', lang: 'en', source: 'https://tools.pdf24.org/en/' },
  ],
  text: {
    en: {
      metaTitle: 'PDF24 Alternative for Arabic PDFs: Real, Searchable Text | BlendPDF',
      description:
        'We added the same Arabic line in PDF24 and in BlendPDF. PDF24 saved it as a picture, so it can’t be searched or copied. BlendPDF saved real text.',
      title: 'A PDF24 alternative for Arabic PDFs',
      tested: 'Tested 12 November 2026',
      summary:
        'PDF24 is free like BlendPDF. But in our test its editor saved an added Arabic line as a picture, so you can’t search or copy the words. Its editor also doesn’t change existing text. In BlendPDF, **Text** saves Arabic as real text and **Edit existing text** (beta) changes a line, in your browser.',
      cta: 'Edit an Arabic PDF',
      quotes: {
        title: 'What PDF24 says on its own pages',
        intro: 'About changing text, and about where files go:',
        after: 'In BlendPDF, **Edit existing text** (beta) changes a line in place, and **Edit PDF** runs in your browser.',
      },
      table: {
        title: 'Side by side',
        head: ['What we checked', 'BlendPDF', 'PDF24'],
        rows: [
          {
            label: 'Adding an Arabic line',
            blendpdf: 'Saved as text: you can search, select and copy it.',
            them: 'Saved as a picture (576 × 99 pixels). It looks right, but you can’t search, select or copy the words.',
          },
          { label: 'Changing existing text', blendpdf: 'In place, one line at a time (beta).', them: 'Not in its editor: its page suggests converting to Word.' },
          {
            label: 'Where your file goes',
            blendpdf: 'Edit PDF runs in your browser, and so do Extract Pages, Crop PDF, Flatten PDF, Remove Metadata, PDF to Text and Extract Images.',
            them: 'Its online tools process files on PDF24 servers and delete them within an hour.',
          },
          { label: 'Price, account, watermark', blendpdf: 'Free, no account, no watermark.', them: 'Free, no account, no watermark.' },
        ],
        note: 'Tested 12 November 2026, with PDF24’s pages read the same day. PDF24 may have changed since, so check tools.pdf24.org.',
      },
      strengths: {
        title: 'Where PDF24 matches or beats BlendPDF',
        items: [
          'It’s free for everyone, with no account and no watermark, like BlendPDF. Its site says: “There are no artificial limits at PDF24.”',
          'It deletes files within an hour of processing, the same window as ours.',
          'It takes much bigger files: up to 1,000 MB per file when merging, against 50 MB at BlendPDF.',
          'Its site and its OCR work in Arabic too.',
        ],
      },
      faq: [
        {
          question: 'Does PDF24 save Arabic text properly?',
          answer:
            'It looks right, but in our test on 12 November 2026 PDF24’s editor saved the added Arabic line as a picture (576 × 99 pixels), not as text. You can see it, but you can’t search, select or copy the words. BlendPDF saves them as real text.',
        },
        {
          question: 'Can PDF24 change existing text?',
          answer:
            'Not in its online editor. Its Edit PDF page says “The best way to do this is to convert a PDF to Word format” (read on 12 November 2026). BlendPDF changes an existing line in place, one line at a time (beta).',
        },
        {
          question: 'Is PDF24 free?',
          answer: 'Yes. Its site says it’s free for everyone, with no registration and no watermark, like BlendPDF.',
        },
        CHROME.en.faq.upload,
        CHROME.en.faq.realText,
      ],
      disclaimer:
        'PDF24 is a trademark of its owner. BlendPDF isn’t affiliated with PDF24. We ran this test ourselves on 12 November 2026 on tools.pdf24.org, without an account, and quote its pages as they read that day. PDF24 may have changed since, so check tools.pdf24.org for its current features and limits.',
      breadcrumb: 'BlendPDF vs PDF24',
      card: 'Free like us, but its editor saved our added Arabic line as a picture, and its online editor doesn’t change existing text.',
    },

    fr: {
      metaTitle: 'Alternative à PDF24 pour les PDF en arabe : notre test | BlendPDF',
      description:
        'Nous avons ajouté la même ligne en arabe avec PDF24 et avec BlendPDF. PDF24 l’a enregistrée sous forme d’image, impossible à rechercher ; BlendPDF, en vrai texte.',
      title: 'Une alternative à PDF24 pour les PDF en arabe',
      tested: 'Testé le 12 novembre 2026',
      summary:
        'PDF24 est gratuit comme BlendPDF, mais lors de notre test, son éditeur a enregistré une ligne arabe ajoutée sous forme d’image : impossible d’en rechercher ou d’en copier les mots. Son éditeur ne modifie pas non plus le texte existant. Avec BlendPDF, **Texte** enregistre l’arabe comme du vrai texte et **Modifier le texte** (bêta) change une ligne, dans votre navigateur.',
      cta: 'Modifier un PDF en arabe',
      quotes: {
        title: 'Ce que dit PDF24 sur ses propres pages',
        intro: 'Sur la modification du texte, et sur l’endroit où les fichiers sont traités :',
        glosses: [
          'Traduction : « La meilleure façon de procéder est de convertir un PDF au format Word. »',
          'Traduction : « Les outils en ligne de PDF24 traitent les fichiers sur des serveurs PDF24 dédiés. »',
        ],
        after: 'Chez BlendPDF, **Modifier le texte** (bêta) change une ligne directement dans la page, et **Modifier un PDF** fonctionne dans votre navigateur.',
      },
      table: {
        title: 'Côte à côte',
        head: ['Ce que nous avons vérifié', 'BlendPDF', 'PDF24'],
        rows: [
          {
            label: 'Ajouter une ligne en arabe',
            blendpdf: 'Enregistrée comme du texte : vous pouvez la rechercher, la sélectionner et la copier.',
            them: 'Enregistrée comme une image (576 × 99 pixels). Elle a l’air correcte, mais on ne peut ni rechercher, ni sélectionner, ni copier ses mots.',
          },
          { label: 'Modifier le texte existant', blendpdf: 'Directement dans la page, une ligne à la fois (bêta).', them: 'Pas dans son éditeur : sa page conseille de passer par Word.' },
          {
            label: 'Où va votre fichier',
            blendpdf:
              'Modifier un PDF fonctionne dans votre navigateur, tout comme Extraire des pages, Recadrer un PDF, Aplatir un PDF, Supprimer les métadonnées, PDF en texte et Extraire les images.',
            them: 'Ses outils en ligne traitent les fichiers sur les serveurs de PDF24 et les suppriment dans l’heure.',
          },
          { label: 'Prix, compte, filigrane', blendpdf: 'Gratuit, sans compte, sans filigrane.', them: 'Gratuit, sans compte, sans filigrane.' },
        ],
        note: 'Testé le 12 novembre 2026, pages de PDF24 consultées le même jour. PDF24 a pu changer depuis : vérifiez sur tools.pdf24.org.',
      },
      strengths: {
        title: 'Là où PDF24 égale ou dépasse BlendPDF',
        items: [
          'Il est gratuit pour tous, sans compte ni filigrane, comme BlendPDF. Son site indique : « There are no artificial limits at PDF24. »',
          'Il supprime les fichiers dans l’heure qui suit le traitement, comme nous.',
          'Il accepte des fichiers bien plus lourds : jusqu’à 1 000 Mo par fichier pour la fusion, contre 50 Mo chez BlendPDF.',
          'Son site et son OCR fonctionnent aussi en arabe.',
        ],
      },
      faq: [
        {
          question: 'PDF24 enregistre-t-il correctement le texte arabe ?',
          answer:
            'Il en a l’air, mais lors de notre test du 12 novembre 2026, l’éditeur de PDF24 a enregistré la ligne arabe ajoutée sous forme d’image (576 × 99 pixels), et non de texte. On la voit, mais on ne peut ni la rechercher, ni la sélectionner, ni la copier. BlendPDF l’enregistre comme du vrai texte.',
        },
        {
          question: 'PDF24 peut-il modifier le texte existant ?',
          answer:
            'Pas dans son éditeur en ligne. Sa page Edit PDF indique « The best way to do this is to convert a PDF to Word format » (consultée le 12 novembre 2026). BlendPDF modifie une ligne existante directement dans la page, une ligne à la fois (bêta).',
        },
        {
          question: 'PDF24 est-il gratuit ?',
          answer: 'Oui. Son site indique qu’il est gratuit pour tous, sans inscription ni filigrane, comme BlendPDF.',
        },
        CHROME.fr.faq.upload,
        CHROME.fr.faq.realText,
      ],
      disclaimer:
        'PDF24 est une marque de son propriétaire. BlendPDF n’a aucun lien avec PDF24. Nous avons fait ce test nous-mêmes le 12 novembre 2026 sur tools.pdf24.org, sans compte, et nous citons ses pages telles qu’elles étaient ce jour-là. PDF24 a pu évoluer depuis : consultez tools.pdf24.org pour connaître ses fonctions et ses limites actuelles.',
      breadcrumb: 'BlendPDF face à PDF24',
      card: 'Gratuit comme nous, mais son éditeur a enregistré notre ligne arabe ajoutée sous forme d’image, et son éditeur en ligne ne modifie pas le texte existant.',
    },

    ar: {
      metaTitle: 'بديل PDF24 لملفات PDF العربية: نص حقيقي يمكن البحث فيه | BlendPDF',
      description:
        'أضفنا السطر العربي نفسه في PDF24 وفي BlendPDF: حفظه PDF24 صورةً لا يمكن البحث فيها ولا نسخها، وحفظه BlendPDF نصًا حقيقيًا.',
      title: 'بديل PDF24 لملفات PDF العربية',
      tested: 'تاريخ الاختبار: 12 نوفمبر 2026',
      summary:
        'PDF24 مجاني مثل BlendPDF، لكن محرره في تجربتنا حفظ السطر العربي المضاف صورةً، فلا يمكن البحث في كلماته ولا نسخها، كما أن محرره لا يغيّر النص الموجود. أما في BlendPDF فأداة **نص** تحفظ العربية نصًا حقيقيًا، وأداة **تعديل النص الموجود** (ميزة تجريبية) تغيّر السطر، وكل ذلك في متصفحك.',
      cta: 'عدّل ملف PDF',
      quotes: {
        title: 'ما يقوله PDF24 في صفحاته',
        intro: 'عن تغيير النص، وعن مكان معالجة الملفات:',
        glosses: [
          'ترجمتها: «أفضل طريقة لذلك هي تحويل ملف PDF إلى صيغة Word».',
          'ترجمتها: «أدوات PDF24 على الإنترنت تعالج الملفات على خوادم مخصّصة لدى PDF24».',
        ],
        after: 'أما في BlendPDF فأداة **تعديل النص الموجود** (ميزة تجريبية) تغيّر السطر في مكانه، و**تعديل PDF** يعمل في متصفحك.',
      },
      table: {
        title: 'مقارنة سريعة',
        head: ['ما قارنّاه', 'BlendPDF', 'PDF24'],
        rows: [
          {
            label: 'إضافة سطر عربي',
            blendpdf: 'يُحفظ نصًا: يمكنك البحث فيه وتحديده ونسخه.',
            them: 'حُفظ صورةً (576 × 99 بكسل): يبدو سليمًا، لكن لا يمكن البحث في كلماته ولا تحديدها ولا نسخها.',
          },
          { label: 'تغيير النص الموجود', blendpdf: 'في مكانه، سطرًا سطرًا (ميزة تجريبية).', them: 'ليس في محرره، وصفحته تنصح بالتحويل إلى Word.' },
          {
            label: 'أين يذهب ملفك',
            blendpdf: '«تعديل PDF» يعمل في متصفحك، وكذلك «استخراج الصفحات» و«قص PDF» و«تسطيح PDF» و«إزالة البيانات الوصفية» و«PDF إلى نص» و«استخراج الصور».',
            them: 'أدواته على الإنترنت تعالج الملفات على خوادم PDF24 وتحذفها خلال ساعة.',
          },
          { label: 'السعر والحساب والعلامة المائية', blendpdf: 'مجاني، بلا حساب ولا علامة مائية.', them: 'مجاني، بلا حساب ولا علامة مائية.' },
        ],
        note: 'أجرينا الاختبار وقرأنا صفحات PDF24 في 12 نوفمبر 2026، وقد يكون تغيّر بعد ذلك، فراجع موقعه tools.pdf24.org.',
      },
      strengths: {
        title: 'ما يُحسنه PDF24 مثلنا أو أفضل منّا',
        items: [
          'مجاني للجميع، بلا حساب ولا علامة مائية، مثل BlendPDF، ويقول موقعه إنه لا يضع حدودًا مصطنعة على الاستخدام.',
          'يحذف الملفات خلال ساعة من معالجتها، مثلنا تمامًا.',
          'يقبل ملفات أكبر بكثير: حتى 1000 ميجابايت للملف الواحد في الدمج، مقابل 50 ميجابايت في BlendPDF.',
          'موقعه وأداة التعرف الضوئي فيه يدعمان العربية أيضًا.',
        ],
      },
      faq: [
        {
          question: 'هل يحفظ PDF24 النص العربي كما يجب؟',
          answer:
            'في الظاهر نعم، لكن في تجربتنا في 12 نوفمبر 2026 حفظ محرر PDF24 السطر العربي المضاف صورةً (576 × 99 بكسل) لا نصًا. تراه بعينك، لكنك لا تستطيع البحث فيه ولا تحديده ولا نسخه. أما BlendPDF فيحفظه نصًا حقيقيًا.',
        },
        {
          question: 'هل يغيّر PDF24 النص الموجود؟',
          answer:
            'ليس في محرره على الإنترنت، إذ تنصح صفحة Edit PDF لديه بتحويل الملف إلى Word لتغيير النص (قرأناها في 12 نوفمبر 2026). أما BlendPDF فيغيّر السطر الموجود في مكانه، سطرًا سطرًا (ميزة تجريبية).',
        },
        {
          question: 'هل PDF24 مجاني؟',
          answer: 'نعم، مثل BlendPDF. يقول موقعه إنه مجاني للجميع، بلا تسجيل ولا علامة مائية.',
        },
        CHROME.ar.faq.upload,
        CHROME.ar.faq.realText,
      ],
      disclaimer:
        'اسم PDF24 علامة تجارية لمالكها، ولا صلة بين BlendPDF وPDF24. أجرينا هذا الاختبار بأنفسنا في 12 نوفمبر 2026 على موقع tools.pdf24.org دون حساب، وننقل عن صفحاته ما كانت تقوله ذلك اليوم. وقد يكون تغيّر بعد ذلك، فراجع موقعه لمعرفة ميزاته وحدوده الحالية.',
      breadcrumb: 'BlendPDF مقابل PDF24',
      card: 'مجاني مثلنا، لكن محرره حفظ سطرنا العربي المضاف صورةً، ومحرره على الإنترنت لا يغيّر النص الموجود.',
    },
  },
};
