/**
 * The step-by-step guides (lib/guides): every guide in every language, every
 * screenshot on disk, house style per language, and every **label** a guide
 * tells people to click is a label the site really shows in that language.
 */
import { describe, expect, it } from 'vitest';
import { badSpanish } from './helpers/spanish';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUIDES, guideChrome, guideContent, guideShot, type GuideContent } from '../lib/guides';

const ROOT = join(__dirname, '..');
const LOCALES = ['en', 'fr', 'ar', 'es'] as const;

/** Every text a guide shows. */
function texts(g: GuideContent): string[] {
  return [g.title, g.metaTitle, g.description, g.summary, g.cta, ...g.steps.flatMap((s) => [s.title, s.text, s.alt ?? '']), ...g.tips.flatMap((t) => [t.title, t.text])];
}

/** Every string the site shows in a language (ICU plural branches included). */
function uiStrings(locale: string): string[] {
  const out: string[] = [];
  const walk = (o: unknown) => {
    if (typeof o === 'string') out.push(o, ...[...o.matchAll(/\{([^{}]+)\}/g)].map((m) => m[1]));
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8')));
  return out;
}

describe('guides', () => {
  it('exist in every language, with every screenshot on disk', () => {
    for (const locale of LOCALES) {
      for (const g of GUIDES) {
        const content = guideContent(locale, g.slug);
        expect(content.steps.length, `${locale} ${g.slug}`).toBeGreaterThan(1);
        for (const n of [...content.steps.flatMap((s) => (s.shot ? [s.shot] : [])), g.cover]) {
          const shot = guideShot(locale, g.slug, n);
          expect(shot, `${locale}/${g.slug}-${n} in shots.json`).not.toBeNull();
          expect(existsSync(join(ROOT, 'public', shot!.src)), shot!.src).toBe(true);
        }
        for (const related of g.related) expect(GUIDES.some((x) => x.slug === related)).toBe(true);
      }
      expect(guideChrome(locale).minutes(2)).toMatch(/2|دقيقتان/);
    }
  });

  it('guide pages render on request: dynamicParams = false with slug-only params 404s every guide in production (dev hides it)', () => {
    const page = readFileSync(join(ROOT, 'app', '[locale]', 'guides', '[slug]', 'page.tsx'), 'utf8');
    expect(page).not.toMatch(/export const dynamicParams\s*=\s*false/);
    expect(page).toMatch(/notFound\(\)/);
  });

  it('every step with a screenshot describes it (alt text)', () => {
    for (const locale of LOCALES) {
      for (const g of GUIDES) {
        for (const step of guideContent(locale, g.slug).steps) if (step.shot) expect(step.alt, `${locale} ${g.slug}: ${step.title}`).toBeTruthy();
      }
    }
  });

  it('every **label** is one the site shows in that language', () => {
    for (const locale of LOCALES) {
      const ui = uiStrings(locale);
      const missing = GUIDES.flatMap((g) =>
        texts(guideContent(locale, g.slug))
          .flatMap((t) => [...t.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]))
          .filter((label) => !ui.some((s) => s.includes(label)))
          .map((label) => `${g.slug}: ${label}`),
      );
      expect(missing, locale).toEqual([]);
    }
  });

  it('house style: no dashes in English and French, French spacing, no banned Arabic words', () => {
    const all = (locale: string) => GUIDES.flatMap((g) => texts(guideContent(locale, g.slug)));
    for (const locale of ['en', 'fr']) expect(all(locale).filter((t) => /[–—]/.test(t)), locale).toEqual([]);
    // French: a no-break space before ; : ! ? » and after «
    const badFrench = all('fr').filter((t) => /[^  ][;:!?»]|«[^  ]/.test(t.replace(/https?:\/\/\S+/g, '')));
    expect(badFrench).toEqual([]);
    expect(all('es').filter(badSpanish)).toEqual([]);
    const banned = ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—'];
    expect(all('ar').filter((t) => banned.some((w) => t.includes(w)))).toEqual([]);
  });
});
