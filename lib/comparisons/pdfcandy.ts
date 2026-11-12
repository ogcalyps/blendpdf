/**
 * /blendpdf-vs-pdfcandy: the same Arabic line added in PDF Candy's editor and
 * in Edit PDF on 12 November 2026. PDF Candy's line is real, joined text, but
 * its words are in reverse order (pdftotext -bbox: «السيد» leftmost). We
 * couldn't change an existing line there, which isn't the same as "it can't".
 */
import { CHROME } from './chrome';
import { addShots } from './shots';
import type { Comparison } from './types';

export const pdfcandy: Comparison = {
  slug: 'pdfcandy',
  path: '/blendpdf-vs-pdfcandy',
  name: 'PDF Candy',
  howTo: 'add',
  shots: addShots('pdfcandy'),
  quotes: [
    { text: 'replace or delete entire paragraphs, and correct typos instantly', lang: 'en', source: 'https://pdfcandy.com/edit-pdf.html' },
    { text: 'Page and hourly restrictions', lang: 'en', source: 'https://pdfcandy.com/pricing.html' },
  ],
  text: {
    en: {
      metaTitle: 'PDF Candy Alternative for Arabic PDFs, Tested | BlendPDF',
      description:
        'We added the same Arabic line in PDF Candy and in BlendPDF. Both saved real text with joined letters, but PDF Candy put the words in reverse order.',
      title: 'A PDF Candy alternative for Arabic PDFs',
      tested: 'Tested 12 November 2026',
      summary:
        'Of the free editors we tried for adding Arabic, PDF Candy was the only other one to save real text with joined letters. But its three words were saved in reverse order, and its free plan has “Page and hourly restrictions”. In BlendPDF, **Text** keeps Arabic words in order, **Edit existing text** (beta) changes a line, and there’s no hourly limit.',
      cta: 'Edit an Arabic PDF',
      evidence: {
        title: 'Same page, same words',
        intro:
          'We added “السيد يوسف الإدريسي” (three words: a title and a name) to a one-page Arabic work certificate, once with PDF Candy’s Text tool and once with BlendPDF’s, without an account. Below is the part of each saved page where the words went.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'All three words in order, right to left, with joined letters.',
            alt: 'BlendPDF’s saved line: “السيد يوسف الإدريسي”, three words with joined letters.',
          },
          them: {
            label: 'PDF Candy',
            caption: 'Real text with joined letters, but the words are in reverse order: read right to left, the line says “الإدريسي يوسف السيد”.',
            alt: 'PDF Candy’s saved line: three words with joined letters, in reverse order.',
          },
        },
      },
      quotes: {
        title: 'What PDF Candy says on its own pages',
        intro: 'About its editor, and about its free plan:',
        after:
          'In our test, double-clicking the Arabic line only selected it, and we couldn’t change it, so we can’t confirm the first claim for Arabic.',
      },
      table: {
        title: 'Side by side',
        head: ['What we checked', 'BlendPDF', 'PDF Candy'],
        rows: [
          { label: 'Adding an Arabic line', blendpdf: 'Real text, joined, words in order.', them: 'Real text, joined, words in reverse order.' },
          {
            label: 'Changing an Arabic line',
            blendpdf: 'Changed in place, one line at a time (beta).',
            them: 'We couldn’t change it in our test; its page says the editor replaces whole paragraphs.',
          },
          { label: 'Free use', blendpdf: 'No hourly limit.', them: '“Page and hourly restrictions” on the free plan.' },
          {
            label: 'When files are deleted',
            blendpdf: 'Within an hour for uploaded files. The editor only uploads if you ask for the result by email.',
            them: 'Kept on its servers “for no longer than 2 hours”.',
          },
        ],
        note: 'Tested 12 November 2026, with PDF Candy’s pages read the same day. PDF Candy may have changed since, so check pdfcandy.com.',
      },
      strengths: {
        title: 'Where PDF Candy does well',
        items: [
          'Its added Arabic is real, searchable text with joined letters. In the same test, Smallpdf’s letters weren’t joined and PDF24’s line was a picture.',
          'Its editor page says it edits whole paragraphs of existing text, more than BlendPDF’s one line at a time.',
          'Its free plan takes files up to 50 MB, the same as ours, and its site is in Arabic too.',
        ],
      },
      faq: [
        {
          question: 'Does PDF Candy handle Arabic?',
          answer:
            'Partly. On 12 November 2026 it was the only other editor in our add-text test to save real text with joined letters. But its three words were saved in reverse order, so check the result before you send the file.',
        },
        {
          question: 'Can PDF Candy change existing text?',
          answer:
            'Its editor page says it can “replace or delete entire paragraphs, and correct typos instantly”. In our test, double-clicking the Arabic line only selected it, and we couldn’t change it. BlendPDF changes an existing Arabic line in place, one line at a time (beta).',
        },
        {
          question: 'Is free use limited?',
          answer: 'PDF Candy’s pricing page lists “Page and hourly restrictions” on the free plan (read on 12 November 2026). BlendPDF has no hourly or daily limit.',
        },
        CHROME.en.faq.upload,
        CHROME.en.faq.realText,
      ],
      disclaimer:
        'PDF Candy is a trademark of its owner. BlendPDF isn’t affiliated with PDF Candy. We ran this test ourselves on 12 November 2026 on pdfcandy.com, without an account, and quote its pages as they read that day. PDF Candy may have changed since, so check pdfcandy.com for its current features and limits.',
      breadcrumb: 'BlendPDF vs PDF Candy',
      card: 'Its added Arabic is real text with joined letters, but the words came out in reverse order, and its free plan has hourly limits.',
    },

    fr: {
      metaTitle: 'Alternative à PDF Candy pour les PDF en arabe : notre test | BlendPDF',
      description:
        'Nous avons ajouté la même ligne en arabe avec PDF Candy et avec BlendPDF. Les deux ont enregistré du vrai texte aux lettres liées, mais PDF Candy a inversé l’ordre des mots.',
      title: 'Une alternative à PDF Candy pour les PDF en arabe',
      tested: 'Testé le 12 novembre 2026',
      summary:
        'Parmi les éditeurs gratuits que nous avons essayés pour ajouter de l’arabe, PDF Candy est le seul autre à avoir enregistré du vrai texte aux lettres liées. Mais ses trois mots ont été enregistrés dans l’ordre inverse, et son offre gratuite comporte des limites de pages et des limites horaires. Avec BlendPDF, **Texte** garde les mots arabes dans l’ordre, **Modifier le texte** (bêta) change une ligne, et il n’y a pas de limite horaire.',
      cta: 'Modifier un PDF en arabe',
      evidence: {
        title: 'La même page, les mêmes mots',
        intro:
          'Nous avons ajouté « السيد يوسف الإدريسي » (trois mots : une civilité et un nom) sur une attestation de travail d’une page en arabe, une fois avec l’outil Texte de PDF Candy et une fois avec celui de BlendPDF, sans compte. Voici la partie de chaque page enregistrée où les mots ont été placés.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'Les trois mots dans l’ordre, de droite à gauche, lettres liées.',
            alt: 'La ligne enregistrée par BlendPDF : « السيد يوسف الإدريسي », trois mots aux lettres liées.',
          },
          them: {
            label: 'PDF Candy',
            caption: 'Du vrai texte aux lettres liées, mais les mots sont dans l’ordre inverse : lue de droite à gauche, la ligne donne « الإدريسي يوسف السيد ».',
            alt: 'La ligne enregistrée par PDF Candy : trois mots aux lettres liées, dans l’ordre inverse.',
          },
        },
      },
      quotes: {
        title: 'Ce que dit PDF Candy sur ses propres pages',
        intro: 'Sur son éditeur, et sur son offre gratuite :',
        glosses: [
          'Traduction : « remplacer ou supprimer des paragraphes entiers, et corriger les fautes de frappe instantanément »',
          'Traduction : « Limites de pages et limites horaires »',
        ],
        after:
          'Lors de notre test, un double-clic sur la ligne arabe n’a fait que la sélectionner, et nous n’avons pas pu la modifier : nous ne pouvons donc pas confirmer la première affirmation pour l’arabe.',
      },
      table: {
        title: 'Côte à côte',
        head: ['Ce que nous avons vérifié', 'BlendPDF', 'PDF Candy'],
        rows: [
          {
            label: 'Ajouter une ligne en arabe',
            blendpdf: 'Vrai texte, lettres liées, mots dans l’ordre.',
            them: 'Vrai texte, lettres liées, mots dans l’ordre inverse.',
          },
          {
            label: 'Modifier une ligne en arabe',
            blendpdf: 'Modifiée directement dans la page, une ligne à la fois (bêta).',
            them: 'Nous n’avons pas pu la modifier lors de notre test ; sa page indique que l’éditeur remplace des paragraphes entiers.',
          },
          { label: 'Utilisation gratuite', blendpdf: 'Pas de limite horaire.', them: 'Des limites de pages et des limites horaires dans l’offre gratuite.' },
          {
            label: 'Suppression des fichiers',
            blendpdf: 'Dans l’heure pour les fichiers envoyés. L’éditeur n’envoie rien, sauf si vous demandez le résultat par courriel.',
            them: 'Conservés sur ses serveurs deux heures au maximum, d’après sa page de tarifs.',
          },
        ],
        note: 'Testé le 12 novembre 2026, pages de PDF Candy consultées le même jour. PDF Candy a pu changer depuis : vérifiez sur pdfcandy.com.',
      },
      strengths: {
        title: 'Les points forts de PDF Candy',
        items: [
          'Les mots arabes qu’il ajoute sont du vrai texte, aux lettres liées, qu’on peut rechercher. Dans le même test, Smallpdf a détaché les lettres et PDF24 a enregistré une image.',
          'Sa page d’édition indique qu’il modifie des paragraphes entiers de texte existant, là où BlendPDF modifie une ligne à la fois.',
          'Son offre gratuite accepte des fichiers jusqu’à 50 Mo, comme la nôtre, et son site existe aussi en arabe.',
        ],
      },
      faq: [
        {
          question: 'PDF Candy gère-t-il l’arabe ?',
          answer:
            'En partie. Le 12 novembre 2026, c’était le seul autre éditeur de notre test d’ajout de texte à enregistrer du vrai texte aux lettres liées. Mais ses trois mots ont été enregistrés dans l’ordre inverse : vérifiez le résultat avant d’envoyer le fichier.',
        },
        {
          question: 'PDF Candy peut-il modifier le texte existant ?',
          answer:
            'Sa page d’édition indique qu’il peut « replace or delete entire paragraphs, and correct typos instantly ». Lors de notre test, un double-clic sur la ligne arabe n’a fait que la sélectionner, et nous n’avons pas pu la modifier. BlendPDF modifie une ligne arabe existante directement dans la page, une ligne à la fois (bêta).',
        },
        {
          question: 'L’utilisation gratuite est-elle limitée ?',
          answer:
            'La page de tarifs de PDF Candy mentionne des « Page and hourly restrictions » pour l’offre gratuite (consultée le 12 novembre 2026). BlendPDF n’a aucune limite horaire ni quotidienne.',
        },
        CHROME.fr.faq.upload,
        CHROME.fr.faq.realText,
      ],
      disclaimer:
        'PDF Candy est une marque de son propriétaire. BlendPDF n’a aucun lien avec PDF Candy. Nous avons fait ce test nous-mêmes le 12 novembre 2026 sur pdfcandy.com, sans compte, et nous citons ses pages telles qu’elles étaient ce jour-là. PDF Candy a pu évoluer depuis : consultez pdfcandy.com pour connaître ses fonctions et ses limites actuelles.',
      breadcrumb: 'BlendPDF face à PDF Candy',
      card: 'Les mots arabes qu’il ajoute sont du vrai texte aux lettres liées, mais ils ont été enregistrés dans l’ordre inverse, et son offre gratuite a des limites horaires.',
    },

    es: {
      metaTitle: 'Alternativa a PDF Candy para PDF en árabe: lo probamos | BlendPDF',
      description:
        'Agregamos la misma línea en árabe en PDF Candy y en BlendPDF. Los dos guardaron texto real con las letras unidas, pero PDF Candy puso las palabras en orden inverso.',
      title: 'Una alternativa a PDF Candy para PDF en árabe',
      tested: 'Probado el 12 de noviembre de 2026',
      summary:
        'De los editores gratuitos que probamos para agregar texto en árabe, PDF Candy fue el único, aparte de BlendPDF, que guardó texto real con las letras unidas. Pero guardó sus tres palabras en orden inverso, y su plan gratuito tiene “Page and hourly restrictions” (límites de páginas y por hora). En BlendPDF, **Texto** mantiene el orden de las palabras en árabe, **Editar el texto** (beta) cambia una línea y no hay límite por hora.',
      cta: 'Editar un PDF en árabe',
      evidence: {
        title: 'La misma página, las mismas palabras',
        intro:
          'Agregamos “السيد يوسف الإدريسي” (tres palabras: un tratamiento de cortesía y un nombre) a un certificado de trabajo en árabe de una página, una vez con la herramienta de texto de PDF Candy y otra con la de BlendPDF, sin cuenta. Abajo se ve la parte de cada página guardada donde quedaron las palabras.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'Las tres palabras en orden, de derecha a izquierda, con las letras unidas.',
            alt: 'La línea guardada por BlendPDF: “السيد يوسف الإدريسي”, tres palabras con las letras unidas.',
          },
          them: {
            label: 'PDF Candy',
            caption: 'Texto real con las letras unidas, pero las palabras están en orden inverso: leída de derecha a izquierda, la línea dice “الإدريسي يوسف السيد”.',
            alt: 'La línea guardada por PDF Candy: tres palabras con las letras unidas, en orden inverso.',
          },
        },
      },
      quotes: {
        title: 'Lo que dice PDF Candy en sus propias páginas',
        intro: 'Sobre su editor y sobre su plan gratuito:',
        glosses: [
          'Traducción: “reemplazar o eliminar párrafos enteros y corregir errores tipográficos al instante”',
          'Traducción: “Límites de páginas y por hora”',
        ],
        after:
          'En nuestra prueba, al hacer doble clic en la línea en árabe solo se seleccionaba, y no pudimos cambiarla, así que no podemos confirmar la primera afirmación para el árabe.',
      },
      table: {
        title: 'Comparación directa',
        head: ['Lo que comprobamos', 'BlendPDF', 'PDF Candy'],
        rows: [
          {
            label: 'Agregar una línea en árabe',
            blendpdf: 'Texto real, letras unidas, palabras en orden.',
            them: 'Texto real, letras unidas, palabras en orden inverso.',
          },
          {
            label: 'Cambiar una línea en árabe',
            blendpdf: 'Se cambia directamente en la página, una línea a la vez (beta).',
            them: 'No pudimos cambiarla en nuestra prueba. Su página dice que el editor reemplaza párrafos enteros.',
          },
          { label: 'Uso gratuito', blendpdf: 'Sin límite por hora.', them: '“Page and hourly restrictions” (límites de páginas y por hora) en el plan gratuito.' },
          {
            label: 'Cuándo se eliminan los archivos',
            blendpdf: 'En un plazo de una hora, para los archivos que se suben. El editor solo sube el archivo si usted pide el resultado por correo electrónico.',
            them: 'Se guardan en sus servidores 2 horas como máximo, según PDF Candy.',
          },
        ],
        note: 'Probado el 12 de noviembre de 2026, con las páginas de PDF Candy consultadas ese mismo día. PDF Candy puede haber cambiado desde entonces: consulte pdfcandy.com.',
      },
      strengths: {
        title: 'Lo que PDF Candy hace bien',
        items: [
          'El árabe que agrega es texto real, con las letras unidas, y se puede buscar. En la misma prueba, Smallpdf dejó las letras separadas y PDF24 guardó la línea como imagen.',
          'Según la página de su editor, edita párrafos enteros del texto existente, más que BlendPDF, que cambia una línea a la vez.',
          'Su plan gratuito acepta archivos de hasta 50 MB, igual que el nuestro, y su sitio también está en árabe.',
        ],
      },
      faq: [
        {
          question: '¿PDF Candy funciona con el árabe?',
          answer:
            'En parte. El 12 de noviembre de 2026 fue el único editor de nuestra prueba de agregar texto, aparte de BlendPDF, que guardó texto real con las letras unidas. Pero guardó sus tres palabras en orden inverso, así que revise el resultado antes de enviar el archivo.',
        },
        {
          question: '¿PDF Candy puede cambiar el texto existente?',
          answer:
            'La página de su editor dice que puede “replace or delete entire paragraphs, and correct typos instantly” (reemplazar o eliminar párrafos enteros y corregir errores tipográficos al instante). En nuestra prueba, al hacer doble clic en la línea en árabe solo se seleccionaba, y no pudimos cambiarla. BlendPDF cambia una línea existente en árabe directamente en la página, una línea a la vez (beta).',
        },
        {
          question: '¿El uso gratuito tiene límites?',
          answer:
            'La página de precios de PDF Candy indica “Page and hourly restrictions” (límites de páginas y por hora) en el plan gratuito (consultada el 12 de noviembre de 2026). BlendPDF no tiene límite por hora ni por día.',
        },
        CHROME.es.faq.upload,
        CHROME.es.faq.realText,
      ],
      disclaimer:
        'PDF Candy es una marca comercial de su propietario. BlendPDF no tiene ninguna relación con PDF Candy. Hicimos esta prueba nosotros mismos el 12 de noviembre de 2026 en pdfcandy.com, sin cuenta, y citamos sus páginas tal como estaban ese día. PDF Candy puede haber cambiado desde entonces: consulte pdfcandy.com para ver sus funciones y límites actuales.',
      breadcrumb: 'BlendPDF frente a PDF Candy',
      card: 'El árabe que agrega es texto real con las letras unidas, pero las palabras quedaron en orden inverso, y su plan gratuito tiene límites por hora.',
    },

    ar: {
      metaTitle: 'بديل PDF Candy لملفات PDF العربية: جرّبنا الأداتين | BlendPDF',
      description:
        'أضفنا السطر العربي نفسه في PDF Candy وفي BlendPDF: كلاهما حفظ نصًا حقيقيًا بحروف متصلة، لكن PDF Candy قلب ترتيب الكلمات.',
      title: 'بديل PDF Candy لملفات PDF العربية',
      tested: 'تاريخ الاختبار: 12 نوفمبر 2026',
      summary:
        'من بين المحررات المجانية التي جرّبنا فيها إضافة نص عربي، كان PDF Candy الوحيد غيرنا الذي حفظه نصًا حقيقيًا بحروف متصلة، لكن كلماته الثلاث جاءت بترتيب معكوس، ونسخته المجانية فيها حدود على الصفحات وعلى الاستخدام في الساعة. أما في BlendPDF فأداة **نص** تحفظ الكلمات العربية بترتيبها، وأداة **تعديل النص الموجود** (ميزة تجريبية) تغيّر السطر، ولا حدّ لعدد المهام في الساعة.',
      cta: 'عدّل ملف PDF',
      evidence: {
        title: 'الصفحة نفسها والكلمات نفسها',
        intro:
          'أضفنا «السيد يوسف الإدريسي» (ثلاث كلمات: «السيد» ثم الاسم) إلى شهادة عمل عربية من صفحة واحدة: مرة بأداة النص في PDF Candy، ومرة بأداة «نص» في BlendPDF، دون حساب. وهذا موضع الكلمات في كل ملف بعد الحفظ.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'الكلمات الثلاث بترتيبها، من اليمين إلى اليسار، بحروف متصلة.',
            alt: 'السطر بعد الحفظ في BlendPDF: «السيد يوسف الإدريسي»، ثلاث كلمات بحروف متصلة.',
          },
          them: {
            label: 'PDF Candy',
            caption: 'نص حقيقي بحروف متصلة، لكن الكلمات جاءت بترتيب معكوس، فصار السطر يُقرأ «الإدريسي يوسف السيد».',
            alt: 'السطر بعد الحفظ في PDF Candy: ثلاث كلمات متصلة الحروف بترتيب معكوس.',
          },
        },
      },
      quotes: {
        title: 'ما يقوله PDF Candy في صفحاته',
        intro: 'عن محرره، وعن نسخته المجانية:',
        glosses: ['ترجمتها: «استبدال فقرات كاملة أو حذفها، وتصحيح الأخطاء المطبعية فورًا»', 'ترجمتها: «حدود على عدد الصفحات وعلى الاستخدام في الساعة»'],
        after: 'في تجربتنا، حين نقرنا مرتين على السطر العربي اكتفى المحرر بتحديده، ولم نتمكن من تغييره، لذا لا نستطيع أن نؤكد أن الجملة الأولى تنطبق على العربية.',
      },
      table: {
        title: 'مقارنة سريعة',
        head: ['ما قارنّاه', 'BlendPDF', 'PDF Candy'],
        rows: [
          { label: 'إضافة سطر عربي', blendpdf: 'نص حقيقي، بحروف متصلة، والكلمات بترتيبها.', them: 'نص حقيقي، بحروف متصلة، لكن الكلمات بترتيب معكوس.' },
          {
            label: 'تغيير سطر عربي',
            blendpdf: 'يتغيّر في مكانه، سطرًا سطرًا (ميزة تجريبية).',
            them: 'لم نستطع تغييره في تجربتنا، وصفحته تقول إن المحرر يستبدل فقرات كاملة.',
          },
          { label: 'الاستخدام المجاني', blendpdf: 'لا حدّ لعدد المهام في الساعة.', them: 'حدود على الصفحات وعلى الاستخدام في الساعة في النسخة المجانية.' },
          {
            label: 'متى تُحذف الملفات',
            blendpdf: 'خلال ساعة للملفات المرفوعة، والمحرر لا يرفع شيئًا إلا إذا طلبت النتيجة بالبريد الإلكتروني.',
            them: 'تبقى على خوادمه ساعتين على الأكثر، بحسب صفحة أسعاره.',
          },
        ],
        note: 'أجرينا الاختبار وقرأنا صفحات PDF Candy في 12 نوفمبر 2026، وقد يكون تغيّر بعد ذلك، فراجع موقعه pdfcandy.com.',
      },
      strengths: {
        title: 'ما يُحسنه PDF Candy',
        items: [
          'يحفظ PDF Candy العربية المضافة نصًا حقيقيًا بحروف متصلة يمكن البحث فيه. وفي الاختبار نفسه، جاءت الحروف في Smallpdf منفصلة، وحفظ PDF24 السطر صورةً.',
          'تقول صفحة محرره إنه يعدّل فقرات كاملة من النص الموجود، وهذا أكثر من السطر الواحد الذي يغيّره BlendPDF.',
          'نسخته المجانية تقبل ملفات حتى 50 ميجابايت، مثلنا، وموقعه متاح بالعربية أيضًا.',
        ],
      },
      faq: [
        {
          question: 'هل يتعامل PDF Candy مع العربية؟',
          answer:
            'جزئيًا. في اختبار إضافة النص يوم 12 نوفمبر 2026، كان المحرر الوحيد غيرنا الذي حفظ السطر العربي نصًا حقيقيًا بحروف متصلة. لكن كلماته الثلاث جاءت بترتيب معكوس، فراجع النتيجة قبل أن ترسل الملف.',
        },
        {
          question: 'هل يغيّر PDF Candy النص الموجود؟',
          answer:
            'تقول صفحة محرره إنه يستبدل فقرات كاملة أو يحذفها ويصحح الأخطاء المطبعية فورًا. لكن في تجربتنا، حين نقرنا مرتين على السطر العربي اكتفى المحرر بتحديده، ولم نتمكن من تغييره. أما BlendPDF فيغيّر السطر العربي الموجود في مكانه، سطرًا سطرًا (ميزة تجريبية).',
        },
        {
          question: 'هل للاستخدام المجاني حدود؟',
          answer:
            'تذكر صفحة أسعار PDF Candy حدودًا على الصفحات وعلى الاستخدام في الساعة في نسخته المجانية (قرأناها في 12 نوفمبر 2026). أما BlendPDF فلا حدّ فيه لعدد المهام، لا في الساعة ولا في اليوم.',
        },
        CHROME.ar.faq.upload,
        CHROME.ar.faq.realText,
      ],
      disclaimer:
        'اسم PDF Candy علامة تجارية لمالكها، ولا صلة بين BlendPDF وPDF Candy. أجرينا هذا الاختبار بأنفسنا في 12 نوفمبر 2026 على موقع pdfcandy.com دون حساب، وننقل عن صفحاته ما كانت تقوله ذلك اليوم. وقد يكون تغيّر بعد ذلك، فراجع موقعه لمعرفة ميزاته وحدوده الحالية.',
      breadcrumb: 'BlendPDF مقابل PDF Candy',
      card: 'العربية المضافة فيه نص حقيقي بحروف متصلة، لكن الكلمات جاءت بترتيب معكوس، وفي نسخته المجانية حدود على الاستخدام في الساعة.',
    },
  },
};
