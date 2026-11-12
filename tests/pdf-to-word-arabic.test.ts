import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { ARABIC_LAYOUT_PY } from '../lib/pdf-to-word-arabic';

/**
 * The Arabic reading-order fix for PDF to Word (lib/pdf-to-word-arabic.ts) is
 * Python. These run it with the python3 on the machine: the reading-order part
 * needs only the standard library; the .docx part needs lxml (pdf2docx brings
 * it on the server) and is skipped where it is missing. Set PDF2DOCX_PYTHON to
 * use another interpreter.
 *
 * The chars below copy what PyMuPDF returned for real files on 2026-11-12
 * (Chrome, LibreOffice and Word for Mac exports of an Arabic work certificate).
 */

const PYTHON = process.env.PDF2DOCX_PYTHON || 'python3';
const hasPython = spawnSync(PYTHON, ['-c', 'print(1)']).status === 0;
const hasLxml = hasPython && spawnSync(PYTHON, ['-c', 'import lxml']).status === 0;

function runPython(body: string): any {
  const out = spawnSync(PYTHON, ['-c', `${ARABIC_LAYOUT_PY}\nimport json\n${body}`], { encoding: 'utf-8' });
  if (out.status !== 0) throw new Error(out.stderr);
  return JSON.parse(out.stdout.trim().split('\n').pop()!);
}

// c(text, x0, x1): a char as PyMuPDF's rawdict gives it, all on one baseline
const CHARS = `
def c(ch, x0, x1, y=(100, 115)):
    return {'c': ch, 'bbox': (x0, y[0], x1, y[1]), 'origin': (x0, y[1] - 3)}
def text(chars):
    return ''.join(ch['c'] for ch in chars)
`;

describe.skipIf(!hasPython)('Arabic reading order', () => {
  it('reads a right-to-left line from the right, keeping numbers left to right', () => {
    // "منذ 15 مارس" drawn right to left; listed left to right, as a reader may give them
    const result = runPython(`${CHARS}
line = [c('س', 32, 40), c('ر', 40, 44), c('ا', 44, 48), c('م', 48, 56), c(' ', 56, 60),
        c('1', 60, 68), c('5', 68, 76), c(' ', 76, 80), c('ذ', 80, 86), c('ن', 86, 92), c('م', 92, 100)]
print(json.dumps(text(arabic_line_order(line))))
`);
    expect(result).toBe('منذ 15 مارس');
  });

  it('keeps an email address, a phone number and a date in one piece', () => {
    const result = runPython(`${CHARS}
words = ['للتواصل', 'hr@a-b.ma', 'أو', '2021/03/15']
chars, x = [], 400
for word in words:
    glyphs = list(word)
    width = 5 * len(glyphs)
    if word[0].isascii():
        for i, g in enumerate(glyphs):
            chars.append(c(g, x - width + 5 * i, x - width + 5 * (i + 1)))
    else:
        for i, g in enumerate(glyphs):
            chars.append(c(g, x - 5 * (i + 1), x - 5 * i))
    x -= width
    chars.append(c(' ', x - 4, x))
    x -= 4
chars.sort(key=lambda ch: ch['bbox'][0])
print(json.dumps([arabic_rtl(' '.join(words)), text(arabic_line_order(chars)).strip()]))
`);
    expect(result).toEqual([true, 'للتواصل hr@a-b.ma أو 2021/03/15']);
  });

  it('puts the second letter of a لا-type ligature after the first (الإدريسي, not اإلدريسي)', () => {
    // The ligature glyph لإ carries its width on ل; إ comes first, without width, at its right edge
    const result = runPython(`${CHARS}
line = [c('ا', 249.3, 252.2), c('إ', 249.3, 249.3), c('ل', 241.7, 249.3), c('د', 237.0, 241.7),
        c('ر', 230.2, 237.0), c('ي', 226.7, 230.2), c('س', 219.3, 226.7), c('ي', 211.1, 219.3)]
print(json.dumps(text(arabic_line_order(line))))
`);
    expect(result).toBe('الإدريسي');
  });

  it('rebuilds الله from one glyph listed as ه ل ل and then ا', () => {
    const result = runPython(`${CHARS}
line = [c('ع', 520.2, 526.0), c('ب', 516.8, 520.2), c('د', 512.1, 516.8), c(' ', 508.2, 512.1),
        c('ه', 508.2, 508.2), c('ل', 508.2, 508.2), c('ل', 508.2, 508.2), c('ا', 497.1, 508.2)]
print(json.dumps(text(arabic_line_order(line))))
`);
    expect(result).toBe('عبد الله');
  });

  it('keeps a vowel mark on its letter (أُعطيت)', () => {
    // Chrome gives the damma the cluster's width and lists it before a zero-width أ
    const result = runPython(`${CHARS}
line = [c('د', 513.0, 517.0), c(' ', 509.2, 513.0), c('\\u064f', 506.3, 509.2), c('أ', 505.7, 505.7),
        c('ع', 498.9, 506.3), c('ط', 490.8, 498.9), c('ي', 487.3, 490.8), c('ت', 477.4, 487.3)]
print(json.dumps(text(arabic_line_order(line))))
`);
    expect(result).toBe('د أُعطيت');
  });

  it('keeps the spaces of text whose every space is a span of its own (Chrome Type 3)', () => {
    const result = runPython(`${CHARS}
style = {'font': 'Unnamed-T3', 'size': 30.0, 'flags': 0, 'color': 0, 'alpha': 255}
def span(word, x1):
    chars = [c(g, x1 - 6 * (i + 1), x1 - 6 * i) for i, g in enumerate(word)]
    return dict(style, chars=chars, bbox=(chars[-1]['bbox'][0], 100, x1, 115))
spans = [span('جاهزة', 400), span(' ', 370), span('وثائقك', 364)]
spans = sorted(spans, key=lambda s: s['bbox'][0])  # left to right, as the reader lists them
line = {'wmode': 0, 'dir': (1.0, 0.0), 'spans': spans}
fixed = _reorder_line(line)
print(json.dumps([fixed, [text(s['chars']) for s in line['spans']]]))
`);
    expect(result).toEqual([true, ['جاهزة وثائقك ']]);
  });

  it('leaves a left-to-right line alone', () => {
    const result = runPython(`${CHARS}
chars = [c(g, 10 + 6 * i, 16 + 6 * i) for i, g in enumerate('Issued on 12 May')]
line = {'wmode': 0, 'dir': (1.0, 0.0), 'spans': [{'font': 'Arial', 'size': 12, 'chars': chars, 'bbox': (10, 100, 106, 115)}]}
print(json.dumps([_reorder_line(line), text(line['spans'][0]['chars'])]))
`);
    expect(result).toEqual([false, 'Issued on 12 May']);
  });
});

describe.skipIf(!hasLxml)('Arabic paragraphs in the .docx', () => {
  const DOCX = `
import os, tempfile, zipfile
W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
def make(body):
    path = os.path.join(tempfile.mkdtemp(), 'out.docx')
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('[Content_Types].xml', '<Types/>')
        z.writestr('word/document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ' + W + '><w:body>' + body + '</w:body></w:document>')
    return path
def xml(path):
    return zipfile.ZipFile(path).read('word/document.xml').decode()
`;

  it('marks an Arabic paragraph right-to-left with mirrored indents and Arabic sizes', () => {
    const result = runPython(`${DOCX}
path = make('<w:p><w:pPr><w:widowControl/><w:spacing w:line="283"/><w:ind w:left="3422" w:right="144" w:hanging="2650"/><w:jc w:val="left"/></w:pPr>'
            '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b w:val="0"/><w:sz w:val="28"/></w:rPr><w:t>منذ 15 مارس 2021 </w:t></w:r>'
            '<w:r><w:rPr><w:sz w:val="28"/></w:rPr><w:t xml:space="preserve"> وحتى تاريخه</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>Issued in Casablanca</w:t></w:r></w:p>')
n = arabic_docx(path)
print(json.dumps([n, xml(path)]))
`);
    const [changed, xml] = result as [number, string];
    expect(changed).toBe(1);
    const [arabic, english] = xml.split('</w:p>');
    expect(arabic).toMatch(/<w:widowControl\/><w:bidi\/><w:spacing/); // schema order: before spacing
    expect(arabic).toContain('<w:ind w:left="144" w:right="772"/>');
    expect(arabic).toContain('<w:jc w:val="left"/>');
    expect(arabic).toMatch(/<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"\/><w:b w:val="0"\/><w:bCs w:val="0"\/><w:sz w:val="28"\/><w:szCs w:val="28"\/><w:rtl\/>/);
    expect(arabic).toContain('<w:t xml:space="preserve">وحتى تاريخه</w:t>'); // one space at the join
    expect(english).not.toContain('bidi');
  });

  it('turns presentation forms and Persian look-alikes back into Arabic letters', () => {
    const result = runPython(`${DOCX}
path = make('<w:p><w:r><w:t>\\ufeb7\\ufbad\\ufe8e\\u062f\\u0629 \\u0627\\ufefb\\u0633\\u0645 \\u0627\\u0644\\u0633\\u06cc\\u062f</w:t></w:r></w:p>')
arabic_docx(path)
x = xml(path)
print(json.dumps(x[x.index('<w:t>') + 5:x.index('</w:t>')]))
`);
    expect(result).toBe('شهادة الاسم السيد');
  });

  it('keeps Persian letters in a Persian document', () => {
    const result = runPython(`${DOCX}
path = make('<w:p><w:r><w:t>\\u067e\\u0631\\u0648\\u0646\\u062f\\u0647 \\u06cc\\u06a9</w:t></w:r></w:p>')
arabic_docx(path)
x = xml(path)
print(json.dumps(x[x.index('<w:t>') + 5:x.index('</w:t>')]))
`);
    expect(result).toBe('پرونده یک');
  });

  it('keeps tab-placed pieces left to right, each Arabic piece embedded right-to-left', () => {
    const result = runPython(`${DOCX}
path = make('<w:p><w:pPr><w:ind w:left="1704" w:right="720"/><w:jc w:val="left"/></w:pPr>'
            '<w:r><w:t>شهادة عمل</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>28 أداة لملفات PDF</w:t></w:r></w:p>')
arabic_docx(path)
print(json.dumps(xml(path)))
`);
    expect(result).not.toContain('bidi');
    expect(result).toContain('<w:ind w:left="1704" w:right="720"/>');
    expect(result).toContain('<w:t>‫شهادة عمل‬</w:t>');
    expect(result).toContain('<w:t>‫28 أداة لملفات PDF‬</w:t>');
  });

  it('does not rewrite a document without Arabic', () => {
    const result = runPython(`${DOCX}
path = make('<w:p><w:r><w:t>Employment certificate</w:t></w:r></w:p>')
before = open(path, 'rb').read()
n = arabic_docx(path)
print(json.dumps([n, open(path, 'rb').read() == before]))
`);
    expect(result).toEqual([0, true]);
  });
});
