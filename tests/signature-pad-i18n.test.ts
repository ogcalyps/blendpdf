import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

/**
 * SignaturePad is shared by /sign-pdf, the eight form templates and the
 * /edit-pdf signature dialog. It used to show English on /ar, its four typed
 * styles all rendered in the body font (the font variables were defined only
 * on the form pages), and it drew with mouse and touch events. This keeps
 * those fixes in place and the props API the templates rely on unchanged.
 */
const ROOT = join(__dirname, '..');
const FILE = 'components/forms/SignaturePad.tsx';
const src = readFileSync(join(ROOT, FILE), 'utf8');
const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const en = JSON.parse(readFileSync(join(ROOT, 'messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(ROOT, 'messages/ar.json'), 'utf8'));

/** What the component used to hard-code. */
const OLD_LITERALS = [
  'Sign Here',
  'Clear',
  'Draw your signature here',
  'Click to upload signature image',
  'PNG, JPG, SVG supported',
  'Uploaded signature',
  'Replace image',
  'Type your full name',
  'Signature preview will appear here',
  'Use This Signature',
  'Elegant',
  'Classic',
  'Modern',
  'Script',
];
const USER_FACING_ATTRS = new Set(['placeholder', 'alt', 'title', 'aria-label', 'label']);

/** User-visible English in the JSX: text between tags, and string literals in user-facing attributes. */
function hardCodedCopy(source: ts.SourceFile): string[] {
  const out: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && /[A-Za-z]{2,}/.test(node.getText(source))) out.push(node.getText(source).trim());
    if (ts.isJsxAttribute(node) && USER_FACING_ATTRS.has(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) {
      out.push(`${node.name.getText(source)}="${node.initializer.text}"`);
    }
    // { label: 'Draw' } style tables feeding the JSX
    if (ts.isPropertyAssignment(node) && /^(label|title|placeholder)$/.test(node.name.getText(source)) && ts.isStringLiteral(node.initializer)) {
      out.push(`${node.name.getText(source)}: '${node.initializer.text}'`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

const at = (messages: Record<string, unknown>, path: string) =>
  path.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), messages);

describe('SignaturePad', () => {
  it('takes its strings from next-intl (signaturePad namespace), with no English left in the markup', () => {
    expect(src).toMatch(/const t = useTranslations\('signaturePad'\);/);
    expect(hardCodedCopy(sf)).toEqual([]);
    const quoted = OLD_LITERALS.filter((s) => src.includes(`'${s}'`) || src.includes(`"${s}"`) || src.includes(`>${s}<`) || new RegExp(`>\\s*${s}\\s*<`).test(src));
    expect(quoted).toEqual([]);
  });

  it('uses only keys that exist in both locales', () => {
    const keys = [...src.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThanOrEqual(15);
    for (const messages of [en, ar]) {
      expect(keys.filter((k) => typeof at(messages, `signaturePad.${k}`) !== 'string')).toEqual([]);
    }
  });

  it('defines the typed-style fonts on its own root, from variables lib/signature-fonts really sets', () => {
    expect(src).toMatch(/import\('@\/lib\/signature-fonts'\)/);
    expect(src).toMatch(/signatureFontsClassName/);
    expect(src).toMatch(/<div ref=\{rootRef\} className=\{`[^`]*\$\{fontsClassName\}`\}>/);
    const defined = new Set([...readFileSync(join(ROOT, 'lib/signature-fonts.ts'), 'utf8').matchAll(/variable: '(--font-[a-z-]+)'/g)].map((m) => m[1]));
    const used = [...src.matchAll(/cssVar: '(--font-[a-z-]+)'/g)].map((m) => m[1]);
    expect(used).toHaveLength(4);
    expect(used.filter((v) => !defined.has(v))).toEqual([]);
    // The canvas waits for the webfont: canvas text alone never triggers a font download
    expect(src).toMatch(/await document\.fonts\.load\(/);
  });

  it('draws with pointer events and pointer capture, not mouse or touch events', () => {
    expect(src).not.toMatch(/\bon(Mouse|Touch)(Down|Move|Up|Start|End|Leave)\b/);
    expect(src).toMatch(/onPointerDown=\{onPointerDown\}/);
    expect(src).toMatch(/onPointerMove=\{onPointerMove\}/);
    expect(src).toMatch(/onPointerUp=\{endStroke\}/);
    expect(src).toMatch(/onPointerCancel=\{endStroke\}/);
    expect(src).toMatch(/setPointerCapture\(/);
    expect(src).toMatch(/className="[^"]*touch-none[^"]*"\s+style=\{\{ width: '100%', height: '100%' \}\}/);
  });

  it('uploads through the tracked dropzone as a signature_image, never a raw file input', () => {
    expect(src).toMatch(/useTrackedDropzone\(\{\s*uploadRole: 'signature_image'/);
    expect(src).not.toMatch(/type="file"/);
    expect(src).not.toMatch(/trackFileUpload/);
  });

  it('keeps the props API the form templates and sign-pdf use', () => {
    let members: string[] = [];
    sf.forEachChild((node) => {
      if (ts.isInterfaceDeclaration(node) && node.name.text === 'SignaturePadProps') {
        members = node.members.map((m) => `${m.name?.getText(sf)}${m.questionToken ? '?' : ''}`);
      }
    });
    expect(members.sort()).toEqual(['height?', 'initialValue?', 'onClear?', 'onSave', 'title?', 'width?']);
    expect(src).toMatch(/export function SignaturePad\(\{ onSave, onClear, title, width = '100%', height = 160, initialValue \}: SignaturePadProps\)/);
  });

  it('catches hard-coded copy (the scan is not vacuous)', () => {
    const probe = ts.createSourceFile(
      'p.tsx',
      `const tabs = [{ id: 'draw', label: 'Draw' }];
       const x = <div><span>Clear</span><input placeholder="Type your full name" /><span>{t('ok')}</span>{' '}</div>;`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    expect(hardCodedCopy(probe)).toEqual([`label: 'Draw'`, 'Clear', 'placeholder="Type your full name"']);
  });
});
