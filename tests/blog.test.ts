/**
 * The blog (lib/blog): every image and video on disk, every internal link a
 * real page or file, competitors named only where a live comparison page
 * backs the claim, and the content never shipped to the browser. A post
 * written in Arabic too is indexed at /ar with hreflang pairs and linked from
 * the English one and back; under /fr and /es the English stays a noindex copy.
 */
import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { POSTS, TRANSLATIONS, blogChrome, blogPath, blogPost, postLangs, type BlogPost } from '../lib/blog';
import { COMPARISONS } from '../lib/comparisons';
import sitemap from '../app/sitemap';
import BlogPostPage, { generateMetadata } from '../app/[locale]/blog/[slug]/page';

// The page's chrome needs the next-intl runtime; a link renders as a plain <a> carrying its target locale.
vi.mock('@/i18n/routing', () => ({
  Link: ({ href, locale, children }: { href: string; locale?: string; children: ReactNode }) =>
    createElement('a', { href, 'data-locale': locale }, children),
}));
vi.mock('@/components/Navigation', () => ({ Navigation: () => null }));
vi.mock('@/components/Footer', () => ({ Footer: () => null }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
}));

const ROOT = join(__dirname, '..');
const BASE = 'https://blendpdf.com';
/** Every version of every post: the English ones and those written in another language. */
const ALL = [...POSTS, ...TRANSLATIONS];
const SLUG = 'editing-arabic-text-in-pdf';
const params = (locale: string) => ({ params: Promise.resolve({ locale, slug: SLUG }) });
const render = async (locale: string) => renderToStaticMarkup(await BlogPostPage(params(locale)));

/** Every text a post shows. */
function texts(post: BlogPost): string[] {
  return [
    post.title,
    post.metaTitle,
    post.description,
    ...post.lead,
    ...post.body.flatMap((b) => {
      switch (b.type) {
        case 'p':
        case 'h2':
          return [b.text];
        case 'list':
          return b.items;
        case 'code':
          return [b.code];
        case 'table':
          return [...b.head, ...b.rows.flat()];
        case 'figure':
        case 'video':
          return [b.alt, b.caption];
      }
    }),
  ];
}

/** Files under public/ a post shows. */
function assets(post: BlogPost): string[] {
  return [post.cover.src, ...post.body.flatMap((b) => (b.type === 'figure' ? [b.src] : b.type === 'video' ? [b.src, b.poster] : []))];
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name.startsWith('.') ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe('blog', () => {
  it('has unique slugs and section anchors, and every image and video on disk', () => {
    expect(new Set(POSTS.map((p) => p.slug)).size).toBe(POSTS.length);
    for (const post of ALL) {
      const ids = post.body.flatMap((b) => (b.type === 'h2' ? [b.id] : []));
      expect(new Set(ids).size, post.slug).toBe(ids.length);
      for (const src of assets(post)) expect(existsSync(join(ROOT, 'public', src)), src).toBe(true);
      expect(post.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('links only to pages and files that exist', () => {
    const pages = new Set(readdirSync(join(ROOT, 'app', '[locale]')));
    for (const post of ALL) {
      for (const text of texts(post)) {
        for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
          if (/^https?:\/\//.test(href)) continue;
          expect(href, `${post.slug}: ${href}`).toMatch(/^\//);
          if (/\.[a-z0-9]+$/i.test(href)) expect(existsSync(join(ROOT, 'public', href)), href).toBe(true);
          else expect(pages.has(href.split('/')[1]), href).toBe(true);
        }
      }
    }
  });

  it('names a competitor only when a live comparison page backs the claim', () => {
    const others = ['Sejda', 'iLovePDF', 'Smallpdf', 'PDF24', 'PDF Candy', 'PdfBayt', 'Adobe', 'Foxit', 'Nitro', 'PDFescape', 'Xodo', 'Stirling'];
    const compared = new Set(COMPARISONS.map((c) => c.name.split(' ')[0]));
    for (const post of ALL) {
      const all = texts(post).join('\n');
      for (const name of others) if (all.includes(name)) expect(compared.has(name.split(' ')[0]), `${post.slug} names ${name}`).toBe(true);
    }
  });

  it('reads as written by a person: no em dashes', () => {
    for (const post of ALL) for (const text of texts(post)) expect(text, `${post.lang} ${post.slug}`).not.toContain('—');
  });

  it('writes each post in English first, and another language under the same slug and sections', () => {
    for (const post of POSTS) expect(post.lang).toBe('en');
    for (const version of TRANSLATIONS) {
      const english = POSTS.find((p) => p.slug === version.slug);
      expect(english, version.slug).toBeDefined();
      expect(version.lang).not.toBe('en');
      // Same anchors, so #section links work in either language
      const ids = (p: BlogPost) => p.body.flatMap((b) => (b.type === 'h2' ? [b.id] : []));
      expect(ids(version)).toEqual(ids(english!));
      expect(assets(version).sort()).toEqual(assets(english!).sort());
    }
    expect(postLangs(SLUG)).toEqual(['en', 'ar']);
    expect(blogPost(SLUG, 'ar')?.lang).toBe('ar');
    for (const locale of ['en', 'fr', 'es']) expect(blogPost(SLUG, locale)?.lang).toBe('en');
  });

  it('writes Arabic with Arabic punctuation and no hidden direction marks', () => {
    for (const post of TRANSLATIONS.filter((p) => p.lang === 'ar')) {
      for (const text of texts(post)) {
        expect(text, text).not.toMatch(/[؀-ۿ][,?;]|[,?;] ?[؀-ۿ]/);
        expect(text, text).not.toMatch(/[‎‏‪-‮⁦-⁩]/);
      }
    }
  });

  it('indexes the English and Arabic posts with hreflang pairs, and keeps /fr and /es a noindex copy of the English', async () => {
    const en = `${BASE}${blogPath(SLUG)}`;
    const ar = `${BASE}/ar${blogPath(SLUG)}`;
    const pair = { en, ar, 'x-default': en };
    for (const [locale, canonical] of [
      ['en', en],
      ['ar', ar],
    ]) {
      const meta = await generateMetadata(params(locale));
      expect(meta.alternates?.canonical, locale).toBe(canonical);
      expect(meta.alternates?.languages, locale).toEqual(pair);
      expect(meta.robots, locale).toBeUndefined();
      expect(meta.title).toBe(blogPost(SLUG, locale)!.metaTitle);
    }
    for (const locale of ['fr', 'es']) {
      const meta = await generateMetadata(params(locale));
      expect(meta.alternates?.canonical, locale).toBe(en);
      expect(meta.alternates?.languages, locale).toEqual(pair);
      expect(meta.robots, locale).toEqual({ index: false, follow: true });
      expect(meta.title).toBe(blogPost(SLUG, 'en')!.metaTitle);
    }
  });

  it('lists both written versions in the sitemap, each with the pair as alternates', async () => {
    const entries = await sitemap();
    const urls = [`${BASE}${blogPath(SLUG)}`, `${BASE}/ar${blogPath(SLUG)}`];
    for (const url of urls) {
      const entry = entries.find((e) => e.url === url);
      expect(entry, url).toBeDefined();
      expect(entry!.alternates?.languages).toEqual({ en: urls[0], ar: urls[1] });
    }
    for (const locale of ['fr', 'es']) expect(entries.some((e) => e.url === `${BASE}/${locale}${blogPath(SLUG)}`)).toBe(false);
  });

  it('renders the Arabic post right to left, linked from the English one and back', async () => {
    const ar = await render('ar');
    expect(ar).toContain('<article lang="ar" dir="rtl"');
    expect(ar).toContain(`<a href="${blogPath(SLUG)}" data-locale="en">${blogChrome('ar').readIn.en}</a>`);
    expect(ar).not.toContain(blogChrome('ar').englishOnly);
    // Code stays left to right inside the Arabic article
    expect(ar).toMatch(/<pre dir="ltr"/);
    expect(ar).toMatch(/<code dir="ltr"[^>]*>U\+064A<\/code>/);

    const en = await render('en');
    expect(en).toContain('<article lang="en" dir="ltr"');
    expect(en).toContain(`<a href="${blogPath(SLUG)}" data-locale="ar">${blogChrome('en').readIn.ar}</a>`);

    // A copy of the English post under /fr says it is in English and links nowhere else
    const fr = await render('fr');
    expect(fr).toContain('<article lang="en" dir="ltr"');
    expect(fr).toContain(blogChrome('fr').englishOnly);
    expect(fr).not.toContain('data-locale=');
  });

  it('says the posts are in English everywhere but English, and names the other written language in each', () => {
    expect(blogChrome('en').englishOnly).toBeNull();
    expect(blogChrome('fr').englishOnly).toBeTruthy();
    expect(blogChrome('ar').englishOnly).toBeTruthy();
    for (const version of TRANSLATIONS) {
      expect(blogChrome('en').readIn[version.lang], version.lang).toBeTruthy();
      expect(blogChrome(version.lang).readIn.en, version.lang).toBeTruthy();
    }
  });

  it('post pages render on request and 404 an unknown slug', () => {
    const page = readFileSync(join(ROOT, 'app', '[locale]', 'blog', '[slug]', 'page.tsx'), 'utf8');
    expect(page).not.toMatch(/export const dynamicParams\s*=\s*false/);
    expect(page).toMatch(/notFound\(\)/);
  });

  it('stays server-only: no client component imports lib/blog', () => {
    const clients = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'components'))].filter((f) =>
      /^\s*['"]use client['"]/m.test(readFileSync(f, 'utf8')),
    );
    for (const file of clients) expect(readFileSync(file, 'utf8'), file).not.toMatch(/from ['"]@\/lib\/blog/);
  });
});
