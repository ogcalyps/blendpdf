// Scoring: character/word error rate, Arabic-aware normalization, RTL signals.
// CER/WER require a ground-truth reference. Without one, use pairwise agreement
// (scorePair between two engines) plus the eyeball report.

// Arabic script blocks (base + supplement + presentation forms A/B).
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const ARABIC_G = new RegExp(ARABIC.source, 'g');
// Any right-to-left char (Arabic + Hebrew ranges).
const RTL = /[֐-׿؀-ۿݐ-ݿࢠ-ࣿיִ-﷿ﹰ-﻿]/;

// Tashkeel / harakat and other combining marks that shouldn't dominate CER.
const TASHKEEL_G = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ࣓-ࣿ]/g;
const TATWEEL_G = /ـ/g; // kashida (elongation) — cosmetic

function mapArabicDigits(s) {
  let out = '';
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660);        // Arabic-Indic
    else if (c >= 0x06F0 && c <= 0x06F9) out += String(c - 0x06F0);   // Eastern Arabic-Indic
    else out += ch;
  }
  return out;
}

// Light normalization: NFC, collapse whitespace, unify digits. Preserves letters.
export function normalizeLight(s) {
  return mapArabicDigits((s || '').normalize('NFC'))
    .replace(/\s+/g, ' ')
    .trim();
}

// Aggressive normalization for a fairer CER: also strips diacritics/tatweel and
// unifies common Arabic letter variants (alef forms, ya/alef-maqsura, ta-marbuta).
export function normalizeArabic(s) {
  return mapArabicDigits((s || '').normalize('NFC'))
    .replace(TASHKEEL_G, '')
    .replace(TATWEEL_G, '')
    .replace(/[آأإٱ]/g, 'ا') // آأإٱ -> ا
    .replace(/ى/g, 'ي')                     // ى -> ي
    .replace(/ة/g, 'ه')                     // ة -> ه
    .replace(/\s+/g, ' ')
    .trim();
}

// Space-optimized Levenshtein over an array of tokens (chars or words).
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let cur = i;
    const ai = a[i - 1];
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      const cost = ai === b[j - 1] ? 0 : 1;
      cur = Math.min(prev[j] + 1, cur + 1, diag + cost);
      diag = tmp;
      prev[j] = cur;
    }
  }
  return prev[b.length];
}

function chars(s) { return Array.from(s); }
function words(s) { return s.length ? s.split(' ') : []; }

// Error rate of hypothesis vs reference at a given granularity. 0 = identical.
function rate(refNorm, hypNorm, granularity) {
  const r = granularity === 'word' ? words(refNorm) : chars(refNorm);
  const h = granularity === 'word' ? words(hypNorm) : chars(hypNorm);
  if (r.length === 0) return h.length === 0 ? 0 : 1;
  return levenshtein(r, h) / r.length;
}

// Score a hypothesis against a reference. cerNorm uses Arabic normalization,
// which is the number to trust for Arabic; cerRaw uses light normalization only.
export function scoreAgainst(reference, hypothesis) {
  const refLight = normalizeLight(reference);
  const hypLight = normalizeLight(hypothesis);
  const refAr = normalizeArabic(reference);
  const hypAr = normalizeArabic(hypothesis);
  return {
    cerRaw: rate(refLight, hypLight, 'char'),
    cerNorm: rate(refAr, hypAr, 'char'),
    werNorm: rate(refAr, hypAr, 'word'),
  };
}

// Symmetric-ish agreement between two engine outputs (each treated as ref once,
// averaged) — a proxy signal when there is no ground truth.
export function scorePair(a, b) {
  const ab = scoreAgainst(a, b).cerNorm;
  const ba = scoreAgainst(b, a).cerNorm;
  return (ab + ba) / 2;
}

export function arabicRatio(s) {
  const compact = (s || '').replace(/\s+/g, '');
  if (!compact.length) return 0;
  const m = compact.match(ARABIC_G);
  return (m ? m.length : 0) / compact.length;
}

export function hasRTL(s) { return RTL.test(s || ''); }
export function charCount(s) { return Array.from(s || '').length; }
