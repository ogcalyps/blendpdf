/**
 * /blendpdf-vs-ilovepdf: iLovePDF's own pages, read on 12 November 2026, and
 * our own before and after. No claim from our runs in its editor: its canvas
 * ignored or misplaced our simulated typing, so a saved "." could be our
 * artefact (the English contract run was inconclusive for the same reason).
 */
import { CHROME } from './chrome';
import { editShots } from './shots';
import type { Comparison } from './types';

export const ilovepdf: Comparison = {
  slug: 'ilovepdf',
  path: '/blendpdf-vs-ilovepdf',
  name: 'iLovePDF',
  howTo: 'edit',
  shots: editShots(),
  quotes: [{ text: 'The Content Editor does not currently support Right-to-Left (RTL) languages.', lang: 'en', source: 'https://www.ilovepdf.com/edit-pdf' }],
  text: {
    en: {
      metaTitle: 'iLovePDF Alternative for Editing Arabic PDFs | BlendPDF',
      description:
        'iLovePDF’s own page says its Content Editor doesn’t support right-to-left languages yet. BlendPDF changes an Arabic line right to left, one line at a time (beta).',
      title: 'An iLovePDF alternative for editing Arabic PDFs',
      tested: 'Checked 12 November 2026',
      summary:
        'iLovePDF says its Content Editor, the mode that changes existing text, doesn’t support right-to-left languages yet. In BlendPDF, open your file in **Edit PDF**, choose **Edit existing text** (beta), click the line and type it again. It’s free, with no account, and the editing runs in your browser.',
      cta: 'Edit an Arabic PDF',
      evidence: {
        title: 'Changing an Arabic line in BlendPDF',
        intro:
          'We changed the name in the first sentence of a one-page Arabic work certificate with BlendPDF. Below is the top of the file before and after. The grey frame is the edge of the page.',
        shots: {
          original: { label: 'Original', caption: 'The line before the change.', alt: 'The original Arabic line, right-aligned inside the page margins.' },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'The new name is in, the line still starts at the right margin and the letters are joined. It came out in Noto Sans Arabic, a plainer font than the original.',
            alt: 'BlendPDF’s saved line: the new name, right to left inside the margins, letters joined.',
          },
        },
      },
      quotes: {
        title: 'What iLovePDF says about Arabic',
        intro: 'Its Edit PDF page says this about the Content Editor, the mode that changes existing text:',
        after: 'BlendPDF’s **Edit existing text** (beta) does change Arabic lines, right to left, one line at a time.',
      },
      table: {
        title: 'Side by side',
        head: ['What we checked', 'BlendPDF', 'iLovePDF'],
        rows: [
          {
            label: 'Changing an Arabic line',
            blendpdf: 'Written right to left, inside the margins, with joined letters.',
            them: 'Its Content Editor doesn’t support right-to-left languages yet, by its own page.',
          },
          {
            label: 'Where your file goes',
            blendpdf: 'The editing runs in your browser.',
            them: 'Processed on its servers and deleted “within two (2) hours of processing them”, by its terms.',
          },
          { label: 'Free use', blendpdf: 'No daily limit.', them: '“You can process a limited number of documents.”' },
        ],
        note: 'BlendPDF tested 12 November 2026, with iLovePDF’s pages read the same day. iLovePDF may have changed since, so check its current terms on ilovepdf.com.',
      },
      strengths: {
        title: 'Where iLovePDF does well',
        items: [
          'Its site is in Arabic too.',
          'Its free plan takes bigger files in some tools: 100 MB to merge, split or edit and 200 MB to compress, against 50 MB per file at BlendPDF.',
          'Its Content Editor lets you select existing text to edit, move or delete it, in languages written left to right.',
        ],
      },
      faq: [
        {
          question: 'Does iLovePDF support Arabic?',
          answer:
            'Its site does, but its editor for existing text doesn’t, by its own account. On 12 November 2026 its Edit PDF page said “The Content Editor does not currently support Right-to-Left (RTL) languages.”',
        },
        CHROME.en.faq.freeEdit,
        CHROME.en.faq.upload,
        {
          question: 'How long does iLovePDF keep my files?',
          answer:
            'Its terms say files are deleted “within two (2) hours of processing them on ILOVEPDF servers” (read on 12 November 2026). BlendPDF’s editor doesn’t upload your file unless you ask us to email you the result, and files sent to our other tools are deleted within an hour.',
        },
        CHROME.en.faq.font,
      ],
      disclaimer:
        'iLovePDF is a trademark of its owner. BlendPDF isn’t affiliated with iLovePDF. Everything about iLovePDF on this page comes from its own pages, read on 12 November 2026. iLovePDF may have changed since, so check ilovepdf.com for its current features and limits.',
      breadcrumb: 'BlendPDF vs iLovePDF',
      card: 'Its own page says its Content Editor, which changes existing text, doesn’t support right-to-left languages yet.',
    },

    fr: {
      metaTitle: 'Alternative à iLovePDF pour modifier un PDF en arabe | BlendPDF',
      description:
        'D’après sa propre page, l’éditeur de contenu d’iLovePDF ne prend pas encore en charge les langues s’écrivant de droite à gauche. BlendPDF modifie une ligne arabe (bêta).',
      title: 'Une alternative à iLovePDF pour modifier un PDF en arabe',
      tested: 'Vérifié le 12 novembre 2026',
      summary:
        'iLovePDF indique que son éditeur de contenu, le mode qui modifie le texte existant, ne prend pas encore en charge les langues qui s’écrivent de droite à gauche. Avec BlendPDF, ouvrez votre fichier dans **Modifier un PDF**, choisissez **Modifier le texte** (bêta), cliquez sur la ligne et saisissez-la de nouveau. C’est gratuit, sans compte, et la modification se fait dans votre navigateur.',
      cta: 'Modifier un PDF en arabe',
      evidence: {
        title: 'Modifier une ligne en arabe avec BlendPDF',
        intro:
          'Nous avons changé le nom dans la première phrase d’une attestation de travail d’une page en arabe, avec BlendPDF. Voici le haut du fichier avant et après. Le cadre gris marque le bord de la page.',
        shots: {
          original: { label: 'Original', caption: 'La ligne avant la modification.', alt: 'La ligne arabe d’origine, alignée à droite, à l’intérieur des marges de la page.' },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'Le nouveau nom est en place, la ligne part toujours de la marge de droite et les lettres sont liées. Elle est écrite en Noto Sans Arabic, une police plus sobre que celle d’origine.',
            alt: 'La ligne enregistrée par BlendPDF : le nouveau nom, de droite à gauche à l’intérieur des marges, lettres liées.',
          },
        },
      },
      quotes: {
        title: 'Ce que dit iLovePDF de l’arabe',
        intro: 'Sa page Edit PDF indique ceci à propos du Content Editor, le mode qui modifie le texte existant :',
        glosses: ['Traduction : « L’éditeur de contenu ne prend pas en charge, pour le moment, les langues s’écrivant de droite à gauche (RTL). »'],
        after: 'Chez BlendPDF, **Modifier le texte** (bêta) modifie bien les lignes arabes, de droite à gauche, une ligne à la fois.',
      },
      table: {
        title: 'Côte à côte',
        head: ['Ce que nous avons vérifié', 'BlendPDF', 'iLovePDF'],
        rows: [
          {
            label: 'Modifier une ligne en arabe',
            blendpdf: 'Écrite de droite à gauche, à l’intérieur des marges, lettres liées.',
            them: 'D’après sa page, son éditeur de contenu ne prend pas encore en charge les langues s’écrivant de droite à gauche.',
          },
          {
            label: 'Où va votre fichier',
            blendpdf: 'La modification se fait dans votre navigateur.',
            them: 'Traité sur ses serveurs, puis supprimé dans les deux heures, d’après ses conditions.',
          },
          { label: 'Utilisation gratuite', blendpdf: 'Pas de limite quotidienne.', them: 'Un nombre limité de documents, d’après sa page de tarifs.' },
        ],
        note: 'BlendPDF testé le 12 novembre 2026, pages d’iLovePDF consultées le même jour. iLovePDF a pu changer depuis : vérifiez ses conditions actuelles sur ilovepdf.com.',
      },
      strengths: {
        title: 'Les points forts d’iLovePDF',
        items: [
          'Son site existe aussi en arabe.',
          'Son offre gratuite accepte des fichiers plus lourds pour certains outils : 100 Mo pour fusionner, diviser ou modifier, 200 Mo pour compresser, contre 50 Mo par fichier chez BlendPDF.',
          'Son éditeur de contenu permet de sélectionner le texte existant pour le modifier, le déplacer ou le supprimer, dans les langues qui s’écrivent de gauche à droite.',
        ],
      },
      faq: [
        {
          question: 'iLovePDF prend-il en charge l’arabe ?',
          answer:
            'Son site, oui, mais pas l’outil qui modifie le texte existant, de son propre aveu. Le 12 novembre 2026, sa page Edit PDF indiquait « The Content Editor does not currently support Right-to-Left (RTL) languages. »',
        },
        CHROME.fr.faq.freeEdit,
        CHROME.fr.faq.upload,
        {
          question: 'Combien de temps iLovePDF conserve-t-il mes fichiers ?',
          answer:
            'Ses conditions indiquent qu’il les supprime dans les deux heures suivant leur traitement sur ses serveurs (consultées le 12 novembre 2026). L’éditeur de BlendPDF n’envoie votre fichier que si vous demandez à recevoir le résultat par courriel, et les fichiers envoyés à nos autres outils sont supprimés dans l’heure.',
        },
        CHROME.fr.faq.font,
      ],
      disclaimer:
        'iLovePDF est une marque de son propriétaire. BlendPDF n’a aucun lien avec iLovePDF. Tout ce qui concerne iLovePDF sur cette page provient de ses propres pages, consultées le 12 novembre 2026. iLovePDF a pu évoluer depuis : consultez ilovepdf.com pour connaître ses fonctions et ses limites actuelles.',
      breadcrumb: 'BlendPDF face à iLovePDF',
      card: 'Sa page indique que son éditeur de contenu, qui modifie le texte existant, ne prend pas encore en charge l’écriture de droite à gauche.',
    },

    es: {
      metaTitle: 'Alternativa a iLovePDF para editar PDF en árabe | BlendPDF',
      description:
        'La propia página de iLovePDF dice que su editor de contenido todavía no admite idiomas que se escriben de derecha a izquierda. BlendPDF cambia una línea en árabe de derecha a izquierda, una línea a la vez (beta).',
      title: 'Una alternativa a iLovePDF para editar PDF en árabe',
      tested: 'Comprobado el 12 de noviembre de 2026',
      summary:
        'iLovePDF dice que su editor de contenido (Content Editor), el modo que cambia el texto existente, todavía no admite idiomas que se escriben de derecha a izquierda. En BlendPDF, abra su archivo en **Editar PDF**, elija **Editar el texto** (beta), haga clic en la línea y vuelva a escribirla. Es gratuito, sin cuenta, y la edición se hace en su navegador.',
      cta: 'Editar un PDF en árabe',
      evidence: {
        title: 'Cambiar una línea en árabe en BlendPDF',
        intro:
          'Con BlendPDF cambiamos el nombre de la primera frase de un certificado de trabajo en árabe de una página. Abajo se ve la parte superior del archivo antes y después. El marco gris es el borde de la página.',
        shots: {
          original: { label: 'Original', caption: 'La línea antes del cambio.', alt: 'La línea original en árabe, alineada a la derecha dentro de los márgenes de la página.' },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'El nombre nuevo está en su lugar, la línea sigue empezando en el margen derecho y las letras están unidas. Quedó en Noto Sans Arabic, una fuente más sencilla que la original.',
            alt: 'La línea guardada por BlendPDF: el nombre nuevo, de derecha a izquierda dentro de los márgenes, con las letras unidas.',
          },
        },
      },
      quotes: {
        title: 'Lo que dice iLovePDF sobre el árabe',
        intro: 'Su página Edit PDF dice esto sobre el Content Editor, el modo que cambia el texto existente:',
        glosses: ['Traducción: “Por el momento, el editor de contenido no admite idiomas que se escriben de derecha a izquierda (RTL)”.'],
        after: 'En BlendPDF, **Editar el texto** (beta) sí cambia líneas en árabe, de derecha a izquierda, una línea a la vez.',
      },
      table: {
        title: 'Comparación directa',
        head: ['Lo que comprobamos', 'BlendPDF', 'iLovePDF'],
        rows: [
          {
            label: 'Cambiar una línea en árabe',
            blendpdf: 'Escrita de derecha a izquierda, dentro de los márgenes y con las letras unidas.',
            them: 'Según su propia página, su editor de contenido todavía no admite idiomas que se escriben de derecha a izquierda.',
          },
          {
            label: 'Adónde va su archivo',
            blendpdf: 'La edición se hace en su navegador.',
            them: 'Se procesa en sus servidores y se elimina en las dos horas siguientes, según sus condiciones.',
          },
          { label: 'Uso gratuito', blendpdf: 'Sin límite diario.', them: 'Un número limitado de documentos, según iLovePDF.' },
        ],
        note: 'BlendPDF se probó el 12 de noviembre de 2026, y las páginas de iLovePDF se consultaron el mismo día. iLovePDF puede haber cambiado desde entonces, así que consulte sus condiciones actuales en ilovepdf.com.',
      },
      strengths: {
        title: 'Lo que iLovePDF hace bien',
        items: [
          'Su sitio también está en árabe.',
          'Su plan gratuito acepta archivos más grandes en algunas herramientas: 100 MB para unir, dividir o editar y 200 MB para comprimir, frente a 50 MB por archivo en BlendPDF.',
          'Su editor de contenido permite seleccionar el texto existente para editarlo, moverlo o eliminarlo, en idiomas que se escriben de izquierda a derecha.',
        ],
      },
      faq: [
        {
          question: '¿iLovePDF admite el árabe?',
          answer:
            'Su sitio sí, pero su editor para cambiar el texto existente no, según sus propias palabras. El 12 de noviembre de 2026, su página Edit PDF decía: “The Content Editor does not currently support Right-to-Left (RTL) languages.” (Por el momento, el editor de contenido no admite idiomas que se escriben de derecha a izquierda.)',
        },
        CHROME.es.faq.freeEdit,
        CHROME.es.faq.upload,
        {
          question: '¿Cuánto tiempo conserva iLovePDF mis archivos?',
          answer:
            'Sus condiciones dicen que los archivos se eliminan en un plazo de dos horas después de procesarlos en sus servidores (consultadas el 12 de noviembre de 2026). El editor de BlendPDF no sube su archivo a menos que nos pida que le enviemos el resultado por correo electrónico, y los archivos enviados a nuestras otras herramientas se eliminan en el plazo de una hora.',
        },
        CHROME.es.faq.font,
      ],
      disclaimer:
        'iLovePDF es una marca comercial de su propietario. BlendPDF no tiene ninguna relación con iLovePDF. Todo lo que esta página dice sobre iLovePDF viene de sus propias páginas, consultadas el 12 de noviembre de 2026. iLovePDF puede haber cambiado desde entonces, así que consulte en ilovepdf.com sus funciones y límites actuales.',
      breadcrumb: 'BlendPDF frente a iLovePDF',
      card: 'Su propia página dice que su editor de contenido, que cambia el texto existente, todavía no admite idiomas que se escriben de derecha a izquierda.',
    },

    ar: {
      metaTitle: 'بديل iLovePDF لتعديل ملفات PDF العربية | BlendPDF',
      description:
        'تقول صفحة iLovePDF نفسها إن محرر المحتوى فيه لا يدعم بعدُ اللغات المكتوبة من اليمين إلى اليسار، أما BlendPDF فيغيّر السطر العربي من اليمين إلى اليسار (ميزة تجريبية).',
      title: 'بديل iLovePDF لتعديل ملفات PDF العربية',
      tested: 'تاريخ المراجعة: 12 نوفمبر 2026',
      summary:
        'يقول iLovePDF نفسه إن محرر المحتوى لديه، وهو الوضع الذي يغيّر النص الموجود، لا يدعم بعدُ اللغات المكتوبة من اليمين إلى اليسار. أما في BlendPDF فافتح ملفك في **تعديل PDF**، واختر **تعديل النص الموجود** (ميزة تجريبية)، ثم اضغط على السطر واكتبه من جديد. الأداة مجانية وبلا حساب، والتعديل يجري في متصفحك.',
      cta: 'عدّل ملف PDF',
      evidence: {
        title: 'تغيير سطر عربي في BlendPDF',
        intro:
          'كتبنا للتجربة شهادة عمل بالعربية من صفحة واحدة، وغيّرنا الاسم في أول سطر منها من «محمد العلوي» إلى «يوسف الإدريسي» في BlendPDF. هذا أعلى الصفحة قبل التعديل وبعده، والإطار الرمادي هو حافة الصفحة.',
        shots: {
          original: { label: 'الأصل', caption: 'السطر قبل التعديل.', alt: 'السطر العربي الأصلي، محاذًى إلى اليمين داخل هوامش الصفحة.' },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'الاسم الجديد في مكانه، والسطر ما زال يبدأ من الهامش الأيمن، وحروفه متصلة. لكنه كُتب بخط Noto Sans Arabic، وهو أبسط من الخط الأصلي.',
            alt: 'السطر بعد الحفظ في BlendPDF: الاسم الجديد من اليمين إلى اليسار داخل الهوامش، بحروف متصلة.',
          },
        },
      },
      quotes: {
        title: 'ما يقوله iLovePDF عن العربية',
        intro: 'في صفحة Edit PDF لديه هذه الجملة عن Content Editor، وهو الوضع الذي يغيّر النص الموجود:',
        glosses: ['ترجمتها: «محرر المحتوى لا يدعم حاليًا اللغات المكتوبة من اليمين إلى اليسار».'],
        after: 'أما أداة **تعديل النص الموجود** في BlendPDF (ميزة تجريبية) فتغيّر السطر العربي من اليمين إلى اليسار، سطرًا واحدًا في كل مرة.',
      },
      table: {
        title: 'مقارنة سريعة',
        head: ['ما قارنّاه', 'BlendPDF', 'iLovePDF'],
        rows: [
          {
            label: 'تغيير سطر عربي',
            blendpdf: 'كُتب من اليمين إلى اليسار، داخل الهوامش، بحروف متصلة.',
            them: 'بحسب صفحته، محرر المحتوى فيه لا يدعم بعدُ اللغات المكتوبة من اليمين إلى اليسار.',
          },
          {
            label: 'أين يذهب ملفك',
            blendpdf: 'التعديل يجري في متصفحك.',
            them: 'يُعالَج على خوادمه ويُحذف خلال ساعتين من المعالجة، بحسب شروطه.',
          },
          { label: 'الاستخدام المجاني', blendpdf: 'لا حدّ يوميًا لعدد المهام.', them: 'عدد المستندات محدود في النسخة المجانية، بحسب صفحة أسعاره.' },
        ],
        note: 'جرّبنا BlendPDF وقرأنا صفحات iLovePDF في 12 نوفمبر 2026، وقد يكون iLovePDF تغيّر بعد ذلك، فراجع شروطه الحالية على موقعه.',
      },
      strengths: {
        title: 'ما يُحسنه iLovePDF',
        items: [
          'موقعه متاح بالعربية أيضًا.',
          'يقبل في نسخته المجانية ملفات أكبر في بعض الأدوات: 100 ميجابايت للدمج والتقسيم والتعديل، و200 ميجابايت للضغط، مقابل 50 ميجابايت للملف في BlendPDF.',
          'محرر المحتوى فيه يتيح تحديد النص الموجود لتعديله أو نقله أو حذفه، في اللغات المكتوبة من اليسار إلى اليمين.',
        ],
      },
      faq: [
        {
          question: 'هل يدعم iLovePDF اللغة العربية؟',
          answer:
            'موقعه نعم، أما محرر النص الموجود فيه فلا، بحسب ما يقوله هو: في 12 نوفمبر 2026 كانت صفحة Edit PDF لديه تقول إن محرر المحتوى لا يدعم حاليًا اللغات المكتوبة من اليمين إلى اليسار.',
        },
        CHROME.ar.faq.freeEdit,
        CHROME.ar.faq.upload,
        {
          question: 'إلى متى يحتفظ iLovePDF بملفاتي؟',
          answer:
            'تقول شروطه إنه يحذفها خلال ساعتين من معالجتها على خوادمه (قرأناها في 12 نوفمبر 2026). أما محرر BlendPDF فلا يرفع ملفك إلا إذا طلبت أن نرسل لك النتيجة بالبريد الإلكتروني، والملفات المرسلة إلى أدواتنا الأخرى نحذفها خلال ساعة.',
        },
        CHROME.ar.faq.font,
      ],
      disclaimer:
        'اسم iLovePDF علامة تجارية لمالكها، ولا صلة بين BlendPDF وiLovePDF. كل ما في هذه الصفحة عن iLovePDF مأخوذ من صفحاته، وقد قرأناها في 12 نوفمبر 2026. وقد يكون تغيّر بعد ذلك، فراجع موقعه لمعرفة ميزاته وحدوده الحالية.',
      breadcrumb: 'BlendPDF مقابل iLovePDF',
      card: 'صفحته تقول إن محرر المحتوى فيه، وهو الذي يغيّر النص الموجود، لا يدعم بعدُ الكتابة من اليمين إلى اليسار.',
    },
  },
};
