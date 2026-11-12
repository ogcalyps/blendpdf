import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// next-intl's own ICU parser (a dependency of use-intl), so this reads messages exactly as the site does
import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser';
import { locales } from '@/i18n';
import { languageAlternates } from '@/lib/i18n/seo';

/**
 * Every translated catalog must have English's keys, and each message the same
 * placeholders and rich-text tags, or next-intl shows raw keys or drops values.
 * French also follows its own typography: ’ for apostrophes (an ASCII ' is an
 * ICU escape character), no-break spaces before : ; ! ? and inside « », and
 * Mo/Ko/Go units. Spanish follows its own: ¿ and ¡ open every question and
 * exclamation, no space before punctuation, a decimal comma, MB/KB/GB, and
 * usted throughout.
 */
const ROOT = join(__dirname, '..');
const catalog = (locale: string) => JSON.parse(readFileSync(join(ROOT, `messages/${locale}.json`), 'utf8'));

function flatten(o: Record<string, unknown>, prefix = '', out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v as Record<string, unknown>, key, out);
    else out[key] = v;
  }
  return out;
}

/** Placeholders and tags a message uses, e.g. "count,name|b,link". */
function shape(message: string): string {
  const args = new Set<string>();
  const tags = new Set<string>();
  const walk = (els: MessageFormatElement[]) => {
    for (const el of els) {
      if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) args.add(el.value);
      if (el.type === TYPE.tag) {
        tags.add(el.value);
        walk(el.children);
      }
      if (el.type === TYPE.plural || el.type === TYPE.select) {
        args.add(el.value);
        for (const option of Object.values(el.options)) walk(option.value);
      }
    }
  };
  walk(parse(message));
  return `${[...args].sort().join(',')}|${[...tags].sort().join(',')}`;
}

const en = flatten(catalog('en'));
const translated = locales.filter((l) => l !== 'en');

describe.each(translated)('messages/%s.json', (locale) => {
  const messages = flatten(catalog(locale));

  it('has exactly the English keys', () => {
    expect(Object.keys(messages).filter((k) => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter((k) => !(k in messages))).toEqual([]);
  });

  it('keeps every placeholder and tag of the English message', () => {
    // An empty message is a deliberate blank (Arabic puts all of "every N pages" before the number)
    const bad = Object.keys(en)
      .filter((k) => typeof messages[k] === 'string' && messages[k] !== '')
      .filter((k) => shape(messages[k] as string) !== shape(en[k] as string));
    expect(bad).toEqual([]);
  });
});

describe('French typography', () => {
  const fr = Object.entries(flatten(catalog('fr'))) as [string, string][];
  const offending = (test: (s: string) => boolean) =>
    fr.filter(([, v]) => test(v.replace(/https?:\/\/\S+/g, 'URL'))).map(([k]) => k);

  it('has no empty messages', () => {
    expect(fr.filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k)).toEqual([]);
  });

  it('uses ’, never an ASCII apostrophe', () => {
    expect(offending((s) => s.includes("'"))).toEqual([]);
  });

  it('puts a no-break space before : ; ! ? and none of them after a plain space', () => {
    expect(offending((s) => / [:;!?»]/.test(s) || /« /.test(s))).toEqual([]);
    expect(offending((s) => /[\p{L}\p{N})»][;!?]/u.test(s) || /[\p{L})»]:(\s|$)/u.test(s))).toEqual([]);
  });

  it('writes sizes in Mo / Ko / Go', () => {
    expect(offending((s) => /\b(MB|KB|GB)\b/.test(s))).toEqual([]);
  });
});

describe('Spanish typography', () => {
  const es = Object.entries(flatten(catalog('es'))) as [string, string][];
  const offending = (test: (s: string) => boolean) =>
    es.filter(([, v]) => test(v.replace(/https?:\/\/\S+/g, 'URL'))).map(([k]) => k);
  const count = (s: string, c: string) => s.split(c).length - 1;

  it('has no empty messages', () => {
    expect(es.filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k)).toEqual([]);
  });

  it('never uses an ASCII apostrophe', () => {
    expect(offending((s) => s.includes("'"))).toEqual([]);
  });

  it('opens every question with ¿ and every exclamation with ¡', () => {
    expect(offending((s) => count(s, '?') !== count(s, '¿') || count(s, '!') !== count(s, '¡'))).toEqual([]);
  });

  it('puts no space before ? ! : ;', () => {
    expect(offending((s) => / [?!:;]/.test(s))).toEqual([]);
  });

  it('writes decimals with a comma and sizes in MB / KB / GB', () => {
    expect(offending((s) => /\d\.\d/.test(s))).toEqual([]);
    expect(offending((s) => /\b(Mo|Ko|Go)\b/.test(s))).toEqual([]);
  });

  it('speaks to the reader as usted, never tú or vosotros', () => {
    expect(offending((s) => /\b(tu|tus|puedes|tienes|quieres|vosotros|vuestr[oa]s?)\b/i.test(s))).toEqual([]);
  });
});

describe('hreflang alternates', () => {
  it('list every locale, English at the root', () => {
    expect(languageAlternates('https://blendpdf.com', '/merge-pdf')).toEqual({
      en: 'https://blendpdf.com/merge-pdf',
      ar: 'https://blendpdf.com/ar/merge-pdf',
      fr: 'https://blendpdf.com/fr/merge-pdf',
      es: 'https://blendpdf.com/es/merge-pdf',
      'x-default': 'https://blendpdf.com/merge-pdf',
    });
    expect(languageAlternates('https://blendpdf.com', '').fr).toBe('https://blendpdf.com/fr');
    expect(languageAlternates('https://blendpdf.com', '').es).toBe('https://blendpdf.com/es');
  });
});
