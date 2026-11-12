import { randomUUID } from 'node:crypto';
import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { buildUnsubscribeUrl } from './unsubscribe';
import { toHeaderSafeFilename } from './pdf-processor';
import { emailToolInfo, type EmailToolInfo } from './email-tools';
import { TRUSTPILOT_REVIEW_URL } from './review-prompt';

/** SES raw message limit is 10 MiB; stay under with encoding overhead. */
const MAX_ATTACHMENT_DECODED_BYTES = 9 * 1024 * 1024;
const MAX_RAW_MESSAGE_BYTES = 10 * 1024 * 1024;

/**
 * Longest attachment name we send, in UTF-8 bytes. 255 is the usual
 * filesystem limit, so a longer name would be cut on save anyway, and it keeps
 * the percent-encoded filename* line (at most 3 chars per byte) well under the
 * 998-octet line limit of RFC 5322.
 */
const MAX_FILENAME_BYTES = 255;

/** Replies need a real inbox: mail.blendpdf.com has no MX, so replying to From would bounce. */
const DEFAULT_REPLY_TO = 'contact@blendpdf.com';

export type EmailLocale = 'en' | 'ar' | 'fr' | 'es';

export type SesFileEmailConfig = {
  configured: boolean;
  region: string;
  from: string;
  replyTo: string;
  configurationSetName?: string;
};

export function getSesFileEmailConfig(): SesFileEmailConfig {
  const from = process.env.AWS_SES_FROM_EMAIL?.trim() ?? '';
  const region =
    process.env.AWS_SES_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'eu-north-1';
  const replyTo = (process.env.AWS_SES_REPLY_TO?.trim() || DEFAULT_REPLY_TO).replace(/[\r\n]+/g, '');

  if (!from) {
    return { configured: false, region, from: '', replyTo };
  }

  return {
    configured: true,
    region,
    from,
    replyTo,
    configurationSetName: process.env.AWS_SES_CONFIGURATION_SET?.trim() || undefined,
  };
}

/**
 * The name the recipient sees, kept in its own script (Arabic included).
 * Takes the last path segment, drops control and bidi-override characters
 * (an override can disguise "exe" as "pdf"), replaces lone surrogates (they
 * have no UTF-8 form, and encodeURIComponent throws on them), and caps the
 * length at MAX_FILENAME_BYTES by cutting the stem, never the extension.
 */
function cleanFilename(name: string): string {
  const base = (name.split(/[/\\]/).pop() ?? '')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g, (m) => (m.length === 2 ? m : '�'))
    .replace(/[\x00-\x1F\x7F-\x9F‪-‮⁦-⁩]+/g, '')
    .trim();
  if (!base) {
    return 'attachment';
  }
  if (Buffer.byteLength(base, 'utf8') <= MAX_FILENAME_BYTES) {
    return base;
  }

  const ext = base.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? '';
  let budget = MAX_FILENAME_BYTES - ext.length;
  let stem = '';
  // Iterating a string walks code points, so a cut never lands mid-character
  for (const ch of base.slice(0, base.length - ext.length)) {
    budget -= Buffer.byteLength(ch, 'utf8');
    if (budget < 0) break;
    stem += ch;
  }
  return stem + ext;
}

/** Printable ASCII with nothing that needs escaping inside a quoted parameter. */
function isPlainAsciiName(name: string): boolean {
  return /^[\x20-\x7E]+$/.test(name) && !/["\\]/.test(name);
}

/**
 * ASCII stand-in for clients that ignore filename*. An ASCII name only loses
 * its quotes and backslashes ("report (1).pdf" stays whole); a non-ASCII name
 * goes through toHeaderSafeFilename, so an all-Arabic one becomes "file.pdf",
 * not "_.pdf". No extension means plain "file", not a guessed ".pdf".
 */
function asciiFallbackFilename(name: string): string {
  if (/^[\x20-\x7E]+$/.test(name)) {
    return name.replace(/["\\]/g, '').trim() || 'file';
  }
  const ext = name.match(/\.[A-Za-z0-9]{1,10}$/)?.[0] ?? '';
  return toHeaderSafeFilename(name, `file${ext}`);
}

/** RFC 5987 value-chars: encodeURIComponent leaves ' ( ) * bare, and those are not attr-chars. */
function percentEncodeAttrValue(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * RFC 2231 name parameter pair, each half on its own folded line: the real
 * UTF-8 name, then a quoted ASCII fallback for clients that ignore name*.
 * The UTF-8 half goes first because parsers that keep the first of two
 * same-named parameters (Python's email package among them) would otherwise
 * show "file.pdf"; parsers that prefer name* do so in either order.
 * A plain ASCII name needs no name* half and is sent alone, exactly as is.
 */
function nameParams(param: 'name' | 'filename', name: string): string {
  if (isPlainAsciiName(name)) {
    return `;\r\n ${param}="${name}"`;
  }
  return (
    `;\r\n ${param}*=UTF-8''${percentEncodeAttrValue(name)}` +
    `;\r\n ${param}="${asciiFallbackFilename(name)}"`
  );
}

/**
 * Encode a header value per RFC 2047 when it is not plain ASCII. A line that
 * holds an encoded-word may be 76 chars (RFC 2047 section 2), and the first
 * word shares its line with "Subject: " (9). "=?UTF-8?B?" + "?=" is 12, so a
 * 39-byte chunk (52 chars of base64) makes a 64-char word: 73 on the first
 * line, 65 on each folded one. Chunks are cut on code points so no word ends
 * inside a multi-byte character (some clients decode each word on its own).
 * Words are folded with CRLF + space, which decoders drop between words.
 */
function encodeHeaderValue(value: string): string {
  // "=?" in a plain value would itself be decoded as an encoded-word
  if (!/[^\x20-\x7E]/.test(value) && !value.includes('=?')) {
    return value;
  }

  const MAX_WORD_BYTES = 39;
  const chunks: string[] = [];
  let chunk = '';
  let chunkBytes = 0;
  for (const ch of value) {
    const n = Buffer.byteLength(ch, 'utf8');
    if (chunk && chunkBytes + n > MAX_WORD_BYTES) {
      chunks.push(chunk);
      chunk = '';
      chunkBytes = 0;
    }
    chunk += ch;
    chunkBytes += n;
  }
  if (chunk) chunks.push(chunk);

  return chunks
    .map((c) => `=?UTF-8?B?${Buffer.from(c, 'utf8').toString('base64')}?=`)
    .join('\r\n ');
}

/**
 * The only attachments the file email carries: what the tools make, each
 * recognised by its extension and its first bytes. The MIME type comes from
 * this table, never from the client, so nobody can use the route to mail an
 * HTML page or a program from our domain (security review, 2026-11-12).
 */
const ATTACHMENT_TYPES: Readonly<Record<string, { mime: string; starts: string | null }>> = {
  pdf: { mime: 'application/pdf', starts: '%PDF' },
  docx: { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', starts: 'PK\x03\x04' },
  xlsx: { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', starts: 'PK\x03\x04' },
  zip: { mime: 'application/zip', starts: 'PK\x03\x04' },
  // pdf-to-text; checked as UTF-8 with no NUL below, so no binary hides behind .txt
  txt: { mime: 'text/plain; charset=utf-8', starts: null },
};

export class AttachmentNotAllowedError extends Error {
  constructor() {
    super('Only files made by the tools can be emailed');
    this.name = 'AttachmentNotAllowedError';
  }
}

/**
 * The attachment as it will be sent (cleaned name, MIME type), or null when
 * it isn't a kind of file the tools make.
 */
export function emailAttachment(filename: string, base64: string): { name: string; mime: string } | null {
  const name = cleanFilename(filename);
  const ext = /\.([A-Za-z0-9]{1,10})$/.exec(name)?.[1].toLowerCase();
  const kind = ext ? ATTACHMENT_TYPES[ext] : undefined;
  if (!kind) return null;
  const clean = base64.replace(/\s/g, '');
  if (kind.starts !== null) {
    const head = Buffer.from(clean.slice(0, 16), 'base64').toString('latin1');
    return head.startsWith(kind.starts) ? { name, mime: kind.mime } : null;
  }
  const bytes = Buffer.from(clean, 'base64');
  if (bytes.includes(0)) return null;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  return { name, mime: kind.mime };
}

function foldBase64(b64: string): string {
  const clean = b64.replace(/\s/g, '');
  const lines: string[] = [];
  for (let i = 0; i < clean.length; i += 76) {
    lines.push(clean.slice(i, i + 76));
  }
  return lines.join('\r\n');
}

function decodedBase64Length(b64: string): number {
  const clean = b64.replace(/\s/g, '');
  let len = Math.floor((clean.length * 3) / 4);
  if (clean.endsWith('==')) len -= 2;
  else if (clean.endsWith('=')) len -= 1;
  return len;
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );
}

type EmailCopy = {
  /** The file name as it should appear inside this language's sentences. */
  showName: (name: string) => string;
  /**
   * Never the file name: the subject is what a recipient sees first, and the
   * name is whatever the sender typed (security review, 2026-11-12).
   */
  subject: string;
  attached: (name: string) => string;
  madeWith: (tool: string) => string;
  keep: string;
  alsoFree: string;
  review: string;
  reply: string;
  why: string;
  unsubscribe: string;
};

function emailCopy(locale: EmailLocale, product: string): EmailCopy {
  if (locale === 'ar') {
    // FSI...PDI isolate the name from the RTL sentence, and LRI...PDI keep its
    // Latin tail ("2024.pdf", ".pdf") in one left-to-right piece: without that,
    // "تقرير 2024.pdf" shows as "تقرير pdf.2024". cleanFilename strips any the user sent.
    const showName = (s: string) =>
      `\u2068${s.replace(/[\x21-\x7E]*\.[A-Za-z0-9]{1,10}$/, (tail) => `\u2066${tail}\u2069`)}\u2069`;
    return {
      showName,
      subject: `ملفك من ${product}`,
      attached: (n) => `ملفك «${n}» مرفق بهذه الرسالة.`,
      madeWith: (tool) => `استخدمت أداة ${tool}، وتجدها هنا متى احتجتها مجددًا:`,
      keep: `احتفظ بهذه الرسالة إن احتجت الملف لاحقًا، فنحن لا نحتفظ بنسخة منه، وكل ملف يُرفع إلى ${product} يُحذف خلال ساعة.`,
      alsoFree: 'أدوات أخرى مجانية ومن دون تسجيل:',
      review: 'هل جاء الملف كما أردت؟ رأيك الصريح على Trustpilot، إيجابيًا كان أو سلبيًا، يساعد غيرك على الاختيار:',
      reply: 'هل في الملف مشكلة؟ ردّ على هذه الرسالة وأخبرنا.',
      why: `وصلتك هذه الرسالة لأنك طلبت من ${product} إرسال ملف إلى بريدك.`,
      unsubscribe: `إلغاء الاشتراك في رسائل ${product}`,
    };
  }
  if (locale === 'fr') {
    // \u00a0 / \u202f: the no-break spaces French puts before : ? and inside « »
    return {
      showName: (n) => n,
      subject: `Votre fichier ${product}`,
      attached: (n) => `Votre fichier «\u202f${n}\u202f» est joint à ce courriel.`,
      madeWith: (tool) => `Vous avez utilisé l’outil «\u202f${tool}\u202f». Pour y revenir\u00a0:`,
      keep: `Conservez ce courriel si vous avez encore besoin du fichier. Nous n’en gardons aucune copie\u00a0: tout fichier importé sur ${product} est supprimé dans l’heure.`,
      alsoFree: 'Autres outils gratuits, sans inscription\u00a0:',
      review: 'Le résultat vous convient-il\u202f? Un avis sincère sur Trustpilot, positif ou négatif, aide d’autres personnes à choisir\u00a0:',
      reply: 'Un problème avec le fichier\u202f? Répondez à ce courriel pour nous le signaler.',
      why: `Vous recevez ce message parce que vous avez demandé à ${product} de vous envoyer un fichier par courriel.`,
      unsubscribe: `Se désabonner des courriels de ${product}`,
    };
  }
  if (locale === 'es') {
    return {
      showName: (n) => n,
      subject: `Su archivo de ${product}`,
      attached: (n) => `Le enviamos adjunto su archivo “${n}”.`,
      madeWith: (tool) => `Archivo creado con la herramienta ${tool}. La próxima vez, empiece aquí:`,
      keep: `Conserve este correo si va a necesitar el archivo más adelante. No guardamos ninguna copia: todo lo que se sube a ${product} se elimina en menos de una hora.`,
      alsoFree: 'Otras herramientas gratis, sin registrarse:',
      review: '¿El archivo quedó como usted quería? Una opinión sincera en Trustpilot, buena o mala, ayuda a otras personas a decidir:',
      reply: '¿Hay algún problema con el archivo? Responda a este correo y cuéntenos.',
      why: `Recibe este mensaje porque pidió a ${product} que le enviara un archivo por correo electrónico.`,
      unsubscribe: `Dejar de recibir correos de ${product}`,
    };
  }
  return {
    showName: (n) => n,
    subject: `Your ${product} file`,
    attached: (n) => `Your file "${n}" is attached.`,
    madeWith: (tool) => `Made with ${tool}. Next time, start here:`,
    keep: `Hang on to this email if you'll need the file again. We don't keep it: anything uploaded to ${product} is deleted within an hour.`,
    alsoFree: 'Also free, no sign-up:',
    review: 'Did it come out the way you wanted? An honest review on Trustpilot, good or bad, helps other people decide:',
    reply: 'Something wrong with the file? Reply to this email and tell us.',
    why: `You are getting this because you asked ${product} to email you a file.`,
    unsubscribe: `Unsubscribe from ${product} emails`,
  };
}

type BodyParams = {
  locale: EmailLocale;
  product: string;
  copy: EmailCopy;
  name: string;
  siteUrl: string;
  unsubscribeUrl: string;
  /** The tool that made the file, when the page told us; the email reads fine without it. */
  tool: EmailToolInfo | null;
};

/** "blendpdf.com/compress-pdf", without scheme or tracking parameters. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\?.*$/, '');
}

function textBody({ copy, name, siteUrl, unsubscribeUrl, tool }: BodyParams): string {
  return [
    copy.attached(copy.showName(name)),
    '',
    ...(tool ? [copy.madeWith(tool.tool.name), tool.tool.url, ''] : []),
    copy.keep,
    '',
    ...(tool
      ? [copy.alsoFree, ...tool.next.map((t) => `${t.name}: ${t.url}`), '']
      : []),
    copy.review,
    TRUSTPILOT_REVIEW_URL,
    '',
    copy.reply,
    '',
    siteUrl,
    '',
    '--',
    copy.why,
    `${copy.unsubscribe}: ${unsubscribeUrl}`,
  ].join('\r\n');
}

/**
 * Email-safe HTML: nested tables, inline styles only, no images or external
 * resources. Brand orange appears on the wordmark and the link back to the tool.
 */
function htmlBody({ locale, product, copy, name, siteUrl, unsubscribeUrl, tool }: BodyParams): string {
  const rtl = locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const font = rtl
    ? 'Tahoma, Arial, sans-serif'
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  const base = `font-family:${font};text-align:${align};`;
  const body = `${base}font-size:16px;line-height:24px;color:#2D2D2D;`;
  const small = `${base}font-size:13px;line-height:20px;color:#6B7280;`;
  const table = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"';
  const link = (href: string, text: string, color = '#2D2D2D') =>
    `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:underline;">${escapeHtml(text)}</a>`;
  const row = (content: string, style = body, pad = '16px 24px 0 24px') =>
    `<tr><td style="padding:${pad};${style}">${content}</td></tr>`;

  return [
    '<!DOCTYPE html>',
    `<html lang="${locale}" dir="${dir}">`,
    '<head>',
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(copy.subject)}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background-color:#F4F4F5;">',
    `<table ${table} dir="${dir}" style="background-color:#F4F4F5;">`,
    '<tr><td align="center" style="padding:24px 12px;">',
    // Outlook for Windows ignores max-width, so it gets a fixed 560px wrapper
    '<!--[if mso]><table role="presentation" width="560" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->',
    `<table ${table} dir="${dir}" style="max-width:560px;background-color:#FFFFFF;border:1px solid #E4E4E7;border-radius:8px;">`,
    row(escapeHtml(product), `${base}font-size:22px;line-height:28px;font-weight:700;color:#FF6B35;`, '24px 24px 0 24px'),
    row(copy.attached(`<strong>${escapeHtml(copy.showName(name))}</strong>`)),
    ...(tool
      ? [row(`${escapeHtml(copy.madeWith(tool.tool.name))}<br>${link(tool.tool.url, displayUrl(tool.tool.url), '#FF6B35')}`)]
      : []),
    row(escapeHtml(copy.keep)),
    ...(tool
      ? [row(`${escapeHtml(copy.alsoFree)} ${tool.next.map((t) => link(t.url, t.name)).join(' &middot; ')}`)]
      : []),
    row(`${escapeHtml(copy.review)}<br>${link(TRUSTPILOT_REVIEW_URL, displayUrl(TRUSTPILOT_REVIEW_URL), '#FF6B35')}`),
    row(escapeHtml(copy.reply), body, '16px 24px 24px 24px'),
    row(
      `${escapeHtml(copy.why)}<br>${link(unsubscribeUrl, copy.unsubscribe, '#6B7280')}<br>${link(siteUrl, displayUrl(siteUrl), '#6B7280')}`,
      `border-top:1px solid #E4E4E7;${small}`,
      '16px 24px 24px 24px'
    ),
    '</table>',
    '<!--[if mso]></td></tr></table><![endif]-->',
    '</td></tr>',
    '</table>',
    '</body>',
    '</html>',
  ].join('\r\n');
}

/** A text part as UTF-8 base64, so neither Arabic nor long lines depend on 8-bit transport. */
function textPart(contentType: string, body: string): string[] {
  return [
    `Content-Type: ${contentType}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(Buffer.from(body, 'utf8').toString('base64')),
  ];
}

/**
 * multipart/mixed [ multipart/alternative [ text/plain, text/html ], attachment ].
 * Every header is ASCII (RFC 2047 subject, RFC 2231 filename) and every body
 * is base64, so the message is 7-bit clean and no line exceeds 998 octets.
 */
function buildRawMimeMessage(params: {
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  filename: string;
  mimeType: string;
  attachmentBase64: string;
  unsubscribeUrl?: string;
}): Buffer {
  const boundary = `=_blendpdf_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const mixed = `${boundary}_m`;
  const alt = `${boundary}_a`;
  const crlf = '\r\n';

  const parts = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Reply-To: ${params.replyTo}`,
    `Subject: ${encodeHeaderValue(params.subject)}`,
    // HTTPS only: mail.blendpdf.com has no MX, so a mailto: unsubscribe would bounce
    ...(params.unsubscribeUrl ? [`List-Unsubscribe: <${params.unsubscribeUrl}>`] : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    '',
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alt}"`,
    '',
    `--${alt}`,
    ...textPart('text/plain', params.textBody),
    `--${alt}`,
    ...textPart('text/html', params.htmlBody),
    `--${alt}--`,
    '',
    `--${mixed}`,
    `Content-Type: ${params.mimeType}${nameParams('name', params.filename)}`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment${nameParams('filename', params.filename)}`,
    '',
    foldBase64(params.attachmentBase64),
    `--${mixed}--`,
  ];

  return Buffer.from(parts.join(crlf), 'utf-8');
}

export class FileTooLargeForEmailError extends Error {
  code = 'FILE_TOO_LARGE' as const;
  constructor() {
    super('Attachment exceeds the maximum size for email delivery');
    this.name = 'FileTooLargeForEmailError';
  }
}

/**
 * Sends a single attachment to the recipient using SES SendRawEmail, in the
 * language of the page the user was on.
 * Requires verified `AWS_SES_FROM_EMAIL` and IAM permission `ses:SendRawEmail`.
 */
export async function sendFileEmailViaSes(options: {
  to: string;
  filename: string;
  /** What the browser said the file is. Ignored: the type comes from emailAttachment. */
  fileType?: string;
  fileDataBase64: string;
  locale?: EmailLocale;
  /** Route slug of the tool that made the file (e.g. "compress-pdf"); unknown values are ignored. */
  tool?: string;
}): Promise<void> {
  const cfg = getSesFileEmailConfig();
  if (!cfg.configured) {
    throw new Error('SES is not configured (set AWS_SES_FROM_EMAIL)');
  }

  const cleanB64 = options.fileDataBase64.replace(/\s/g, '');
  if (decodedBase64Length(cleanB64) > MAX_ATTACHMENT_DECODED_BYTES) {
    throw new FileTooLargeForEmailError();
  }

  const attachment = emailAttachment(options.filename, cleanB64);
  if (!attachment) throw new AttachmentNotAllowedError();

  const locale: EmailLocale = options.locale === 'ar' || options.locale === 'fr' || options.locale === 'es' ? options.locale : 'en';
  const { name } = attachment;
  const product =
    process.env.EMAIL_BRAND_NAME?.trim() || process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'BlendPDF';
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://blendpdf.com').replace(/\/$/, '');
  // en lives at the unprefixed root, the others under /<locale> (same as the site's canonical URLs)
  const siteUrl = locale === 'en' ? baseUrl : `${baseUrl}/${locale}`;
  const unsubscribeUrl = buildUnsubscribeUrl(options.to);
  const copy = emailCopy(locale, product);
  const tool = emailToolInfo(options.tool, locale, siteUrl);
  const body: BodyParams = { locale, product, copy, name, siteUrl, unsubscribeUrl, tool };

  const raw = buildRawMimeMessage({
    from: cfg.from,
    to: options.to,
    replyTo: cfg.replyTo,
    subject: copy.subject,
    textBody: textBody(body),
    htmlBody: htmlBody(body),
    filename: name,
    mimeType: attachment.mime,
    attachmentBase64: cleanB64,
    unsubscribeUrl,
  });

  if (raw.length > MAX_RAW_MESSAGE_BYTES) {
    throw new FileTooLargeForEmailError();
  }

  const client = new SESClient({ region: cfg.region });
  await client.send(
    new SendRawEmailCommand({
      Source: cfg.from,
      Destinations: [options.to],
      RawMessage: { Data: raw },
      ...(cfg.configurationSetName
        ? { ConfigurationSetName: cfg.configurationSetName }
        : {}),
    })
  );
}

/**
 * Tells Trustpilot's Automatic Feedback Service (AFS) that this address just
 * got a file, so Trustpilot sends its own verified review invitation after the
 * delay set in Trustpilot Business. A separate email rather than a BCC on the
 * file email, so Trustpilot gets the address and never the user's document.
 * Every file email triggers one, so nobody is picked. TRUSTPILOT_AFS_EMAIL
 * unset means off.
 */
export async function sendTrustpilotInviteTrigger(to: string, siteLocale: EmailLocale = 'en'): Promise<boolean> {
  const afs = process.env.TRUSTPILOT_AFS_EMAIL?.trim();
  const cfg = getSesFileEmailConfig();
  if (!afs || !cfg.configured) return false;

  const snippet = JSON.stringify({
    // We don't collect names; this fills the template's greeting
    recipientName: 'BlendPDF user',
    recipientEmail: to,
    referenceId: randomUUID(),
    // Without it Trustpilot falls back to the account's default language,
    // which came up Spanish. French pages get French; Trustpilot has no
    // Arabic, so Arabic and English pages get English.
    locale: siteLocale === 'fr' ? 'fr-FR' : siteLocale === 'es' ? 'es-ES' : 'en-US',
  });
  await new SESClient({ region: cfg.region }).send(
    new SendEmailCommand({
      Source: cfg.from,
      Destination: { ToAddresses: [afs] },
      Message: {
        Subject: { Data: 'BlendPDF file delivered', Charset: 'UTF-8' },
        Body: {
          Html: { Data: `<script type="application/json+trustpilot">${snippet}</script>`, Charset: 'UTF-8' },
          Text: { Data: snippet, Charset: 'UTF-8' },
        },
      },
      ...(cfg.configurationSetName ? { ConfigurationSetName: cfg.configurationSetName } : {}),
    }),
  );
  return true;
}
