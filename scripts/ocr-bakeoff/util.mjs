// Low-level helpers shared by the bake-off harness. Plain Node ESM, no deps.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Run a binary, capture stdout/stderr, never throw. Returns {code, stdout, stderr, killed}.
export function sh(cmd, args = [], { timeoutMs = 300000, cwd } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { cwd });
    } catch (err) {
      resolve({ code: -1, stdout: '', stderr: String(err), error: err });
      return;
    }
    let stdout = '';
    let stderr = '';
    let killed = false;
    const timer = setTimeout(() => {
      killed = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr || String(err), error: err });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, killed });
    });
  });
}

// Is a binary on PATH?
export async function which(bin) {
  const r = await sh('which', [bin], { timeoutMs: 5000 });
  return r.code === 0 && r.stdout.trim().length > 0;
}

// Page count via poppler's pdfinfo, or null if unavailable.
export async function pdfPageCount(file) {
  const r = await sh('pdfinfo', [file], { timeoutMs: 15000 });
  if (r.code !== 0) return null;
  const m = r.stdout.match(/Pages:\s+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// Read a file as newline-free base64 (Buffer base64 has no line breaks).
export function b64File(file) {
  return fs.readFileSync(file).toString('base64');
}

// Rasterize page 1 to a small PNG and return a data: URI, or null on failure.
export async function firstPageThumb(file, tmpDir, dpi = 80) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const prefix = path.join(tmpDir, 'thumb');
  const r = await sh('pdftoppm', ['-png', '-f', '1', '-l', '1', '-r', String(dpi), file, prefix], { timeoutMs: 30000 });
  if (r.code !== 0) return null;
  const pngs = fs.readdirSync(tmpDir).filter((f) => f.startsWith('thumb') && f.endsWith('.png'));
  if (!pngs.length) return null;
  const png = fs.readFileSync(path.join(tmpDir, pngs.sort()[0]));
  return `data:image/png;base64,${png.toString('base64')}`;
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
};

// MIME type for a sample file by extension, or null if unrecognized.
export function mimeForFile(file) {
  return MIME_BY_EXT[path.extname(file).toLowerCase()] || null;
}

// Embed a raster file directly as a data: URI (used as the report thumbnail for
// image samples, which have no PDF page to rasterize).
export function dataUri(file, mime) {
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

// Flatten an image onto a white background and re-encode as JPEG (no alpha
// channel). ocrmypdf refuses images that carry an alpha channel — common in
// screenshots and phone-photo PNGs — so the Tesseract path needs this first.
// Uses the project's `canvas` dep; returns null if canvas is unavailable or the
// image can't be decoded (caller then falls back to the original file).
export async function flattenImage(src, destPath) {
  const mod = await import('canvas').catch(() => null);
  if (!mod) return null;
  try {
    const img = await mod.loadImage(src);
    const c = mod.createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, img.width, img.height);
    ctx.drawImage(img, 0, 0);
    fs.writeFileSync(destPath, c.toBuffer('image/jpeg', { quality: 0.95 }));
    return destPath;
  } catch {
    return null;
  }
}
