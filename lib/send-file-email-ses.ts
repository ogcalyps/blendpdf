import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { buildUnsubscribeUrl } from './unsubscribe';

/** SES raw message limit is 10 MiB; stay under with encoding overhead. */
const MAX_ATTACHMENT_DECODED_BYTES = 9 * 1024 * 1024;
const MAX_RAW_MESSAGE_BYTES = 10 * 1024 * 1024;

export type SesFileEmailConfig = {
  configured: boolean;
  region: string;
  from: string;
  configurationSetName?: string;
};

export function getSesFileEmailConfig(): SesFileEmailConfig {
  const from = process.env.AWS_SES_FROM_EMAIL?.trim() ?? '';
  const region =
    process.env.AWS_SES_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'eu-north-1';

  if (!from) {
    return { configured: false, region, from: '' };
  }

  return {
    configured: true,
    region,
    from,
    configurationSetName: process.env.AWS_SES_CONFIGURATION_SET?.trim() || undefined,
  };
}

function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'attachment';
  const ascii = base.replace(/[^\x20-\x7E]+/g, '_');
  return ascii.replace(/["\r\n]+/g, '_').slice(0, 200) || 'attachment';
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

function buildRawMimeMessage(params: {
  from: string;
  to: string;
  subject: string;
  textBody: string;
  filename: string;
  mimeType: string;
  attachmentBase64: string;
  unsubscribeUrl?: string;
}): Buffer {
  const filename = sanitizeFilename(params.filename);
  const boundary = `=_blendpdf_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  const folded = foldBase64(params.attachmentBase64);
  const crlf = '\r\n';

  const parts = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    ...(params.unsubscribeUrl
      ? [`List-Unsubscribe: <mailto:${params.from}?subject=unsubscribe>, <${params.unsubscribeUrl}>`]
      : []),
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.textBody,
    '',
    `--${boundary}`,
    `Content-Type: ${params.mimeType}; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    folded,
    '',
    `--${boundary}--`,
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
 * Sends a single attachment to the recipient using SES SendRawEmail.
 * Requires verified `AWS_SES_FROM_EMAIL` and IAM permission `ses:SendRawEmail`.
 */
export async function sendFileEmailViaSes(options: {
  to: string;
  filename: string;
  fileType: string;
  fileDataBase64: string;
}): Promise<void> {
  const cfg = getSesFileEmailConfig();
  if (!cfg.configured) {
    throw new Error('SES is not configured (set AWS_SES_FROM_EMAIL)');
  }

  const cleanB64 = options.fileDataBase64.replace(/\s/g, '');
  if (decodedBase64Length(cleanB64) > MAX_ATTACHMENT_DECODED_BYTES) {
    throw new FileTooLargeForEmailError();
  }

  const safeName = sanitizeFilename(options.filename);
  const product =
    process.env.EMAIL_BRAND_NAME?.trim() || process.env.NEXT_PUBLIC_SITE_NAME?.trim() || 'BlendPDF';
  const unsubscribeUrl = buildUnsubscribeUrl(options.to);

  const raw = buildRawMimeMessage({
    from: cfg.from,
    to: options.to,
    subject: `Your ${product} file: ${safeName}`,
    textBody:
      `Your processed file "${safeName}" is attached.\n\nThank you for using ${product}.\n\n` +
      `--\nUnsubscribe from ${product} emails at any time: ${unsubscribeUrl}`,
    filename: options.filename,
    mimeType: options.fileType?.trim() || 'application/octet-stream',
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
