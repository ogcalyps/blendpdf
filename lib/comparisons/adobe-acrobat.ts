/**
 * /blendpdf-vs-adobe-acrobat: Adobe's free online editor, from Adobe's own
 * pages read on 12 November 2026. Not tested hands-on: downloading needs an
 * account, and we don't create accounts for these tests. No prices: Adobe's
 * plans page is geo-priced (it showed dirhams), so the page links to it.
 */
import { CHROME } from './chrome';
import type { Comparison } from './types';

const EDITOR = 'https://www.adobe.com/acrobat/online/pdf-editor.html';
const HELP = 'https://helpx.adobe.com/document-cloud/faq/try-acrobat-online-services.html';

export const adobeAcrobat: Comparison = {
  slug: 'adobe-acrobat',
  path: '/blendpdf-vs-adobe-acrobat',
  name: 'Adobe Acrobat',
  howTo: 'edit',
  checkable: false,
  shots: [],
  quotes: [
    { text: 'does not let you edit existing body text within a PDF', lang: 'en', source: EDITOR },
    { text: 'a free Adobe account is required to download or share your edited files', lang: 'en', source: EDITOR },
    { text: 'most tools let you complete one free transaction and download the resulting file one time', lang: 'en', source: HELP },
  ],
  text: {
    en: {
      metaTitle: 'Adobe Acrobat Alternative: Change PDF Text Free, No Account | BlendPDF',
      description:
        'Adobe’s free online editor doesn’t change existing text and needs an account to download. BlendPDF changes a line for free, with no account, in Arabic too.',
      title: 'An Adobe Acrobat alternative for quick PDF edits',
      tested: 'Checked 12 November 2026',
      summary:
        'By Adobe’s own pages, its free online editor “does not let you edit existing body text”, and you need a free Adobe account to download what you edited. In BlendPDF, **Edit existing text** (beta) changes a line for free, and you download the file without an account.',
      cta: 'Edit a PDF',
      quotes: {
        title: 'What Adobe says on its own pages',
        intro: 'From Adobe’s editor page and its help page on the free online tools:',
        after: 'We didn’t upload a file to Adobe for this page, because downloading needs an account and we don’t create accounts for these tests.',
      },
      table: {
        title: 'Side by side',
        head: ['What we checked', 'BlendPDF', 'Adobe Acrobat online'],
        rows: [
          {
            label: 'Changing existing text, free',
            blendpdf: 'Yes, one line at a time (beta).',
            them: 'Not in the free online editor. Acrobat Pro, which is paid, does it.',
          },
          { label: 'Account to download', blendpdf: 'None.', them: 'A free Adobe account.' },
          { label: 'Free use without an account', blendpdf: 'No daily limit.', them: 'One free transaction and one download on most tools.' },
          { label: 'Where your file goes', blendpdf: 'The editing runs in your browser.', them: 'Uploaded to Adobe cloud storage, by its help page.' },
        ],
        note: 'From Adobe’s pages, read 12 November 2026; its help page on limits was last updated 2 June 2025. We didn’t test Adobe hands-on. Check adobe.com for current plans and prices.',
      },
      strengths: {
        title: 'Where Adobe does well',
        items: [
          'Acrobat Pro, its paid app, edits existing text.',
          'Its free tools take bigger files: 100 MB on most, and Merge combines up to 100 files.',
          'Signed in, filling, signing, sharing and commenting are free.',
        ],
      },
      faq: [
        {
          question: 'Can I edit text in a PDF with Adobe for free?',
          answer:
            'Not existing text in its free online editor. Adobe’s page says it “does not let you edit existing body text within a PDF”, and that needs Acrobat Pro. BlendPDF changes existing text for free, one line at a time (beta).',
        },
        {
          question: 'Do I need an Adobe account?',
          answer:
            'To download or share files from Adobe’s online editor, yes: Adobe says “a free Adobe account is required to download or share your edited files”. BlendPDF never asks for an account.',
        },
        {
          question: 'How many free edits does Adobe allow?',
          answer:
            'Without signing in, Adobe’s help page says most tools allow one free transaction and one download. Signed in, its premium tools allow one free transaction every 30 days. BlendPDF has no daily limit. (Adobe’s page was last updated 2 June 2025; we read it on 12 November 2026.)',
        },
        CHROME.en.faq.upload,
        {
          question: 'Does BlendPDF work in Arabic?',
          answer: 'Yes. The site is in Arabic, French and English, and both Text and Edit existing text write Arabic right to left.',
        },
      ],
      disclaimer:
        'Adobe and Acrobat are trademarks of Adobe. BlendPDF isn’t affiliated with Adobe. We didn’t test Adobe’s editor hands-on: everything about Adobe on this page comes from Adobe’s own pages, read on 12 November 2026. Check adobe.com for its current features, limits and prices.',
      breadcrumb: 'BlendPDF vs Adobe Acrobat',
      card: 'From Adobe’s own pages: its free online editor doesn’t change existing text and needs an account to download.',
    },

    fr: {
      metaTitle: 'Alternative à Adobe Acrobat pour modifier un PDF sans compte | BlendPDF',
      description:
        'L’éditeur en ligne gratuit d’Adobe ne modifie pas le texte existant et exige un compte pour télécharger. BlendPDF change une ligne gratuitement, sans compte, en arabe aussi.',
      title: 'Une alternative à Adobe Acrobat pour modifier rapidement un PDF',
      tested: 'Vérifié le 12 novembre 2026',
      summary:
        'D’après ses propres pages, l’éditeur en ligne gratuit d’Adobe ne permet pas de modifier le corps du texte existant, et il faut un compte Adobe gratuit pour télécharger le fichier modifié. Avec BlendPDF, **Modifier le texte** (bêta) change une ligne gratuitement, et vous téléchargez le fichier sans compte.',
      cta: 'Modifier un PDF',
      quotes: {
        title: 'Ce que dit Adobe sur ses propres pages',
        intro: 'Sur la page de son éditeur et sur sa page d’aide consacrée aux outils en ligne gratuits :',
        glosses: [
          'Traduction : « ne permet pas de modifier le corps du texte existant d’un PDF »',
          'Traduction : « un compte Adobe gratuit est nécessaire pour télécharger ou partager vos fichiers modifiés »',
          'Traduction : « la plupart des outils permettent d’effectuer une opération gratuite et de télécharger le fichier obtenu une fois »',
        ],
        after: 'Nous n’avons pas envoyé de fichier à Adobe pour cette page : le téléchargement exige un compte, et nous n’en créons pas pour ces tests.',
      },
      table: {
        title: 'Côte à côte',
        head: ['Ce que nous avons vérifié', 'BlendPDF', 'Adobe Acrobat en ligne'],
        rows: [
          {
            label: 'Modifier le texte existant, gratuitement',
            blendpdf: 'Oui, une ligne à la fois (bêta).',
            them: 'Pas dans l’éditeur en ligne gratuit. Acrobat Pro, payant, le permet.',
          },
          { label: 'Compte pour télécharger', blendpdf: 'Aucun.', them: 'Un compte Adobe gratuit.' },
          {
            label: 'Utilisation gratuite sans compte',
            blendpdf: 'Pas de limite quotidienne.',
            them: 'Une opération et un téléchargement gratuits sur la plupart des outils.',
          },
          {
            label: 'Où va votre fichier',
            blendpdf: 'La modification se fait dans votre navigateur.',
            them: 'Envoyé dans le stockage cloud d’Adobe, d’après sa page d’aide.',
          },
        ],
        note: 'D’après les pages d’Adobe consultées le 12 novembre 2026 ; sa page d’aide sur les limites a été mise à jour pour la dernière fois le 2 juin 2025. Nous n’avons pas testé Adobe nous-mêmes. Vérifiez les offres et les prix actuels sur adobe.com.',
      },
      strengths: {
        title: 'Les points forts d’Adobe',
        items: [
          'Acrobat Pro, son application payante, modifie le texte existant.',
          'Ses outils gratuits acceptent des fichiers plus lourds : 100 Mo pour la plupart, et la fusion réunit jusqu’à 100 fichiers.',
          'Une fois connecté, vous pouvez remplir, signer, partager et commenter gratuitement.',
        ],
      },
      faq: [
        {
          question: 'Peut-on modifier le texte d’un PDF gratuitement avec Adobe ?',
          answer:
            'Pas le texte existant dans son éditeur en ligne gratuit : la page d’Adobe indique qu’il « does not let you edit existing body text within a PDF », et il faut Acrobat Pro pour cela. BlendPDF modifie le texte existant gratuitement, une ligne à la fois (bêta).',
        },
        {
          question: 'Faut-il un compte Adobe ?',
          answer:
            'Pour télécharger ou partager un fichier depuis l’éditeur en ligne d’Adobe, oui : Adobe indique qu’un compte gratuit est nécessaire. BlendPDF ne demande jamais de compte.',
        },
        {
          question: 'Combien de modifications gratuites Adobe permet-il ?',
          answer:
            'Sans connexion, la plupart des outils permettent une opération gratuite et un téléchargement, d’après la page d’aide d’Adobe. Si vous êtes connecté, ses outils premium permettent une opération gratuite tous les 30 jours. BlendPDF n’a pas de limite quotidienne. (La page d’Adobe a été mise à jour pour la dernière fois le 2 juin 2025 ; nous l’avons consultée le 12 novembre 2026.)',
        },
        CHROME.fr.faq.upload,
        {
          question: 'BlendPDF fonctionne-t-il en arabe ?',
          answer: 'Oui. Le site existe en arabe, en français et en anglais, et « Texte » comme « Modifier le texte » écrivent l’arabe de droite à gauche.',
        },
      ],
      disclaimer:
        'Adobe et Acrobat sont des marques d’Adobe. BlendPDF n’a aucun lien avec Adobe. Nous n’avons pas testé l’éditeur d’Adobe nous-mêmes : tout ce qui concerne Adobe sur cette page provient de ses propres pages, consultées le 12 novembre 2026. Consultez adobe.com pour connaître ses fonctions, ses limites et ses prix actuels.',
      breadcrumb: 'BlendPDF face à Adobe Acrobat',
      card: 'D’après ses propres pages, son éditeur en ligne gratuit ne modifie pas le texte existant et exige un compte pour télécharger.',
    },

    es: {
      metaTitle: 'Alternativa a Adobe Acrobat para cambiar el texto de un PDF gratis y sin cuenta | BlendPDF',
      description:
        'El editor en línea gratuito de Adobe no cambia el texto existente y pide una cuenta para descargar. BlendPDF cambia una línea gratis, sin cuenta, también en árabe.',
      title: 'Una alternativa a Adobe Acrobat para cambios rápidos en un PDF',
      tested: 'Comprobado el 12 de noviembre de 2026',
      summary:
        'Según las propias páginas de Adobe, su editor en línea gratuito no permite editar el texto existente en el cuerpo de un PDF, y para descargar lo que editó necesita una cuenta gratuita de Adobe. En BlendPDF, **Editar el texto** (beta) cambia una línea gratis, y usted descarga el archivo sin cuenta.',
      cta: 'Editar un PDF',
      quotes: {
        title: 'Lo que dice Adobe en sus propias páginas',
        intro: 'En la página de su editor y en su página de ayuda sobre las herramientas gratuitas en línea:',
        glosses: [
          'Traducción: “no le permite editar el texto existente en el cuerpo de un PDF”',
          'Traducción: “se necesita una cuenta gratuita de Adobe para descargar o compartir sus archivos editados”',
          'Traducción: “la mayoría de las herramientas le permiten hacer una operación gratuita y descargar el archivo resultante una vez”',
        ],
        after: 'No subimos ningún archivo a Adobe para esta página, porque para descargar se necesita una cuenta y no creamos cuentas para estas pruebas.',
      },
      table: {
        title: 'Comparación directa',
        head: ['Lo que comprobamos', 'BlendPDF', 'Adobe Acrobat en línea'],
        rows: [
          {
            label: 'Cambiar el texto existente, gratis',
            blendpdf: 'Sí, una línea a la vez (beta).',
            them: 'No en el editor en línea gratuito. Acrobat Pro, que es de pago, sí lo hace.',
          },
          { label: 'Cuenta para descargar', blendpdf: 'Ninguna.', them: 'Una cuenta gratuita de Adobe.' },
          {
            label: 'Uso gratuito sin cuenta',
            blendpdf: 'Sin límite diario.',
            them: 'Una operación gratuita y una descarga en la mayoría de las herramientas.',
          },
          {
            label: 'Adónde va su archivo',
            blendpdf: 'La edición se hace en su navegador.',
            them: 'Se sube al almacenamiento en la nube de Adobe, según su página de ayuda.',
          },
        ],
        note: 'Según las páginas de Adobe, consultadas el 12 de noviembre de 2026. Su página de ayuda sobre los límites se actualizó por última vez el 2 de junio de 2025. No probamos Adobe por nuestra cuenta. Consulte en adobe.com los planes y precios actuales.',
      },
      strengths: {
        title: 'Lo que Adobe hace bien',
        items: [
          'Acrobat Pro, su aplicación de pago, edita el texto existente.',
          'Sus herramientas gratuitas aceptan archivos más grandes: 100 MB en la mayoría, y su herramienta para unir PDF combina hasta 100 archivos.',
          'Con la sesión iniciada, completar formularios, firmar, compartir y comentar es gratis.',
        ],
      },
      faq: [
        {
          question: '¿Puedo editar el texto de un PDF gratis con Adobe?',
          answer:
            'Su editor en línea gratuito no edita el texto existente. La página de Adobe dice que “does not let you edit existing body text within a PDF” (no le permite editar el texto existente en el cuerpo de un PDF), y para eso hace falta Acrobat Pro. BlendPDF cambia el texto existente gratis, una línea a la vez (beta).',
        },
        {
          question: '¿Necesito una cuenta de Adobe?',
          answer:
            'Para descargar o compartir archivos desde el editor en línea de Adobe, sí. Adobe dice que “a free Adobe account is required to download or share your edited files” (se necesita una cuenta gratuita de Adobe para descargar o compartir sus archivos editados). BlendPDF nunca le pide una cuenta.',
        },
        {
          question: '¿Cuántas ediciones gratuitas permite Adobe?',
          answer:
            'Sin iniciar sesión, la página de ayuda de Adobe dice que la mayoría de las herramientas permiten una operación gratuita y una descarga. Con la sesión iniciada, sus herramientas premium permiten una operación gratuita cada 30 días. BlendPDF no tiene límite diario. (La página de Adobe se actualizó por última vez el 2 de junio de 2025, y la consultamos el 12 de noviembre de 2026.)',
        },
        CHROME.es.faq.upload,
        {
          question: '¿BlendPDF funciona en árabe?',
          answer: 'Sí. El sitio está en español, árabe, francés e inglés, y tanto “Texto” como “Editar el texto” escriben el árabe de derecha a izquierda.',
        },
      ],
      disclaimer:
        'Adobe y Acrobat son marcas comerciales de Adobe. BlendPDF no tiene ninguna relación con Adobe. No probamos el editor de Adobe por nuestra cuenta: todo lo que esta página dice sobre Adobe viene de las propias páginas de Adobe, consultadas el 12 de noviembre de 2026. Consulte en adobe.com sus funciones, límites y precios actuales.',
      breadcrumb: 'BlendPDF frente a Adobe Acrobat',
      card: 'Según las propias páginas de Adobe, su editor en línea gratuito no cambia el texto existente y pide una cuenta para descargar.',
    },

    ar: {
      metaTitle: 'بديل Adobe Acrobat لتعديل نص PDF مجانًا وبلا حساب | BlendPDF',
      description:
        'محرر Adobe المجاني على الإنترنت لا يغيّر النص الموجود ويطلب حسابًا للتنزيل، أما BlendPDF فيغيّر السطر مجانًا وبلا حساب، وبالعربية أيضًا.',
      title: 'بديل Adobe Acrobat لتعديل ملفات PDF بسرعة',
      tested: 'تاريخ المراجعة: 12 نوفمبر 2026',
      summary:
        'بحسب صفحات Adobe نفسها، لا يتيح محررها المجاني على الإنترنت تعديل النص الأساسي الموجود، وتحتاج إلى حساب Adobe مجاني لتنزيل ما عدّلته. أما في BlendPDF فأداة **تعديل النص الموجود** (ميزة تجريبية) تغيّر السطر مجانًا، ويمكنك تنزيل الملف دون حساب.',
      cta: 'عدّل ملف PDF',
      quotes: {
        title: 'ما تقوله Adobe في صفحاتها',
        intro: 'من صفحة محررها، ومن صفحة المساعدة عن أدواتها المجانية على الإنترنت:',
        glosses: [
          'ترجمتها: «لا يتيح تعديل النص الأساسي الموجود في ملف PDF».',
          'ترجمتها: «يلزم حساب Adobe مجاني لتنزيل ملفاتك المعدَّلة أو مشاركتها».',
          'ترجمتها: «تتيح معظم الأدوات إجراء عملية مجانية واحدة وتنزيل الملف الناتج مرة واحدة».',
        ],
        after: 'لم نرفع أي ملف إلى Adobe لهذه الصفحة، لأن التنزيل يتطلب حسابًا، ونحن لا ننشئ حسابات لهذه الاختبارات.',
      },
      table: {
        title: 'مقارنة سريعة',
        head: ['ما قارنّاه', 'BlendPDF', 'Adobe Acrobat على الإنترنت'],
        rows: [
          {
            label: 'تغيير النص الموجود مجانًا',
            blendpdf: 'نعم، سطرًا سطرًا (ميزة تجريبية).',
            them: 'ليس في المحرر المجاني على الإنترنت، بل في Acrobat Pro المدفوع.',
          },
          { label: 'الحساب للتنزيل', blendpdf: 'لا حاجة إليه.', them: 'حساب Adobe مجاني.' },
          { label: 'الاستخدام المجاني دون حساب', blendpdf: 'لا حدّ يوميًا لعدد المهام.', them: 'عملية مجانية واحدة وتنزيل واحد في معظم الأدوات.' },
          { label: 'أين يذهب ملفك', blendpdf: 'التعديل يجري في متصفحك.', them: 'يُرفع إلى التخزين السحابي لدى Adobe، بحسب صفحة المساعدة.' },
        ],
        note: 'قرأنا صفحات Adobe في 12 نوفمبر 2026، وآخر تحديث لصفحة المساعدة عن الحدود كان في 2 يونيو 2025. لم نجرّب Adobe بأنفسنا، فراجع خططها وأسعارها الحالية على adobe.com.',
      },
      strengths: {
        title: 'ما تُحسنه Adobe',
        items: [
          'تطبيقها المدفوع Acrobat Pro يعدّل النص الموجود.',
          'أدواتها المجانية تقبل ملفات أكبر: 100 ميجابايت في معظمها، والدمج يجمع حتى 100 ملف.',
          'بعد تسجيل الدخول، يمكنك مجانًا تعبئة النماذج وتوقيع الملفات ومشاركتها والتعليق عليها.',
        ],
      },
      faq: [
        {
          question: 'هل يمكنني تعديل نص PDF مجانًا في Adobe؟',
          answer:
            'ليس النص الموجود في محررها المجاني على الإنترنت: تقول صفحة Adobe إنه لا يتيح تعديل النص الأساسي الموجود في الملف، وهذا يحتاج إلى Acrobat Pro. أما BlendPDF فيغيّر النص الموجود مجانًا، سطرًا سطرًا (ميزة تجريبية).',
        },
        {
          question: 'هل أحتاج إلى حساب Adobe؟',
          answer:
            'لتنزيل الملفات أو مشاركتها من محرر Adobe على الإنترنت، نعم: تقول Adobe إن ذلك يتطلب حسابًا مجانيًا. أما BlendPDF فلا يطلب حسابًا أبدًا.',
        },
        {
          question: 'كم تعديلًا مجانيًا تتيحه Adobe؟',
          answer:
            'دون تسجيل الدخول، تقول صفحة المساعدة لدى Adobe إن معظم الأدوات تتيح عملية مجانية واحدة وتنزيلًا واحدًا، وبعد تسجيل الدخول تتيح أدواتها المميزة عملية مجانية كل 30 يومًا. أما BlendPDF فلا حدّ يوميًا فيه. (آخر تحديث لصفحة Adobe كان في 2 يونيو 2025، وقرأناها في 12 نوفمبر 2026.)',
        },
        CHROME.ar.faq.upload,
        {
          question: 'هل يعمل BlendPDF بالعربية؟',
          answer: 'نعم. الموقع متاح بالعربية والفرنسية والإنجليزية، وأداتا «نص» و«تعديل النص الموجود» تكتبان العربية من اليمين إلى اليسار.',
        },
      ],
      disclaimer:
        'Adobe وAcrobat علامتان تجاريتان لشركة Adobe، ولا صلة بين BlendPDF وAdobe. لم نجرّب محرر Adobe بأنفسنا، فكل ما في هذه الصفحة عن Adobe مأخوذ من صفحاتها، وقد قرأناها في 12 نوفمبر 2026. راجع adobe.com لمعرفة ميزاتها وحدودها وأسعارها الحالية.',
      breadcrumb: 'BlendPDF مقابل Adobe Acrobat',
      card: 'بحسب صفحاتها، محررها المجاني على الإنترنت لا يغيّر النص الموجود ويطلب حسابًا للتنزيل.',
    },
  },
};
