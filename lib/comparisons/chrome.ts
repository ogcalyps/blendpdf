import type { ComparisonChrome, ComparisonLocale } from './types';

/** What every comparison page says the same way: our limits, how to do it here, the hub. */
export const CHROME: Record<ComparisonLocale, ComparisonChrome> = {
  en: {
    home: 'Home',
    howTo: {
      edit: {
        title: 'How to change an Arabic line in BlendPDF',
        steps: [
          'Open your PDF in **Edit PDF**.',
          'Choose **Edit existing text** and click the line you want to change.',
          'Type the line the way it should read. You see it on the page as you type.',
          'Press **Save PDF**. The old words are taken out of the page, not just covered.',
        ],
      },
      add: {
        title: 'How to add Arabic text in BlendPDF',
        steps: [
          'Open your PDF in **Edit PDF**.',
          'Choose **Text** and click where the words should go.',
          'Type in Arabic, English or French, even in the same box.',
          'Press **Save PDF**. The words are saved as real text, so you can select and search them.',
        ],
      },
    },
    limits: {
      title: 'Where BlendPDF falls short',
      intro: '**Edit existing text** is still in beta. Here’s what it can’t do yet:',
      items: [
        {
          title: 'One line at a time',
          text: 'It changes one line, and words don’t flow onto the next line. To rewrite a paragraph, convert the PDF to Word, edit it there and save it as a PDF again.',
        },
        {
          title: 'Pages with shadows or see-through effects',
          text: 'The editor won’t change text on these pages, because it would change how other parts of the page look. Cover the old words with **Hide (white box)** and type over them with **Text**.',
        },
        {
          title: 'The font can change',
          text: 'If the original font doesn’t have every letter you type, we write the line in the closest font we have. For Arabic that’s Noto Sans Arabic, which is plainer than most Arabic document fonts, so the line can look different from the ones around it. The editor tells you when this happens.',
        },
      ],
    },
    more: {
      title: 'Related pages',
      links: [
        { href: '/edit-pdf', label: 'Edit PDF' },
        { href: '/guides/edit-pdf-text', label: 'Guide: add or change text in a PDF' },
        { href: '/pdf-to-word', label: 'PDF to Word' },
        { href: '/ocr-pdf', label: 'OCR PDF' },
        { href: '/compare', label: 'All comparisons' },
      ],
    },
    faq: {
      freeEdit: {
        question: 'Can I edit Arabic text in a PDF for free?',
        answer: 'Yes. In BlendPDF’s Edit PDF, choose Edit existing text (beta), click a line and type it again. It’s free, with no account and no watermark. It changes one line at a time.',
      },
      upload: {
        question: 'Is my PDF uploaded while I edit it?',
        answer: 'No. The editing runs in your browser, so the file isn’t sent to our servers. It’s only uploaded if you ask us to email you the result.',
      },
      font: {
        question: 'Why does my changed Arabic line look different?',
        answer: 'The original font didn’t have every letter you typed, so the line was written in Noto Sans Arabic, the closest Arabic font we have. The words are right, but the style can differ from the lines around it.',
      },
      realText: {
        question: 'Can I search the Arabic I add?',
        answer: 'Yes. BlendPDF saves the words you add as real text, not a picture, so you can select, copy and search them.',
      },
      noAccount: {
        question: 'Do I need an account to edit a PDF in BlendPDF?',
        answer: 'No. There’s no account to create and no watermark, and the editing runs in your browser, so the file isn’t uploaded unless you ask us to email you the result.',
      },
    },
    source: { before: 'From ', after: ', read 12 November 2026' },
    method: {
      title: 'Check it yourself',
      intro: 'We judged each editor by the file it saved, not by its preview. Here’s how to repeat the test:',
      download: 'Download the test page (PDF, 40 KB)',
      steps: {
        edit: [
          'Download our test page, a one-page Arabic work certificate with made-up details.',
          'Open it in the editor you want to check, without an account, and change the name in the first sentence from “محمد العلوي” to “يوسف الإدريسي”.',
          'Save the file and open it in any PDF reader. Look at that line: where it starts, where it ends, and whether every word is there.',
          'Search the saved file for “يوسف”. If nothing is found, the new words weren’t saved as text.',
        ],
        add: [
          'Download our test page, a one-page Arabic work certificate with made-up details.',
          'Open it in the editor you want to check, without an account, and add “السيد يوسف الإدريسي” anywhere on the page with its text tool.',
          'Save the file and open it in any PDF reader. Check that all three words are there, right to left, with joined letters.',
          'Search the saved file for “يوسف”. If nothing is found, the words were saved as a picture.',
        ],
      },
    },
    correction: { before: 'Something here out of date or wrong? Email ', after: ' and we’ll check it and correct the page within 7 days.' },
    hub: {
      metaTitle: 'BlendPDF vs Other PDF Editors, Tested in Arabic | BlendPDF',
      description:
        'We tried other free online PDF editors with Arabic on 12 November 2026. See what each one saved, and what their own pages say.',
      title: 'BlendPDF compared with other PDF editors',
      intro:
        'On 12 November 2026 we tried other free online PDF editors without an account, adding an Arabic line and changing one. Each page says what the saved files showed and quotes the other service’s own pages. The Adobe page uses Adobe’s pages only, because downloading from its editor needs an account.',
      cta: 'See the comparison',
    },
  },

  fr: {
    home: 'Accueil',
    howTo: {
      edit: {
        title: 'Modifier une ligne en arabe dans BlendPDF',
        steps: [
          'Ouvrez votre PDF dans **Modifier un PDF**.',
          'Choisissez **Modifier le texte** et cliquez sur la ligne à changer.',
          'Saisissez la ligne telle qu’elle doit apparaître. Elle s’affiche sur la page pendant que vous tapez.',
          'Cliquez sur **Enregistrer le PDF**. Les anciens mots sont retirés de la page, et pas seulement recouverts.',
        ],
      },
      add: {
        title: 'Ajouter du texte en arabe dans BlendPDF',
        steps: [
          'Ouvrez votre PDF dans **Modifier un PDF**.',
          'Choisissez **Texte** et cliquez là où vous voulez écrire.',
          'Tapez en arabe, en français ou en anglais. Vous pouvez mélanger les langues dans une même zone.',
          'Cliquez sur **Enregistrer le PDF**. Vos mots sont gardés sous forme de vrai texte : vous pouvez les sélectionner et les rechercher.',
        ],
      },
    },
    limits: {
      title: 'Les limites de BlendPDF',
      intro: '**Modifier le texte** est en bêta. Voici ce que l’outil ne sait pas encore faire :',
      items: [
        {
          title: 'Une ligne à la fois',
          text: 'L’outil change une ligne, et les mots ne passent pas à la ligne suivante. Pour réécrire un paragraphe, convertissez le PDF en Word, modifiez-le dans Word, puis enregistrez-le à nouveau en PDF.',
        },
        {
          title: 'Les pages avec des ombres ou des effets de transparence',
          text: 'L’éditeur refuse d’y modifier le texte, car cela changerait l’apparence d’autres éléments de la page. Recouvrez les anciens mots avec **Masquer (cache blanc)** et écrivez par-dessus avec **Texte**.',
        },
        {
          title: 'La police peut changer',
          text: 'Si la police d’origine ne contient pas toutes les lettres que vous saisissez, nous écrivons la ligne dans la police la plus proche dont nous disposons. Pour l’arabe, c’est Noto Sans Arabic, plus sobre que les polices naskh de la plupart des courriers : la ligne peut donc se distinguer de ses voisines. L’éditeur vous le signale.',
        },
      ],
    },
    more: {
      title: 'Pages utiles',
      links: [
        { href: '/edit-pdf', label: 'Modifier un PDF' },
        { href: '/guides/edit-pdf-text', label: 'Guide : ajouter ou modifier du texte dans un PDF' },
        { href: '/pdf-to-word', label: 'PDF en Word' },
        { href: '/ocr-pdf', label: 'OCR PDF' },
        { href: '/compare', label: 'Toutes les comparaisons' },
      ],
    },
    faq: {
      freeEdit: {
        question: 'Peut-on modifier gratuitement du texte arabe dans un PDF ?',
        answer: 'Oui. Sur BlendPDF, ouvrez « Modifier un PDF », choisissez « Modifier le texte » (bêta), cliquez sur une ligne et saisissez-la de nouveau. C’est gratuit, sans compte ni filigrane. L’outil change une ligne à la fois.',
      },
      upload: {
        question: 'Mon PDF est-il envoyé sur un serveur pendant la modification ?',
        answer: 'Non. La modification se fait dans votre navigateur : le fichier n’est pas envoyé sur nos serveurs, sauf si vous demandez à recevoir le résultat par courriel.',
      },
      font: {
        question: 'Pourquoi ma ligne arabe modifiée a-t-elle un autre aspect ?',
        answer: 'La police d’origine ne contenait pas toutes les lettres saisies : la ligne a donc été écrite en Noto Sans Arabic, la police arabe la plus proche dont nous disposons. Les mots sont justes, mais le style peut différer de celui des lignes voisines.',
      },
      realText: {
        question: 'Puis-je rechercher le texte arabe que j’ajoute ?',
        answer: 'Oui. BlendPDF enregistre les mots ajoutés comme du vrai texte, et non comme une image : vous pouvez les sélectionner, les copier et les rechercher.',
      },
      noAccount: {
        question: 'Faut-il un compte pour modifier un PDF avec BlendPDF ?',
        answer: 'Non. Il n’y a ni compte à créer ni filigrane, et la modification se fait dans votre navigateur : le fichier n’est envoyé sur nos serveurs que si vous demandez à recevoir le résultat par courriel.',
      },
    },
    source: { before: 'Source : ', after: ', consultée le 12 novembre 2026' },
    method: {
      title: 'Vérifiez par vous-même',
      intro: 'Nous avons jugé chaque éditeur sur le fichier qu’il a enregistré, et non sur son aperçu. Voici comment refaire le test :',
      download: 'Télécharger la page de test (PDF, 40 Ko)',
      steps: {
        edit: [
          'Téléchargez notre page de test : une attestation de travail d’une page en arabe, avec des informations fictives.',
          'Ouvrez-la dans l’éditeur à vérifier, sans compte, et remplacez dans la première phrase le nom « محمد العلوي » par « يوسف الإدريسي ».',
          'Enregistrez le fichier et ouvrez-le dans n’importe quel lecteur PDF. Regardez cette ligne : où elle commence, où elle finit, et si tous les mots y sont.',
          'Recherchez « يوسف » dans le fichier enregistré. Si rien n’est trouvé, les nouveaux mots n’ont pas été enregistrés comme du texte.',
        ],
        add: [
          'Téléchargez notre page de test : une attestation de travail d’une page en arabe, avec des informations fictives.',
          'Ouvrez-la dans l’éditeur à vérifier, sans compte, et ajoutez « السيد يوسف الإدريسي » n’importe où sur la page avec son outil de texte.',
          'Enregistrez le fichier et ouvrez-le dans n’importe quel lecteur PDF. Vérifiez que les trois mots y sont, de droite à gauche, lettres liées.',
          'Recherchez « يوسف » dans le fichier enregistré. Si rien n’est trouvé, les mots ont été enregistrés sous forme d’image.',
        ],
      },
    },
    correction: { before: 'Une information est périmée ou inexacte ? Écrivez à ', after: ' : nous la vérifierons et corrigerons la page sous 7 jours.' },
    hub: {
      metaTitle: 'BlendPDF face aux autres éditeurs PDF, testés en arabe | BlendPDF',
      description:
        'Le 12 novembre 2026, nous avons essayé d’autres éditeurs PDF gratuits en ligne avec de l’arabe. Voici ce que chacun a enregistré, et ce que disent leurs propres pages.',
      title: 'BlendPDF face aux autres éditeurs PDF',
      intro:
        'Le 12 novembre 2026, nous avons essayé d’autres éditeurs PDF gratuits en ligne, sans compte, pour ajouter une ligne en arabe et en modifier une. Chaque page indique ce que montraient les fichiers enregistrés et cite les pages du service concerné. La page consacrée à Adobe s’appuie uniquement sur les pages d’Adobe, car le téléchargement depuis son éditeur exige un compte.',
      cta: 'Voir la comparaison',
    },
  },

  ar: {
    home: 'الرئيسية',
    howTo: {
      edit: {
        title: 'كيف تغيّر سطرًا عربيًا في BlendPDF',
        steps: [
          'افتح ملفك في **تعديل PDF**.',
          'اختر **تعديل النص الموجود**، ثم اضغط على السطر الذي تريد تغييره.',
          'اكتب السطر كما يجب أن يظهر، وسترى النتيجة على الصفحة وأنت تكتب.',
          'اضغط **احفظ ملف PDF**. نزيل الكلمات القديمة من الصفحة ولا نكتفي بتغطيتها.',
        ],
      },
      add: {
        title: 'كيف تضيف نصًا عربيًا في BlendPDF',
        steps: [
          'افتح ملفك في **تعديل PDF**.',
          'اختر **نص** وانقر حيث تريد أن تظهر الكلمات.',
          'اكتب بالعربية أو الفرنسية أو الإنجليزية، أو بها معًا في الخانة نفسها.',
          'اضغط **احفظ ملف PDF**. تُحفظ الكلمات نصًا حقيقيًا يمكنك تحديده والبحث فيه.',
        ],
      },
    },
    limits: {
      title: 'حدود BlendPDF',
      intro: 'أداة **تعديل النص الموجود** ما زالت تجريبية، وهذا ما لا تستطيعه بعد:',
      items: [
        {
          title: 'سطر واحد في كل مرة',
          text: 'تغيّر الأداة سطرًا واحدًا، ولا تنتقل الكلمات إلى السطر التالي. فإن أردت إعادة كتابة فقرة، حوّل الملف إلى Word وعدّله هناك، ثم احفظه PDF من جديد.',
        },
        {
          title: 'الصفحات التي فيها ظلال أو شفافية',
          text: 'يرفض المحرر تغيير النص فيها، لأن ذلك سيغيّر شكل أجزاء أخرى من الصفحة. غطِّ الكلمات القديمة بأداة **إخفاء (مربع أبيض)** واكتب فوقها بأداة **نص**.',
        },
        {
          title: 'قد يتغيّر الخط',
          text: 'إذا لم يستطع الخط الأصلي كتابة الحروف التي تكتبها، نكتب السطر بأقرب خط لدينا، وهو للعربية خط Noto Sans Arabic، وشكله أبسط من خطوط النسخ المعتادة في الرسائل. لذا قد يبدو السطر المعدَّل مختلفًا عمّا حوله، والمحرر ينبّهك حين يحدث ذلك.',
        },
      ],
    },
    more: {
      title: 'صفحات ذات صلة',
      links: [
        { href: '/edit-pdf', label: 'تعديل PDF' },
        { href: '/guides/edit-pdf-text', label: 'دليل: كيف تضيف نصًا إلى ملف PDF أو تعدّل نصه' },
        { href: '/pdf-to-word', label: 'PDF إلى Word' },
        { href: '/ocr-pdf', label: 'التعرف الضوئي (OCR) على PDF' },
        { href: '/compare', label: 'كل المقارنات' },
      ],
    },
    faq: {
      freeEdit: {
        question: 'هل يمكنني تعديل نص عربي في ملف PDF مجانًا؟',
        answer: 'نعم. افتح «تعديل PDF» في BlendPDF، واختر «تعديل النص الموجود» (ميزة تجريبية)، ثم اضغط على السطر واكتبه من جديد. الأداة مجانية، بلا حساب ولا علامة مائية، وتغيّر سطرًا واحدًا في كل مرة.',
      },
      upload: {
        question: 'هل يُرفع ملفي إلى خادم أثناء التعديل؟',
        answer: 'لا. التعديل يجري في متصفحك، فلا يصل الملف إلى خوادمنا، إلا إذا طلبت أن نرسل لك النتيجة بالبريد الإلكتروني.',
      },
      font: {
        question: 'لماذا يبدو السطر العربي المعدَّل مختلفًا عن بقية النص؟',
        answer: 'لأن الخط الأصلي لم يكن يضم كل الحروف التي كتبتها، فكتبنا السطر بخط Noto Sans Arabic، وهو أقرب خط عربي لدينا. الكلمات صحيحة، لكن خطها قد يختلف عن خط الأسطر المجاورة.',
      },
      realText: {
        question: 'هل يمكن البحث في النص العربي الذي أضيفه؟',
        answer: 'نعم. يحفظ BlendPDF الكلمات التي تضيفها نصًا حقيقيًا لا صورة، فتستطيع تحديدها ونسخها والبحث فيها.',
      },
      noAccount: {
        question: 'هل أحتاج إلى حساب لتعديل ملف PDF في BlendPDF؟',
        answer: 'لا. لن تنشئ أي حساب، ولن تظهر علامة مائية على ملفك، والتعديل يجري في متصفحك، فلا يُرفع الملف إلا إذا طلبت أن نرسل لك النتيجة بالبريد الإلكتروني.',
      },
    },
    source: { before: 'المصدر: ', after: '، قرأناه في 12 نوفمبر 2026' },
    method: {
      title: 'تحقّق بنفسك',
      intro: 'حكمنا على كل محرر بالملف الذي حفظه، لا بما يعرضه أثناء التعديل. وهذه طريقة إعادة الاختبار:',
      download: 'نزّل صفحة الاختبار بصيغة PDF (40 كيلوبايت)',
      steps: {
        edit: [
          'نزّل صفحة الاختبار التي أعددناها: شهادة عمل بالعربية من صفحة واحدة، بياناتها وهمية.',
          'افتحها في المحرر الذي تريد تجربته، دون حساب، وغيّر الاسم في أول سطر من «محمد العلوي» إلى «يوسف الإدريسي».',
          'احفظ الملف وافتحه في أي قارئ PDF، وانظر إلى ذلك السطر: أين يبدأ، وأين ينتهي، وهل كل كلماته في مكانها.',
          'ابحث في الملف المحفوظ عن «يوسف». فإن لم يظهر شيء، فالكلمات الجديدة لم تُحفظ نصًا.',
        ],
        add: [
          'نزّل صفحة الاختبار التي أعددناها: شهادة عمل بالعربية من صفحة واحدة، بياناتها وهمية.',
          'افتحها في المحرر الذي تريد تجربته، دون حساب، وأضف «السيد يوسف الإدريسي» في أي مكان من الصفحة بأداة النص فيه.',
          'احفظ الملف وافتحه في أي قارئ PDF، وتأكد أن الكلمات الثلاث كلها موجودة، من اليمين إلى اليسار، بحروف متصلة.',
          'ابحث في الملف المحفوظ عن «يوسف». فإن لم يظهر شيء، فقد حُفظت الكلمات صورةً.',
        ],
      },
    },
    correction: { before: 'هل في هذه الصفحة معلومة قديمة أو خاطئة؟ راسلنا على ', after: ' وسنراجعها ونصحح الصفحة خلال 7 أيام.' },
    hub: {
      metaTitle: 'مقارنة BlendPDF بمحررات PDF الأخرى: جرّبناها على ملف عربي | BlendPDF',
      description:
        'جرّبنا محررات PDF مجانية أخرى على الإنترنت بنص عربي في 12 نوفمبر 2026. هذا ما حفظه كل محرر، وما تقوله صفحاته.',
      title: 'مقارنة BlendPDF بمحررات PDF الأخرى',
      intro:
        'في 12 نوفمبر 2026 جرّبنا محررات PDF مجانية أخرى على الإنترنت، دون حساب: أضفنا سطرًا عربيًا وغيّرنا سطرًا. في كل صفحة ما أظهرته الملفات بعد الحفظ، واقتباسات من صفحات الخدمة نفسها. أما صفحة Adobe فمبنية على صفحات Adobe وحدها، لأن التنزيل من محررها يتطلب حسابًا.',
      cta: 'اقرأ المقارنة',
    },
  },
};
