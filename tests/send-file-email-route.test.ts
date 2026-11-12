/**
 * /api/send-file-email end to end (SES mocked): it only carries the tools'
 * file types, caps one address at a few files a day, and triggers the
 * Trustpilot invite once per address per day (security review, 2026-11-12).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const sesSends: string[] = [];
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    async send(cmd: { input: { RawMessage?: { Data: Uint8Array }; Destination?: { ToAddresses: string[] } } }) {
      sesSends.push(cmd.input.RawMessage ? Buffer.from(cmd.input.RawMessage.Data).toString('utf8') : `invite:${cmd.input.Destination?.ToAddresses[0]}`);
      return { MessageId: 'test' };
    }
  },
  SendRawEmailCommand: class {
    constructor(public input: unknown) {}
  },
  SendEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

import { POST } from '../app/api/send-file-email/route';
import { PER_RECIPIENT_PER_DAY, resetEmailSlots } from '../lib/email-send-caps';

const PDF_B64 = Buffer.from('%PDF-1.7\n').toString('base64');

function post(body: Record<string, unknown>, ip = '203.0.113.7') {
  return POST(
    new NextRequest('http://localhost/api/send-file-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': ip },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  process.env.AWS_SES_FROM_EMAIL = 'BlendPDF <files@mail.blendpdf.com>';
  process.env.AWS_REGION = 'eu-north-1';
  process.env.TRUSTPILOT_AFS_EMAIL = 'blendpdf.com+test@invite.trustpilot.com';
  sesSends.length = 0;
  resetEmailSlots();
});
afterEach(() => {
  delete process.env.AWS_SES_FROM_EMAIL;
  delete process.env.AWS_REGION;
  delete process.env.TRUSTPILOT_AFS_EMAIL;
});

describe('/api/send-file-email', () => {
  it('refuses a file the tools never make, without sending anything', async () => {
    const res = await post({ email: 'victim@example.com', filename: 'verify.html', fileType: 'text/html', fileData: Buffer.from('<html>').toString('base64') });
    expect(res.status).toBe(415);
    expect((await res.json()).errorCode).toBe('EMAIL_TYPE');
    expect(sesSends).toHaveLength(0);
  });

  it('sends a few files a day to one address, then 429s; the Trustpilot invite goes out once', async () => {
    for (let i = 0; i < PER_RECIPIENT_PER_DAY; i++) {
      // A different IP each time: rotating IPs must not get around the per-address cap
      const res = await post({ email: 'reader@example.com', filename: `r${i}.pdf`, fileType: 'application/pdf', fileData: PDF_B64 }, `203.0.113.${10 + i}`);
      expect(res.status).toBe(200);
    }
    const sixth = await post({ email: 'reader@example.com', filename: 'r9.pdf', fileType: 'application/pdf', fileData: PDF_B64 }, '203.0.113.99');
    expect(sixth.status).toBe(429);
    expect((await sixth.json()).errorCode).toBe('EMAIL_CAP');
    expect(sesSends.filter((s) => !s.startsWith('invite:'))).toHaveLength(PER_RECIPIENT_PER_DAY);
    expect(sesSends.filter((s) => s.startsWith('invite:'))).toHaveLength(1);
  });
});
