import { describe, it, expect } from 'vitest';
import {
  AUTO_CLOSE_MS,
  autoCloseDelay,
  deliveryOutcome,
  deliveryReducer,
  initialDeliveryState,
  isFinished,
  isNewAddress,
  isValidEmail,
  shareType,
  type DeliveryAction,
  type DeliveryState,
} from '../lib/file-delivery';

const run = (...actions: DeliveryAction[]): DeliveryState =>
  actions.reduce(deliveryReducer, initialDeliveryState);

describe('email helpers', () => {
  it.each(['a@b.co', ' user.name+tag@example.org ', 'x@y.z'])('accepts %j', (e) => {
    expect(isValidEmail(e)).toBe(true);
  });

  it.each(['', 'plain', 'a@b', '@b.co', 'a b@c.de', 'a@b .co'])('rejects %j', (e) => {
    expect(isValidEmail(e)).toBe(false);
  });

  it('treats the saved address as known, ignoring case and spaces', () => {
    expect(isNewAddress('Me@Example.com ', 'me@example.com')).toBe(false);
    expect(isNewAddress('other@example.com', 'me@example.com')).toBe(true);
    expect(isNewAddress('me@example.com', null)).toBe(true);
    expect(isNewAddress('', null)).toBe(true);
  });
});

describe('delivery state', () => {
  it('starts idle and unfinished, with no auto-close', () => {
    expect(isFinished(initialDeliveryState)).toBe(false);
    expect(autoCloseDelay(initialDeliveryState)).toBeNull();
  });

  it('a successful send finishes the panel as an email delivery', () => {
    const s = run({ type: 'sendStart' }, { type: 'sendResult', ok: true, to: 'a@b.co', askForReview: false });
    expect(s.email).toBe('sent');
    expect(s.sentTo).toBe('a@b.co');
    expect(isFinished(s)).toBe(true);
    expect(deliveryOutcome(s)).toBe('email');
    expect(autoCloseDelay(s)).toBe(AUTO_CLOSE_MS.email);
  });

  it('a failed send leaves the panel open and retryable, and never decides the review ask', () => {
    const s = run({ type: 'sendStart' }, { type: 'sendResult', ok: false, to: 'a@b.co', askForReview: true });
    expect(s.email).toBe('failed');
    expect(isFinished(s)).toBe(false);
    expect(s.askForReview).toBeNull();
    expect(autoCloseDelay(s)).toBeNull();
    expect(deliveryReducer(s, { type: 'sendStart' }).email).toBe('sending');
  });

  it('downloading mid-send supersedes it: the late result is ignored', () => {
    const s = run(
      { type: 'sendStart' },
      { type: 'download', askForReview: false },
      { type: 'sendResult', ok: true, to: 'a@b.co', askForReview: true }
    );
    expect(s.downloaded).toBe(true);
    expect(s.email).toBe('idle');
    expect(s.sentTo).toBeNull();
    expect(deliveryOutcome(s)).toBe('download');
    expect(autoCloseDelay(s)).toBe(AUTO_CLOSE_MS.download);
  });

  it('a late failure after a download does not show the failure note', () => {
    const s = run(
      { type: 'sendStart' },
      { type: 'download', askForReview: false },
      { type: 'sendResult', ok: false, to: 'a@b.co', askForReview: false }
    );
    expect(s.email).toBe('idle');
  });

  it('ignores a send result when no send is in flight', () => {
    expect(run({ type: 'sendResult', ok: true, to: 'a@b.co', askForReview: false })).toEqual(initialDeliveryState);
  });

  it('cannot start a second send while one is in flight or after sending', () => {
    const sending = run({ type: 'sendStart' });
    expect(deliveryReducer(sending, { type: 'sendStart' })).toBe(sending);
    const sent = deliveryReducer(sending, { type: 'sendResult', ok: true, to: 'a@b.co', askForReview: false });
    expect(deliveryReducer(sent, { type: 'sendStart' })).toBe(sent);
  });

  it('the review ask holds the panel open, whichever way the file went', () => {
    const viaEmail = run({ type: 'sendStart' }, { type: 'sendResult', ok: true, to: 'a@b.co', askForReview: true });
    expect(autoCloseDelay(viaEmail)).toBeNull();
    const viaDownload = run({ type: 'download', askForReview: true });
    expect(autoCloseDelay(viaDownload)).toBeNull();
  });

  it('decides the review ask once: a download after an email keeps the first answer and the email outcome', () => {
    const s = run(
      { type: 'sendStart' },
      { type: 'sendResult', ok: true, to: 'a@b.co', askForReview: false },
      { type: 'download', askForReview: true }
    );
    expect(s.askForReview).toBe(false);
    expect(deliveryOutcome(s)).toBe('email');
    expect(autoCloseDelay(s)).toBe(AUTO_CLOSE_MS.download);
  });

  it('reset returns to a clean panel', () => {
    const s = run({ type: 'download', askForReview: true }, { type: 'reset' });
    expect(s).toEqual(initialDeliveryState);
  });
});

describe('shareType', () => {
  it('keeps the blob\'s own type', () => {
    expect(shareType('image/png', 'scan.pdf')).toBe('image/png');
  });

  it.each([
    ['report.pdf', 'application/pdf'],
    ['PHOTO.JPG', 'image/jpeg'],
    ['pages.zip', 'application/zip'],
    ['lettre.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['noextension', 'application/octet-stream'],
  ])('types an untyped %s from its name', (name, type) => {
    expect(shareType('', name)).toBe(type);
  });
});
