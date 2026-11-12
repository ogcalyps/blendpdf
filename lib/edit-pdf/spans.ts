/**
 * ActualText spans on a page PDFium rewrote, made readable again by poppler.
 * Run by the export on every rewritten page, right after it loads PDFium's
 * output. Reached only through ./export (itself loaded with import()).
 *
 * Why: Chrome marks each Arabic glyph whose letter map is wrong with
 * `/Span <</ActualText …>> BDC … EMC`. PDFium keeps the span but writes
 * every text object as its own `q … 1 0 0 1 x y cm BT … ET Q`, so the span's
 * EMC comes after the Q. poppler (pdftotext, Evince, Okular, most Linux and
 * server-side readers) emits a span's ActualText at its EMC, placed with the
 * CTM in force THEN, which the Q has already reset: those letters land far
 * from their line, and every untouched line reads in fragments ("دة" for
 * "شهادة عمل"). Preview and pdf.js are not affected.
 *
 * The fix: inside an ActualText span, each such text object takes its cm
 * translation into its text matrix (`BT a b c d e+x f+y Tm …`), so its glyphs
 * are drawn under the CTM the EMC sees. The page draws exactly the same, and
 * a letter drawn with its harakat in several objects (each with its own clip)
 * needs nothing more. A text object with any other cm, or written in a way
 * PDFium does not write, is left as it was. Form XObjects PDFium rewrote are
 * not touched: no producer we test puts text there.
 */
import { PDFArray, PDFDict, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';
import type { PDFPage } from 'pdf-lib';
import { contentText } from './structure';

interface Token {
  kind: 'number' | 'name' | 'string' | 'op' | 'open' | 'close';
  start: number;
  end: number;
  text: string;
}

interface Op {
  name: string;
  /** Each operand's tokens (several for a dictionary or an array). */
  operands: Token[][];
  /** From the first operand to the end of the operator. */
  start: number;
  end: number;
}

/** One text object as PDFium writes it: q, graphics state and clip, cm, BT, text operators, ET, Q. */
interface Block {
  cm: Op;
  bt: Op;
  text: Op[];
  next: number;
}

const WHITE = '\0\t\n\f\r ';
const DELIMITERS = '()<>[]{}/%';
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/** General graphics state and colour: allowed both before BT and inside a text object. */
const STATE_OPS = new Set(['w', 'J', 'j', 'M', 'd', 'ri', 'i', 'gs', 'CS', 'cs', 'SC', 'SCN', 'sc', 'scn', 'G', 'g', 'RG', 'rg', 'K', 'k']);
/** A clip PDFium writes before a text object's cm (a path that is never painted). */
const CLIP_OPS = new Set(['m', 'l', 'c', 'v', 'y', 'h', 're', 'W', 'W*', 'n']);
const POSITION_OPS = new Set(['Td', 'TD', 'Tm', 'T*', "'", '"']);
const SHOW_OPS = new Set(['Tj', 'TJ', "'", '"']);
const TEXT_OPS = new Set([...STATE_OPS, ...POSITION_OPS, ...SHOW_OPS, 'Tc', 'Tw', 'Tz', 'TL', 'Tf', 'Tr', 'Ts']);

/** The stream's tokens, or null when it can't be read safely (an inline image's raw data, a broken string). */
function tokenize(s: string): Token[] | null {
  const tokens: Token[] = [];
  const word = (i: number) => {
    while (i < s.length && !WHITE.includes(s[i]) && !DELIMITERS.includes(s[i])) i++;
    return i;
  };
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    const start = i;
    if (WHITE.includes(c)) {
      i++;
      continue;
    }
    if (c === '%') {
      while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
      continue;
    }
    let kind: Token['kind'];
    if (c === '(') {
      let depth = 0;
      for (; i < s.length; i++) {
        if (s[i] === '\\') i++;
        else if (s[i] === '(') depth++;
        else if (s[i] === ')' && --depth === 0) break;
      }
      if (i >= s.length) return null;
      i++;
      kind = 'string';
    } else if (c === '<' && s[i + 1] === '<') {
      i += 2;
      kind = 'open';
    } else if (c === '>' && s[i + 1] === '>') {
      i += 2;
      kind = 'close';
    } else if (c === '<') {
      i = s.indexOf('>', i) + 1;
      if (i === 0) return null;
      kind = 'string';
    } else if (c === '[' || c === ']') {
      i++;
      kind = c === '[' ? 'open' : 'close';
    } else if (c === '/') {
      i = word(i + 1);
      kind = 'name';
    } else {
      i = word(i);
      if (i === start) return null; // a stray ) > { }
      const text = s.slice(start, i);
      if (text === 'BI' || text === 'ID') return null;
      kind = NUMBER.test(text) ? 'number' : 'op';
    }
    tokens.push({ kind, start, end: i, text: s.slice(start, i) });
  }
  return tokens;
}

function operations(tokens: Token[]): Op[] {
  const ops: Op[] = [];
  let operands: Token[][] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === 'op') {
      ops.push({ name: token.text, operands, start: operands[0]?.[0].start ?? token.start, end: token.end });
      operands = [];
    } else if (token.kind === 'open') {
      const group = [token];
      for (let depth = 1; depth > 0 && i + 1 < tokens.length; ) {
        const next = tokens[++i];
        group.push(next);
        if (next.kind === 'open') depth++;
        else if (next.kind === 'close') depth--;
      }
      operands.push(group);
    } else {
      operands.push([token]);
    }
  }
  return ops;
}

const numbers = (op: Op): number[] | null => (op.operands.every((o) => o.length === 1 && o[0].kind === 'number') ? op.operands.map((o) => Number(o[0].text)) : null);

/** A PDF number: no exponent, at most 5 decimals (as PDFium writes them). */
const num = (value: number): string => {
  const rounded = Math.round(value * 1e5) / 1e5;
  return rounded === 0 ? '0' : String(rounded);
};

/** The text object starting at `ops[at]` (a q) when its cm is a translation that only moves it. */
function readBlock(ops: Op[], at: number): Block | null {
  let k = at + 1;
  while (ops[k] && (STATE_OPS.has(ops[k].name) || CLIP_OPS.has(ops[k].name))) k++;
  const cm = ops[k++];
  const bt = ops[k++];
  if (cm?.name !== 'cm' || bt?.name !== 'BT') return null;
  const m = numbers(cm);
  if (!m || m.length !== 6 || m[0] !== 1 || m[1] !== 0 || m[2] !== 0 || m[3] !== 1) return null;
  const text: Op[] = [];
  while (ops[k] && TEXT_OPS.has(ops[k].name)) text.push(ops[k++]);
  if (ops[k]?.name !== 'ET' || ops[k + 1]?.name !== 'Q') return null;
  if (text.some((op) => op.name === 'Tm' && numbers(op)?.length !== 6)) return null;
  return { cm, bt, text, next: k + 2 };
}

/**
 * Rewrite one content stream (one char per byte). `named` says whether a
 * property list named in the page's /Properties carries /ActualText. Returns
 * null when no text object needed it.
 */
export function fixSpans(s: string, named: (name: string) => boolean = () => false): { text: string; objects: number } | null {
  const tokens = tokenize(s);
  if (!tokens) return null;
  const ops = operations(tokens);
  const carriesActualText = (op: Op) => {
    const props = op.operands[1];
    if (op.operands.length !== 2 || !props) return false;
    if (props.length === 1) return props[0].kind === 'name' && named(props[0].text.slice(1));
    return props.some((t) => t.kind === 'name' && t.text === '/ActualText');
  };

  const edits: Array<{ start: number; end: number; text: string }> = [];
  const marks: boolean[] = [];
  let objects = 0;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.name === 'BDC' || op.name === 'BMC') marks.push(op.name === 'BDC' && carriesActualText(op));
    else if (op.name === 'EMC') marks.pop();
    if (op.name !== 'q' || !marks.includes(true)) continue;
    const block = readBlock(ops, i);
    if (!block) continue;
    const [, , , , x, y] = numbers(block.cm)!;
    const moved = (tm: Op) => {
      const [a, b, c, d, e, f] = tm.operands.map((o) => o[0].text);
      return `${a} ${b} ${c} ${d} ${num(Number(e) + x)} ${num(Number(f) + y)} Tm`;
    };
    edits.push({ start: block.cm.start, end: block.bt.start, text: '' });
    // At BT the text matrix is the identity: a first run placed by Td alone starts from the translation.
    const first = block.text.find((t) => POSITION_OPS.has(t.name) || SHOW_OPS.has(t.name));
    if (first?.name !== 'Tm') edits.push({ start: block.bt.end, end: block.bt.end, text: ` 1 0 0 1 ${num(x)} ${num(y)} Tm` });
    for (const tm of block.text) if (tm.name === 'Tm') edits.push({ start: tm.start, end: tm.end, text: moved(tm) });
    objects++;
    i = block.next - 1;
  }
  if (edits.length === 0) return null;
  let out = '';
  let at = 0;
  for (const edit of edits) {
    out += s.slice(at, edit.start) + edit.text;
    at = edit.end;
  }
  return { text: out + s.slice(at), objects };
}

/** Fix the spans of every content stream of the page. Returns how many text objects changed. */
export function fixActualText(page: PDFPage): number {
  const { context } = page.doc;
  const contents = page.node.get(PDFName.of('Contents'));
  const list = contents instanceof PDFRef ? context.lookup(contents) : contents;
  const refs = list instanceof PDFArray ? list.asArray() : [contents];
  const properties = page.node.Resources()?.lookupMaybe(PDFName.of('Properties'), PDFDict);
  const named = (name: string) => !!properties?.lookupMaybe(PDFName.of(name), PDFDict)?.has(PDFName.of('ActualText'));
  let objects = 0;
  for (const ref of refs) {
    if (!(ref instanceof PDFRef)) continue;
    const stream = context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const text = contentText(stream);
    const result = text === null ? null : fixSpans(text, named);
    if (!result) continue;
    context.assign(ref, context.flateStream(Uint8Array.from(result.text, (c) => c.charCodeAt(0))));
    objects += result.objects;
  }
  return objects;
}
