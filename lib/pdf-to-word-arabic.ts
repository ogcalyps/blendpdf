/**
 * Python that the PDF to Word route runs around pdf2docx so Arabic comes out as Arabic.
 *
 * pdf2docx reads a line in the order the PDF draws it and writes it into a
 * left-to-right Word paragraph. Tested on 2026-11-12 with a work certificate
 * exported by Word for Mac, LibreOffice and Chrome, opened in Microsoft Word:
 * "منذ 15 مارس 2021 … 8.500 درهم." came out as "درهم8.500 … قدره2021 مارس",
 * لا came out as ال (الاسم → االسم), Word for Mac files held presentation forms
 * that Find and spell-check do not match, and no paragraph was right-to-left.
 *
 * - `arabic_reader()` patches what pdf2docx reads. Each mostly-Arabic line is
 *   put in reading order from the letters' positions, and the pieces of one
 *   right-to-left row are taken from the right.
 * - `arabic_docx(path)` marks those paragraphs right-to-left in the .docx,
 *   mirrors their indents, sets the Arabic (complex script) font and size, and
 *   turns presentation forms back into letters.
 *
 * Files without Arabic are not touched: the reader skips their lines and the
 * .docx is only rewritten when a paragraph changed.
 *
 * Kept in TypeScript because the server only gets the build, not lib/.
 * String.raw keeps the Python's backslashes; it must not contain a backtick or
 * a dollar sign followed by a brace.
 */
export const ARABIC_LAYOUT_PY = String.raw`
import re as _re
import unicodedata as _ud

_ARABIC = _re.compile('[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻾]')
_LATIN = _re.compile('[A-Za-zÀ-ɏ]')
_DIGIT = _re.compile('[0-9٠-٩۰-۹]')
_PRESENTATION = _re.compile('[ﭐ-﷿ﹰ-﻾]+')
# Letters only Persian or Urdu use; and the Persian letters Arial draws Arabic ي ك ه with
_PERSIAN_OR_URDU = _re.compile('[پچژگٹڈڑںے]')
_PERSIAN_LOOKALIKES = {'ی': 'ي', 'ک': 'ك', 'ھ': 'ه'}
_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
_AFTER_BIDI = {'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents',
               'suppressOverlap', 'jc', 'textDirection', 'textAlignment', 'textboxTightWrap',
               'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'}
arabic_lines_fixed = 0


def arabic_rtl(text):
    # By words, so an email address or a brand name in an Arabic line does not outvote it
    words = text.split()
    arabic = sum(1 for w in words if _ARABIC.search(w))
    latin = sum(1 for w in words if _LATIN.search(w) and not _ARABIC.search(w))
    if arabic != latin:
        return arabic > latin
    return len(_ARABIC.findall(text)) > len(_LATIN.findall(text))


def _ltr(ch):
    return bool(_LATIN.match(ch) or _DIGIT.match(ch))


def _mid(c):
    return (c['bbox'][0] + c['bbox'][2]) / 2


def _zero(c):
    return c['bbox'][2] - c['bbox'][0] < 0.01


def _mark(c):
    return _ud.category(c['c']) in ('Mn', 'Me')


def arabic_line_order(chars):
    """Reading order for the chars of a right-to-left line, from their positions."""
    marks = [c for c in chars if _mark(c)]
    bases = [c for c in chars if not _mark(c)]
    key = {id(c): _mid(c) for c in chars}
    # One glyph drawn for several letters (لا, الله, ءً): the reader gives its width to one letter and
    # lists the others before it, back to front and without width, at its right edge. Those read after
    # that letter, in reverse. A zero-width letter off the next glyph's edge is the base under the
    # mark listed before it (أُ arrives as the damma, with the width, then أ). Both need a neighbour
    # with a width, so a file whose glyphs have none is left in position order.
    tail = lambda c: _zero(c) and not _mark(c) and c['c'].strip() != ''
    i = 0
    while i < len(chars):
        if not tail(chars[i]):
            i += 1
            continue
        j = i
        while j + 1 < len(chars) and tail(chars[j + 1]):
            j += 1
        run, x = chars[i:j + 1], chars[i]['bbox'][0]
        nxt = chars[j + 1] if j + 1 < len(chars) else None
        prv = chars[i - 1] if i > 0 else None
        if nxt is not None and not _zero(nxt) and abs(nxt['bbox'][2] - x) < 0.3:
            for k, z in enumerate(reversed(run)):
                key[id(z)] = _mid(nxt) - 0.001 * (k + 1)
        elif prv is not None and not _zero(prv):
            for k, z in enumerate(run):
                key[id(z)] = _mid(prv) + 0.001 * (len(run) - k)
        i = j + 1
    bases.sort(key=lambda c: -key[id(c)])
    # Right to left, except runs of digits or Latin (with the dots, slashes and spaces between them)
    out = []
    i = 0
    while i < len(bases):
        if not _ltr(bases[i]['c']):
            out.append(bases[i])
            i += 1
            continue
        j = i
        while j + 1 < len(bases) and (_ltr(bases[j + 1]['c']) or (
                not _ARABIC.match(bases[j + 1]['c']) and j + 2 < len(bases) and _ltr(bases[j + 2]['c']))):
            j += 1
        out.extend(reversed(bases[i:j + 1]))
        i = j + 1
    # A mark follows its letter: the one under its middle, else the nearest one by position
    attached = set()
    for e in marks:
        letters = [k for k, c in enumerate(out) if id(c) not in attached and c['c'].strip()]
        under = [k for k in letters
                 if not _zero(out[k]) and out[k]['bbox'][0] - 0.5 <= _mid(e) <= out[k]['bbox'][2] + 0.5]
        if under:
            host = under[0]
        elif letters:
            host = min(letters, key=lambda k: abs(key[id(out[k])] - _mid(e)))
        else:
            host = len(out) - 1
        k = host + 1
        while k < len(out) and (id(out[k]) in attached or (
                _zero(out[k]) and abs(key[id(out[k])] - key[id(out[host])]) < 0.01)):
            k += 1
        attached.add(id(e))
        out.insert(k, e)
    return out


def _style(span):
    return (span.get('font'), round(span.get('size', 0), 2), span.get('flags'), span.get('color'), span.get('alpha'))


def _reorder_line(line):
    if line.get('wmode', 0) != 0 or tuple(round(v) for v in line.get('dir', (1, 0))) != (1, 0):
        return False
    spans = line.get('spans', [])
    chars = [(span, c) for span in spans for c in span.get('chars', [])]
    if not chars or not arabic_rtl(''.join(c['c'] for _, c in chars)):
        return False
    span_of = {id(c): span for span, c in chars}
    ordered = arabic_line_order([c for _, c in chars])
    # Word joins a paragraph's lines without a space, so a line drawn without one at its logical end
    # would glue its last word to the next line's first
    last = ordered[-1]
    if last['c'].strip():
        x = min(c['bbox'][0] for _, c in chars)
        space = dict(last, c=' ', bbox=(x, last['bbox'][1], x, last['bbox'][3]), origin=(x, last['origin'][1]))
        span_of[id(space)] = span_of[id(last)]
        ordered.append(space)
    # Regroup by look, not by the reader's spans: Chrome's Type 3 text has every space in a span of its
    # own, which pdf2docx would drop. A group with no width (a mark or a ligature tail in another
    # font) or only spaces joins the one before it, since pdf2docx divides by a span's area.
    groups = []
    for c in ordered:
        span = span_of[id(c)]
        if groups and _style(groups[-1][0]) == _style(span):
            groups[-1][1].append(c)
        else:
            groups.append((span, [c]))
    merged = []
    for span, cs in groups:
        weak = max(c['bbox'][2] for c in cs) - min(c['bbox'][0] for c in cs) < 0.01 or not ''.join(c['c'] for c in cs).strip()
        if merged and (weak or merged[-1][2]):
            look = merged[-1][0] if weak else span
            merged[-1] = (look, merged[-1][1] + cs, weak and merged[-1][2])
        else:
            merged.append((span, cs, weak))
    rebuilt = []
    for span, cs, _ in merged:
        bbox = (min(c['bbox'][0] for c in cs), min(c['bbox'][1] for c in cs),
                max(c['bbox'][2] for c in cs), max(c['bbox'][3] for c in cs))
        if bbox[2] - bbox[0] < 0.01 or bbox[3] - bbox[1] < 0.01:
            return False  # nothing here has a size: leave the line as read
        rebuilt.append(dict(span, chars=cs, bbox=bbox))
    line['spans'] = rebuilt
    return True


def arabic_rawdict(raw):
    global arabic_lines_fixed
    for block in raw.get('blocks', []):
        for line in block.get('lines', []):
            before = line.get('spans')
            try:
                if _reorder_line(line):
                    arabic_lines_fixed += 1
            except Exception:
                line['spans'] = before
    return raw


def arabic_reader():
    """Patch what pdf2docx reads; returns a function that takes the patches off."""
    import fitz
    from pdf2docx.common.Collection import Collection
    get_text, sort_row = fitz.Page.get_text, Collection.sort_in_line_order

    def patched_get_text(self, option='text', *args, **kwargs):
        result = get_text(self, option, *args, **kwargs)
        if option == 'rawdict' and isinstance(result, dict):
            arabic_rawdict(result)
        return result

    # pdf2docx puts the pieces of one visual row left to right; a right-to-left row reads from the right
    def patched_sort_row(self):
        sort_row(self)
        items = list(self)
        if (len(items) > 1 and not self.is_vertical_text and all(hasattr(e, 'spans') for e in items)
                and arabic_rtl(' '.join(e.text or '' for e in items))):
            self._instances.sort(key=lambda e: (-e.bbox.x1, e.bbox.y0))
        return self

    # Where pdf2docx cannot tell a block's alignment (designed pages) it places each piece with tab stops
    # measured from the left, which only works with the pieces left to right: put them back so first
    from pdf2docx.text.Lines import Lines
    tab_stops = Lines.parse_tab_stop

    def patched_tab_stops(self, *args, **kwargs):
        if arabic_rtl(' '.join(e.text or '' for e in self)):
            rows, ordered = [], []
            for line in self:
                if rows and rows[-1][-1].in_same_row(line):
                    rows[-1].append(line)
                else:
                    rows.append([line])
            for row in rows:
                ordered.extend(sorted(row, key=lambda e: (e.bbox.x0, e.bbox.y0)))
            self._instances[:] = ordered
        return tab_stops(self, *args, **kwargs)

    fitz.Page.get_text, Collection.sort_in_line_order, Lines.parse_tab_stop = (
        patched_get_text, patched_sort_row, patched_tab_stops)

    def undo():
        fitz.Page.get_text, Collection.sort_in_line_order, Lines.parse_tab_stop = get_text, sort_row, tab_stops
    return undo


def _complex_script(p, q, etree):
    # Word sizes and styles Arabic with the complex-script properties, which pdf2docx never sets
    for r in p.iter(q('r')):
        rPr = r.find(q('rPr'))
        if rPr is None:
            rPr = etree.Element(q('rPr'))
            r.insert(0, rPr)
        fonts = rPr.find(q('rFonts'))
        if fonts is not None and fonts.get(q('ascii')) and not fonts.get(q('cs')):
            fonts.set(q('cs'), fonts.get(q('ascii')))
        for plain, cs in (('b', 'bCs'), ('i', 'iCs'), ('sz', 'szCs')):
            el = rPr.find(q(plain))
            if el is not None and rPr.find(q(cs)) is None:
                twin = etree.Element(q(cs))
                for k, v in el.attrib.items():
                    twin.set(k, v)
                el.addnext(twin)
        if _ARABIC.search(''.join(t.text or '' for t in r.iter(q('t')))) and rPr.find(q('rtl')) is None:
            rPr.append(etree.Element(q('rtl')))


def arabic_docx(path):
    """Mark the .docx's Arabic paragraphs right-to-left; returns how many changed."""
    import os
    import zipfile
    from lxml import etree
    q = lambda tag: '{%s}%s' % (_W, tag)
    with zipfile.ZipFile(path) as z:
        items = [(i, z.read(i.filename)) for i in z.infolist()]
    changed = 0
    out = []
    for info, data in items:
        if info.filename != 'word/document.xml':
            out.append((info, data))
            continue
        root = etree.fromstring(data)
        texts = [t for t in root.iter(q('t')) if t.text]
        # Presentation forms (Word for Mac writes them) become letters, so Find and spell-check work.
        # Arial draws ي ك ه with the Persian ی ک ھ glyphs and Word for Mac labels some of them so, so a
        # document with no Persian or Urdu letters gets them back as Arabic (the rule PDF to Text uses).
        everything = _ud.normalize('NFKC', ''.join(t.text for t in texts))
        swap = {} if _PERSIAN_OR_URDU.search(everything) else _PERSIAN_LOOKALIKES
        for t in texts:
            text = _PRESENTATION.sub(lambda m: _ud.normalize('NFKC', m.group()), t.text)
            if swap and _ARABIC.search(text):
                text = ''.join(swap.get(ch, ch) for ch in text)
            if text != t.text:
                t.text = text
                changed += 1
        for p in root.iter(q('p')):
            ts = [t for t in p.iter(q('t')) if t.text]
            if not arabic_rtl(''.join(t.text for t in ts)):
                continue
            changed += 1
            runs = list(p.iter(q('r')))
            if any(r.find(q('tab')) is not None for r in runs):
                # Placed with left-measured tab stops (a designed page): the layout stays left to right
                # and each Arabic piece between tabs reads right to left inside an embedding
                pieces, piece = [], []
                for r in runs:
                    if r.find(q('tab')) is not None or r.find(q('br')) is not None:
                        pieces.append(piece)
                        piece = []
                    piece.extend(t for t in r.iter(q('t')) if t.text)
                pieces.append(piece)
                for piece in pieces:
                    if piece and arabic_rtl(''.join(t.text for t in piece)):
                        piece[0].text = '‫' + piece[0].text
                        piece[-1].text = piece[-1].text + '‬'
                _complex_script(p, q, etree)
                continue
            pPr = p.find(q('pPr'))
            if pPr is None:
                pPr = etree.Element(q('pPr'))
                p.insert(0, pPr)
            if pPr.find(q('bidi')) is None:
                bidi = etree.Element(q('bidi'))
                later = [c for c in pPr if etree.QName(c).localname in _AFTER_BIDI]
                if later:
                    later[0].addprevious(bidi)
                else:
                    pPr.append(bidi)
            # Word reads a right-to-left paragraph's left indent as its start, the visual right; pdf2docx
            # measured from the left of the page. The start gets pdf2docx's right space, the end the
            # leftmost line's space, and the first-line offset goes (it described a ragged left edge).
            ind = pPr.find(q('ind'))
            if ind is not None:
                num = lambda a: int(ind.get(q(a)) or 0)
                left, right, first = num('left'), num('right'), num('firstLine') - num('hanging')
                for a in ('left', 'right', 'firstLine', 'hanging', 'start', 'end'):
                    ind.attrib.pop(q(a), None)
                ind.set(q('left'), str(max(right, 0)))
                ind.set(q('right'), str(max(min(left, left + first), 0)))
            jc = pPr.find(q('jc'))
            if jc is not None and jc.get(q('val')) in ('left', 'right', 'start', 'end'):
                jc.set(q('val'), 'left')
            # A line's added end space meets the next piece's own leading space: keep one
            for a, b in zip(ts, ts[1:]):
                if a.text.endswith(' ') and b.text.startswith(' '):
                    b.text = b.text[1:]
            _complex_script(p, q, etree)
        data = etree.tostring(root, xml_declaration=True, encoding='UTF-8', standalone=True)
        out.append((info, data))
    if changed:
        tmp = path + '.arabic'
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as z:
            for info, data in out:
                z.writestr(info, data)
        os.replace(tmp, path)
    return changed
`;
