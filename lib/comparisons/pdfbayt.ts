/**
 * /blendpdf-vs-pdfbayt: PdfBayt (Arabic-only) on 12 November 2026. Its Add
 * text saved «السيد يوسف الإدريسي» as a 390×98 px picture (re-run that day:
 * the exported PDF draws one image and its mask, with no text operators or
 * fonts), plus its own pages read that day. The Arabic page matters most:
 * that's where PdfBayt outranks us.
 */
import { CHROME } from './chrome';
import type { Comparison } from './types';

export const pdfbayt: Comparison = {
  slug: 'pdfbayt',
  path: '/blendpdf-vs-pdfbayt',
  name: 'PdfBayt',
  howTo: 'add',
  shots: [],
  quotes: [
    { text: 'هذه الأداة تضيف طبقة نصية جديدة فوق الملف ولا تعدل النصوص الأصلية', lang: 'ar', source: 'https://pdfbayt.com/tools/add-text' },
    { text: 'يتطلب الضغط حسابًا مجانيًا أو تسجيل الدخول قبل بدء المعالجة.', lang: 'ar', source: 'https://pdfbayt.com/tools/pdf-compress' },
    { text: 'الأداة مجانية، وتتطلب حسابًا مجانيًا لإتمام التحويل', lang: 'ar', source: 'https://pdfbayt.com/tools/pdf-to-word' },
  ],
  text: {
    en: {
      metaTitle: 'PdfBayt Alternative for Arabic PDFs, Tested | BlendPDF',
      description:
        'PdfBayt is built for Arabic, but in our test its Add text saved the Arabic line as a picture. BlendPDF saves real text, edits existing lines and never needs an account.',
      title: 'A PdfBayt alternative for Arabic PDFs',
      tested: 'Tested 12 November 2026',
      summary:
        'PdfBayt is built for Arabic, but in our test its Add text saved the Arabic line as a picture, and its own page says the tool doesn’t change the original text. Its Compress and PDF to Word tools also need a free account. In BlendPDF, **Text** saves Arabic as real text, **Edit existing text** (beta) changes a line, and no tool asks for an account.',
      cta: 'Edit an Arabic PDF',
      quotes: {
        title: 'What PdfBayt says on its own pages',
        intro: 'From its Add text, Compress and PDF to Word pages, in Arabic:',
        glosses: [
          'In English: “This tool adds a new text layer on top of the file and doesn’t change the original text.”',
          'In English: “Compressing requires a free account or signing in before processing starts.”',
          'In English: “The tool is free, and needs a free account to complete the conversion.”',
        ],
        after: 'In BlendPDF, **Edit existing text** (beta) changes the original line itself, and none of our tools needs an account.',
      },
      table: {
        title: 'Side by side',
        head: ['What we checked', 'BlendPDF', 'PdfBayt'],
        rows: [
          {
            label: 'Adding an Arabic line',
            blendpdf: 'Saved as real text: you can search, select and copy it.',
            them: 'Saved as a picture (390 × 98 pixels): it can’t be selected or searched.',
          },
          {
            label: 'Changing existing text',
            blendpdf: 'One line at a time (beta).',
            them: 'We found no tool for it; its Add text page says that tool doesn’t change the original text.',
          },
          { label: 'Account', blendpdf: 'Never.', them: 'A free account for Compress and PDF to Word.' },
          {
            label: 'When files are deleted',
            blendpdf: 'Within an hour for uploaded files. The editor only uploads if you ask for the result by email.',
            them: 'After processing or when a set period ends; its about page doesn’t say how long.',
          },
        ],
        note: 'Tested 12 November 2026, with PdfBayt’s pages read the same day. PdfBayt may have changed since, so check pdfbayt.com.',
      },
      strengths: {
        title: 'Where PdfBayt does well',
        items: [
          'It’s built for Arabic, and its Add text supports right-to-left alignment.',
          'Many of its tools run in your browser without uploading the file, like ours.',
          'It has tools BlendPDF doesn’t, such as Pro Sign for sending a document out to be signed.',
        ],
      },
      faq: [
        {
          question: 'Can I search Arabic I add in PdfBayt?',
          answer:
            'Not in our test on 12 November 2026: its Add text saved the Arabic line as a picture (390 × 98 pixels). It looked right, but it couldn’t be selected or searched. BlendPDF saves added Arabic as real text.',
        },
        {
          question: 'Can PdfBayt change existing Arabic text?',
          answer:
            'Not that we found on 12 November 2026. Its Add text page says the tool adds a new text layer and doesn’t change the original text. BlendPDF’s Edit existing text (beta) changes a line in place, one line at a time.',
        },
        {
          question: 'Do I need an account?',
          answer:
            'BlendPDF never asks for one. PdfBayt needs a free account for Compress and for PDF to Word, according to those tool pages (read on 12 November 2026).',
        },
        {
          question: 'Is BlendPDF only in Arabic?',
          answer: 'No. It’s in Arabic, French and English, and you can type Arabic and English in the same text box.',
        },
        CHROME.en.faq.upload,
      ],
      disclaimer:
        'PdfBayt is a trademark of its owner. BlendPDF isn’t affiliated with pdfbayt. We ran this test ourselves on 12 November 2026 on pdfbayt.com, without an account, and quote its pages as they read that day. PdfBayt may have changed since, so check pdfbayt.com for its current features and limits.',
      breadcrumb: 'BlendPDF vs PdfBayt',
      card: 'Built for Arabic, but its Add text saved our Arabic line as a picture, and its Compress and PDF to Word tools need a free account.',
    },

    fr: {
      metaTitle: 'Alternative à PdfBayt pour les PDF en arabe : notre test | BlendPDF',
      description:
        'PdfBayt est conçu pour l’arabe, mais son outil d’ajout de texte a enregistré notre ligne arabe sous forme d’image. BlendPDF enregistre du vrai texte, sans compte.',
      title: 'Une alternative à PdfBayt pour les PDF en arabe',
      tested: 'Testé le 12 novembre 2026',
      summary:
        'PdfBayt est conçu pour l’arabe, mais lors de notre test, son outil d’ajout de texte a enregistré la ligne arabe sous forme d’image, et sa page indique que l’outil ne modifie pas le texte d’origine. Ses outils de compression et de conversion en Word exigent aussi un compte gratuit. Avec BlendPDF, **Texte** enregistre l’arabe comme du vrai texte, **Modifier le texte** (bêta) change une ligne, et aucun outil ne demande de compte.',
      cta: 'Modifier un PDF en arabe',
      quotes: {
        title: 'Ce que dit PdfBayt sur ses propres pages',
        intro: 'Extraits, en arabe, de ses pages d’ajout de texte, de compression et de conversion en Word :',
        glosses: [
          'Traduction : « Cet outil ajoute une nouvelle couche de texte par-dessus le fichier et ne modifie pas le texte d’origine. »',
          'Traduction : « La compression exige un compte gratuit ou une connexion avant le début du traitement. »',
          'Traduction : « L’outil est gratuit et nécessite un compte gratuit pour finaliser la conversion. »',
        ],
        after: 'Chez BlendPDF, **Modifier le texte** (bêta) change la ligne d’origine elle-même, et aucun de nos outils ne demande de compte.',
      },
      table: {
        title: 'Côte à côte',
        head: ['Ce que nous avons vérifié', 'BlendPDF', 'PdfBayt'],
        rows: [
          {
            label: 'Ajouter une ligne en arabe',
            blendpdf: 'Enregistrée comme du vrai texte : vous pouvez la rechercher, la sélectionner et la copier.',
            them: 'Enregistrée comme une image (390 × 98 pixels) : impossible de la sélectionner ou de la rechercher.',
          },
          {
            label: 'Modifier le texte existant',
            blendpdf: 'Une ligne à la fois (bêta).',
            them: 'Aucun outil trouvé ; sa page d’ajout de texte indique que cet outil ne modifie pas le texte d’origine.',
          },
          { label: 'Compte', blendpdf: 'Jamais.', them: 'Un compte gratuit pour la compression et la conversion en Word.' },
          {
            label: 'Suppression des fichiers',
            blendpdf: 'Dans l’heure pour les fichiers envoyés. L’éditeur n’envoie rien, sauf si vous demandez le résultat par courriel.',
            them: 'Après le traitement ou à l’issue d’une durée fixée, que sa page de présentation ne précise pas.',
          },
        ],
        note: 'Testé le 12 novembre 2026, pages de PdfBayt consultées le même jour. PdfBayt a pu changer depuis : vérifiez sur pdfbayt.com.',
      },
      strengths: {
        title: 'Les points forts de PdfBayt',
        items: [
          'Il est conçu pour l’arabe, et son outil d’ajout de texte gère l’alignement de droite à gauche.',
          'Beaucoup de ses outils fonctionnent dans votre navigateur, sans envoyer le fichier, comme les nôtres.',
          'Il propose des outils que BlendPDF n’a pas, comme Pro Sign pour envoyer un document à signer.',
        ],
      },
      faq: [
        {
          question: 'Peut-on rechercher le texte arabe ajouté avec PdfBayt ?',
          answer:
            'Pas lors de notre test du 12 novembre 2026 : son outil d’ajout de texte a enregistré la ligne arabe sous forme d’image (390 × 98 pixels). Elle avait l’air correcte, mais on ne pouvait ni la sélectionner ni la rechercher. BlendPDF enregistre l’arabe ajouté comme du vrai texte.',
        },
        {
          question: 'PdfBayt peut-il modifier le texte arabe existant ?',
          answer:
            'Nous n’avons trouvé aucun outil pour cela le 12 novembre 2026. Sa page d’ajout de texte indique que l’outil ajoute une nouvelle couche de texte et ne modifie pas le texte d’origine. Dans BlendPDF, « Modifier le texte » (bêta) change directement une ligne, une à la fois.',
        },
        {
          question: 'Faut-il un compte ?',
          answer:
            'BlendPDF n’en demande jamais. PdfBayt exige un compte gratuit pour la compression et pour la conversion en Word, d’après les pages de ces outils (consultées le 12 novembre 2026).',
        },
        {
          question: 'BlendPDF n’existe-t-il qu’en arabe ?',
          answer: 'Non. Il existe en arabe, en français et en anglais, et vous pouvez taper de l’arabe et de l’anglais dans la même zone de texte.',
        },
        CHROME.fr.faq.upload,
      ],
      disclaimer:
        'PdfBayt est une marque de son propriétaire. BlendPDF n’a aucun lien avec pdfbayt. Nous avons fait ce test nous-mêmes le 12 novembre 2026 sur pdfbayt.com, sans compte, et nous citons ses pages telles qu’elles étaient ce jour-là. PdfBayt a pu évoluer depuis : consultez pdfbayt.com pour connaître ses fonctions et ses limites actuelles.',
      breadcrumb: 'BlendPDF face à PdfBayt',
      card: 'Conçu pour l’arabe, mais son outil d’ajout de texte a enregistré notre ligne arabe sous forme d’image, et ses outils de compression et de conversion en Word exigent un compte gratuit.',
    },

    es: {
      metaTitle: 'Alternativa a PdfBayt para PDF en árabe: lo probamos | BlendPDF',
      description:
        'PdfBayt está hecho para el árabe, pero en nuestra prueba su herramienta para agregar texto guardó la línea en árabe como imagen. BlendPDF guarda texto real, edita líneas existentes y nunca pide una cuenta.',
      title: 'Una alternativa a PdfBayt para PDF en árabe',
      tested: 'Probado el 12 de noviembre de 2026',
      summary:
        'PdfBayt está hecho para el árabe, pero en nuestra prueba su herramienta para agregar texto guardó la línea en árabe como imagen, y su propia página dice que esa herramienta no cambia el texto original. Además, sus herramientas para comprimir y para convertir a Word piden una cuenta gratuita. En BlendPDF, **Texto** guarda el árabe como texto real, **Editar el texto** (beta) cambia una línea y ninguna herramienta pide una cuenta.',
      cta: 'Editar un PDF en árabe',
      quotes: {
        title: 'Lo que dice PdfBayt en sus propias páginas',
        intro: 'De sus páginas para agregar texto, comprimir y convertir a Word, en árabe:',
        glosses: [
          'Traducción: “Esta herramienta agrega una nueva capa de texto sobre el archivo y no modifica los textos originales”.',
          'Traducción: “Para comprimir se necesita una cuenta gratuita o iniciar sesión antes de que empiece el procesamiento”.',
          'Traducción: “La herramienta es gratuita y necesita una cuenta gratuita para completar la conversión”.',
        ],
        after: 'En BlendPDF, **Editar el texto** (beta) cambia la propia línea original, y ninguna de nuestras herramientas pide una cuenta.',
      },
      table: {
        title: 'Comparación directa',
        head: ['Lo que comprobamos', 'BlendPDF', 'PdfBayt'],
        rows: [
          {
            label: 'Agregar una línea en árabe',
            blendpdf: 'Se guarda como texto real: puede buscarla, seleccionarla y copiarla.',
            them: 'Se guardó como imagen (390 × 98 píxeles): no se puede seleccionar ni buscar.',
          },
          {
            label: 'Cambiar el texto existente',
            blendpdf: 'Una línea a la vez (beta).',
            them: 'No encontramos ninguna herramienta para hacerlo. Su página para agregar texto dice que esa herramienta no cambia el texto original.',
          },
          { label: 'Cuenta', blendpdf: 'Nunca se necesita.', them: 'Una cuenta gratuita para comprimir y para convertir a Word.' },
          {
            label: 'Cuándo se eliminan los archivos',
            blendpdf: 'En un plazo de una hora, para los archivos que se suben. El editor solo sube el archivo si usted pide el resultado por correo electrónico.',
            them: 'Después del procesamiento o cuando termina un plazo fijado. La página que describe el servicio no dice cuánto dura ese plazo.',
          },
        ],
        note: 'Probado el 12 de noviembre de 2026, con las páginas de PdfBayt consultadas ese mismo día. PdfBayt puede haber cambiado desde entonces: consulte pdfbayt.com.',
      },
      strengths: {
        title: 'Lo que PdfBayt hace bien',
        items: [
          'Está hecho para el árabe, y su herramienta para agregar texto permite alinear de derecha a izquierda.',
          'Muchas de sus herramientas funcionan en el navegador, sin subir el archivo, como las nuestras.',
          'Tiene herramientas que BlendPDF no tiene, como Pro Sign, para enviar un documento a firmar.',
        ],
      },
      faq: [
        {
          question: '¿Puedo buscar el texto en árabe que agrego en PdfBayt?',
          answer:
            'No en nuestra prueba del 12 de noviembre de 2026: su herramienta para agregar texto guardó la línea en árabe como imagen (390 × 98 píxeles). Se veía bien, pero no se podía seleccionar ni buscar. BlendPDF guarda el árabe que usted agrega como texto real.',
        },
        {
          question: '¿PdfBayt puede cambiar el texto existente en árabe?',
          answer:
            'No encontramos cómo hacerlo el 12 de noviembre de 2026. Su página para agregar texto dice que la herramienta agrega una nueva capa de texto y no cambia el texto original. En BlendPDF, “Editar el texto” (beta) cambia una línea directamente en la página, una línea a la vez.',
        },
        {
          question: '¿Necesito una cuenta?',
          answer:
            'BlendPDF nunca la pide. PdfBayt pide una cuenta gratuita para comprimir y para convertir a Word, según las páginas de esas herramientas (consultadas el 12 de noviembre de 2026).',
        },
        {
          question: '¿BlendPDF está solo en árabe?',
          answer: 'No. Está en español, árabe, francés e inglés, y puede escribir árabe y español en el mismo cuadro de texto.',
        },
        CHROME.es.faq.upload,
      ],
      disclaimer:
        'PdfBayt es una marca comercial de su propietario. BlendPDF no tiene ninguna relación con PdfBayt. Hicimos esta prueba nosotros mismos el 12 de noviembre de 2026 en pdfbayt.com, sin cuenta, y citamos sus páginas tal como estaban ese día. PdfBayt puede haber cambiado desde entonces: consulte pdfbayt.com para ver sus funciones y límites actuales.',
      breadcrumb: 'BlendPDF frente a PdfBayt',
      card: 'Hecho para el árabe, pero su herramienta para agregar texto guardó como imagen nuestra línea en árabe, y sus herramientas para comprimir y para convertir a Word piden una cuenta gratuita.',
    },

    ar: {
      metaTitle: 'بديل PdfBayt لتعديل ملفات PDF العربية: جرّبنا الأداتين | BlendPDF',
      description:
        'أضفنا سطرًا عربيًا في PdfBayt وفي BlendPDF: حفظه PdfBayt صورةً لا يمكن البحث فيها، وحفظه BlendPDF نصًا حقيقيًا. ويغيّر BlendPDF النص الموجود أيضًا، بلا حساب.',
      title: 'بديل PdfBayt لتعديل ملفات PDF العربية',
      tested: 'تاريخ الاختبار: 12 نوفمبر 2026',
      summary:
        'PdfBayt موقع عربي، لكن أداة إضافة النص فيه حفظت سطرنا العربي صورةً في تجربتنا، وصفحته تقول إن الأداة لا تعدّل النص الأصلي. كما أن أداتي الضغط والتحويل إلى Word فيه تطلبان حسابًا مجانيًا. أما في BlendPDF فأداة **نص** تحفظ العربية نصًا حقيقيًا، وأداة **تعديل النص الموجود** (ميزة تجريبية) تغيّر السطر نفسه، ولا تطلب أي أداة حسابًا.',
      cta: 'عدّل ملف PDF',
      quotes: {
        title: 'ما يقوله PdfBayt في صفحاته',
        intro: 'من صفحاته عن إضافة النص والضغط والتحويل إلى Word:',
        after: 'أما في BlendPDF فأداة **تعديل النص الموجود** (ميزة تجريبية) تغيّر السطر الأصلي نفسه، ولا تحتاج أي أداة من أدواتنا إلى حساب.',
      },
      table: {
        title: 'مقارنة سريعة',
        head: ['ما قارنّاه', 'BlendPDF', 'PdfBayt'],
        rows: [
          {
            label: 'إضافة سطر عربي',
            blendpdf: 'يُحفظ نصًا حقيقيًا: يمكنك البحث فيه وتحديده ونسخه.',
            them: 'حُفظ صورةً (390 × 98 بكسل): لا يمكن تحديده ولا البحث فيه.',
          },
          {
            label: 'تغيير النص الموجود',
            blendpdf: 'سطرًا سطرًا (ميزة تجريبية).',
            them: 'لم نجد أداة لذلك، وتقول صفحة إضافة النص لديه إن هذه الأداة لا تعدّل النص الأصلي.',
          },
          { label: 'الحساب', blendpdf: 'لا حاجة إليه أبدًا.', them: 'حساب مجاني للضغط والتحويل إلى Word.' },
          {
            label: 'متى تُحذف الملفات',
            blendpdf: 'خلال ساعة للملفات المرفوعة، والمحرر لا يرفع شيئًا إلا إذا طلبت النتيجة بالبريد الإلكتروني.',
            them: 'بعد اكتمال المعالجة أو انتهاء «المدة المحددة»، وصفحته لا تذكر طول هذه المدة.',
          },
        ],
        note: 'أجرينا الاختبار وقرأنا صفحات PdfBayt في 12 نوفمبر 2026، وقد يكون تغيّر بعد ذلك، فراجع موقعه pdfbayt.com.',
      },
      strengths: {
        title: 'ما يُحسنه PdfBayt',
        items: [
          'موقع عربي من أوله إلى آخره، وأداة إضافة النص فيه تدعم الكتابة من اليمين إلى اليسار.',
          'أدوات كثيرة فيه تعمل في متصفحك دون رفع الملف، مثل أدواتنا.',
          'فيه أدوات لا يقدّمها BlendPDF، مثل Pro Sign لإرسال المستندات للتوقيع.',
        ],
      },
      faq: [
        {
          question: 'هل يمكن البحث في النص العربي الذي أضيفه في PdfBayt؟',
          answer:
            'ليس في تجربتنا في 12 نوفمبر 2026: حفظت أداة إضافة النص فيه السطر العربي صورةً (390 × 98 بكسل). بدا سليمًا، لكننا لم نستطع تحديده ولا البحث فيه. أما BlendPDF فيحفظ العربية المضافة نصًا حقيقيًا.',
        },
        {
          question: 'هل يغيّر PdfBayt النص العربي الموجود؟',
          answer:
            'لم نجد في 12 نوفمبر 2026 أداة لذلك، وتقول صفحة إضافة النص لديه إن الأداة تضيف طبقة نصية جديدة ولا تعدّل النص الأصلي. أما أداة «تعديل النص الموجود» في BlendPDF (ميزة تجريبية) فتغيّر السطر في مكانه، سطرًا سطرًا.',
        },
        {
          question: 'هل أحتاج إلى حساب؟',
          answer:
            'BlendPDF لا يطلب حسابًا أبدًا. أما PdfBayt فيطلب حسابًا مجانيًا للضغط وللتحويل إلى Word، كما تقول صفحتا الأداتين (قرأناهما في 12 نوفمبر 2026).',
        },
        {
          question: 'هل BlendPDF بالعربية فقط؟',
          answer: 'لا. الموقع بالعربية والفرنسية والإنجليزية، ويمكنك كتابة العربية والإنجليزية في خانة النص نفسها.',
        },
        CHROME.ar.faq.upload,
      ],
      disclaimer:
        'اسم PdfBayt علامة تجارية لمالكها، ولا صلة بين BlendPDF وPdfBayt. أجرينا هذا الاختبار بأنفسنا في 12 نوفمبر 2026 على موقع pdfbayt.com دون حساب، وننقل عن صفحاته ما كانت تقوله ذلك اليوم. وقد يكون تغيّر بعد ذلك، فراجع موقعه لمعرفة ميزاته وحدوده الحالية.',
      breadcrumb: 'BlendPDF مقابل PdfBayt',
      card: 'موقع عربي، لكن أداة إضافة النص فيه حفظت سطرنا العربي صورةً، وأداتا الضغط والتحويل إلى Word فيه تطلبان حسابًا مجانيًا.',
    },
  },
};
