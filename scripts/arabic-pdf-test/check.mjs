#!/usr/bin/env node
/**
 * Checks a PDF saved by any editor against one task of "Can your PDF editor
 * handle Arabic?" (https://blendpdf.com/arabic-pdf-editor-test).
 *
 *   node check.mjs <task> <edited.pdf> [--json]
 *   node check.mjs --original <test file.pdf> [--json]
 *
 * Needs Node 18+, pdftotext (poppler) and qpdf. Licence: AGPL-3.0.
 *
 * It reads the saved file twice. Once as pdftotext does, which uses the
 * ActualText some programs (Chrome among them) attach to each letter. And once
 * with ActualText switched off, which leaves only the fonts' own letter maps
 * (ToUnicode): what readers that ignore ActualText see, such as pdf.js, the
 * viewer in Firefox. A word that reads as Arabic the first way can read as
 * Persian the second way, and then searching for it fails in those readers.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- text rules

const BIDI_CONTROLS = /[\u{200b}-\u{200f}\u{202a}-\u{202e}\u{2066}-\u{2069}\u{feff}]/gu;
const TATWEEL = /\u{640}/gu;
/** Harakat and the other Arabic marks that sit on a letter. */
const MARKS = /[\u{610}-\u{61a}\u{64b}-\u{65f}\u{670}\u{6d6}-\u{6dc}\u{6df}-\u{6e8}\u{6ea}-\u{6ed}]/gu;
const ARABIC_LETTER = /[\u{620}-\u{64a}\u{66e}-\u{6d3}\u{6fa}-\u{6ff}]/u;
const LATIN_LETTER = /[A-Za-z\u{c0}-\u{24f}]/u;
/** Persian letters that look like Arabic ones: ی for ي, ک for ك, ھ and ہ for ه. */
const PERSIAN = { '\u{6cc}': '\u{64a}', '\u{6a9}': '\u{643}', '\u{6be}': '\u{647}', '\u{6c1}': '\u{647}' };
const PERSIAN_RE = /[\u{6cc}\u{6a9}\u{6be}\u{6c1}]/gu;

/** What a search compares: presentation forms folded (NFKC), no direction marks, no tatweel. */
export function fold(text, { marks = false } = {}) {
  let out = text.normalize('NFKC').replace(BIDI_CONTROLS, '').replace(TATWEEL, '');
  if (!marks) out = out.replace(MARKS, '');
  return out;
}

/** Letters and digits only: spacing and punctuation differ from reader to reader, the words don't. */
export function squash(text, options) {
  return fold(text, options).replace(/[\s\p{P}\p{S}]/gu, '');
}

/**
 * pdftotext reads every lam-alef ligature back to front (األطلس for الأطلس),
 * in files from Chrome, Word and LibreOffice alike. This is the text in that
 * order, so a reader's habit isn't counted against the editor.
 */
export const flipLamAlef = (text) => text.replace(/\u{644}([\u{627}\u{623}\u{625}\u{622}])/gu, '$1\u{644}');

export const toArabic = (text) => text.replace(PERSIAN_RE, (c) => PERSIAN[c]);
export const persianIn = (text) => [...new Set(fold(text).match(PERSIAN_RE) ?? [])];
const hex = (c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * Whether `text` is in `hay` (both squashed first): 'exact', 'lamAlef' (with
 * the ligatures read back to front) or false. Ligatures form inside a word,
 * so they are turned round before the spaces go.
 */
export function contains(hay, text) {
  const needle = squash(text);
  if (!needle || hay.includes(needle)) return 'exact';
  if (hay.includes(squash(flipLamAlef(fold(text))))) return 'lamAlef';
  return false;
}

export const words = (text) =>
  text
    .split(/\s+/)
    .map((w) => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''))
    .filter((w) => squash(w));

export function tokenKind(token) {
  if (ARABIC_LETTER.test(fold(token))) return 'R';
  if (LATIN_LETTER.test(token)) return 'L';
  return 'EN';
}

/**
 * Left-to-right order the words of an Arabic line should have on the page
 * (a small part of the Unicode bidi algorithm): Arabic words run right to
 * left; a number after Latin text joins it (rule W7); Latin text and the
 * numbers that join it read left to right as one group; any other number
 * stands alone.
 */
export function visualOrder(tokens) {
  const kinds = tokens.map(tokenKind);
  let lastStrong = 'R';
  for (let i = 0; i < kinds.length; i++) {
    if (kinds[i] === 'EN' && lastStrong === 'L') kinds[i] = 'L';
    if (kinds[i] !== 'EN') lastStrong = kinds[i];
  }
  const units = [];
  for (let i = 0; i < tokens.length; i++) {
    const last = units.at(-1);
    if (kinds[i] === 'L' && last?.kind === 'L') last.items.push(i);
    else units.push({ kind: kinds[i], items: [i] });
  }
  return units.reverse().flatMap((u) => u.items);
}

// ------------------------------------------------------------ reading a PDF

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`${command} isn't installed. macOS: brew install poppler qpdf. Debian or Ubuntu: sudo apt install poppler-utils qpdf. Windows: install poppler and qpdf and put both on your PATH.`);
      process.exit(2);
    }
    throw err;
  }
}

const decodeXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Words with their boxes, all pages (pdftotext -bbox). */
function readBoxes(pdf) {
  const xhtml = run('pdftotext', ['-bbox', '-enc', 'UTF-8', pdf, '-']);
  return xhtml.split('<page').slice(1).map((page) =>
    [...page.matchAll(/<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">([^<]*)<\/word>/g)].map((m) => ({
      xMin: +m[1],
      yMin: +m[2],
      xMax: +m[3],
      yMax: +m[4],
      text: decodeXml(m[5]),
    })),
  );
}

/** The same file with ActualText renamed, so only the fonts' letter maps are left. */
function withoutActualText(pdf, dir) {
  const qdf = join(dir, 'qdf.pdf');
  try {
    execFileSync('qpdf', ['--qdf', '--object-streams=disable', pdf, qdf], { stdio: 'ignore' });
  } catch (err) {
    if (err.code === 'ENOENT') run('qpdf', ['--version']);
    // qpdf exits with 3 on warnings and still writes the file
    if (!existsSync(qdf)) return null;
  }
  const bytes = readFileSync(qdf);
  const from = Buffer.from('/ActualText');
  const to = Buffer.from('/XctualText');
  let count = 0;
  for (let at = bytes.indexOf(from); at !== -1; at = bytes.indexOf(from, at + from.length)) {
    to.copy(bytes, at);
    count++;
  }
  const file = join(dir, 'no-actualtext.pdf');
  writeFileSync(file, bytes);
  return { file, count };
}

/**
 * How one PDF reads: text and word boxes with ActualText (a), and with the
 * fonts' letter maps only (b, null when qpdf can't open the file), plus the
 * number of pictures.
 */
export function readPdf(pdf) {
  if (!existsSync(pdf)) throw new Error(`No such file: ${pdf}`);
  const dir = mkdtempSync(join(tmpdir(), 'arabic-pdf-test-'));
  try {
    const a = { text: run('pdftotext', ['-enc', 'UTF-8', pdf, '-']), boxes: readBoxes(pdf) };
    const stripped = withoutActualText(pdf, dir);
    let b = null;
    if (stripped?.count) b = { text: run('pdftotext', ['-enc', 'UTF-8', stripped.file, '-']), boxes: readBoxes(stripped.file) };
    else if (stripped) b = a;
    let pictures = null;
    try {
      pictures = execFileSync('pdfimages', ['-list', pdf], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\n')
        .slice(2)
        .filter((l) => l.trim() && !/\bsmask\b/.test(l)).length;
    } catch {}
    return { a, b, actualText: stripped?.count ?? 0, pictures };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Groups word boxes into lines by their vertical middle, then joins boxes
 * that touch: a word drawn in pieces (harakat placed one by one, letters
 * spaced out) is one word on the page.
 */
export function boxLines(boxes) {
  const sorted = boxes.filter((b) => b.text.trim()).sort((p, q) => p.yMin + p.yMax - q.yMin - q.yMax);
  const lines = [];
  for (const box of sorted) {
    const mid = (box.yMin + box.yMax) / 2;
    const line = lines.at(-1);
    if (line && Math.abs(mid - line.mid) < 0.5 * Math.max(box.yMax - box.yMin, line.height)) line.boxes.push(box);
    else lines.push({ mid, height: box.yMax - box.yMin, boxes: [box] });
  }
  for (const line of lines) {
    const joined = [];
    for (const box of [...line.boxes].sort((p, q) => p.xMin - q.xMin)) {
      const last = joined.at(-1);
      if (last && box.xMin <= last.xMax + 0.06 * line.height) {
        last.text += box.text;
        last.xMax = Math.max(last.xMax, box.xMax);
      } else joined.push({ ...box });
    }
    line.boxes = joined.filter((b) => squash(b.text));
  }
  return lines.filter((l) => l.boxes.length);
}

const reversed = (text) => [...text].reverse().join('');

/** A line of boxes read right to left; poppler writes Arabic words in drawing order, so those are turned round. */
const lineText = (line) =>
  [...line.boxes]
    .sort((p, q) => q.xMax - p.xMax)
    .map((b) => (ARABIC_LETTER.test(fold(b.text)) ? reversed(b.text) : b.text))
    .join(' ');

/**
 * Where a word can be found in one reading: in the text, or else on one line
 * of word boxes (readers put lines with harakat together differently).
 * 'exact', 'lamAlef', 'persian' (only with Persian letters read as Arabic) or false.
 */
export function find(view, word) {
  const hays = [squash(view.text), ...view.boxes.flatMap(boxLines).map((l) => squash(lineText(l)))];
  for (const hay of hays) {
    const hit = contains(hay, word);
    if (hit) return hit;
  }
  return hays.some((hay) => contains(toArabic(hay), word)) ? 'persian' : false;
}

// ------------------------------------------------------------------ checks

const pass = (id, detail) => ({ id, status: 'pass', detail });
const fail = (id, detail) => ({ id, status: 'fail', detail });
const skip = (id, detail) => ({ id, status: 'n/a', detail });

const textLines = (text) => text.split('\n').filter((l) => squash(l));

/** Whether a word box shows this word (in either character order). */
function boxShows(box, token) {
  const length = squash(token).length;
  return [box.text, reversed(box.text)].some((t) => {
    const got = squash(t);
    return got.length <= length + 1 && contains(got, token);
  });
}

/** The expected words on one line of the page, placed right to left. */
function checkOrder(view, tokens) {
  if (tokens.length < 2) return skip('order', 'One word: no order to check.');
  let best = null;
  for (const line of view.boxes.flatMap(boxLines)) {
    const found = tokens.map((t) => line.boxes.filter((b) => boxShows(b, t)));
    const score = found.filter((f) => f.length).length;
    if (!best || score > best.score) best = { found, score };
  }
  if (!best || best.score < 2) return fail('order', 'The words are not together on one line of the page.');
  const missing = tokens.filter((_, i) => !best.found[i].length);
  // Walk the expected left-to-right order, taking for each word the leftmost box after the previous one
  let x = -Infinity;
  const used = new Set();
  for (const i of visualOrder(tokens).filter((j) => best.found[j].length)) {
    const box = best.found[i].filter((b) => !used.has(b) && b.xMin >= x - 0.5).sort((p, q) => p.xMin - q.xMin)[0];
    if (!box) return fail('order', `The words are out of order. Read right to left, the line should go: ${tokens.join(' ')}`);
    used.add(box);
    x = box.xMax;
  }
  if (missing.length) return fail('order', `Not on the line with the others: ${missing.join(', ')}.`);
  return pass('order', 'Placed right to left: the first word is the rightmost.');
}

/** The new words read as Arabic letters in the fonts' own letter maps, not Persian ones. */
function checkLetters(read, newWords) {
  if (!read.b) return skip('letters', 'qpdf could not open the file.');
  const results = newWords.map((w) => [w, find(read.b, w)]);
  const persian = results.filter(([, r]) => r === 'persian').map(([w]) => w);
  const missing = results.filter(([, r]) => !r).map(([w]) => w);
  if (persian.length) {
    const letters = persianIn(read.b.text).map((c) => `${c} ${hex(c)}`).join(', ');
    return fail('letters', `Persian letters in ${persian.join(', ')} (the file has ${letters}). Readers that ignore ActualText won't find these words.`);
  }
  if (missing.length) return fail('letters', `Without ActualText, these can't be read: ${missing.join(', ')}.`);
  return pass('letters', read.actualText ? 'Arabic letters, with or without ActualText.' : 'Arabic letters.');
}

/** Same harakat, in the same order, on the line that holds the new text. */
function checkMarks(read, text) {
  const want = (fold(text, { marks: true }).match(MARKS) ?? []).join('');
  if (!want) return null;
  const line = textLines(read.a.text).find((l) => contains(squash(l), text));
  if (!line) return fail('harakat', 'Copying gives this text in pieces, so its harakat do not come out in order.');
  const got = (fold(line, { marks: true }).match(MARKS) ?? []).join('');
  if (got.includes(want)) return pass('harakat', `All ${[...want].length} harakat kept, in order.`);
  return fail('harakat', `${[...want].length} harakat expected, ${[...got].length} found on the line.`);
}

/** The test definitions: next to this script (in the zip) or in the repo. */
export function loadCases() {
  return JSON.parse(readFileSync(join(HERE, 'cases.json'), 'utf8'));
}

export function findOriginal(file) {
  const path = [HERE, join(HERE, '../../public/arabic-pdf-editor-test')].map((p) => join(p, file)).find(existsSync);
  if (!path) throw new Error(`Can't find the test file ${file} next to check.mjs.`);
  return path;
}

/** What a task should leave on the page: the changed line, the new text, its new words, the words that must go. */
export function expectation(cases, task) {
  const doc = cases.files.find((f) => f.file === task.file);
  const before = squash(doc.lines.join(' '));
  if (task.do === 'add') {
    return { doc, line: null, text: task.text, newWords: words(task.text).filter((w) => !contains(before, w)), gone: [] };
  }
  const line = doc.lines.find((l) => l.includes(task.from));
  const text = line.replace(task.from, task.to);
  const after = squash([...doc.lines.filter((l) => l !== line), text].join(' '));
  return {
    doc,
    line,
    text,
    newWords: words(task.to).filter((w) => !contains(before, w)),
    gone: words(task.from).filter((w) => !contains(after, w)),
  };
}

/** Every check of one task on one saved file. `original` is how the test file itself reads. */
export function checkTask(cases, task, editedPdf, original = readPdf(findOriginal(task.file))) {
  const exp = expectation(cases, task);
  const out = readPdf(editedPdf);
  const checks = [];
  let lamAlef = false;

  // Search: the words that weren't on the page before can be found as text
  const found = exp.newWords.map((w) => [w, find(out.a, w)]);
  lamAlef ||= found.some(([, r]) => r === 'lamAlef');
  const persian = found.filter(([, r]) => r === 'persian').map(([w]) => w);
  const missing = found.filter(([, r]) => !r).map(([w]) => w);
  if (missing.length) {
    const picture = out.pictures !== null && original.pictures !== null && out.pictures > original.pictures;
    checks.push(fail('search', `Not found as text: ${missing.join(', ')}.${picture ? ' The page has a new picture, so the words were probably saved as an image.' : ''}`));
  } else if (persian.length) checks.push(fail('search', `Found only with Persian letters: ${persian.join(', ')}.`));
  else checks.push(pass('search', `Found as text: ${exp.newWords.join(', ')}.`));

  // Copy: the whole new text comes out in reading order, no word missing
  const copied = contains(squash(out.a.text), exp.text);
  lamAlef ||= copied === 'lamAlef';
  checks.push(copied ? pass('copy', 'Copying gives the new text whole, in reading order.') : fail('copy', 'Copying does not give the new text whole and in order.'));

  // Order: right to left on the page
  checks.push(checkOrder(out.a, words(exp.text)));

  // Letters: Arabic, not Persian, in the fonts' own letter maps
  checks.push(exp.newWords.length ? checkLetters(out, exp.newWords) : skip('letters', 'No new words.'));

  const marks = checkMarks(out, exp.text);
  if (marks) checks.push(marks);

  // Removed: the old words are out of the file, not just covered
  if (task.do === 'change') {
    const left = exp.gone.filter((w) => find(out.a, w) || (out.b && find(out.b, w)));
    checks.push(left.length ? fail('removed', `Still in the file, maybe covered rather than taken out: ${left.join(', ')}.`) : pass('removed', `Taken out of the file: ${exp.gone.join(', ')}.`));
  }

  // Kept: every other line reads as it did in the original, with the same reader
  const isTarget = (l) => task.do === 'change' && (contains(squash(l), task.from) || contains(toArabic(squash(l)), task.from));
  const otherLines = (view) => textLines(view.text).filter((l) => !isTarget(l));
  const others = otherLines(original.a);
  const changed = others.filter((l) => !find(out.a, l));
  if (!changed.length) checks.push(pass('kept', `The ${others.length} other lines read as they did in the original.`));
  else {
    // Did only the ActualText go? Then the letter maps still read as before.
    const lettersSame = original.actualText > 0 && out.b && otherLines(original.b).every((l) => find(out.b, l));
    const why = lettersSame ? ' Without ActualText they read as before, so the save dropped some of the original ActualText.' : '';
    const example = exp.doc.lines.find((t) => contains(squash(changed[0]), t)) ?? fold(changed[0]).trim();
    checks.push(fail('kept', `${changed.length} of the ${others.length} other lines read differently from the original, such as: ${example}.${why}`));
  }

  return { task: task.id, file: basename(editedPdf), checks, notes: lamAlef ? ['lamAlef'] : [] };
}

const LABELS = { exact: 'reads right', lamAlef: 'lam-alef back to front', persian: 'Persian letters', false: 'reads wrong' };

/** How a test file itself reads, line by line: what to expect from the reader before blaming an editor. */
export function checkOriginal(cases, pdf) {
  const doc = cases.files.find((f) => f.file === basename(pdf));
  if (!doc) throw new Error(`${basename(pdf)} is not one of the test files.`);
  const read = readPdf(pdf);
  const lines = doc.lines.map((line) => ({
    line,
    withActualText: LABELS[find(read.a, line)],
    lettersOnly: read.b && read.actualText ? LABELS[find(read.b, line)] : null,
  }));
  return { file: doc.file, actualText: read.actualText, persian: read.b ? persianIn(read.b.text) : [], lines };
}

// --------------------------------------------------------------------- CLI

const NAMES = { search: 'Search', copy: 'Copy', order: 'Order', letters: 'Letters', harakat: 'Harakat', removed: 'Removed', kept: 'Kept' };
const describe = (t) => (t.do === 'add' ? `add «${t.text}»` : `change «${t.from}» to «${t.to}»`);

function printTask(cases, task, result) {
  console.log(`Task ${task.id}: ${describe(task)} in ${task.file}`);
  console.log(`Checked: ${result.file}\n`);
  for (const c of result.checks) console.log(`  ${c.status.toUpperCase().padEnd(5)} ${NAMES[c.id].padEnd(8)} ${c.detail}`);
  if (result.notes.includes('lamAlef')) console.log('\nNote: pdftotext reads lam-alef ligatures back to front (األطلس for الأطلس), in the test files too, so the checks accept that order.');
  console.log(`\nThe line should read: ${expectation(cases, task).text}`);
  console.log('Also look at the page: the letters should be joined and the line should sit where it belongs.');
}

function printOriginal(result) {
  console.log(`${result.file}: how pdftotext reads the test file itself\n`);
  for (const l of result.lines) {
    const b = l.lettersOnly ? `without ActualText: ${l.lettersOnly.padEnd(24)}` : '';
    console.log(`  ${l.withActualText.padEnd(24)}${b}${l.line}`);
  }
  if (result.persian.length) console.log(`\nPersian letters in the fonts' letter maps: ${result.persian.map((c) => `${c} ${hex(c)}`).join(', ')}`);
}

function main(argv) {
  const json = argv.includes('--json');
  const args = argv.filter((a) => a !== '--json');
  const cases = loadCases();
  if (args[0] === '--original' && args[1]) {
    const result = checkOriginal(cases, args[1]);
    if (json) console.log(JSON.stringify(result, null, 2));
    else printOriginal(result);
    return 0;
  }
  const task = cases.tasks.find((t) => t.id === args[0]);
  if (!task || !args[1]) {
    console.error('Usage: node check.mjs <task> <edited.pdf> [--json]\n       node check.mjs --original <test file.pdf> [--json]\n\nTasks:');
    for (const t of cases.tasks) console.error(`  ${t.id.padEnd(4)} ${t.file}: ${describe(t)}`);
    return 2;
  }
  const result = checkTask(cases, task, args[1]);
  if (json) console.log(JSON.stringify(result, null, 2));
  else printTask(cases, task, result);
  return result.checks.some((c) => c.status === 'fail') ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exitCode = main(process.argv.slice(2));
