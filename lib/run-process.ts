import { spawn } from 'child_process';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export interface ProcessResult {
  stdout: string;
  stderr: string;
  /** null when the process died from a signal. */
  exitCode: number | null;
  /** The signal that killed it: SIGTERM or SIGKILL after a timeout, SIGSEGV for a native crash. */
  signal: NodeJS.Signals | null;
  /** True when it ran past timeoutMs and we killed it. */
  timedOut: boolean;
}

export interface RunProcessOptions {
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** Cap on captured stdout and on stderr. Output past it is dropped, not fatal. Default 1 MB. */
  maxOutputBytes?: number;
  /** How long the group gets to exit after SIGTERM before it is SIGKILLed. Default 2 s. */
  termGraceMs?: number;
}

/** How long to wait for stdio to close once the process group is gone. */
const CLOSE_GRACE_MS = 5000;
const TERM_GRACE_MS = 2000;
const GROUP_POLL_MS = 25;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run a program without a shell, and settle only once it and everything it
 * started are gone.
 *
 * Why not exec(): exec runs the command through /bin/sh, and its timeout kills
 * only that shell. The real worker (python3 and anything it spawns) survives as
 * an orphan and writes its output after the route's cleanup has already run.
 * Four pdf2docx outputs (342 MB) from 2026-09-05 were still in /tmp on
 * 2026-10-04 because of this, breaking the "deleted within 1 hour" promise.
 *
 * Here the child leads its own process group (`detached`), a timeout stops
 * the whole group, and the group is stopped again once the leader exits so a
 * straggler cannot outlive it either. The promise settles only once the group
 * is empty, so a caller's cleanup in `finally` runs after the last possible
 * writer has exited.
 *
 * Stopping is SIGTERM, then SIGKILL for whatever is still there after
 * termGraceMs. The SIGTERM matters: a SIGKILLed LibreOffice leaves its partial
 * output (/tmp/lu*.tmp, user content) and lock files behind, and an Xvfb that
 * xvfb-run has just asked to exit leaves /tmp/.X<n>-lock if it is SIGKILLed
 * mid-shutdown. Both clean up within ~25 ms of a SIGTERM.
 *
 * Rejects only when the program cannot be started (e.g. ENOENT); a non-zero
 * exit, a crash or a timeout resolves with the details.
 */
export function runProcess(
  command: string,
  args: string[],
  options: RunProcessOptions
): Promise<ProcessResult> {
  const maxOutput = options.maxOutputBytes ?? 1024 * 1024;
  const termGraceMs = options.termGraceMs ?? TERM_GRACE_MS;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < maxOutput) stdout += chunk.slice(0, maxOutput - stdout.length);
    });
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < maxOutput) stderr += chunk.slice(0, maxOutput - stderr.length);
    });

    const signalGroup = (signal: NodeJS.Signals) => {
      if (child.pid === undefined) return;
      try {
        // Negative pid = the whole process group the child leads.
        process.kill(-child.pid, signal);
      } catch {
        // ESRCH: the group is already empty. On platforms without process
        // groups, fall back to the child itself.
        child.kill(signal);
      }
    };

    const groupAlive = () => {
      if (child.pid === undefined) return false;
      try {
        process.kill(-child.pid, 0);
        return true;
      } catch {
        return false;
      }
    };

    let stopping: Promise<void> | undefined;
    const stopGroup = () =>
      (stopping ??= (async () => {
        signalGroup('SIGTERM');
        const deadline = Date.now() + termGraceMs;
        while (groupAlive() && Date.now() < deadline) await sleep(GROUP_POLL_MS);
        if (groupAlive()) signalGroup('SIGKILL');
      })());

    let timedOut = false;
    let exited: { code: number | null; signal: NodeJS.Signals | null } | null = null;
    let groupGone = false;
    let closed = false;
    let settled = false;
    let graceTimer: NodeJS.Timeout | undefined;

    const timer = setTimeout(() => {
      timedOut = true;
      void stopGroup();
    }, options.timeoutMs);

    const settle = () => {
      if (settled || !exited || !groupGone || !closed) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(graceTimer);
      resolve({ stdout, stderr, exitCode: exited.code, signal: exited.signal, timedOut });
    };

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(graceTimer);
      reject(error);
    });

    child.on('exit', (code, signal) => {
      exited = { code, signal };
      clearTimeout(timer);
      // Anything the leader left behind in its group goes with it.
      void stopGroup().then(() => {
        groupGone = true;
        // 'close' (stdio drained) normally follows at once. If something that
        // escaped the group still holds the pipes, do not hang the request.
        graceTimer = setTimeout(() => {
          child.stdout.destroy();
          child.stderr.destroy();
          closed = true;
          settle();
        }, CLOSE_GRACE_MS);
        settle();
      });
    });

    child.on('close', () => {
      closed = true;
      settle();
    });
  });
}

/**
 * Run `fn` with a fresh private directory under tmpdir(), and remove the
 * directory once `fn` settles.
 *
 * For converters that keep work files of their own (ocrmypdf's work folder,
 * LibreOffice's profile and temp files): point their TMPDIR at this directory.
 * A SIGKILL, or a SIGTERM to a program with no handler for it (ocrmypdf's
 * python), skips the converter's own cleanup, but this one still runs, and
 * because runProcess settles only after the whole group is dead, nothing can
 * write into the directory after it is removed.
 */
export async function withScratchDir<T>(prefix: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
