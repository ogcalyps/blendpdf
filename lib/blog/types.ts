/**
 * Blog posts (/blog): long-form engineering notes, written in English, some
 * also written in Arabic.
 *
 * Inline markup in any text: **bold**, `code` and [label](href). Arabic runs
 * inside English text are isolated for bidi by the renderer, so they need no
 * markup. Nothing else is markup.
 */

export type BlogSlug = 'editing-arabic-text-in-pdf';

/** The languages a post can be written in: English always, Arabic for some (lib/blog/ar/, same slug). */
export type BlogLang = 'en' | 'ar';

export type BlogBlock =
  | { type: 'p'; text: string }
  /** A section heading; `id` is its anchor (#id) and must be unique in the post. */
  | { type: 'h2'; text: string; id: string }
  | { type: 'list'; items: string[] }
  /** Code or PDF syntax, shown as written (no inline markup). */
  | { type: 'code'; code: string }
  /** A small table; cells take inline markup. */
  | { type: 'table'; head: string[]; rows: string[][] }
  /** An image under public/, with its real size in pixels (taken at 2x). */
  | { type: 'figure'; src: string; width: number; height: number; alt: string; caption: string }
  /** A short silent loop under public/: plays inline, muted, with a poster image. */
  | { type: 'video'; src: string; poster: string; width: number; height: number; alt: string; caption: string };

export interface BlogPost {
  slug: BlogSlug;
  lang: BlogLang;
  /** The page's heading. */
  title: string;
  /** <title>, with the brand. */
  metaTitle: string;
  description: string;
  /** ISO dates (YYYY-MM-DD). */
  published: string;
  updated?: string;
  minutes: number;
  /** The image for link previews and the hub card, under public/. */
  cover: { src: string; width: number; height: number };
  /** The opening, before the first section. */
  lead: string[];
  body: BlogBlock[];
}

/** The words around every post, per site language. */
export interface BlogChrome {
  blog: string;
  home: string;
  hubTitle: string;
  hubMetaTitle: string;
  hubDescription: string;
  hubIntro: string;
  /** Shown above an English post rendered in another site language, and on the hub when a post has no version in it; null in English. */
  englishOnly: string | null;
  /** The link to the same post in another language it is written in, worded in this one. */
  readIn: Partial<Record<BlogLang, string>>;
  minutes: (n: number) => string;
  published: (date: string) => string;
}
