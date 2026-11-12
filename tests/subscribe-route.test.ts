/**
 * /api/subscribe takes any address from anyone, so it must never undo an
 * unsubscribe, and never hand back a raw DynamoDB error (which can carry the
 * account id and role ARN). Security review, 2026-11-12.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const sent: Array<{ name: string; input: Record<string, any> }> = [];
let failWith: Error | null = null;

vi.mock('@/lib/dynamodb-client', () => ({
  getEmailsTableName: () => 'emails',
  getDynamoDBClient: () => ({
    async send(command: { constructor: { name: string }; input: Record<string, any> }) {
      sent.push({ name: command.constructor.name, input: command.input });
      if (failWith) throw failWith;
      if (command.constructor.name === 'PutCommand') {
        throw Object.assign(new Error('The conditional request failed'), { name: 'ConditionalCheckFailedException' });
      }
      return {};
    },
  }),
}));

import { POST } from '../app/api/subscribe/route';

const post = (email: string) =>
  POST(
    new NextRequest('http://localhost/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.50' },
      body: JSON.stringify({ email, locale: 'en' }),
    })
  );

beforeEach(() => {
  sent.length = 0;
  failWith = null;
  process.env.AWS_REGION = 'eu-north-1';
});
afterEach(() => {
  delete process.env.AWS_REGION;
});

describe('/api/subscribe', () => {
  it('refreshes an existing record without touching its unsubscribe', async () => {
    expect((await post('someone@example.com')).status).toBe(200);
    const update = sent.find((c) => c.name === 'UpdateCommand')!;
    expect(update).toBeTruthy();
    expect(update.input.UpdateExpression).not.toMatch(/unsubscribed/i);
    expect(JSON.stringify(update.input.ExpressionAttributeValues)).not.toMatch(/false/);
  });

  it('answers a storage failure with fixed text, never the AWS message', async () => {
    failWith = Object.assign(
      new Error('User: arn:aws:sts::123456789012:assumed-role/app is not authorized to perform: dynamodb:PutItem'),
      { name: 'AccessDeniedException' }
    );
    const res = await post('someone@example.com');
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).not.toMatch(/arn:aws|123456789012|not authorized/);
  });
});
