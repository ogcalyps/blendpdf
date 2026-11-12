/**
 * /blendpdf-vs-sejda: the same Arabic line changed in Sejda's online editor
 * and in Edit PDF, tested by hand on 12 November 2026.
 */
import { editShots } from './shots';
import type { Comparison } from './types';

export const sejda: Comparison = {
  slug: 'sejda',
  path: '/blendpdf-vs-sejda',
  name: 'Sejda',
  howTo: 'edit',
  shots: editShots('sejda'),
  // What Sejda's editor showed on our Arabic page, word for word (it shows them in English)
  quotes: [
    { text: 'Right to left scripts are not fully supported (eg: Arabic, Hebrew)', lang: 'en' },
    { text: 'Complex script alphabets are not supported (eg: Arabic, Devanagari)', lang: 'en' },
  ],
  text: {
    en: {
      metaTitle: 'Sejda Alternative for Editing Arabic PDFs, Tested | BlendPDF',
      description: 'We changed the same Arabic line in Sejda’s online editor and in BlendPDF. Sejda’s line ran off the page, cutting off its first word. Ours stayed inside the margins.',
      title: 'A Sejda alternative for editing Arabic PDFs',
      tested: 'Tested 12 November 2026',
      summary: 'Sejda’s online editor warns that it doesn’t fully support Arabic, and in our test the changed Arabic line ran off the page. In BlendPDF, open your file in **Edit PDF**, choose **Edit existing text** (beta), click the line and type it again. It’s free with no hourly limit, and the editing runs in your browser.',
      cta: 'Edit an Arabic PDF',
      evidence: {
        title: 'Same page, same change',
        intro: 'We wrote a one-page Arabic work certificate for the test and changed the name in its first sentence, once in Sejda’s online editor (sejda.com/pdf-editor) and once in BlendPDF. Below is the top of each saved file. The grey frame is the edge of the page.',
        shots: {
          original: {
            label: 'Original',
            caption: 'The line before the change.',
            alt: 'The original Arabic line, right-aligned inside the page margins.',
          },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'The new name is in, the line still starts at the right margin and the letters are joined. It came out in Noto Sans Arabic, a plainer font than the original.',
            alt: 'BlendPDF’s saved line: the new name, right to left inside the margins, letters joined.',
          },
          them: {
            label: 'Sejda',
            caption: 'The line is anchored on the left and runs off the right edge of the page. Its first word is cut off.',
            alt: 'Sejda’s saved line: anchored on the left and running past the right edge of the page, its first word cut off.',
          },
        },
      },
      quotes: {
        title: 'What Sejda says about Arabic',
        intro: 'When we opened the Arabic page, Sejda’s editor showed these two notices:',
        after: 'When we clicked the Arabic line, the editor showed its letters reversed and not joined. So Sejda does warn you, and the saved file matched the warning.',
      },
      table: {
        title: 'Side by side',
        head: ['What we checked', 'BlendPDF', 'Sejda (online editor)'],
        rows: [
          {
            label: 'Changing an Arabic line',
            blendpdf: 'Written right to left, inside the margins, with joined letters.',
            them: 'Anchored on the left, ran off the right edge, first word cut off.',
          },
          {
            label: 'What it says about Arabic',
            blendpdf: 'The site and the editor are in Arabic too, and Arabic lines are written right to left.',
            them: '“Right to left scripts are not fully supported” and “Complex script alphabets are not supported”.',
          },
          {
            label: 'Where your file goes',
            blendpdf: 'The editing runs in your browser.',
            them: 'Files go to Sejda’s servers.',
          },
          {
            label: 'Free use',
            blendpdf: 'No hourly limit.',
            them: '3 tasks per hour on the free tier.',
          },
        ],
        note: 'Tested 12 November 2026. Sejda may have changed since, so check its current limits on sejda.com.',
      },
      faq: [
        {
          question: 'Does Sejda support Arabic?',
          answer: 'Not fully, by its own account. On 12 November 2026 its online editor showed two notices on our Arabic page: “Right to left scripts are not fully supported (eg: Arabic, Hebrew)” and “Complex script alphabets are not supported (eg: Arabic, Devanagari)”. When we changed a line and saved, the line ran off the right edge of the page.',
        },
        {
          question: 'Can I edit Arabic text in a PDF for free?',
          answer: 'Yes. In BlendPDF’s Edit PDF, choose Edit existing text (beta), click a line and type it again. It’s free, with no account and no watermark. It changes one line at a time.',
        },
        {
          question: 'Is my PDF uploaded while I edit it?',
          answer: 'No. The editing runs in your browser, so the file isn’t sent to our servers. It’s only uploaded if you ask us to email you the result.',
        },
        {
          question: 'How many PDFs can I edit?',
          answer: 'BlendPDF has no hourly limit. Sejda’s free tier allowed 3 tasks per hour when we checked on 12 November 2026.',
        },
        {
          question: 'Why does my changed Arabic line look different?',
          answer: 'The original font didn’t have every letter you typed, so the line was written in Noto Sans Arabic, the closest Arabic font we have. The words are right, but the style can differ from the lines around it.',
        },
      ],
      disclaimer: 'Sejda is a trademark of its owner. BlendPDF isn’t affiliated with Sejda. We ran this test ourselves on 12 November 2026 with the free online editor at sejda.com/pdf-editor. Sejda may have changed since, so check sejda.com for its current features and limits.',
      breadcrumb: 'BlendPDF vs Sejda',
      card: 'Its own editor warns that Arabic isn’t fully supported, and our edited Arabic line ran off the page.',
    },
    fr: {
      metaTitle: 'Alternative à Sejda pour modifier un PDF en arabe : notre test | BlendPDF',
      description: 'Nous avons modifié la même ligne d’un PDF en arabe dans l’éditeur en ligne de Sejda et dans BlendPDF. Sejda a coupé le premier mot ; BlendPDF a respecté les marges.',
      title: 'Une alternative à Sejda pour modifier un PDF en arabe',
      tested: 'Testé le 12 novembre 2026',
      summary: 'L’éditeur en ligne de Sejda indique lui-même qu’il ne prend pas entièrement en charge l’arabe, et lors de notre test, la ligne arabe modifiée a débordé de la page. Avec BlendPDF, ouvrez votre fichier dans **Modifier un PDF**, choisissez **Modifier le texte** (bêta), cliquez sur la ligne et saisissez-la de nouveau. C’est gratuit, sans limite par heure, et la modification se fait dans votre navigateur.',
      cta: 'Modifier un PDF en arabe',
      evidence: {
        title: 'La même page, la même modification',
        intro: 'Nous avons rédigé pour le test une attestation de travail d’une page en arabe, puis changé le nom sur sa première ligne, une fois dans l’éditeur en ligne de Sejda (sejda.com/pdf-editor) et une fois dans BlendPDF. Voici le haut de chaque fichier enregistré. Le cadre gris marque le bord de la page.',
        shots: {
          original: {
            label: 'Original',
            caption: 'La ligne avant la modification.',
            alt: 'La ligne arabe d’origine, alignée à droite, à l’intérieur des marges de la page.',
          },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'Le nouveau nom est en place, la ligne part toujours de la marge de droite et les lettres sont liées. Elle est écrite en Noto Sans Arabic, une police plus sobre que celle d’origine.',
            alt: 'La ligne enregistrée par BlendPDF : le nouveau nom, de droite à gauche à l’intérieur des marges, lettres liées.',
          },
          them: {
            label: 'Sejda',
            caption: 'La ligne est calée à gauche et dépasse le bord droit de la page. Son premier mot est coupé.',
            alt: 'La ligne enregistrée par Sejda : calée à gauche, elle dépasse le bord droit de la page et son premier mot est coupé.',
          },
        },
      },
      quotes: {
        title: 'Ce que Sejda dit de l’arabe',
        intro: 'À l’ouverture de la page en arabe, l’éditeur de Sejda a affiché ces deux avertissements, en anglais :',
        after: 'Autrement dit, l’écriture de droite à gauche n’est pas entièrement prise en charge, et les écritures complexes, comme l’arabe, ne le sont pas. Quand nous avons cliqué sur la ligne arabe, l’éditeur a affiché ses lettres détachées, dans l’ordre inverse. Sejda prévient donc bien, et le fichier enregistré lui a donné raison.',
      },
      table: {
        title: 'Côte à côte',
        head: ['Ce que nous avons vérifié', 'BlendPDF', 'Sejda (éditeur en ligne)'],
        rows: [
          {
            label: 'Modifier une ligne en arabe',
            blendpdf: 'Écrite de droite à gauche, à l’intérieur des marges, lettres liées.',
            them: 'Calée à gauche, sortie par le bord droit, premier mot coupé.',
          },
          {
            label: 'Ce que l’outil dit de l’arabe',
            blendpdf: 'Le site et l’éditeur existent aussi en arabe, et les lignes arabes sont écrites de droite à gauche.',
            them: 'Deux avertissements : l’écriture de droite à gauche n’est pas entièrement prise en charge, et les écritures complexes comme l’arabe ne le sont pas.',
          },
          {
            label: 'Où va votre fichier',
            blendpdf: 'La modification se fait dans votre navigateur.',
            them: 'Les fichiers sont envoyés sur les serveurs de Sejda.',
          },
          {
            label: 'Utilisation gratuite',
            blendpdf: 'Pas de limite par heure.',
            them: '3 tâches par heure dans la version gratuite.',
          },
        ],
        note: 'Testé le 12 novembre 2026. Sejda a pu changer depuis : vérifiez ses limites actuelles sur sejda.com.',
      },
      faq: [
        {
          question: 'Sejda prend-il en charge l’arabe ?',
          answer: 'Pas entièrement, de son propre aveu. Le 12 novembre 2026, sur notre page en arabe, son éditeur en ligne affichait deux avertissements : « Right to left scripts are not fully supported (eg: Arabic, Hebrew) » et « Complex script alphabets are not supported (eg: Arabic, Devanagari) ». Après modification et enregistrement, la ligne sortait par le bord droit de la page.',
        },
        {
          question: 'Peut-on modifier gratuitement du texte arabe dans un PDF ?',
          answer: 'Oui. Sur BlendPDF, ouvrez « Modifier un PDF », choisissez « Modifier le texte » (bêta), cliquez sur une ligne et saisissez-la de nouveau. C’est gratuit, sans compte ni filigrane. L’outil change une ligne à la fois.',
        },
        {
          question: 'Mon PDF est-il envoyé sur un serveur pendant la modification ?',
          answer: 'Non. La modification se fait dans votre navigateur : le fichier n’est pas envoyé sur nos serveurs, sauf si vous demandez à recevoir le résultat par courriel.',
        },
        {
          question: 'Combien de PDF puis-je modifier ?',
          answer: 'BlendPDF n’a pas de limite par heure. La version gratuite de Sejda permettait 3 tâches par heure lors de notre vérification, le 12 novembre 2026.',
        },
        {
          question: 'Pourquoi ma ligne arabe modifiée a-t-elle un autre aspect ?',
          answer: 'La police d’origine ne contenait pas toutes les lettres saisies : la ligne a donc été écrite en Noto Sans Arabic, la police arabe la plus proche dont nous disposons. Les mots sont justes, mais le style peut différer de celui des lignes voisines.',
        },
      ],
      disclaimer: 'Sejda est une marque de son propriétaire. BlendPDF n’a aucun lien avec Sejda. Nous avons fait ce test nous-mêmes le 12 novembre 2026, avec l’éditeur gratuit de sejda.com/pdf-editor. Sejda a pu évoluer depuis : consultez sejda.com pour connaître ses fonctions et ses limites actuelles.',
      breadcrumb: 'BlendPDF face à Sejda',
      card: 'Son éditeur prévient lui-même que l’arabe n’est pas entièrement pris en charge, et notre ligne arabe modifiée a débordé de la page.',
    },
    es: {
      metaTitle: 'Alternativa a Sejda para editar PDF en árabe: nuestra prueba | BlendPDF',
      description: 'Cambiamos la misma línea en árabe en el editor en línea de Sejda y en BlendPDF. En Sejda, la línea se salió de la página y su primera palabra quedó cortada. En BlendPDF, se quedó dentro de los márgenes.',
      title: 'Una alternativa a Sejda para editar PDF en árabe',
      tested: 'Probado el 12 de noviembre de 2026',
      summary: 'El editor en línea de Sejda advierte que no admite por completo el árabe, y en nuestra prueba la línea en árabe modificada se salió de la página. En BlendPDF, abra su archivo en **Editar PDF**, elija **Editar el texto** (beta), haga clic en la línea y vuelva a escribirla. Es gratis, sin límite por hora, y la edición se hace en su navegador.',
      cta: 'Editar un PDF en árabe',
      evidence: {
        title: 'La misma página, el mismo cambio',
        intro: 'Para la prueba redactamos un certificado de trabajo de una página en árabe y cambiamos el nombre de su primera frase: una vez en el editor en línea de Sejda (sejda.com/pdf-editor) y otra en BlendPDF. Abajo se ve la parte superior de cada archivo guardado. El marco gris es el borde de la página.',
        shots: {
          original: {
            label: 'Original',
            caption: 'La línea antes del cambio.',
            alt: 'La línea original en árabe, alineada a la derecha dentro de los márgenes de la página.',
          },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'El nombre nuevo está en su lugar, la línea sigue empezando en el margen derecho y las letras están unidas. Quedó escrita en Noto Sans Arabic, una fuente más sencilla que la original.',
            alt: 'La línea guardada por BlendPDF: el nombre nuevo, de derecha a izquierda dentro de los márgenes, con las letras unidas.',
          },
          them: {
            label: 'Sejda',
            caption: 'La línea queda anclada a la izquierda y se sale por el borde derecho de la página. Su primera palabra queda cortada.',
            alt: 'La línea guardada por Sejda: anclada a la izquierda, se sale por el borde derecho de la página y su primera palabra queda cortada.',
          },
        },
      },
      quotes: {
        title: 'Lo que dice Sejda sobre el árabe',
        intro: 'Al abrir la página en árabe, el editor de Sejda mostró estos dos avisos, en inglés:',
        after: 'Es decir, las escrituras de derecha a izquierda, como el árabe o el hebreo, no son totalmente compatibles, y los alfabetos de escritura compleja, como el árabe o el devanagari, no son compatibles. Cuando hicimos clic en la línea en árabe, el editor mostró sus letras al revés y sin unir. Así que Sejda sí avisa, y el archivo guardado coincidió con el aviso.',
      },
      table: {
        title: 'Comparación directa',
        head: ['Lo que comprobamos', 'BlendPDF', 'Sejda (editor en línea)'],
        rows: [
          {
            label: 'Cambiar una línea en árabe',
            blendpdf: 'Escrita de derecha a izquierda, dentro de los márgenes, con las letras unidas.',
            them: 'Anclada a la izquierda, se salió por el borde derecho y la primera palabra quedó cortada.',
          },
          {
            label: 'Lo que dice sobre el árabe',
            blendpdf: 'El sitio y el editor también están en árabe, y las líneas en árabe se escriben de derecha a izquierda.',
            them: 'Dos avisos: la escritura de derecha a izquierda no es totalmente compatible, y los alfabetos de escritura compleja, como el árabe, no son compatibles.',
          },
          {
            label: 'Adónde va su archivo',
            blendpdf: 'La edición se hace en su navegador.',
            them: 'Los archivos se envían a los servidores de Sejda.',
          },
          {
            label: 'Uso gratuito',
            blendpdf: 'Sin límite por hora.',
            them: '3 tareas por hora en el plan gratuito.',
          },
        ],
        note: 'Probado el 12 de noviembre de 2026. Sejda puede haber cambiado desde entonces: consulte sus límites actuales en sejda.com.',
      },
      faq: [
        {
          question: '¿Sejda admite el árabe?',
          answer: 'No por completo, según el propio Sejda. El 12 de noviembre de 2026, su editor en línea mostró dos avisos en nuestra página en árabe: “Right to left scripts are not fully supported (eg: Arabic, Hebrew)” y “Complex script alphabets are not supported (eg: Arabic, Devanagari)”. Cuando cambiamos una línea y guardamos, la línea se salió por el borde derecho de la página.',
        },
        {
          question: '¿Puedo editar texto en árabe en un PDF gratis?',
          answer: 'Sí. En “Editar PDF” de BlendPDF, elija “Editar el texto” (beta), haga clic en una línea y vuelva a escribirla. Es gratuito, sin cuenta y sin marca de agua. Cambia una línea a la vez.',
        },
        {
          question: '¿Se sube mi PDF mientras lo edito?',
          answer: 'No. La edición se hace en su navegador, así que el archivo no se envía a nuestros servidores. Solo se sube si nos pide que le enviemos el resultado por correo electrónico.',
        },
        {
          question: '¿Cuántos PDF puedo editar?',
          answer: 'BlendPDF no tiene límite por hora. El plan gratuito de Sejda permitía 3 tareas por hora cuando lo comprobamos, el 12 de noviembre de 2026.',
        },
        {
          question: '¿Por qué mi línea en árabe se ve distinta después del cambio?',
          answer: 'La fuente original no tenía todas las letras que usted escribió, así que la línea se escribió con Noto Sans Arabic, la fuente árabe más parecida que tenemos. Las palabras son correctas, pero el estilo puede ser distinto del de las líneas de alrededor.',
        },
      ],
      disclaimer: 'Sejda es una marca comercial de su propietario. BlendPDF no tiene ninguna relación con Sejda. Hicimos esta prueba nosotros mismos el 12 de noviembre de 2026 con el editor gratuito en línea de sejda.com/pdf-editor. Sejda puede haber cambiado desde entonces: consulte sejda.com para conocer sus funciones y límites actuales.',
      breadcrumb: 'BlendPDF frente a Sejda',
      card: 'Su propio editor advierte que el árabe no es totalmente compatible, y nuestra línea en árabe modificada se salió de la página.',
    },
    ar: {
      metaTitle: 'بديل Sejda لتعديل ملفات PDF العربية: جرّبنا الأداتين | BlendPDF',
      description: 'عدّلنا السطر العربي نفسه في Sejda وفي BlendPDF: في Sejda تجاوز حافة الصفحة وقُصّت أول كلمة، وفي BlendPDF بقي داخل الهوامش مكتوبًا من اليمين إلى اليسار بحروف متصلة.',
      title: 'بديل Sejda لتعديل ملفات PDF العربية',
      tested: 'تاريخ الاختبار: 12 نوفمبر 2026',
      summary: 'يقول Sejda نفسه إن محرره على الإنترنت لا يدعم العربية دعمًا كاملًا، وفي تجربتنا خرج السطر العربي المعدَّل من الصفحة. أما في BlendPDF فافتح ملفك في **تعديل PDF**، واختر **تعديل النص الموجود** (ميزة تجريبية)، ثم اضغط على السطر واكتبه من جديد. الأداة مجانية ولا حدّ لعدد المهام في الساعة، والتعديل يجري في متصفحك.',
      cta: 'عدّل ملف PDF',
      evidence: {
        title: 'الصفحة نفسها والتعديل نفسه',
        intro: 'كتبنا للتجربة شهادة عمل بالعربية من صفحة واحدة، وغيّرنا الاسم في أول سطر منها من «محمد العلوي» إلى «يوسف الإدريسي»: مرة في محرر Sejda على الإنترنت، ومرة في BlendPDF. هذا أعلى الصفحة في كل ملف بعد الحفظ، والإطار الرمادي هو حافة الصفحة.',
        shots: {
          original: {
            label: 'الأصل',
            caption: 'السطر قبل التعديل.',
            alt: 'السطر العربي الأصلي، محاذًى إلى اليمين داخل هوامش الصفحة.',
          },
          blendpdf: {
            label: 'BlendPDF',
            caption: 'الاسم الجديد في مكانه، والسطر ما زال يبدأ من الهامش الأيمن، وحروفه متصلة. لكنه كُتب بخط Noto Sans Arabic، وهو أبسط من الخط الأصلي.',
            alt: 'السطر بعد الحفظ في BlendPDF: الاسم الجديد من اليمين إلى اليسار داخل الهوامش، بحروف متصلة.',
          },
          them: {
            label: 'Sejda',
            caption: 'صار السطر محاذًى إلى اليسار وتجاوز الحافة اليمنى للصفحة، فقُصّت كلمته الأولى «تشهد».',
            alt: 'السطر بعد الحفظ في Sejda: محاذًى إلى اليسار ويتجاوز الحافة اليمنى للصفحة، وأول كلمة منه مقطوعة.',
          },
        },
      },
      quotes: {
        title: 'ما يقوله Sejda عن العربية',
        intro: 'حين فتحنا ملف التجربة في محرر Sejda، ظهر هذان التنبيهان بالإنجليزية:',
        after: 'ومعناهما أن الكتابة من اليمين إلى اليسار غير مدعومة بالكامل، وأن أنظمة الكتابة المعقّدة، كالعربية، غير مدعومة. ولما ضغطنا على السطر العربي، ظهرت حروفه في المحرر معكوسة ومنفصلة. إذن لا يُخفي Sejda ذلك، والملف المحفوظ جاء كما حذّر.',
      },
      table: {
        title: 'مقارنة سريعة',
        head: ['ما قارنّاه', 'BlendPDF', 'Sejda (المحرر على الإنترنت)'],
        rows: [
          {
            label: 'تغيير سطر عربي',
            blendpdf: 'كُتب من اليمين إلى اليسار، داخل الهوامش، بحروف متصلة.',
            them: 'صار محاذًى إلى اليسار وتجاوز الحافة اليمنى، فقُصّت أول كلمة.',
          },
          {
            label: 'ما تقوله الأداة عن العربية',
            blendpdf: 'الموقع والمحرر متاحان بالعربية، والسطر العربي يُكتب من اليمين إلى اليسار.',
            them: 'تنبيهان: الكتابة من اليمين إلى اليسار غير مدعومة بالكامل، وأنظمة الكتابة المعقّدة كالعربية غير مدعومة.',
          },
          {
            label: 'أين يذهب ملفك',
            blendpdf: 'التعديل يجري في متصفحك.',
            them: 'تُرفع الملفات إلى خوادم Sejda.',
          },
          {
            label: 'الاستخدام المجاني',
            blendpdf: 'لا حدّ لعدد المهام في الساعة.',
            them: 'ثلاث مهام في الساعة بالنسخة المجانية.',
          },
        ],
        note: 'أجرينا الاختبار في 12 نوفمبر 2026، وقد يكون Sejda تغيّر بعده، فراجع حدوده الحالية على موقعه.',
      },
      faq: [
        {
          question: 'هل يدعم Sejda اللغة العربية؟',
          answer: 'ليس بالكامل، بحسب ما يقوله هو نفسه. في 12 نوفمبر 2026 فتحنا ملفًا عربيًا في محرر Sejda، فعرض تنبيهين بالإنجليزية معناهما أن الكتابة من اليمين إلى اليسار غير مدعومة بالكامل، وأن أنظمة الكتابة المعقّدة كالعربية غير مدعومة. ولما غيّرنا سطرًا وحفظنا الملف، تجاوز السطر الحافة اليمنى للصفحة.',
        },
        {
          question: 'هل يمكنني تعديل نص عربي في ملف PDF مجانًا؟',
          answer: 'نعم. افتح «تعديل PDF» في BlendPDF، واختر «تعديل النص الموجود» (ميزة تجريبية)، ثم اضغط على السطر واكتبه من جديد. الأداة مجانية، بلا حساب ولا علامة مائية، وتغيّر سطرًا واحدًا في كل مرة.',
        },
        {
          question: 'هل يُرفع ملفي إلى خادم أثناء التعديل؟',
          answer: 'لا. التعديل يجري في متصفحك، فلا يصل الملف إلى خوادمنا، إلا إذا طلبت أن نرسل لك النتيجة بالبريد الإلكتروني.',
        },
        {
          question: 'كم ملفًا يمكنني تعديله؟',
          answer: 'لا حد في BlendPDF لعدد المهام في الساعة. أما النسخة المجانية من Sejda فكانت تسمح بثلاث مهام في الساعة حين راجعناها في 12 نوفمبر 2026.',
        },
        {
          question: 'لماذا يبدو السطر العربي المعدَّل مختلفًا عن بقية النص؟',
          answer: 'لأن الخط الأصلي لم يكن يضم كل الحروف التي كتبتها، فكتبنا السطر بخط Noto Sans Arabic، وهو أقرب خط عربي لدينا. الكلمات صحيحة، لكن خطها قد يختلف عن خط الأسطر المجاورة.',
        },
      ],
      disclaimer: 'اسم Sejda علامة تجارية لمالكها، ولا صلة بين BlendPDF وSejda. أجرينا هذا الاختبار بأنفسنا في 12 نوفمبر 2026 على محرر Sejda المجاني عبر الإنترنت، وقد يكون تغيّر بعد ذلك، فراجع موقع sejda.com لمعرفة ميزاته وحدوده الحالية.',
      breadcrumb: 'BlendPDF مقابل Sejda',
      card: 'محرره نفسه ينبّه إلى أن العربية غير مدعومة بالكامل، وسطرنا العربي المعدَّل تجاوز حافة الصفحة.',
    },
  },
};
