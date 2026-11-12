/**
 * /blendpdf-vs-smallpdf: the same Arabic line added with Smallpdf's free Add
 * text (no account) and with Edit PDF's Text tool on 12 November 2026, plus
 * Smallpdf's own pages read that day. Its "Edit Text" is Pro, so not tested.
 */
import { CHROME } from './chrome';
import { addShots } from './shots';
import type { Comparison } from './types';

export const smallpdf: Comparison = {
  slug: 'smallpdf',
  path: '/blendpdf-vs-smallpdf',
  name: 'Smallpdf',
  howTo: 'add',
  shots: addShots('smallpdf'),
  quotes: [{ text: 'Direct PDF text editing requires a Pro subscription', lang: 'en', source: 'https://smallpdf.com/edit-pdf' }],
  text: {
    en: {
      metaTitle: 'Smallpdf Alternative for Arabic PDFs, Tested | BlendPDF',
      description:
        'We added the same Arabic line in Smallpdf and in BlendPDF. Smallpdf lost a word and drew the letters unjoined. BlendPDF kept all three words, joined.',
      title: 'A Smallpdf alternative for Arabic PDFs',
      tested: 'Tested 12 November 2026',
      summary:
        'In our test, Smallpdf’s free Add text dropped the last word of an Arabic name and drew the letters unjoined, and changing existing text needs Smallpdf Pro. In BlendPDF both are free, with no account: **Text** adds words, and **Edit existing text** (beta) changes a line.',
      cta: 'Edit an Arabic PDF',
      evidence: {
        title: 'Same page, same words',
        intro:
          'We added “السيد يوسف الإدريسي” (three words: a title and a name) to a one-page Arabic work certificate, once with Smallpdf’s free Add text and once with BlendPDF’s Text tool, without an account. Below is the part of each saved page where the words went.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'All three words, right to left, with joined letters. It’s real text.',
            alt: 'BlendPDF’s saved line: “السيد يوسف الإدريسي”, three words with joined letters.',
          },
          them: {
            label: 'Smallpdf',
            caption: 'Only two words were saved, “السيد يوسف”. The third, “الإدريسي”, is missing, and the letters are drawn apart instead of joined.',
            alt: 'Smallpdf’s saved line: two words with unjoined letters; the third word is missing.',
          },
        },
      },
      quotes: {
        title: 'What Smallpdf says about editing text',
        intro: 'Its Edit PDF page says this about changing the text already in a PDF:',
        after: 'BlendPDF’s **Edit existing text** (beta) is free and changes one line at a time.',
      },
      table: {
        title: 'Side by side',
        head: ['What we checked', 'BlendPDF', 'Smallpdf'],
        rows: [
          { label: 'Adding an Arabic line (free)', blendpdf: 'All three words, right to left, joined.', them: 'Two of the three words saved, letters unjoined.' },
          { label: 'Changing existing text', blendpdf: 'Free, one line at a time (beta).', them: 'Pro only, by its Edit PDF page.' },
          { label: 'Free use', blendpdf: 'No daily limit.', them: 'Its pricing page lists a “Daily download limit” on the free plan.' },
        ],
        note: 'Tested 12 November 2026, with Smallpdf’s pages read the same day. Smallpdf may have changed since, so check its current plans on smallpdf.com.',
      },
      strengths: {
        title: 'Where Smallpdf does well',
        items: [
          'Its site is in Arabic too.',
          'With Pro, its editor changes the text already in a PDF.',
          'Its free plan takes files up to 100 MB for conversions, against 50 MB at BlendPDF.',
        ],
      },
      faq: [
        {
          question: 'Is Smallpdf free for Arabic PDFs?',
          answer:
            'Partly. Its Add text is free, but in our test on 12 November 2026 it saved only two of three Arabic words, with the letters unjoined. Changing the text already in a PDF needs Pro: its Edit PDF page says “Direct PDF text editing requires a Pro subscription”.',
        },
        CHROME.en.faq.freeEdit,
        CHROME.en.faq.noAccount,
        {
          question: 'Is there a daily limit on the free plan?',
          answer:
            'BlendPDF has no daily limit. When we checked on 12 November 2026, Smallpdf’s pricing page listed a “Daily download limit” on its free plan, and its blog said the free plan converts “up to two documents per day”.',
        },
        CHROME.en.faq.realText,
      ],
      disclaimer:
        'Smallpdf is a trademark of its owner. BlendPDF isn’t affiliated with Smallpdf. We ran this test ourselves on 12 November 2026 on smallpdf.com, without an account, and quote its pages as they read that day. Smallpdf may have changed since, so check smallpdf.com for its current features and limits.',
      breadcrumb: 'BlendPDF vs Smallpdf',
      card: 'Its free Add text saved two of our three Arabic words, unjoined, and changing existing text needs Pro.',
    },

    fr: {
      metaTitle: 'Alternative à Smallpdf pour les PDF en arabe : notre test | BlendPDF',
      description:
        'Nous avons ajouté la même ligne en arabe avec Smallpdf et avec BlendPDF. Smallpdf a perdu un mot et détaché les lettres ; BlendPDF a gardé les trois mots, lettres liées.',
      title: 'Une alternative à Smallpdf pour les PDF en arabe',
      tested: 'Testé le 12 novembre 2026',
      summary:
        'Lors de notre test, l’ajout de texte gratuit de Smallpdf a perdu le dernier mot d’un nom arabe et détaché les lettres, et la modification du texte existant exige Smallpdf Pro. Avec BlendPDF, les deux sont gratuits et sans compte : **Texte** pour ajouter des mots, **Modifier le texte** (bêta) pour changer une ligne.',
      cta: 'Modifier un PDF en arabe',
      evidence: {
        title: 'La même page, les mêmes mots',
        intro:
          'Nous avons ajouté « السيد يوسف الإدريسي » (trois mots : une civilité et un nom) sur une attestation de travail d’une page en arabe, une fois avec l’ajout de texte gratuit de Smallpdf et une fois avec l’outil Texte de BlendPDF, sans compte. Voici la partie de chaque page enregistrée où les mots ont été placés.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'Les trois mots, de droite à gauche, lettres liées. C’est du vrai texte.',
            alt: 'La ligne enregistrée par BlendPDF : « السيد يوسف الإدريسي », trois mots aux lettres liées.',
          },
          them: {
            label: 'Smallpdf',
            caption: 'Seuls deux mots ont été enregistrés, « السيد يوسف ». Le troisième, « الإدريسي », manque, et les lettres sont dessinées séparément au lieu d’être liées.',
            alt: 'La ligne enregistrée par Smallpdf : deux mots aux lettres détachées, le troisième manque.',
          },
        },
      },
      quotes: {
        title: 'Ce que dit Smallpdf de la modification du texte',
        intro: 'Sa page Edit PDF indique ceci à propos de la modification du texte déjà présent dans un PDF :',
        glosses: ['Traduction : « La modification directe du texte d’un PDF nécessite un abonnement Pro. »'],
        after: 'Chez BlendPDF, **Modifier le texte** (bêta) est gratuit et change une ligne à la fois.',
      },
      table: {
        title: 'Côte à côte',
        head: ['Ce que nous avons vérifié', 'BlendPDF', 'Smallpdf'],
        rows: [
          {
            label: 'Ajouter une ligne en arabe (gratuit)',
            blendpdf: 'Les trois mots, de droite à gauche, lettres liées.',
            them: 'Deux mots sur trois enregistrés, lettres détachées.',
          },
          { label: 'Modifier le texte existant', blendpdf: 'Gratuit, une ligne à la fois (bêta).', them: 'Réservé à l’offre Pro, d’après sa page Edit PDF.' },
          {
            label: 'Utilisation gratuite',
            blendpdf: 'Pas de limite quotidienne.',
            them: 'Sa page de tarifs indique une limite quotidienne de téléchargement (« Daily download limit ») pour l’offre gratuite.',
          },
        ],
        note: 'Testé le 12 novembre 2026, pages de Smallpdf consultées le même jour. Smallpdf a pu changer depuis : vérifiez ses offres actuelles sur smallpdf.com.',
      },
      strengths: {
        title: 'Les points forts de Smallpdf',
        items: [
          'Son site existe aussi en arabe.',
          'Avec l’offre Pro, son éditeur modifie le texte déjà présent dans un PDF.',
          'Son offre gratuite accepte des fichiers jusqu’à 100 Mo pour les conversions, contre 50 Mo chez BlendPDF.',
        ],
      },
      faq: [
        {
          question: 'Smallpdf est-il gratuit pour les PDF en arabe ?',
          answer:
            'En partie. Son ajout de texte est gratuit, mais lors de notre test du 12 novembre 2026, il n’a enregistré que deux des trois mots arabes, aux lettres détachées. Modifier le texte déjà présent exige l’offre Pro : sa page Edit PDF indique « Direct PDF text editing requires a Pro subscription ».',
        },
        CHROME.fr.faq.freeEdit,
        CHROME.fr.faq.noAccount,
        {
          question: 'L’offre gratuite a-t-elle une limite quotidienne ?',
          answer:
            'BlendPDF n’a pas de limite quotidienne. Lors de notre vérification du 12 novembre 2026, la page de tarifs de Smallpdf indiquait une « Daily download limit » pour l’offre gratuite, et son blog précisait que celle-ci permettait de convertir jusqu’à deux documents par jour.',
        },
        CHROME.fr.faq.realText,
      ],
      disclaimer:
        'Smallpdf est une marque de son propriétaire. BlendPDF n’a aucun lien avec Smallpdf. Nous avons fait ce test nous-mêmes le 12 novembre 2026 sur smallpdf.com, sans compte, et nous citons ses pages telles qu’elles étaient ce jour-là. Smallpdf a pu évoluer depuis : consultez smallpdf.com pour connaître ses fonctions et ses limites actuelles.',
      breadcrumb: 'BlendPDF face à Smallpdf',
      card: 'Son ajout de texte gratuit a enregistré deux de nos trois mots arabes, lettres détachées, et la modification du texte existant est réservée à l’offre Pro.',
    },

    es: {
      metaTitle: 'Alternativa a Smallpdf para PDF en árabe: nuestra prueba | BlendPDF',
      description:
        'Agregamos la misma línea en árabe en Smallpdf y en BlendPDF. Smallpdf perdió una palabra y dibujó las letras sin unir. BlendPDF conservó las tres palabras, con las letras unidas.',
      title: 'Una alternativa a Smallpdf para PDF en árabe',
      tested: 'Probado el 12 de noviembre de 2026',
      summary:
        'En nuestra prueba, la herramienta gratuita para agregar texto de Smallpdf omitió la última palabra de un nombre en árabe y dibujó las letras sin unir, y para cambiar el texto existente hace falta Smallpdf Pro. En BlendPDF, las dos cosas son gratis y sin crear una cuenta: **Texto** agrega palabras y **Editar el texto** (beta) cambia una línea.',
      cta: 'Editar un PDF en árabe',
      evidence: {
        title: 'La misma página, las mismas palabras',
        intro:
          'Agregamos “السيد يوسف الإدريسي” (tres palabras: un tratamiento de cortesía y un nombre) a un certificado de trabajo de una página en árabe, una vez con la herramienta gratuita para agregar texto de Smallpdf y otra con la herramienta Texto de BlendPDF, sin usar una cuenta. Abajo se ve la parte de cada página guardada donde quedaron las palabras.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'Las tres palabras, de derecha a izquierda, con las letras unidas. Es texto real.',
            alt: 'La línea guardada por BlendPDF: “السيد يوسف الإدريسي”, tres palabras con las letras unidas.',
          },
          them: {
            label: 'Smallpdf',
            caption: 'Solo se guardaron dos palabras, “السيد يوسف”. Falta la tercera, “الإدريسي”, y las letras están dibujadas por separado en lugar de unidas.',
            alt: 'La línea guardada por Smallpdf: dos palabras con las letras sin unir; falta la tercera palabra.',
          },
        },
      },
      quotes: {
        title: 'Lo que dice Smallpdf sobre la edición de texto',
        intro: 'Su página Edit PDF dice esto sobre cambiar el texto que ya tiene un PDF:',
        glosses: ['Traducción: “La edición directa del texto de un PDF requiere una suscripción Pro”.'],
        after: 'En BlendPDF, **Editar el texto** (beta) es gratis y cambia una línea a la vez.',
      },
      table: {
        title: 'Comparación directa',
        head: ['Lo que comprobamos', 'BlendPDF', 'Smallpdf'],
        rows: [
          {
            label: 'Agregar una línea en árabe (gratis)',
            blendpdf: 'Las tres palabras, de derecha a izquierda, con las letras unidas.',
            them: 'Se guardaron dos de las tres palabras, con las letras sin unir.',
          },
          { label: 'Cambiar el texto existente', blendpdf: 'Gratis, una línea a la vez (beta).', them: 'Solo con Pro, según su página Edit PDF.' },
          {
            label: 'Uso gratuito',
            blendpdf: 'Sin límite diario.',
            them: 'Su página de precios indica un límite diario de descargas (“Daily download limit”) en el plan gratuito.',
          },
        ],
        note: 'Probado el 12 de noviembre de 2026, con las páginas de Smallpdf consultadas el mismo día. Smallpdf puede haber cambiado desde entonces: consulte sus planes actuales en smallpdf.com.',
      },
      strengths: {
        title: 'Lo que Smallpdf hace bien',
        items: [
          'Su sitio también está en árabe.',
          'Con Pro, su editor cambia el texto que ya tiene un PDF.',
          'Su plan gratuito admite archivos de hasta 100 MB para conversiones, frente a 50 MB en BlendPDF.',
        ],
      },
      faq: [
        {
          question: '¿Smallpdf es gratis para PDF en árabe?',
          answer:
            'En parte. Su herramienta para agregar texto es gratuita, pero en nuestra prueba del 12 de noviembre de 2026 solo guardó dos de tres palabras en árabe, con las letras sin unir. Para cambiar el texto que ya tiene un PDF hace falta Pro: su página Edit PDF dice “Direct PDF text editing requires a Pro subscription”.',
        },
        CHROME.es.faq.freeEdit,
        CHROME.es.faq.noAccount,
        {
          question: '¿El plan gratuito tiene un límite diario?',
          answer:
            'BlendPDF no tiene límite diario. Cuando lo comprobamos, el 12 de noviembre de 2026, la página de precios de Smallpdf indicaba un límite diario de descargas (“Daily download limit”) en su plan gratuito, y su blog decía que el plan gratuito convierte “up to two documents per day” (hasta dos documentos al día).',
        },
        CHROME.es.faq.realText,
      ],
      disclaimer:
        'Smallpdf es una marca comercial de su propietario. BlendPDF no tiene ninguna relación con Smallpdf. Hicimos esta prueba nosotros mismos el 12 de noviembre de 2026 en smallpdf.com, sin usar una cuenta, y citamos sus páginas tal como estaban ese día. Smallpdf puede haber cambiado desde entonces: consulte smallpdf.com para conocer sus funciones y límites actuales.',
      breadcrumb: 'BlendPDF frente a Smallpdf',
      card: 'Su herramienta gratuita para agregar texto guardó dos de nuestras tres palabras en árabe, sin unir, y para cambiar el texto existente hace falta Pro.',
    },

    ar: {
      metaTitle: 'بديل Smallpdf لملفات PDF العربية: جرّبنا الأداتين | BlendPDF',
      description:
        'أضفنا السطر العربي نفسه في Smallpdf وفي BlendPDF: أسقط Smallpdf كلمة وكتب الحروف منفصلة، وحفظ BlendPDF الكلمات الثلاث بحروف متصلة.',
      title: 'بديل Smallpdf لملفات PDF العربية',
      tested: 'تاريخ الاختبار: 12 نوفمبر 2026',
      summary:
        'في تجربتنا، أسقطت أداة إضافة النص المجانية في Smallpdf آخر كلمة من اسم عربي وكتبت حروفه منفصلة، أما تغيير النص الموجود فيحتاج إلى Smallpdf Pro. وفي BlendPDF كلاهما مجاني وبلا حساب: أداة **نص** لإضافة الكلمات، وأداة **تعديل النص الموجود** (ميزة تجريبية) لتغيير سطر.',
      cta: 'عدّل ملف PDF',
      evidence: {
        title: 'الصفحة نفسها والكلمات نفسها',
        intro:
          'أضفنا «السيد يوسف الإدريسي» (ثلاث كلمات: «السيد» ثم الاسم) إلى شهادة عمل عربية من صفحة واحدة: مرة بأداة إضافة النص المجانية في Smallpdf، ومرة بأداة «نص» في BlendPDF، دون حساب. وهذا موضع الكلمات في كل ملف بعد الحفظ.',
        shots: {
          blendpdf: {
            label: 'BlendPDF',
            caption: 'الكلمات الثلاث من اليمين إلى اليسار بحروف متصلة، وهي نص حقيقي.',
            alt: 'السطر بعد الحفظ في BlendPDF: «السيد يوسف الإدريسي»، ثلاث كلمات بحروف متصلة.',
          },
          them: {
            label: 'Smallpdf',
            caption: 'لم تُحفظ إلا كلمتان، «السيد يوسف»، وسقطت الثالثة «الإدريسي»، والحروف مرسومة منفصلة بدل أن تتصل.',
            alt: 'السطر بعد الحفظ في Smallpdf: كلمتان بحروف منفصلة، وسقطت الكلمة الثالثة.',
          },
        },
      },
      quotes: {
        title: 'ما يقوله Smallpdf عن تعديل النص',
        intro: 'في صفحة Edit PDF لديه هذه الجملة عن تغيير النص الموجود في الملف:',
        glosses: ['ترجمتها: «تعديل نص PDF مباشرةً يتطلب اشتراك Pro».'],
        after: 'أما في BlendPDF فأداة **تعديل النص الموجود** (ميزة تجريبية) مجانية، وتغيّر سطرًا واحدًا في كل مرة.',
      },
      table: {
        title: 'مقارنة سريعة',
        head: ['ما قارنّاه', 'BlendPDF', 'Smallpdf'],
        rows: [
          { label: 'إضافة سطر عربي (مجانًا)', blendpdf: 'الكلمات الثلاث من اليمين إلى اليسار، بحروف متصلة.', them: 'حُفظت كلمتان من ثلاث، بحروف منفصلة.' },
          { label: 'تغيير النص الموجود', blendpdf: 'مجاني، سطرًا سطرًا (ميزة تجريبية).', them: 'لمشتركي Pro فقط، بحسب صفحة Edit PDF لديه.' },
          { label: 'الاستخدام المجاني', blendpdf: 'لا حدّ يوميًا لعدد المهام.', them: 'صفحة أسعاره تذكر حدًا يوميًا للتنزيل في النسخة المجانية.' },
        ],
        note: 'أجرينا الاختبار وقرأنا صفحات Smallpdf في 12 نوفمبر 2026، وقد يكون تغيّر بعد ذلك، فراجع خططه الحالية على موقعه.',
      },
      strengths: {
        title: 'ما يُحسنه Smallpdf',
        items: [
          'موقعه متاح بالعربية أيضًا.',
          'محرره في Pro يغيّر النص الموجود في الملف.',
          'نسخته المجانية تقبل في التحويل ملفات حتى 100 ميجابايت، مقابل 50 ميجابايت في BlendPDF.',
        ],
      },
      faq: [
        {
          question: 'هل Smallpdf مجاني لملفات PDF العربية؟',
          answer:
            'جزئيًا. أداة إضافة النص فيه مجانية، لكنها في تجربتنا في 12 نوفمبر 2026 لم تحفظ إلا كلمتين من ثلاث كلمات عربية، بحروف منفصلة. أما تغيير النص الموجود فيحتاج إلى Pro، إذ تقول صفحة Edit PDF لديه إن تعديل نص PDF مباشرةً يتطلب اشتراك Pro.',
        },
        CHROME.ar.faq.freeEdit,
        CHROME.ar.faq.noAccount,
        {
          question: 'هل في النسخة المجانية حدّ يومي؟',
          answer:
            'لا حدّ يوميًا في BlendPDF. أما Smallpdf فكانت صفحة أسعاره تذكر حدًا يوميًا للتنزيل في النسخة المجانية حين راجعناها في 12 نوفمبر 2026، وكانت مدوّنته تقول إن النسخة المجانية تحوّل ما يصل إلى مستندين في اليوم.',
        },
        CHROME.ar.faq.realText,
      ],
      disclaimer:
        'اسم Smallpdf علامة تجارية لمالكها، ولا صلة بين BlendPDF وSmallpdf. أجرينا هذا الاختبار بأنفسنا في 12 نوفمبر 2026 على موقع smallpdf.com دون حساب، وننقل عن صفحاته ما كانت تقوله ذلك اليوم. وقد يكون تغيّر بعد ذلك، فراجع موقعه لمعرفة ميزاته وحدوده الحالية.',
      breadcrumb: 'BlendPDF مقابل Smallpdf',
      card: 'أداة إضافة النص المجانية فيه حفظت كلمتين من كلماتنا العربية الثلاث بحروف منفصلة، وتغيير النص الموجود يحتاج إلى Pro.',
    },
  },
};
