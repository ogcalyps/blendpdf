import { describe, it, expect } from 'vitest';
import {
    gregorianToHijri,
    todayHijri,
    formatGregorianDate,
    substituteDateTokens,
    TOKEN_TODAY,
    TOKEN_TODAY_HIJRI,
} from '../lib/hijri';

// Umm al-Qura is tabular but ICU data can shift a civil date by ±1 day between
// versions, so anchors assert year + month exactly and allow the day to float
// by one. Anchors were verified against Node's Intl output before asserting.

const ARABIC_INDIC_DIGITS = /[٠-٩]/;

describe('gregorianToHijri', () => {
    it('converts 2026-08-10 to late Safar 1448', () => {
        const result = gregorianToHijri(new Date(2026, 7, 10), 'en');
        expect(result.year).toBe(1448);
        expect(result.month).toBe(2);
        expect(result.monthName).toBe('Safar');
        expect(result.day).toBeGreaterThanOrEqual(25);
        expect(result.day).toBeLessThanOrEqual(28);
        expect(result.formatted).toBe(`${result.day} Safar 1448 AH`);
    });

    it('converts 2025-03-15 to mid-Ramadan 1446', () => {
        const result = gregorianToHijri(new Date(2025, 2, 15), 'en');
        expect(result.year).toBe(1446);
        expect(result.month).toBe(9);
        expect(result.monthName).toBe('Ramadan');
        expect(result.day).toBeGreaterThanOrEqual(14);
        expect(result.day).toBeLessThanOrEqual(16);
    });

    it('converts 2000-01-01 to late Ramadan 1420', () => {
        const result = gregorianToHijri(new Date(2000, 0, 1), 'en');
        expect(result.year).toBe(1420);
        expect(result.month).toBe(9);
        expect(result.day).toBeGreaterThanOrEqual(23);
        expect(result.day).toBeLessThanOrEqual(25);
    });

    it('formats Arabic locale with arabic-indic digits and هـ suffix', () => {
        const en = gregorianToHijri(new Date(2026, 7, 10), 'en');
        const ar = gregorianToHijri(new Date(2026, 7, 10), 'ar');
        // Numeric fields are locale-independent
        expect(ar.year).toBe(en.year);
        expect(ar.month).toBe(en.month);
        expect(ar.day).toBe(en.day);
        expect(ar.monthName).toBe('صفر');
        expect(ar.formatted).toMatch(ARABIC_INDIC_DIGITS);
        expect(ar.formatted.endsWith('هـ')).toBe(true);
        expect(ar.formatted).toContain('صفر');
        // No latin digits leak into the Arabic rendering
        expect(ar.formatted).not.toMatch(/[0-9]/);
    });

    it('handles ar-* region locales like the bare ar locale', () => {
        const bare = gregorianToHijri(new Date(2026, 7, 10), 'ar');
        const regional = gregorianToHijri(new Date(2026, 7, 10), 'ar-SA');
        expect(regional.formatted).toBe(bare.formatted);
    });

    it('is stable across repeated calls (roundtrip stability)', () => {
        const date = new Date(2026, 7, 10);
        expect(gregorianToHijri(date, 'en')).toEqual(gregorianToHijri(date, 'en'));
        expect(gregorianToHijri(date, 'ar')).toEqual(gregorianToHijri(date, 'ar'));
    });

    it('advances day-by-day with valid month lengths over 60 consecutive days', () => {
        let prev = gregorianToHijri(new Date(2026, 0, 1), 'en');
        for (let offset = 1; offset <= 60; offset++) {
            const current = gregorianToHijri(new Date(2026, 0, 1 + offset), 'en');
            expect(current.day).toBeGreaterThanOrEqual(1);
            expect(current.day).toBeLessThanOrEqual(30);
            if (current.month === prev.month && current.year === prev.year) {
                expect(current.day).toBe(prev.day + 1);
            } else {
                // Month rolled over: previous day must have been 29 or 30
                expect(current.day).toBe(1);
                expect(prev.day === 29 || prev.day === 30).toBe(true);
            }
            prev = current;
        }
    });
});

describe('todayHijri', () => {
    it('matches gregorianToHijri for the current date', () => {
        // Run both within the same tick; a midnight rollover between the two
        // calls is the only way this could flake.
        const expected = gregorianToHijri(new Date(), 'en').formatted;
        expect(todayHijri('en')).toBe(expected);
        expect(todayHijri('en')).toMatch(/^\d{1,2} .+ \d{4} AH$/);
    });
});

describe('substituteDateTokens', () => {
    const now = new Date(2026, 7, 10); // 2026-08-10

    it('replaces {{today}} with the formatted Gregorian date', () => {
        expect(substituteDateTokens(TOKEN_TODAY, 'en', now)).toBe('10 August 2026');
        expect(substituteDateTokens('Signed on {{today}}.', 'en', now)).toBe('Signed on 10 August 2026.');
    });

    it('replaces {{today_hijri}} with the formatted Hijri date', () => {
        const hijri = gregorianToHijri(now, 'en').formatted;
        expect(substituteDateTokens(TOKEN_TODAY_HIJRI, 'en', now)).toBe(hijri);
        expect(substituteDateTokens('التاريخ: {{today_hijri}}', 'ar', now))
            .toBe(`التاريخ: ${gregorianToHijri(now, 'ar').formatted}`);
    });

    it('replaces both tokens in one cell and leaves no braces behind', () => {
        const result = substituteDateTokens('{{today}} / {{today_hijri}}', 'en', now);
        expect(result).not.toContain('{{');
        expect(result).toContain('10 August 2026');
        expect(result).toContain('1448 AH');
    });

    it('is case-insensitive and tolerates inner whitespace', () => {
        expect(substituteDateTokens('{{ TODAY }}', 'en', now)).toBe('10 August 2026');
        expect(substituteDateTokens('{{Today_Hijri}}', 'en', now)).toBe(gregorianToHijri(now, 'en').formatted);
    });

    it('uses arabic-indic digits for the ar locale', () => {
        const result = substituteDateTokens(TOKEN_TODAY, 'ar', now);
        expect(result).toMatch(/[٠-٩]/);
    });

    it('leaves non-token strings and unknown tokens untouched', () => {
        expect(substituteDateTokens('plain value', 'en', now)).toBe('plain value');
        expect(substituteDateTokens('{{tomorrow}}', 'en', now)).toBe('{{tomorrow}}');
        expect(substituteDateTokens('', 'en', now)).toBe('');
    });
});

describe('formatGregorianDate', () => {
    it('formats en with latin digits and ar with arabic-indic digits', () => {
        const date = new Date(2026, 7, 10);
        expect(formatGregorianDate(date, 'en')).toBe('10 August 2026');
        const ar = formatGregorianDate(date, 'ar');
        expect(ar).toMatch(/[٠-٩]/);
        expect(ar).toContain('أغسطس');
    });
});
