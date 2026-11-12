/**
 * lib/edit-pdf/prefill.ts: the edit field's prefill, rebuilt from glyphs
 * drawn left to right into logical order, and the sanity check that starts
 * the field empty when the file's text can't be trusted. Pure strings, so
 * every case is written out: `visual` is what a viewer paints left to right.
 */
import { describe, expect, it } from 'vitest';
import { arabicLetters, arabicScriptLanguage, logicalOrder, prefillLooksBroken, prefillText, strongDirection } from '../lib/edit-pdf/prefill';

/** One piece per character, the way most producers draw text (one glyph per letter). */
const glyphs = (visual: string) => [...visual];

describe('logicalOrder: an RTL line drawn left to right', () => {
  it('reverses Arabic glyph by glyph and keeps a ligature glyph\'s own string intact (lam-alef)', () => {
    // سلام drawn as م, the lam-alef ligature glyph (ToUnicode "لا"), س.
    expect(logicalOrder(['م', 'لا', 'س'], 'rtl')).toBe('سلام');
    // The same ligature stored alef-first (lib/pdf-text writes it that way for character-reversing viewers).
    expect(logicalOrder(['م', 'ال', 'س'], 'rtl')).toBe('سلام');
  });

  it('keeps Arabic-Indic and European digit runs left to right', () => {
    expect(logicalOrder(glyphs('٤٤٧١ مقر'), 'rtl')).toBe('رقم ٤٤٧١');
    expect(logicalOrder(glyphs('1,250.00 غلبملا'), 'rtl')).toBe('المبلغ 1,250.00');
    expect(logicalOrder(glyphs('١٥ خيراتلا'), 'rtl')).toBe('التاريخ ١٥');
  });

  it('keeps a Latin phrase of several words in order inside Arabic', () => {
    expect(logicalOrder(glyphs('مويلا Blend PDF ربع'), 'rtl')).toBe('عبر Blend PDF اليوم');
  });

  it('puts a full stop or comma after a Latin run at the logical end (UAX #9 N1)', () => {
    expect(logicalOrder(glyphs('.BlendPDF ربع'), 'rtl')).toBe('عبر BlendPDF.');
    expect(logicalOrder(glyphs('.4471 مقر'), 'rtl')).toBe('رقم 4471.');
  });

  it('keeps a percent or currency sign with its number', () => {
    expect(logicalOrder(glyphs('طقف 15% ةبسنب'), 'rtl')).toBe('بنسبة 15% فقط');
  });

  it('leaves an LTR line in drawing order', () => {
    expect(logicalOrder(glyphs('Invoice INV-2026-0815, due.'), 'ltr')).toBe('Invoice INV-2026-0815, due.');
  });

  it('reverses an Arabic run inside an English line', () => {
    expect(logicalOrder(glyphs('Name: دمحأ (paid)'), 'ltr')).toBe('Name: أحمد (paid)');
  });
});

describe('prefillText and strongDirection', () => {
  it('folds presentation forms back to letters (NFKC), drops controls, collapses spaces', () => {
    expect(prefillText('ﺍﻟﺴﻼﻡ')).toBe('السلام');
    expect(prefillText('  a‏b­ c \t d ')).toBe('ab c d');
    expect(prefillText('ﬁle')).toBe('file');
  });

  it('reads the direction from letters, not digits; a line of only digits takes the fallback', () => {
    expect(strongDirection('المبلغ 250 عبر BlendPDF')).toBe('rtl');
    expect(strongDirection('Invoice رقم 4471 paid in full')).toBe('ltr');
    expect(strongDirection('١٢')).toBe('ltr');
    expect(strongDirection('١٢', 'rtl')).toBe('rtl');
    expect(strongDirection('1,250.00', 'rtl')).toBe('rtl');
  });
});

describe('prefillLooksBroken', () => {
  it('flags dotless bases and detached hamza (the dots were separate glyphs), and unmapped glyphs', () => {
    expect(prefillLooksBroken('سکرکم علی عاملکم مع ٮا')).toBe(true);
    expect(prefillLooksBroken('م ٔاك د موعد')).toBe(true);
    expect(prefillLooksBroken('مں الا')).toBe(true);
    expect(prefillLooksBroken('total � due')).toBe(true);
  });

  it('flags control characters (a broken ToUnicode entry) and an empty line', () => {
    expect(prefillLooksBroken('\u0000\u0000 سكركم')).toBe(true);
    expect(prefillLooksBroken('abc\u0003def')).toBe(true);
    expect(prefillLooksBroken('   ')).toBe(true);
  });

  it('flags letters scattered as one-letter words', () => {
    expect(prefillLooksBroken('ر ح ی ص ا ر س ح ه')).toBe(true);
  });

  it('flags every glyph drawn twice (text shadow, fake bold)', () => {
    expect(prefillLooksBroken('TThhaannkk yyoouu')).toBe(true);
    expect(prefillLooksBroken('االلسسططرر')).toBe(true);
  });

  it('never flags a clean line: Arabic, English, mixed, numbers', () => {
    const clean = [
      'إشعار تحديث الحساب',
      'تم تأكيد موعد التسوية رقم ٤٤٧١ يوم الثلاثاء القادم.',
      'المبلغ الإجمالي هو 250 دولار شاملا الضريبة عبر BlendPDF.',
      'سيتم تحويل المبلغ الإجمالي وقدره 1,250 ريال إلى حسابكم خلال ثلاثة أيام عمل.',
      'المدير العام: خالد بن سعيد ____________',
      'قال و ذهب إلى السوق',
      'The committee approved the bookkeeper in Mississippi.',
      'Invoice number: INV-2026-0815',
      'Bank transfer to account 4471 0098 2231, sort code 20-44-71.',
      'Total due: 86.00 GBP',
      '1,250.00',
      '٢١',
      'aa',
      'Name: أحمد (paid)',
    ];
    expect(clean.filter(prefillLooksBroken)).toEqual([]);
  });
});

describe('arabicLetters: Persian look-alikes in an Arabic line', () => {
  it('maps heh doachashmee to heh and Farsi yeh to yeh or alef maksura, form for form', () => {
    // تشهد / لديها as Chrome names Times New Roman's glyphs: medial heh U+FBAD, medial Farsi yeh U+FBFF.
    expect(prefillText(arabicLetters('ﺗﺸﮭﺪ ﻟﺪﯿﮭﺎ'))).toBe('تشهد لديها');
    expect(arabicLetters('ﮪ ﮫ ﮬ ﮭ').normalize('NFKC')).toBe('ه ه ه ه');
    // Dotless when isolated or final: alef maksura; dotted when joined: yeh.
    expect(arabicLetters('ﯼ ﯽ ﯾ ﯿ').normalize('NFKC')).toBe('ى ى ي ي');
  });

  it('reads a bare Farsi yeh as yeh before a letter of its word, alef maksura at its end', () => {
    expect(arabicLetters('یعمل علی')).toBe('يعمل على');
    expect(arabicLetters('ھذا')).toBe('هذا');
  });
});

describe('arabicScriptLanguage', () => {
  it('Arabic when Arabic-only letters show and no Persian-only one does', () => {
    expect(arabicScriptLanguage('شھادة عمل')).toBe('arabic');
    expect(arabicScriptLanguage('حرر بالدار البیضاء في')).toBe('arabic');
  });

  it('Persian or Urdu when a letter only they write shows, even beside Arabic-only ones', () => {
    expect(arabicScriptLanguage('این کتاب را بخوانید')).toBe('persian');
    expect(arabicScriptLanguage('پیش من است')).toBe('persian');
    expect(arabicScriptLanguage('یہ کتاب ہے')).toBe('persian');
    expect(arabicScriptLanguage('گزارش سالانة')).toBe('persian');
  });

  it("ignores keheh's joined forms (Arabic kaf's glyph in many fonts) and says nothing about shared letters only", () => {
    expect(arabicScriptLanguage('ﺷﺮﮐﺔ')).toBe('arabic');
    expect(arabicScriptLanguage('سلام')).toBeNull();
    expect(arabicScriptLanguage('Invoice 2026')).toBeNull();
  });
});
