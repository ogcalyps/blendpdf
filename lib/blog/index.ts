/**
 * The blog (/blog and /blog/<slug>): engineering notes. Server-only content,
 * like lib/guides: it never reaches the browser bundle as messages.
 *
 * Every post is written in English, and some in Arabic too (lib/blog/ar/,
 * same slug), each version indexed at its own URL with hreflang pairs. In any
 * other site language the English post renders, because the locale middleware
 * sends French and Spanish browsers there from the English URL. Those copies
 * say the post is in English, point their canonical at the English URL and are
 * noindex, so search engines only see the written versions.
 */
import type { BlogChrome, BlogLang, BlogPost, BlogSlug } from './types';
import { post as editingArabicText } from './editing-arabic-text-in-pdf';
import { post as editingArabicTextAr } from './ar/editing-arabic-text-in-pdf';

export type { BlogBlock, BlogChrome, BlogLang, BlogPost, BlogSlug } from './types';

/** Newest first, the order the hub lists them: every post, in English. */
export const POSTS: readonly BlogPost[] = [editingArabicText];

/** Posts also written in another language: the same slug, their own text. */
export const TRANSLATIONS: readonly BlogPost[] = [editingArabicTextAr];

/** A post as it renders in a site language: its version in that language, else the English one. */
export function blogPost(slug: string, locale = 'en'): BlogPost | undefined {
  return TRANSLATIONS.find((p) => p.slug === slug && p.lang === locale) ?? POSTS.find((p) => p.slug === slug);
}

/** The languages a post is written in, English first (its x-default). */
export function postLangs(slug: BlogSlug): BlogLang[] {
  return ['en', ...TRANSLATIONS.filter((p) => p.slug === slug).map((p) => p.lang)];
}

export const blogPath = (slug: BlogSlug) => `/blog/${slug}`;

const day = (locale: string) => (date: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

const CHROME: Record<'en' | 'fr' | 'ar', BlogChrome> = {
  en: {
    blog: 'Blog',
    home: 'Home',
    hubTitle: 'Engineering notes',
    hubMetaTitle: 'Engineering notes | BlendPDF',
    hubDescription: 'How BlendPDF is built: editing Arabic PDFs in the browser, what works, and what still fails.',
    hubIntro: 'How BlendPDF is built, the bugs we hit on the way, and what still doesn’t work. The code is open source.',
    englishOnly: null,
    readIn: { ar: 'Read this post in Arabic' },
    minutes: (n) => `${n} min read`,
    published: (date) => day('en-GB')(date),
  },
  fr: {
    blog: 'Blog',
    home: 'Accueil',
    hubTitle: 'Notes techniques',
    hubMetaTitle: 'Notes techniques | BlendPDF',
    hubDescription: 'Comment BlendPDF est construit : modifier un PDF en arabe dans le navigateur, ce qui marche et ce qui ne marche pas encore.',
    hubIntro: 'Comment BlendPDF est construit, les problèmes rencontrés en route et ce qui ne marche pas encore. Le code est open source.',
    englishOnly: 'Les articles du blog sont en anglais.',
    readIn: {},
    minutes: (n) => `${n} min de lecture`,
    published: (date) => day('fr-FR')(date),
  },
  ar: {
    blog: 'المدونة',
    home: 'الرئيسية',
    hubTitle: 'ملاحظات تقنية',
    hubMetaTitle: 'ملاحظات تقنية | BlendPDF',
    hubDescription: 'كيف بنينا BlendPDF: تعديل ملفات PDF العربية داخل المتصفح، وما الذي ينجح وما الذي لا يزال يتعثر.',
    hubIntro: 'كيف بنينا BlendPDF، والمشاكل التي واجهتنا في الطريق، وما الذي لا يعمل بعد. الشيفرة مفتوحة المصدر.',
    englishOnly: 'مقالات المدونة باللغة الإنجليزية.',
    readIn: { en: 'اقرأ المقال بالإنجليزية' },
    minutes: (n) => `مدة القراءة: ${n <= 10 ? `${n} دقائق` : `${n} دقيقة`}`,
    published: (date) => day('ar-u-nu-latn')(date),
  },
};

export function blogChrome(locale: string): BlogChrome {
  return CHROME[locale === 'fr' || locale === 'ar' ? locale : 'en'];
}
