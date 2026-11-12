/**
 * The guides (/guides and /guides/<slug>): their order, the tool each one
 * leads to, related guides, and their text per language (./en, ./fr, ./ar, ./es).
 * Server-only content: it never reaches the browser bundle as messages.
 */
import type { GuideChrome, GuideContent, GuideSlug } from './types';
import * as en from './en';
import * as fr from './fr';
import * as ar from './ar';
import * as es from './es';
import shots from './shots.json';

export type { GuideChrome, GuideContent, GuideSlug, GuideStep } from './types';

export type GuideLocale = 'en' | 'fr' | 'ar' | 'es';

export interface GuideMeta {
  slug: GuideSlug;
  /** The page the guide's button opens. */
  tool: string;
  minutes: number;
  related: GuideSlug[];
  /** The screenshot that shows the guide best on its card and in link previews. */
  cover: number;
}

/** In the order the hub lists them. */
export const GUIDES: readonly GuideMeta[] = [
  { slug: 'how-blendpdf-works', tool: '/edit-pdf', minutes: 2, related: ['edit-pdf-text', 'merge-split-reorder-pages'], cover: 3 },
  { slug: 'add-letterhead-to-pdf', tool: '/edit-pdf', minutes: 2, related: ['sign-and-stamp-pdf', 'compress-pdf-under-size-limit'], cover: 2 },
  { slug: 'sign-and-stamp-pdf', tool: '/sign-pdf', minutes: 2, related: ['add-letterhead-to-pdf', 'edit-pdf-text'], cover: 2 },
  { slug: 'compress-pdf-under-size-limit', tool: '/compress-pdf', minutes: 1, related: ['merge-split-reorder-pages', 'sign-and-stamp-pdf'], cover: 2 },
  { slug: 'merge-split-reorder-pages', tool: '/merge-pdf', minutes: 3, related: ['compress-pdf-under-size-limit', 'how-blendpdf-works'], cover: 1 },
  { slug: 'edit-pdf-text', tool: '/edit-pdf', minutes: 2, related: ['sign-and-stamp-pdf', 'add-letterhead-to-pdf'], cover: 2 },
];

const CONTENT: Record<GuideLocale, { chrome: GuideChrome; guides: Record<GuideSlug, GuideContent> }> = { en, fr, ar, es };

export const guideLocale = (locale: string): GuideLocale => (locale === 'fr' || locale === 'ar' || locale === 'es' ? locale : 'en');

export function guideChrome(locale: string): GuideChrome {
  return CONTENT[guideLocale(locale)].chrome;
}

export function guideMeta(slug: string): GuideMeta | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export function guideContent(locale: string, slug: GuideSlug): GuideContent {
  return CONTENT[guideLocale(locale)].guides[slug];
}

/** A screenshot's path and size, or null when it hasn't been taken. */
export function guideShot(locale: string, slug: GuideSlug, n: number): { src: string; width: number; height: number } | null {
  const l = guideLocale(locale);
  const size = (shots as Record<string, { width: number; height: number }>)[`${l}/${slug}-${n}`];
  return size ? { src: `/guides/${l}/${slug}-${n}.webp`, ...size } : null;
}
