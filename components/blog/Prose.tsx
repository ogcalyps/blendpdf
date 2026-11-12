import type { ReactNode } from 'react';
import { Link } from '@/i18n/routing';
import type { BlogBlock, BlogLang } from '@/lib/blog';

/** An Arabic run inside English text: letters and presentation forms, with the spaces between its words. */
const ARABIC_RUN = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻾]+(?:[  ]+[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻾]+)*/g;
/** **bold**, `code` or [label](href). */
const MARKUP = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g;

/** Arabic runs isolated, so the English sentence around them keeps its own order. */
function isolateArabic(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(ARABIC_RUN)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <bdi key={`${key}-${m.index}`} lang="ar" dir="rtl" className="font-[family-name:var(--font-cairo)]">
        {m[0]}
      </bdi>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function PostLink({ href, children }: { href: string; children: ReactNode }) {
  const className = 'font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary';
  // Site pages get the reader's locale prefix; files under public/ and other sites don't.
  if (href.startsWith('/') && !/\.[a-z0-9]+$/i.test(href)) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} {...(href.startsWith('http') ? { rel: 'noopener' } : {})}>
      {children}
    </a>
  );
}

/** Post text: **bold**, `code`, [label](href); nothing else is markup. An Arabic post needs no Arabic runs isolated. */
export function Inline({ text, lang = 'en' }: { text: string; lang?: BlogLang }): ReactNode {
  const isolate = lang === 'ar' ? (s: string) => [s] : isolateArabic;
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKUP)) {
    if (m.index > last) out.push(...isolate(text.slice(last, m.index), `t${last}`));
    const key = `m${m.index}`;
    if (m[1] !== undefined) {
      out.push(
        <strong key={key} className="font-semibold text-gray-900">
          {isolate(m[1], key)}
        </strong>,
      );
    } else if (m[2] !== undefined) {
      out.push(
        <code key={key} dir="ltr" className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[0.9em] text-gray-800">
          {m[2]}
        </code>,
      );
    } else {
      out.push(
        <PostLink key={key} href={m[4]}>
          {isolate(m[3], key)}
        </PostLink>,
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...isolate(text.slice(last), `t${last}`));
  return out;
}

/** The same text without the markers, for meta tags and structured data. */
export const plainText = (text: string) =>
  text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1');

export function Block({ block, first, lang = 'en' }: { block: BlogBlock; first?: boolean; lang?: BlogLang }): ReactNode {
  switch (block.type) {
    case 'p':
      return (
        <p className="mt-5 text-lg leading-relaxed text-gray-700">
          <Inline text={block.text} lang={lang} />
        </p>
      );
    case 'h2':
      return (
        <h2 id={block.id} className="mt-14 scroll-mt-24 text-2xl font-bold leading-snug text-gray-900">
          <Inline text={block.text} lang={lang} />
        </h2>
      );
    case 'list':
      return (
        <ul className="mt-5 list-disc space-y-3 ps-6 text-lg leading-relaxed text-gray-700 marker:text-gray-400">
          {block.items.map((item, i) => (
            <li key={i}>
              <Inline text={item} lang={lang} />
            </li>
          ))}
        </ul>
      );
    case 'code':
      return (
        <pre dir="ltr" className="mt-5 overflow-x-auto rounded-xl bg-gray-900 p-4 text-sm leading-relaxed text-gray-100">
          <code className="font-mono">{block.code}</code>
        </pre>
      );
    case 'table':
      return (
        <div className="mt-5 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full min-w-[34rem] border-collapse text-start text-sm">
            <thead className="bg-gray-50 text-gray-900">
              <tr>
                {block.head.map((cell, i) => (
                  <th key={i} scope="col" className="px-4 py-3 text-start font-semibold">
                    <Inline text={cell} lang={lang} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r} className="border-t border-gray-100">
                  {row.map((cell, c) => (
                    <td key={c} className="px-4 py-3 align-top text-gray-700">
                      <Inline text={cell} lang={lang} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'figure':
      return (
        <figure className="mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- already sized WebP, no optimizer needed */}
          <img
            src={block.src}
            width={block.width}
            height={block.height}
            alt={block.alt}
            loading={first ? 'eager' : 'lazy'}
            decoding="async"
            className="h-auto w-full rounded-xl border border-gray-200 bg-white"
          />
          <figcaption className="mt-2 text-sm leading-relaxed text-gray-500">
            <Inline text={block.caption} lang={lang} />
          </figcaption>
        </figure>
      );
    case 'video':
      return (
        <figure className="mt-8">
          <video
            src={block.src}
            poster={block.poster}
            width={block.width}
            height={block.height}
            aria-label={block.alt}
            autoPlay
            muted
            loop
            playsInline
            controls
            preload="metadata"
            className="h-auto w-full rounded-xl border border-gray-200 bg-gray-50"
          />
          <figcaption className="mt-2 text-sm leading-relaxed text-gray-500">
            <Inline text={block.caption} lang={lang} />
          </figcaption>
        </figure>
      );
  }
}
