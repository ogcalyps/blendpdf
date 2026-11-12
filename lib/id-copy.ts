/**
 * /watermark-pdf/id-copy: the watermark mode opened with "who it's for, what
 * for, and the date" tiled across a copy of an ID card or passport. The
 * watermark text is built in the browser (idCopyText); the page's words are
 * server-only, like lib/guides. Text may mark a UI label in **bold**.
 */

export type IdCopyLocale = 'en' | 'fr' | 'ar';

const NBSP = ' ';
const NNBSP = ' ';

export const idCopyLocale = (locale: string): IdCopyLocale => (locale === 'fr' || locale === 'ar' ? locale : 'en');

/** The tiled text: who it's for, what for, the date. Empty answers are left out. */
export function idCopyText(locale: string, who: string, what: string, date: Date): string {
  const l = idCopyLocale(locale);
  const w = who.trim();
  const p = what.trim();
  // dd/mm/yyyy by hand: Intl's Arabic date carries U+200F marks the PDF text engine would have to draw
  const day = [date.getDate(), date.getMonth() + 1].map((n) => String(n).padStart(2, '0')).concat(String(date.getFullYear())).join('/');
  if (l === 'fr') return [w ? `Copie destinée à ${w}` : 'Copie', p && `pour ${p}`, `le ${day}`].filter(Boolean).join(', ');
  if (l === 'ar') return [w ? `نسخة خاصة بـ${w}` : 'نسخة', p && `من أجل ${p}`, `بتاريخ ${day}`].filter(Boolean).join('، ');
  return [w ? `Copy for ${w} only` : 'Copy', p && `for ${p}`, day].filter(Boolean).join(', ');
}

export interface IdCopyText {
  title: string;
  metaTitle: string;
  description: string;
  intro: string;
  /** The answer first: what to do. */
  summary: string;
  whoLabel: string;
  whoPlaceholder: string;
  whatLabel: string;
  whatPlaceholder: string;
  /** Before the live preview of the watermark, with its colon. */
  preview: string;
  faq: { question: string; answer: string }[];
  /** For photos of an ID: the tool that makes them a PDF. */
  photos: { text: string; link: string };
  home: string;
  watermark: string;
}

const TEXT: Record<IdCopyLocale, IdCopyText> = {
  en: {
    title: 'Watermark a copy of your ID',
    metaTitle: 'Watermark an ID Copy (ID Card, Passport) Free | BlendPDF',
    description:
      'Write who the copy is for, what for and the date across every page of your ID scan, so it can’t be reused. Free, and it stays in your browser.',
    intro:
      'Before you send a copy of your ID card or passport, write on it who it’s for, what for, and the date. If the copy leaks, it can’t be passed off for anything else.',
    summary:
      'Fill in the two boxes, then open your scan below. The text is repeated across every page. You can still change it in the **Watermark** panel before you press **Add watermark**.',
    whoLabel: 'Who is it for?',
    whoPlaceholder: 'e.g. the letting agency',
    whatLabel: 'What for?',
    whatPlaceholder: 'e.g. the flat application',
    preview: 'Your watermark:',
    faq: [
      {
        question: 'Is my ID sent to your server?',
        answer:
          'No. The watermark is added in your browser and the file stays on your device. Only emailing the file to yourself sends it through our server.',
      },
      {
        question: 'Can the watermark be removed?',
        answer:
          'It’s drawn into each page, not a layer that can be switched off. That is also why it says who the copy is for: a copy marked for a letting agency is no use for opening a bank account.',
      },
      {
        question: 'What should I write?',
        answer: 'Who receives it, what for, and the date. Keep it short so each line fits across the page.',
      },
    ],
    photos: { text: 'Photos of your ID? Make them a PDF first.', link: 'Images to PDF' },
    home: 'Home',
    watermark: 'Add watermark',
  },
  fr: {
    title: 'Ajouter un filigrane sur la copie d’une pièce d’identité',
    metaTitle: 'Filigrane sur une pièce d’identité (carte, passeport), gratuit | BlendPDF',
    description:
      'Écrivez sur chaque page de la copie à qui elle est destinée, pour quelle démarche et la date, pour qu’elle ne puisse pas resservir. Gratuit, dans votre navigateur.',
    intro:
      'Avant d’envoyer la copie d’une carte d’identité ou d’un passeport, écrivez dessus à qui elle est destinée, pour quelle démarche, et la date. Si elle circule, elle ne pourra servir à rien d’autre.',
    summary: `Remplissez les deux cases, puis ouvrez votre copie ci-dessous. Le texte est répété sur toute la page${NNBSP}; vous pouvez encore le modifier dans le panneau **Filigrane** avant de cliquer sur **Ajouter le filigrane**.`,
    whoLabel: `À qui est-elle destinée${NNBSP}?`,
    whoPlaceholder: 'ex. l’agence immobilière',
    whatLabel: `Pour quelle démarche${NNBSP}?`,
    whatPlaceholder: 'ex. dossier de location',
    preview: `Votre filigrane${NBSP}:`,
    faq: [
      {
        question: `Ma pièce d’identité est-elle envoyée sur votre serveur${NNBSP}?`,
        answer:
          'Non. Le filigrane est ajouté dans votre navigateur et le fichier reste sur votre appareil. Seul l’envoi du fichier par courriel passe par notre serveur.',
      },
      {
        question: `Le filigrane peut-il être retiré${NNBSP}?`,
        answer: `Il est dessiné dans chaque page, ce n’est pas un calque que l’on désactive. C’est aussi pour cela qu’il indique le destinataire${NBSP}: une copie marquée pour une agence immobilière ne sert à rien pour ouvrir un compte bancaire.`,
      },
      {
        question: `Que faut-il écrire${NNBSP}?`,
        answer: 'Le destinataire, la démarche et la date. Restez bref pour que chaque ligne tienne sur la largeur de la page.',
      },
    ],
    photos: { text: `Des photos de votre pièce${NNBSP}? Mettez-les d’abord en PDF.`, link: 'Images en PDF' },
    home: 'Accueil',
    watermark: 'Ajouter un filigrane',
  },
  ar: {
    title: 'إضافة علامة مائية على نسخة بطاقة التعريف',
    metaTitle: 'علامة مائية على نسخة بطاقة التعريف أو جواز السفر مجاناً | BlendPDF',
    description: 'اكتب على كل صفحة من النسخة لمن هي والغرض منها وتاريخها، حتى لا يُعاد استعمالها. مجاناً وفي متصفحك.',
    intro:
      'قبل أن ترسل نسخة من بطاقة التعريف أو جواز السفر، اكتب عليها الجهة التي ستستلمها والغرض والتاريخ. وإذا تسرّبت النسخة، فلن تصلح لشيء آخر.',
    summary:
      'املأ الخانتين، ثم افتح نسختك هنا. يتكرر النص على الصفحة كلها، ويمكنك تعديله من لوحة **العلامة المائية** قبل الضغط على **أضف العلامة المائية**.',
    whoLabel: 'لمن هذه النسخة؟',
    whoPlaceholder: 'مثلاً: وكالة الكراء',
    whatLabel: 'ما الغرض منها؟',
    whatPlaceholder: 'مثلاً: ملف كراء الشقة',
    preview: 'علامتك المائية:',
    faq: [
      {
        question: 'هل تُرسَل بطاقتي إلى خادمكم؟',
        answer: 'لا. تُضاف العلامة المائية في متصفحك ويبقى الملف على جهازك. وحده إرسال الملف إلى بريدك يمر عبر خادمنا.',
      },
      {
        question: 'هل يمكن إزالة العلامة المائية؟',
        answer:
          'هي مرسومة داخل كل صفحة، وليست طبقة يمكن إخفاؤها. ولهذا أيضاً تذكر الجهة المستلمة: نسخة مخصصة لوكالة كراء لا تنفع لفتح حساب بنكي.',
      },
      {
        question: 'ماذا أكتب؟',
        answer: 'الجهة المستلمة والغرض والتاريخ. اجعل النص قصيراً حتى يتسع كل سطر لعرض الصفحة.',
      },
    ],
    photos: { text: 'عندك صور للبطاقة؟ حوّلها أولاً إلى PDF.', link: 'تحويل الصور إلى PDF' },
    home: 'الرئيسية',
    watermark: 'إضافة علامة مائية',
  },
};

export function idCopyContent(locale: string): IdCopyText {
  return TEXT[idCopyLocale(locale)];
}
