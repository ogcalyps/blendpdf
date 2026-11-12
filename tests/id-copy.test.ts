/**
 * /watermark-pdf/id-copy (lib/id-copy): the tiled text in each language,
 * every **label** a real UI label, house style, and the page in the sitemap.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idCopyContent, idCopyText } from '../lib/id-copy';
import sitemap from '../app/sitemap';

const ROOT = join(__dirname, '..');
const DAY = new Date('2026-11-07T12:00:00Z');

function uiStrings(locale: string): string[] {
  const out: string[] = [];
  const walk = (o: unknown) => {
    if (typeof o === 'string') out.push(o);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  };
  walk(JSON.parse(readFileSync(join(ROOT, 'messages', `${locale}.json`), 'utf8')));
  return out;
}

const texts = (locale: string) => {
  const t = idCopyContent(locale);
  return [t.title, t.metaTitle, t.description, t.intro, t.summary, t.whoLabel, t.whoPlaceholder, t.whatLabel, t.whatPlaceholder, t.preview, t.photos.text, t.photos.link, ...t.faq.flatMap((q) => [q.question, q.answer])];
};

describe('ID copy watermark', () => {
  it('says who it is for, what for and the date, leaving out what is blank', () => {
    expect(idCopyText('en', ' the letting agency ', 'the flat application', DAY)).toBe('Copy for the letting agency only, for the flat application, 07/11/2026');
    expect(idCopyText('fr', 'l’agence', 'dossier de location', DAY)).toBe('Copie destinée à l’agence, pour dossier de location, le 07/11/2026');
    expect(idCopyText('ar', 'وكالة الكراء', '', DAY)).toBe('نسخة خاصة بـوكالة الكراء، بتاريخ 07/11/2026');
    expect(idCopyText('en', '', '', DAY)).toBe('Copy, 07/11/2026');
  });

  it('every **label** is one the site shows in that language', () => {
    for (const locale of ['en', 'fr', 'ar']) {
      const ui = uiStrings(locale);
      const labels = texts(locale).flatMap((s) => [...s.matchAll(/\*\*(.+?)\*\*/g)].map((m) => m[1]));
      expect(labels.length, locale).toBeGreaterThan(0);
      expect(labels.filter((l) => !ui.includes(l)), locale).toEqual([]);
    }
  });

  it('house style', () => {
    for (const locale of ['en', 'fr']) expect(texts(locale).filter((s) => /[–—]/.test(s)), locale).toEqual([]);
    expect(texts('fr').filter((s) => /[^  ][;:!?»]|«[^  ]/.test(s) || s.includes("'"))).toEqual([]);
    const banned = ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—'];
    expect(texts('ar').filter((s) => banned.some((w) => s.includes(w)))).toEqual([]);
  });

  it('is in the sitemap in every language', async () => {
    const urls = new Set((await sitemap()).map((e) => e.url));
    for (const prefix of ['', '/fr', '/ar']) expect(urls.has(`https://blendpdf.com${prefix}/watermark-pdf/id-copy`), prefix).toBe(true);
  });
});
