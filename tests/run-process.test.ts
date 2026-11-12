import { describe, it, expect, afterEach } from 'vitest';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runProcess, withScratchDir } from '../lib/run-process';
import { convertWithLibreOffice } from '../lib/libreoffice';

/**
 * On 2026-10-04, four pdf2docx outputs (342 MB) from 2026-09-05 were found in
 * /tmp. exec() ran python through a shell, its timeout killed only the shell,
 * and the orphaned python wrote its .docx after the route had cleaned up.
 * These tests use real processes because the bug only exists in the real
 * process tree.
 */

const node = process.execPath;
let dir: string;

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('runProcess', () => {
  it('returns stdout and the exit code of a normal run', async () => {
    const result = await runProcess(node, ['-e', 'process.stdout.write("SUCCESS")'], { timeoutMs: 10_000 });
    expect(result).toMatchObject({ stdout: 'SUCCESS', exitCode: 0, signal: null, timedOut: false });
  });

  it('resolves (does not throw) on a non-zero exit, with stderr', async () => {
    const result = await runProcess(node, ['-e', 'console.error("ERROR: No tables found"); process.exit(1)'], {
      timeoutMs: 10_000,
    });
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No tables found');
    expect(result.timedOut).toBe(false);
  });

  it('reports a native crash as the signal, since no shell turns it into exit 139', async () => {
    const result = await runProcess(node, ['-e', 'process.kill(process.pid, "SIGSEGV")'], { timeoutMs: 10_000 });
    expect(result.exitCode).toBeNull();
    expect(result.signal).toBe('SIGSEGV');
  });

  it('rejects when the program does not exist', async () => {
    await expect(runProcess('definitely-not-a-real-binary-xyz', [], { timeoutMs: 1_000 })).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('on timeout, kills the grandchild too, so nothing is written after it returns', async () => {
    dir = mkdtempSync(join(tmpdir(), 'run-process-'));
    const lateOutput = join(dir, 'late.docx');
    // sh is the direct child and node the grandchild (the trailing `; true`
    // stops sh from exec-ing into node), the same shape as exec('python3 …').
    const writer = `setTimeout(() => require("fs").writeFileSync(${JSON.stringify(lateOutput)}, "x"), 800)`;
    const result = await runProcess('sh', ['-c', `"${node}" -e '${writer}'; true`], { timeoutMs: 200 });

    expect(result.timedOut).toBe(true);
    expect(result.signal).toBe('SIGTERM');

    // Well past the moment an orphaned grandchild would have written.
    await sleep(1_500);
    expect(existsSync(lateOutput)).toBe(false);
  });

  it('SIGKILLs a grandchild that ignores SIGTERM once the grace is up', async () => {
    dir = mkdtempSync(join(tmpdir(), 'run-process-'));
    const lateOutput = join(dir, 'late.docx');
    const writer = `process.on("SIGTERM", () => {}); setTimeout(() => require("fs").writeFileSync(${JSON.stringify(lateOutput)}, "x"), 1000)`;
    const result = await runProcess('sh', ['-c', `"${node}" -e '${writer}'; true`], { timeoutMs: 200, termGraceMs: 300 });

    expect(result.timedOut).toBe(true);
    await sleep(1_500);
    expect(existsSync(lateOutput)).toBe(false);
  });

  it('on timeout, sends SIGTERM first so the program can remove its partial output', async () => {
    // A SIGKILLed LibreOffice leaves its half-written output (/tmp/lu*.tmp)
    // behind; on SIGTERM it deletes it.
    dir = mkdtempSync(join(tmpdir(), 'run-process-'));
    const partial = join(dir, 'lu1234.tmp');
    const converter = `const fs = require("fs"); fs.writeFileSync(${JSON.stringify(partial)}, "half a pdf"); process.on("SIGTERM", () => setTimeout(() => { fs.unlinkSync(${JSON.stringify(partial)}); process.exit(1); }, 100)); setInterval(() => {}, 1000)`;
    const result = await runProcess(node, ['-e', converter], { timeoutMs: 300 });

    expect(result.timedOut).toBe(true);
    expect(existsSync(partial)).toBe(false);
  });

  it('also reaps a background straggler left behind by a child that exits normally', async () => {
    dir = mkdtempSync(join(tmpdir(), 'run-process-'));
    const lateOutput = join(dir, 'late.xlsx');
    const writer = `setTimeout(() => require("fs").writeFileSync(${JSON.stringify(lateOutput)}, "x"), 800)`;
    // The straggler gets its own stdio so it does not hold our pipes open.
    const result = await runProcess('sh', ['-c', `"${node}" -e '${writer}' >/dev/null 2>&1 & exit 0`], {
      timeoutMs: 10_000,
    });

    expect(result.exitCode).toBe(0);
    await sleep(1_500);
    expect(existsSync(lateOutput)).toBe(false);
  });

  it('lets a straggler that is already shutting down finish its cleanup', async () => {
    // xvfb-run's shape: it SIGTERMs Xvfb and exits without waiting. SIGKILLing
    // the group at that moment left /tmp/.X99-lock behind on normal runs.
    dir = mkdtempSync(join(tmpdir(), 'run-process-'));
    const lock = join(dir, '.X99-lock');
    const server = `const fs = require("fs"); fs.writeFileSync(${JSON.stringify(lock)}, "x"); process.on("SIGTERM", () => setTimeout(() => { fs.rmSync(${JSON.stringify(lock)}, { force: true }); process.exit(0); }, 150)); setInterval(() => {}, 1000)`;
    const result = await runProcess(
      'sh',
      ['-c', `"${node}" -e '${server}' >/dev/null 2>&1 & pid=$!; sleep 0.3; kill $pid; exit 0`],
      { timeoutMs: 10_000 }
    );

    expect(result.exitCode).toBe(0);
    expect(existsSync(lock)).toBe(false);
  });
});

describe('withScratchDir', () => {
  it('removes the directory after a timed-out run, and a killed writer cannot bring it back', async () => {
    let scratch = '';
    // The grandchild recreates its work dir before writing, as a converter
    // would. If it outlived the timeout, the directory would reappear.
    const result = await withScratchDir('run-process-test-', (dir) => {
      scratch = dir;
      const late = join(dir, 'work', 'late.pdf');
      const writer = `setTimeout(() => { const fs = require("fs"); fs.mkdirSync(${JSON.stringify(join(dir, 'work'))}, { recursive: true }); fs.writeFileSync(${JSON.stringify(late)}, "x"); }, 800)`;
      // Own stdio, so a surviving writer would not hold our pipes and delay
      // runProcess past its write.
      return runProcess('sh', ['-c', `"${node}" -e '${writer}' >/dev/null 2>&1; true`], { timeoutMs: 200 });
    });

    expect(result.timedOut).toBe(true);
    expect(existsSync(scratch)).toBe(false);
    await sleep(1_500);
    expect(existsSync(scratch)).toBe(false);
  });
});

describe('convertWithLibreOffice', () => {
  // Stands in for soffice: prints TMPDIR and its argv, one per line, then
  // writes <outdir>/<input name>.<format> the way LibreOffice names output.
  const FAKE_SOFFICE = [
    '#!/bin/sh',
    'echo "TMPDIR=$TMPDIR"',
    `printf '%s\\n' "$@"`,
    'while [ $# -gt 0 ]; do',
    '  case "$1" in',
    '    --convert-to) fmt=$2; shift ;;',
    '    --outdir) out=$2; shift ;;',
    '    *) in=$1 ;;',
    '  esac',
    '  shift',
    'done',
    'name=$(basename "$in"); name=${name%.*}',
    'printf converted > "$out/$name.$fmt"',
    '',
  ].join('\n');

  const fakeBin = (dir: string, name: string, script: string) => {
    const path = join(dir, name);
    writeFileSync(path, script);
    chmodSync(path, 0o755);
    return path;
  };

  it('gives every conversion its own profile and output dir, both removed afterwards', async () => {
    dir = mkdtempSync(join(tmpdir(), 'run-process-'));
    const soffice = fakeBin(dir, 'soffice', FAKE_SOFFICE);
    const input = join(dir, 'abc.docx');

    const runs = await Promise.all(
      [1, 2].map(() =>
        convertWithLibreOffice(soffice, input, 'pdf', { flags: ['--headless'], timeoutMs: 10_000, env: process.env })
      )
    );
    const profiles = runs.map(({ stdout, output }) => {
      const [tmpLine, profileArg, ...rest] = stdout.trim().split('\n');
      const scratch = tmpLine.replace('TMPDIR=', '');
      expect(scratch.startsWith(join(tmpdir(), 'lo-'))).toBe(true);
      expect(profileArg).toBe(`-env:UserInstallation=file://${scratch}/profile`);
      // The output (and LibreOffice's lu*.tmp / .~lock files with it) goes to
      // the scratch dir, never to a shared directory.
      expect(rest).toEqual(['--headless', '--convert-to', 'pdf', '--outdir', join(scratch, 'out'), input]);
      expect(output?.toString()).toBe('converted');
      expect(existsSync(scratch)).toBe(false);
      return profileArg;
    });
    // A shared profile is what lets one soffice hand its job to another.
    expect(profiles[0]).not.toBe(profiles[1]);
  });

  it('puts xvfb-run in front of soffice, and reports no output when none was written', async () => {
    dir = mkdtempSync(join(tmpdir(), 'run-process-'));
    fakeBin(dir, 'xvfb-run', `#!/bin/sh\necho "TMPDIR=$TMPDIR"\nprintf '%s\\n' "$@"\n`);
    const result = await convertWithLibreOffice('soffice', '/x/in.pptx', 'pdf', {
      flags: ['--headless'],
      timeoutMs: 10_000,
      useXvfb: true,
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    });
    const [, ...argv] = result.stdout.trim().split('\n');
    expect(argv.slice(0, 2)).toEqual(['-a', 'soffice']);
    expect(argv[2]).toMatch(/^-env:UserInstallation=file:\/\//);
    expect(argv[3]).toBe('--headless');
    expect(result.output).toBeNull();
  });
});

describe('converters that write temp output run through runProcess', () => {
  const root = join(__dirname, '..');
  const PYTHON = /runProcess\('python3', \[pythonScriptPath\]/;
  const LIBREOFFICE = /convertWithLibreOffice\(libreOfficeCmd, inputPath, '(pdf|docx)',/;

  // The converter call each route must make.
  const routes: [string, RegExp[]][] = [
    ['app/api/pdf-to-word/route.ts', [PYTHON, LIBREOFFICE]],
    ['app/api/pdf-to-excel/route.ts', [PYTHON]],
    ['app/api/repair-pdf/route.ts', [PYTHON]],
    ['app/api/unlock-pdf/route.ts', [/runProcess\('qpdf', args,/]],
    ['app/api/ocr-pdf/route.ts', [/withScratchDir\('ocr-'/, /runProcess\(ocrmypdfPath, args,/]],
    ['app/api/word-to-pdf/route.ts', [LIBREOFFICE]],
    ['app/api/excel-to-pdf/route.ts', [LIBREOFFICE]],
    ['app/api/powerpoint-to-pdf/route.ts', [LIBREOFFICE]],
  ];

  // exec()'s timeout kills only /bin/sh, so whatever still goes through it must
  // be a short probe that writes nothing: `which`, an import check, chmod.
  const PROBE = /^['"`](which |python3 -c |\$\{pythonCmd\} -c |chmod )/;

  it.each(routes)('%s', (route, calls) => {
    const src = readFileSync(join(root, route), 'utf8');
    for (const call of calls) expect(src).toMatch(call);

    const shellCommands = [...src.matchAll(/execAsync\(\s*([^,)]+)/g)].map((m) => m[1].trim());
    for (const command of shellCommands) {
      expect(command, `${route} runs ${command} through a shell`).toMatch(PROBE);
    }
  });
});
