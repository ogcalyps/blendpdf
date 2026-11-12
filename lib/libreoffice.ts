import { mkdir, readFile } from 'fs/promises';
import { join, parse } from 'path';
import { pathToFileURL } from 'url';
import { runProcess, withScratchDir, type ProcessResult } from './run-process';

export interface ConvertWithLibreOfficeOptions {
  /** Flags that go before --convert-to, e.g. --headless. */
  flags: string[];
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
  /** Run under `xvfb-run -a`, which gets its own virtual display. */
  useXvfb?: boolean;
}

export interface LibreOfficeResult extends ProcessResult {
  /** The converted file, or null when LibreOffice wrote none (or an empty one). */
  output: Buffer | null;
}

/**
 * Convert one file with LibreOffice, as its own process tree, leaving nothing
 * behind in /tmp.
 *
 * LibreOffice is single-instance per user profile: a soffice started against a
 * profile that is already in use passes its job to the running instance over a
 * pipe and waits. On the shared default profile (~/.config/libreoffice) one
 * request's conversion could therefore run inside another request's process,
 * where killing this request's process group cannot reach it. A private
 * profile per call makes every conversion its own instance, in its own group.
 *
 * The output directory is private too. LibreOffice writes its output through
 * a temp file next to the target (lu*.tmp) plus a .~lock file, and a run that
 * is stopped mid-export leaves both behind, half a document of user content
 * included. Profile, output directory, TMPDIR and xvfb-run's auth file all
 * live in one scratch directory; the output is read before it is removed,
 * which happens only after runProcess has seen the whole group exit.
 */
export function convertWithLibreOffice(
  libreOfficeCmd: string,
  inputPath: string,
  convertTo: string,
  options: ConvertWithLibreOfficeOptions
): Promise<LibreOfficeResult> {
  return withScratchDir('lo-', async (scratch) => {
    const outDir = join(scratch, 'out');
    await mkdir(outDir);

    const officeArgs = [
      `-env:UserInstallation=${pathToFileURL(join(scratch, 'profile')).href}`,
      ...options.flags,
      '--convert-to', convertTo,
      '--outdir', outDir,
      inputPath,
    ];
    const [command, argv] = options.useXvfb
      ? ['xvfb-run', ['-a', libreOfficeCmd, ...officeArgs]]
      : [libreOfficeCmd, officeArgs];

    const result = await runProcess(command, argv, {
      timeoutMs: options.timeoutMs,
      cwd: scratch,
      env: { ...options.env, TMPDIR: scratch },
    });

    // LibreOffice names the output after the input: <name>.<format>, where
    // convertTo may carry a filter ("pdf:writer_pdf_Export").
    const outputPath = join(outDir, `${parse(inputPath).name}.${convertTo.split(':')[0]}`);
    const output = await readFile(outputPath).catch(() => null);
    return { ...result, output: output && output.length > 0 ? output : null };
  });
}
