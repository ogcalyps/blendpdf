import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { RUN_TOOLS, runToolForGa } from '../lib/run-tools';
import { opsForSave } from '../lib/workspace/summary';
import { DEFAULT_SAVE_PLAN, type DocSummary, type SavePlan } from '../lib/workspace/types';

/**
 * The run counter only hears about a browser run when its tracking call says
 * processing_method: 'client' (lib/analytics.ts sendRunBeacon). The tools that
 * never reach the server used to fire their events untagged, so a new page,
 * or an edit that drops the tag, would leave a tool silently uncounted: the
 * same shared-helper-bypassed shape as the earlier download and upload
 * undercounts. This guard reads every tool page and requires:
 *
 * 1. A page that never fetches /api (no fetch('/api/…'), no lib/api-client):
 *    every trackToolComplete / trackToolError call is tagged client, and
 *    every withToolTracking is 'client'.
 * 2. A page that calls runPdfOpInWorker: each call is covered, either inside
 *    a withToolTracking(…, 'client', fn) callback or inside a try block that
 *    fires a client-tagged trackToolComplete (whose catch, if it tracks an
 *    error, tags it client too).
 * 3. The server side of a hybrid page never carries the tag: a tracking call
 *    in a try block that fetches is untagged, and a withToolTracking whose
 *    callback fetches is 'server'. Its run is counted from its own log line.
 * 4. Every client-tagged call names, as a string literal, a tool the counter
 *    takes (runToolForGa), and every tool the counter takes has one. A
 *    misspelt or renamed tool_name sends nothing and fails nothing, so this
 *    is the only place it would show.
 * 5. A client wrapper (withToolTracking(…, 'client', …)) that is called in a
 *    try whose catch retries on the server (fallsBackToServer / retryOnServer)
 *    passes { fallsBackToServer }, so the retried failure is not reported as
 *    a browser error on top of the server's own log line.
 *
 * The PDF tool pages no longer run anything themselves: they open the
 * workspace, whose saves are tracked by lib/workspace/track.ts with one run
 * per browser operation, named by opsForSave (lib/workspace/summary.ts). Rule
 * 4 covers those names too: each one is a tool the counter takes, and with the
 * pages they cover every tool it takes.
 */

const root = join(__dirname, '..');
const PAGES_DIR = join(root, 'app', '[locale]');
/** Browser-only code outside the pages that tracks a run. */
const CLIENT_MODULES = ['lib/pdf-generation.ts'];

const TRACK_FNS = new Set(['trackToolComplete', 'trackToolError']);
/** Index of the params argument of each tracking function. */
const PARAMS_ARG: Record<string, number> = { trackToolComplete: 2, trackToolError: 3 };
const CLIENT_TAG = /processing_method:\s*['"]client['"]/;
const API_FETCH = /fetch\(\s*[`'"]\/api\//;
const API_CLIENT_IMPORT = /from\s+['"]@\/lib\/api-client['"]/;
/** A catch that sends the run on to the server. */
const SERVER_RETRY = /\bfallsBackToServer\s*\(|\bretryOnServer\b/;

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) return pageFiles(abs);
    return name === 'page.tsx' ? [abs] : [];
  });
}

const rel = (abs: string) => relative(root, abs).split(sep).join('/');

type Call = { node: ts.CallExpression; name: string; text: string };

function calls(sf: ts.SourceFile): Call[] {
  const out: Call[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      out.push({ node, name: node.expression.text, text: node.getText(sf) });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function isClientTagged(c: Call, sf: ts.SourceFile): boolean {
  const arg = c.node.arguments[PARAMS_ARG[c.name]];
  return arg !== undefined && CLIENT_TAG.test(arg.getText(sf));
}

function trackingMethod(c: Call): string | null {
  const arg = c.node.arguments[1];
  return arg && ts.isStringLiteral(arg) ? arg.text : null;
}

/** The withToolTracking call whose callback (3rd argument) encloses `node`, if any. */
function enclosingTracker(node: ts.Node): ts.CallExpression | null {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    const p: ts.Node | undefined = n.parent;
    if (
      p &&
      ts.isCallExpression(p) &&
      ts.isIdentifier(p.expression) &&
      p.expression.text === 'withToolTracking' &&
      p.arguments[2] === n
    ) {
      return p;
    }
  }
  return null;
}

/** Every try statement whose try block encloses `node`, innermost first. */
function enclosingTries(node: ts.Node): ts.TryStatement[] {
  const out: ts.TryStatement[] = [];
  for (let n: ts.Node | undefined = node; n?.parent; n = n.parent) {
    if (ts.isTryStatement(n.parent) && n.parent.tryBlock === n) out.push(n.parent);
  }
  return out;
}

/** The try statement whose catch clause encloses `node`, innermost. */
function enclosingCatchTry(node: ts.Node): ts.TryStatement | null {
  for (let n: ts.Node | undefined = node; n?.parent; n = n.parent) {
    if (ts.isCatchClause(n) && ts.isTryStatement(n.parent)) return n.parent;
  }
  return null;
}

type Scan = {
  file: string;
  kind: 'browser_only' | 'worker' | 'server' | 'untracked';
  problems: string[];
  /** The tool_name of every client-tagged call (rule 4). */
  clientTools: string[];
};

function scanSource(file: string, src: string): Scan {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const all = calls(sf);
  const track = all.filter((c) => TRACK_FNS.has(c.name));
  const trackers = all.filter((c) => c.name === 'withToolTracking');
  const workers = all.filter((c) => c.name === 'runPdfOpInWorker');
  const fetchesApi = API_FETCH.test(src) || API_CLIENT_IMPORT.test(src);
  const problems: string[] = [];
  const where = (c: Call) => `${file}:${sf.getLineAndCharacterOfPosition(c.node.getStart(sf)).line + 1} ${c.text.slice(0, 60)}`;
  const tryFetches = (t: ts.TryStatement) => API_FETCH.test(t.tryBlock.getText(sf));
  const tryTracksClientOk = (t: ts.TryStatement) =>
    calls(sf).some((c) => c.name === 'trackToolComplete' && enclosingTries(c.node).includes(t) && isClientTagged(c, sf));

  if (track.length === 0 && trackers.length === 0) {
    return {
      file,
      kind: workers.length > 0 ? 'worker' : 'untracked',
      problems: workers.length > 0 ? [`${file}: runs the PDF worker but tracks nothing`] : [],
      clientTools: [],
    };
  }

  let kind: Scan['kind'];
  if (workers.length > 0) kind = 'worker';
  else if (!fetchesApi) kind = 'browser_only';
  else kind = 'server';

  if (kind === 'browser_only') {
    for (const c of track) if (!isClientTagged(c, sf)) problems.push(`untagged browser run: ${where(c)}`);
    for (const c of trackers) if (trackingMethod(c) !== 'client') problems.push(`browser run tracked as server: ${where(c)}`);
  }

  if (kind === 'worker') {
    for (const w of workers) {
      const tracker = enclosingTracker(w.node);
      const coveredByTracker = tracker !== null && (tracker.arguments[1] as ts.StringLiteral | undefined)?.text === 'client';
      const coveredByTry = enclosingTries(w.node).some(tryTracksClientOk);
      if (!coveredByTracker && !coveredByTry) problems.push(`worker run with no client-tagged tracking: ${where(w)}`);
    }
    for (const c of track.filter((x) => x.name === 'trackToolError')) {
      const t = enclosingCatchTry(c.node);
      if (t && workers.some((w) => enclosingTries(w.node).includes(t)) && !isClientTagged(c, sf)) {
        problems.push(`untagged error for a worker run: ${where(c)}`);
      }
    }
  }

  // The server side of any page never carries the tag.
  for (const c of track) {
    if (isClientTagged(c, sf) && (enclosingTries(c.node).some(tryFetches) || (() => {
      const t = enclosingCatchTry(c.node);
      return t !== null && tryFetches(t);
    })())) {
      problems.push(`server run tagged client: ${where(c)}`);
    }
  }
  for (const c of trackers) {
    const fn = c.node.arguments[2];
    if (fn && API_FETCH.test(fn.getText(sf)) && trackingMethod(c) !== 'server') problems.push(`fetching run tracked as client: ${where(c)}`);
  }

  // 4. A client-tagged call names a tool the counter takes.
  const clientTools: string[] = [];
  for (const c of [...track.filter((x) => isClientTagged(x, sf)), ...trackers.filter((x) => trackingMethod(x) === 'client')]) {
    const arg = c.node.arguments[0];
    if (!arg || !ts.isStringLiteralLike(arg)) {
      problems.push(`client run whose tool_name is not a string literal: ${where(c)}`);
    } else if (runToolForGa(arg.text) === null) {
      problems.push(`client run of a tool the run counter does not take ('${arg.text}'): ${where(c)}`);
    } else {
      clientTools.push(arg.text);
    }
  }

  // 5. A client wrapper the page retries on the server says so.
  const clientWrappers = new Map<string, ts.CallExpression>();
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    for (const decl of st.declarationList.declarations) {
      const init = decl.initializer;
      if (
        ts.isIdentifier(decl.name) &&
        init &&
        ts.isCallExpression(init) &&
        ts.isIdentifier(init.expression) &&
        init.expression.text === 'withToolTracking' &&
        (init.arguments[1] as ts.StringLiteral | undefined)?.text === 'client'
      ) {
        clientWrappers.set(decl.name.text, init);
      }
    }
  }
  const retriedOnServer = (node: ts.Node) =>
    enclosingTries(node).some((t) => t.catchClause !== undefined && SERVER_RETRY.test(t.catchClause.getText(sf)));
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const wrapper =
        ts.isIdentifier(callee) && clientWrappers.has(callee.text)
          ? clientWrappers.get(callee.text)!
          : ts.isCallExpression(callee) &&
              ts.isIdentifier(callee.expression) &&
              callee.expression.text === 'withToolTracking' &&
              (callee.arguments[1] as ts.StringLiteral | undefined)?.text === 'client'
            ? callee
            : null;
      if (wrapper && retriedOnServer(node) && !/\bfallsBackToServer\b/.test(wrapper.arguments[3]?.getText(sf) ?? '')) {
        const line = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
        problems.push(`client run retried on the server without { fallsBackToServer }: ${file}:${line} ${node.getText(sf).slice(0, 60)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { file, kind, problems, clientTools };
}

const scans = [...pageFiles(PAGES_DIR).map(rel), ...CLIENT_MODULES]
  .sort()
  .map((f) => scanSource(f, readFileSync(join(root, f), 'utf8')));
const ofKind = (kind: Scan['kind']) =>
  scans.filter((s) => s.kind === kind).map((s) => s.file.replace(/^app\/\[locale\]\//, '').replace(/\/page\.tsx$/, ''));

/** Every browser operation a workspace save can track, from saves that do all of them. */
function workspaceClientOps(): string[] {
  const everything: DocSummary = {
    deletedPages: 1, turnedPages: 1, moved: true, blankPages: 1, insertedPages: 1, croppedPages: 1,
    watermark: true, pageNumbers: true, letterhead: true,
    objects: { text: 1, image: 2, shape: 1, line: 1, ink: 1, highlight: 1, cover: 1 },
    signatures: 1, changedLines: 1,
  };
  const plans: SavePlan[] = [
    { ...DEFAULT_SAVE_PLAN, flatten: true, removeMetadata: true, pages: 'selected' },
    { ...DEFAULT_SAVE_PLAN, split: { kind: 'every', n: 2 }, alsoSelected: false },
    { ...DEFAULT_SAVE_PLAN, alsoSelected: true },
    { ...DEFAULT_SAVE_PLAN, format: 'text' },
    { ...DEFAULT_SAVE_PLAN, format: 'imagesInside' },
  ];
  return [...new Set(plans.flatMap((plan) => opsForSave(everything, plan).client))].sort();
}

describe('processing_method guard', () => {
  it('sees the pages it is meant to guard (it is not vacuous)', () => {
    // The tool pages open the workspace now; only the form templates still run on their own
    expect(ofKind('browser_only')).toEqual(['lib/pdf-generation.ts']);
    expect(ofKind('worker')).toEqual([]);
    expect(scans.length).toBeGreaterThan(30);
    expect(workspaceClientOps().length).toBeGreaterThanOrEqual(15);
  });

  it('tags every workspace run client (lib/workspace/track.ts)', () => {
    const src = readFileSync(join(root, 'lib/workspace/track.ts'), 'utf8');
    expect(src).toMatch(/const meta = \{ processing_method: 'client'/);
    const tracked = [...src.matchAll(/\b(trackToolStart|trackToolComplete|trackToolError)\(([^;]*)\);/g)];
    expect(tracked.map((m) => m[1]).sort()).toEqual(['trackToolComplete', 'trackToolError', 'trackToolStart']);
    for (const [call] of tracked) expect(call).toMatch(/\bmeta\b/);
  });

  it('names every workspace run after a tool the counter takes', () => {
    expect(workspaceClientOps().filter((op) => runToolForGa(op) === null)).toEqual([]);
  });

  it('finds every browser run tagged client and every server run untagged', () => {
    expect(scans.flatMap((s) => s.problems)).toEqual([]);
  });

  it('has a client-tagged call for every tool the run counter takes (bar reserved ones)', () => {
    const seen = new Set([...scans.flatMap((s) => s.clientTools), ...workspaceClientOps()]);
    const missing = RUN_TOOLS.filter((t) => !t.reserved && !seen.has(t.ga)).map((t) => t.ga);
    expect(missing).toEqual([]);
  });

  it('catches the mistakes it exists for (the rules are not vacuous)', () => {
    const page = (body: string) => scanSource('x/page.tsx', `'use client';\n${body}`).problems;
    // 1. A browser-only page that drops the tag.
    expect(page(`async function go() { try { trackToolComplete('crop_pdf', 1); } catch (e) { trackToolError('crop_pdf', e, 1); } }`)).toHaveLength(2);
    expect(page(`const f = withToolTracking('sign_pdf', 'server', async () => 1);`)).toHaveLength(1);
    // 2. A worker run with no client-tagged completion.
    expect(page(`async function go() { try { await runPdfOpInWorker({ op: 'x' }); trackToolComplete('rotate_pdf', 1); } catch (e) {} }`)).toHaveLength(1);
    expect(page(`async function go() { await runPdfOpInWorker({ op: 'x' }); }`)).toHaveLength(1);
    expect(
      page(`async function go() { try { await runPdfOpInWorker({ op: 'x' }); trackToolComplete('rotate_pdf', 1, { processing_method: 'client' }); } catch (e) { trackToolError('rotate_pdf', e, 1); } }`),
    ).toHaveLength(1);
    // 3. A server fallback that carries the tag.
    expect(
      page(`async function go() { try { await runPdfOpInWorker({ op: 'x' }); trackToolComplete('rotate_pdf', 1, { processing_method: 'client' }); } catch {}
        try { await fetch('/api/rotate-pdf'); trackToolComplete('rotate_pdf', 1, { processing_method: 'client' }); } catch (e) {} }`),
    ).toHaveLength(1);
    expect(page(`const f = withToolTracking('split_pdf', 'client', async () => { await fetch('/api/split'); });`)).toHaveLength(1);
    // 4. A tool_name the counter does not take, or one it cannot read.
    expect(page(`async function go() { try { trackToolComplete('crop_pdf_v2', 1, { processing_method: 'client' }); } catch {} }`)).toHaveLength(1);
    expect(page(`const f = withToolTracking(TOOL, 'client', async () => 1);`)).toHaveLength(1);
    // 5. A retried client wrapper that drops { fallsBackToServer }, at module level or inline.
    const retry = (decl: string, call = 'run()') =>
      page(`${decl}\nasync function go() { try { await ${call}; } catch (e) { if (!fallsBackToServer(e)) throw e; } await fetch('/api/merge'); }`);
    expect(retry(`const run = withToolTracking('merge_pdf', 'client', async () => runPdfOpInWorker({ op: 'merge' }));`)).toHaveLength(1);
    expect(retry(``, `withToolTracking('merge_pdf', 'client', async () => runPdfOpInWorker({ op: 'merge' }))()`)).toHaveLength(1);
    expect(
      page(`const run = withToolTracking('rotate_pdf', 'client', async () => runPdfOpInWorker({ op: 'x' }));
        async function go() { try { await run(); } catch (err) { if (err instanceof ClientPdfError && !err.retryOnServer) return; } }`),
    ).toHaveLength(1);
    expect(retry(`const run = withToolTracking('merge_pdf', 'client', async () => runPdfOpInWorker({ op: 'merge' }), { fallsBackToServer });`)).toEqual([]);
    // A client wrapper with no server retry around it needs no option.
    expect(page(`const run = withToolTracking('sign_pdf', 'client', async () => 1);\nasync function go() { try { await run(); } catch (e) { setError(e); } }`)).toEqual([]);
    // And the correct shapes pass.
    expect(page(`const f = withToolTracking('merge_pdf', 'client', async () => runPdfOpInWorker({ op: 'merge' }));`)).toEqual([]);
    expect(page(`async function go() { try { trackToolComplete('crop_pdf', 1, { processing_method: 'client' }); } catch (e) { trackToolError('crop_pdf', e, 1, { processing_method: 'client' }); } }`)).toEqual([]);
  });
});
