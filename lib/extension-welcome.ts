/**
 * /extension/welcome: the page the Chrome extension opens once, on first
 * install (utm_medium=install). Its visits are the only record of who
 * installs the extension, so keep the URL stable.
 *
 * The screenshot is the real built popup in each language, captured from the
 * blendpdf-extension repo's harness; regenerate it if the popup changes.
 */

export interface WelcomeStep {
  title: string;
  text: string;
}

export interface WelcomeContent {
  metaTitle: string;
  description: string;
  badge: string;
  title: string;
  intro: string;
  steps: [WelcomeStep, WelcomeStep, WelcomeStep];
  shotAlt: string;
  allTools: string;
  privacy: string;
  note: string;
}

const en: WelcomeContent = {
  metaTitle: 'BlendPDF is ready in your browser',
  description: 'Pin the BlendPDF extension to work on PDFs on your computer, or right-click any PDF link to open it in a BlendPDF tool.',
  badge: 'Extension installed',
  title: 'BlendPDF is ready in your browser',
  intro: 'Your PDF tools are now one click away, from the toolbar or from any PDF link.',
  steps: [
    {
      title: 'Pin the icon',
      text: 'Click the extensions button (the puzzle piece) next to the address bar, then the pin next to BlendPDF.',
    },
    {
      title: 'Click the icon and add your PDFs',
      text: 'In the window that opens, drop your PDFs to merge them, rotate them, or delete or extract pages. It all happens on your computer, nothing is uploaded.',
    },
    {
      title: 'Right-click any PDF link',
      text: 'Choose Open in BlendPDF, then a tool. The page opens with your file already loaded.',
    },
  ],
  shotAlt: 'The BlendPDF extension window with two PDFs added, ready to merge, rotate, delete or extract pages',
  allTools: 'See all tools',
  privacy: 'Extension privacy policy',
  note: 'This page opens once, when you install. The extension itself collects nothing.',
};

const fr: WelcomeContent = {
  metaTitle: 'BlendPDF est prêt dans votre navigateur',
  description: 'Épinglez l’extension BlendPDF pour travailler sur vos PDF depuis votre ordinateur, ou faites un clic droit sur un lien PDF pour l’ouvrir dans un outil BlendPDF.',
  badge: 'Extension installée',
  title: 'BlendPDF est prêt dans votre navigateur',
  intro: 'Vos outils PDF sont maintenant à un clic, depuis la barre d’outils ou depuis n’importe quel lien PDF.',
  steps: [
    {
      title: 'Épinglez l’icône',
      text: 'Cliquez sur le bouton des extensions (la pièce de puzzle) à côté de la barre d’adresse, puis sur l’épingle à côté de BlendPDF.',
    },
    {
      title: 'Cliquez sur l’icône et ajoutez vos PDF',
      text: 'Dans la fenêtre qui s’ouvre, déposez vos PDF pour les fusionner, les faire pivoter, ou supprimer ou extraire des pages. Tout se passe sur votre ordinateur : rien n’est envoyé.',
    },
    {
      title: 'Clic droit sur un lien PDF',
      text: 'Choisissez « Ouvrir dans BlendPDF », puis un outil : la page s’ouvre avec votre fichier déjà chargé.',
    },
  ],
  shotAlt: 'La fenêtre de l’extension BlendPDF avec deux PDF ajoutés, prêts à être fusionnés, pivotés ou découpés',
  allTools: 'Voir tous les outils',
  privacy: 'Politique de confidentialité de l’extension',
  note: 'Cette page ne s’ouvre qu’une fois, à l’installation. L’extension elle-même ne collecte aucune donnée.',
};

const ar: WelcomeContent = {
  metaTitle: 'BlendPDF جاهز في متصفحك',
  description: 'ثبّت أيقونة BlendPDF في شريط الأدوات لتعديل ملفات PDF على جهازك، أو انقر بالزر الأيمن على أي رابط PDF لفتحه في إحدى أدوات BlendPDF.',
  badge: 'تمت الإضافة إلى Chrome',
  title: 'BlendPDF جاهز في متصفحك',
  intro: 'أدوات PDF صارت على بُعد نقرة واحدة، من شريط الأدوات أو من أي رابط PDF.',
  steps: [
    {
      title: 'ثبّت الأيقونة في شريط الأدوات',
      text: 'انقر على زر الإضافات (على شكل قطعة بازل) بجانب شريط العناوين، ثم على الدبوس بجانب BlendPDF.',
    },
    {
      title: 'انقر على الأيقونة وأضف ملفاتك',
      text: 'في النافذة التي تظهر، أضف ملفات PDF لدمجها أو تدوير صفحاتها أو حذفها أو استخراجها. كل ذلك على جهازك، دون رفع أي ملف.',
    },
    {
      title: 'انقر بالزر الأيمن على أي رابط PDF',
      text: 'اختر «فتح في BlendPDF» ثم الأداة التي تريدها، فتُفتح الصفحة وملفك جاهز فيها.',
    },
  ],
  shotAlt: 'نافذة إضافة BlendPDF وفيها ملفا PDF جاهزان للدمج أو التدوير أو حذف الصفحات',
  allTools: 'كل الأدوات',
  privacy: 'سياسة خصوصية الإضافة',
  note: 'تظهر هذه الصفحة مرة واحدة فقط عند التثبيت. الإضافة نفسها لا تجمع أي بيانات.',
};

const CONTENT: Record<string, WelcomeContent> = { en, fr, ar };

export function welcomeContent(locale: string): WelcomeContent {
  return CONTENT[locale] ?? en;
}

/** public/extension/welcome-popup-<locale>.webp, 760×1262 (2× of a 380px popup). */
export function welcomeShot(locale: string): { src: string; width: number; height: number } {
  const lang = locale in CONTENT ? locale : 'en';
  return { src: `/extension/welcome-popup-${lang}.webp`, width: 760, height: 1262 };
}
