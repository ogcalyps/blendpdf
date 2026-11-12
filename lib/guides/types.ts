/**
 * Step-by-step guides (/guides): what each guide says, in each language.
 * Text may mark a UI label in **bold**. A step's `shot` is the number of its
 * screenshot, public/guides/<locale>/<slug>-<shot>.webp (taken from the real
 * app by blendpdf-guide-shots/capture.mjs; sizes in ./shots.json).
 */

export type GuideSlug =
  | 'how-blendpdf-works'
  | 'add-letterhead-to-pdf'
  | 'sign-and-stamp-pdf'
  | 'compress-pdf-under-size-limit'
  | 'merge-split-reorder-pages'
  | 'edit-pdf-text';

export interface GuideStep {
  title: string;
  text: string;
  shot?: number;
  /** What the screenshot shows, for people who can't see it (and for search). */
  alt?: string;
}

export interface GuideContent {
  /** The page's heading. */
  title: string;
  /** <title>, with the brand. */
  metaTitle: string;
  description: string;
  /** The answer in a few sentences, before the steps. */
  summary: string;
  steps: GuideStep[];
  /** "Good to know": short answers to what people ask next. */
  tips: { title: string; text: string }[];
  /** The button to the tool: "Open Edit PDF". */
  cta: string;
}

/** The words around every guide, per language. */
export interface GuideChrome {
  guides: string;
  hubTitle: string;
  hubMetaTitle: string;
  hubDescription: string;
  hubIntro: string;
  home: string;
  steps: string;
  goodToKnow: string;
  moreGuides: string;
  minutes: (n: number) => string;
  updated: string;
}
