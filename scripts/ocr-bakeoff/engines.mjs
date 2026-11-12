// OCR engines under test. Each exposes:
//   detect()            -> { ok, reason, note }   (cheap capability probe)
//   run(sample, ctx)    -> { text, timeMs, costUSD, note, searchLayer?, error? }
// Engines never throw; failures are returned as { error } so one bad run doesn't
// abort the sweep.
import fs from 'node:fs';
import path from 'node:path';
import { sh, which, b64File, flattenImage } from './util.mjs';

// The transcription instruction handed to the vision-language engines (Claude,
// Gemini). Deliberately forbids translation/summarization so the output is
// comparable to a raw OCR text layer.
const VLM_PROMPT = [
  'You are an OCR engine. Transcribe ALL text in this document exactly as it appears.',
  'Preserve the original reading order and line breaks.',
  'For Arabic or other right-to-left text, output it in correct logical order so it reads naturally.',
  'Do NOT translate, summarize, explain, correct, or add any commentary.',
  'Output ONLY the transcribed text, nothing else.',
].join(' ');

// Per-million-token USD pricing for cost estimates (input / output).
export const CLAUDE_PRICES = {
  'claude-opus-5': { in: 5, out: 25 },
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-5': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
};
// Rough gemini-2.0-flash rates for an order-of-magnitude estimate only.
const GEMINI_PRICES = {
  'gemini-2.0-flash': { in: 0.1, out: 0.4 },
};

// Image formats each VLM accepts (PDFs are handled separately). Tesseract and
// Document AI accept the broader raster set, so they don't gate on this.
const CLAUDE_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const GEMINI_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);

// ---------------------------------------------------------------------------
// 1. Tesseract via ocrmypdf — what BlendPDF ships today (app/api/ocr-pdf).
// ---------------------------------------------------------------------------
const tesseract = {
  id: 'tesseract',
  label: 'Tesseract (ocrmypdf) — current prod engine',
  async detect() {
    if (!(await which('ocrmypdf'))) {
      return { ok: false, reason: 'ocrmypdf not on PATH — install: brew install ocrmypdf tesseract-lang' };
    }
    return { ok: true, note: 'local, free' };
  },
  async run(sample, ctx) {
    const out = path.join(sample.workDir, 'tesseract.out.pdf');
    const sidecar = path.join(sample.workDir, 'tesseract.sidecar.txt');
    // ocrmypdf wraps a bare image into a PDF (needs --image-dpi since images
    // carry no page geometry); PDFs get --force-ocr so every page is recognized
    // regardless of any existing text layer. --sidecar gives raw recognized text.
    const args = ['-l', ctx.langs];
    let input = sample.path;
    let flattened = false;
    if (sample.kind === 'image') {
      // ocrmypdf rejects images with an alpha channel — flatten onto white first.
      const flat = await flattenImage(sample.path, path.join(sample.workDir, 'tesseract.input.jpg'));
      if (flat) { input = flat; flattened = true; }
      args.push('--image-dpi', '300');
    } else {
      args.push('--force-ocr');
    }
    args.push('--sidecar', sidecar, '--output-type', 'pdf', '--optimize', '0', input, out);
    const t0 = Date.now();
    const r = await sh('ocrmypdf', args, { timeoutMs: 600000 });
    const timeMs = Date.now() - t0;
    if (r.code !== 0) {
      let msg = (r.stderr || '').trim().slice(-400);
      if (/alpha channel/i.test(msg) && !flattened) {
        msg += ' — install `canvas` so the harness can flatten the alpha channel (npm i -D canvas)';
      }
      return { error: `ocrmypdf exited ${r.code}: ${msg}`, timeMs };
    }
    const text = fs.existsSync(sidecar) ? fs.readFileSync(sidecar, 'utf8') : '';
    // Search-layer check: can pdftotext pull nonempty text back out of the PDF?
    let searchLayer = null;
    if (await which('pdftotext')) {
      const pt = await sh('pdftotext', [out, '-'], { timeoutMs: 30000 });
      if (pt.code === 0) searchLayer = pt.stdout.trim().length > 0;
    }
    return { text, timeMs, costUSD: 0, searchLayer, note: `ocrmypdf -l ${ctx.langs}${sample.kind === 'image' ? ` --image-dpi 300${flattened ? ' +flatten' : ''}` : ' --force-ocr'}` };
  },
};

// ---------------------------------------------------------------------------
// 2. Claude vision (Anthropic SDK) — fits BlendPDF's existing vendor relationship.
// ---------------------------------------------------------------------------
const claude = {
  id: 'claude',
  label: 'Claude vision',
  async detect() {
    const mod = await import('@anthropic-ai/sdk').then((m) => m.default).catch(() => null);
    if (!mod) return { ok: false, reason: 'SDK not installed — run: npm i -D @anthropic-ai/sdk' };
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: true, note: 'ANTHROPIC_API_KEY unset — will use an `ant auth login` profile if present, else fails at call time' };
    }
    return { ok: true, note: `model ${process.env.CLAUDE_MODEL || 'claude-opus-5'}` };
  },
  async run(sample, ctx) {
    const Anthropic = await import('@anthropic-ai/sdk').then((m) => m.default).catch(() => null);
    if (!Anthropic) return { error: 'SDK missing' };
    if (sample.kind === 'image' && !CLAUDE_IMAGE_MIMES.has(sample.mime)) {
      return { error: `Claude vision doesn't accept ${sample.mime}` };
    }
    const model = ctx.claudeModel;
    const client = new Anthropic(); // resolves ANTHROPIC_API_KEY or an ant profile
    // PDFs go in a document block; images in an image block with their own MIME.
    const media = sample.kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64File(sample.path) } }
      : { type: 'image', source: { type: 'base64', media_type: sample.mime, data: b64File(sample.path) } };
    const t0 = Date.now();
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 16000,
        output_config: { effort: 'low' }, // transcription needs little deliberation
        messages: [{
          role: 'user',
          content: [media, { type: 'text', text: VLM_PROMPT }],
        }],
      });
      const timeMs = Date.now() - t0;
      if (resp.stop_reason === 'refusal') {
        return { error: `refused (${resp.stop_details?.category || 'unknown'})`, timeMs };
      }
      const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
      const u = resp.usage || {};
      const price = CLAUDE_PRICES[model] || CLAUDE_PRICES['claude-opus-5'];
      const costUSD = ((u.input_tokens || 0) * price.in + (u.output_tokens || 0) * price.out) / 1e6;
      const truncated = resp.stop_reason === 'max_tokens';
      return {
        text, timeMs, costUSD,
        note: `${model}${truncated ? ' [TRUNCATED at max_tokens]' : ''} (${u.input_tokens || 0}in/${u.output_tokens || 0}out)`,
      };
    } catch (err) {
      return { error: `${err?.status || ''} ${err?.message || String(err)}`.trim(), timeMs: Date.now() - t0 };
    }
  },
};

// ---------------------------------------------------------------------------
// 3. Gemini (raw REST) — the VLM the proposal benchmarks as best-in-class Arabic.
// ---------------------------------------------------------------------------
const gemini = {
  id: 'gemini',
  label: 'Gemini (VLM)',
  async detect() {
    if (!process.env.GEMINI_API_KEY) return { ok: false, reason: 'GEMINI_API_KEY unset' };
    return { ok: true, note: `model ${process.env.GEMINI_MODEL || 'gemini-2.0-flash'}` };
  },
  async run(sample, ctx) {
    if (sample.kind === 'image' && !GEMINI_IMAGE_MIMES.has(sample.mime)) {
      return { error: `Gemini doesn't accept ${sample.mime}` };
    }
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const body = {
      contents: [{
        parts: [
          { inline_data: { mime_type: sample.mime, data: b64File(sample.path) } },
          { text: VLM_PROMPT },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 8192 },
    };
    const t0 = Date.now();
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const timeMs = Date.now() - t0;
      if (!resp.ok) return { error: `HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`, timeMs };
      const json = await resp.json();
      const cand = json.candidates?.[0];
      const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
      const um = json.usageMetadata || {};
      const price = GEMINI_PRICES[model] || GEMINI_PRICES['gemini-2.0-flash'];
      const costUSD = ((um.promptTokenCount || 0) * price.in + (um.candidatesTokenCount || 0) * price.out) / 1e6;
      const blocked = cand?.finishReason && cand.finishReason !== 'STOP';
      return {
        text, timeMs, costUSD,
        note: `${model}${blocked ? ` [finishReason=${cand.finishReason}]` : ''} (~cost, verify pricing)`,
      };
    } catch (err) {
      return { error: String(err?.message || err), timeMs: Date.now() - t0 };
    }
  },
};

// ---------------------------------------------------------------------------
// 4. Google Document AI (raw REST) — the proposal's recommended cloud OCR.
// ---------------------------------------------------------------------------
const documentai = {
  id: 'documentai',
  label: 'Google Document AI',
  async detect() {
    const missing = ['GCP_PROJECT_ID', 'DOCAI_PROCESSOR_ID'].filter((k) => !process.env[k]);
    if (missing.length) return { ok: false, reason: `unset: ${missing.join(', ')}` };
    const haveToken = process.env.GOOGLE_ACCESS_TOKEN || (await which('gcloud'));
    if (!haveToken) return { ok: false, reason: 'no GOOGLE_ACCESS_TOKEN and gcloud not on PATH' };
    return { ok: true, note: `location ${process.env.DOCAI_LOCATION || 'us'}` };
  },
  async _token() {
    if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN.trim();
    const r = await sh('gcloud', ['auth', 'application-default', 'print-access-token'], { timeoutMs: 20000 });
    if (r.code !== 0) throw new Error(`gcloud token failed: ${(r.stderr || '').trim().slice(-200)}`);
    return r.stdout.trim();
  },
  async run(sample, ctx) {
    const project = process.env.GCP_PROJECT_ID;
    const processor = process.env.DOCAI_PROCESSOR_ID;
    const location = process.env.DOCAI_LOCATION || 'us';
    const t0 = Date.now();
    try {
      const token = await this._token();
      const url = `https://${location}-documentai.googleapis.com/v1/projects/${project}/locations/${location}/processors/${processor}:process`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ rawDocument: { content: b64File(sample.path), mimeType: sample.mime } }),
      });
      const timeMs = Date.now() - t0;
      if (!resp.ok) {
        const detail = (await resp.text()).slice(0, 300);
        const hint = resp.status === 400 && (sample.pages || 0) > 15 ? ' (sync process caps at ~15 pages)' : '';
        return { error: `HTTP ${resp.status}${hint}: ${detail}`, timeMs };
      }
      const json = await resp.json();
      const text = json.document?.text || '';
      const pages = json.document?.pages?.length || sample.pages || 1;
      const costUSD = (pages * 1.5) / 1000; // Enterprise Document OCR list price
      return { text, timeMs, costUSD, note: `${pages}pp @ $1.50/1k` };
    } catch (err) {
      return { error: String(err?.message || err), timeMs: Date.now() - t0 };
    }
  },
};

export const ENGINES = [tesseract, claude, gemini, documentai];
