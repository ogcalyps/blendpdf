import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { sendFileByEmail, MAX_EMAIL_FILE_SIZE } from '../lib/send-file-by-email';
import {
  shouldAskForReview,
  markReviewPromptShown,
  markReviewed,
  REVIEW_PROMPT_COOLDOWN_MS,
  TRUSTPILOT_REVIEW_URL,
  inlineReviewAskAfterSuccess,
  type InlineReviewAsk,
} from '../lib/review-prompt';

const root = join(__dirname, '..');

// Captures what would have gone to SES, so the server-side size limits can be exercised offline
const sesSends: Array<{ Data: Uint8Array; headers: string }> = [];
vi.mock('@aws-sdk/client-ses', () => ({
  SESClient: class {
    async send(cmd: { input: { RawMessage: { Data: Uint8Array } } }) {
      const data = cmd.input.RawMessage.Data;
      sesSends.push({ Data: data, headers: Buffer.from(data).toString('utf8').split('\r\n\r\n')[0] });
      return { MessageId: 'test' };
    }
  },
  SendRawEmailCommand: class {
    constructor(public input: unknown) {}
  },
}));

type GtagCall = [string, string, Record<string, unknown>];

function installWindow(): GtagCall[] {
  const calls: GtagCall[] = [];
  (globalThis as any).window = {
    location: { pathname: '/en/compress-pdf' },
    gtag: (...args: GtagCall) => {
      calls.push(args);
    },
  };
  return calls;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

describe('sendFileByEmail', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete (globalThis as any).window;
  });

  const pdf = () => new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' });

  it('resolves true when the API accepts the email', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(sendFileByEmail(pdf(), 'a.pdf', 'a@b.co')).resolves.toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ email: 'a@b.co', filename: 'a.pdf', fileData: 'JVBERg==', fileType: 'application/pdf' });
  });

  it('records email_sent only when the email went out', async () => {
    const calls = installWindow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await sendFileByEmail(pdf(), 'a.pdf', 'a@b.co');
    expect(calls).toContainEqual(['event', 'email_sent', { tool_name: 'compress_pdf' }]);
    expect(calls.some((c) => c[1] === 'email_send_failed')).toBe(false);
  });

  // 503 is the live state until SES is verified; 502 is the sandbox rejecting an unverified recipient
  it.each([503, 502, 413, 429, 500])('resolves false (never throws) on HTTP %i and records the status', async (status) => {
    const calls = installWindow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })));
    await expect(sendFileByEmail(pdf(), 'a.pdf', 'a@b.co')).resolves.toBe(false);
    expect(calls).toContainEqual(['event', 'email_send_failed', { tool_name: 'compress_pdf', status }]);
    expect(calls.some((c) => c[1] === 'email_sent')).toBe(false);
  });

  it('resolves false on a network failure', async () => {
    const calls = installWindow();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(sendFileByEmail(pdf(), 'a.pdf', 'a@b.co')).resolves.toBe(false);
    expect(calls[0][2].status).toBe('network');
  });

  it('refuses oversized files without calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const big = new Blob([new Uint8Array(MAX_EMAIL_FILE_SIZE + 1)]);
    await expect(sendFileByEmail(big, 'big.pdf', 'a@b.co')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('client email cap vs the server SES limits', () => {
  beforeEach(() => {
    sesSends.length = 0;
    process.env.AWS_SES_FROM_EMAIL = 'BlendPDF <files@mail.blendpdf.com>';
  });
  afterEach(() => {
    delete process.env.AWS_SES_FROM_EMAIL;
  });

  // If the client offered email for files the server then refuses, every such user
  // would upload ~10MB just to be told to download. The cap must fit what SES accepts.
  it('a file exactly at MAX_EMAIL_FILE_SIZE still fits in one SES message', async () => {
    const { sendFileEmailViaSes } = await import('../lib/send-file-email-ses');
    const file = Buffer.alloc(MAX_EMAIL_FILE_SIZE, 7);
    file.write('%PDF-1.7\n', 'latin1');
    const b64 = file.toString('base64');
    await expect(
      sendFileEmailViaSes({ to: 'a@b.co', filename: 'x.pdf', fileType: 'application/pdf', fileDataBase64: b64 })
    ).resolves.toBeUndefined();
    expect(sesSends).toHaveLength(1);
    expect(sesSends[0].Data.length).toBeLessThanOrEqual(10 * 1024 * 1024);
  });

  it('offers only an HTTPS unsubscribe (mail.blendpdf.com has no MX, so mailto would bounce)', async () => {
    const { sendFileEmailViaSes } = await import('../lib/send-file-email-ses');
    await sendFileEmailViaSes({ to: 'a@b.co', filename: 'x.pdf', fileType: 'application/pdf', fileDataBase64: 'JVBERg==' });
    const header = sesSends[0].headers.split('\r\n').find((h) => h.startsWith('List-Unsubscribe:'));
    expect(header).toMatch(/^List-Unsubscribe: <https:\/\/[^>]+>$/);
    expect(header).not.toMatch(/mailto/);
  });
});

describe('review prompt eligibility', () => {
  const now = 1_800_000_000_000;

  it('asks a first-time user', () => {
    expect(shouldAskForReview(now, memoryStorage())).toBe(true);
  });

  it('waits out the cooldown after showing the ask, then asks again', () => {
    const storage = memoryStorage();
    markReviewPromptShown(now, storage);
    expect(shouldAskForReview(now + 60_000, storage)).toBe(false);
    expect(shouldAskForReview(now + REVIEW_PROMPT_COOLDOWN_MS - 1, storage)).toBe(false);
    expect(shouldAskForReview(now + REVIEW_PROMPT_COOLDOWN_MS, storage)).toBe(true);
  });

  it.each(['clicked', 'already'] as const)('never asks again once the user has %s', (how) => {
    const storage = memoryStorage();
    markReviewed(how, storage);
    expect(shouldAskForReview(now + 10 * REVIEW_PROMPT_COOLDOWN_MS, storage)).toBe(false);
  });

  it('treats a last-shown time in the future as stale instead of hiding the ask forever', () => {
    const storage = memoryStorage({ blendpdf_review_prompt_last_shown: String(now + 1e12) });
    expect(shouldAskForReview(now, storage)).toBe(true);
  });

  it('does not ask when storage is unavailable, since a dismissal could not be remembered', () => {
    expect(shouldAskForReview(now, null)).toBe(false);
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(shouldAskForReview(now, throwing)).toBe(false);
    expect(() => markReviewPromptShown(now, throwing)).not.toThrow();
    expect(() => markReviewed('clicked', throwing)).not.toThrow();
  });

  it('links to the Trustpilot write-a-review page', () => {
    expect(TRUSTPILOT_REVIEW_URL).toBe('https://www.trustpilot.com/evaluate/blendpdf.com');
  });
});

describe('inline review ask on tools without a success screen', () => {
  it('asks after a success when the user is eligible, and skips when not', () => {
    expect(inlineReviewAskAfterSuccess('undecided', true)).toBe('asking');
    expect(inlineReviewAskAfterSuccess('undecided', false)).toBe('skipped');
  });

  it('keeps a showing ask through later downloads, although showing it started the cooldown', () => {
    expect(inlineReviewAskAfterSuccess('asking', false)).toBe('asking');
    expect(inlineReviewAskAfterSuccess('asking', true)).toBe('asking');
  });

  it('never brings the ask back in the same visit once the user acted on it', () => {
    expect(inlineReviewAskAfterSuccess('acted', true)).toBe('acted');
    expect(inlineReviewAskAfterSuccess('acted', false)).toBe('acted');
  });

  it('re-decides on the next success after a skip', () => {
    expect(inlineReviewAskAfterSuccess('skipped', true)).toBe('asking');
    expect(inlineReviewAskAfterSuccess('skipped', false)).toBe('skipped');
  });

  it('a whole visit: first download asks, the next keeps it, acting hides it for good', () => {
    const storage = memoryStorage();
    const now = 1_800_000_000_000;
    let state: InlineReviewAsk = 'undecided';
    state = inlineReviewAskAfterSuccess(state, shouldAskForReview(now, storage));
    expect(state).toBe('asking');
    markReviewPromptShown(now, storage); // what <ReviewPrompt> does when it mounts
    state = inlineReviewAskAfterSuccess(state, shouldAskForReview(now + 1000, storage));
    expect(state).toBe('asking');
    state = 'acted';
    state = inlineReviewAskAfterSuccess(state, shouldAskForReview(now + REVIEW_PROMPT_COOLDOWN_MS, storage));
    expect(state).toBe('acted');
  });

  // Extract images used to download straight from its page; it now delivers through the
  // workspace's FileDeliveryModal, whose panel carries the review ask.
  const surfaces = [
    'app/[locale]/fill-form/page.tsx',
    'components/forms/BatchFillUploader.tsx',
    ...readdirSync(join(root, 'components/forms/templates'))
      .filter((f) => f.endsWith('.tsx'))
      .map((f) => `components/forms/templates/${f}`),
  ];

  it.each(surfaces)('%s marks the success and renders the ask', (f) => {
    const src = readFileSync(join(root, f), 'utf8');
    expect(src).toMatch(/const \{ markSuccess, reviewAsk \} = useReviewAskAfterSuccess\(\);/);
    expect(src).toMatch(/markSuccess\(\);/);
    expect(src).toMatch(/\{reviewAsk\}/);
  });
});

describe('single-step delivery wiring', () => {
  // Every tool page that keeps its result on the page must open the ONE delivery
  // panel (download + inline email), never the old two-modal chain.
  // Tool pages deliver through the workspace shell, which owns the hook.
  const pagesDir = join(root, 'app/[locale]');
  const shell = join(root, 'components/workspace/ToolWorkspace.tsx');
  const pageFiles = readdirSync(pagesDir)
    .map((d) => join(pagesDir, d, 'page.tsx'))
    .filter((p) => existsSync(p));
  const pages = [...pageFiles, shell].filter((p) => readFileSync(p, 'utf8').includes('useDeliveryChoice('));

  it('covers every tool page that uses the delivery hook', () => {
    expect(pages).toContain(shell);
    const workspacePages = pageFiles.filter((p) => /<ToolWorkspace\b/.test(readFileSync(p, 'utf8')));
    expect(workspacePages.length).toBeGreaterThanOrEqual(27);
  });

  it.each(pages.map((p) => [p.split('/').slice(-2, -1)[0], p]))('%s renders the single delivery modal', (_name, p) => {
    const src = readFileSync(p, 'utf8');
    expect(src).toMatch(/const \{ openDelivery, deliveryModalProps \} = useDeliveryChoice\(\{/);
    expect(src).toMatch(/<FileDeliveryModal \{\.\.\.deliveryModalProps\}( notice=\{[^}]+\})?( noticeTone=\{[^}]+\})?( aboveEditorBar=\{[^}]+\})?( onNextPerson=\{[^}]+\})?( prefillEmail=\{[^}]+\})? \/>/);
    expect(src).toMatch(/openDelivery\(\)/);
    expect(src).not.toMatch(/triggerEmailCapture|showDeliveryChoice|showEmailCapture/);
  });

  it('the processing modal shows the same panel in its success state, with no second dialog', () => {
    const src = readFileSync(join(root, 'components/ProcessingModal.tsx'), 'utf8');
    expect(src).toMatch(/<FileDeliveryPanel\b/);
    expect(src).not.toMatch(/<\w+Modal\b/);
  });

  it('nothing imports the retired two-step modals', () => {
    expect(existsSync(join(root, 'components/DeliveryChoiceModal.tsx'))).toBe(false);
    expect(existsSync(join(root, 'components/EmailCaptureModal.tsx'))).toBe(false);
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(entry.name) && /DeliveryChoiceModal|EmailCaptureModal/.test(readFileSync(full, 'utf8'))) {
          offenders.push(full);
        }
      }
    };
    for (const dir of ['app', 'components', 'hooks', 'lib', 'store']) {
      if (existsSync(join(root, dir))) walk(join(root, dir));
    }
    expect(offenders).toEqual([]);
  });

  it('no longer uses alert() for email failures', () => {
    for (const f of [
      'hooks/useDeliveryChoice.ts',
      'hooks/useFileDelivery.ts',
      'components/ProcessingModal.tsx',
      'components/FileDeliveryPanel.tsx',
      'components/FileDeliveryModal.tsx',
    ]) {
      expect(readFileSync(join(root, f), 'utf8')).not.toMatch(/\balert\(/);
    }
  });
});

describe('copy parity', () => {
  const en = JSON.parse(readFileSync(join(root, 'messages/en.json'), 'utf8'));
  const ar = JSON.parse(readFileSync(join(root, 'messages/ar.json'), 'utf8'));

  it('has the review prompt copy in both locales', () => {
    expect(Object.keys(ar.reviewPrompt).sort()).toEqual(Object.keys(en.reviewPrompt).sort());
    for (const loc of [en, ar]) {
      for (const v of Object.values(loc.reviewPrompt)) expect(v).toBeTruthy();
    }
  });

  it('has every fileDelivery key in both locales, non-empty', () => {
    expect(Object.keys(ar.fileDelivery).sort()).toEqual(Object.keys(en.fileDelivery).sort());
    for (const loc of [en, ar]) {
      for (const v of Object.values(loc.fileDelivery)) expect(v).toBeTruthy();
    }
    expect(en.fileDelivery.sentTo).toContain('{email}');
    expect(ar.fileDelivery.sentTo).toContain('{email}');
  });

  it('every fileDelivery key the panel and modal use exists, and none is left unused', () => {
    const src = ['components/FileDeliveryPanel.tsx', 'components/FileDeliveryModal.tsx']
      .map((f) => readFileSync(join(root, f), 'utf8'))
      .join('\n');
    const used = new Set([...src.matchAll(/\bt\('([a-zA-Z]+)'/g)].map((m) => m[1]));
    expect([...used].sort()).toEqual(Object.keys(en.fileDelivery).sort());
  });

  it('drops the namespaces of the retired modals', () => {
    for (const loc of [en, ar]) {
      expect(loc.deliveryChoice).toBeUndefined();
      expect(loc.emailCapture).toBeUndefined();
      expect(loc.emailDelivery).toBeUndefined();
    }
  });

  it('keeps the Arabic delivery copy inside the house glossary', () => {
    const text = Object.values(ar.fileDelivery as Record<string, string>).join('\n');
    for (const banned of ['تحميل', 'الإيميل', 'يرجى', 'سيتم', 'الخاص بك', 'بدلًا من ذلك', 'بنجاح', '—']) {
      expect(text).not.toContain(banned);
    }
    for (const v of Object.values(ar.fileDelivery as Record<string, string>)) {
      expect((v.match(/!/g) || []).length).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the English delivery copy free of em-dashes', () => {
    for (const v of Object.values(en.fileDelivery as Record<string, string>)) expect(v).not.toContain('—');
  });
});
