import { afterEach, describe, expect, it, vi } from 'vitest';

const sent: { input: Record<string, any> }[] = [];
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    async send(command: { input: Record<string, any> }) {
      sent.push(command);
    }
  },
  SendEmailCommand: class {
    constructor(public input: Record<string, any>) {}
  },
  SendRawEmailCommand: class {
    constructor(public input: Record<string, any>) {}
  },
}));

import { sendTrustpilotInviteTrigger } from '@/lib/send-file-email-ses';

afterEach(() => {
  vi.unstubAllEnvs();
  sent.length = 0;
});

describe('sendTrustpilotInviteTrigger', () => {
  it('is off until TRUSTPILOT_AFS_EMAIL is set', async () => {
    vi.stubEnv('AWS_SES_FROM_EMAIL', 'BlendPDF <files@mail.blendpdf.com>');
    vi.stubEnv('TRUSTPILOT_AFS_EMAIL', '');
    expect(await sendTrustpilotInviteTrigger('reader@example.com')).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('sends Trustpilot only the snippet: the address, never the file', async () => {
    vi.stubEnv('AWS_SES_FROM_EMAIL', 'BlendPDF <files@mail.blendpdf.com>');
    vi.stubEnv('TRUSTPILOT_AFS_EMAIL', 'blendpdf.com+test@invite.trustpilot.com');
    expect(await sendTrustpilotInviteTrigger('reader@example.com')).toBe(true);
    const input = sent[0].input;
    expect(input.Destination).toEqual({ ToAddresses: ['blendpdf.com+test@invite.trustpilot.com'] });
    const html: string = input.Message.Body.Html.Data;
    const json = JSON.parse(html.match(/^<script type="application\/json\+trustpilot">(.*)<\/script>$/)![1]);
    expect(json).toMatchObject({
      recipientEmail: 'reader@example.com',
      recipientName: 'BlendPDF user',
      locale: 'en-US',
    });
    expect(json.referenceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(input.RawMessage).toBeUndefined();
  });

  it('invites in French from a French page, and in English from Arabic or English ones', async () => {
    vi.stubEnv('AWS_SES_FROM_EMAIL', 'BlendPDF <files@mail.blendpdf.com>');
    vi.stubEnv('TRUSTPILOT_AFS_EMAIL', 'blendpdf.com+test@invite.trustpilot.com');
    for (const site of ['fr', 'ar', 'en'] as const) await sendTrustpilotInviteTrigger('reader@example.com', site);
    const locales = sent.map((c) => JSON.parse(c.input.Message.Body.Text.Data).locale);
    expect(locales).toEqual(['fr-FR', 'en-US', 'en-US']);
  });
});
