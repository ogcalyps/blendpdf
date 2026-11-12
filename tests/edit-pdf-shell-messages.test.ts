import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { createTranslator } from 'next-intl';
import { TOOL_FAQ_KEYS } from '../lib/tool-faqs';
import { sharedClientMessages } from '../lib/i18n/client-messages';

/**
 * The /edit-pdf copy: every key the editor and its page use exists in both
 * locales, the two locales have the same tree, the part of the namespace the
 * workspace ships to every tool page stays inside its byte budget, and the house rules hold:
 * no dashes in the English, none of the Arabic glossary's banned words.
 */
const ROOT = join(__dirname, '..');
type Messages = Record<string, unknown>;
const en = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8')) as Messages;
const ar = JSON.parse(readFileSync(join(ROOT, 'messages/ar.json'), 'utf8')) as Messages;
const LOCALES = { en, ar } as const;

/**
 * Per-locale budget for JSON.stringify(messages.editPdf), in UTF-8 bytes.
 * Phase C (Edit text, beta) adds about 1.7 KB of English and 2.9 KB of
 * Arabic; the Arabic measured 6,702 B before it and about 9.6 KB after.
 * Its review added the keyboard instructions, the font and Cover notes in
 * the FAQ: the Arabic is now about 10.3 KB. Keeping the font adds the two
 * "Closest match" notes: 10,662 B, still inside. The workspace offers server
 * options on /edit-pdf, so the privacy card and FAQ now say "unless you pick
 * an option marked Uses our server": 10,819 B, budget raised by 256 B.
 * That label left the workspace; the same lines now name an example
 * ("an option that needs our server, like converting to Word").
 * Since the translation split, only what sharedClientMessages keeps ships to
 * every tool page: the FAQ and the page guide stay on /edit-pdf, so the
 * budget now measures that shared part (5,695 B English, 8,911 B Arabic in
 * November 2026, with the guide).
 */
const EDIT_PDF_BUDGET = 11008;
/** The house glossary (tests/email-fallback-and-review.test.ts), applied to the new Arabic. */
const BANNED_ARABIC = ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—'];

function leaves(node: unknown, prefix = ''): Array<[string, string]> {
  if (typeof node === 'string') return [[prefix, node]];
  if (node === null || typeof node !== 'object') return [];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

function at(messages: Messages, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Messages)[key] : undefined), messages);
}

/** The new copy SHELL added, per locale: the editPdf namespace plus the keys outside it. */
function newCopy(messages: Messages): Array<[string, string]> {
  return [
    ...leaves(at(messages, 'editPdf'), 'editPdf'),
    ...leaves(at(messages, 'signaturePad'), 'signaturePad'),
    ...leaves(at(messages, 'nav.tools.editPdf'), 'nav.tools.editPdf'),
    ...leaves(at(messages, 'signPdf.needText'), 'signPdf.needText'),
    ...leaves(at(messages, 'wordToPdf.faq.editPdfAfterward'), 'wordToPdf.faq.editPdfAfterward'),
  ];
}

// ── Literal next-intl keys in the editor's sources ────────────────────────

const SCAN_DIRS = ['components/edit-pdf', 'components/workspace', 'app/[locale]/edit-pdf'];

function sources(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const path = join(abs, name);
    if (statSync(path).isDirectory()) return sources(relative(ROOT, path));
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

type KeyUse = { file: string; line: number; key: string | null; text: string };

/**
 * Every call of a translator, resolved to its full key. A translator is a
 * variable initialised with useTranslations(...) (or getTranslations); the
 * nearest declaration up the enclosing functions wins, so two components in
 * one file can each have their own `t`. key is null when the argument is not
 * a string literal (the editor must use literal keys, so this is a failure).
 */
function translatorCalls(file: string, source: string): KeyUse[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: KeyUse[] = [];

  const namespaceIn = (scope: ts.Node, name: string): string | null | undefined => {
    let found: string | null | undefined;
    const visit = (node: ts.Node) => {
      if (found !== undefined) return;
      if (node !== scope && (ts.isFunctionLike(node) || ts.isClassLike(node))) return; // inner scopes are not ours
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
        let init: ts.Expression = node.initializer;
        if (ts.isAwaitExpression(init)) init = init.expression;
        if (ts.isCallExpression(init) && ts.isIdentifier(init.expression) && /^(useTranslations|getTranslations)$/.test(init.expression.text)) {
          const arg = init.arguments[0];
          found = arg === undefined ? '' : ts.isStringLiteralLike(arg) ? arg.text : null;
        }
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(scope, visit);
    return found;
  };

  const resolve = (node: ts.Node, name: string): string | null | undefined => {
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
      if (ts.isFunctionLike(n) || ts.isSourceFile(n)) {
        const ns = namespaceIn(n, name);
        if (ns !== undefined) return ns;
      }
    }
    return undefined;
  };

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      let callee: ts.Expression = node.expression;
      // t.rich('key') / t.markup('key') / t.raw('key') / t.has('key')
      if (ts.isPropertyAccessExpression(callee) && /^(rich|markup|raw|has)$/.test(callee.name.text)) callee = callee.expression;
      if (ts.isIdentifier(callee)) {
        const ns = resolve(node, callee.text);
        if (ns !== undefined) {
          const arg = node.arguments[0];
          const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
          const text = node.getText(sf).slice(0, 80);
          if (ns === null || !arg || !ts.isStringLiteralLike(arg)) out.push({ file, line, key: null, text });
          else out.push({ file, line, key: ns ? `${ns}.${arg.text}` : arg.text, text });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

const scannedFiles = SCAN_DIRS.flatMap(sources);
const keyUses = scannedFiles.flatMap((file) => translatorCalls(relative(ROOT, file), readFileSync(file, 'utf8')));

describe('editPdf messages', () => {
  it('has the same key tree in English and Arabic, every value non-empty', () => {
    const enKeys = newCopy(en).map(([k]) => k).sort();
    const arKeys = newCopy(ar).map(([k]) => k).sort();
    expect(arKeys).toEqual(enKeys);
    expect(enKeys.filter((k) => k.startsWith('editPdf.')).length).toBeGreaterThanOrEqual(80);
    for (const [key, value] of [...newCopy(en), ...newCopy(ar)]) expect(value.trim(), key).not.toBe('');
  });

  it.each(Object.entries(LOCALES))('keeps the editPdf that every tool page ships within the %s budget', (_locale, messages) => {
    const bytes = Buffer.byteLength(JSON.stringify(at(sharedClientMessages(messages as never) as Messages, 'editPdf')), 'utf8');
    expect(bytes).toBeGreaterThan(1000);
    expect(bytes).toBeLessThanOrEqual(EDIT_PDF_BUDGET);
  });

  it('writes the English without em or en dashes', () => {
    const offenders = newCopy(en).filter(([, v]) => /[—–]/.test(v)).map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it('keeps the Arabic inside the house glossary', () => {
    const offenders = newCopy(ar).flatMap(([k, v]) => BANNED_ARABIC.filter((w) => v.includes(w)).map((w) => `${k}: ${w}`));
    expect(offenders).toEqual([]);
    for (const [k, v] of newCopy(ar)) expect((v.match(/!/g) || []).length, k).toBeLessThanOrEqual(1);
  });

  it('formats every message in both locales with the same arguments (valid ICU, plurals included)', () => {
    const args = { count: 3, current: 2, total: 12, number: 4, page: 2, font: 'Liberation Sans' };
    for (const [locale, messages] of Object.entries(LOCALES)) {
      const errors: string[] = [];
      const t = createTranslator({ locale, messages, onError: (e) => errors.push(`${locale}: ${e.message}`) });
      for (const [key, value] of newCopy(messages)) {
        for (const count of [1, 2, 3, 11, 100]) {
          // The page guide's limits carry <b> and <link> tags, which only t.rich/t.markup format
          if (value.includes('<')) t.markup(key as never, { ...args, count, b: (c: string) => c, link: (c: string) => c } as never);
          else t(key as never, { ...args, count } as never);
        }
      }
      expect(errors).toEqual([]);
    }
    // The placeholders match between the locales
    const placeholders = (v: string) => [...new Set([...v.matchAll(/\{(\w+)[,}]/g)].map((m) => m[1]))].sort();
    const arMap = new Map(newCopy(ar));
    for (const [key, value] of newCopy(en)) expect(placeholders(arMap.get(key) ?? ''), key).toEqual(placeholders(value));
    // So do the tags
    const tags = (v: string) => [...v.matchAll(/<(\w+)>/g)].map((m) => m[1]).sort();
    for (const [key, value] of newCopy(en)) expect(tags(arMap.get(key) ?? ''), key).toEqual(tags(value));
  });

  it('has every FAQ the page lists, question and answer, in both locales', () => {
    const slugs = TOOL_FAQ_KEYS.editPdf;
    expect(slugs).toEqual(['arabicText', 'existingText', 'private', 'forms', 'free', 'phone', 'password']);
    for (const messages of [en, ar]) {
      for (const slug of slugs) {
        expect(typeof at(messages, `editPdf.faq.${slug}.question`), slug).toBe('string');
        expect(typeof at(messages, `editPdf.faq.${slug}.answer`), slug).toBe('string');
      }
    }
  });
});

describe('Edit text (beta) copy', () => {
  const REPLACE_KEYS = [
    'tools.replace',
    'tools.replaceTitle',
    'tools.beta',
    'replace.hint',
    'replace.loading',
    'replace.none',
    'replace.invisible',
    'replace.slanted',
    'replace.turned',
    'replace.pageEffects',
    'replace.joined',
    'replace.unreadable',
    'replace.useCover',
    'replace.field',
    'replace.placeholder',
    'replace.note',
    'replace.unsure',
    'replace.keepOriginal',
    'replace.changedLine',
    'replace.keys',
    'replace.removed',
    'replace.saveRefused',
    'replace.saveFailed',
    'replace.saveUnavailable',
    'disabled.replace',
    'disabled.replaceBrowser',
    'disabled.rotateReplaced',
  ];

  it.each(Object.entries(LOCALES))('has every Edit text string in %s', (_locale, messages) => {
    const missing = REPLACE_KEYS.filter((key) => typeof at(messages, `editPdf.${key}`) !== 'string');
    expect(missing).toEqual([]);
  });

  it('says beta on the tool, the hint and the FAQ, in both locales', () => {
    expect(at(en, 'editPdf.tools.replaceTitle')).toMatch(/\bbeta\b/i);
    expect(at(en, 'editPdf.replace.hint')).toMatch(/\bbeta\b/i);
    expect(at(ar, 'editPdf.tools.replaceTitle')).toContain('تجريبي');
    expect(at(ar, 'editPdf.replace.hint')).toContain('تجريبي');
  });

  it('answers the existing-text FAQ honestly: yes, in beta, no "Not yet" left', () => {
    const answer = at(en, 'editPdf.faq.existingText.answer') as string;
    expect(answer).toMatch(/\bbeta\b/i);
    expect(answer).not.toMatch(/not yet/i);
    expect(at(ar, 'editPdf.faq.existingText.answer')).toContain('تجريبي');
    expect(at(ar, 'editPdf.faq.existingText.answer')).not.toContain('ليس بعد');
    // The page description owns up to the beta too.
    expect(at(en, 'editPdf.description')).toMatch(/\(beta\)/);
    expect(at(ar, 'editPdf.description')).toContain('تجريبي');
  });

  it('never promises more than the export verifies', () => {
    const offenders = newCopy(en).filter(([, v]) => /permanent|completely|100\s?%/i.test(v)).map(([k]) => k);
    expect(offenders).toEqual([]);
  });

  it('no longer says anywhere that Edit PDF leaves the existing text alone', () => {
    const files = [
      'public/llms.txt',
      'lib/comparisons/smallpdf.ts',
      'lib/comparisons/ilovepdf.ts',
      'lib/comparisons/chrome.ts',
      'app/[locale]/word-to-pdf/faq/page.tsx',
    ];
    const stale = /does not change the text|doesn't change the text|not have apps, an editor for existing text|None of them change the wording/;
    const offenders = files.filter((file) => stale.test(readFileSync(join(ROOT, file), 'utf8').replace(/\s+/g, ' ')));
    expect(offenders).toEqual([]);
  });
});

describe('next-intl keys used by the editor and its page', () => {
  it('scans the page, the shell and the workspace (the check is not vacuous)', () => {
    const files = scannedFiles.map((f) => relative(ROOT, f));
    expect(files).toContain('app/[locale]/edit-pdf/page.tsx');
    expect(files).toContain('components/workspace/ToolWorkspace.tsx');
    expect(files).toContain('components/edit-pdf/EditorWorkspace.tsx');
    const keys = new Set(keyUses.map((u) => u.key));
    // From page.tsx and from the shell (ToolWorkspace), through each one's translators
    for (const key of ['editPdf.title', 'editPdf.opening', 'editPdf.steps.edit.title', 'errors.fileTooLarge', 'nav.tools.editPdf.title', 'workspace.drop.one']) {
      expect(keys, key).toContain(key);
    }
  });

  it('uses only literal keys', () => {
    expect(keyUses.filter((u) => u.key === null).map((u) => `${u.file}:${u.line} ${u.text}`)).toEqual([]);
  });

  it.each(Object.entries(LOCALES))('finds every key in %s', (_locale, messages) => {
    const missing = keyUses
      .filter((u) => u.key !== null && typeof at(messages, u.key) !== 'string')
      .map((u) => `${u.file}:${u.line} ${u.key}`);
    expect(missing).toEqual([]);
  });

  it('resolves each translator by its own scope (the resolver is not vacuous)', () => {
    const src = `
      const t0 = useTranslations('editPdf');
      function A() { const t = useTranslations('editPdf'); return t('opening'); }
      function B() { const t = useTranslations(); const tc = useTranslations('common'); return t('errors.fileTooLarge') + tc('dismiss') + t.rich('x.y') + t0('title'); }
      function C(k: string) { const t = useTranslations('editPdf'); return t(k); }
    `;
    expect(translatorCalls('x.tsx', src).map((u) => u.key)).toEqual([
      'editPdf.opening',
      'errors.fileTooLarge',
      'common.dismiss',
      'x.y',
      'editPdf.title',
      null,
    ]);
  });
});
