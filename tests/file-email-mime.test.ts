import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { sendFileByEmail } from '../lib/send-file-by-email';
import { sendFileEmailViaSes } from '../lib/send-file-email-ses';
import { EMAIL_TOOL_SLUGS, emailToolInfo } from '../lib/email-tools';

/**
 * The "Send to my email" message, parsed the way a mail client would. Before
 * this, an all-Arabic file name arrived as "_.pdf" (attachment and subject),
 * the body was English-only plain text, and replies went to a subdomain with
 * no MX. Nothing here talks to SES: the client is mocked and the raw MIME
 * bytes are inspected.
 */

const sesSends: Buffer[] = [];
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    async send(cmd: { input: { RawMessage: { Data: Uint8Array } } }) {
      sesSends.push(Buffer.from(cmd.input.RawMessage.Data));
      return { MessageId: 'test' };
    }
  },
  SendRawEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

const ARABIC_NAME = 'تقرير المبيعات.pdf';
const PDF_B64 = 'JVBERi0xLjQK';

async function send(filename: string, locale?: 'en' | 'ar', fileType = 'application/pdf'): Promise<string> {
  sesSends.length = 0;
  await sendFileEmailViaSes({ to: 'a@b.co', filename, fileType, fileDataBase64: PDF_B64, locale });
  expect(sesSends).toHaveLength(1);
  return sesSends[0].toString('utf8');
}

// --- a minimal MIME reader -------------------------------------------------

function split(entity: string): { headers: string; body: string } {
  const i = entity.indexOf('\r\n\r\n');
  return { headers: entity.slice(0, i), body: entity.slice(i + 4) };
}

/** Unfolded value of a header, or undefined. */
function header(headers: string, name: string): string | undefined {
  const line = headers
    .replace(/\r\n(?=[ \t])/g, '')
    .split('\r\n')
    .find((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`));
  return line?.slice(name.length + 1).trim();
}

/** RFC 2231 `name*=UTF-8''...` if present, else the quoted `name="..."`. */
function param(value: string, name: string, extended: boolean): string | undefined {
  if (extended) {
    const m = value.match(new RegExp(`;\\s*${name}\\*=UTF-8''([^;\\s]+)`, 'i'));
    return m ? decodeURIComponent(m[1]) : undefined;
  }
  return value.match(new RegExp(`;\\s*${name}="([^"]*)"`, 'i'))?.[1];
}

/** Body parts of a multipart entity, in order. */
function parts(entity: string): string[] {
  const { headers, body } = split(entity);
  const boundary = header(headers, 'Content-Type')!.match(/boundary="([^"]+)"/)![1];
  const segments = `\r\n${body}`.split(`\r\n--${boundary}`);
  expect(segments[segments.length - 1].startsWith('--')).toBe(true);
  return segments.slice(1, -1).map((s) => s.replace(/^\r\n/, ''));
}

function decodedBody(part: string): string {
  return Buffer.from(split(part).body.replace(/\r\n/g, ''), 'base64').toString('utf8');
}

const ENCODED_WORD = /=\?UTF-8\?B\?([A-Za-z0-9+/=]*)\?=/gi;

/** RFC 2047 section 2: every header line holding an encoded-word is at most 76 chars, its field name included. */
function expectEncodedLinesWithin76(headers: string): void {
  const lines = headers.split('\r\n').filter((l) => l.includes('=?'));
  expect(lines.length).toBeGreaterThan(0);
  for (const line of lines) {
    expect(line.length).toBeLessThanOrEqual(76);
  }
}

/** A name in RTL copy: FSI ... PDI around it, LRI ... PDI around its Latin tail ("2024.pdf"). */
const isolated = (name: string) =>
  `\u2068${name.replace(/[\x21-\x7E]*\.[A-Za-z0-9]{1,10}$/, (t) => `\u2066${t}\u2069`)}\u2069`;

/** RFC 2047 decoder: whitespace between adjacent encoded-words is dropped, the bytes are joined. */
function decode2047(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/(?:=\?UTF-8\?B\?[A-Za-z0-9+/=]*\?=)+/gi, (run) =>
      Buffer.concat([...run.matchAll(ENCODED_WORD)].map((m) => Buffer.from(m[1], 'base64'))).toString('utf8')
    );
}

function message(raw: string) {
  const { headers } = split(raw);
  const [alternative, attachment] = parts(raw);
  const [plain, html] = parts(alternative);
  return { headers, alternative, attachment, plain, html };
}

// ---------------------------------------------------------------------------

describe('file email MIME message', () => {
  beforeEach(() => {
    process.env.AWS_SES_FROM_EMAIL = 'BlendPDF <files@mail.blendpdf.com>';
  });
  afterEach(() => {
    delete process.env.AWS_SES_FROM_EMAIL;
    delete process.env.AWS_SES_REPLY_TO;
  });

  it('sets Reply-To to a real inbox, overridable by env', async () => {
    expect(header(split(await send('x.pdf')).headers, 'Reply-To')).toBe('contact@blendpdf.com');
    process.env.AWS_SES_REPLY_TO = 'help@example.com';
    expect(header(split(await send('x.pdf')).headers, 'Reply-To')).toBe('help@example.com');
  });

  it('delivers an Arabic file name intact, with a readable ASCII fallback', async () => {
    const { attachment } = message(await send(ARABIC_NAME, 'ar'));
    const { headers } = split(attachment);
    const disposition = header(headers, 'Content-Disposition')!;
    const type = header(headers, 'Content-Type')!;

    expect(disposition.startsWith('attachment;')).toBe(true);
    expect(param(disposition, 'filename', true)).toBe(ARABIC_NAME);
    expect(param(type, 'name', true)).toBe(ARABIC_NAME);
    for (const fallback of [param(disposition, 'filename', false), param(type, 'name', false)]) {
      expect(fallback).toBe('file.pdf');
      expect(fallback).not.toBe('_.pdf');
    }
    // First-wins parsers (Python's email package) must meet the UTF-8 name before the fallback
    expect(disposition.indexOf('filename*=')).toBeLessThan(disposition.indexOf('filename="'));
    expect(type.indexOf('name*=')).toBeLessThan(type.indexOf('name="'));
  });

  it('percent-encodes the RFC 5987 characters encodeURIComponent leaves alone', async () => {
    const name = "تقرير it's (final)*.pdf";
    const disposition = header(split(message(await send(name)).attachment).headers, 'Content-Disposition')!;
    const raw = disposition.match(/filename\*=UTF-8''([^;\s]+)/)![1];
    expect(raw).toMatch(/^[A-Za-z0-9!#$&+\-.^_`|~%]+$/);
    expect(decodeURIComponent(raw)).toBe(name);
  });

  it.each([
    ['en', `Your BlendPDF file: ${ARABIC_NAME}`],
    ['ar', `ملفك من BlendPDF: ${isolated(ARABIC_NAME)}`],
  ] as const)('localizes and RFC 2047-encodes the subject (%s)', async (locale, expected) => {
    const { headers } = split(await send(ARABIC_NAME, locale));
    const subject = header(headers, 'Subject')!;
    expect(subject).not.toMatch(/[^\x20-\x7E]/);
    expectEncodedLinesWithin76(headers);
    expect(decode2047(subject)).toBe(expected);
    // Each word is within the 75-char limit and decodes on its own: no character was cut in half
    const words = subject.match(ENCODED_WORD)!;
    expect(words.length).toBeGreaterThan(1);
    for (const w of words) {
      expect(w.length).toBeLessThanOrEqual(75);
      expect(decode2047(w)).not.toContain('\uFFFD');
    }
  });

  // The Arabic subjects above happen to put every 45-byte cut on a character
  // boundary; 3- and 4-byte characters do not, so they prove the chunking
  it.each([
    ['CJK', `${'報告書'.repeat(10)}.pdf`],
    ['emoji', `${'\u{1F600}'.repeat(20)}.pdf`],
  ])('never cuts a multi-byte character across encoded-words (%s)', async (_label, name) => {
    for (const locale of ['en', 'ar'] as const) {
      const { headers } = split(await send(name, locale));
      const subject = header(headers, 'Subject')!;
      for (const w of subject.match(ENCODED_WORD)!) {
        expect(w.length).toBeLessThanOrEqual(75);
        expect(decode2047(w)).not.toContain('�');
      }
      expectEncodedLinesWithin76(headers);
      expect(decode2047(subject).endsWith(locale === 'ar' ? isolated(name) : name)).toBe(true);
    }
  });

  it('leaves a plain ASCII subject unencoded', async () => {
    expect(header(split(await send('report.pdf')).headers, 'Subject')).toBe('Your BlendPDF file: report.pdf');
  });

  it('writes the Arabic email right-to-left, in Arabic, in both parts', async () => {
    const { plain, html } = message(await send(ARABIC_NAME, 'ar'));
    const text = decodedBody(plain);
    expect(text).toContain(`ملفك «${isolated(ARABIC_NAME)}» مرفق بهذه الرسالة.`);
    expect(text).toContain('https://blendpdf.com/ar');
    expect(text).toMatch(/إلغاء الاشتراك في رسائل BlendPDF: https:\/\/\S+\/api\/unsubscribe\?/);
    const markup = decodedBody(html);
    expect(markup).toContain('<html lang="ar" dir="rtl">');
    expect(markup).toContain('dir="rtl"');
    expect(markup).toContain('font-family:Tahoma, Arial');
    expect(markup).toContain(isolated(ARABIC_NAME));
  });

  // In RTL text "2024.pdf" would show as "pdf.2024" unless the name is isolated
  it('isolates the file name from the Arabic sentence in the text, html and subject', async () => {
    const name = '2024-report.pdf';
    const raw = await send(name, 'ar');
    const { plain, html } = message(raw);
    expect(decodedBody(plain)).toContain(`«${isolated(name)}»`);
    expect(decodedBody(html)).toContain(`<strong>${isolated(name)}</strong>`);
    expect(decode2047(header(split(raw).headers, 'Subject')!)).toBe(`ملفك من BlendPDF: ${isolated(name)}`);
    // The attachment name itself carries no bidi marks
    expect(param(header(split(message(raw).attachment).headers, 'Content-Disposition')!, 'filename', false)).toBe(name);
  });

  it('writes the English email left-to-right', async () => {
    const { plain, html } = message(await send('report.pdf', 'en'));
    expect(decodedBody(plain)).toContain('Your file "report.pdf" is attached.');
    expect(decodedBody(html)).toContain('<html lang="en" dir="ltr">');
    expect(decodedBody(html)).not.toContain('rtl');
  });

  it('escapes the file name in the HTML part and keeps the page self-contained', async () => {
    const markup = decodedBody(message(await send('a<img src=x onerror=1>&"q".pdf')).html);
    expect(markup).toContain('a&lt;img src=x onerror=1&gt;&amp;&quot;q&quot;.pdf');
    expect(markup).not.toContain('<img');
    expect(markup).not.toMatch(/<(script|link|style)\b/i);
    expect(markup).not.toMatch(/src=["']?https?:/i);
  });

  it('gives Outlook for Windows, which ignores max-width, a fixed-width card', async () => {
    const markup = decodedBody(message(await send('report.pdf')).html);
    expect(markup).toContain('max-width:560px');
    expect(markup).toMatch(/<!--\[if mso\]><table role="presentation" width="560" align="center"[^>]*><tr><td><!\[endif\]-->/);
    expect(markup).toContain('<!--[if mso]></td></tr></table><![endif]-->');
  });

  it.each([
    ['an Arabic name', ARABIC_NAME],
    ['a 2000-character Arabic name', `${'ملف'.repeat(667)}.pdf`],
    ['a 2000-character emoji name', `${'\u{1F600}'.repeat(1000)}.pdf`],
  ])('keeps every line within 998 octets, CRLF only, for %s', async (_label, name) => {
    for (const locale of ['en', 'ar'] as const) {
      const raw = await send(name, locale);
      expect(raw).not.toMatch(/\r(?!\n)|(?<!\r)\n/);
      for (const line of raw.split('\r\n')) {
        expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(998);
      }
    }
  });

  it('cuts an overlong name at the stem and keeps the extension', async () => {
    const disposition = header(split(message(await send(`${'ملف'.repeat(667)}.pdf`)).attachment).headers, 'Content-Disposition')!;
    const name = param(disposition, 'filename', true)!;
    expect(name.endsWith('.pdf')).toBe(true);
    expect(name.startsWith('ملف')).toBe(true);
    expect(Buffer.byteLength(name, 'utf8')).toBeLessThanOrEqual(255);
    expect(name).not.toContain('\uFFFD');
  });

  it('strips path segments and bidi overrides that could disguise the extension', async () => {
    const disposition = header(split(message(await send('C:\\Users\\me\\invoice\u202Efdp.exe')).attachment).headers, 'Content-Disposition')!;
    expect(param(disposition, 'filename', false)).toBe('invoicefdp.exe');
  });

  // Browsers name a repeat download "report (1).pdf"; the old fallback trimmed it to "report (1.pdf"
  it.each(['report (1).pdf', 'report (final).pdf', 'Scan 2026-10-02 (2).pdf', '_draft.pdf', "it's (final)*.pdf"])(
    'sends a plain ASCII name exactly, as a single parameter (%s)',
    async (name) => {
      const { headers } = split(message(await send(name)).attachment);
      const disposition = header(headers, 'Content-Disposition')!;
      const type = header(headers, 'Content-Type')!;
      expect(param(disposition, 'filename', false)).toBe(name);
      expect(param(type, 'name', false)).toBe(name);
      expect(disposition).not.toContain('filename*=');
      expect(type).not.toContain('name*=');
    }
  );

  it('keeps an ASCII name with quotes whole in filename*, and only drops the quotes from the fallback', async () => {
    const name = 'my "final" (1).pdf';
    const disposition = header(split(message(await send(name)).attachment).headers, 'Content-Disposition')!;
    expect(param(disposition, 'filename', true)).toBe(name);
    expect(param(disposition, 'filename', false)).toBe('my final (1).pdf');
  });

  it('does not invent a .pdf extension for a non-ASCII name without one', async () => {
    const { headers } = split(message(await send('صور', 'ar', 'application/zip')).attachment);
    const disposition = header(headers, 'Content-Disposition')!;
    expect(param(disposition, 'filename', true)).toBe('صور');
    expect(param(disposition, 'filename', false)).toBe('file');
  });

  it('is multipart/mixed: alternative (plain, then html) plus exactly one attachment', async () => {
    const raw = await send(ARABIC_NAME, 'ar');
    const { headers, alternative, attachment, plain, html } = message(raw);
    expect(header(headers, 'Content-Type')).toMatch(/^multipart\/mixed; boundary="/);
    expect(parts(raw)).toHaveLength(2);
    expect(header(split(alternative).headers, 'Content-Type')).toMatch(/^multipart\/alternative; boundary="/);
    expect(parts(alternative)).toHaveLength(2);
    for (const [part, type] of [[plain, 'text/plain'], [html, 'text/html']]) {
      expect(header(split(part).headers, 'Content-Type')).toBe(`${type}; charset=UTF-8`);
      expect(header(split(part).headers, 'Content-Transfer-Encoding')).toBe('base64');
    }
    expect(raw.match(/^Content-Disposition: attachment/gim)).toHaveLength(1);
    expect(header(split(attachment).headers, 'Content-Type')!.startsWith('application/pdf;')).toBe(true);
    expect(split(attachment).body.replace(/\r\n/g, '')).toBe(PDF_B64);
  });

  it('refuses a client-supplied type that would inject header lines, keeps a simple charset param', async () => {
    const injected = message(await send('x.pdf', 'en', 'application/pdf\r\nX-Injected: 1'));
    expect(header(split(injected.attachment).headers, 'Content-Type')!.startsWith('application/octet-stream;')).toBe(true);
    expect(injected.attachment).not.toContain('X-Injected');
    const text = message(await send('x.txt', 'en', 'text/plain;charset=utf-8'));
    expect(header(split(text.attachment).headers, 'Content-Type')!.startsWith('text/plain;charset=utf-8;')).toBe(true);
  });
});

describe('sendFileByEmail locale', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any).document;
  });

  const pdf = () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });

  async function sentLocale(): Promise<string> {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendFileByEmail(pdf(), 'a.pdf', 'a@b.co');
    return JSON.parse(fetchMock.mock.calls[0][1].body).locale;
  }

  it.each([
    ['ar', 'ar'],
    ['ar-SA', 'ar'],
    ['en', 'en'],
    ['', 'en'],
  ])('sends <html lang="%s"> as locale %s', async (lang, expected) => {
    (globalThis as any).document = { documentElement: { lang } };
    expect(await sentLocale()).toBe(expected);
  });

  it('falls back to en without a document', async () => {
    expect(await sentLocale()).toBe('en');
  });
});

describe('Arabic file name display', () => {
  beforeEach(() => {
    process.env.AWS_SES_FROM_EMAIL = 'BlendPDF <files@mail.blendpdf.com>';
  });
  afterEach(() => {
    delete process.env.AWS_SES_FROM_EMAIL;
  });

  // Spelled out, not built with isolated(), so a change to the rule can't pass by changing both sides
  it.each([
    ['تقرير المبيعات 2024.pdf', '\u2068تقرير المبيعات \u20662024.pdf\u2069\u2069'],
    ['تقرير.pdf', '\u2068تقرير\u2066.pdf\u2069\u2069'],
    ['Q3-report.pdf', '\u2068\u2066Q3-report.pdf\u2069\u2069'],
    ['تقرير', '\u2068تقرير\u2069'],
  ])('keeps the Latin tail of %s in one left-to-right piece', async (name, shown) => {
    sesSends.length = 0;
    await sendFileEmailViaSes({ to: 'a@b.co', filename: name, fileType: 'application/pdf', fileDataBase64: PDF_B64, locale: 'ar' });
    const { plain } = message(sesSends[0].toString('utf8'));
    expect(decodedBody(plain)).toContain(`«${shown}»`);
  });
});

describe('file email tool links', () => {
  beforeEach(() => {
    process.env.AWS_SES_FROM_EMAIL = 'BlendPDF <files@mail.blendpdf.com>';
  });
  afterEach(() => {
    delete process.env.AWS_SES_FROM_EMAIL;
  });

  async function sendFrom(tool: string | undefined, locale: 'en' | 'ar' = 'en') {
    sesSends.length = 0;
    await sendFileEmailViaSes({ to: 'a@b.co', filename: 'x.pdf', fileType: 'application/pdf', fileDataBase64: PDF_B64, locale, tool });
    const { plain, html } = message(sesSends[0].toString('utf8'));
    return { text: decodedBody(plain), html: decodedBody(html) };
  }

  it('names the tool, links back to it and to two next tools, tagged for the access log', async () => {
    const { text, html } = await sendFrom('compress-pdf');
    expect(text).toContain('Made with Compress PDF.');
    expect(text).toContain('https://blendpdf.com/compress-pdf?utm_source=file-email&utm_medium=email&utm_campaign=compress-pdf&utm_content=same-tool');
    expect(text).toContain('Merge PDF: https://blendpdf.com/merge-pdf?utm_source=file-email');
    expect(text).toContain('Protect PDF: https://blendpdf.com/protect-pdf?utm_source=file-email');
    // The visible link text drops the scheme and the tracking parameters; & is escaped in the href
    expect(html).toContain('>blendpdf.com/compress-pdf</a>');
    expect(html).toContain('utm_medium=email&amp;utm_campaign=compress-pdf');
  });

  it('links the Arabic email to the Arabic pages, with the Arabic tool names', async () => {
    const { text } = await sendFrom('pdf-to-word', 'ar');
    expect(text).toContain('استخدمت أداة PDF إلى Word');
    expect(text).toContain('https://blendpdf.com/ar/pdf-to-word?utm_source=file-email');
    expect(text).toContain('Word إلى PDF: https://blendpdf.com/ar/word-to-pdf?');
  });

  it.each([undefined, 'home', 'merge-pdf"><script>', '__proto__', 'constructor'])(
    'leaves the tool lines out for an unknown tool (%s) but keeps the rest',
    async (tool) => {
      const { text, html } = await sendFrom(tool);
      expect(text).not.toContain('Made with');
      expect(text).not.toContain('utm_source');
      expect(html).not.toContain('<script>');
      expect(text).toContain('Something wrong with the file? Reply to this email');
      expect(text).toContain('deleted within an hour');
    }
  );

  it('knows a name in both languages for every tool and every suggestion', () => {
    for (const slug of EMAIL_TOOL_SLUGS) {
      for (const locale of ['en', 'ar'] as const) {
        const info = emailToolInfo(slug, locale, 'https://blendpdf.com')!;
        expect(info.next).toHaveLength(2);
        for (const link of [info.tool, ...info.next]) {
          expect(link.name, `${slug} ${locale}`).toMatch(/\S/);
        }
        expect(info.next.map((l) => l.url)).not.toContain(info.tool.url.replace('same-tool', 'next-tool'));
      }
    }
  });

  it('sends the page slug from the browser', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { pathname: '/ar/pdf-to-word' } });
    try {
      await sendFileByEmail(new Blob([new Uint8Array([0x25])]), 'a.pdf', 'a@b.co');
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).tool).toBe('pdf-to-word');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
