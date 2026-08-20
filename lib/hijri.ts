/**
 * Hijri (Islamic calendar) date utilities built on the platform Intl API.
 *
 * Uses the Umm al-Qura calendar ('islamic-umalqura' — the civil calendar of
 * Saudi Arabia) with a fallback to the generic 'islamic' calendar on engines
 * that don't ship umalqura data. No third-party dependencies.
 *
 * Note: tabular Hijri calendars can differ by ±1 day from locally observed
 * (moon-sighting) dates — callers should treat the output as the standard
 * civil Hijri date, not a religious authority.
 */

export interface HijriDate {
    /** Locale-formatted string, e.g. "١٥ محرم ١٤٤٨هـ" (ar) or "15 Muharram 1448 AH" (en) */
    formatted: string;
    /** Hijri year, e.g. 1448 */
    year: number;
    /** Hijri month, 1 (Muharram) to 12 (Dhu al-Hijjah) */
    month: number;
    /** Hijri day of month, 1-30 */
    day: number;
    /** Localized month name, e.g. "Muharram" / "محرم" */
    monthName: string;
}

/** Token users can type in a spreadsheet cell (or map a field to) for today's Gregorian date. */
export const TOKEN_TODAY = '{{today}}';
/** Token users can type in a spreadsheet cell (or map a field to) for today's Hijri date. */
export const TOKEN_TODAY_HIJRI = '{{today_hijri}}';

const HIJRI_CALENDARS = ['islamic-umalqura', 'islamic'];

function isArabicLocale(locale?: string): boolean {
    return !!locale && locale.toLowerCase().startsWith('ar');
}

/**
 * Build a DateTimeFormat for the preferred Hijri calendar, falling back to the
 * generic 'islamic' calendar if 'islamic-umalqura' is unavailable.
 */
function hijriFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    let lastError: unknown;
    for (const calendar of HIJRI_CALENDARS) {
        try {
            return new Intl.DateTimeFormat(locale, { ...options, calendar });
        } catch (e) {
            lastError = e;
        }
    }
    throw lastError instanceof Error
        ? lastError
        : new Error('No Islamic calendar support in this Intl implementation');
}

/**
 * Convert a Gregorian Date to its Hijri (Umm al-Qura) equivalent.
 *
 * @param date   The Gregorian date to convert.
 * @param locale 'ar' (or any ar-*) for Arabic month names + arabic-indic
 *               digits; anything else formats in English with latin digits.
 */
export function gregorianToHijri(date: Date, locale: string = 'en'): HijriDate {
    const arabic = isArabicLocale(locale);
    const displayLocale = arabic ? 'ar' : 'en';

    // Numeric parts: always latin digits so they can be parsed reliably.
    const numericParts = hijriFormatter('en', {
        numberingSystem: 'latn',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(date);

    let year = 0;
    let month = 0;
    let day = 0;
    for (const part of numericParts) {
        if (part.type === 'year') year = parseInt(part.value, 10);
        else if (part.type === 'month') month = parseInt(part.value, 10);
        else if (part.type === 'day') day = parseInt(part.value, 10);
    }

    const monthName = hijriFormatter(displayLocale, { month: 'long' }).format(date);

    // Digits in the display numbering system (arabic-indic for ar, latin for en).
    const digits = new Intl.NumberFormat(displayLocale, {
        numberingSystem: arabic ? 'arab' : 'latn',
        useGrouping: false,
    });

    const formatted = arabic
        ? `${digits.format(day)} ${monthName} ${digits.format(year)}هـ`
        : `${day} ${monthName} ${year} AH`;

    return { formatted, year, month, day, monthName };
}

/** Today's date formatted in the Hijri calendar (see gregorianToHijri). */
export function todayHijri(locale: string = 'en'): string {
    return gregorianToHijri(new Date(), locale).formatted;
}

/**
 * A Gregorian date formatted for insertion into a PDF form field:
 * "10 August 2026" (en) / "١٠ أغسطس ٢٠٢٦" (ar).
 */
export function formatGregorianDate(date: Date, locale: string = 'en'): string {
    const arabic = isArabicLocale(locale);
    return new Intl.DateTimeFormat(arabic ? 'ar' : 'en-GB', {
        numberingSystem: arabic ? 'arab' : 'latn',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}

const TODAY_HIJRI_RE = /\{\{\s*today_hijri\s*\}\}/gi;
const TODAY_RE = /\{\{\s*today\s*\}\}/gi;

/**
 * Replace {{today}} / {{today_hijri}} tokens in a string with today's date,
 * formatted for the given locale. Tokens are case-insensitive and tolerate
 * inner whitespace ("{{ today }}"). Non-matching strings are returned as-is.
 *
 * If the Intl implementation lacks Islamic calendar support, the Hijri token
 * degrades to the Gregorian date rather than throwing mid-batch.
 */
export function substituteDateTokens(value: string, locale: string = 'en', now: Date = new Date()): string {
    if (!value.includes('{{')) return value;

    // Replacer callbacks only run on an actual match, so dates are computed lazily.
    let hijriValue: string | undefined;
    let gregorianValue: string | undefined;

    return value
        .replace(TODAY_HIJRI_RE, () => {
            if (hijriValue === undefined) {
                try {
                    hijriValue = gregorianToHijri(now, locale).formatted;
                } catch {
                    hijriValue = formatGregorianDate(now, locale);
                }
            }
            return hijriValue;
        })
        .replace(TODAY_RE, () => {
            gregorianValue ??= formatGregorianDate(now, locale);
            return gregorianValue;
        });
}
