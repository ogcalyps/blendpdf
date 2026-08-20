import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runtime = 'nodejs';
export const maxDuration = 30;

// Engine availability is probed at most once per 10 minutes and cached at
// module scope; binaries do not appear/disappear between requests.
const ENGINE_CACHE_TTL_MS = 10 * 60 * 1000;
let enginesCheckedAt = 0;
let enginesProbe: Promise<Record<string, boolean>> | null = null;

async function probeCommand(command: string, timeout = 10000): Promise<boolean> {
  try {
    await execAsync(command, { timeout, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

async function probeEngines(): Promise<Record<string, boolean>> {
  const [qpdf, gs, sofficeDirect, ocrmypdf, python3, pypdf, pdf2docx, tabula] = await Promise.all([
    probeCommand('qpdf --version'),
    probeCommand('gs --version'),
    probeCommand('soffice --version'),
    probeCommand('ocrmypdf --version'),
    probeCommand('python3 --version'),
    probeCommand('python3 -c "import pypdf"'),
    probeCommand('python3 -c "import pdf2docx"'),
    probeCommand('python3 -c "import tabula"'),
  ]);

  // Some installs expose only the `libreoffice` wrapper, not `soffice`
  const soffice = sofficeDirect || (await probeCommand('libreoffice --version'));

  return { qpdf, gs, soffice, ocrmypdf, python3, pypdf, pdf2docx, tabula };
}

function getEngines(): Promise<Record<string, boolean>> {
  const now = Date.now();
  if (!enginesProbe || now - enginesCheckedAt > ENGINE_CACHE_TTL_MS) {
    enginesCheckedAt = now;
    enginesProbe = probeEngines().catch(() => ({}));
  }
  return enginesProbe;
}

export async function GET() {
  const timestamp = new Date().toISOString();
  console.log(`[HEALTH] Health check at ${timestamp}`);
  console.error(`[HEALTH] Health check at ${timestamp}`); // Also to stderr

  const engines = await getEngines();

  return NextResponse.json({
    status: 'ok',
    timestamp,
    runtime: 'nodejs',
    engines,
    enginesCheckedAt: new Date(enginesCheckedAt).toISOString(),
  });
}

// Add POST endpoint to test if POST requests work at all
export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString();
  console.log(`[HEALTH] POST request received at ${timestamp}`);
  console.error(`[HEALTH] POST request received at ${timestamp}`);

  // Try to read the request body (without FormData)
  try {
    const contentType = request.headers.get('content-type');
    const contentLength = request.headers.get('content-length');
    console.log(`[HEALTH] POST - Content-Type: ${contentType}, Content-Length: ${contentLength}`);

    // Don't await body - just check if request is readable
    return NextResponse.json({
      status: 'ok',
      method: 'POST',
      timestamp,
      contentType,
      contentLength,
      message: 'POST requests work',
    });
  } catch (error) {
    console.error(`[HEALTH] POST error:`, error);
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
