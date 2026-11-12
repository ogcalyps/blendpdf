/**
 * The size pages (/compress-pdf/to-<n>): their limits and their text per
 * language (./en, ./fr, ./ar). Server-only content, like lib/guides.
 */
import type { PortalSlug, PortalTarget, PortalText, SizeChrome, SizePageText, SizeTarget, SizeTargetSlug } from './types';
import * as en from './en';
import * as fr from './fr';
import * as ar from './ar';
import { PORTALS, SIZE_TARGETS } from './targets';

export type { PageLocale, PortalSlug, PortalTarget, PortalText, SizeChrome, SizeLimit, SizePageText, SizeTarget, SizeTargetSlug } from './types';
export { PORTALS, SIZE_TARGETS, sizeLabel } from './targets';

export type SizeLocale = 'en' | 'fr' | 'ar';

const CONTENT: Record<SizeLocale, { chrome: SizeChrome; pages: Record<SizeTargetSlug, SizePageText>; portals: Partial<Record<PortalSlug, PortalText>> }> = {
  en,
  fr,
  ar,
};

export const sizeLocale = (locale: string): SizeLocale => (locale === 'fr' || locale === 'ar' ? locale : 'en');

export function sizeTarget(slug: string): SizeTarget | undefined {
  return SIZE_TARGETS.find((t) => t.slug === slug);
}

export function sizeChrome(locale: string): SizeChrome {
  return CONTENT[sizeLocale(locale)].chrome;
}

export function sizePageText(locale: string, slug: SizeTargetSlug): SizePageText {
  return CONTENT[sizeLocale(locale)].pages[slug];
}

/** A site's page, only in the languages it has (PortalTarget.locales). */
export function portalTarget(slug: string, locale: string): PortalTarget | undefined {
  const portal = PORTALS.find((p) => p.slug === slug);
  return portal && (portal.locales as readonly string[]).includes(locale) ? portal : undefined;
}

export function portalText(locale: string, slug: PortalSlug): PortalText {
  const text = CONTENT[sizeLocale(locale)].portals[slug];
  if (!text) throw new Error(`No ${locale} text for ${slug}`);
  return text;
}

/** The sites with a page in this language, in PORTALS order. */
export function portalsIn(locale: string): PortalTarget[] {
  return PORTALS.filter((p) => (p.locales as readonly string[]).includes(locale));
}
